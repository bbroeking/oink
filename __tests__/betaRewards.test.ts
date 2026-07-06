// Beta founder rewards — pure mirrors of grant_beta_rewards()
// (supabase/migrations/20260704400000_beta_rewards.sql). If a value changes
// server-side, change utils/betaRewards.ts too — these tests pin the pairing.

import {
	betaTierForRank,
	qualifiesForBeta,
	betaRewardChips,
	BETA_TIER_SNOUTS,
	BETA_TIER_TITLE,
	BETA_TIER_LINE,
	BETA_FOUNDER_RIBBON_ID,
	BETA_FOUNDER_RIBBON_RARITY,
	BETA_FOUNDING_HERD_TITLE,
} from "../utils/betaRewards";

describe("betaTierForRank", () => {
	it("maps the podium exactly like the server CASE", () => {
		expect(betaTierForRank(1)).toBe("snoutfather");
		expect(betaTierForRank(2)).toBe("bog_royalty");
		expect(betaTierForRank(3)).toBe("bog_royalty");
		expect(betaTierForRank(4)).toBe("trough_table");
		expect(betaTierForRank(10)).toBe("trough_table");
		expect(betaTierForRank(11)).toBe("founding_herd");
		expect(betaTierForRank(999)).toBe("founding_herd");
	});

	it("unranked (admin/test-excluded) accounts land in founding_herd", () => {
		expect(betaTierForRank(null)).toBe("founding_herd");
	});
});

describe("qualifiesForBeta", () => {
	const base = {
		username: "rosie",
		ticklesEarned: 42,
		hideFromLeaderboard: false,
	};

	it("accepts a named, playing, visible profile", () => {
		expect(qualifiesForBeta(base)).toBe(true);
	});

	it("rejects unnamed profiles (mirrors the finale loop)", () => {
		expect(qualifiesForBeta({ ...base, username: null })).toBe(false);
		expect(qualifiesForBeta({ ...base, username: "" })).toBe(false);
	});

	it("requires meaningful play (any lifetime tickle)", () => {
		expect(qualifiesForBeta({ ...base, ticklesEarned: 0 })).toBe(false);
		expect(qualifiesForBeta({ ...base, ticklesEarned: null })).toBe(false);
		expect(qualifiesForBeta({ ...base, ticklesEarned: 1 })).toBe(true);
	});

	it("excludes hidden demo/junk accounts", () => {
		expect(qualifiesForBeta({ ...base, hideFromLeaderboard: true })).toBe(false);
	});
});

describe("tier metadata", () => {
	it("snouts mirror the server amounts", () => {
		expect(BETA_TIER_SNOUTS).toEqual({
			snoutfather: 1000,
			bog_royalty: 750,
			trough_table: 500,
			founding_herd: 250,
		});
	});

	it("every tier has a modal line", () => {
		(Object.keys(BETA_TIER_SNOUTS) as Array<keyof typeof BETA_TIER_LINE>).forEach(
			(tier) => {
				expect(BETA_TIER_LINE[tier]).toBeTruthy();
			}
		);
	});
});

describe("betaRewardChips", () => {
	it("founding-herd tier: base title + ribbon + snouts, no duplicate title", () => {
		const chips = betaRewardChips({
			titleName: BETA_TIER_TITLE.founding_herd, // "Founding Herd"
			snouts: BETA_TIER_SNOUTS.founding_herd,
		});
		expect(chips.map((c) => c.kind)).toEqual(["title", "cosmetic", "snouts"]);
		// Exactly one title chip — the rank title equals the base title, so it
		// must NOT be added twice.
		expect(chips.filter((c) => c.kind === "title")).toHaveLength(1);
		expect(chips[0].label).toBe(BETA_FOUNDING_HERD_TITLE);
	});

	it("podium/top tiers carry the rank title FIRST, then the base title", () => {
		const chips = betaRewardChips({
			titleName: BETA_TIER_TITLE.snoutfather, // "Snoutfather"
			snouts: BETA_TIER_SNOUTS.snoutfather,
		});
		expect(chips.map((c) => c.kind)).toEqual([
			"title",
			"title",
			"cosmetic",
			"snouts",
		]);
		expect(chips[0].label).toBe("Snoutfather");
		expect(chips[1].label).toBe(BETA_FOUNDING_HERD_TITLE);
	});

	it.each([
		["bog_royalty", "Bog Royalty", 4],
		["trough_table", "Of the Trough Table", 4],
	] as const)(
		"%s gets its rank title on top (4 chips)",
		(tier, title, count) => {
			const chips = betaRewardChips({
				titleName: BETA_TIER_TITLE[tier],
				snouts: BETA_TIER_SNOUTS[tier],
			});
			expect(chips).toHaveLength(count);
			expect(chips[0].label).toBe(title);
		}
	);

	it("the cosmetic chip carries the ribbon id + rarity for the art lookup", () => {
		const chips = betaRewardChips({ titleName: null, snouts: 250 });
		const cosmetic = chips.find((c) => c.kind === "cosmetic");
		expect(cosmetic).toBeDefined();
		expect(cosmetic?.hatId).toBe(BETA_FOUNDER_RIBBON_ID);
		expect(cosmetic?.rarity).toBe(BETA_FOUNDER_RIBBON_RARITY);
		expect(cosmetic?.glyph).toBe("bow");
	});

	it("snouts chip is always LAST and carries the numeric amount", () => {
		const chips = betaRewardChips({ titleName: "Snoutfather", snouts: 1000 });
		const last = chips[chips.length - 1];
		expect(last.kind).toBe("snouts");
		expect(last.amount).toBe(1000);
		expect(last.label).toBe("1000 snouts");
	});

	it("a null title (unranked participant) still yields the base three chips", () => {
		const chips = betaRewardChips({ titleName: null, snouts: 250 });
		expect(chips.map((c) => c.kind)).toEqual(["title", "cosmetic", "snouts"]);
	});
});
