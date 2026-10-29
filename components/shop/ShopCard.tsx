// The store's card: the 2-col grid's one tile (the shop redesign, Claude Design
// handoff "Shop Layout.html"), moved out of app/(tabs)/shop.tsx on 2026-10-29
// so the Pop-up Stall's page draws the very same card. One grammar for every
// card in the store: rarity dot, owned check or members' ribbon, the art on a
// rarity-tinted panel, the name, and the action's face (utils/shopShelves).
import { useRef } from "react";
import { View, StyleSheet } from "react-native";
import { cosmeticAccessibility } from "@/utils/cosmetics";
import { Icon, Ribbon, Sticker, T, Tag } from "@/components/ui";
import { HatThumb } from "@/components/shop/HatThumb";
import type { HatRow } from "@/constants/hats";
import { cardTag, cardTagFace } from "@/utils/shopShelves";
import {
  UI_COLORS,
  BORDER,
  CHROME_TYPE_CAP,
  WHIMSY,
  SPACE,
  RADII,
  SHADOW_SM,
  RARITY_BG_SOLID,
  RARITY_STRIPE,
} from "@/constants/theme";

// ── Drawing constants ───────────────────────────────────────────────────────
// Geometry, not spacing: the sizes of the marks and thumbnails the card
// draws. Named here so no style block carries a bare number. (2026-09-11)
/** The rarity dot on a card corner, and the smaller one in the legend. */
const RARITY_DOT = 14;
const LEGEND_DOT = 12;
/** The round owned-check badge in the card's other corner. */
const OWNED_BADGE = 26;
/** Marks riding inside those badges / chips. */
const CHECK_MARK = 14;
/** The card thumbnail's letterbox: a touch wider than it is tall. */
const THUMB_RATIO = 1.18;
/** The alternating scrapbook lean across the two grid columns. */
const CARD_TILT = 0.5;
/**
 * The card's inner corner, inside its RADII.xl outline and 2pt ink border: the
 * next step down the radius scale (the true 16pt inner curve is within 0.6pt
 * of it at the corner). The thumb's top corners and the MEMBERS ribbon's clip
 * both round to it, so the card itself never clips — an `overflow: hidden`
 * card loses its hard shadow on iOS.
 */
const CARD_INNER_RADIUS = RADII.lg;
/** The 2-column grid's own page inset and card-to-card gap. */
export const GRID_PAD = SPACE.md;
export const GRID_GAP = SPACE.md;
/**
 * The fallback card's name lines: every closet name fits two at 1.0x in the
 * 2-up card (measured, 375pt phone), three at CHROME_TYPE_CAP.
 */
const CARD_NAME_LINES = 3;

const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;

// ── Shop redesign (Claude Design handoff, Shop Layout.html) ─────────
// Less text, more readable: rarity is a COLOR DOT + one legend (no word
// pills), the image is the hero on a rarity-tinted panel, and the price
// chip carries the buy-state (sun = affordable, muted = not yet,
// "Owned" tag = owned). No per-card buttons — tapping opens the
// preview/buy sheet. Uniform 2-col grid replaces the bento mosaic.
export function RarityLegend() {
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

export function ShopCard({
  item,
  owned,
  active,
  canAfford,
  inDrop,
  index,
  locked,
  membersOnly,
  onPress,
  onLongPress,
  onCenter,
}: {
  item: HatRow;
  owned: boolean;
  active: boolean;
  canAfford: boolean;
  // On today's shelf — the only day it can be bought (the price goes muted
  // otherwise, one grammar with the coaster).
  inDrop: boolean;
  // Position in the grid — drives the alternating ±0.5° sticker tilt.
  index: number;
  // Members-only item + caller isn't a Slop Club member → the ribbon says so
  // in words (it's still a gate, not just identity).
  locked?: boolean;
  // Members-only item, regardless of VIP status. Drives the MEMBERS ribbon —
  // which stays for members too (it's Slop Club identity, not a lock).
  membersOnly?: boolean;
  // An owned card wears / takes off on tap (cardTapAction); an unowned one
  // opens the sheet. Long press opens the sheet for an owned card.
  onPress: () => void;
  onLongPress?: () => void;
  // Reports the card's window-space center (the buy celebration anchor).
  onCenter?: (x: number, y: number) => void;
}) {
  const rarity = item.rarity ?? "common";
  const ref = useRef<View>(null);
  // The grid is the game's storefront: every card states its rarity, its
  // ownership, its cost and what a tap will do. [D-03] (2026-09-11)
  const a11y = cosmeticAccessibility(
    { name: item.name, rarity, cost: item.cost },
    {
      owned,
      active,
      locked,
      canAfford,
      buyable: inDrop,
      action: owned ? "equip" : "preview",
    },
  );
  // One grammar for every card in the store (utils/shopShelves cardTag).
  const face = cardTagFace(
    cardTag(item, { owned, active, inDrop, canAfford, locked: !!locked }),
  );
  return (
    <View
      ref={ref}
      style={shopCardStyles.cardWrap}
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
        onLongPress={onLongPress}
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
              clipRadius={CARD_INNER_RADIUS}
            />
          ) : null}
          <HatThumb item={item} fill />
        </View>
        <View style={shopCardStyles.foot}>
          {/* A name never ends in "…": two lines hold every catalog name
              at default size in this 2-up card, three at the chrome
              ceiling, and the row's cards stretch to one height. */}
          <T
            role="cardTitleSm"
            numberOfLines={CARD_NAME_LINES}
            maxFontSizeMultiplier={CHROME_TYPE_CAP}
          >
            {item.name}
          </T>
          {/* The tag is the action's face: "Wear" / "Wearing" for an owned
              item, otherwise the price — sun when you can pay it today, the
              muted (locked) fill when you cannot, never an opacity crush.
              [D-12] (2026-09-11) */}
          <Tag
            tone={face.tone}
            icon={face.icon}
            coin={face.coin}
            label={face.label}
            maxFontSizeMultiplier={CHROME_TYPE_CAP}
            style={shopCardStyles.footTag}
          />
        </View>
      </Sticker>
    </View>
  );
}

export const shopCardStyles = StyleSheet.create({
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
  // The card fills its grid cell, which a wrapping row stretches to the
  // line's tallest card, so a two-line name never lifts its neighbour's tag.
  // It does not clip: the thumb rounds its own top corners and the ribbon
  // clips itself (Ribbon clipRadius), so the card keeps its sticker shadow.
  cardWrap: { flex: 1 },
  card: {
    flex: 1,
  },
  // aspectRatio is safe on VIEWS — HatThumb measures inside, so the
  // image itself still gets explicit numerics (the Yoga-quirk cure). The
  // thumb clips a full-bleed scene to the card's inner corner.
  thumb: {
    aspectRatio: THUMB_RATIO,
    borderBottomWidth: BORDER.ink,
    borderColor: UI_COLORS.border,
    borderTopLeftRadius: CARD_INNER_RADIUS,
    borderTopRightRadius: CARD_INNER_RADIUS,
    overflow: "hidden",
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
  foot: {
    flexGrow: 1,
    justifyContent: "space-between",
    padding: SPACE.md,
    gap: SPACE.sm,
  },
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

/** The 2-col grid's tile width: numeric, never a %-size (the Yoga-quirk
 *  discipline). `pad` each side (GRID_PAD unless the page insets its own), GRID_GAP
 *  between. */
export function gridTileWidth(screenW: number, pad: number = GRID_PAD): number {
  return Math.floor((screenW - pad * 2 - GRID_GAP) / 2);
}
