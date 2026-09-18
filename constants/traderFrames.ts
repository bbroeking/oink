// The Ghost Sheep Trader's sprite families — five 4-frame sheets from one
// Codex ImageGen lane off art A (2026-09-17), keyed and sliced onto one shared
// 384² box (the character floats, so the box is the union of every frame's
// bbox rather than a ground line). `leave` keeps only its two painted frames:
// the fade was painted into the magenta and is done in code instead.
//
// Not a pig family: never registered in pigFramesExtra / PIG_FRAME_ANCHORS.
// The trader wears nothing and never passes through PigStage.
import type { ImageSourcePropType } from "react-native";

export type TraderAnim = "idle" | "greet" | "take" | "shake" | "leave";

export const TRADER_FRAMES: Readonly<Record<TraderAnim, readonly ImageSourcePropType[]>> = {
	// breath in / hold (ear twitch) / breath out — loops while he is on screen
	idle: [
		require("../assets/images/trader/anim/idle_1.png"),
		require("../assets/images/trader/anim/idle_2.png"),
		require("../assets/images/trader/anim/idle_3.png"),
		require("../assets/images/trader/anim/idle_4.png"),
	],
	// a nod, a paw raised palm-open — the sheet opening
	greet: [
		require("../assets/images/trader/anim/greet_1.png"),
		require("../assets/images/trader/anim/greet_2.png"),
		require("../assets/images/trader/anim/greet_3.png"),
		require("../assets/images/trader/anim/greet_4.png"),
	],
	// paw out → closes → tucks into the satchel → a satisfied dip — a sale
	take: [
		require("../assets/images/trader/anim/take_1.png"),
		require("../assets/images/trader/anim/take_2.png"),
		require("../assets/images/trader/anim/take_3.png"),
		require("../assets/images/trader/anim/take_4.png"),
	],
	// a slow "no" — a refusal (had enough, not in the bag)
	shake: [
		require("../assets/images/trader/anim/shake_1.png"),
		require("../assets/images/trader/anim/shake_2.png"),
		require("../assets/images/trader/anim/shake_3.png"),
		require("../assets/images/trader/anim/shake_4.png"),
	],
	// turns to the right and drifts off (the fade is code) — packing up
	leave: [
		require("../assets/images/trader/anim/leave_1.png"),
		require("../assets/images/trader/anim/leave_2.png"),
	],
};

/** Milliseconds per frame, per family — the idle breathes, the beats land. */
export const TRADER_FRAME_MS: Readonly<Record<TraderAnim, number>> = {
	idle: 420,
	greet: 180,
	take: 170,
	shake: 200,
	leave: 260,
};

/** Families that play once and hand back to `idle`. */
export const TRADER_ONE_SHOT: ReadonlySet<TraderAnim> = new Set<TraderAnim>(["greet", "take", "shake", "leave"]);
