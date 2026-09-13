import { isSixSevenTickleMilestone } from "@/utils/sixSeven";

describe("6–7 tickle milestone", () => {
	it.each([67, 1_067, 2_067, 10_067])(
		"celebrates an exact landing on %i tickles",
		(tickles) => {
			expect(isSixSevenTickleMilestone(tickles)).toBe(true);
		},
	);

	it.each([0, 66, 68, 167, 267, 1_066, 1_068, 2_100])(
		"does not celebrate %i tickles",
		(tickles) => {
			expect(isSixSevenTickleMilestone(tickles)).toBe(false);
		},
	);

	it("does not infer a celebration when a reward jumps over the milestone", () => {
		const before = 1_065;
		const after = before + 5;
		expect(after).toBe(1_070);
		expect(isSixSevenTickleMilestone(after)).toBe(false);
	});
});
