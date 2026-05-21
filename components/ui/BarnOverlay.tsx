// Phase 3 — subtle full-screen decoration layered over the Barn,
// themed by the viewer's current alignment. Pure RN Views (no image
// assets) so it stays cheap + tweakable.
//
//   angel   → soft white cloud puffs in the top corners, warm tint
//   goblin  → dim gold coin discs piled in the bottom corners, green tint
//   neutral → renders nothing
//
// pointerEvents="none" so it never intercepts taps meant for the pig.
import React from "react";
import { View, StyleSheet } from "react-native";
import type { AlignmentLabel } from "@/utils/alignment";

interface Props {
	alignment: AlignmentLabel;
}

export function BarnOverlay({ alignment }: Props) {
	if (alignment === "neutral") return null;

	if (alignment === "angel") {
		return (
			<View style={styles.fill} pointerEvents="none" testID="barn-overlay-angel">
				<View style={[styles.tint, styles.angelTint]} />
				{/* cloud puffs — clustered circles, top corners */}
				<Cloud style={{ top: 24, left: -20 }} />
				<Cloud style={{ top: 60, left: 40 }} scale={0.7} />
				<Cloud style={{ top: 18, right: -16 }} />
				<Cloud style={{ top: 64, right: 48 }} scale={0.6} />
			</View>
		);
	}

	// goblin
	return (
		<View style={styles.fill} pointerEvents="none" testID="barn-overlay-goblin">
			<View style={[styles.tint, styles.goblinTint]} />
			<CoinPile style={{ bottom: 12, left: -10 }} />
			<CoinPile style={{ bottom: 8, right: -14 }} mirrored />
		</View>
	);
}

function Cloud({
	style,
	scale = 1,
}: {
	style: object;
	scale?: number;
}) {
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
	style: object;
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
	angelTint: { backgroundColor: "rgba(249,209,76,0.07)" },
	goblinTint: { backgroundColor: "rgba(123,162,102,0.10)" },
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
		backgroundColor: "#D9A441",
		borderWidth: 2,
		borderColor: "rgba(59,42,30,0.3)",
	},
});
