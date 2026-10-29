import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
// The context's safe view: React Native 0.86 deprecates its own (a console
// warning on every render), and this one pads the same four edges.
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useIsFocused } from "expo-router/react-navigation";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { usePigRoster } from "@/hooks/usePigRoster";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useScreenReader } from "@/hooks/useScreenReader";
import { equipCosmetic } from "@/utils/cosmetics";
import { formatCountdownHM } from "@/utils/duration";
import {
  BuyCelebration,
  Button,
  EmptyState,
  LoadingBeat,
  PageHeader,
  ScrollEdge,
  SectionHeader,
  useScrollEdge,
  type BuyCelebrationHandle,
} from "../../components/ui";
import {
  ClosetView,
  type ClosetViewHandle,
} from "../../components/ClosetView";
import {
  GRID_PAD,
  RarityLegend,
  ShopCard,
  gridTileWidth,
  shopCardStyles,
} from "@/components/shop/ShopCard";
import { SnoutsPocket } from "@/components/shop/SnoutsPocket";
import { StallCardSlot } from "@/components/shop/StallCard";
import { useSeasonalShelf, stallVisible } from "@/hooks/useSeasonalShelf";
import { useStallIntro, useStallVisited } from "@/hooks/useStallOnboarding";
import { StallIntroModal } from "@/components/StallIntroModal";
import { showNewHereTag } from "@/utils/stallIntro";
import { stallBuyCopy } from "@/utils/seasonalShelf";
import { leavingLabel } from "@/utils/shelfCountdown";
import { HangingSign } from "@/components/shop/HangingSign";
import { Chalkboard } from "@/components/shop/Chalkboard";
import { Shelf, ShelfItem, SlopClubShelf } from "@/components/shop/Shelf";
import { Counter } from "@/components/shop/Counter";
import { HatRow } from "@/constants/hats";
import {
  buyableNow,
  cardTapAction,
  chunkShelves,
  shopKicker,
} from "@/utils/shopShelves";
import { resolveShopParams } from "@/utils/shopNav";
import { SHOP_SIGN_LABELS_MIN } from "@/constants/layoutBreakpoints";
import { columnForCategory } from "@/constants/slots";
import {
  UI_COLORS,
  BORDER,
  CHROME_TYPE_CAP,
  WHIMSY,
  SPACE,
  PAGE_PAD,
  TINT,
} from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { showPurchaseToast } from "../../components/PurchaseToast";
import { showToast } from "@/components/ui/Toast";
import { costumeEquipRefusal, costumeTakeOffToast } from "@/utils/costumeCopy";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

// ── Drawing constants ───────────────────────────────────────────────────────
// Geometry, not spacing: the sizes of the marks this screen draws. The card's
// own geometry moved with it to components/shop/ShopCard. (2026-10-29)
/** The shelves hold three items each (Storefront build 2). */
const PER_SHELF = 3;
/** The plank wall's faint horizontal grain: one hairline every so often. */
const WALL_STRIPE_PITCH = 48;
/**
 * Where the buy burst fires when the tile's measured centre is missing (a
 * race, or the card unmounted under the refetch) — a mid-screen fallback.
 */
const FALLBACK_BURST = { x: 200, y: 400 };

// The Shop tab is ONE room: the fitting room, the doorway, the shelves, the
// counter, the catalog, on one scroll (2026-09-17). The Pen and Furnish are
// pushed routes behind their signs — a hanging sign always leaves the page —
// and `utils/shopNav` holds the rule that redirects an old `?view=pen` link.

