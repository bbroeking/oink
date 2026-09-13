import { rpcAction, type RpcResult } from "@/utils/rpc";

// The `barn_visit_status(p_target)` jsonb — one shape for every surface that
// gates a visit (BarnVisitModal on arrival, the Friends list's shared budget,
// UserSheet's Visit button). Each reads a subset; declaring the row here keeps
// the three from drifting on field names. Every field is optional: the RPC has
// been extended by carry-forward migrations (visit window, sluggish regen), so
// an older server simply omits what it doesn't know.
export interface BarnVisitStatus {
	/** The host pig already napped this hour (tap ceiling reached). */
	resting?: boolean;
	/** The caller is locked to a different barn (one friend / window). */
	locked?: boolean;
	/** When the lock (or the nap) lifts. */
	next_at?: string | null;
	taps_left?: number | null;
	tap_cap?: number | null;
	/** Shared visit budget — window-global, so any non-self target reads it. */
	visits_left?: number | null;
	visit_budget?: number | null;
	visits_refresh_at?: string | null;
	visit_window_hours?: number | null;
	/** The caller's own tickle bank (merged from tickle_info). */
	balance?: number;
	cap?: number;
	next_regen_seconds?: number | null;
}

export function fetchBarnVisitStatus(
	targetUserId: string
): Promise<RpcResult<BarnVisitStatus>> {
	return rpcAction<BarnVisitStatus>("barn_visit_status", { p_target: targetUserId });
}
