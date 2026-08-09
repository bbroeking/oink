// Subtle full-screen decoration layered over the Barn. Pure RN Views
// (no image assets) so it stays cheap + tweakable. Two axes:
//
//   alignment  angel  → warm tint
//              goblin → gold coin piles + green tint
//              neutral→ nothing
//   effects    cursed → a murky green miasma wash
//
// The two axes are independent — you can be a neutral pig who's
// currently cursed. Blessings stay visible in the effect strip without
// recoloring the whole page. pointerEvents="none" so taps reach the pig.
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import type { AlignmentLabel } from "@/utils/alignment";
import { WHIMSY } from "@/constants/theme";

interface Props {
	alignment: AlignmentLabel;
	// Active curse effects drive the miasma wash.
	cursed?: boolean;
}

export function BarnOverlay({ alignment, cursed }: Props) {
	if (alignment === "neutral" && !cursed) return null;

	return (
		<View style={styles.fill} pointerEvents="none">
			{alignment === "angel" && (
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
					testID="barn-overlay-angel"
				>
					<View style={[styles.tint, styles.angelTint]} />
				</View>
			)}

			{alignment === "goblin" && (
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
					testID="barn-overlay-goblin"
				>
					<View style={[styles.tint, styles.goblinTint]} />
					<CoinPile style={{ bottom: 12, left: -10 }} />
					<CoinPile style={{ bottom: 8, right: -14 }} mirrored />
				</View>
			)}

			{cursed && (
				<View
					style={[styles.tint, styles.curseMiasma]}
					testID="barn-overlay-cursed"
				/>
			)}
		</View>
	);
}

function CoinPile({
	style,
	mirrored = false,
}: {
	style: StyleProp<ViewStyle>;
	mirrored?: boolean;
}) {
	return (
		<View
			style={[
				styles.coinWrap,
				style,
				mirrored && { transform: [{ scaleX: -1 }] },
			]}
		>
			<View style={[styles.coin, { bottom: 0, left: 0 }]} />
			<View style={[styles.coin, { bottom: 0, left: 26 }]} />
			<View style={[styles.coin, { bottom: 0, left: 52 }]} />
			<View style={[styles.coin, { bottom: 18, left: 13 }]} />
			<View style={[styles.coin, { bottom: 18, left: 39 }]} />
			<View style={[styles.coin, { bottom: 36, left: 26 }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
	tint: { ...StyleSheet.absoluteFillObject },
	// Sanctioned scene-wash exception: these alignment/effect washes and the
	// overlays below are bespoke low-opacity gold/green tints tuned to
	// sit over the painted Barn, NOT WHIMSY surface hues — they don't map to a
	// palette token, so they stay as raw rgba on purpose (not token leak).
	angelTint: { backgroundColor: "rgba(249,209,76,0.07)" },
	goblinTint: { backgroundColor: "rgba(123,162,102,0.10)" },
	// Curse wash — stronger than the ambient alignment tints so an active
	// curse reads as "something is happening to me".
	curseMiasma: { backgroundColor: "rgba(74,104,58,0.18)" },
	coinWrap: { position: "absolute", width: 90, height: 60, opacity: 0.4 },
	coin: {
		position: "absolute",
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: WHIMSY.goblin,
		borderWidth: 2,
		borderColor: "rgba(59,42,30,0.3)",
	},
});
