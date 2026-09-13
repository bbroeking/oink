// Horizontal alignment bar — the primary way a player's standing on
// the Greedy ◄──► Giver continuum is shown (UserSheet, Season page).
// A gradient track from moss (greedy) to gold (giver) with a marker
// pinned at the score's position. Score range -100..+100.
//
// For tight rows (leaderboard) use AlignmentBadge instead — the bar
// needs horizontal room to read.
//
// Conformance pass [B-04, B-05] (2026-09-11): the bar is a value-bearing
// widget, so it announces as a `progressbar` carrying the score — it used to
// draw a −100..+100 marker that VoiceOver could not read at all. Its text
// speaks in TYPE roles; the rail's geometry is named drawing constants.
import React from "react";
import { View, StyleSheet } from "react-native";
import {
	alignmentLabel,
	alignmentDisplay,
	type AlignmentLabel,
} from "@/utils/alignment";
import { BORDER, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { T } from "./Text";

interface Props {
	score: number;            // -100..+100
	// Optional override; otherwise derived from score.
	label?: AlignmentLabel;
	// "lg" for the Season page hero, "md" (default) for UserSheet.
	size?: "md" | "lg";
}

// Per the redesign tokens: goblin gold (greedy) on the left half,
// angel lilac-deep (giver) on the right half, hard-split at center.
// Replaces the old moss/cream/halo three-fill gradient.
const GREEDY_COLOR = WHIMSY.goblin;
const GIVER_COLOR = WHIMSY.angel;

// The rail and its marker are drawing geometry (a meter's shape), not spacing
// steps — named here so neither is retyped as a bare number in a style.
const RAIL_HEIGHT = { md: 14, lg: 20 } as const;
const MARKER = {
	md: { width: 12, height: 20, top: -3, marginLeft: -6 },
	lg: { width: 16, height: 28, top: -4, marginLeft: -8 },
} as const;

export function AlignmentBar({ score, label: labelProp, size = "md" }: Props) {
	const clamped = Math.max(-100, Math.min(100, score));
	const label = labelProp ?? alignmentLabel(clamped);
	// 0..1 position of the marker along the track.
	const pct = (clamped + 100) / 200;
	const big = size === "lg";
	const signed = clamped > 0 ? `+${clamped}` : `${clamped}`;
	const standing = `${alignmentDisplay(label)} · ${signed}`;

	return (
		<View
			accessible
			accessibilityRole="progressbar"
			accessibilityLabel="Alignment"
			accessibilityValue={{
				min: -100,
				max: 100,
				now: clamped,
				text: `${alignmentDisplay(label)}, ${signed} of 100 toward Giver`,
			}}
			style={styles.wrap}
		>
			<View style={styles.poleRow}>
				<T role={big ? "kickerPill" : "kickerPillSm"} tone="secondary" style={styles.pole}>
					GREEDY
				</T>
				<T
					role={big ? "numeral" : "cardTitleSm"}
					align="center"
					style={styles.standing}
				>
					{standing}
				</T>
				<T
					role={big ? "kickerPill" : "kickerPillSm"}
					tone="secondary"
					align="right"
					style={styles.pole}
				>
					GIVER
				</T>
			</View>

			<View style={styles.trackOuter}>
				<View style={[styles.track, { height: RAIL_HEIGHT[size] }]}>
					{/* Hard 50/50 split — goblin gold | angel lilac. No
					    middle-tone smear; the design wants the schism to
					    read at a glance. */}
					<View style={[styles.fill, styles.fillGreedy]} />
					<View style={[styles.fill, styles.fillGiver]} />
				</View>
				{/* Marker sits OUTSIDE the track so it can poke above
				    the rail and beyond the rounded ends at score ±100
				    without being clipped by track's overflow:hidden. */}
				<View
					style={[
						styles.marker,
						MARKER[size],
						{ left: `${pct * 100}%` },
					]}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { width: "100%" },
	poleRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		marginBottom: SPACE.xs,
	},
	pole: { flex: 1 },
	standing: { flex: 2 },
	// Marker-bearing parent — relative + visible so the marker can
	// poke above/below the rail and beyond the rounded ends.
	trackOuter: {
		position: "relative",
	},
	track: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		flexDirection: "row",
	},
	fill: { flex: 1, height: "100%" },
	fillGreedy: { backgroundColor: GREEDY_COLOR },
	fillGiver: { backgroundColor: GIVER_COLOR },
	marker: {
		position: "absolute",
		borderRadius: RADII.hair,
		backgroundColor: WHIMSY.paper,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
	},
});
