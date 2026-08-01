import { hungerHeroStageIndex } from "@/components/season1/HungerHero";

describe("hungerHeroStageIndex", () => {
	it("maps the six server stages one-to-one", () => {
		expect([0, 1, 2, 3, 4, 5].map(hungerHeroStageIndex)).toEqual([
			0, 1, 2, 3, 4, 5,
		]);
	});

	it("clamps naturally at the first and final beats", () => {
		expect(hungerHeroStageIndex(-1)).toBe(0);
		expect(hungerHeroStageIndex(99)).toBe(5);
	});
});
