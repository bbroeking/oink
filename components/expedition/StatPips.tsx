import React from "react";
import { View, StyleSheet } from "react-native";
import { SPACE } from "@/constants/theme";
import { Tag, type ChipTone } from "@/components/ui/Chip";
import type { AbilityRecipe, StatKey } from "@/utils/expedition";

// Tiny labelled stat pips — the at-a-glance "what does this do" for a gear row or
// a Trick card. Bonk / Cushion / Sparkle, each a read-only `Tag` capsule in its
// family's tone. Only nonzero stats show. The capsule drawing (outline, radius,
// label role, fill, 44pt-equivalent frame) belongs to the primitive; this file
// only decides which family speaks in which tone.

// Offense is the Zoomies rose, defense the sky, finds the sun.
const FAMILY_TONE: Record<StatKey, ChipTone> = {
	bonk: "roseDeep",
	cushion: "sky",
	sparkle: "sun",
};

type Pips = { bonk: number; cushion: number; sparkle: number };

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
				<Tag
					key={k}
					label={`${FAMILY_LABEL[k]} ${pips[k]}`}
					tone={FAMILY_TONE[k]}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs },
});
