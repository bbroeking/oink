// Shop catalog data lifecycle — the fetch + derived state behind the Shop
// screen's Today / Collectibles / Closet views. Extracted from shop.tsx's
// inline `load` so the screen keeps only rendering, modals, and the purchase /
// equip flows.
//
// Mirrors useHomeStats / useCrew: an initial + focus-refresh fetch, a single
// `refresh()` other flows call after their own mutations, and optimistic
// setters (counter/owned/active-ids/title) so a buy or equip reflects
// immediately without waiting on the refetch round trip.
//
// The fetch fans a 6-way Promise.all: daily_shop() (today's drop), the full
// hats catalog, the caller's owned hat ids, their profile (balance + equipped
// slots + VIP), shop_resets_in_seconds() (the countdown seed), and
// sounder_counter_buys() (what crewmates put on today — the sounder at the
// counter, Storefront build 2). The members' shelf is derived from the full
// catalog client-side (utils/shopShelves), no seventh leg. Any select error is a real error — it surfaces
// through the shared `fetchError` beat rather than being retried with fewer
// columns. The counter fetch is the one best-effort leg: it goes through the
// rpc() helper (never rejects, logs its own failure) and an error there reads
// as an empty counter, so an unpushed or briefly failing function can never
// take the shelves down with it.
//
// This hook also owns the reset countdown: it seeds resetsIn from the RPC and
// runs the 1s tick + the UTC-midnight rollover refetch (parked at 0 → refetch
// today's drop) so all catalog-data lifecycle lives in one place. The screen
// reads resetsIn for display only.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import {
  HAT_IMAGES,
  HAT_THUMBNAILS_256,
  HatRow,
  HIDDEN_CATEGORIES,
} from "@/constants/hats";
import {
  buyableIds as unionBuyableIds,
  parseCounterBuys,
  resolveCounterBuys,
  type CounterBuy,
} from "@/utils/shopCounter";
import { dailyPick, dropDateKey } from "@/utils/shopShelves";

// The members' shelf under the Slop Club sign holds this many pieces a day —
// one shelf's worth, like the drop's own shelves (Storefront build 2).
const MEMBERS_SHELF_COUNT = 3;

export interface UseShopCatalog {
  // First-load flag — lets the daily grid show the loading beat instead of the
  // "all sold out" empty state while the first fetch is in flight. An in-flight
  // refetch keeps prior items on screen (lists are never cleared), so consumers
  // only read `loading` on the very first fetch.
  loading: boolean;
  // A failed fetch is not an empty shop. Consumers show a recoverable
  // unavailable state while preserving any catalog data already on screen.
  error: string | null;
  // Today's drop (even-count-trimmed for the 2-col grid), the full shoppable
  // catalog, and the caller's owned item ids.
  daily: HatRow[];
  allItems: HatRow[];
  owned: Set<string>;
  // Equipped-slot map, keyed by profiles column (active_hat_id, …). Optimistic
  // equips patch this via patchActiveIds; a refresh reconciles it.
  activeIds: Record<string, string | null>;
  counter: number;
  isVip: boolean;
  userId: string | null;
  activeTitleId: string | null;
  // Countdown seed (seconds) — ticks down every second and refetches on the
  // UTC-midnight rollover, both owned here.
  resetsIn: number;
  // The sounder at the counter: crewmates' buys from today, each joined to its
  // catalog item (newest first). A friend who bought nothing has no entry.
  counterBuys: CounterBuy[];
  // The members' shelf: today's pick of members-only pieces with art, chosen
  // from the id + the UTC date so every member sees the same shelf and it
  // rolls with the drop. daily_shop() excludes members_only, so this is the
  // one place the members catalog is on sale.
  membersShelf: HatRow[];
  // Derived: allItems ∩ owned, and the id-set of today's drop.
  ownedItems: HatRow[];
  dailyIds: Set<string>;
  // Derived: dailyIds ∪ the counter's item ids ∪ the members' shelf —
  // everything a tap can buy. The screen's "today only" gate and the preview
  // sheet's `buyable` read this.
  buyableIds: Set<string>;
  // Re-run the whole fetch (focus, post-mutation resync, paywall unlock).
  refresh: () => Promise<void>;
  // Optimistic mutators — apply a locally-known change now; refresh reconciles.
  setCounter: React.Dispatch<React.SetStateAction<number>>;
  setOwned: React.Dispatch<React.SetStateAction<Set<string>>>;
  setActiveTitleId: React.Dispatch<React.SetStateAction<string | null>>;
  // Merge an equip column-patch into activeIds (the handleEquip optimistic set).
  patchActiveIds: (update: Record<string, string | null>) => void;
}

