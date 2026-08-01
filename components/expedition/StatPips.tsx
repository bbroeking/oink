import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RADII, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import type { AbilityRecipe, StatKey } from "@/utils/expedition";

// Tiny labeled stat pips — the at-a-glance "what does this do" for a gear chip or
// a Trick card. Bonk / Cushion / Sparkle, each a small ink-outlined chip tinted
// by its family. Only nonzero stats show. Uses the shared TYPE.kickerPillSm role
// and WHIMSY tints (no raw hex, no raw fontSize).

type Pips = { bonk: number; cushion: number; sparkle: number };

const FAMILY_TINT: Record<StatKey, string> = {
	bonk: WHIMSY.roseDeep, // offense — the Zoomies rose
	cushion: WHIMSY.sky, // defense
	sparkle: WHIMSY.sun, // finds
};

const FAMILY_LABEL: Record<StatKey, string> = {
	bonk: "Bonk",
	cushion: "Cushion",
	sparkle: "Sparkle",
};

// Which stat family a card's ability speaks to — so a Trick reads in the same
// Bonk/Cushion/Sparkle language as gear.
const EFFECT_FAMILY: Record<string, StatKey> = {
	bonus_bonk: "bonk",
	double_first_swing: "bonk",
	zoomies_charge_up: "bonk",
	block_hits: "cushion",
	cushion_up: "cushion",
	extra_find: "sparkle",
	find_quality_up: "sparkle",
	speed_up: "sparkle",
};

export function abilityPips(recipe: AbilityRecipe): Pips {
	const pips: Pips = { bonk: 0, cushion: 0, sparkle: 0 };
	const family = EFFECT_FAMILY[recipe.effect];
	if (family) pips[family] += recipe.magnitude;
	return pips;
}

export function StatPips({ pips }: { pips: Pips }) {
	const order: StatKey[] = ["bonk", "cushion", "sparkle"];
	const shown = order.filter((k) => pips[k] > 0);
	if (shown.length === 0) return null;
	return (
		<View style={styles.row}>
			{shown.map((k) => (
				<View key={k} style={[styles.pip, { backgroundColor: FAMILY_TINT[k] }]}>
					<Text style={styles.pipText}>
						{FAMILY_LABEL[k]} {pips[k]}
					</Text>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
	pip: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: SPACE.xs,
		paddingVertical: 2,
		borderRadius: RADII.sm,
		borderWidth: 1.5,
		borderColor: UI_COLORS.border,
	},
	pipText: { ...TYPE.kickerPillSm, color: UI_COLORS.textPrimary },
});
