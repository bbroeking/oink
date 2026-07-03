// Beta founder rewards — pure mirrors of grant_beta_rewards()
// (supabase/migrations/20260704400000_beta_rewards.sql). If a value changes
// server-side, change utils/betaRewards.ts too — these tests pin the pairing.

import {
	betaTierForRank,
	qualifiesForBeta,
	BETA_TIER_SNOUTS,
	BETA_TIER_LINE,
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
