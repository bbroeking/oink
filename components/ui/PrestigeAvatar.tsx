import React from "react";
import { Image, StyleSheet, View, type ViewStyle } from "react-native";
import { BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { PigAvatar } from "./PigAvatar";
import { staticPigFx, type PigFx } from "@/constants/ritualFx";
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
	ritual,
}: {
	size?: number;
	hatId?: string | null;
	bowId?: string | null;
	prestigeLevel?: number | null;
	showRank?: boolean;
	style?: ViewStyle;
	/** The pig's merged ritual recipe, forwarded straight to `PigAvatar`, which
	 *  keeps only the static channels (weekday rituals, 2026-09-14). The aura
	 *  ring is the Wallow rank and is never a ritual. */
	ritual?: PigFx;
}) {
	const rank = Math.max(0, Math.floor(prestigeLevel ?? 0));
	// A ritual is worn by the PIG. The default `icon` path swaps the pig out for
	// its hat art, and a hat has nowhere to put a bacon stripe — so a portrait
	// with a ritual on it draws the pig WEARING the hat instead. No ritual, no
	// change: the leaderboard's hat-first icon is untouched.
	const mode = staticPigFx(ritual) ? ("worn" as const) : undefined;
	if (rank === 0)
		return (
			<PigAvatar
				size={size}
				hatId={hatId}
				bowId={bowId}
				style={style}
				ritual={ritual}
				mode={mode}
			/>
		);

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
				<PigAvatar
					size={coreSize}
					hatId={hatId}
					bowId={bowId}
					border={WHIMSY.ink}
					ritual={ritual}
					mode={mode}
				/>
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
