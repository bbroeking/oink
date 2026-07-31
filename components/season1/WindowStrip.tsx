// The feeding-window strip — the dig rhythm made visible. The single biggest
// dig-confusion fix: the patch's open/guarded cadence used to live only in prose.
//
// The strip is the CURRENT local-time window: an OPEN span (dig while he gorges)
// then a GUARDED span (he digests, the patch is shut). Windows are non-uniform
// (see constants/dig.ts), so the fill reflects THIS window's own open/gorge
// split. A "now" marker rides the true position, and the line beneath states
// which phase we're in + the countdown it already computes.
//
// SAME SOURCE OF TRUTH as the dig CTA: patchWindowShape + the phase math come
// from utils/rooting — the same functions useFeedingCta reads — so the strip can
// never drift from the button. Renders for crewed AND crewless players: the
// crewless see the rhythm too, because the rhythm is what sells the loop.

import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
	patchWindowShape,
	phaseClosesCountdown,
	nextOpenCountdown,
} from "@/utils/rooting";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

export function WindowStrip() {
	// Re-derive on a slow tick so the marker + phase line stay live without a
	// per-frame cost (matches useFeedingCta's 15s clock cadence).
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((n) => n + 1), 15000);
		return () => clearInterval(t);
	}, []);

	// The current bucket's open/gorge split + "now" marker (non-uniform windows,
	// so the fill reflects THIS window's own length — not a fixed 4h/8h).
	const { open, openFrac: OPEN_FRAC, marker } = patchWindowShape();
	const countdown = open ? phaseClosesCountdown() : nextOpenCountdown();
	const line = open
		? `the patch is open — closes in ${countdown}`
		: `he's guarding — opens in ${countdown}`;

	return (
		<View style={styles.wrap}>
			<View style={styles.kickerRow}>
				<Text style={styles.kicker}>the feeding rhythm</Text>
				<Text style={styles.eightHour}>your local hours</Text>
			</View>

			<View style={styles.timelineRow}>
				{/* The two phase segments — open (sun) then guarded (dim, hatched
				    by a dashed inner rule). Their widths are the true 4h/4h split. */}
				<View style={styles.bar}>
					<View
						style={[
							styles.segOpen,
							{ flex: OPEN_FRAC },
							!open && styles.segIdle,
						]}
					>
						<Text style={styles.segLabel}>open</Text>
					</View>
					<View
						style={[
							styles.segGuarded,
							{ flex: 1 - OPEN_FRAC },
							open && styles.segIdle,
						]}
					>
						<Text style={[styles.segLabel, styles.segLabelGuarded]}>
							guarded
						</Text>
					</View>

					{/* The "now" marker — a small ink pin at the true window position. */}
					<View
						style={[styles.nowPin, { left: `${marker * 100}%` }]}
						pointerEvents="none"
					>
						<View style={styles.nowDot} />
						<View style={styles.nowStem} />
					</View>
				</View>
			</View>

			<Text style={styles.phaseLine}>{line}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.xs, marginBottom: SPACE.sm },
	kickerRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
	},
	kicker: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textTransform: "uppercase",
		letterSpacing: 0.8,
	},
	eightHour: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
	timelineRow: { paddingTop: 6 },
	bar: {
		flexDirection: "row",
		height: 22,
		borderRadius: RADII.sm,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		backgroundColor: WHIMSY.cream2,
	},
	segOpen: {
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		borderRightWidth: 1.5,
		borderRightColor: WHIMSY.ink,
	},
	segGuarded: {
		backgroundColor: WHIMSY.cream2,
		alignItems: "center",
		justifyContent: "center",
		borderStyle: "dashed",
		borderLeftWidth: 1.5,
		borderLeftColor: WHIMSY.muteSoft,
	},
	// Dim the half we're NOT in, so "you are here" reads at a glance.
	segIdle: { opacity: 0.5 },
	// Bumped off the 9px legibility floor to the tracked-pill kicker role (10) —
	// still fits the 22px bar; 9px uppercase read as squint-small.
	segLabel: {
		...TYPE.kickerPill,
		fontSize: 10,
		letterSpacing: 0.8,
		color: WHIMSY.ink,
	},
	segLabelGuarded: { color: WHIMSY.mute },
	// The "now" pin — an ink dot on a short stem, positioned by left %.
	nowPin: {
		position: "absolute",
		top: -4,
		width: 0,
		alignItems: "center",
	},
	nowDot: {
		width: 10,
		height: 10,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	nowStem: {
		width: 2,
		height: 22,
		backgroundColor: WHIMSY.ink,
	},
	phaseLine: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 2,
	},
});
