// Tight inline badge — used anywhere identity shows (leaderboard
// rows, friend list, trade modal). Three sizes for different
// contexts. Color-tinted by alignment side so it reads at a glance.
//
// Backed by utils/alignment for the label derivation so this
// component is just presentation.
//
// Conformance pass [B-04, B-05, B-20] (2026-09-11):
//   · the goblin tint was a raw `#D5E4C9` — a survivor of the 2026-07-12
//     bless/curse tokenization, now `WHIMSY.curseSurface`, the token that
//     records that exact value;
//   · the label speaks in `TYPE.label`, the role spec §1.2 assigns to
//     "chips, tags" — the voice `Chip`/`Tag` already use — instead of a
//     three-step bare Caprasimo ramp;
//   · the badge announces its standing, so `compact` (emblem only) is not
//     silent to VoiceOver.
import React from "react";
import { View, StyleSheet } from "react-native";
import {
	alignmentDisplay,
	alignmentIcon,
	alignmentLabel,
	type AlignmentLabel,
} from "@/utils/alignment";
import { AlignmentEmblem } from "./AlignmentEmblem";
import { BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { T } from "./Text";

type Size = "sm" | "md" | "lg";

// Drawing geometry, not spacing: the emblem is art sized to read at each
// badge scale (a touch larger than the old emoji font sizes so the
// halo/scales/horns still carry the signal at `sm`).
const EMBLEM_SIZE: Record<Size, number> = { sm: 15, md: 18, lg: 22 };
const PAD_X: Record<Size, number> = {
	sm: SPACE.sm,
	md: SPACE.md,
	lg: SPACE.card,
};
const PAD_Y: Record<Size, number> = {
	sm: SPACE.xxs,
	md: SPACE.xs,
	lg: SPACE.sm,
};

interface Props {
	// Pass score and the badge derives the label, OR pass label
	// directly if the server already computed it (avoids drift).
	score?: number;
	label?: AlignmentLabel;
	size?: Size;
	// When compact=true the label text is suppressed — just the
	// emblem inside a tinted circle. For dense rows where space
	// matters more than legibility.
	compact?: boolean;
}

export function AlignmentBadge({
	score,
	label: labelProp,
	size = "sm",
	compact = false,
}: Props) {
	const label: AlignmentLabel =
		labelProp ?? (score !== undefined ? alignmentLabel(score) : "neutral");
	const display = alignmentDisplay(label);

	return (
		<View
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${display} alignment`}
			style={[
				styles.badge,
				{
					backgroundColor: backgroundColor(label),
					// A compact badge is square: the emblem's own padding on both
					// axes, so the capsule closes to a circle.
					paddingHorizontal: compact ? PAD_Y[size] : PAD_X[size],
					paddingVertical: PAD_Y[size],
					gap: compact ? 0 : SPACE.xs,
				},
			]}
		>
			<AlignmentEmblem kind={alignmentIcon(label)} size={EMBLEM_SIZE[size]} />
			{!compact && <T role="label">{display}</T>}
		</View>
	);
}

function backgroundColor(label: AlignmentLabel): string {
	// Soft tints, not saturated — the badge appears next to other
	// content and shouldn't shout. The emblem carries the signal.
	switch (label) {
		case "angel":   return WHIMSY.sun;
		case "goblin":  return WHIMSY.curseSurface;
		case "neutral": return WHIMSY.paper;
	}
}

const styles = StyleSheet.create({
	badge: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		borderWidth: BORDER.hair,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
	},
});
