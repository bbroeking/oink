// Circular ink-outlined well for a blessing/curse icon — one shared
// treatment for every surface that renders a ritual icon (Barn strip
// chips, ActiveEffects rows, HoofprintsSheet cards, WhileAwayModal
// rows, RitualPicker). Same language the surfaces already spoke
// piecemeal: paper well for blessings, ink well for curses (the Barn
// strip / HoofprintsSheet pattern), circular like the WhileAwayModal
// glyph wells — so the two kinds read apart at a glance before color.
//
// The optional corner badge reuses the Inbox passive-feed marks
// (bless = lilac, curse = paper) for surfaces
// that don't already carry a textual Blessing/Curse marker next to the icon.
import React from "react";
import {
  View,
  Image,
  StyleSheet,
  type ImageSourcePropType,
} from "react-native";
import { BORDER, RADII, WHIMSY } from "@/constants/theme";
import { GameIcon } from "./GameIcon";

interface Props {
  icon?: ImageSourcePropType;
  blessed: boolean;
  // Well diameter in pt; the icon fills ~`fillRatio` of it.
  size?: number;
  // Fraction of the well the art fills (default 0.72). Surfaces that want a
  // bigger, more legible icon (the RitualPicker) can raise it without
  // enlarging the icon on the smaller shared wells (Barn chips, ActiveEffects).
  fillRatio?: number;
  // Corner badge — pass false on surfaces that already label the
  // kind in text (corner pill, section header, kicker).
  badge?: boolean;
}

export function RitualIconWell({
  icon,
  blessed,
  size = 40,
  fillRatio = 0.72,
  badge = true,
}: Props) {
  const iconSize = Math.round(size * fillRatio);
  return (
    <View
      style={[
        styles.well,
        blessed ? styles.wellBless : icon ? styles.wellCurse : styles.wellCurseFallback,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {icon ? (
        <Image
          source={icon}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
      ) : (
        <GameIcon name={blessed ? "bless" : "curse"} size={iconSize} />
      )}
      {badge && icon && (
        <View
          style={[
            styles.badge,
            blessed ? styles.badgeBless : styles.badgeCurse,
          ]}
        >
          <GameIcon name={blessed ? "bless" : "curse"} size={16} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    borderWidth: BORDER.ink,
    borderColor: WHIMSY.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  wellBless: { backgroundColor: WHIMSY.paper },
  wellCurse: { backgroundColor: WHIMSY.ink },
  wellCurseFallback: { backgroundColor: WHIMSY.curseSurface },
  // Tiny corner badge — hangs slightly off the well's bottom-right.
  badge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: RADII.pill,
    borderWidth: BORDER.thin,
    borderColor: WHIMSY.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeBless: { backgroundColor: WHIMSY.lilac },
  badgeCurse: { backgroundColor: WHIMSY.paper },
});
