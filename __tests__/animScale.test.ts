import { ANIM_SCALE } from "@/constants/animScale.generated";

describe("animation scale guardrails", () => {
	it("keeps idle as the pose-normalization baseline", () => {
		expect(ANIM_SCALE.idle).toBe(1);
	});
});
