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
	// The original idle art alternates standing and splayed-leg poses. That
	// exposes/hides the far rear hoof on every tick. Hold the two matching
	// standing poses for 800 ms each, preserving the 1600 ms idle cycle.
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], playback: [1, 1, 3, 3], fps: PIG_REST_FPS, loop: true },
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

export function pigAnimationDurationMs(animation: PigAnimation): number {
	const spec = PIG_ANIMATION_SPECS[animation] ?? PIG_ANIMATION_SPECS.idle;
	return Math.round(((spec.playback?.length ?? spec.frames.length) / spec.fps) * 1000);
}
