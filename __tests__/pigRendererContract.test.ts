import {
	PIG_ANIMATION_SPECS,
	pigAnimationDurationMs,
} from "../components/ui/pigRendererContract";

describe("pig renderer contract", () => {
	test("locks the shared authored animation set", () => {
		expect(Object.keys(PIG_ANIMATION_SPECS)).toEqual([
			"idle",
			"walk",
			"jump",
			"bounce",
			"happy",
			"sad",
			"tired",
			"surprise",
			"wave",
		]);
	});

	test("every renderer receives the same four-frame animation keys", () => {
		for (const [animation, spec] of Object.entries(PIG_ANIMATION_SPECS)) {
			expect(spec.frames).toHaveLength(4);
			const authoredName = animation === "bounce" ? "jump" : animation;
			expect(spec.frames).toEqual([
				`${authoredName}_1`,
				`${authoredName}_2`,
				`${authoredName}_3`,
				`${authoredName}_4`,
			]);
		}
	});

	test("keeps reaction completion timing renderer-neutral", () => {
		expect(pigAnimationDurationMs("jump")).toBe(667);
		expect(pigAnimationDurationMs("surprise")).toBe(667);
		expect(pigAnimationDurationMs("idle")).toBe(1600);
	});
});
