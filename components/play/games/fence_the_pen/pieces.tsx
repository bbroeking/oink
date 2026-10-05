// Fence the Pen's board pieces: a rail (drawn, or the ghost of one on its way
// to the server), the dashed preview rail, a closed pen's truffle patch, its
// owner's stamp, and the "draw again" tape. Each plays its entrance ONCE, on
// mount, from the beat the board hands it (layout.ts timelineOf); mounted
// without a beat it is simply there, which is how a board that mounts
// mid-game, or a revision that arrived without its cues, still draws right.
// Under Reduce Motion every entrance is a cross-fade in place: no travel, no
// bounce.

import { memo, useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { BORDER, CHROME_TYPE_CAP, MOTION, MOTION_SPRING, OPACITY, RADII, SEAT_TINTS, SHADOW_SM, SPACE, TILT, UI_COLORS, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy, type MotionPolicy } from "@/hooks/useMotionPolicy";
import { squashAndSpring } from "@/utils/motionRecipes";
import { PigAvatar, T } from "@/components/ui";
import type { PigLook } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import type { EdgeAt } from "@/multiplayer/games/fence_the_pen/geometry";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { FENCE_ART } from "../../playArt";
import { alongEdge, type Point, type Rect, type YardLayout } from "./layout";

// --- ART -------------------------------------------------------------------
// Entrance shapes. A preview pops up from a little smaller; a stamp lands from
// above its spot, bigger, the way a rubber stamp comes down; the tape swells
// in. Scale factors, not spacing.
const PREVIEW_FROM = 0.8;
const PATCH_FROM = 0.4;
const STAMP_FROM = 1.6;
const TAPE_FROM = 0.7;
const QUARTER_TURN = "90deg";
const NO_TURN = "0deg";
const TAPE_TURN = `${TILT.tape}deg`;
const AT_REST: Point = { x: 0, y: 0 };

type Spring = { damping: number; stiffness: number };

/** Reduce Motion from either source: the board's prop (the match screen's
 *  word) or the system setting the policy reads. */
function useStill(reduce: boolean): MotionPolicy {
	const policy = useMotionPolicy();
	return reduce && !policy.reduceMotion
		? { ...policy, reduceMotion: true, allowDecorativeMotion: false, largeTransition: "crossfade" }
		: policy;
}

/**
 * One entrance: `at` ms after mount the value runs 0 → 1 on `spring`, or
 * cross-fades under Reduce Motion. `at` null: no entrance, it rests at 1.
 * Only the props at mount count, so a beat plays once even when the board
 * re-renders (or a newer revision lands) halfway through it.
 */
function useEntrance(at: number | null, spring: Spring, reduce: boolean) {
	const policy = useStill(reduce);
	const [plan] = useState(() => ({ at, spring, still: policy.reduceMotion }));
	const [value] = useState(() => new Animated.Value(at === null ? 1 : 0));
	useEffect(() => {
		if (plan.at === null) return;
		const run = Animated.sequence([
			Animated.delay(plan.at),
			plan.still
				? Animated.timing(value, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true })
				: Animated.spring(value, { toValue: 1, ...plan.spring, useNativeDriver: true }),
		]);
		run.start();
		return () => run.stop();
	}, [plan, value]);
	return { value, still: plan.still };
}

const fade = (v: Animated.Value, to = 1) => v.interpolate({ inputRange: [0, 1], outputRange: [0, to], extrapolate: "clamp" });

// ── Rails ───────────────────────────────────────────────────────────────────

/**
 * A drawn fence: the painted rail sticker (drawn horizontal; a vertical fence
 * turns it a quarter) in its drawer's seat tint. The tint is a copy of the
 * rail laid over it in the colour blend: the wood keeps its own light, grain
 * and ink outline and takes the seat's hue, so four seats read as four
 * painted fences rather than four shades of mud. A new rail
 * slides in from its drawer's side of the yard; the ghost (your fence while
 * the server answers) stands in place, a step lighter. `lifted` is the most
 * recent fence another pig drew: it sits up off the paper on the small hard
 * shadow, so a pig back from a long wait sees where the last turn ended.
 *
 * Sizing: rail.png is a 256 px square with the bar painted across its middle
 * (layout.ts ART), and React Native's iOS Image puts the asset's own 256 × 256
 * ahead of our style. An Image that only pins its insets (absoluteFill) keeps
 * that 256 pt size, anchored at its box's top-left: on a 366 pt yard every
 * rail drew about three times its box and a box off to one side. So both
 * copies of the art get the box's explicit size (one pitch square, centred
 * on the fence), the square turns about its own centre for a vertical fence,
 * and nothing in it takes a touch: its transparent padding lies over the
 * neighbouring gaps and pens.
 */
