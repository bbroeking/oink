// One drawing per find kind — the mark a Snout Deep find wears on a cleared
// tile, in the pouch, on the reveal sticker and on the tally's 26pt disc. The
// painted marks (assets/images/glyphs/dig, registered in Glyph) are the
// finds' own art since 2026-09-13; the truffles keep the receipt's truffle
// glyph, Pass XP the sparkle, and a stone is the one hand-cut shape, an ink
// pebble. Never an emoji. `silhouette` is the same mark ink-tinted at ghost
// opacity: what a half-cleared tile shows of what is under it. The junk
// keepsake wears its variant (boot · horseshoe · cap); with no variant it
// wears the boot.
import { StyleSheet, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import type { DigFindKind, DigJunkVariant } from "@/constants/dig";
import { ART_SIZE, OPACITY, WHIMSY } from "@/constants/theme";
import { Glyph, type GlyphName } from "../ui";

type Mark = { glyph: GlyphName } | { stone: true };

const MARKS: Readonly<Record<Exclude<DigFindKind, "junk"> | "truffles" | "xp", Mark>> = {
  truffle_d: { glyph: "truffle" },
  truffle_l: { glyph: "truffle" },
  truffles: { glyph: "truffle" },
  boom: { glyph: "digBoom" },
  pouch: { glyph: "digPouch" },
  apple: { glyph: "digApple" },
  shimmer: { glyph: "digShimmer" },
  acorn: { glyph: "digAcorn" },
  tea: { glyph: "digTea" },
  scroll: { glyph: "digScroll" },
  relic: { glyph: "digRelic" },
  furnishing: { glyph: "digFurnishing" },
  bow: { glyph: "digBow" },
  charm: { glyph: "digCharm" },
  xp: { glyph: "sparkle" },
  stone: { stone: true },
};

const JUNK_MARKS: Readonly<Record<DigJunkVariant, GlyphName>> = {
  boot: "digBoot",
  horseshoe: "digHorseshoe",
  cap: "digCap",
};

/** The glyph a find kind (and, for junk, its variant) draws; null for a stone. */
export function findMarkGlyph(kind: DigFindKind | "truffles" | "xp", variant?: string): GlyphName | null {
  if (kind === "junk") {
    return JUNK_MARKS[(variant ?? "boot") as DigJunkVariant] ?? JUNK_MARKS.boot;
  }
  const mark = MARKS[kind];
  return "stone" in mark ? null : mark.glyph;
}

export function FindMark({
  kind,
  variant,
  size = ART_SIZE.glyphSm,
  silhouette = false,
}: {
  kind: DigFindKind | "truffles" | "xp";
  /** The junk keepsake's variant (boot · horseshoe · cap). */
  variant?: string;
  size?: number;
  silhouette?: boolean;
}) {
  const ink = WHIMSY.ink;
  const glyph = findMarkGlyph(kind, variant);
  const node = glyph ? (
    <Glyph name={glyph} size={size} style={silhouette ? { tintColor: ink } : undefined} />
  ) : (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Ellipse cx={12} cy={13} rx={9} ry={7} fill={WHIMSY.muteSoft} stroke={ink} strokeWidth={2} />
    </Svg>
  );
  return <View style={silhouette ? styles.silhouette : undefined}>{node}</View>;
}

const styles = StyleSheet.create({
  silhouette: { opacity: OPACITY.ghost },
});
