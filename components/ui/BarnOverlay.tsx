// Subtle full-screen decoration layered over the Barn. Pure RN Views
// (no image assets) so it stays cheap + tweakable. Two axes:
//
//   alignment  angel  → white cloud puffs + warm tint
//              goblin → gold coin piles + green tint
//              neutral→ nothing
//   effects    blessed→ a warm gold glow wash
//              cursed → a murky green miasma wash
//
// The two axes are independent — you can be a neutral pig who's
// currently blessed. pointerEvents="none" so taps reach the pig.
import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import type { AlignmentLabel } from "@/utils/alignment";
import { WHIMSY } from "@/constants/theme";

interface Props {
	alignment: AlignmentLabel;
	// Active daily-ritual effects — drive the glow / miasma wash.
	blessed?: boolean;
	cursed?: boolean;
}

export function BarnOverlay({ alignment, blessed, cursed }: Props) {
	if (alignment === "neutral" && !blessed && !cursed) return null;

	return (
		<View style={styles.fill} pointerEvents="none">
			{alignment === "angel" && (
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
					testID="barn-overlay-angel"
				>
					<View style={[styles.tint, styles.angelTint]} />
					<Cloud style={{ top: 24, left: -20 }} />
					<Cloud style={{ top: 60, left: 40 }} scale={0.7} />
					<Cloud style={{ top: 18, right: -16 }} />
					<Cloud style={{ top: 64, right: 48 }} scale={0.6} />
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

			{blessed && (
				<View
					style={[styles.tint, styles.blessGlow]}
					testID="barn-overlay-blessed"
				/>
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

function Cloud({ style, scale = 1 }: { style: StyleProp<ViewStyle>; scale?: number }) {
	const s = (n: number) => n * scale;
	return (
		<View style={[styles.cloudWrap, style, { transform: [{ scale }] }]}>
			<View style={[styles.puff, { width: s(54), height: s(54) }]} />
			<View
				style={[
					styles.puff,
					{ width: s(72), height: s(72), marginLeft: s(-22), marginTop: s(10) },
				]}
			/>
			<View
				style={[
					styles.puff,
					{ width: s(48), height: s(48), marginLeft: s(-20), marginTop: s(16) },
				]}
			/>
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
	// cloud puff below are bespoke low-opacity gold/green/white tints tuned to
	// sit over the painted Barn, NOT WHIMSY surface hues — they don't map to a
	// palette token, so they stay as raw rgba on purpose (not token leak).
	angelTint: { backgroundColor: "rgba(249,209,76,0.07)" },
	goblinTint: { backgroundColor: "rgba(123,162,102,0.10)" },
	// Effect washes — stronger than the ambient alignment tints so an
	// active ritual reads as "something is happening to me".
	blessGlow: { backgroundColor: "rgba(249,209,76,0.16)" },
	curseMiasma: { backgroundColor: "rgba(74,104,58,0.18)" },
	cloudWrap: {
		position: "absolute",
		flexDirection: "row",
		alignItems: "flex-start",
		opacity: 0.55,
	},
	puff: {
		borderRadius: 999,
		backgroundColor: "#FFFFFF",
		borderWidth: 2,
		borderColor: "rgba(59,42,30,0.18)",
	},
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
