// The one meter — an ink-outlined paper capsule with a pastel fill, canvas
// section 09. Replaces the bars hand-rolled in GreatHungerMeter, ZoomiesMeter,
// the season pass track and the habitat panel [D-13].
//
// Two things the hand-rolled bars kept getting wrong, both baked in here:
//  1. **Screen readers.** A bar is a `progressbar` with an `accessibilityValue`,
//     not a decorative View. A meter nobody can hear is a meter nobody can read.
//  2. **The ink edge.** The fill carries its own 2px right border, so the filled
//     portion reads as a drawn-on strip of paper rather than a gradient smear.
//     That edge IS the sticker language; a borderless fill is the slop.
//
// Out-of-range input is clamped rather than trusted — a server that says 7/5 is
// a full bar, not a bar that overflows its own outline.
import React from "react";
import { View, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import {
	BORDER,
	OPACITY,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Hand, Label } from "./Text";

type TrackTone = "sage" | "sun" | "rose" | "lilac" | "sky";
type TrackHeight = "sm" | "md";

const TONE_FILL: Record<TrackTone, string> = {
	sage: WHIMSY.sage,
	sun: WHIMSY.sun,
	rose: WHIMSY.rose,
	lilac: WHIMSY.lilac,
	sky: WHIMSY.sky,
};

const HEIGHT = { sm: SPACE.md, md: SPACE.lg } as const;

interface Props {
	/** Progress so far. Clamped into [0, max]. */
	value: number;
	/** The target. A non-positive max renders an empty track. */
	max: number;
	tone?: TrackTone;
	height?: TrackHeight;
	/** Optional visible caption row above the track (label left, count right). */
	label?: string;
	/** Spoken name when there is no visible caption (the XP meter). */
	accessibilityLabel?: string;
	/**
	 * Whether the bar announces "n of max". A feeling-meter (Zoomies, the
	 * Hunger) is worded, never numbered — pass false and give the wrapper the
	 * worded label instead. (2026-09-11)
	 */
	announceValue?: boolean;
	/**
	 * Tick marks dividing the track into this many equal parts — the Trough's
	 * notched track (Storefront 2026-09-16): four quarters, three ticks, each
	 * lit in sun once the fill has passed it. Ticks are decoration; the value
	 * is still announced as "n of max". Omit for a plain capsule.
	 */
	notches?: number;
	/** Container style override. */
	style?: StyleProp<ViewStyle>;
}

export function ProgressTrack({
	value,
	max,
	tone = "sage",
	height = "md",
	label,
	accessibilityLabel,
	announceValue = true,
	notches,
	style,
}: Props) {
	const safeMax = Math.max(max, 0);
	const now = Math.min(Math.max(value, 0), safeMax);
	const fraction = safeMax > 0 ? now / safeMax : 0;
	const ticks =
		notches && notches > 1
			? Array.from({ length: notches - 1 }, (_, i) => (i + 1) / notches)
			: [];

	return (
		<View style={style}>
			{label ? (
				<View style={styles.captionRow}>
					<Hand>{label}</Hand>
					<Label tone="secondary">{`${now}/${safeMax}`}</Label>
				</View>
			) : null}
			<View
				style={[styles.track, { height: HEIGHT[height] }]}
				accessibilityRole="progressbar"
				accessibilityLabel={accessibilityLabel ?? label}
				accessibilityValue={
					announceValue ? { min: 0, max: safeMax, now } : undefined
				}
			>
				{fraction > 0 ? (
					<View
						style={[
							styles.fill,
							{
								width: `${fraction * 100}%`,
								backgroundColor: TONE_FILL[tone],
							},
						]}
					/>
				) : null}
				{ticks.map((at) => {
					const lit = fraction >= at;
					return (
						<View
							key={at}
							pointerEvents="none"
							style={[
								styles.tick,
								{ left: `${at * 100}%` },
								lit ? styles.tickLit : null,
							]}
						/>
					);
				})}
			</View>
		</View>
	);
}

/** A lit tick is a hair wider than a resting one, so it reads as a peg. */
const TICK_W = BORDER.ink;
const TICK_LIT_W = SPACE.xs;

const styles = StyleSheet.create({
	captionRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	track: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
		overflow: "hidden",
	},
	fill: {
		height: "100%",
		borderRightWidth: BORDER.ink,
		borderRightColor: UI_COLORS.border,
	},
	// A resting notch is an ink hairline at the rule opacity; a passed one is
	// a sun peg with its own ink edge, the way the board draws it.
	tick: {
		position: "absolute",
		top: 0,
		bottom: 0,
		width: TICK_W,
		marginLeft: -TICK_W / 2,
		backgroundColor: UI_COLORS.border,
		opacity: OPACITY.rule,
	},
	tickLit: {
		width: TICK_LIT_W,
		marginLeft: -TICK_LIT_W / 2,
		backgroundColor: WHIMSY.sun,
		opacity: 1,
		borderLeftWidth: BORDER.hair,
		borderRightWidth: BORDER.hair,
		borderColor: UI_COLORS.border,
	},
});
