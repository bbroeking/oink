// The pasture: two pigs on one ground line facing each other (PigStage
// `facing`, the visit's three-quarter turn), three lane posts in the mud in
// front of them, the wind-up arc over the tosser's wind-up post, and the
// mudball's flight on a reveal. You stand on the left, your rival on the
// right; the lanes read left, middle, right across the screen on every
// phone, so "left" means the same post to both pigs.
//
// A pure drawing of its props: the board decides what is shown (the open
// toss, or a reveal stage) and when, and how tall the scene is drawn
// (`sceneH`: the full 204pt scene on a roomy board, smaller on a short one,
// every drawn size scaled with it; ./layout.ts pastureGeometry). Motion obeys
// the policy: under Reduce Motion the arc and the flight become cross-fades
// and nothing travels.

import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, type ImageStyle, type ViewStyle } from "react-native";
import { PigStage, Glyph, T, Sticker, type PigReaction } from "@/components/ui";
import { ART_SIZE, BORDER, DIG_TILE, MOTION_SPRING, OPACITY, RADII, SEAT_TINTS, SPACE, TILT, TINT, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn, squashAndSpring } from "@/utils/motionRecipes";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import type { PigLook } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import { VOLLEY_TIMING, type Lane, type VolleyRow } from "@/multiplayer/games/mud_volley/rules";
import { VOLLEY_ART } from "../../playArt";
import { outcomeMark, type VolleyMark } from "./copy";
import { PIG_INSET, PUDDLE_INSET, SCENE_H, pastureGeometry, type PastureGeometry } from "./layout";

// ── Scene proportions ────────────────────────────────────────────────────────
// Sizes and heights come from pastureGeometry(sceneH); these are the few
// proportions that hold at every size.

/** Where each lane's post stands, as a fraction of the scene's width. */
const LANE_X: Record<Lane, number> = { L: 0.27, M: 0.5, R: 0.73 };
/** Samples along the flight (more is a smoother parabola). */
const FLIGHT_STOPS = Array.from({ length: 9 }, (_, i) => i / 8);
/** Where a splat lands on a pig, as fractions of its box (the near side). */
const MUD_SPOTS: readonly [number, number][] = [
	[0.36, 0.58],
	[0.56, 0.66],
	[0.46, 0.44],
];
/** The tosser's hoof, as fractions of its pig box: where the mudball leaves. */
const HOOF_X = 0.8;
const HOOF_Y = 0.5;
/** The flight's parabola: four times the lift at its apex (t = 0.5). */
const ARC_HUMP = 4;

const MARK_ART: Record<VolleyMark, typeof VOLLEY_ART.mudball> = {
	splatBig: VOLLEY_ART.splatBig,
	splatSmall: VOLLEY_ART.splatSmall,
	bucket: VOLLEY_ART.bucket,
};

export type RevealStage = "settle" | "flight" | "impact";

export interface PastureProps {
	width: number;
	/** How tall the scene is drawn (default: the full 204pt scene). */
	sceneH?: number;
	you: Seat;
	rival: Seat;
	/** Null for an open chair (an envelope nobody has answered yet). */
	rivalLook: PigLook | null;
	youLook: PigLook | null;
	/** Who holds the mudball (the other pig holds the bucket); null: nobody. */
	attacker: Seat | null;
	/** The lane the arc hangs over (the open toss's wind-up); null: no arc. */
	windup: Lane | null;
	/** A new value pops the arc in again (the toss index). */
	arcKey: string;
	/** A toss being revealed, and how far along. `flightMs` is what is left
	 *  of the arc when the flight starts (the board times it in server time;
	 *  a late view flies a shorter arc). Defaults to the whole arc. */
	flight: { row: VolleyRow; stage: RevealStage; flightMs?: number } | null;
	rivalSealed: boolean;
	/** Splats each seat has worn so far. */
	mud: number[];
	reactions: Record<number, PigReaction | null>;
	onReactionDone: (seat: Seat) => void;
	reduceMotion: boolean;
	accessibilityLabel: string;
}

