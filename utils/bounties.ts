// Client-side mirror of the weekly-bounty pool + rotation in
// supabase/migrations/20260524000000_bounties.sql. The server is
// authoritative (my_weekly_bounties computes the active set), but
// keeping the pool + rotation here lets the UI preview upcoming
// weeks and gives the rotation logic a unit test.
//
// If you reorder BOUNTY_POOL or change the rotation, change the SQL
// VALUES list + the `rot` math to match.

export interface BountyDef {
	code: string;
	name: string;
	goal: number;
	reward_snouts: number;
}

// Order MUST match the VALUES list in my_weekly_bounties (idx 0..5).
export const BOUNTY_POOL: BountyDef[] = [
	{ code: "generous_hoof",    name: "Generous Hoof",     goal: 3, reward_snouts: 150 },
	{ code: "well_asked",       name: "Asked & Answered",  goal: 3, reward_snouts: 200 },
	{ code: "daily_light",      name: "Daily Light",       goal: 5, reward_snouts: 100 },
	{ code: "mischief_maker",   name: "Mischief Maker",    goal: 5, reward_snouts: 100 },
	{ code: "even_hand",        name: "Even Hand",         goal: 4, reward_snouts: 150 },
	{ code: "social_butterfly", name: "Social Butterfly",  goal: 3, reward_snouts: 200 },
];

export const BOUNTY_POOL_SIZE = BOUNTY_POOL.length; // 6
export const ACTIVE_BOUNTIES_PER_WEEK = 3;

// The 3 bounty indices active for a given ISO week number. Mirrors
// the SQL: rot = week_num % 6; active = {rot, rot+1, rot+2} mod 6.
export function activeBountyIndices(weekNum: number): number[] {
	const rot = ((weekNum % BOUNTY_POOL_SIZE) + BOUNTY_POOL_SIZE) % BOUNTY_POOL_SIZE;
	return [
		rot,
		(rot + 1) % BOUNTY_POOL_SIZE,
		(rot + 2) % BOUNTY_POOL_SIZE,
	];
}

export function activeBountyCodes(weekNum: number): string[] {
	return activeBountyIndices(weekNum).map((i) => BOUNTY_POOL[i].code);
}

export function activeBounties(weekNum: number): BountyDef[] {
	return activeBountyIndices(weekNum).map((i) => BOUNTY_POOL[i]);
}