export const Rail = memo(function Rail({
	L,
	at,
	seat,
	enter,
	ghost = false,
	lifted = false,
	reduce,
}: {
	L: YardLayout;
	at: EdgeAt;
	seat: Seat;
	enter: { at: number; from: Point } | null;
	ghost?: boolean;
	lifted?: boolean;
	reduce: boolean;
}) {
	const { value, still } = useEntrance(enter ? enter.at : null, MOTION_SPRING.settle, reduce);
	const from = enter && !still ? enter.from : AT_REST;
	const tint = SEAT_TINTS[seat % SEAT_TINTS.length];
	// The art's box: the whole painted square, sized explicitly.
	const art = { width: L.rail, height: L.rail };
	// The shadow rides the unturned outer box (it falls the same way for a
	// vertical rail) and follows the art's own outline, as the box is clear.
	return (
		<Animated.View
			pointerEvents="none"
			testID={lifted ? "fence-last" : "fence-rail"}
			style={[
				styles.abs,
				alongEdge(L, at, L.rail, L.rail),
				lifted ? SHADOW_SM : null,
				{
					opacity: ghost ? OPACITY.muted : fade(value),
					transform: [
						{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [from.x, 0] }) },
						{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [from.y, 0] }) },
					],
				},
			]}
		>
			<View pointerEvents="none" style={[art, { transform: [{ rotate: at.dir === "v" ? QUARTER_TURN : NO_TURN }] }]}>
				<Image source={FENCE_ART.rail} style={art} resizeMode="contain" fadeDuration={0} accessible={false} testID="fence-rail-art" />
				<View pointerEvents="none" style={[styles.abs, styles.atOrigin, art, styles.wash]}>
					<Image
						source={FENCE_ART.rail}
						style={[art, { tintColor: tint }]}
						resizeMode="contain"
						fadeDuration={0}
						accessible={false}
						testID="fence-rail-tint"
					/>
				</View>
			</View>
		</Animated.View>
	);
});

/** The first tap's answer: a dashed rail in your seat's tint, laid in the gap
 *  between the two posts. Dashed is the system's "not yet". It pops up the
 *  moment the gap is tapped. */
export function PreviewRail({ L, at, seat, reduce }: { L: YardLayout; at: EdgeAt; seat: Seat; reduce: boolean }) {
	const { value, still } = useEntrance(0, MOTION_SPRING.tap, reduce);
	return (
		<Animated.View
			pointerEvents="none"
			testID="fence-preview"
			style={[
				styles.abs,
				styles.preview,
				alongEdge(L, at, L.previewLong, L.previewThick),
				{
					backgroundColor: SEAT_TINTS[seat % SEAT_TINTS.length],
					opacity: fade(value),
					transform: [{ scale: still ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [PREVIEW_FROM, 1] }) }],
				},
			]}
		/>
	);
}

// ── Closed pens ─────────────────────────────────────────────────────────────

/** A closed pen's truffle patch. On its beat the mud spreads into the pen,
 *  then the truffle plops and bounces (Rosie's press, the app's one bounce). */
export const PenPatch = memo(function PenPatch({ L, cell, at, reduce }: { L: YardLayout; cell: Rect; at: number | null; reduce: boolean }) {
	const policy = useStill(reduce);
	const [plan] = useState(() => ({ at, policy }));
	const [grow] = useState(() => new Animated.Value(at === null ? 1 : 0));
	const [squash] = useState(() => new Animated.Value(1));
	useEffect(() => {
		if (plan.at === null) return;
		const still = plan.policy.reduceMotion;
		const run = Animated.sequence([
			Animated.delay(plan.at),
			still
				? Animated.timing(grow, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true })
				: Animated.spring(grow, { toValue: 1, ...MOTION_SPRING.settle, useNativeDriver: true }),
			squashAndSpring(squash, plan.policy),
		]);
		run.start();
		return () => run.stop();
	}, [plan, grow, squash]);
	const still = plan.policy.reduceMotion;
	const scale = still ? 1 : Animated.multiply(grow.interpolate({ inputRange: [0, 1], outputRange: [PATCH_FROM, 1] }), squash);
	return (
		<View pointerEvents="none" style={[styles.abs, styles.centre, cell]}>
			<Animated.Image
				source={FENCE_ART.penTruffle}
				resizeMode="contain"
				fadeDuration={0}
				accessible={false}
				style={{ width: L.penArt, height: L.penArt, opacity: fade(grow), transform: [{ scale }] }}
			/>
		</View>
	);
});

