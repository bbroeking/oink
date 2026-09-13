import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { HabitatEntry } from "@/components/habitat/HabitatEntry";
import { useShopCatalog } from "@/hooks/useShopCatalog";
import { useTroughDrives } from "@/hooks/useTroughDrives";
import { usePigRoster } from "@/hooks/usePigRoster";
import { cosmeticAccessibility, equipCosmetic } from "@/utils/cosmetics";
import { formatCountdownHM } from "@/utils/duration";
import { IAP_ENABLED, presentPaywall, OFFERING_IDS } from "../../utils/iap";
import { joinSlopClubAndRecruit } from "@/utils/joinSlopClub";
import { recruitPig } from "@/utils/pigRoster";
import { pigDefinition, type PigId } from "@/utils/pigs";
import {
  AnimatedCosmetic,
  BuyCelebration,
  Button,
  CardTitle,
  EmptyState,
  Glyph,
  Icon,
  LoadingBeat,
  Numeral,
  PageHeader,
  Ribbon,
  SectionHeader,
  SegmentedControl,
  SnoutCoin,
  Sticker,
  T,
  Tag,
  type BuyCelebrationHandle,
  type SegmentOption,
} from "../../components/ui";
import { ClosetView } from "../../components/ClosetView";
import { TroughSection } from "../../components/TroughSection";
import { PigPenView } from "../../components/PigPenView";
import { HAT_IMAGES, HAT_THUMBNAILS_256, HatRow } from "@/constants/hats";
import { columnForCategory } from "@/constants/slots";
import { categoryIcon } from "@/constants/emojiArt";
import { cosmeticFxFor } from "@/constants/cosmeticFx";
import {
  UI_COLORS,
  BORDER,
  WHIMSY,
  SPACE,
  RADII,
  PAGE_PAD,
  SHADOW_SM,
  TAB_SAFE,
  RARITY_BG_SOLID,
  RARITY_STRIPE,
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
/** Inset of a HatThumb's art inside its measured box. */
const THUMB_INSET = 12;
/** The fraction of its box a fallback sparkle fills. */
const FALLBACK_ART_FRAC = 0.5;
/** The 2-column grid's own page inset and card-to-card gap. */
const GRID_PAD = SPACE.md;
const GRID_GAP = SPACE.md;
/** The default HatThumb box when a caller doesn't state one. */
const ART_THUMB = 100;
/** The Trough accordion's header row — a 44pt tap plus its own breathing room. */
const TROUGH_HEADER_H = 52;
/**
 * Where the buy burst fires when the tile's measured centre is missing (a
 * race, or the card unmounted under the refetch) — a mid-screen fallback.
 */
const FALLBACK_BURST = { x: 200, y: 400 };

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

type ShopView = "daily" | "wardrobe" | "pen";

// The three shop destinations. Navigation-like, so the segmented control wears
// `icon-over-label` — the icon is what you read first. [D-10] (2026-09-11)
const SHOP_VIEW_OPTIONS: readonly SegmentOption<ShopView>[] = [
  {
    value: "daily",
    label: "Today",
    icon: "clock",
    accessibilityHint: "Shows the items on sale today",
  },
  {
    value: "wardrobe",
    label: "Closet",
    icon: "hat",
    accessibilityHint: "Shows the items you already own",
  },
  {
    value: "pen",
    label: "Pen",
    icon: "pig",
    accessibilityHint: "Shows Rosie's friends in the Pen",
  },
];

function HatThumb({
  item,
  size,
  fill,
}: {
  item: HatRow;
  size?: number;
  fill?: boolean;
}) {
  // fill mode: MEASURE the box, then render the Image at an explicit
  // numeric size. Absolute-inset sizing (the previous fix) still hit the
  // Yoga intrinsic-size quirk inside the mosaic's aspectRatio cells
  // (sixth sighting) — bows/hats rendered at native px and cropped.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const hatSrc = HAT_THUMBNAILS_256[item.id] ?? HAT_IMAGES[item.id];
  // No item art → fall back to the category icon (real art). Auras +
  // necklaces have no category art (categoryIcon null) → neutral glyph.
  const catIcon = !hatSrc ? categoryIcon(item.category) : null;
  const src = hatSrc ?? catIcon;
  // Members-only / legendary items with an animation recipe render live
  // (float + glow + shimmer + sparkles) instead of a flat Image.
  const fx = hatSrc ? cosmeticFxFor(item.id) : undefined;
  if (!fill) {
    const side = size ?? ART_THUMB;
    if (fx && hatSrc) return <AnimatedCosmetic source={hatSrc} fx={fx} size={side} />;
    if (src) return <Image source={src} style={{ width: side, height: side }} resizeMode="contain" />;
    // Missing art is a PLACEHOLDER, not a label — it renders as the hand-drawn
    // sparkle the Closet already uses for the same case. [D-19] (2026-09-11)
    return <Glyph name="sparkle" size={side * FALLBACK_ART_FRAC} />;
  }
  // Backgrounds + auras are edge-to-edge art — cover the whole box.
  // Everything else contain-fits a centered square with breathing room.
  const fullBleed = item.category === "background" || item.category === "aura";
  const side = box ? Math.max(0, Math.min(box.w, box.h) - THUMB_INSET) : 0;
  return (
    <View
      style={styles.thumbFillBox}
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
    >
      {box && fx && hatSrc && !fullBleed ? (
        <AnimatedCosmetic source={hatSrc} fx={fx} size={side} />
      ) : box && src ? (
        <Image
          source={src}
          style={
            fullBleed
              ? { width: box.w, height: box.h }
              : { width: side, height: side }
          }
          resizeMode={fullBleed ? "cover" : "contain"}
        />
      ) : !src && box ? (
        <Glyph
          name="sparkle"
          size={Math.min(box.w, box.h) * FALLBACK_ART_FRAC}
        />
      ) : null}
    </View>
  );
}

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
    ownedItems,
    dailyIds,
    refresh,
    setCounter,
    setOwned,
    setActiveTitleId,
    patchActiveIds,
  } = useShopCatalog();
  const hasCatalogData =
    daily.length > 0 || allItems.length > 0 || owned.size > 0;
  const isEquipped = (id: string, category: string | null | undefined) => {
    return activeIds[columnForCategory(category)] === id;
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
  const [troughOpen, setTroughOpen] = useState(false);
  const troughSummary = useTroughDrives();
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
      // Compatibility for old links: Trough is now an accordion, not a
      // Shop destination. Open it in place and leave the player in Today.
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
    if (troughSummary.count === 0) setTroughOpen(false);
  }, [troughSummary.count]);
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

  // The Closet segment carries the owned count, so the control announces what
  // the number means rather than reading "Closet, dot, 12".
  const viewOptions = useMemo<SegmentOption<ShopView>[]>(
    () =>
      SHOP_VIEW_OPTIONS.map((option) =>
        option.value === "wardrobe" && owned.size > 0
          ? {
              ...option,
              label: `Closet · ${owned.size}`,
              accessibilityLabel: `Closet, ${owned.size} owned`,
            }
          : option,
      ),
    [owned.size],
  );

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
    if (!daily.some((d) => d.id === hat.id)) {
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

        {troughSummary.count > 0 ? (
          <View style={styles.troughAccordion}>
            <Sticker
              color="sage"
              radius={RADII.md}
              shadow="sm"
              rotate={0}
              onPress={() => setTroughOpen((open) => !open)}
              accessibilityState={{ expanded: troughOpen }}
              accessibilityLabel={`The Trough, ${
                troughSummary.activeCount > 0
                  ? `${troughSummary.activeCount} active`
                  : `${troughSummary.claimable.length} updates`
              }`}
              accessibilityHint={
                troughOpen
                  ? "Collapses the Trough list"
                  : "Expands the Trough list"
              }
              style={styles.troughAccordionHeader}
            >
              <View style={styles.troughAccordionTitleRow}>
                <Glyph name="pigface" size={TICKET_GLYPH} />
                <CardTitle>The Trough</CardTitle>
              </View>
              <View style={styles.troughAccordionMeta}>
                <Tag
                  label={
                    troughSummary.activeCount > 0
                      ? `${troughSummary.activeCount} active`
                      : `${troughSummary.claimable.length} ${
                          troughSummary.claimable.length === 1
                            ? "update"
                            : "updates"
                        }`
                  }
                />
                <Icon
                  name="chevronDown"
                  size={TICKET_GLYPH}
                  color={UI_COLORS.textPrimary}
                  style={troughOpen ? styles.troughChevronOpen : undefined}
                />
              </View>
            </Sticker>
            {troughOpen ? (
              <View style={styles.troughAccordionBody}>
                <TroughSection
                  data={troughSummary}
                  onBalance={(balance) => setCounter(balance)}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.barnFurnishings}>
          <SectionHeader
            kicker="decorate your room"
            title="Barn Furnishings"
            right="Furnish your room"
          />
          <T role="body" tone="secondary" style={styles.barnFurnishingsCopy}>
            Shop with Snouts. Complete themed collections to earn bonus
            furnishings at four and eight owned designs.
          </T>
          <HabitatEntry collection />
        </View>
        <View style={styles.viewSwitch}>
          <SegmentedControl
            label="Shop view"
            layout="icon-over-label"
            options={viewOptions}
            value={view}
            onChange={(next) => {
              setView(next);
              setPrestigeOnly(false);
            }}
          />
        </View>

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
          // Daily view fills the available height — no scroll.
          // The bento expands inside this flex container so the
          // 4×4 day-rotated mosaic. Scrolls vertically — the mosaic
          // is taller than the available space on smaller phones.
          <ScrollView
            key="daily"
            style={styles.dailyScroll}
            contentContainerStyle={styles.dailyScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <SectionHeader
              kicker="today's drop"
              title="Today's Drop"
              right={`resets in ${formatCountdownHM(resetsIn)}`}
            />
            <RarityLegend />
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
            ) : (
              <>
                {/* Uniform 2-col grid of all 8 daily items — bento mosaic
									    + featured hero retired per the redesign handoff.
									    Numeric widths (Yoga-quirk discipline). */}
                <View style={shopCardStyles.grid}>
                  {daily.map((item, i) => (
                    <View key={item.id} style={{ width: dailyTileW }}>
                      <ShopCard
                        item={item}
                        index={i}
                        owned={owned.has(item.id)}
                        active={isEquipped(item.id, item.category)}
                        canAfford={counter >= item.cost}
                        onPress={() => setPreviewItem(item)}
                        onCenter={(x, y) =>
                          tileCenters.current.set(item.id, { x, y })
                        }
                      />
                    </View>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        ) : view === "wardrobe" ? (
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
        ) : (
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
        buyable={previewItem ? dailyIds.has(previewItem.id) : true}
        equippedHat={equippedPreviewSlot("active_hat_id")}
        equippedBow={equippedPreviewSlot("active_bow_id")}
        onTroughOpened={(spent, newBalance) =>
          // Seed left the account server-side — reflect it in the
          // header chip NOW, not on the next focus refetch.
          setCounter((c) => newBalance ?? Math.max(0, c - spent))
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
  barnFurnishings: {
    marginHorizontal: PAGE_PAD,
    marginTop: SPACE.sm,
    paddingTop: SPACE.md,
    // A section break under the crown is a hairline in the paper's own warm
    // grey, never the sticker's ink outline (the Divider primitive's rule).
    borderTopWidth: BORDER.hair,
    borderColor: WHIMSY.barkMute,
  },
  barnFurnishingsCopy: {
    marginBottom: SPACE.sm,
  },
  viewSwitch: {
    marginHorizontal: PAGE_PAD,
    marginTop: SPACE.md,
    marginBottom: SPACE.sm,
  },
  troughAccordion: {
    marginHorizontal: PAGE_PAD,
    marginTop: SPACE.sm,
  },
  troughAccordionHeader: {
    minHeight: TROUGH_HEADER_H,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE.md,
  },
  troughAccordionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  troughAccordionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  troughChevronOpen: { transform: [{ rotate: "180deg" }] },
  troughAccordionBody: {
    marginTop: SPACE.sm,
    padding: SPACE.md,
    borderWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    borderRadius: RADII.md,
    backgroundColor: UI_COLORS.surfaceMuted,
  },
  // Today tab — scrolling container holding the 2-col grid.
  dailyScroll: { flex: 1 },
  dailyScrollContent: {
    paddingHorizontal: GRID_PAD,
    paddingTop: SPACE.xs,
    paddingBottom: TAB_SAFE,
  },
  // Measuring container for HatThumb's fill mode — the VIEW takes the
  // insets (views resolve them fine; it's Images that fall back to
  // intrinsic px), the Image inside gets measured numerics.
  thumbFillBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
