// Project-wide feature visibility flags. Use these to dark-launch /
// dark-relaunch UI surfaces without ripping out the implementation.
// The backend stays as-is; only the UI is hidden.
//
// For flags that need to flip remotely or target one tester, use the
// server-driven feature-flag system instead (hooks/useFeatureFlags.tsx) —
// see the `mud_wars` note below.

// The Sounder (referral program) UI is hidden for now — the
// `my_sounder` / `sounder_leaderboard` RPCs are still live, the
// Account "Your Sounder" card and the /sounder route just don't
// render until this flips to true.
//
// NOTE: the player-facing word "Sounder" has been reclaimed for the
// war crew (Sounder Mud Fights). This flag now refers to the *referral
// downline* surfaces specifically; the referral feature is effectively
// backend-only while these stay hidden.
export const SOUNDER_VISIBLE = false;

// Sounder Mud Fights (clan wars / Season 1) visibility MOVED to a server flag.
// It's no longer a compile-time constant — the crew card on the Friends hub, the
// /mud-war + /clan-ladder screens, and the launch nudge now gate on the runtime
// `mud_wars` feature flag so the season can be flipped remotely and targeted at a
// single tester without a rebuild. Read it with:
//
//   import { useFeatureFlag } from "@/hooks/useFeatureFlags";
//   const mudWarsVisible = useFeatureFlag("mud_wars");
//
// Global default + Brian's per-user override are seeded in
// supabase/migrations/20260692000000_feature_flags.sql.