export default function ShopScreen() {
  // Catalog data lifecycle (fetch + derived state + reset countdown) lives in
  // useShopCatalog; the screen owns only rendering, modals, and the purchase /
  // equip flows. Optimistic setters (setCounter/setOwned/patchActiveIds/
  // setActiveTitleId) let a buy or equip reflect before the refetch lands.
  const {
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
    wornItems,
    ownedItems,
    dailyIds,
    buyableIds: catalogBuyableIds,
    refresh,
    setCounter,
    setOwned,
    setActiveTitleId,
    patchActiveIds,
  } = useShopCatalog();
  // The Pop-up Stall (2026-10-29): its card rides the top of the wall while a
  // stall is open or boarded, and an open stall's pieces are on sale today
  // wherever they show (the catalog below, the counter), so they join the one
  // "today only" gate the screen and the sheet read.
  const stall = useSeasonalShelf();
  const stallOpen = stall.phase === "open" && !!stall.shelf;
  // Halloween onboarding (2026-10-29): a one-time 3-card intro while a stall
  // is open, once per set key, queued behind every launch popup; and a "new
  // here?" tag on the card until the first step into the stall.
  const shopFocused = useIsFocused();
  const stallIntro = useStallIntro({
    shelf: stall.shelf,
    phase: stall.phase,
    userId,
    focused: shopFocused,
  });
  const stallVisited = useStallVisited(stall.shelf?.key ?? null, userId);
  const stallIds = useMemo(
    () => new Set(stallOpen ? stall.items.map((i) => i.id) : []),
    [stallOpen, stall.items],
  );
  const buyableIds = useMemo(() => {
    if (stallIds.size === 0) return catalogBuyableIds;
    const ids = new Set(catalogBuyableIds);
    for (const id of stallIds) ids.add(id);
    return ids;
  }, [catalogBuyableIds, stallIds]);
  const hasCatalogData =
    daily.length > 0 || allItems.length > 0 || owned.size > 0;
  // Wearing implies owning: a dangling equip (the profile points at an item
  // the closet doesn't hold — seen on the demo account, 2026-09-16) must
  // never read as "wearing" and hide the buy button.
  const isEquipped = (id: string, category: string | null | undefined) => {
    return owned.has(id) && activeIds[columnForCategory(category)] === id;
  };
  const equippedPreviewSlot = (column: "active_hat_id" | "active_bow_id") => {
    const id = activeIds[column];
    if (!id) return null;
    const catalogItem = allItems.find((candidate) => candidate.id === id);
    return {
      id,
      category: catalogItem?.category ?? null,
      emoji: catalogItem?.emoji ?? null,
    };
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<HatRow | null>(null);
  // The crown's scroll edge: drawn once the list has left its top, so what
  // scrolls under the crown slides under a drawn edge (polish pass,
  // 2026-10-04 — the fitting room used to be cut by an invisible line).
  const edge = useScrollEdge();
  // The kicker counts what a tap can buy right now — the sun price tags on
  // the page (utils/shopShelves shopKicker).
  const inReach = useMemo(
    () =>
      allItems.filter((item) =>
        buyableNow(item, { owned, buyableIds, counter, isVip }),
      ).length,
    [allItems, owned, buyableIds, counter, isVip],
  );
  const kicker = shopKicker({
    loading,
    failed: !!error,
    shelfCount: daily.length + membersShelf.length,
    inReach,
    stallOpen,
  });
  // The store's one scroller, and the two things the screen drives on it: the
  // fold (the hero fitting room scrolled off — the hero pig rests while it is
  // off screen) and the imperative jump to "Your closet" that every Closet
  // door now performs. (The folded "wearing N of M" strip that rode the fold
  // retired 2026-09-18 — founder: "it's not necessary".)
  const closetRef = useRef<ClosetViewHandle>(null);
  const [folded, setFolded] = useState(false);
  const [closetPending, setClosetPending] = useState(false);
  // The Trough left the store 2026-09-17: it is reached from the Barn
  // button's fan and nowhere else (its sheet, the counter trough and the
  // quarter-prize reveal all live in components/Barn.tsx now).
  // The scene ships behind the 2-col grid as its Reduce-Motion / VoiceOver
  // fallback (taste-standard 2026-09-16, ruling 5): a screen reader gets a
  // list of cards, not a picture to find its way around by touch.
  const { reduceMotion } = useMotionPolicy();
  const screenReader = useScreenReader();
  const plainShelves = reduceMotion || screenReader;
  // The store only needs the roster for WHICH pig stands in the fitting room;
  // recruiting and joining moved out with the Pen (app/pen.tsx, 2026-09-17).
  const pigRoster = usePigRoster();

  // Deep-link target: navigation from elsewhere (e.g. the battle-pass
  // reward dialog) can pass `?view=wardrobe` to jump straight there.
  // We consume the param once on focus, then clear it from the URL so
  // switching tabs/back doesn't keep re-snapping the view.
  const params = useLocalSearchParams<{
    view?: string;
    filter?: string;
    trough?: string;
  }>();
  useEffect(() => {
    // One rule, in one place: utils/shopNav. `?view=wardrobe` / `browse` and
    // `?filter=prestige` are old links to a room that no longer exists — they
    // land on the store and scroll to the closet section instead. The
    // prestige-only filter went with the Me "Prestige gear" row (2026-09-22):
    // the regalia's one home is the Wallow rank sheet, so an old
    // `?filter=prestige` link simply opens the closet.
    const target = resolveShopParams({
      view: params.view,
      filter: params.filter,
    });
    if (!target) return;
    router.setParams({ view: undefined, filter: undefined });
    // The Pen is a route now, not a view: an old link leaves the tab.
    if (target.redirect) {
      router.replace(target.redirect);
      return;
    }
    if (target.scrollToCloset) setClosetPending(true);
  }, [params.filter, params.view]);
  // The jump waits for the list: ClosetView mounts with the store, and its own
  // handle waits again if the crown has not laid out yet.
  useEffect(() => {
    if (!closetPending) return;
    setClosetPending(false);
    closetRef.current?.scrollToCloset();
  }, [closetPending]);
  useEffect(() => {
    // `?trough=open` used to open the sheet here; the Trough is the Barn
    // fan's now. Consume the param so an old link doesn't stick.
    if (params.trough === "open") router.setParams({ trough: undefined });
  }, [params.trough]);
  // Title EQUIP UI renders inside ClosetView (the Closet view). Titles are
  // earned-only now (see 20260677) — there is no shop buy path. activeTitleId
  // + userId are sourced from the profile by useShopCatalog; the Closet reads
  // them (and pushes title changes back through setActiveTitleId).

  // Imperative handle for the on-screen "ka-ching" particle burst.
  // Fired from handleBuy on the tile that was just purchased.
  const celebrationRef = useRef<BuyCelebrationHandle>(null);
  const tileCenters = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Pre-loaded SFX players. expo-audio caches the decoded buffer so
  // .play() after seekTo(0) is effectively instant on subsequent fires.
  const deniedPlayer = useAudioPlayer(deniedSound);
  const equipPlayer = useAudioPlayer(equipSound);

  const handleBuy = async (hat: HatRow) => {
    if (busyId) return;
    // Today's drop OR the counter (a crewmate bought it today) — the two
    // inventories share one gate. buy_hat itself never checked the drop, so
    // this client gate is the only "today only" rule there is.
    if (!buyableIds.has(hat.id)) {
      showPurchaseToast({
        type: "fail",
        title: "Today only",
        text: "This item is only available in today's shop.",
      });
      return;
    }
    setBusyId(hat.id);
    const r = await rpc<{
      ok: boolean;
      reason?: string;
      need?: number;
      have?: number;
      remaining?: number;
    }>("buy_hat", {
      target_hat_id: hat.id,
    });
    setBusyId(null);
    if (!r) {
      showPurchaseToast({
        type: "fail",
        title: "Couldn't buy",
        text: "Try again.",
      });
      return;
    }
    if (!r.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
      try {
        deniedPlayer.seekTo(0);
        deniedPlayer.play();
      } catch {}
      if (r.reason === "insufficient") {
        showPurchaseToast({
          type: "fail",
          title: "Not enough snouts",
          text: `You need ${(r.need ?? 0) - (r.have ?? 0)} more.`,
        });
        return;
      }
      if (r.reason === "already_owned") {
        showPurchaseToast({
          type: "fail",
          title: "Already yours",
          text: "You already own this one.",
        });
        return;
      }
      if (r.reason === "members_only") {
        // A crewmate's Slop Club piece at the counter, tapped by a
        // non-member — the card wore the lock, so this only fires on a
        // stale UI state (membership lapsed between load and tap).
        showPurchaseToast({
          type: "fail",
          title: "Slop Club only",
          text: "Join the Slop Club to buy members' pieces.",
        });
        return;
      }
      if (r.reason === "not_for_sale") {
        // Season-pass + referral-milestone hats have cost=0 in
        // the catalog; buy_hat rejects them. The shop card +
        // preview modal both gate against this client-side
        // now, so this path only fires on a stale UI state.
        showPurchaseToast({
          type: "fail",
          title: "Earned, not sold",
          text: "Unlock this from the Season Pass or a referral milestone.",
        });
        return;
      }
      showPurchaseToast({
        type: "fail",
        title: "Couldn't buy",
        text: r.reason ?? "Something went wrong.",
      });
      return;
    }
    // Buy succeeded — snap the balance chip IMMEDIATELY (buy_hat
    // returns the post-spend counter as `remaining`); the refresh()
    // below still reconciles owned/daily, but the spend must never wait
    // on that round trip to show.
    setCounter((c) => r.remaining ?? Math.max(0, c - hat.cost));
    setOwned((prev) => new Set(prev).add(hat.id));
    showPurchaseToast({
      type: "success",
      title: `${hat.name} · Bought`,
      text: "Added to your closet.",
      cost: hat.cost,
    });
    // Fire the on-screen ka-ching celebration anchored at the tile
    // the user tapped. Tile center is recorded in tileCenters by
    // renderCell's onLayout; if missing (race / unmount), the burst
    // shows at a sensible mid-screen fallback.
    const center = tileCenters.current.get(hat.id);
    celebrationRef.current?.fire({
      x: center?.x ?? FALLBACK_BURST.x,
      y: center?.y ?? FALLBACK_BURST.y,
      tier:
        hat.rarity === "epic" || hat.rarity === "legendary"
          ? "premium"
          : "common",
    });
    // BuyCelebration already plays the success haptic + sound; skip
    // the duplicate Haptics.notificationAsync below to avoid stacking
    // two haptics on top of each other.
    refresh();
  };

  // Equip a cosmetic (or unequip when itemId is null). The routing +
  // face-slot exclusivity rule and the profiles write live in
  // utils/cosmetics (equipCosmetic); the screen keeps the equip haptic +
  // SFX and patches activeIds optimistically from the returned column patch
  // (write, then patch).
  const handleEquip = async (
    itemId: string | null,
    category: string | null | undefined,
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    // Full costumes (Halloween 2026) fit Rosie only in v1, and taking one
    // off says what comes back out from underneath.
    const refusal = costumeEquipRefusal(category, itemId, pigRoster.roster.activePigId);
    if (refusal) {
      showToast({ tone: "info", title: refusal });
      return;
    }
    const offLine = costumeTakeOffToast(category, itemId, activeIds, (id) =>
      [...wornItems, ...allItems].find((row) => row.id === id)?.name,
    );
    Haptics.selectionAsync().catch(() => {});
    try {
      equipPlayer.seekTo(0);
      equipPlayer.play();
    } catch {}
    const update = await equipCosmetic(itemId, category);
    patchActiveIds(update);
    if (offLine && "active_costume_id" in update) showToast({ tone: "info", title: offLine });
  };

  // Redesigned Today grid: numeric 2-col tile width (GRID_PAD scroll padding
  // ×2, GRID_GAP between — never %-size grid children; Yoga-quirk discipline).
  // The formula lives with the card (components/shop/ShopCard gridTileWidth).
  const { width: shopScreenW } = useWindowDimensions();
  const dailyTileW = gridTileWidth(shopScreenW, GRID_PAD);
  // The wall's grain is drawn to the measured height of the store's content.
  const [wallH, setWallH] = useState(0);
  const stripes = Math.floor(wallH / WALL_STRIPE_PITCH);

  // Owned items dress the pig from the shelf (the Closet grid's rule, back
  // in the store 2026-09-17); anything else opens the sheet.
  const tapCard = (item: HatRow) => {
    const tap = cardTapAction(item.id, {
      owned: owned.has(item.id),
      active: isEquipped(item.id, item.category),
    });
    if (tap.kind === "equip") void handleEquip(tap.itemId, item.category);
    else setPreviewItem(item);
  };
  const shelfItem = (item: HatRow, i: number, locked = false) => (
    <ShelfItem
      key={item.id}
      item={item}
      index={i}
      owned={owned.has(item.id)}
      active={isEquipped(item.id, item.category)}
      canAfford={counter >= item.cost}
      inDrop={buyableIds.has(item.id)}
      locked={locked}
      onPress={() => tapCard(item)}
      onLongPress={() => setPreviewItem(item)}
      onCenter={(x, y) => tileCenters.current.set(item.id, { x, y })}
    />
  );
  const gridCard = (item: HatRow, i: number, membersOnly = false) => (
    <View key={item.id} style={{ width: dailyTileW }}>
      <ShopCard
        item={item}
        index={i}
        owned={owned.has(item.id)}
        active={isEquipped(item.id, item.category)}
        canAfford={counter >= item.cost}
        inDrop={buyableIds.has(item.id)}
        membersOnly={membersOnly}
        locked={membersOnly && !isVip}
        onPress={() => tapCard(item)}
        onLongPress={() => setPreviewItem(item)}
        onCenter={(x, y) => tileCenters.current.set(item.id, { x, y })}
      />
    </View>
  );

  // The door: the chalkboard, and the two hanging signs beside it.
  //
  // THREE VERBS, THREE LOOKS (2026-09-17): a hanging sign always LEAVES the
  // page — the Pen and Furnish are pushed routes — a chip or segment always
  // stays on it, and a card always acts on an item. The Store and Closet signs
  // retired with the rooms they opened: there is one room, and the catalog is a
  // section of it. Below SHOP_SIGN_LABELS_MIN the signs drop their word and
  // keep their painted glyph.
  const signLabelsHidden = shopScreenW < SHOP_SIGN_LABELS_MIN;
  const doorway = (
    <View style={styles.doorway}>
      <Chalkboard countdown={formatCountdownHM(resetsIn)} />
      <View style={styles.signs}>
        <HangingSign
          label="Pen"
          glyph="signPen"
          labelHidden={signLabelsHidden}
          onPress={() => router.push("/pen")}
          accessibilityLabel="Pen"
          accessibilityHint="Opens the Pen, where Rosie's friends live"
        />
        <HangingSign
          label="Furnish"
          glyph="barnDoor"
          labelHidden={signLabelsHidden}
          onPress={() => router.push("/barn-collection")}
          accessibilityLabel="Furnish"
          accessibilityHint="Browse Barn furnishings to buy with Snouts or earn through play"
        />
      </View>
    </View>
  );

  // The store's wall: the plank room with its faint grain, the doorway, the
  // shelves, the members' shelf and the counter. It is no longer a scroller of
  // its own — it rides inside the Closet's list, between the fitting room above
  // it and the closet catalog below (2026-09-17).
  const storeWall = (
    <View style={styles.wall}>
      <View
        style={styles.room}
        onLayout={(e: LayoutChangeEvent) =>
          setWallH(e.nativeEvent.layout.height)
        }
      >
        <View style={styles.grain} pointerEvents="none">
          {Array.from({ length: stripes }, (_, i) => (
            <View
              key={i}
              style={[styles.stripe, { top: (i + 1) * WALL_STRIPE_PITCH }]}
            />
          ))}
        </View>
        {/* The Pop-up Stall's card hangs at the top of the wall while a
            stall is open or boarded (B1); no stall, no card. */}
        {stall.shelf && stallVisible(stall.phase) ? (
          <View style={styles.stall}>
            <StallCardSlot
              shelf={stall.shelf}
              phase={stall.phase}
              items={stall.items}
              now={stall.now}
              ownedCount={
                stall.items.filter((i) => i.owned || owned.has(i.id)).length
              }
              newHere={showNewHereTag(stall.phase, stallVisited)}
              onPress={() => {
                if (!stall.shelf) return;
                router.push({
                  pathname: "/stall/[key]",
                  params: { key: stall.shelf.key },
                });
              }}
            />
          </View>
        ) : null}
        {doorway}
        <View style={styles.shelves}>
          {daily.length === 0 ? (
            loading ? (
              // Still fetching today's drop — a loading shop must never read
              // as sold-out. Show the cozy loading beat until the fetch
              // completes and the result is genuinely empty.
              <LoadingBeat label="stocking the shelves" />
            ) : (
              <EmptyState
                glyph="zzz"
                title="All sold out for today"
                sub="A fresh drop arrives at sunrise."
              />
            )
          ) : plainShelves ? (
            <>
              {/* The kicker said "today's drop" over "Today's Drop"; it says
                  the drop's one rule now (the buy gate's "Today only"). */}
              <SectionHeader
                kicker="sold today only"
                title="Today's Drop"
                right={`resets in ${formatCountdownHM(resetsIn)}`}
              />
              <RarityLegend />
              <View style={shopCardStyles.grid}>
                {daily.map((item, i) => gridCard(item, i))}
              </View>
            </>
          ) : (
            chunkShelves(daily, PER_SHELF).map((row, r) => (
              <Shelf key={r} slots={PER_SHELF}>
                {row.map((item, i) => shelfItem(item, r * PER_SHELF + i))}
              </Shelf>
            ))
          )}
          {membersShelf.length > 0 ? (
            plainShelves ? (
              <>
                <SectionHeader
                  kicker="members only"
                  title="Slop Club"
                  right={isVip ? "yours to wear" : "join in the Pen"}
                />
                <View style={shopCardStyles.grid}>
                  {membersShelf.map((item, i) => gridCard(item, i, true))}
                </View>
              </>
            ) : (
              <SlopClubShelf
                onPressSign={() => router.push("/pen")}
                member={isVip}
                slots={PER_SHELF}
              >
                {membersShelf.map((item, i) => shelfItem(item, i, !isVip))}
              </SlopClubShelf>
            )
          ) : null}
        </View>
        <Counter
          buys={counterBuys}
          owned={owned}
          isEquipped={isEquipped}
          isVip={isVip}
          onPreview={(buy) => setPreviewItem(buy.item)}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* The crown every screen wears. The snouts pocket alone rides the
            right slot — the Golden Ticket left for Me, where redeeming a code
            already lives (2026-09-17). The kicker used to read "the shop"
            over a title that says Shop; it carries the day now ("three you
            can buy today"), which on an SE is the only word about the
            shelves above the fold (polish pass, 2026-10-04). [D-15] */}
        <PageHeader
          variant="tab"
          kicker={kicker}
          title="Shop"
          // The crown is pinned above the one scroller: past the chrome
          // ceiling it stops growing instead of eating the page (106).
          maxFontSizeMultiplier={CHROME_TYPE_CAP}
          right={<SnoutsPocket balance={counter} />}
        />
        {/* The crown's scroll edge (one rule app-wide), there only once
            something has slid under the crown; always laid out. */}
        <ScrollEdge visible={edge.edgeVisible} />

        {error ? (
          <EmptyState
            kind="error"
            glyph="dizzy"
            title="Shop unavailable"
            sub={error}
            action={
              <Button
                variant="ghost"
                size="sm"
                onPress={() => void refresh()}
                accessibilityLabel="Try again"
                accessibilityHint="Tries to load the shop again"
              >
                Try again
              </Button>
            }
          />
        ) : null}

        {error && !hasCatalogData ? null : (
          // The store is ONE scroll (the hero fitting room, 2026-09-17): the
          // Closet's paper-doll leads, the wall — doorway, shelves, members'
          // shelf, counter — sits in the middle of the very same list, and the
          // catalog follows it. No rooms, no lost scroll position.
          <View style={styles.listArea}>
            <ClosetView
              key="store"
              ref={closetRef}
              active={!previewItem && !folded}
              pigId={pigRoster.roster.activePigId}
              ownedItems={ownedItems}
              allItems={allItems}
              activeIds={activeIds}
              onEquip={handleEquip}
              onPreview={setPreviewItem}
              isEquipped={isEquipped}
              userId={userId}
              activeTitleId={activeTitleId}
              onTitleChange={setActiveTitleId}
              isVip={isVip}
              buyableIds={buyableIds}
              counter={counter}
              storeContent={storeWall}
              onFoldChange={setFolded}
              wornItems={wornItems}
              onScroll={edge.onScroll}
            />
          </View>
        )}
      </SafeAreaView>

      <ItemPreviewModal
        item={previewItem}
        owned={previewItem ? owned.has(previewItem.id) : false}
        active={
          previewItem ? isEquipped(previewItem.id, previewItem.category) : false
        }
        canAfford={previewItem ? counter >= previewItem.cost : false}
        balance={counter}
        busy={previewItem ? busyId === previewItem.id : false}
        buyable={previewItem ? buyableIds.has(previewItem.id) : true}
        troughable={previewItem ? dailyIds.has(previewItem.id) : true}
        locked={previewItem ? !!previewItem.members_only && !isVip : false}
        equippedHat={equippedPreviewSlot("active_hat_id")}
        equippedBow={equippedPreviewSlot("active_bow_id")}
        wornActiveIds={activeIds}
        viewerPigId={pigRoster.roster.activePigId}
        onTroughOpened={(spent, newBalance) => {
          // Seed left the account server-side — reflect it in the
          // header chip NOW, not on the next focus refetch. (The Barn's fan
          // row picks the new Trough up on its next focus.)
          setCounter((c) => newBalance ?? Math.max(0, c - spent));
        }}
        // A stall piece says how long it stays and asks before it sells
        // (the Pop-up Stall's grammar, wherever the piece is tapped).
        windowTag={
          previewItem && stallIds.has(previewItem.id) && stall.shelf
            ? leavingLabel(stall.shelf.closesAt, stall.now)
            : null
        }
        buyConfirm={
          previewItem && stallIds.has(previewItem.id) && stall.shelf
            ? stallBuyCopy(previewItem, counter, stall.shelf.closesAt, stall.now)
            : null
        }
        onClose={() => setPreviewItem(null)}
        onBuy={() => {
          if (previewItem) {
            handleBuy(previewItem);
          }
        }}
        onEquip={() => {
          if (previewItem) {
            handleEquip(previewItem.id, previewItem.category);
            setPreviewItem(null);
          }
        }}
        onUnequip={() => {
          if (previewItem) {
            handleEquip(null, previewItem.category);
            setPreviewItem(null);
          }
        }}
      />
      {/* On-screen ka-ching sparkle burst overlay. Rendered at root
			    so it sits above every other view (tabs, modals are below
			    the absolute fill order). Fired imperatively from handleBuy. */}
      <StallIntroModal
        visible={stallIntro.visible}
        shelf={stall.shelf}
        items={stall.items}
        now={stall.now}
        onDone={stallIntro.finish}
      />
      <BuyCelebration ref={celebrationRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHIMSY.cream },
  safeArea: { flex: 1 },
  // The list area — the store's one scroller.
  listArea: { flex: 1, position: "relative" },
  // The door: chalkboard left, the hanging signs right, on one line under
  // the crown. The row's top pad is the badge's clearance: a sign's count
  // badge hangs SPACE.sm above its sign, and used to land on the card above.
  // (2026-09-17 — the overlap fix. The signs state their width, the board is
  // the only thing in here that shrinks.)
  doorway: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.md,
    paddingHorizontal: PAGE_PAD,
    paddingTop: SPACE.card,
    marginBottom: SPACE.sm,
  },
  // The signs take exactly their own width — three SIGN_W signs and two gaps —
  // and the chalkboard takes what is left.
  signs: {
    flexShrink: 0,
    flexDirection: "row",
    gap: SPACE.xs,
  },
  // The wall — the plank room the store is, with its faint grain, closed top
  // and bottom by an ink rule. It rides inside the Closet's list now, so it
  // is a block, not a scroller; the room inside it measures for the grain.
  wall: {
    backgroundColor: WHIMSY.cream2,
    borderTopWidth: BORDER.ink,
    borderBottomWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
  },
  room: { position: "relative", paddingTop: SPACE.sm },
  // The stall card hangs at the top of the wall, above the doorway (B1).
  stall: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.card },
  grain: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stripe: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BORDER.ink,
    backgroundColor: TINT.inkWash,
  },
  shelves: {
    paddingHorizontal: PAGE_PAD,
    gap: SPACE.md,
  },
});
