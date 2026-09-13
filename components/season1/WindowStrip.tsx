// The feeding-window strip — the commuter dig rhythm made visible. The single biggest
// dig-confusion fix: the patch's open/guarded cadence used to live only in prose.
//
// The strip is the current commuter window: an OPEN head (dig while he
// gorges) and a GUARDED tail (he digests, the patch is shut). A "now"
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
import { View, StyleSheet } from "react-native";
import {
	phaseClosesCountdown,
	nextOpenCountdown,
	patchCtaLabel,
	patchWindowShape,
} from "@/utils/rooting";
import type { FeedingCta } from "../mudwar/useFeedingCta";
import { Kicker, T } from "../ui";
import {
	BORDER,
	OPACITY,
	RADII,
	SPACE,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// The strip's own drawing geometry — the height of the phase bar and the
// diameter of the "now" pin's head. Neither is a spacing decision (they are the
// drawing of a gauge and the dot riding it), so they are named here rather than
// borrowed from SPACE. (2026-09-11)
const BAR_HEIGHT = 22;
const PIN_DOT = 10;

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
	const [, setTick] = useState(0);
	useEffect(() => {
		const t = setInterval(() => setTick((n) => n + 1), 15000);
		return () => clearInterval(t);
	}, []);

	const shape = patchWindowShape();
	const open = cta ? cta.phaseOpen : shape.open;
	const openFrac = shape.openFrac;
	// The now-marker keeps its own window math (bar geometry is position, not
	// countdown) — only the caption line shares the CTA's clock.
	const marker = shape.marker;
	const countdown = cta
		? cta.countdown
		: open
			? phaseClosesCountdown()
			: nextOpenCountdown();
	const line = open
		? `${patchCtaLabel(true, countdown)} — closes in ${countdown}`
		: patchCtaLabel(false, countdown);

	return (
		<View style={styles.wrap}>
			<View style={styles.kickerRow}>
				<Kicker star={false} style={styles.kicker}>
					the feeding rhythm
				</Kicker>
				<T role="kicker" tone="secondary">
					4 times daily
				</T>
			</View>

			<View style={styles.timelineRow}>
				{/* The two phase segments — open (sun) then guarded (dim, hatched
				    by a dashed inner rule). Widths match the current bucket. */}
				<View style={styles.bar}>
					<View
						style={[
							styles.segOpen,
							{ flex: openFrac },
							!open && styles.segIdle,
						]}
					>
						<T role="kickerPill" style={styles.segLabel}>
							open
						</T>
					</View>
					<View
						style={[
							styles.segGuarded,
							{ flex: 1 - openFrac },
							open && styles.segIdle,
						]}
					>
						<T
							role="kickerPill"
							tone="secondary"
							style={styles.segLabel}
						>
							guarded
						</T>
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

			<T role="kicker" tone="secondary" align="center" style={styles.phaseLine}>
				{line}
			</T>
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
	// The hand kicker, set in caps — the rhythm reads as a label on the gauge.
	// Tracking comes from TYPE.kicker; the old 0.8 was a hand-tuned literal.
	kicker: { textTransform: "uppercase" },
	timelineRow: { paddingTop: SPACE.sm },
	bar: {
		flexDirection: "row",
		height: BAR_HEIGHT,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
		backgroundColor: WHIMSY.cream2,
	},
	segOpen: {
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		borderRightWidth: BORDER.thin,
		borderRightColor: UI_COLORS.border,
	},
	segGuarded: {
		backgroundColor: WHIMSY.cream2,
		alignItems: "center",
		justifyContent: "center",
		borderStyle: "dashed",
		borderLeftWidth: BORDER.thin,
		borderLeftColor: UI_COLORS.uiMuted,
	},
	// Dim the half we're NOT in, so "you are here" reads at a glance. This is
	// emphasis, not a disabled control — `OPACITY.dim` names the step. [C-07]
	segIdle: { opacity: OPACITY.dim },
	// The tracked-pill kicker role, straight — it clears the squint-small floor
	// and still fits inside the bar.
	segLabel: TYPE.kickerPill,
	// The "now" pin — an ink dot on a short stem, positioned by left %.
	nowPin: {
		position: "absolute",
		top: -SPACE.xs,
		width: 0,
		alignItems: "center",
	},
	nowDot: {
		width: PIN_DOT,
		height: PIN_DOT,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	nowStem: {
		width: BORDER.ink,
		height: BAR_HEIGHT,
		backgroundColor: UI_COLORS.border,
	},
	phaseLine: { marginTop: SPACE.xxs },
});
