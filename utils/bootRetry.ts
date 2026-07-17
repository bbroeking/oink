// Boot-time retry helpers — the pure, testable core of the offline
// soft-lock fixes (spec 03 / issue #5). Two consumers:
//   - useHomeStats.refresh          → HOME_STATS_BACKOFF_MS
//   - (tabs)/_layout.refetchUsername → USERNAME_BACKOFF_MS + resolveUsernameFetch
//
// Kept side-effect-free so the backoff schedule and the "never treat a
// failed fetch as no-username" derivation can be unit-tested without
// standing up a component or a hook.

// Home-stats retry cadence: a few quick attempts, then give up and let the
// visible retry affordance take over. Matches the spec's 2s / 5s / 15s.
export const HOME_STATS_BACKOFF_MS: readonly number[] = [2000, 5000, 15000];

// Username gate retry cadence: modest backoff that exhausts inside ~10s, at
// which point the "saddling up" gate swaps its spinner for a retry button
// (rather than hanging forever on an offline boot).
export const USERNAME_BACKOFF_MS: readonly number[] = [2000, 3000, 5000];

// The delay before retry attempt `attempt` (0-indexed), or null once the
// schedule is exhausted — the caller's signal to stop retrying and surface a
// manual retry affordance.
export function retryDelayMs(
	attempt: number,
	schedule: readonly number[]
): number | null {
	if (attempt < 0 || attempt >= schedule.length) return null;
	return schedule[attempt];
}

// The shape Supabase's `.select().single()` resolves to (or that a caught
// throw is normalised into before calling this).
export interface UsernameFetchResult {
	data?: { username?: string | null } | null;
	error?: unknown;
}

// Derive the username-gate state from a profile fetch. The critical rule
// (spec 03 Part B): the `?? null` "no username → UsernameSetup" branch is
// ONLY correct on a SUCCESSFUL fetch. A fetch error must stay `undefined`
// (keep the gate loading / retrying) — never route a named pig to the rename
// screen because the network blipped.
//   - error present        → undefined (unknown; keep loading/retrying)
//   - success, has name    → the username
//   - success, no name     → null (genuinely needs UsernameSetup)
export function resolveUsernameFetch(
	result: UsernameFetchResult
): string | null | undefined {
	if (result.error) return undefined;
	return result.data?.username ?? null;
}
