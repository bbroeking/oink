// Tight inline badge — used anywhere identity shows (leaderboard
// rows, friend list, trade modal). Three sizes for different
// contexts. Color-tinted by alignment side so it reads at a glance.
//
// Backed by utils/alignment for the label derivation so this
// component is just presentation.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
	alignmentDisplay,
	alignmentEmblem,
	alignmentLabel,
	type AlignmentLabel,
} from "@/utils/alignment";
import { FONTS, WHIMSY } from "@/constants/theme";

type Size = "sm" | "md" | "lg";

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
	const bg = backgroundColor(label);
	const dims = sizeProfile(size, compact);

	return (
		<View
			style={[
				styles.badge,
				{
					backgroundColor: bg,
					paddingHorizontal: dims.padX,
					paddingVertical: dims.padY,
					borderRadius: dims.radius,
					gap: compact ? 0 : 4,
				},
			]}
		>
			<Text style={[styles.emblem, { fontSize: dims.emblem }]}>
				{alignmentEmblem(label)}
			</Text>
			{!compact && (
				<Text style={[styles.label, { fontSize: dims.label }]}>
					{alignmentDisplay(label)}
				</Text>
			)}
		</View>
	);
}

function backgroundColor(label: AlignmentLabel): string {
	// Soft tints, not saturated — the badge appears next to other
	// content and shouldn't shout. The emblem carries the signal.
	switch (label) {
		case "angel":   return WHIMSY.sun;
		case "goblin":  return "#D5E4C9"; // moss tint
		case "neutral": return WHIMSY.paper;
	}
}

function sizeProfile(size: Size, compact: boolean) {
	const base = {
		sm: { padX: 8,  padY: 3, radius: 999, emblem: 12, label: 11 },
		md: { padX: 10, padY: 5, radius: 999, emblem: 14, label: 13 },
		lg: { padX: 14, padY: 7, radius: 999, emblem: 18, label: 15 },
	}[size];
	if (compact) {
		// Square aspect for emblem-only mode.
		return { ...base, padX: base.padY };
	}
	return base;
}

const styles = StyleSheet.create({
	badge: {
		flexDirection: "row",
		alignItems: "center",
		alignSelf: "flex-start",
		borderWidth: 1,
		borderColor: WHIMSY.ink,
	},
	emblem: { color: WHIMSY.ink },
	label: {
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
});
