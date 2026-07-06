// Beta founder rewards — pure client mirrors of the grant logic in
// supabase/migrations/20260704400000_beta_rewards.sql (the server is the
// authority; these exist for the SeasonEndModal copy + tests).
// Design: docs/wiki/outputs/memos/beta-rewards-season-end-2026-07.md

export type BetaTier =
	| "snoutfather"
	| "bog_royalty"
	| "trough_table"
	| "founding_herd";

// Mirror of the rank→tier CASE in grant_beta_rewards(). A NULL rank means
// the account was excluded from ranking (admin/test) but still qualifies
// as a participant.
export function betaTierForRank(rank: number | null): BetaTier {
	if (rank === 1) return "snoutfather";
	if (rank !== null && rank <= 3) return "bog_royalty";
	if (rank !== null && rank <= 10) return "trough_table";
	return "founding_herd";
}

// Mirror of the qualifier WHERE clause (named profile + any lifetime play +
// not a hidden demo/junk account).
export function qualifiesForBeta(p: {
	username: string | null;
	ticklesEarned: number | null;
	hideFromLeaderboard: boolean;
}): boolean {
	return (
		!!p.username &&
		p.username !== "" &&
		(p.ticklesEarned ?? 0) > 0 &&
		!p.hideFromLeaderboard
	);
}

// The modal's rank-band line, in the season voice (matches the announcement
// copy minted server-side).
export const BETA_TIER_LINE: Record<BetaTier, string> = {
	snoutfather:
		"No snout dug deeper than yours. The whole bog knows your name.",
	bog_royalty: "You finished among the top three of the founding herd.",
	trough_table: "You earned a seat at the trough table — top ten of the herd.",
	founding_herd: "You were here before the gates opened. The bog remembers.",
};

// Snouts per tier — mirror of the server amounts.
export const BETA_TIER_SNOUTS: Record<BetaTier, number> = {
	snoutfather: 1000,
	bog_royalty: 750,
	trough_table: 500,
	founding_herd: 250,
};

// The tier's rank title name (mirrors the titles INSERT in the migration). The
// server resolves title_id → name for my_beta_reward(); this mirror lets the
// dev preview + tests build a grant without a round-trip.
export const BETA_TIER_TITLE: Record<BetaTier, string> = {
	snoutfather: "Snoutfather",
	bog_royalty: "Bog Royalty",
	trough_table: "Of the Trough Table",
	founding_herd: "Founding Herd",
};

// The base title + cosmetic every founder earns (mirrors grant_beta_rewards():
// everyone gets beta_founding_herd + the ribbon; podium/top tiers get their
// rank title on top). Kept in sync with the migration by betaRewards.test.ts.
export const BETA_FOUNDING_HERD_TITLE = "Founding Herd";
export const BETA_FOUNDER_RIBBON_ID = "beta_founder_ribbon";
export const BETA_FOUNDER_RIBBON_NAME = "Founder's Mud Ribbon";
export const BETA_FOUNDER_RIBBON_RARITY = "legendary";

// One earned reward, rendered as a chip in the founder's-gift reveal. Generic
// so higher tiers can carry more gear later without touching the reveal UI —
// the reveal just maps over whatever betaRewardChips() returns.
export type BetaRewardKind = "title" | "cosmetic" | "snouts";
export type BetaRewardChip = {
	kind: BetaRewardKind;
	// crown = title, bow = cosmetic, gem = snouts (all valid Glyph names).
	glyph: "crown" | "bow" | "gem";
	label: string;
	// cosmetic-only: catalog id + rarity so the reveal can render the item art
	// (HAT_IMAGES) with a rarity-tinted fallback when the art hasn't landed.
	hatId?: string;
	rarity?: string;
	// snouts-only: the numeric amount that drives the counter tick.
	amount?: number;
};

// Pure tier → reward-chip list mapping. Order is the reveal order: rank title
// (podium/top tiers only), the Founding Herd title, the founder ribbon, then
// snouts LAST so the counter tick lands the moment. Never duplicates the base
// title (founding_herd's own title IS "Founding Herd").
export function betaRewardChips(reward: {
	titleName: string | null;
	snouts: number;
}): BetaRewardChip[] {
	const chips: BetaRewardChip[] = [];

	const rankTitle = reward.titleName?.trim();
	if (rankTitle && rankTitle !== BETA_FOUNDING_HERD_TITLE) {
		chips.push({ kind: "title", glyph: "crown", label: rankTitle });
	}

	chips.push({ kind: "title", glyph: "crown", label: BETA_FOUNDING_HERD_TITLE });

	chips.push({
		kind: "cosmetic",
		glyph: "bow",
		label: BETA_FOUNDER_RIBBON_NAME,
		hatId: BETA_FOUNDER_RIBBON_ID,
		rarity: BETA_FOUNDER_RIBBON_RARITY,
	});

	chips.push({
		kind: "snouts",
		glyph: "gem",
		label: `${reward.snouts} snouts`,
		amount: reward.snouts,
	});

	return chips;
}
