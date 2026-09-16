import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  SafeAreaView,
  ScrollView,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { useTroughDrives } from "@/hooks/useTroughDrives";
import { usePigRoster } from "@/hooks/usePigRoster";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useScreenReader } from "@/hooks/useScreenReader";
import { cosmeticAccessibility, equipCosmetic } from "@/utils/cosmetics";
import { formatCountdownHM } from "@/utils/duration";
import { IAP_ENABLED, presentPaywall, OFFERING_IDS } from "../../utils/iap";
import { joinSlopClubAndRecruit } from "@/utils/joinSlopClub";
import { recruitPig } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";
import {
  BuyCelebration,
  Button,
  EmptyState,
  Glyph,
  Icon,
  LoadingBeat,
  Numeral,
  PageHeader,
  Ribbon,
  SectionHeader,
  SnoutCoin,
  Sticker,
  T,
  Tag,
  type BuyCelebrationHandle,
} from "../../components/ui";
import { ClosetView } from "../../components/ClosetView";
import { PigPenView } from "../../components/PigPenView";
import { HatThumb } from "@/components/shop/HatThumb";
import { HangingSign } from "@/components/shop/HangingSign";
import { Chalkboard } from "@/components/shop/Chalkboard";
import { Shelf, ShelfItem, SlopClubShelf } from "@/components/shop/Shelf";
import { TroughByCounter } from "@/components/shop/TroughByCounter";
import { Counter } from "@/components/shop/Counter";
import { TroughSheet } from "@/components/shop/TroughSheet";
import { HatRow } from "@/constants/hats";
import { HABITAT_CHROME_ASSETS } from "@/constants/habitat";
import { chunkShelves } from "@/utils/shopShelves";
import { columnForCategory } from "@/constants/slots";
import {
  UI_COLORS,
  BORDER,
  WHIMSY,
  SPACE,
  RADII,
  PAGE_PAD,
  SHADOW_SM,
  TAB_SAFE,
  TINT,
  RARITY_BG_SOLID,
  RARITY_STRIPE,
  WOOD,
} from "@/constants/theme";
import { ItemPreviewModal } from "../../components/ItemPreviewModal";
import { showPurchaseToast } from "../../components/PurchaseToast";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const deniedSound = require("../../assets/sounds/denied.mp3");
const equipSound = require("../../assets/sounds/equip.mp3");

// ── Drawing constants ───────────────────────────────────────────────────────
// Geometry, not spacing: the sizes of the marks and thumbnails this screen
// draws. Named here so no style block carries a bare number. (2026-09-11)
/** The rarity dot on a card corner, and the smaller one in the legend. */
const RARITY_DOT = 14;
const LEGEND_DOT = 12;
/** The round owned-check badge in the card's other corner. */
const OWNED_BADGE = 26;
/** Marks riding inside those badges / chips. */
const CHECK_MARK = 14;
/** The square paper chip that opens the Golden Ticket scanner. */
const TICKET_CHIP = 40;
const TICKET_GLYPH = 20;
const COIN_MARK = 20;
/** The card thumbnail's letterbox: a touch wider than it is tall. */
const THUMB_RATIO = 1.18;
/** The alternating scrapbook lean across the two grid columns. */
const CARD_TILT = 0.5;
/** The snouts pocket leans the other way, like a chip tucked in a pocket. */
const BALANCE_TILT = 2;
/** The 2-column grid's own page inset and card-to-card gap. */
const GRID_PAD = SPACE.md;
const GRID_GAP = SPACE.md;
/** The shelves hold three items each (Storefront build 2). */
const PER_SHELF = 3;
/** The plank wall's faint horizontal grain: one hairline every so often. */
const WALL_STRIPE_PITCH = 48;
/** The barn-door art on the Furnish sign — art in the icon slot, not an Icon. */
const DOOR_ART = { width: 20, height: 22 } as const;
/**
 * Where the buy burst fires when the tile's measured centre is missing (a
 * race, or the card unmounted under the refetch) — a mid-screen fallback.
 */
const FALLBACK_BURST = { x: 200, y: 400 };

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

// "daily" is the store itself; Closet and Pen hang as signs by the door.
type ShopView = "daily" | "wardrobe" | "pen";

