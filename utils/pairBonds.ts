// Pair bonds module — the friendship-bond ledger read path. Single owner of
// the pair-bond contract: the row/summary shapes and the two typed wrappers
// around the client-callable RPCs (pair_leaderboard, enemy_leaderboard,
// pair_bond_with).
//
// Same wrapper-shape pattern as utils/referrals.ts + utils/friendships.ts:
// thin rpc<T>() pass-throughs, no React, no AsyncStorage. The Strongest Pairs
// board (components/Leaderboard.tsx) and the friend keepsake line
// (components/UserSheet.tsx) compose these.
//
// Both RPCs fail soft on the client: an unpushed migration surfaces as a null
// result (rpc<T> swallows the 404), and the callers render nothing rather than
// an error.

import { rpc } from "./rpc";

// One ranked pair on the Strongest Pairs board. bond is the total (trades +
// blessings + visits); the three components drive the breakdown sub-line.
// is_self is true when the caller is one of the two pigs in the pair.
export interface PairBondRow {
	rank: number;
	user_a: string;
	user_b: string;
	name_a: string | null;
	name_b: string | null;
	trades: number;
	blessings: number;
	visits: number;
	bond: number;
	is_self: boolean;
}

// pair_leaderboard's envelope. `pairs` is the top slice (bond DESC); `you` is
// the caller's own best pair + its true global rank, present ONLY when that
// pair falls outside the returned slice (null when the caller is already in the
// top, or has no bond yet).
export interface PairLeaderboard {
	ok: true;
	pairs: PairBondRow[];
	you: PairBondRow | null;
}

// One unordered rivalry on the Biggest Enemies board. `curses` counts curses
// sent in either direction; is_self marks rivalries involving the caller.
export interface EnemyPairRow {
	rank: number;
	user_a: string;
	user_b: string;
	name_a: string | null;
	name_b: string | null;
	curses: number;
	curses_a_to_b?: number;
	curses_b_to_a?: number;
	is_self: boolean;
}

export interface EnemyLeaderboard {
	ok: true;
	enemies: EnemyPairRow[];
	you: EnemyPairRow | null;
}

// pair_bond_with's shape — the caller's bond with one friend, zeros when no
// bond has formed yet.
export interface PairBondWith {
	ok: true;
	trades: number;
	blessings: number;
	visits: number;
	bond: number;
}

// ── Typed RPC wrappers ──────────────────────────────────────────
// Each is a 1-2 line pass-through to rpc<T>() that concentrates the RPC name +
// return shape in one place. A null return (unpushed migration / network) is
// the caller's fail-soft signal.

export function pairLeaderboard(limit = 25) {
	return rpc<PairLeaderboard | { ok: false; reason: string }>(
		"pair_leaderboard",
		{ p_limit: limit }
	);
}

export function enemyLeaderboard(limit = 25) {
	return rpc<EnemyLeaderboard | { ok: false; reason: string }>(
		"enemy_leaderboard",
		{ p_limit: limit }
	);
}

export function pairBondWith(other: string) {
	return rpc<PairBondWith | { ok: false; reason: string }>("pair_bond_with", {
		p_other: other,
	});
}

// Breakdown sub-line for a pair row / keepsake: "12 trades · 8 blessings · 5
// visits". Singular/plural aware; drops zero-count components so a pair that
// only ever traded reads "3 trades", not "3 trades · 0 blessings · 0 visits".
export function bondBreakdown(row: {
	trades: number;
	blessings: number;
	visits: number;
}): string {
	const parts: string[] = [];
	const push = (n: number, word: string) => {
		if (n > 0) parts.push(`${n} ${word}${n === 1 ? "" : "s"}`);
	};
	push(row.trades, "trade");
	push(row.blessings, "blessing");
	push(row.visits, "visit");
	return parts.join(" · ");
}

// Canonical user_a/user_b order is stable, so these two lines explain exactly
// who cursed whom without changing the total used to rank the rivalry.
export function curseDirections(row: {
	name_a: string | null;
	name_b: string | null;
	curses: number;
	curses_a_to_b?: number;
	curses_b_to_a?: number;
}): string[] {
	if (row.curses_a_to_b == null || row.curses_b_to_a == null) {
		return [`${row.curses.toLocaleString()} curses exchanged`];
	}
	const nameA = row.name_a ?? "Anonymous";
	const nameB = row.name_b ?? "Anonymous";
	const line = (from: string, to: string, count: number) =>
		`${from} cursed ${to}: ${count.toLocaleString()} ${count === 1 ? "curse" : "curses"}`;
	return [
		line(nameA, nameB, row.curses_a_to_b),
		line(nameB, nameA, row.curses_b_to_a),
	];
}
