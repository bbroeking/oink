// One drawing per find kind — the mark a Snout Deep find wears on a cleared
// tile, in the pouch, on the reveal sticker and on the receipt's 26pt disc.
// Everything routes through Glyph / Icon (never an emoji); a stone is the one
// hand-cut shape, an ink pebble. `silhouette` is the same mark ink-tinted at
// ghost opacity: what a half-cleared tile shows of what is under it.
import { StyleSheet, View } from "react-native";
import Svg, { Ellipse } from "react-native-svg";
import type { DigFindKind } from "@/constants/dig";
import { ART_SIZE, OPACITY, WHIMSY } from "@/constants/theme";
import { Glyph, Icon, type GlyphName, type IconName } from "../ui";

type Mark = { glyph: GlyphName } | { icon: IconName } | { stone: true };

const MARKS: Readonly<Record<DigFindKind | "truffles" | "xp", Mark>> = {
  truffle_d: { glyph: "truffle" },
  truffle_l: { glyph: "truffle" },
  truffles: { glyph: "truffle" },
  boom: { icon: "tickle" },
  pouch: { glyph: "gift" },
  apple: { glyph: "heart" },
  junk: { icon: "furnishings" },
  shimmer: { glyph: "gem" },
  acorn: { icon: "gear" },
  tea: { glyph: "coffee" },
  scroll: { icon: "scroll" },
  relic: { glyph: "trophy" },
  furnishing: { icon: "furnishings" },
  bow: { glyph: "bow" },
  charm: { glyph: "bless" },
  xp: { glyph: "sparkle" },
  stone: { stone: true },
};

export function FindMark({
  kind,
  size = ART_SIZE.glyphSm,
  silhouette = false,
}: {
  kind: DigFindKind | "truffles" | "xp";
  size?: number;
  silhouette?: boolean;
}) {
  const mark = MARKS[kind];
  const ink = WHIMSY.ink;
  let node;
  if ("stone" in mark) {
    node = (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Ellipse cx={12} cy={13} rx={9} ry={7} fill={WHIMSY.muteSoft} stroke={ink} strokeWidth={2} />
      </Svg>
    );
  } else if ("icon" in mark) {
    node = <Icon name={mark.icon} size={size} color={ink} />;
  } else {
    node = <Glyph name={mark.glyph} size={size} style={silhouette ? { tintColor: ink } : undefined} />;
  }
  return <View style={silhouette ? styles.silhouette : undefined}>{node}</View>;
}

const styles = StyleSheet.create({
  silhouette: { opacity: OPACITY.ghost },
});
