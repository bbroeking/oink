// Project-wide feature visibility flags. Use these to dark-launch /
// dark-relaunch UI surfaces without ripping out the implementation.
// The backend stays as-is; only the UI is hidden.
//
// For flags that need to flip remotely or target one tester, use the
// server-driven feature-flag system instead (hooks/useFeatureFlags.tsx) —
// see the `mud_wars` note below.

// The referral-downline surfaces (Account recruiter strip + the /sounder
// route) shipped dark behind SOUNDER_VISIBLE and opened with Season 1
// (2026-07-11). The flag is gone — those surfaces render unconditionally.

// Season 1 co-op dig (Sounder crews + the Truffle Patch feeding) visibility is
// a server flag, not a compile-time constant — the crew card on the Friends hub
// and the launch nudge gate on the runtime `coop_dig` feature flag so the season
// can be flipped remotely and targeted at a single tester without a rebuild.
// Read it with:
//
//   import { useFeatureFlag } from "@/hooks/useFeatureFlags";
//   const coopDig = useFeatureFlag("coop_dig");

// Mote Machine visibility. The wallet, credit trigger, and spin receipts stay
// intact while this is false so Shimmer Pockets can keep accruing Motes for a
// later relaunch. Player-facing Mote copy, entry points, and direct route access
// all gate on this single flag.
// Hidden 2026-09-11 after the UI audit (finding D-06: `MoteWageringScreen` fails
// design specificity) pending a rebuild on the design-system primitives.
export const MOTE_MACHINE_VISIBLE = false;

// Spotlight coach-marks (components/ui/Spotlight.tsx) — the dim-the-screen /
// cut-a-hole onboarding nudge — shipped dark behind SPOTLIGHT_ENABLED and were
// lit for everyone in 1.3 (build 149). The flag is gone; the coach-mark's only
// remaining gates are the per-install seen-stamp and the Season-tab "join a
// Sounder" step. See hooks/useJoinSpotlight.ts.

// Slop Club Lounge visibility (`app/lounge.tsx` — the walkable members' field:
// tap-to-walk Rosie, realtime peers, emotes, the two-pig seesaw).
//
// Dark-launched 2026-09-11 (wave 4, route decision). The screen is finished
// enough to walk around in and is still being built — the lounge sprite
// pipeline is live work — so it is NOT retired: the route's body stays, and
// this flag is the one switch that opens it. Until it flips, `/lounge` redirects
// to Shop (no entry point routes here today, so only a deep link can arrive).
// Serves **Connect** — the Lounge exists so members can be in one place at the
// same time and wave at each other; it ships when that reads as ours, and not
// as a half-drawn field, which is the same bar the Mote Machine was held to.
export const LOUNGE_VISIBLE = false;
