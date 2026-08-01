// Circular ink-outlined well for a blessing/curse icon — one shared
// treatment for every surface that renders a ritual icon (Barn strip
// chips, ActiveEffects rows, HoofprintsSheet cards, WhileAwayModal
// rows, RitualPicker). Same language the surfaces already spoke
// piecemeal: paper well for blessings, ink well for curses (the Barn
// strip / HoofprintsSheet pattern), circular like the WhileAwayModal
// glyph wells — so the two kinds read apart at a glance before color.
//
// The optional ✦/☁ corner badge reuses the Inbox passive-feed glyphs
// (lilac ✦ = blessed, ☁ = cursed) for surfaces that don't already
// carry a textual Blessing/Curse marker next to the icon.
import React from "react";
import {
	View,
	Text,
	Image,
	StyleSheet,
	type ImageSourcePropType,
} from "react-native";
import { FONTS, WHIMSY } from "@/constants/theme";

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
				blessed ? styles.wellBless : styles.wellCurse,
				{ width: size, height: size, borderRadius: size / 2 },
			]}
		>
			{icon && (
				<Image
					source={icon}
					style={{ width: iconSize, height: iconSize }}
					resizeMode="contain"
				/>
			)}
			{badge && (
				<View
					style={[
						styles.badge,
						blessed ? styles.badgeBless : styles.badgeCurse,
					]}
				>
					<Text style={styles.badgeGlyph}>{blessed ? "✦" : "☁"}</Text>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	well: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	wellBless: { backgroundColor: WHIMSY.paper },
	wellCurse: { backgroundColor: WHIMSY.ink },
	// Tiny corner badge — hangs slightly off the well's bottom-right.
	badge: {
		position: "absolute",
		right: -4,
		bottom: -4,
		width: 16,
		height: 16,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	badgeBless: { backgroundColor: WHIMSY.lilac },
	badgeCurse: { backgroundColor: WHIMSY.paper },
	badgeGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.ink,
		lineHeight: 11,
	},
});
