// The tickle breakdown read path (spec 17) — the board's number as a glass box.
// Single owner of the tickle_breakdown RPC's return shape, the receipt-row
// mapping, and the fail-soft wrapper. The sheet (components/TickleBreakdownSheet)
// composes these; the pure row mapper is unit-tested in isolation.
//
// Fail-soft like utils/pairBonds.ts: an unpushed migration surfaces as a null
// result (rpc<T> swallows the PGRST202), and the sheet shows the known total
// with "the pig keeps its secrets for now" rather than an error.

import { rpc } from "./rpc";

// The server's decomposition of one player's season tickles_earned. Every lane
// is a real ledger source; home_taps is the balancing residual (floored at 0).
export interface TickleBreakdown {
	total: number;
	boundary: string | null;
	home_taps: number;
	visit_taps: number;
	dig_finds: number;
	pass_tiers: number;
	trades: number;
	lucky: number;
}

export type TickleLane =
	| "home_taps"
	| "visit_taps"
	| "dig_finds"
	| "pass_tiers"
	| "trades"
	| "lucky";

export interface TickleRow {
	lane: TickleLane;
	label: string;
	value: number;
}

// Receipt order + whimsy labels (spec 17). The order is the read order of the
// ledger; the label is the storybook voice ("tickled at home", not "home_taps").
const LANE_ROWS: { lane: TickleLane; label: string }[] = [
	{ lane: "home_taps", label: "tickled at home" },
	{ lane: "visit_taps", label: "out visiting friends" },
	{ lane: "dig_finds", label: "truffle digs" },
	{ lane: "pass_tiers", label: "season pass" },
	{ lane: "trades", label: "trades repaid" },
	{ lane: "lucky", label: "lucky numbers" },
];

// Map a breakdown to its visible receipt rows: lane order preserved, ZERO rows
// omitted (a pig that never dug shows no "truffle digs · 0" line). A missing lane
// (an older/partial server shape) reads as 0 and drops out too.
export function tickleBreakdownRows(data: TickleBreakdown): TickleRow[] {
	return LANE_ROWS.map(({ lane, label }) => ({
		lane,
		label,
		value: Math.max(0, Math.trunc(data[lane] ?? 0)),
	})).filter((r) => r.value > 0);
}

// Thin fail-soft wrapper. Null = unpushed migration / network — the caller falls
// back to the known total (never an error state).
export function fetchTickleBreakdown(userId: string) {
	return rpc<TickleBreakdown>("tickle_breakdown", { p_user: userId });
}