// ── Shop redesign (Claude Design handoff, Shop Layout.html) ─────────
// Less text, more readable: rarity is a COLOR DOT + one legend (no word
// pills), the image is the hero on a rarity-tinted panel, and the price
// chip carries the buy-state (sun = affordable, muted = not yet,
// "Owned" tag = owned). No per-card buttons — tapping opens the
// preview/buy sheet. Uniform 2-col grid replaces the bento mosaic.
function RarityLegend() {
  return (
    <View
      style={shopCardStyles.legend}
      accessibilityRole="summary"
      accessibilityLabel={`Rarity colours, least to most rare: ${RARITIES.join(", ")}`}
    >
      {RARITIES.map((r) => (
        <View key={r} style={shopCardStyles.legendItem} accessible={false}>
          <View
            style={[
              shopCardStyles.legendDot,
              { backgroundColor: RARITY_STRIPE[r] },
            ]}
          />
          <T role="kickerPillSm" tone="secondary">
            {r}
          </T>
        </View>
      ))}
    </View>
  );
}

function ShopCard({
  item,
  owned,
  active,
  canAfford,
  index,
  locked,
  membersOnly,
  onPress,
  onCenter,
}: {
  item: HatRow;
  owned: boolean;
  active: boolean;
  canAfford: boolean;
  // Position in the grid — drives the alternating ±0.5° sticker tilt.
  index: number;
  // Members-only item + caller isn't a Slop Club member → the ribbon says so
  // in words (it's still a gate, not just identity).
  locked?: boolean;
  // Members-only item, regardless of VIP status. Drives the MEMBERS ribbon —
  // which stays for members too (it's Slop Club identity, not a lock).
  membersOnly?: boolean;
  onPress: () => void;
  // Reports the card's window-space center (the buy celebration anchor).
  onCenter?: (x: number, y: number) => void;
}) {
  const rarity = item.rarity ?? "common";
  const ref = useRef<View>(null);
  // The grid is the game's storefront: every card states its rarity, its
  // ownership, its cost and what a tap will do. [D-03] (2026-09-11)
  const a11y = cosmeticAccessibility(
    { name: item.name, rarity, cost: item.cost },
    { owned, active, locked, canAfford, action: "preview" },
  );
  return (
    <View
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow?.((x, y, w, h) =>
          onCenter?.(x + w / 2, y + h / 2),
        );
      }}
    >
      <Sticker
        // A gated card keeps its whole shape and mutes its FILL — the
        // 2026-07-07 ruling; the old blanket opacity dissolved the outline
        // it needs to still read as a card. [D-12] (2026-09-11)
        color={locked ? "cream2" : "paper"}
        rotate={index % 2 === 0 ? -CARD_TILT : CARD_TILT}
        radius={RADII.xl}
        onPress={onPress}
        accessibilityLabel={a11y.accessibilityLabel}
        accessibilityHint={a11y.accessibilityHint}
        accessibilityState={a11y.accessibilityState}
        style={shopCardStyles.card}
      >
        <View
          style={[
            shopCardStyles.thumb,
            { backgroundColor: RARITY_BG_SOLID[rarity] },
          ]}
        >
          <View
            style={[
              shopCardStyles.rdot,
              { backgroundColor: RARITY_STRIPE[rarity] },
            ]}
          />
          {owned ? (
            <View style={shopCardStyles.ownedBadge}>
              <Icon
                name="check"
                size={CHECK_MARK}
                color={UI_COLORS.textPrimary}
                strokeWidth={2.6}
              />
            </View>
          ) : membersOnly ? (
            // Slop Club corner ribbon. The lock rides it only while the item
            // is still gated; for members it stays as identity, no lock (the
            // 2026-07-12 ruling). [D-08] (2026-09-11)
            <Ribbon
              tone="slopGold"
              label="Members"
              icon={locked ? "lock" : undefined}
            />
          ) : null}
          <HatThumb item={item} fill />
        </View>
        <View style={shopCardStyles.foot}>
          <T role="cardTitleSm" numberOfLines={1}>
            {item.name}
          </T>
          {owned ? (
            <Tag
              tone="sage"
              icon="check"
              label={active ? "Wearing" : "Owned"}
              style={shopCardStyles.footTag}
            />
          ) : item.cost <= 0 ? (
            <Tag
              tone="muted"
              label="Season pass"
              style={shopCardStyles.footTag}
            />
          ) : (
            // The price IS the action's face. Affordable wears the sun; a
            // price you can't meet wears the muted (locked) fill rather than
            // an opacity crush. [D-12] (2026-09-11)
            <Tag
              tone={canAfford ? "sun" : "muted"}
              coin
              label={item.cost.toLocaleString()}
              style={shopCardStyles.footTag}
            />
          )}
        </View>
      </Sticker>
    </View>
  );
}

