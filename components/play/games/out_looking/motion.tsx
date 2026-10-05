// The yard's moving parts: a pig that walks to where it is going, a find that
// hops from its pile to the pig that took it and names itself, the heart two
// pigs share, the muddy-trotters sticker, a new tile dropping onto a pile.
// Each one asks the motion policy itself (the board's reduceMotion OR the OS
// setting): under Reduce Motion a pig appears where it is going without the
// walk, and everything else cross-fades in place instead of travelling.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Glyph, PigStage, Tag, T, type PigAnimation, type PigStageProps } from "@/components/ui";
import { findArtGlyph } from "@/components/satchel/FindArt";
import { ART_SIZE, BORDER, MOTION_SPRING, RADII, SHADOW_SM, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy, type MotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import type { PigStageLookProps } from "@/utils/multiplayer/looks";
import { NAME_W, type Flight, type Mark, type PigSpot, type Point } from "./model";

// ── Timing (drawing tempo, not UI durations) ────────────────────────────────
/** A pig's walk between the yard and a place. */
const WALK_MS = 900;
/** A find's hop from the pile to the pig. */
const HOP_MS = 520;
/** The heart lingers over the pigs who met, then lets go. */
const HEART_DELAY_MS = 300;
const HEART_RISE_MS = 1_600;
/** The muddy-trotters sticker lands a beat after the pig sees the empty spot. */
const MUDDY_DELAY_MS = 350;
/** How far a find hops above the straight line, and how far a heart rises. */
const HOP_ARC = SPACE.xl;
/** A tile shrinks a little as it drops into the pouch. */
const POUCH_SCALE = 0.7;
const HEART_RISE = SPACE.xl;
const DROP_FROM = SPACE.lg;
/** A find's name grows upward from just over the pig's head, so a wrapped
 *  name never covers the pig. */
const NAME_BOX_H = 64;
const LOOKING_W = 96;
/** The art sizes the scene's marks are drawn at (the muddy sticker scales
 *  with the yard: SceneSizes.muddy). */
const HEART = ART_SIZE.glyphSm;
const MARK = ART_SIZE.glyphSm;
const CHECK_DISC = SPACE.xl;
const CHECK_GLYPH = 16;
/** Where each mark hangs off a pig, as shares of its drawn size: the check by
 *  its ear, the zzz over its head, the tag at its hooves. */
const CHECK_AT = { x: 0.22, y: -0.5 };
const ZZZ_AT = { x: 0.12, y: -0.62 };
const HOOVES = 0.46;
/** The "Looking…" tag tucks up under the hooves; a find's name hangs above the head. */
const TAG_TUCK = SPACE.sm;
const NAME_GAP = SPACE.xs;
const TYPE_CAP = 1.3;

type Facing = NonNullable<PigStageProps["facing"]>;

/** The board's reduceMotion and the OS setting, as one (stable) policy. */
function usePolicy(reduce: boolean): MotionPolicy {
	const system = useMotionPolicy();
	return useMemo<MotionPolicy>(
		() =>
			!reduce || system.reduceMotion
				? system
				: {
						reduceMotion: true,
						allowDecorativeMotion: false,
						largeTransition: "crossfade",
						duration: (_standardMs: number, reducedMs: number = MOTION_DURATION.crossfade) => reducedMs,
					},
		[system, reduce],
	);
}

// ── A pig ────────────────────────────────────────────────────────────────────

/**
 * One seat's pig on the scene. It owns its walk: given a new spot it trots
 * there (the `walk` family, facing the way it goes, scaling between the yard
 * size and the away size), then settles into the spot's pose and facing.
 * Positioned by its canvas centre, so the scale never moves its feet. A new
 * `geoKey` is the yard itself changing size (the board's height arrived, the
 * text size changed): every spot moves at once and nobody went anywhere, so
 * the pig is put in its new spot rather than walked there.
 */
export function SeatPig({
	spot,
	look,
	geoKey = "",
	reduce,
	testID,
}: {
	spot: PigSpot;
	look: PigStageLookProps;
	geoKey?: string;
	reduce: boolean;
	testID?: string;
}) {
	const policy = usePolicy(reduce);
	const still = policy.reduceMotion;
	const [x] = useState(() => new Animated.Value(spot.x));
	const [y] = useState(() => new Animated.Value(spot.y));
	const [scale] = useState(() => new Animated.Value(spot.size / ART_SIZE.stage));
	const target = useRef({ x: spot.x, y: spot.y, size: spot.size, geoKey });
	// Where the pig last came to rest; it is walking while that is not here.
	const [rest, setRest] = useState({ x: spot.x, y: spot.y, geoKey });
	if ((still || rest.geoKey !== geoKey) && (rest.x !== spot.x || rest.y !== spot.y || rest.geoKey !== geoKey)) {
		setRest({ x: spot.x, y: spot.y, geoKey });
	}

	useEffect(() => {
		const prev = target.current;
		if (prev.x === spot.x && prev.y === spot.y && prev.size === spot.size && prev.geoKey === geoKey) return;
		target.current = { x: spot.x, y: spot.y, size: spot.size, geoKey };
		const s = spot.size / ART_SIZE.stage;
		if (still || prev.geoKey !== geoKey) {
			x.setValue(spot.x);
			y.setValue(spot.y);
			scale.setValue(s);
			return;
		}
		const ease = Easing.inOut(Easing.sin);
		const walk = Animated.parallel([
			Animated.timing(x, { toValue: spot.x, duration: WALK_MS, easing: ease, useNativeDriver: true }),
			Animated.timing(y, { toValue: spot.y, duration: WALK_MS, easing: ease, useNativeDriver: true }),
			Animated.timing(scale, { toValue: s, duration: WALK_MS, easing: ease, useNativeDriver: true }),
		]);
		walk.start(({ finished }) => {
			if (finished) setRest({ x: spot.x, y: spot.y, geoKey });
		});
		return () => walk.stop();
	}, [spot.x, spot.y, spot.size, geoKey, still, x, y, scale]);

	const walking = !still && (Math.abs(rest.x - spot.x) > 0.5 || Math.abs(rest.y - spot.y) > 0.5);
	const animation: PigAnimation = walking ? "walk" : spot.pose;
	const facing: Facing | undefined = walking ? (spot.x >= rest.x ? "right" : "left") : (spot.facing ?? undefined);
	// Frame sync, so a worn item rides the moving pig; a frame from another
	// family never leaks into this one.
	const [frame, setFrame] = useState<{ animation: PigAnimation; idx: number }>({ animation, idx: 0 });
	const frameIdx = still || frame.animation !== animation ? 0 : frame.idx;

	return (
		<Animated.View
			pointerEvents="none"
			accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
			style={[styles.anchor, { transform: [{ translateX: x }, { translateY: y }] }]}
			testID={testID}
		>
			<Animated.View style={[styles.canvas, { transform: [{ scale }] }]}>
				<PigStage
					{...look}
					pigAnimation={animation}
					facing={facing}
					pigFrozen={still}
					pigFrameIdx={frameIdx}
					onPigFrame={(idx) => setFrame({ animation, idx })}
				/>
			</Animated.View>
			{walking ? null : <PigMark mark={spot.mark} size={spot.size} />}
		</Animated.View>
	);
}

function PigMark({ mark, size }: { mark: Mark; size: number }) {
	if (mark === "check")
		return (
			<View style={[styles.checkDisc, { left: size * CHECK_AT.x, top: size * CHECK_AT.y }]}>
				<Glyph name="check" size={CHECK_GLYPH} />
			</View>
		);
	if (mark === "zzz")
		return (
			<View style={[styles.mark, { left: size * ZZZ_AT.x, top: size * ZZZ_AT.y }]}>
				<Glyph name="zzz" size={MARK} />
			</View>
		);
	if (mark === "looking")
		return (
			<View style={[styles.looking, { top: size * HOOVES - TAG_TUCK }]}>
				<Tag flat tone="sun" label={"Looking…"} maxFontSizeMultiplier={TYPE_CAP} testID="ol-looking" />
			</View>
		);
	return null;
}

// ── A find on its way to a pouch ─────────────────────────────────────────────

/** A tile hops from its heap spot to the pig that took it and drops into the
 *  pouch; its name hangs over the pig until the next one lands. One driver,
 *  three stretches: 0→1 the hop, 1→1.2 into the pouch, then (after the hold)
 *  1.2→2 the name lets go. */
export function FlyingFind({ flight, reduce }: { flight: Flight; reduce: boolean }) {
	const policy = usePolicy(reduce);
	const still = policy.reduceMotion;
	const [t] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const run = Animated.sequence([
			Animated.delay(flight.delay),
			Animated.timing(t, {
				toValue: 1,
				duration: still ? MOTION_DURATION.crossfade : HOP_MS,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.timing(t, { toValue: 1.2, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
			Animated.delay(flight.hold),
			Animated.timing(t, { toValue: 2, duration: MOTION_DURATION.state, useNativeDriver: true }),
		]);
		run.start();
		return () => run.stop();
	}, [t, still, flight.delay, flight.hold]);

	const dx = flight.to.x - flight.from.x;
	const dy = flight.to.y - flight.from.y;
	// Still, the tile never travels: every stop reads its landing spot.
	const hopX = t.interpolate({ inputRange: [0, 1, 2], outputRange: still ? [dx, dx, dx] : [0, dx, dx] });
	const hopY = t.interpolate({ inputRange: [0, 0.5, 1, 2], outputRange: still ? [dy, dy, dy, dy] : [0, dy / 2 - HOP_ARC, dy, dy] });
	const shrink = t.interpolate({ inputRange: [0, 1, 2], outputRange: still ? [1, 1, 1] : [1, POUCH_SCALE, POUCH_SCALE] });
	// Moving: the tile sits on the heap until its turn, so it reads as still
	// there. Still: it simply appears at the pig.
	const tileOpacity = t.interpolate({
		inputRange: [0, 0.01, 1, 1.2, 2],
		outputRange: still ? [0, 1, 1, 0, 0] : [1, 1, 1, 0, 0],
	});
	const nameOpacity = t.interpolate({ inputRange: [0, 0.95, 1, 1.2, 2], outputRange: [0, 0, 1, 1, 0] });
	const nameRise = t.interpolate({ inputRange: [0, 1.2, 2], outputRange: still ? [0, 0, 0] : [0, 0, -SPACE.sm] });

	return (
		<>
			<Animated.View
				pointerEvents="none"
				accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
				style={[styles.tile, { left: flight.from.x - flight.tile / 2, top: flight.from.y - flight.tile / 2, opacity: tileOpacity, transform: [{ translateX: hopX }, { translateY: hopY }, { scale: shrink }] }]}
			>
				<Glyph name={findArtGlyph(flight.find)} size={flight.tile} />
			</Animated.View>
			<Animated.View
				pointerEvents="none"
				accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
				style={[
					styles.name,
					{ left: flight.labelLeft, top: flight.to.y - NAME_GAP - NAME_BOX_H, opacity: nameOpacity, transform: [{ translateY: nameRise }] },
				]}
			>
				<View style={styles.nameTag}>
					<T role="hand" align="center" numberOfLines={2} maxFontSizeMultiplier={TYPE_CAP}>
						{flight.label}
					</T>
				</View>
			</Animated.View>
		</>
	);
}

// ── The heart two pigs share ─────────────────────────────────────────────────

export function FloatHeart({ at, reduce }: { at: Point; reduce: boolean }) {
	const policy = usePolicy(reduce);
	const still = policy.reduceMotion;
	const [pop] = useState(() => new Animated.Value(still ? 1 : 0));
	const [rise] = useState(() => new Animated.Value(0));
	const [opacity] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const run = still
			? Animated.sequence([
					Animated.delay(HEART_DELAY_MS),
					Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true }),
				])
			: Animated.sequence([
					Animated.delay(HEART_DELAY_MS),
					Animated.parallel([
						Animated.spring(pop, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: true }),
						Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
						Animated.timing(rise, { toValue: 1, duration: HEART_RISE_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
					]),
					Animated.timing(opacity, { toValue: 0, duration: MOTION_DURATION.state, useNativeDriver: true }),
				]);
		run.start();
		return () => run.stop();
	}, [still, pop, rise, opacity]);
	const lift = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -HEART_RISE] });
	return (
		<Animated.View
			pointerEvents="none"
			accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
			style={[styles.heart, { left: at.x - HEART / 2, top: at.y - HEART / 2, opacity, transform: [{ translateY: lift }, { scale: pop }] }]}
			testID="ol-heart"
		>
			<Glyph name="heart" size={HEART} />
		</Animated.View>
	);
}

