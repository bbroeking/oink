import type { StyleProp, ViewStyle } from "react-native";
import type { PigId } from "@/utils/pigs";
import type { PigAnimationKey } from "@/constants/hat_overlay_types";

export type PigMood = "content" | "happy" | "sad" | "tired";

export type PigReactionKind = "happy" | "jump" | "surprise" | "wave";

/** A new id always interrupts/restarts, including consecutive identical taps. */
export interface PigReaction {
	id: number;
	kind: PigReactionKind;
}

// Every anchor-table animation (constants/hat_overlay_types) plus the
// render-only variants: "bounce" rides jump's frames and per-frame anchors,
// "sit" rides happy's. Derived, not re-listed, so a new anchor animation can't
// be missed here. `pigAnchorAnimation` is the one place a variant names its
// authored family.
export type PigAnimation = PigAnimationKey | "bounce" | "sit";

// A render-only variant borrows an authored family's frames AND its anchors,
// so a worn item tracks it exactly as it tracks the source animation.
export const PIG_VARIANT_SOURCE = Object.freeze({
	bounce: "jump",
	sit: "happy",
} as const satisfies Record<Exclude<PigAnimation, PigAnimationKey>, PigAnimationKey>);

export function pigAnchorAnimation(animation: PigAnimation): PigAnimationKey {
	return animation in PIG_VARIANT_SOURCE
		? PIG_VARIANT_SOURCE[animation as keyof typeof PIG_VARIANT_SOURCE]
		: (animation as PigAnimationKey);
}

// The resting tempo. Both rest loops (standing idle, seated) tick at this rate
// so a pig reads the same "alive" whether she stands on the Exterior or sits in
// her room. Reactions keep their own faster fps.
export const PIG_REST_FPS = 2.5;
// The standing idle carries three times the rig's frames in the same 1.6 s.
export const PIG_IDLE_FPS = 7.5;
// A Barn is a slower room than the yard. Its surfaces (the interior, a
// friend's visit — both spots) declare this through PigRestTempoProvider and
// every rest loop and breath inside runs at four-fifths speed: the 1.6 s idle
// becomes 2 s, the 4 s seated blink 5 s, the 3.2 s breath 4 s. Reactions keep
// their own tempo — a tickle answers at the same speed everywhere.
export const PIG_BARN_REST_TEMPO = 0.8;
const IDLE_12 = Array.from({ length: 12 }, (_, i) => `idle_${i + 1}`);
// The turned rests share one playback: a long open hold, a breath in, a
// blink, a breath out. Ten ticks at the rest fps = one 4 s cycle, the same
// cadence as the seated rest so a pair rests in step.
const FACE_PLAYBACK = [0, 0, 0, 0, 0, 1, 1, 2, 3, 3] as const;

export interface PigAnimationSpec {
	frames: readonly string[];
	/** Source-frame indices per playback tick; manual previews retain raw indices. */
	playback?: readonly number[];
	fps: number;
	loop: boolean;
}

export const PIG_ANIMATION_SPECS: Readonly<
	Record<PigAnimation, PigAnimationSpec>
> = Object.freeze({
	// The standing rest (2026-09-13): one twelve-frame ImageGen sheet per pig —
	// breathe in, weight shift with a hoof lift, blink, breathe out, shift back
	// with a tail flick — at 7.5 fps, a 1.6 s loop. Sliced onto the canvas by
	// scripts/pig-tweens/slice_sheet.py; sheets and prompts in
	// docs/reviews/pig-animations-2026-09-13/.
	idle: { frames: IDLE_12, fps: PIG_IDLE_FPS, loop: true },
	// The seated rest — the pose a pig takes inside a room. Rides the happy
	// family: four legs planted, one stable silhouette, eyes open (1, 4) and a
	// smiling squint (2, 3). At the rest tempo with a long open hold it reads
	// as sitting content and blinking, not as the 4 fps happy reaction. Frame
	// 0 (eyes open) is the Reduce Motion pose. 10 ticks = one 4 s cycle.
	sit: {
		frames: ["happy_1", "happy_2", "happy_3", "happy_4"],
		playback: [0, 0, 0, 0, 0, 0, 1, 2, 3, 3],
		fps: PIG_REST_FPS,
		loop: true,
	},
	// Facing a friend (2026-09-15): a three-quarter turn, standing and
	// seated, four frames each — rest, breath in, blink, breath out — from one
	// ImageGen sheet per pig (scripts/pig-tweens/slice_face_sheet.py; sheets
	// and prompts in docs/reviews/pig-facing-2026-09-15/). Frame 0 is the
	// Reduce Motion pose. PigStage picks these in place of idle / sit when a
	// pig is given a `facing`.
	face: { frames: ["face_1", "face_2", "face_3", "face_4"], playback: FACE_PLAYBACK, fps: PIG_REST_FPS, loop: true },
	face_sit: { frames: ["face_sit_1", "face_sit_2", "face_sit_3", "face_sit_4"], playback: FACE_PLAYBACK, fps: PIG_REST_FPS, loop: true },
	walk: { frames: ["walk_1", "walk_2", "walk_3", "walk_4"], fps: 4, loop: true },
	jump: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 6, loop: false },
	bounce: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 3, loop: true },
	happy: { frames: ["happy_1", "happy_2", "happy_3", "happy_4"], fps: 4, loop: true },
	sad: { frames: ["sad_1", "sad_2", "sad_3", "sad_4"], fps: 3, loop: true },
	tired: { frames: ["tired_1", "tired_2", "tired_3", "tired_4"], fps: 2, loop: true },
	surprise: {
		frames: ["surprise_1", "surprise_2", "surprise_3", "surprise_4"],
		fps: 6,
		loop: false,
	},
	wave: { frames: ["wave_1", "wave_2", "wave_3", "wave_4"], fps: 4, loop: true },
});

