import {
	BARN_DRAW_TUNING,
	FEATURED_COLLECTION_COUNT,
	featuredCollectionIndex,
	parseBarnDrawTuning,
	parseBarnPrize,
	parseHerdPrizeState,
	parseTroughRewardState,
} from "@/utils/barnDraw";

describe("Barn draw — the featured-collection rotation", () => {
	it("starts the ladder at the 2026-09-14 epoch and steps one collection a week", () => {
		expect(featuredCollectionIndex("20260914")).toBe(0);
		expect(featuredCollectionIndex("20260921")).toBe(1);
		expect(featuredCollectionIndex("20260928")).toBe(2);
		expect(featuredCollectionIndex("20261109")).toBe(8);
		expect(featuredCollectionIndex("20261116")).toBe(9);
	});

	it("wraps after ten weeks, the way the server's modulo does", () => {
		expect(featuredCollectionIndex("20261123")).toBe(0);
		expect(featuredCollectionIndex("20261130")).toBe(1);
	});

	it("wraps a pre-epoch week upward instead of going negative", () => {
		// Postgres' `-1 % 10` is -1; both sides take ((w % n) + n) % n.
		expect(featuredCollectionIndex("20260907")).toBe(9);
		expect(featuredCollectionIndex("20260831")).toBe(8);
		expect(featuredCollectionIndex("20260706")).toBe(0);
	});

	it("always lands inside the ladder, and shrugs off a malformed key", () => {
		for (const key of ["20260406", "20270301", "20251229", "20260914"]) {
			const i = featuredCollectionIndex(key);
			expect(i).toBeGreaterThanOrEqual(0);
			expect(i).toBeLessThan(FEATURED_COLLECTION_COUNT);
		}
		expect(featuredCollectionIndex("")).toBe(0);
		expect(featuredCollectionIndex("not-a-week")).toBe(0);
	});
});

describe("Barn draw — the compiled tuning fallback", () => {
	it("mirrors app_settings.barn_draw: 60 / 28 / 12", () => {
		expect(BARN_DRAW_TUNING.tiers).toEqual([
			{ tier: "common", weight: 60 },
			{ tier: "uncommon", weight: 28 },
			{ tier: "rare", weight: 12 },
		]);
	});

	it("takes the server's weights, and falls back on a partial row", () => {
		expect(
			parseBarnDrawTuning({
				tiers: [
					{ tier: "common", weight: 50 },
					{ tier: "uncommon", weight: 30 },
					{ tier: "rare", weight: 20 },
				],
			}).tiers,
		).toEqual([
			{ tier: "common", weight: 50 },
			{ tier: "uncommon", weight: 30 },
			{ tier: "rare", weight: 20 },
		]);
		expect(parseBarnDrawTuning({ tiers: [{ tier: "common", weight: 1 }] }).tiers).toEqual(
			BARN_DRAW_TUNING.tiers,
		);
		expect(parseBarnDrawTuning(null).tiers).toEqual(BARN_DRAW_TUNING.tiers);
	});
});

describe("Barn draw — payload parsing", () => {
	it("reads a herd prize with its seed and entrant list", () => {
		const state = parseHerdPrizeState({
			ok: true,
			week: { cycle_key: "20260413", seed_hash: "abc123" },
			last: {
				cycle_key: "20260406",
				seed: "seed-value",
				crew_id: "crew-1",
				winner_user_id: "user-2",
				winner_name: "Rosie",
				kind: "habitat",
				item_id: "cider_jug_lamp",
				item_name: "Cider Jug Lamp",
				amount: 0,
				entrants: ["user-1", "user-2"],
			},
		});
		expect(state.week).toEqual({ cycleKey: "20260413", seedHash: "abc123" });
		expect(state.last?.winnerName).toBe("Rosie");
		expect(state.last?.entrants).toEqual(["user-1", "user-2"]);
		expect(state.last?.kind).toBe("habitat");
	});

	it("carries a null last draw for a crewless caller", () => {
		const state = parseHerdPrizeState({
			ok: true,
			week: { cycle_key: "20260413", seed_hash: null },
			last: null,
		});
		expect(state.last).toBeNull();
		expect(state.week.seedHash).toBeNull();
	});

	it("reads the Trough giver's weekly state, taken and untaken", () => {
		expect(
			parseTroughRewardState({ ok: true, cycle_key: "20260406", taken: false, reward: null }),
		).toEqual({ cycleKey: "20260406", taken: false, reward: null });
		expect(
			parseTroughRewardState({
				ok: true,
				cycle_key: "20260406",
				taken: true,
				reward: { kind: "tickles", item_id: null, item_name: null, amount: 60 },
			}).reward,
		).toEqual({ kind: "tickles", itemId: null, itemName: null, amount: 60 });
	});

	it("refuses a prize with no honest kind", () => {
		expect(parseBarnPrize(null)).toBeNull();
		expect(parseBarnPrize({ kind: "mystery" })).toBeNull();
		expect(parseBarnPrize({ kind: "habitat", item_id: "x", item_name: "X" })).toEqual({
			kind: "habitat",
			itemId: "x",
			itemName: "X",
			amount: 0,
		});
	});
});
