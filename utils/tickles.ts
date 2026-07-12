// Lifetime tickles = ALL-TIME across seasons.
//
// Season-0 graduation (migrations 20260726 / 20260736) archived each player's
// final tickles into season0_tickle_standings and ZEROED profiles.tickles_earned
// so the live Board restarts at 0 for Season 1. Migration 20260737 adds
// profiles.tickles_lifetime_base = the sum of all ARCHIVED seasons' tickles.
//
// Displayed lifetime is computed at READ, never stored twice:
//     lifetime = tickles_lifetime_base + tickles_earned  (base + live season)
//
// Graceful pre-push: if the base column is absent from a payload (feature-dark
// before the migration lands) treat it as 0, so a "lifetime" surface simply
// shows the live-season number instead of crashing.
export function lifetimeTickles(
	base: number | null | undefined,
	current: number | null | undefined
): number {
	const b = typeof base === "number" && Number.isFinite(base) ? base : 0;
	const c = typeof current === "number" && Number.isFinite(current) ? current : 0;
	return Math.max(0, b) + Math.max(0, c);
}
