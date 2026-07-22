import {
	WALLOW_MAX_POWER_LEVEL,
	WALLOW_REGEN_STEP_PCT,
	canWallow,
	wallowCycleXp,
	wallowPowerLevel,
	wallowRegenMultiplier,
	wallowRegenPercent,
	wallowRankLabel,
	xpInWallow,
} from "@/utils/wallow";

describe("Wallow prestige math", () => {
	const cycle = wallowCycleXp(30, 100);

	it("makes one pass a 3,000 XP lap", () => {
		expect(cycle).toBe(3000);
	});

	it("accelerates regen by twenty-five percent per power rank", () => {
		expect(WALLOW_REGEN_STEP_PCT).toBe(25);
		expect(wallowRegenPercent(1)).toBe(25);
		expect(wallowRegenPercent(2)).toBe(50);
		expect(wallowRegenMultiplier(1)).toBe(0.75);
	});

	it("caps competitive power after two Wallows while rank keeps rising", () => {
		expect(WALLOW_MAX_POWER_LEVEL).toBe(2);
		expect(wallowPowerLevel(1)).toBe(1);
		expect(wallowPowerLevel(99)).toBe(2);
		expect(wallowRegenPercent(99)).toBe(50);
		expect(wallowPowerLevel(-2)).toBe(0);
		expect(wallowRankLabel(7)).toBe("Wallow Rank 7");
	});

	it("preserves overflow instead of throwing activity away", () => {
		expect(xpInWallow(3275, 1, cycle)).toBe(275);
	});

	it("allows exactly one prestige per earned pass", () => {
		expect(canWallow(2999, 0, cycle)).toBe(false);
		expect(canWallow(3000, 0, cycle)).toBe(true);
		expect(canWallow(5999, 1, cycle)).toBe(false);
		expect(canWallow(6000, 1, cycle)).toBe(true);
	});

	it("guards malformed negative inputs", () => {
		expect(xpInWallow(-10, -2, 0)).toBe(0);
		expect(wallowCycleXp(0, 0)).toBe(1);
	});
});
