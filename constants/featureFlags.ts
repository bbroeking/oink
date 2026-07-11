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

// Season 1 co-op dig (Sounder crews + the Truffle Patch feeding) visibility is
// a server flag, not a compile-time constant — the crew card on the Friends hub
// and the launch nudge gate on the runtime `coop_dig` feature flag so the season
// can be flipped remotely and targeted at a single tester without a rebuild.
// Read it with:
//
//   import { useFeatureFlag } from "@/hooks/useFeatureFlags";
//   const coopDig = useFeatureFlag("coop_dig");

// Slop Club / premium-pass PURCHASE CTAs are "Coming soon…" until the
// storefront goes live (founder call, 2026-07-11). The paywall wiring
// (RevenueCat handleUnlockPro / presentPaywall) stays intact — flipping
// this to true restores both buy buttons (Account membership card + the
// season pass PremiumLockedBanner).
export const PURCHASES_LIVE = false;