/** The scene's sized pieces, for one geometry. */
interface SceneStyles {
	scene: ViewStyle;
	grass: ViewStyle;
	puddle: ViewStyle;
	post: ViewStyle;
	postArt: ImageStyle;
	arc: ViewStyle;
	arcArt: ImageStyle;
	pigBox: ViewStyle;
	stageWrap: ViewStyle;
	groundShadow: ViewStyle;
	emptySeat: ViewStyle;
	mud: ImageStyle;
	held: ImageStyle;
	sealed: ViewStyle;
	ball: ImageStyle;
	landing: ViewStyle;
	landingArt: ImageStyle;
}

function sceneStyles(g: PastureGeometry): SceneStyles {
	return {
		scene: { height: g.sceneH },
		grass: { top: g.grassTop },
		puddle: { top: g.puddleTop, height: g.puddleH },
		post: { top: g.postTop, width: g.postW, height: g.postH },
		postArt: { width: g.postW, height: g.postH },
		arc: { top: g.postTop - g.arcSize + g.arcHang, width: g.arcSize, height: g.arcSize },
		arcArt: { width: g.arcSize, height: g.arcSize },
		pigBox: { top: g.pigTop, width: g.pigBox, height: g.pigBox },
		stageWrap: { transform: [{ scale: g.stageScale }] },
		groundShadow: { left: (g.pigBox - g.shadowW) / 2, width: g.shadowW, height: g.shadowH },
		emptySeat: { width: g.emptySeat, height: g.emptySeat },
		mud: { width: g.mudMark, height: g.mudMark },
		held: { bottom: g.heldLift, width: g.held, height: g.held },
		sealed: { top: g.sealedTop, right: g.sealedRight },
		ball: { width: g.ball, height: g.ball },
		landing: { top: g.postTop + g.postH / 2 - g.landing / 2, width: g.landing, height: g.landing },
		landingArt: { width: g.landing, height: g.landing },
	};
}

