import type { StyleProp, ViewStyle } from "react-native";
import type { PigId } from "@/utils/pigs";

export type PigMood = "content" | "happy" | "sad" | "tired";

export type PigReactionKind = "happy" | "jump" | "surprise" | "wave";

/** A new id always interrupts/restarts, including consecutive identical taps. */
export interface PigReaction {
	id: number;
	kind: PigReactionKind;
}

export type PigAnimation =
	| "idle"
	| "walk"
	| "jump"
	| "bounce"
	| "happy"
	| "sad"
	| "tired"
	| "surprise"
	| "wave";

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
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], playback: [1, 1, 3, 3], fps: 2.5, loop: true },
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

export function pigAnimationDurationMs(animation: PigAnimation): number {
	const spec = PIG_ANIMATION_SPECS[animation] ?? PIG_ANIMATION_SPECS.idle;
	return Math.round(((spec.playback?.length ?? spec.frames.length) / spec.fps) * 1000);
}