const shopCardStyles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    // Tight chip-to-chip gaps so the five rarities flow across 1–2 lines
    // instead of stacking one-per-row.
    columnGap: SPACE.sm,
    rowGap: SPACE.sm,
    // Flush with the grid: the parent scroll content already insets
    // PAGE-grid's gutter, so the legend carries no extra horizontal pad.
    paddingBottom: SPACE.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  legendDot: {
    width: LEGEND_DOT,
    height: LEGEND_DOT,
    borderRadius: RADII.pill,
    borderWidth: BORDER.thin,
    borderColor: UI_COLORS.border,
    ...SHADOW_SM,
  },
  card: {
    overflow: "hidden",
  },
  // aspectRatio is safe on VIEWS — HatThumb measures inside, so the
  // image itself still gets explicit numerics (the Yoga-quirk cure).
  thumb: {
    aspectRatio: THUMB_RATIO,
    borderBottomWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    position: "relative",
  },
  // Corner badges share a single SPACE.sm inset (UI audit).
  rdot: {
    position: "absolute",
    top: SPACE.sm,
    left: SPACE.sm,
    width: RARITY_DOT,
    height: RARITY_DOT,
    borderRadius: RADII.pill,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    zIndex: 2,
    ...SHADOW_SM,
  },
  ownedBadge: {
    position: "absolute",
    top: SPACE.sm,
    right: SPACE.sm,
    width: OWNED_BADGE,
    height: OWNED_BADGE,
    borderRadius: RADII.pill,
    backgroundColor: WHIMSY.sage,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...SHADOW_SM,
  },
  foot: { padding: SPACE.md, gap: SPACE.sm },
  // The footer capsule spans the card, so OWNED / SEASON PASS / the price all
  // share one footprint and the grid never reflows between states.
  footTag: { alignSelf: "stretch" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    // Card-to-card gap. Mirrored in the dailyTileW formula — keep the two in
    // sync (numeric-width Yoga discipline).
    gap: GRID_GAP,
    paddingBottom: SPACE.sm,
  },
});

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
    ownedItems,
    dailyIds,
    buyableIds,
    refresh,
    setCounter,
    setOwned,
    setActiveTitleId,
    patchActiveIds,
  } = useShopCatalog();
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
  const [view, setView] = useState<ShopView>("daily");
  const [prestigeOnly, setPrestigeOnly] = useState(false);
  // The Trough sheet, and the row that opened it (its card comes first).
  const [troughOpen, setTroughOpen] = useState(false);
  const [troughFocusId, setTroughFocusId] = useState<string | null>(null);
  const troughSummary = useTroughDrives();
  const openTrough = useCallback((driveId?: string) => {
    setTroughFocusId(driveId ?? null);
    setTroughOpen(true);
  }, []);
  // The scene ships behind the 2-col grid as its Reduce-Motion / VoiceOver
  // fallback (taste-standard 2026-09-16, ruling 5): a screen reader gets a
  // list of cards, not a picture to find its way around by touch.
  const { reduceMotion } = useMotionPolicy();
  const screenReader = useScreenReader();
  const plainShelves = reduceMotion || screenReader;
  const pigRoster = usePigRoster();
  const refreshPigRoster = pigRoster.refresh;

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
    if (params.view === "trough") {
      // Compatibility for old links: the Trough is an object in the store
      // now, not a Shop destination. Open its sheet over the store.
      setView("daily");
      setPrestigeOnly(false);
      setTroughOpen(true);
      router.setParams({ view: undefined, filter: undefined });
    } else if (params.view === "browse") {
      // Compatibility for old links: Collectibles now lives inside Closet.
      setView("wardrobe");
      setPrestigeOnly(false);
      router.setParams({ view: undefined, filter: undefined });
    } else if (
      params.view === "wardrobe" ||
      params.view === "daily" ||
      params.view === "pen"
    ) {
      setView(params.view);
      setPrestigeOnly(
        params.view === "wardrobe" && params.filter === "prestige",
      );
      router.setParams({ view: undefined, filter: undefined });
    }
  }, [params.filter, params.view]);
  useEffect(() => {
    if (params.trough === "open") {
      setTroughOpen(true);
      router.setParams({ trough: undefined });
    }
  }, [params.trough]);
  useEffect(() => {
    if (troughSummary.loaded && troughSummary.count === 0) setTroughOpen(false);
  }, [troughSummary.count, troughSummary.loaded]);
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

  // Join Slop Club from the members band header — the SAME RevenueCat offering
  // components/Account.tsx and the season premium unlock present. is_vip flips
  // server-side via the webhook; re-running the catalog fetch re-reads the
  // profile, which unlocks the members band + drops the ribbon locks.
  const handleJoinSlopClub = useCallback(
    async (pigId?: PigId) => {
      if (!pigId) {
        if (!IAP_ENABLED) {
          showPurchaseToast({
            type: "fail",
            title: "Slop Club isn’t enabled in this build",
            text: "Open a store-enabled build to join the Slop Club.",
          });
          return;
        }
        const paywall = await presentPaywall(OFFERING_IDS.slopClub);
        if (paywall.ok) {
          await Promise.all([refresh(), refreshPigRoster()]);
          showPurchaseToast({
            type: "success",
            title: "Welcome to the Slop Club!",
            text: "Choose Rosie’s friend in the Pen.",
          });
        } else if (paywall.reason !== "cancelled") {
          showPurchaseToast({
            type: "fail",
            title: "Couldn’t open the Slop Club",
            text:
              paywall.reason === "no_offering"
                ? "The storefront isn’t available right now. Please try again soon."
                : "Please try again.",
          });
        }
        return;
      }

      const outcome = await joinSlopClubAndRecruit(pigId, {
        iapEnabled: IAP_ENABLED,
        presentPaywall: () => presentPaywall(OFFERING_IDS.slopClub),
        recruit: recruitPig,
      });

      if (outcome.kind === "cancelled") return;
      if (outcome.kind === "unavailable") {
        showPurchaseToast({
          type: "fail",
          title: "Slop Club isn’t enabled in this build",
          text: "Open a store-enabled build to join and recruit this pig.",
        });
        return;
      }
      if (outcome.kind === "paywall_error") {
        showPurchaseToast({
          type: "fail",
          title: "Couldn’t open the Slop Club",
          text:
            outcome.reason === "no_offering"
              ? "The storefront isn’t available right now. Please try again soon."
              : "Please try again.",
        });
        return;
      }

      await Promise.all([refresh(), refreshPigRoster()]);
      if (outcome.kind === "joined") {
        const pig = pigDefinition(outcome.pigId);
        showPurchaseToast({
          type: "success",
          title: `${pig.name} joined the Pen!`,
          text: "Your Slop Club membership is active.",
        });
        return;
      }

      showPurchaseToast({
        type: "success",
        title: "Membership active",
        text:
          outcome.reason === "membership_syncing"
            ? "Your membership is still syncing. Try Recruit again in a moment."
            : "The membership worked, but this pig couldn’t join yet. Try Recruit again.",
      });
    },
    [refresh, refreshPigRoster],
  );

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
    Haptics.selectionAsync().catch(() => {});
    try {
      equipPlayer.seekTo(0);
      equipPlayer.play();
    } catch {}
    const update = await equipCosmetic(itemId, category);
    patchActiveIds(update);
  };

  // Redesigned Today grid: numeric 2-col tile width (GRID_PAD scroll padding
  // ×2, GRID_GAP between — never %-size grid children; Yoga-quirk discipline).
  // GRID_GAP MUST equal shopCardStyles.grid.gap.
  const { width: shopScreenW } = useWindowDimensions();
  const dailyTileW = Math.floor((shopScreenW - GRID_PAD * 2 - GRID_GAP) / 2);
  // The wall's grain is drawn to the measured height of the store's content.
  const [wallH, setWallH] = useState(0);
  const stripes = Math.floor(wallH / WALL_STRIPE_PITCH);

  const shelfItem = (item: HatRow, i: number, locked = false) => (
    <ShelfItem
      key={item.id}
      item={item}
      index={i}
      owned={owned.has(item.id)}
      active={isEquipped(item.id, item.category)}
      canAfford={counter >= item.cost}
      locked={locked}
      onPress={() => setPreviewItem(item)}
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
        membersOnly={membersOnly}
        locked={membersOnly && !isVip}
        onPress={() => setPreviewItem(item)}
        onCenter={(x, y) => tileCenters.current.set(item.id, { x, y })}
      />
    </View>
  );

  // The door: the chalkboard (or, away from the store, a sign back to it) and
  // the hanging signs. Closet and Furnish hang as signs so the counter front
  // belongs to the pigs (ruling 3); the Pen hangs beside them so it keeps its
  // door (Account and the paywall deep-link to it).
  const doorway = (
    <View style={styles.doorway}>
      {view === "daily" ? (
        <Chalkboard countdown={formatCountdownHM(resetsIn)} />
      ) : null}
      <View style={styles.signs}>
        {view !== "daily" ? (
          <HangingSign
            label="Store"
            icon="shop"
            onPress={() => {
              setView("daily");
              setPrestigeOnly(false);
            }}
            accessibilityHint="Back to the shelves"
          />
        ) : null}
        <HangingSign
          label="Closet"
          count={owned.size}
          icon="hat"
          active={view === "wardrobe"}
          onPress={() => {
            setView("wardrobe");
            setPrestigeOnly(false);
          }}
          accessibilityLabel={
            owned.size > 0 ? `Closet, ${owned.size} owned` : "Closet"
          }
          accessibilityHint="Shows the items you already own"
        />
        <HangingSign
          label="Pen"
          icon="pig"
          active={view === "pen"}
          onPress={() => {
            setView("pen");
            setPrestigeOnly(false);
          }}
          accessibilityHint="Shows Rosie's friends in the Pen"
        />
        <HangingSign
          label="Furnish"
          art={
            <Image
              source={HABITAT_CHROME_ASSETS.barnDoor}
              style={styles.doorArt}
              resizeMode="contain"
              accessible={false}
            />
          }
          onPress={() => router.push("/barn-collection")}
          accessibilityLabel="Furnish"
          accessibilityHint="Browse Barn furnishings to buy with Snouts or earn through play"
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* The crown every screen wears. Balance pocket + Golden Ticket chip
            ride the right slot; the kicker names THIS destination (it used to
            read "your closet" above a title that says Shop). [D-15] */}
        <PageHeader
          variant="tab"
          kicker="the shop"
          title="Shop"
          right={
            <>
              <Sticker
                color="paper"
                radius={RADII.md}
                shadow="sm"
                rotate={0}
                onPress={() => router.push("/scan-code")}
                accessibilityLabel="Redeem a Golden Ticket"
                accessibilityHint="Opens the code scanner"
                style={styles.ticketBtn}
              >
                <Glyph name="gift" size={TICKET_GLYPH} />
              </Sticker>
              <Sticker
                color="sun"
                radius={RADII.md}
                rotate={BALANCE_TILT}
                accessibilityRole="text"
                accessibilityLabel={`${counter.toLocaleString()} snouts`}
                style={styles.balance}
              >
                <SnoutCoin size={COIN_MARK} />
                <Numeral>{counter.toLocaleString()}</Numeral>
              </Sticker>
            </>
          }
        />

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

        {error && !hasCatalogData ? null : view === "daily" ? (
          // The store (Storefront build 2, 2026-09-16): a plank wall with the
          // chalkboard and signs by the door, the drop three to a shelf, the
          // members' shelf under the Slop Club sign, the Trough by the
          // counter, and the sounder at the counter. It scrolls as one room.
          <ScrollView
            key="daily"
            style={styles.wall}
            contentContainerStyle={styles.wallContent}
            showsVerticalScrollIndicator={false}
          >
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
              {doorway}
              <View style={styles.shelves}>
                {daily.length === 0 ? (
                  loading ? (
                    // Still fetching today's drop — a loading shop must
                    // never read as sold-out. Show the cozy loading beat
                    // until the fetch completes and the result is
                    // genuinely empty.
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
                    <SectionHeader
                      kicker="today's drop"
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
                    <Shelf key={r}>
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
                    <SlopClubShelf onPressSign={() => setView("pen")}>
                      {membersShelf.map((item, i) => shelfItem(item, i, !isVip))}
                    </SlopClubShelf>
                  )
                ) : null}
              </View>
              <View style={styles.troughWrap}>
                <TroughByCounter
                  drives={troughSummary.drives}
                  receipts={troughSummary.claimable}
                  onOpen={openTrough}
                />
              </View>
              <Counter
                buys={counterBuys}
                owned={owned}
                isEquipped={isEquipped}
                isVip={isVip}
                onPreview={(buy) => setPreviewItem(buy.item)}
              />
              <View style={styles.floor} />
            </View>
          </ScrollView>
        ) : view === "wardrobe" ? (
          <>
            {doorway}
            <ClosetView
              active={!previewItem}
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
              prestigeOnly={prestigeOnly}
              onClearPrestigeFilter={() => setPrestigeOnly(false)}
            />
          </>
        ) : (
          <>
            {doorway}
            <PigPenView
              roster={pigRoster.roster}
              loading={pigRoster.loading}
              error={pigRoster.error}
              onRetry={() => void pigRoster.refresh()}
              busyPigId={pigRoster.busyPigId}
              onJoinSlopClub={handleJoinSlopClub}
              onRecruit={pigRoster.recruit}
              onActivate={pigRoster.activate}
            />
          </>
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
        onTroughOpened={(spent, newBalance) => {
          // Seed left the account server-side — reflect it in the
          // header chip NOW, not on the next focus refetch.
          setCounter((c) => newBalance ?? Math.max(0, c - spent));
          // And the new Trough belongs in the trough by the counter now, not
          // after the next tab switch (the list only refetched on focus).
          void troughSummary.refresh();
        }}
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
      <TroughSheet
        open={troughOpen}
        focusDriveId={troughFocusId}
        data={troughSummary}
        onClose={() => setTroughOpen(false)}
        onBalance={(balance) => setCounter(balance)}
      />
      {/* On-screen ka-ching sparkle burst overlay. Rendered at root
			    so it sits above every other view (tabs, modals are below
			    the absolute fill order). Fired imperatively from handleBuy. */}
      <BuyCelebration ref={celebrationRef} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: WHIMSY.cream },
  safeArea: { flex: 1 },
  // Golden Ticket chip — square paper-face icon button next to the
  // balance pocket. Ink border + SHADOW_SM chrome comes from Sticker.
  ticketBtn: {
    width: TICKET_CHIP,
    height: TICKET_CHIP,
    alignItems: "center",
    justifyContent: "center",
  },
  // Snouts pocket — tilted sun sticker (the redesign's "snouts pocket":
  // makes the balance feel like a chip you keep, not a system bar).
  balance: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  // The door: chalkboard left, the hanging signs right, on one line under
  // the crown. The signs hang from the top edge, so the row has no top pad.
  doorway: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACE.md,
    paddingHorizontal: PAGE_PAD,
    marginBottom: SPACE.sm,
  },
  // The signs share whatever the chalkboard leaves; away from the store a
  // fourth sign, back to it, hangs in the chalkboard's place.
  signs: {
    flex: 1,
    flexDirection: "row",
    gap: SPACE.sm,
  },
  doorArt: { ...DOOR_ART },
  // The wall — the plank room the store is, with its faint grain, under an
  // ink rule. It is the scroller; the room inside it measures for the grain.
  wall: {
    flex: 1,
    backgroundColor: WHIMSY.cream2,
    borderTopWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    marginTop: SPACE.sm,
  },
  wallContent: { flexGrow: 1 },
  room: { position: "relative", flexGrow: 1, paddingTop: SPACE.sm },
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
  // The trough's pill hangs above its rim, over the shelf before it: the
  // wrapper stacks above the shelves so Fabric never paints them over it.
  troughWrap: {
    marginTop: SPACE.lg,
    marginHorizontal: PAGE_PAD,
    zIndex: 1,
  },
  // The counter's face runs on under the tab bar: the floor of the store.
  floor: {
    height: TAB_SAFE,
    backgroundColor: WOOD.bottom,
  },
});