/**
 * Whose pen it is, never by hue alone: the owner's pig (or the hat that
 * stands in for it, the way every small portrait in the app does) on a disc
 * of their seat tint, stamped into the pen's corner after the patch lands. A
 * pig who left keeps its stamps, dimmed.
 */
export const PenStamp = memo(function PenStamp({
	L,
	origin,
	owner,
	look,
	tilt,
	dimmed,
	at,
	reduce,
}: {
	L: YardLayout;
	origin: Point;
	owner: Seat;
	look: PigLook | null;
	tilt: number;
	dimmed: boolean;
	at: number | null;
	reduce: boolean;
}) {
	const { value, still } = useEntrance(at === null ? null : at + MOTION_DURATION.state, MOTION_SPRING.tap, reduce);
	const pig = pigStagePropsForLook(look);
	const tint = SEAT_TINTS[owner % SEAT_TINTS.length];
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				styles.abs,
				styles.stamp,
				{
					left: origin.x,
					top: origin.y,
					width: L.stamp,
					height: L.stamp,
					backgroundColor: tint,
					opacity: fade(value, dimmed ? OPACITY.dim : 1),
					transform: [
						{ rotate: `${tilt}deg` },
						{ scale: still ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [STAMP_FROM, 1] }) },
					],
				},
			]}
		>
			<PigAvatar
				size={L.stamp - BORDER.thin * 2}
				pigId={pig.pigId}
				hatId={pig.equipped?.id ?? null}
				bowId={pig.equippedBow?.id ?? null}
				style={{ backgroundColor: tint }}
			/>
		</Animated.View>
	);
});

// ── The "draw again" tape ───────────────────────────────────────────────────

/** A strip of masking tape slapped across the top of the yard when a pig
 *  closes a pen and owes another fence: in on the first extra move's beat,
 *  held a read past the last one, then lifted off. */
export function AgainTape({ text, at, until, reduce }: { text: string; at: number; until: number; reduce: boolean }) {
	const policy = useStill(reduce);
	const [plan] = useState(() => ({ at, until, still: policy.reduceMotion }));
	const [value] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const run = Animated.sequence([
			Animated.delay(plan.at),
			plan.still
				? Animated.timing(value, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true })
				: Animated.spring(value, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: true }),
			Animated.delay(plan.until - plan.at + MOTION.beat),
			Animated.timing(value, {
				toValue: 0,
				duration: plan.still ? MOTION_DURATION.crossfade : MOTION.fade,
				useNativeDriver: true,
			}),
		]);
		run.start();
		return () => run.stop();
	}, [plan, value]);
	return (
		<View pointerEvents="none" style={styles.tapeRow}>
			<Animated.View
				testID="fence-again-tape"
				style={[
					styles.tape,
					{
						opacity: fade(value),
						transform: [
							{ rotate: TAPE_TURN },
							{ scale: plan.still ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [TAPE_FROM, 1] }) },
						],
					},
				]}
			>
				<T role="handLg" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{text}
				</T>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	abs: { position: "absolute" },
	atOrigin: { left: 0, top: 0 },
	centre: { alignItems: "center", justifyContent: "center" },
	// The seat tint over the wood, in the colour blend (hue and saturation
	// from the tint, lightness from the wood). Checked against the real rail
	// on 2026-10-04 (artifacts/fence-the-pen-tint-2026-10-04): a multiply wash
	// darkened the wood and left sky and sage a near match (ΔE 9); the colour
	// blend keeps the wood's lightness and its ink, and the closest pair of
	// seats sits ΔE 22 apart.
	wash: { mixBlendMode: "color" },
	preview: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderStyle: "dashed",
		borderColor: UI_COLORS.border,
	},
	stamp: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	// Pinned across the yard's top edge, centred, above everything in it.
	tapeRow: {
		position: "absolute",
		top: -SPACE.md,
		left: 0,
		right: 0,
		alignItems: "center",
	},
	tape: {
		maxWidth: "90%",
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
		borderRadius: RADII.hair,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.tapeEdge,
		backgroundColor: WHIMSY.tape,
	},
});