export interface PigRendererProps {
	animation: PigAnimation;
	mood?: PigMood;
	reaction?: PigReaction | null;
	/** Visibility belongs to the surface; navigation and AppState also pause it. */
	active?: boolean;
	pigId?: PigId;
	equipment?: PigEquipmentSelection;
	size?: number;
	style?: StyleProp<ViewStyle>;
	onComplete?: () => void;
	onFrame?: (idx: number) => void;
	onRendererReady?: () => void;
	onRendererError?: (error: Error) => void;
	frameIdx?: number;
	reduceMotion?: boolean;
}

export interface PigEquipmentSelection {
	headId?: string | null;
	// Bows remain raster overlays for now; supplying one forces the shared stage
	// off the Rive prototype so its anatomy anchor stays in sync.
	bowId?: string | null;
	faceId?: string | null;
	heldId?: string | null;
	maskId?: string | null;
	neckId?: string | null;
}

export function pigMoodAnimation(mood: PigMood): PigAnimation {
	if (mood === "content") return "idle";
	return mood;
}

export function resolvePigAnimation(
	animation: PigAnimation,
	mood?: PigMood,
): PigAnimation {
	return animation === "idle" && mood ? pigMoodAnimation(mood) : animation;
}

// Where a pig rests: standing (the Exterior's tickle idle) or seated (inside a
// room). A surface declares the pose; the pig takes it only when she would
// otherwise stand idle — a sad or tired mood still shows, and a reaction
// still plays.
export type PigRestingPose = "stand" | "sit";

export function resolveRestingAnimation(
	pose: PigRestingPose,
	animation: PigAnimation,
	mood?: PigMood,
): PigAnimation {
	return pose === "sit" && resolvePigAnimation(animation, mood) === "idle"
		? "sit"
		: animation;
}

// The rest loops: the pig stands or sits and breathes. Only these take a
// surface's rest tempo and the stage's breath; a reaction or a mood carries
// its own motion.
export function isPigRestAnimation(animation: PigAnimation): boolean {
	return (
		animation === "idle" ||
		animation === "sit" ||
		animation === "face" ||
		animation === "face_sit"
	);
}

// Which way a pig looks. The front families are drawn with the tail on the
// viewer's left and the head tilted left, which reads as "left"; the turned
// families are drawn looking right. PigStage mirrors the stage whenever the
// asked-for facing differs from the drawn one, so cosmetics ride the canvas
// and nothing is re-placed.
export type PigFacing = "left" | "right";

export function pigDrawnFacing(animation: PigAnimation): PigFacing {
	return animation === "face" || animation === "face_sit" ? "right" : "left";
}

// A pig given a facing turns toward it — only at rest. The standing idle
// becomes the standing turn, the seated rest the seated turn; a mood (tired,
// sad) or a reaction (a wave, a jump) still plays from the front families,
// mirrored to keep the tilt toward the friend.
export function resolveFacingAnimation(
	animation: PigAnimation,
	facing: PigFacing | undefined,
): PigAnimation {
	if (!facing) return animation;
	if (animation === "idle") return "face";
	if (animation === "sit") return "face_sit";
	return animation;
}

export function pigAnimationDurationMs(animation: PigAnimation): number {
	const spec = PIG_ANIMATION_SPECS[animation] ?? PIG_ANIMATION_SPECS.idle;
	return Math.round(((spec.playback?.length ?? spec.frames.length) / spec.fps) * 1000);
}