// ── Muddy trotters ───────────────────────────────────────────────────────────

/** The sticker lands where the pile should have been, at the yard's size. */
export function MuddySticker({ at, size, reduce, children }: { at: Point; size: number; reduce: boolean; children: ReactNode }) {
	const policy = usePolicy(reduce);
	const [scale] = useState(() => new Animated.Value(0));
	const [opacity] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const run = Animated.sequence([Animated.delay(MUDDY_DELAY_MS), popIn(scale, opacity, policy)]);
		run.start();
		return () => run.stop();
	}, [scale, opacity, policy]);
	return (
		<Animated.View
			pointerEvents="none"
			accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
			style={[styles.muddy, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, opacity, transform: [{ scale }] }]}
			testID="ol-muddy"
		>
			{children}
		</Animated.View>
	);
}

// ── A new tile on a pile ─────────────────────────────────────────────────────

/** The night's tile drops onto its pile and settles. */
export function DropIn({ reduce, children }: { reduce: boolean; children: ReactNode }) {
	const policy = usePolicy(reduce);
	const still = policy.reduceMotion;
	const [fall] = useState(() => new Animated.Value(still ? 0 : -DROP_FROM));
	const [opacity] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const run = still
			? Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true })
			: Animated.parallel([
					Animated.spring(fall, { toValue: 0, ...MOTION_SPRING.settle, useNativeDriver: true }),
					Animated.timing(opacity, { toValue: 1, duration: MOTION_DURATION.feedback, useNativeDriver: true }),
				]);
		run.start();
		return () => run.stop();
	}, [still, fall, opacity]);
	return <Animated.View style={{ opacity, transform: [{ translateY: fall }] }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
	// A zero-size point at the pig's canvas centre; everything hangs off it.
	anchor: { position: "absolute", left: 0, top: 0 },
	canvas: {
		position: "absolute",
		left: -ART_SIZE.stage / 2,
		top: -ART_SIZE.stage / 2,
		width: ART_SIZE.stage,
		height: ART_SIZE.stage,
	},
	mark: { position: "absolute" },
	checkDisc: {
		position: "absolute",
		width: CHECK_DISC,
		height: CHECK_DISC,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sage,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	looking: { position: "absolute", left: -LOOKING_W / 2, width: LOOKING_W, alignItems: "center" },
	tile: { position: "absolute" },
	name: { position: "absolute", width: NAME_W, height: NAME_BOX_H, alignItems: "center", justifyContent: "flex-end" },
	nameTag: {
		backgroundColor: WHIMSY.paper,
		borderRadius: RADII.sm,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		paddingHorizontal: SPACE.xs,
		paddingVertical: SPACE.xxs,
		...SHADOW_SM,
	},
	heart: { position: "absolute" },
	muddy: { position: "absolute" },
});
