/* eslint-disable @typescript-eslint/no-require-imports */
// Frames beyond the four-frame rig `pigFrames.generated.ts` knows about. The
// generator re-extracts the recruits from their authored 4x4 sheets, so the
// twelve-frame idles are registered here instead of by re-running it.
//
// Twelve-frame idles (2026-09-13): one Codex ImageGen sheet per pig — a 4x3
// grid of a breathing, weight-shifting stand with a blink and a tail flick —
// magenta-keyed and fitted onto the sprite canvas by
// scripts/pig-tweens/slice_sheet.py. Prompts and sheets live in
// docs/reviews/pig-animations-2026-09-13/.
//
// Facing frames (2026-09-15): one 4x2 sheet per pig — a three-quarter turn
// toward the viewer's right, standing (face_1..4) and seated (face_sit_1..4),
// rest / breath in / blink / breath out — sliced by
// scripts/pig-tweens/slice_face_sheet.py. Sheets and prompts in
// docs/reviews/pig-facing-2026-09-15/. PigStage mirrors them for a pig that
// faces left.
import type { PigId } from "@/utils/pigs";

export const PIG_FRAMES_EXTRA: Partial<Record<PigId, Record<string, number>>> = {
	rosie: {
		idle_5: require("../assets/images/sprites/rosie/idle_5.png"),
		idle_6: require("../assets/images/sprites/rosie/idle_6.png"),
		idle_7: require("../assets/images/sprites/rosie/idle_7.png"),
		idle_8: require("../assets/images/sprites/rosie/idle_8.png"),
		idle_9: require("../assets/images/sprites/rosie/idle_9.png"),
		idle_10: require("../assets/images/sprites/rosie/idle_10.png"),
		idle_11: require("../assets/images/sprites/rosie/idle_11.png"),
		idle_12: require("../assets/images/sprites/rosie/idle_12.png"),
		face_1: require("../assets/images/sprites/rosie/face_1.png"),
		face_2: require("../assets/images/sprites/rosie/face_2.png"),
		face_3: require("../assets/images/sprites/rosie/face_3.png"),
		face_4: require("../assets/images/sprites/rosie/face_4.png"),
		face_sit_1: require("../assets/images/sprites/rosie/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/rosie/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/rosie/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/rosie/face_sit_4.png"),
	},
	copper: {
		idle_5: require("../assets/images/sprites/copper/idle_5.png"),
		idle_6: require("../assets/images/sprites/copper/idle_6.png"),
		idle_7: require("../assets/images/sprites/copper/idle_7.png"),
		idle_8: require("../assets/images/sprites/copper/idle_8.png"),
		idle_9: require("../assets/images/sprites/copper/idle_9.png"),
		idle_10: require("../assets/images/sprites/copper/idle_10.png"),
		idle_11: require("../assets/images/sprites/copper/idle_11.png"),
		idle_12: require("../assets/images/sprites/copper/idle_12.png"),
		face_1: require("../assets/images/sprites/copper/face_1.png"),
		face_2: require("../assets/images/sprites/copper/face_2.png"),
		face_3: require("../assets/images/sprites/copper/face_3.png"),
		face_4: require("../assets/images/sprites/copper/face_4.png"),
		face_sit_1: require("../assets/images/sprites/copper/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/copper/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/copper/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/copper/face_sit_4.png"),
	},
	pepper: {
		idle_5: require("../assets/images/sprites/pepper/idle_5.png"),
		idle_6: require("../assets/images/sprites/pepper/idle_6.png"),
		idle_7: require("../assets/images/sprites/pepper/idle_7.png"),
		idle_8: require("../assets/images/sprites/pepper/idle_8.png"),
		idle_9: require("../assets/images/sprites/pepper/idle_9.png"),
		idle_10: require("../assets/images/sprites/pepper/idle_10.png"),
		idle_11: require("../assets/images/sprites/pepper/idle_11.png"),
		idle_12: require("../assets/images/sprites/pepper/idle_12.png"),
		face_1: require("../assets/images/sprites/pepper/face_1.png"),
		face_2: require("../assets/images/sprites/pepper/face_2.png"),
		face_3: require("../assets/images/sprites/pepper/face_3.png"),
		face_4: require("../assets/images/sprites/pepper/face_4.png"),
		face_sit_1: require("../assets/images/sprites/pepper/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/pepper/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/pepper/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/pepper/face_sit_4.png"),
	},
	biscuit: {
		idle_5: require("../assets/images/sprites/biscuit/idle_5.png"),
		idle_6: require("../assets/images/sprites/biscuit/idle_6.png"),
		idle_7: require("../assets/images/sprites/biscuit/idle_7.png"),
		idle_8: require("../assets/images/sprites/biscuit/idle_8.png"),
		idle_9: require("../assets/images/sprites/biscuit/idle_9.png"),
		idle_10: require("../assets/images/sprites/biscuit/idle_10.png"),
		idle_11: require("../assets/images/sprites/biscuit/idle_11.png"),
		idle_12: require("../assets/images/sprites/biscuit/idle_12.png"),
		face_1: require("../assets/images/sprites/biscuit/face_1.png"),
		face_2: require("../assets/images/sprites/biscuit/face_2.png"),
		face_3: require("../assets/images/sprites/biscuit/face_3.png"),
		face_4: require("../assets/images/sprites/biscuit/face_4.png"),
		face_sit_1: require("../assets/images/sprites/biscuit/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/biscuit/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/biscuit/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/biscuit/face_sit_4.png"),
	},
	pickles: {
		idle_5: require("../assets/images/sprites/pickles/idle_5.png"),
		idle_6: require("../assets/images/sprites/pickles/idle_6.png"),
		idle_7: require("../assets/images/sprites/pickles/idle_7.png"),
		idle_8: require("../assets/images/sprites/pickles/idle_8.png"),
		idle_9: require("../assets/images/sprites/pickles/idle_9.png"),
		idle_10: require("../assets/images/sprites/pickles/idle_10.png"),
		idle_11: require("../assets/images/sprites/pickles/idle_11.png"),
		idle_12: require("../assets/images/sprites/pickles/idle_12.png"),
		face_1: require("../assets/images/sprites/pickles/face_1.png"),
		face_2: require("../assets/images/sprites/pickles/face_2.png"),
		face_3: require("../assets/images/sprites/pickles/face_3.png"),
		face_4: require("../assets/images/sprites/pickles/face_4.png"),
		face_sit_1: require("../assets/images/sprites/pickles/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/pickles/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/pickles/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/pickles/face_sit_4.png"),
	},
	bandit: {
		idle_5: require("../assets/images/sprites/bandit/idle_5.png"),
		idle_6: require("../assets/images/sprites/bandit/idle_6.png"),
		idle_7: require("../assets/images/sprites/bandit/idle_7.png"),
		idle_8: require("../assets/images/sprites/bandit/idle_8.png"),
		idle_9: require("../assets/images/sprites/bandit/idle_9.png"),
		idle_10: require("../assets/images/sprites/bandit/idle_10.png"),
		idle_11: require("../assets/images/sprites/bandit/idle_11.png"),
		idle_12: require("../assets/images/sprites/bandit/idle_12.png"),
		face_1: require("../assets/images/sprites/bandit/face_1.png"),
		face_2: require("../assets/images/sprites/bandit/face_2.png"),
		face_3: require("../assets/images/sprites/bandit/face_3.png"),
		face_4: require("../assets/images/sprites/bandit/face_4.png"),
		face_sit_1: require("../assets/images/sprites/bandit/face_sit_1.png"),
		face_sit_2: require("../assets/images/sprites/bandit/face_sit_2.png"),
		face_sit_3: require("../assets/images/sprites/bandit/face_sit_3.png"),
		face_sit_4: require("../assets/images/sprites/bandit/face_sit_4.png"),
	},
};
