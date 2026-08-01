import {
	WALLOW_MAX_POWER_LEVEL,
	WALLOW_REGEN_STEP_PCT,
	canWallow,
	wallowCycleXp,
	wallowPowerLevel,
	wallowProgress,
	wallowRegenMultiplier,
	wallowRegenPercent,
	wallowRegenSeconds,
	wallowRankLabel,
	wallowVisitCooldownHours,
	wallowWaitReductionLabel,
	xpInWallow,
} from "@/utils/wallow";

describe("Wallow prestige math", () => {
	const cycle = wallowCycleXp(30, 100);

	it("makes one pass a 3,000 XP lap", () => {
		expect(cycle).toBe(3000);
	});

	it("accelerates sharply twice, then by five points to a seventy-percent cap", () => {
		expect(WALLOW_REGEN_STEP_PCT).toBe(25);
		expect(wallowRegenPercent(1)).toBe(25);
		expect(wallowRegenPercent(2)).toBe(50);
		expect(wallowRegenPercent(3)).toBe(55);
		expect(wallowRegenPercent(6)).toBe(70);
		expect(wallowRegenPercent(99)).toBe(70);
		expect(wallowRegenMultiplier(1)).toBe(0.75);
		expect(wallowRegenSeconds(5)).toBe(1260);
	});

	it("caps clock power at W6 while lifetime rank keeps rising", () => {
		expect(WALLOW_MAX_POWER_LEVEL).toBe(6);
		expect(wallowPowerLevel(1)).toBe(1);
		expect(wallowPowerLevel(99)).toBe(6);
		expect(wallowPowerLevel(-2)).toBe(0);
		expect(wallowRankLabel(7)).toBe("Wallow Rank 7");
	});

	it("steps visit cadence from eight hours to a three-hour floor", () => {
		expect(wallowVisitCooldownHours(0)).toBe(8);
		expect(wallowVisitCooldownHours(1)).toBe(7);
		expect(wallowVisitCooldownHours(5)).toBe(3);
		expect(wallowVisitCooldownHours(99)).toBe(3);
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

	it("does not call the final tier Wallow-ready before the lap is complete", () => {
		expect(
			wallowProgress({
				xp: 2900,
				xpPerTier: 100,
				currentTier: 30,
				totalTiers: 30,
				canWallow: false,
				prestigeMode: false,
			})
		).toEqual({ fraction: 0, label: "100 XP left to Wallow" });
		expect(
			wallowProgress({
				xp: 2999,
				xpPerTier: 100,
				currentTier: 30,
				totalTiers: 30,
				canWallow: false,
				prestigeMode: false,
			})
		).toEqual({ fraction: 0.99, label: "1 XP left to Wallow" });
		expect(
			wallowProgress({
				xp: 3000,
				xpPerTier: 100,
				currentTier: 30,
				totalTiers: 30,
				canWallow: true,
				prestigeMode: false,
			})
		).toEqual({ fraction: 1, label: "Ready to Wallow ★" });
	});

	it("describes the clock effect as a wait reduction, not a rate increase", () => {
		expect(wallowWaitReductionLabel(25)).toBe("wait reduced by 25%");
		expect(wallowWaitReductionLabel(70)).toBe("wait reduced by 70%");
	});

	it("guards malformed negative inputs", () => {
		expect(xpInWallow(-10, -2, 0)).toBe(0);
		expect(wallowCycleXp(0, 0)).toBe(1);
	});
});
