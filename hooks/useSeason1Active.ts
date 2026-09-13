// THE ONE READ of the Season-1 switch.
//
// `world_boss` started life as the dark-launch flag for The Great Hunger and
// became, on 2026-07-03, the "Season 1 exists" switch: eight surfaces branch
// on it client-side and five server RPCs (forage truffle, truffle depth, S2
// blessings, tap-XP nerf) gate on the same `app_config` row. Flipping it off
// in prod would drop every player out of the season mid-session, so every
// consumer reads it through here — one name that says what it means, one
// place to change when Season 1 ends and Season 2 needs its own key.
//
// No `__DEV__` bypass (retired 2026-09-12). Dev builds read the same prod row
// as everyone else, so the flag-off path can actually be exercised locally by
// a per-user override before the day the flag really flips.
import { useFeatureFlag } from "@/hooks/useFeatureFlags";

export function useSeason1Active(): boolean {
	return useFeatureFlag("world_boss");
}
