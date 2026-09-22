import {
	WALLOW_AURA_STAGES_DRAWN,
	WALLOW_CLOCK_CAP_RANK,
	WALLOW_KEEPSAKE_RANKS_DRAWN,
	WALLOW_MAX_POWER_LEVEL,
	WALLOW_REGALIA,
	WALLOW_REGALIA_COUNT,
	WALLOW_REGEN_STEP_PCT,
	canWallow,
	wallowAuraArtStage,
	wallowAuraStage,
	wallowCycleXp,
	wallowNextPrizeLabel,
	wallowPowerLevel,
	wallowProgress,
	wallowRegaliaOwned,
	wallowRegenMultiplier,
	wallowRegenPercent,
	wallowRegenSeconds,
	wallowRankLabel,
	wallowRankPrize,
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

// The ladder never ends (docs/prestige-wallow-spec.md, 2026-09-22). Every rule
// here is a rule over an unbounded integer: there is no rank these functions
// stop answering for, and no rank that answers "nothing".
describe("the Wallow ladder", () => {
	it("gives ranks one through six one wearable slot each, worn together", () => {
		expect(WALLOW_REGALIA_COUNT).toBe(6);
		expect(WALLOW_CLOCK_CAP_RANK).toBe(6);
		expect(Object.keys(WALLOW_REGALIA)).toEqual(["1", "2", "3", "4", "5", "6"]);
		expect(WALLOW_REGALIA[3]).toEqual({
			hatId: "wallow_marsh_crown",
			name: "Marsh Wreath",
			slot: "necklace",
		});
		// Five slots plus the aura: only the head is worn twice, and the crown
		// replaces the cap there.
		expect(Object.values(WALLOW_REGALIA).map((p) => p.slot)).toEqual([
			"hat",
			"glasses",
			"necklace",
			"bow",
			"held",
			"hat",
		]);
		expect(wallowRegaliaOwned(0)).toBe(0);
		expect(wallowRegaliaOwned(4)).toBe(4);
		expect(wallowRegaliaOwned(41)).toBe(6);
	});

	it("advances the aura every rank to five, then every third rank forever", () => {
		expect(WALLOW_AURA_STAGES_DRAWN).toBe(5);
		expect(wallowAuraStage(0)).toBe(0);
		expect([1, 2, 3, 4, 5].map(wallowAuraStage)).toEqual([1, 2, 3, 4, 5]);
		expect(wallowAuraStage(6)).toBe(5);
		expect(wallowAuraStage(7)).toBe(5);
		expect(wallowAuraStage(8)).toBe(6);
		expect(wallowAuraStage(11)).toBe(7);
		expect(wallowAuraStage(14)).toBe(8);
		expect(wallowAuraStage(100)).toBe(36);
	});

	it("holds the last drawn ring for stages whose art has not landed", () => {
		expect(wallowAuraArtStage(4)).toBe(4);
		expect(wallowAuraArtStage(8)).toBe(5);
		expect(wallowAuraArtStage(100)).toBe(5);
	});

	it("pays nothing before the first Wallow", () => {
		expect(wallowRankPrize(0)).toBeNull();
		expect(wallowRankPrize(-3)).toBeNull();
	});

	it("marks the clock capped on the rung that caps it", () => {
		const six = wallowRankPrize(6);
		expect(six).toMatchObject({
			kind: "regalia",
			hatId: "wallow_sovereign_crown",
			label: "Wallow Sovereign Crown",
			note: "your clock is at full blaze",
		});
		expect(wallowRankPrize(5)).not.toHaveProperty("note");
	});

	// W6 → W16, the whole shape of the endless chapter in one list.
	it("walks W6 through W16 by the server's rule order", () => {
		const kinds = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(
			(rank) => wallowRankPrize(rank)?.kind,
		);
		expect(kinds).toEqual([
			"regalia", // 6 · the set completes
			"truffles", // 7
			"aura", // 8 · every third rank from here
			"truffles", // 9
			"keepsake", // 10 · Celestial
			"aura", // 11
			"truffles", // 12
			"truffles", // 13
			"aura", // 14
			"truffles", // 15 · a keepsake rank with no frame drawn yet
			"truffles", // 16
		]);
	});

	it("falls a keepsake rank through to a real prize until its frame is drawn", () => {
		expect(WALLOW_KEEPSAKE_RANKS_DRAWN).toEqual([1, 3, 6, 10]);
		expect(wallowRankPrize(10)).toEqual({
			kind: "keepsake",
			label: "Celestial keepsake",
			frame: "Celestial",
			frameRank: 10,
		});
		// W15 is a keepsake rank with no frame — it pays truffles rather than
		// nothing, and W20 (also a keepsake rank) falls through to the aura.
		expect(wallowRankPrize(15)).toEqual({
			kind: "truffles",
			label: "2 Golden Truffles · 1 Mote",
			truffles: 2,
			motes: 1,
		});
		expect(wallowRankPrize(20)).toMatchObject({ kind: "aura", stage: 10 });
	});

	it("names the next rank's prize for the one-line rows", () => {
		expect(wallowNextPrizeLabel(0)).toBe("Rookie Wallow Cap");
		expect(wallowNextPrizeLabel(5)).toBe("Wallow Sovereign Crown");
		expect(wallowNextPrizeLabel(7)).toBe("a new aura stage");
		expect(wallowNextPrizeLabel(9)).toBe("Celestial keepsake");
		expect(wallowNextPrizeLabel(11)).toBe("2 Golden Truffles · 1 Mote");
	});
});
