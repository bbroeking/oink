import type { StyleProp, ViewStyle } from "react-native";
import type { PigId } from "@/utils/pigs";

export type PigMood = "content" | "happy" | "sad" | "tired";

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
	fps: number;
	loop: boolean;
}

export const PIG_ANIMATION_SPECS: Readonly<
	Record<PigAnimation, PigAnimationSpec>
> = Object.freeze({
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], fps: 2.5, loop: true },
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
	return Math.round((spec.frames.length / spec.fps) * 1000);
}
