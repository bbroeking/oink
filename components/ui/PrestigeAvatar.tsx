import React from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { PigAvatar } from "./PigAvatar";
import { T } from "./Text";

const AURAS = {
	1: require("../../assets/images/prestige/wallow_aura_w1.png"),
	2: require("../../assets/images/prestige/wallow_aura_w2.png"),
	3: require("../../assets/images/prestige/wallow_aura_w3.png"),
	4: require("../../assets/images/prestige/wallow_aura_w4.png"),
	5: require("../../assets/images/prestige/wallow_aura_w5.png"),
} as const;

// Drawing geometry. The core pig is inset inside the aura ring; the rank badge
// tucks under it and narrows once the frame drops below a sheet-header size.
const CORE_FRAC = 0.57;
const BADGE_DROP = -2;
const BADGE_MIN_WIDTH = 28;
const BADGE_MIN_WIDTH_SMALL = 22;
const SMALL_FRAME = 46;

export function PrestigeAvatar({
	size = 40,
	hatId,
	bowId,
	prestigeLevel = 0,
	showRank = true,
	style,
}: {
	size?: number;
	hatId?: string | null;
	bowId?: string | null;
	prestigeLevel?: number | null;
	showRank?: boolean;
	style?: ViewStyle;
}) {
	const rank = Math.max(0, Math.floor(prestigeLevel ?? 0));
	if (rank === 0) return <PigAvatar size={size} hatId={hatId} bowId={bowId} style={style} />;

	const visualStage = Math.min(5, rank) as keyof typeof AURAS;
	const coreSize = Math.round(size * CORE_FRAC);
	const small = size < SMALL_FRAME;
	return (
		<View
			style={[styles.root, { width: size, height: size }, style]}
			accessible
			accessibilityRole="image"
			accessibilityLabel={`Wallow Rank ${rank}`}
		>
			<Image
				source={AURAS[visualStage]}
				style={{ position: "absolute", width: size, height: size }}
				resizeMode="contain"
				accessible={false}
			/>
			<View style={styles.core}>
				<PigAvatar size={coreSize} hatId={hatId} bowId={bowId} border={WHIMSY.ink} />
			</View>
			{showRank && (
				<View style={[styles.badge, small && styles.badgeSmall]}>
					<T role="label" align="center">W{rank}</T>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { alignItems: "center", justifyContent: "center", overflow: "visible" },
	core: { alignItems: "center", justifyContent: "center" },
	badge: {
		position: "absolute",
		bottom: BADGE_DROP,
		minWidth: BADGE_MIN_WIDTH,
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.xxs,
		borderRadius: RADII.sm,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		// The Wallow-rank gilt. Was a raw `#D9A45D` — a genuinely new semantic
		// colour introduced by leak rather than by token. [B-05] (2026-09-11)
		backgroundColor: WHIMSY.prestige,
	},
	badgeSmall: {
		minWidth: BADGE_MIN_WIDTH_SMALL,
		paddingHorizontal: SPACE.xxs,
		paddingVertical: SPACE.xxs,
	},
});