export function Pasture(props: PastureProps) {
	const { width, you, rival, attacker, windup, flight, reduceMotion } = props;
	const sceneH = props.sceneH ?? SCENE_H;
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const g = useMemo(() => pastureGeometry(sceneH), [sceneH]);
	const sized = useMemo(() => sceneStyles(g), [g]);

	const sideOf = (seat: Seat) => (seat === you ? "left" : "right");
	const postX = (lane: Lane) => width * LANE_X[lane];

	// ── The wind-up arc pops in once per toss.
	const [arcScale] = useState(() => new Animated.Value(0));
	const [arcOpacity] = useState(() => new Animated.Value(0));
	const arcShown = windup !== null && flight === null;
	const arcRun = arcShown ? `${props.arcKey}:${windup}` : null;
	useEffect(() => {
		if (arcRun === null) {
			arcScale.setValue(0);
			arcOpacity.setValue(0);
			return;
		}
		arcScale.setValue(0);
		arcOpacity.setValue(0);
		const anim = popIn(arcScale, arcOpacity, { ...policy, reduceMotion: reduce });
		anim.start();
		return () => anim.stop();
	}, [arcRun, arcScale, arcOpacity, policy, reduce]);

	// ── The flight: the ball travels the arc, then the landing pops in.
	const [flightAnim] = useState(() => new Animated.Value(0));
	const [ballOpacity] = useState(() => new Animated.Value(0));
	const [impact] = useState(() => new Animated.Value(0));
	const flightRow = flight ? `${flight.row.ex}:${flight.row.at}` : null;
	const flightStage = flight?.stage ?? null;
	const flightMs = flight?.flightMs ?? VOLLEY_TIMING.arcMs;
	useEffect(() => {
		if (flightRow === null || flightStage === null) return;
		if (flightStage === "settle") {
			flightAnim.setValue(0);
			ballOpacity.setValue(0);
			impact.setValue(0);
			return;
		}
		if (flightStage === "flight") {
			impact.setValue(0);
			if (reduce || flightMs <= 0) {
				// Nothing travels: the ball cross-fades in where it lands.
				flightAnim.setValue(1);
				const fade = Animated.timing(ballOpacity, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true });
				fade.start();
				return () => fade.stop();
			}
			flightAnim.setValue(0);
			ballOpacity.setValue(1);
			const arc = Animated.timing(flightAnim, {
				toValue: 1,
				duration: flightMs,
				easing: Easing.inOut(Easing.quad),
				useNativeDriver: true,
			});
			arc.start();
			return () => arc.stop();
		}
		flightAnim.setValue(1);
		ballOpacity.setValue(0);
		const land = reduce
			? Animated.timing(impact, { toValue: 1, duration: MOTION_DURATION.crossfade, useNativeDriver: true })
			: Animated.spring(impact, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: true });
		land.start();
		return () => land.stop();
	}, [flightRow, flightStage, flightMs, reduce, flightAnim, ballOpacity, impact]);

	const ball = flight ? flightPath(flight.row, width, sideOf(flight.row.attacker), g) : null;

	return (
		<View accessible accessibilityRole="image" accessibilityLabel={props.accessibilityLabel} testID="volley-pasture">
			<Sticker color="sky" radius={RADII.xl} rotate={0} style={[styles.scene, sized.scene, { width }]}>
				{/* The clip lives inside the sticker: overflow on the sticker itself
				    would mask its hard shadow on iOS. */}
				<View style={styles.clip}>
					<View pointerEvents="none" style={[styles.grass, sized.grass]} />
					<View pointerEvents="none" style={[styles.puddle, sized.puddle]} />

					<VolleyPig
						side="left"
						look={props.youLook}
						reaction={props.reactions[you] ?? null}
						onReactionDone={() => props.onReactionDone(you)}
						holding={heldBy(you, attacker, flight)}
						mud={props.mud[you] ?? 0}
						g={g}
						sized={sized}
					/>
					<VolleyPig
						side="right"
						look={props.rivalLook}
						empty={props.rivalLook === null}
						reaction={props.reactions[rival] ?? null}
						onReactionDone={() => props.onReactionDone(rival)}
						holding={heldBy(rival, attacker, flight)}
						mud={props.mud[rival] ?? 0}
						g={g}
						sized={sized}
					/>

					{/* The mud is in front of the pigs: posts, then the arc hung on one. */}
					{(["L", "M", "R"] as const).map((lane) => (
						<View key={lane} pointerEvents="none" style={[styles.post, sized.post, { left: postX(lane) - g.postW / 2 }]}>
							<Image source={VOLLEY_ART.lanePost} style={sized.postArt} resizeMode="contain" accessible={false} />
						</View>
					))}

					{windup !== null ? (
						<Animated.View
							pointerEvents="none"
							testID="volley-windup-arc"
							style={[
								styles.arc,
								sized.arc,
								{
									left: postX(windup) - g.arcSize / 2,
									opacity: arcOpacity,
									// The arc is drawn sweeping left to right; a pig tossing from
									// the right swings it the other way.
									transform: [{ scaleX: attacker !== null && sideOf(attacker) === "right" ? -1 : 1 }, { scale: arcScale }],
								},
							]}
						>
							<Image source={VOLLEY_ART.windupArc} style={sized.arcArt} resizeMode="contain" accessible={false} />
						</Animated.View>
					) : null}

					{props.rivalSealed ? <SealedSticker reduce={reduce} at={sized.sealed} /> : null}

					{ball ? (
						<Animated.Image
							source={VOLLEY_ART.mudball}
							resizeMode="contain"
							accessible={false}
							testID="volley-mudball"
							style={[
								styles.ball,
								sized.ball,
								{
									opacity: ballOpacity,
									transform: [
										{ translateX: flightAnim.interpolate({ inputRange: ball.t, outputRange: ball.x }) },
										{ translateY: flightAnim.interpolate({ inputRange: ball.t, outputRange: ball.y }) },
										{ rotate: flightAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "540deg"] }) },
									],
								},
							]}
						/>
					) : null}

					{flight && flight.stage === "impact" ? (
						<Animated.View
							pointerEvents="none"
							testID={`volley-landing-${flight.row.outcome}`}
							style={[
								styles.landing,
								sized.landing,
								{
									left: postX(flight.row.toss) - g.landing / 2,
									opacity: impact.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
									transform: [{ scale: reduce ? 1 : impact }],
								},
							]}
						>
							<Image source={MARK_ART[outcomeMark(flight.row)]} style={sized.landingArt} resizeMode="contain" accessible={false} />
						</Animated.View>
					) : null}
				</View>
			</Sticker>
		</View>
	);
}