export function useShopCatalog(): UseShopCatalog {
  const [daily, setDaily] = useState<HatRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<HatRow[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  // Multi-slot equipment: hat, aura, and background each have their own column
  // on profiles. Equipping an aura clears the aura slot only, leaving any
  // hat/background equipped intact. Keyed by profiles column (active_hat_id, …).
  const [activeIds, setActiveIds] = useState<Record<string, string | null>>({});
  const [counter, setCounter] = useState<number>(0);
  const [resetsIn, setResetsIn] = useState<number>(0);
  // Slop Club membership — drives the lock badge + members section CTA in the
  // Collectibles catalog (the buy itself is server-gated by buy_hat).
  const [isVip, setIsVip] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTitleId, setActiveTitleId] = useState<string | null>(null);
  const [counterBuys, setCounterBuys] = useState<CounterBuy[]>([]);
  // The UTC day the shelves were stocked for — set by each fetch, so the
  // members' shelf re-rolls with the midnight refetch, not on a render.
  const [dropDate, setDropDate] = useState<string>(() => dropDateKey());

  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setLoading(true);
      setError(null);
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (authError || !user) {
        setError(
          authError
            ? "We couldn't reach the shop. Check your connection and try again."
            : "Sign in to see today's shop.",
        );
        setLoading(false);
        return;
      }

      const [dailyRes, allRes, ownedRes, profRes, resetsRes, counterRes] =
        await Promise.all([
          supabase.rpc("daily_shop"),
          supabase
            .from("hats")
            .select(
              "id, name, cost, display_order, emoji, image_path, category, rarity, description, pass_exclusive, members_only, prestige_exclusive",
            )
            .order("display_order"),
          supabase.from("user_hats").select("hat_id").eq("user_id", user.id),
          supabase
            .from("profiles")
            .select(
              "counter, is_vip, active_hat_id, active_bow_id, active_glasses_id, active_mask_id, active_neck_id, active_aura_id, active_background_id, active_held_id, active_tickle_particle_id, active_title_id",
            )
            .eq("id", user.id)
            .single(),
          supabase.rpc("shop_resets_in_seconds"),
          rpc<unknown>("sounder_counter_buys"),
        ]);
      const fetchError =
        dailyRes.error ??
        allRes.error ??
        ownedRes.error ??
        profRes.error ??
        resetsRes.error;
      if (fetchError) {
        setError(
          "The shop didn't load. Your balance and collection are unchanged.",
        );
        setLoading(false);
        return;
      }
      // The two casts below are the ONE narrowing this module can't get from the
      // generated types: `hats.rarity` is plain `text` in Postgres, while HatRow
      // narrows it to the `Rarity` union the UI switches on. Every other field
      // lines up, so the assertion only tightens `rarity`/`category`.
      const filterPlaceable = (rows: HatRow[]) =>
        rows.filter((r) => !r.category || !HIDDEN_CATEGORIES.has(r.category));
      const ownedSet = new Set((ownedRes.data ?? []).map((r) => r.hat_id));
      // Even-count guarantee for the 2-col grid: daily_shop() rolls LIMIT 8,
      // but client-side hidden-category filtering (scarf/necklace) can drop
      // that to an odd number, leaving a lonely dangling card. Trim the
      // trailing item to the nearest even count.
      const dailyItems = filterPlaceable(
        (dailyRes.data as HatRow[] | null) ?? [],
      );
      if (dailyItems.length % 2 === 1) dailyItems.pop();
      setDaily(dailyItems);
      // Cost-0 items are season-pass exclusives — not for sale. Only surface
      // them if the player already OWNS them (claimed via the pass); otherwise
      // they leak into the browseable shop (which players noticed).
      const shoppable = filterPlaceable((allRes.data as HatRow[]) ?? []).filter(
        (r) => (r.cost > 0 && !r.pass_exclusive) || ownedSet.has(r.id),
      );
      setAllItems(shoppable);
      // The counter resolves against the same shoppable catalog, so a
      // crewmate's buy of something this shop can't sell (hidden category,
      // an id the catalog lacks) never stands at the counter.
      setCounterBuys(
        resolveCounterBuys(parseCounterBuys(counterRes), shoppable),
      );
      setOwned(ownedSet);
      const prof = profRes.data;
      setCounter(prof?.counter ?? 0);
      setIsVip(!!prof?.is_vip);
      setActiveIds({
        active_hat_id: prof?.active_hat_id ?? null,
        active_bow_id: prof?.active_bow_id ?? null,
        active_glasses_id: prof?.active_glasses_id ?? null,
        active_mask_id: prof?.active_mask_id ?? null,
        active_neck_id: prof?.active_neck_id ?? null,
        active_aura_id: prof?.active_aura_id ?? null,
        active_background_id: prof?.active_background_id ?? null,
        active_held_id: prof?.active_held_id ?? null,
        active_tickle_particle_id: prof?.active_tickle_particle_id ?? null,
      });
      setActiveTitleId(prof?.active_title_id ?? null);
      setUserId(user.id);
      setResetsIn(resetsRes.data ?? 0);
      setDropDate(dropDateKey());
    } catch {
      setError(
        "We couldn't reach the shop. Check your connection and try again.",
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void load();
      return () => setFocused(false);
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
      if (state === "active" && focused) void load();
    });
    return () => subscription.remove();
  }, [focused, load]);

  useEffect(() => {
    // Errors retry on explicit action or focus, never on a 2-second loop.
    if (!focused || !appActive || loading || error) return;
    if (resetsIn <= 0) {
      // Countdown parked at 0 — the shop rolled over UTC midnight while
      // this screen stayed open. Refetch today's shop + reseed the timer
      // instead of freezing on yesterday's items. The 2s delay guards
      // against a tight reload loop if the server is still reporting 0
      // right at the boundary (clock skew): worst case we gently re-poll
      // every 2s until it ticks past midnight, then resetsIn goes
      // positive and this settles back into the 1s countdown.
      const t = setTimeout(() => {
        void load();
      }, 2000);
      return () => clearTimeout(t);
    }
    const t = setInterval(() => setResetsIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [appActive, focused, loading, error, resetsIn, load]);

  const patchActiveIds = useCallback(
    (update: Record<string, string | null>) => {
      setActiveIds((prev) => ({ ...prev, ...update }));
    },
    [],
  );

  const dailyIds = useMemo(() => new Set(daily.map((d) => d.id)), [daily]);

  const ownedItems = useMemo(
    () => allItems.filter((i) => owned.has(i.id)),
    [allItems, owned],
  );

  // Only pieces the shelf can SELL rotate in. `allItems` keeps a pass
  // reward the player already owns (so the Closet can show it), but a pass
  // reward is the pass's — nine members-only cosmetics sit on the season-1
  // premium track (20260727) with catalog prices, and every one of them is
  // pass_exclusive; none may take a shelf slot, owned or not.
  const membersShelf = useMemo(
    () =>
      dailyPick(
        allItems.filter(
          (i) =>
            !!i.members_only &&
            !i.pass_exclusive &&
            i.cost > 0 &&
            (!!HAT_IMAGES[i.id] || !!HAT_THUMBNAILS_256[i.id]),
        ),
        dropDate,
        MEMBERS_SHELF_COUNT,
      ),
    [allItems, dropDate],
  );

  const buyableIds = useMemo(() => {
    const ids = unionBuyableIds(daily, counterBuys);
    for (const item of membersShelf) ids.add(item.id);
    return ids;
  }, [daily, counterBuys, membersShelf]);

  return {
    loading,
    error,
    daily,
    allItems,
    owned,
    activeIds,
    counter,
    isVip,
    userId,
    activeTitleId,
    resetsIn,
    counterBuys,
    membersShelf,
    ownedItems,
    dailyIds,
    buyableIds,
    refresh: load,
    setCounter,
    setOwned,
    setActiveTitleId,
    patchActiveIds,
  };
}
