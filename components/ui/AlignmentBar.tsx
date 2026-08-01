// Horizontal alignment bar — the primary way a player's standing on
// the Greedy ◄──► Giver continuum is shown (UserSheet, Season page).
// A gradient track from moss (greedy) to gold (giver) with a marker
// pinned at the score's position. Score range -100..+100.
//
// For tight rows (leaderboard) use AlignmentBadge instead — the bar
// needs horizontal room to read.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
	alignmentLabel,
	alignmentDisplay,
	type AlignmentLabel,
} from "@/utils/alignment";
import { FONTS, WHIMSY } from "@/constants/theme";

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

export function AlignmentBar({ score, label: labelProp, size = "md" }: Props) {
	const clamped = Math.max(-100, Math.min(100, score));
	const label = labelProp ?? alignmentLabel(clamped);
	// 0..1 position of the marker along the track.
	const pct = (clamped + 100) / 200;
	const big = size === "lg";

	return (
		<View style={styles.wrap}>
			<View style={styles.poleRow}>
				<Text style={[styles.pole, big && styles.poleLg]}>GREEDY</Text>
				<Text style={[styles.standing, big && styles.standingLg]}>
					{alignmentDisplay(label)} · {clamped > 0 ? `+${clamped}` : clamped}
				</Text>
				<Text style={[styles.pole, big && styles.poleLg, { textAlign: "right" }]}>
					GIVER
				</Text>
			</View>

			<View style={styles.trackOuter}>
				<View style={[styles.track, big && styles.trackLg]}>
					{/* Hard 50/50 split — goblin gold | angel lilac. No
					    middle-tone smear; the design wants the schism to
					    read at a glance. */}
					<View style={[styles.fill, styles.fillGreedy]} />
					<View style={[styles.fill, styles.fillGiver]} />
				</View>
				{/* Marker sits OUTSIDE the track so it can poke above
				    the rail (top: -3) and beyond the rounded ends at
				    score ±100 without being clipped by track's
				    overflow:hidden. */}
				<View
					style={[
						styles.marker,
						big && styles.markerLg,
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
		marginBottom: 5,
	},
	pole: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		color: WHIMSY.mute,
		flex: 1,
	},
	poleLg: { fontSize: 12 },
	standing: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		flex: 2,
		textAlign: "center",
	},
	standingLg: { fontSize: 16 },
	// Marker-bearing parent — relative + visible so the marker can
	// poke above/below the rail and beyond the rounded ends.
	trackOuter: {
		position: "relative",
	},
	track: {
		height: 14,
		borderRadius: 7,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		flexDirection: "row",
	},
	trackLg: { height: 20, borderRadius: 10 },
	fill: { flex: 1, height: "100%" },
	fillGreedy: { backgroundColor: GREEDY_COLOR },
	fillGiver: { backgroundColor: GIVER_COLOR },
	marker: {
		position: "absolute",
		top: -3,
		width: 12,
		height: 20,
		borderRadius: 4,
		marginLeft: -6,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	markerLg: { top: -4, width: 16, height: 28, marginLeft: -8 },
});