/** What a pig holds while a toss is open: the tosser the mudball, the
 *  catcher the bucket. Mid-flight the ball has left the tosser's hoof. */
function heldBy(seat: Seat, attacker: Seat | null, flight: PastureProps["flight"]): "ball" | "bucket" | null {
	const tosser = flight ? flight.row.attacker : attacker;
	if (tosser === null) return null;
	if (seat !== tosser) {
		// On a catch the bucket has hopped into the lane to meet the ball.
		return flight && flight.stage === "impact" && flight.row.outcome === "catch" ? null : "bucket";
	}
	return flight && flight.stage !== "settle" ? null : "ball";
}

/** The mudball's arc from the tosser's hoof to the toss lane's post, as
 *  interpolation stops (a parabola through an apex near the top). */
function flightPath(row: VolleyRow, width: number, side: "left" | "right", g: PastureGeometry) {
	const x0 = side === "left" ? g.pigBox * HOOF_X : width - g.pigBox * HOOF_X;
	const y0 = g.pigTop + g.pigBox * HOOF_Y;
	const x1 = width * LANE_X[row.toss];
	const y1 = g.postTop;
	// y(t) = straight line minus a hump whose top lands on the apex at t = 0.5.
	const lift = (y0 + y1) / 2 - g.arcApex;
	const t = FLIGHT_STOPS;
	return {
		t,
		x: t.map((k) => x0 + (x1 - x0) * k - g.ball / 2),
		y: t.map((k) => y0 + (y1 - y0) * k - ARC_HUMP * lift * k * (1 - k) - g.ball / 2),
	};
}

function VolleyPig({
	side,
	look,
	empty = false,
	reaction,
	onReactionDone,
	holding,
	mud,
	g,
	sized,
}: {
	side: "left" | "right";
	look: PigLook | null;
	empty?: boolean;
	reaction: PigReaction | null;
	onReactionDone: () => void;
	holding: "ball" | "bucket" | null;
	mud: number;
	g: PastureGeometry;
	sized: SceneStyles;
}) {
	// A living surface: the worn items ride the breathing frame.
	const [frame, setFrame] = useState(0);
	const stage = pigStagePropsForLook(look);
	const facing = side === "left" ? "right" : "left";
	const near = (fx: number) => (side === "left" ? fx : 1 - fx);
	return (
		<View pointerEvents="none" style={[styles.pigBox, sized.pigBox, side === "left" ? styles.pigLeft : styles.pigRight]}>
			<View style={[styles.groundShadow, sized.groundShadow]} />
			{empty ? (
				<Sticker color="cream" radius={RADII.pill} borderStyle="dashed" shadow="none" rotate={0} style={[styles.emptySeat, sized.emptySeat]}>
					<Glyph name="pigface" size={g.emptyFace} style={styles.emptyFace} />
				</Sticker>
			) : (
				<View style={[styles.stageWrap, sized.stageWrap]}>
					<PigStage
						{...stage}
						facing={facing}
						pigAnimation="idle"
						pigMood="content"
						pigReaction={reaction}
						onPigComplete={onReactionDone}
						pigFrameIdx={frame}
						onPigFrame={setFrame}
					/>
				</View>
			)}
			{MUD_SPOTS.slice(0, Math.min(mud, MUD_SPOTS.length)).map(([fx, fy], i) => (
				<Image
					key={i}
					source={VOLLEY_ART.splatSmall}
					resizeMode="contain"
					accessible={false}
					style={[styles.mud, sized.mud, { left: g.pigBox * near(fx) - g.mudMark / 2, top: g.pigBox * fy - g.mudMark / 2 }]}
				/>
			))}
			{holding && !empty ? (
				<Image
					source={holding === "ball" ? VOLLEY_ART.mudball : VOLLEY_ART.bucket}
					resizeMode="contain"
					accessible={false}
					testID={`volley-held-${holding}-${side}`}
					style={[styles.held, sized.held, side === "left" ? styles.heldLeft : styles.heldRight]}
				/>
			) : null}
		</View>
	);
}

