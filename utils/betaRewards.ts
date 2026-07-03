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
