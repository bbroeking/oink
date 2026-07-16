// The feeding-window strip — the 8h dig rhythm made visible. The single biggest
// dig-confusion fix: the patch's open/guarded cadence used to live only in prose.
//
// The strip is one 8h feeding window: an OPEN half (first 4h — dig while he
// gorges) and a GUARDED half (next 4h — he digests, the patch is shut). A "now"
// marker rides the true position, and the line beneath states which phase we're
// in + the countdown it already computes.
//
// SAME SOURCE OF TRUTH as the dig CTA: the split (PATCH_OPEN_SECS /
// ROOTING_WINDOW_SECS) and phase math come from constants/dig.ts + utils/rooting
// — the same functions useFeedingCta reads. And when the caller passes its
// shared FeedingCta (the season tab does), the caption reads the CTA's OWN
// phase + countdown strings, so the two can't even tick a minute apart.
// Renders for crewed AND crewless players: the crewless see the rhythm too,
// because the rhythm is what sells the loop.

import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import {
	patchPhaseOpen,
	phaseClosesCountdown,
	nextOpenCountdown,
} from "@/utils/rooting";
import { feedingSchedule, type FeedingSchedule } from "@/utils/feedingConfig";
import type { FeedingCta } from "../mudwar/useFeedingCta";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

// The "now" marker's position across the whole window, 0..1. Reads the live
// server-driven schedule (utils/feedingConfig — same math as utils/rooting's
// windowIndex), so the pin can't drift off the true boundary, even across a
// remote schedule shift.
function nowFrac(
	nowMs: number = Date.now(),
	sched: FeedingSchedule = feedingSchedule()
): number {
	const intoWindow = (nowMs / 1000 - sched.offsetSecs) % sched.windowSecs;
	return Math.max(0, Math.min(1, intoWindow / sched.windowSecs));
}

export function WindowStrip({
	cta,
}: {
	/**
	 * When provided (the season tab passes its ONE shared feeding CTA), the
	 * caption's phase + countdown read from cta.phaseOpen / cta.countdown, so the
	 * strip and every dig button share one clock and can never disagree by a
	 * ticked minute. Omitted (any other call site) → the standalone computation.
	 */
	cta?: FeedingCta;
}) {
	// Re-derive on a slow tick so the marker + phase line stay live without a
	// per-frame cost (matches useFeedingCta's 15s clock cadence).
	const [tick, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((n) => n + 1), 15000);
		return () => clearInterval(t);
	}, []);

	const open = cta ? cta.phaseOpen : patchPhaseOpen();
	// The open half's share of the window — derived per render from the live
	// schedule so the bar's split follows a remote geometry change too.
	const openFrac = feedingSchedule().openSecs / feedingSchedule().windowSecs;
	// The now-marker keeps its own window math (bar geometry is position, not
	// countdown) — only the caption line shares the CTA's clock.
	const marker = nowFrac();
	const countdown = cta
		? cta.countdown
		: open
			? phaseClosesCountdown()
			: nextOpenCountdown();
	const line = open
		? `the patch is open — closes in ${countdown}`
		: `he's guarding — opens in ${countdown}`;

	return (
		<View style={styles.wrap}>
			<View style={styles.kickerRow}>
				<Text style={styles.kicker}>the feeding rhythm</Text>
				<Text style={styles.eightHour}>every 8h</Text>
			</View>

			<View style={styles.timelineRow}>
				{/* The two phase segments — open (sun) then guarded (dim, hatched
				    by a dashed inner rule). Their widths are the true 4h/4h split. */}
				<View style={styles.bar}>
					<View
						style={[
							styles.segOpen,
							{ flex: openFrac },
							!open && styles.segIdle,
						]}
					>
						<Text style={styles.segLabel}>open</Text>
					</View>
					<View
						style={[
							styles.segGuarded,
							{ flex: 1 - openFrac },
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