/** Over the rival: their lane is in, and nobody can see it. */
function SealedSticker({ reduce, at }: { reduce: boolean; at: ViewStyle }) {
	const policy = useMotionPolicy();
	const [scale] = useState(() => new Animated.Value(0));
	const [opacity] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const anim = popIn(scale, opacity, { ...policy, reduceMotion: reduce });
		anim.start();
		return () => anim.stop();
	}, [scale, opacity, policy, reduce]);
	return (
		<Animated.View pointerEvents="none" style={[styles.sealed, at, { opacity, transform: [{ scale }] }]} testID="volley-rival-sealed">
			<Sticker color="paper" radius={RADII.pill} shadow="sm" rotate={TILT.dialog} style={styles.sealedChip}>
				<Glyph name="lock" size={ART_SIZE.mark} />
				<T role="kickerPillSm" maxFontSizeMultiplier={1.3}>
					sealed
				</T>
			</Sticker>
		</Animated.View>
	);
}

/** A seat's score: its tint, its name, its points. A squash when it ticks. */
export function ScoreSticker({ seat, name, score, side }: { seat: Seat; name: string; score: number; side: "left" | "right" }) {
	const policy = useMotionPolicy();
	const [squash] = useState(() => new Animated.Value(1));
	const last = useRef(score);
	useEffect(() => {
		if (last.current === score) return;
		last.current = score;
		const anim = squashAndSpring(squash, policy);
		anim.start();
		return () => anim.stop();
	}, [score, squash, policy]);
	return (
		<Animated.View
			accessible
			accessibilityRole="text"
			accessibilityLabel={`${name}, ${score} ${score === 1 ? "point" : "points"}`}
			style={[styles.scoreWrap, { transform: [{ scale: squash }] }]}
			testID={`volley-score-${side}`}
		>
			<Sticker
				color={SEAT_TINTS[seat % SEAT_TINTS.length]}
				radius={RADII.lg}
				shadow="sm"
				rotate={side === "left" ? TILT.card : -TILT.card}
				style={styles.score}
			>
				<T role="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={styles.scoreName}>
					{name}
				</T>
				<T role="numeralLg" maxFontSizeMultiplier={1.3}>
					{score}
				</T>
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	scene: { alignSelf: "center" },
	clip: { ...StyleSheet.absoluteFill, borderRadius: RADII.lg, overflow: "hidden" },
	grass: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: WHIMSY.grass,
	},
	puddle: {
		position: "absolute",
		left: PUDDLE_INSET,
		right: PUDDLE_INSET,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: WHIMSY.dirtDeep,
		backgroundColor: DIG_TILE.mud[0],
	},
	post: { position: "absolute" },
	arc: { position: "absolute" },
	pigBox: { position: "absolute", alignItems: "center", justifyContent: "center" },
	pigLeft: { left: PIG_INSET },
	pigRight: { right: PIG_INSET },
	stageWrap: {
		width: ART_SIZE.stage,
		height: ART_SIZE.stage,
		alignItems: "center",
		justifyContent: "center",
	},
	groundShadow: {
		position: "absolute",
		bottom: 0,
		borderRadius: RADII.pill,
		backgroundColor: TINT.well,
	},
	emptySeat: { alignItems: "center", justifyContent: "center" },
	emptyFace: { opacity: OPACITY.ghost },
	mud: { position: "absolute" },
	held: { position: "absolute" },
	heldLeft: { right: 0 },
	heldRight: { left: 0 },
	sealed: { position: "absolute" },
	sealedChip: { flexDirection: "row", alignItems: "center", gap: SPACE.xxs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs },
	ball: { position: "absolute", left: 0, top: 0 },
	landing: { position: "absolute" },
	scoreWrap: { flexShrink: 1, minWidth: 0 },
	score: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
	},
	scoreName: { flexShrink: 1 },
});
