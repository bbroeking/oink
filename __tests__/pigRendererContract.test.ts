import {
	PIG_ANIMATION_SPECS,
	PIG_REST_FPS,
	pigAnchorAnimation,
	pigAnimationDurationMs,
	resolveRestingAnimation,
} from "../components/ui/pigRendererContract";

describe("pig renderer contract", () => {
	test("locks the shared authored animation set", () => {
		expect(Object.keys(PIG_ANIMATION_SPECS)).toEqual([
			"idle",
			"sit",
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
			const authoredName = pigAnchorAnimation(animation as keyof typeof PIG_ANIMATION_SPECS);
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

	test("the seated rest rides the happy family at the rest tempo", () => {
		expect(pigAnchorAnimation("sit")).toBe("happy");
		expect(pigAnchorAnimation("bounce")).toBe("jump");
		expect(pigAnchorAnimation("wave")).toBe("wave");
		expect(PIG_ANIMATION_SPECS.sit.fps).toBe(PIG_REST_FPS);
		expect(PIG_ANIMATION_SPECS.idle.fps).toBe(PIG_REST_FPS);
		expect(PIG_ANIMATION_SPECS.sit.loop).toBe(true);
		// At least two distinct drawings in the loop, and the eyes-open pose
		// (frame 0) is where Reduce Motion rests.
		const played = new Set(PIG_ANIMATION_SPECS.sit.playback);
		expect(played.size).toBeGreaterThanOrEqual(2);
		expect(PIG_ANIMATION_SPECS.sit.playback?.[0]).toBe(0);
		expect(pigAnimationDurationMs("sit")).toBe(4000);
	});

	test("a seated surface replaces only a standing idle", () => {
		expect(resolveRestingAnimation("sit", "idle")).toBe("sit");
		expect(resolveRestingAnimation("sit", "idle", "content")).toBe("sit");
		expect(resolveRestingAnimation("sit", "idle", "sad")).toBe("idle");
		expect(resolveRestingAnimation("sit", "idle", "tired")).toBe("idle");
		expect(resolveRestingAnimation("sit", "bounce", "content")).toBe("bounce");
		expect(resolveRestingAnimation("stand", "idle", "content")).toBe("idle");
	});
});
