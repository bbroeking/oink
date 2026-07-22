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
export const SOUNDER_VISIBLE = true; // opened with Season 1 (2026-07-11) — the referral downline page is public

// Season 1 co-op dig (Sounder crews + the Truffle Patch feeding) visibility is
// a server flag, not a compile-time constant — the crew card on the Friends hub
// and the launch nudge gate on the runtime `coop_dig` feature flag so the season
// can be flipped remotely and targeted at a single tester without a rebuild.
// Read it with:
//
//   import { useFeatureFlag } from "@/hooks/useFeatureFlags";
//   const coopDig = useFeatureFlag("coop_dig");

// Slop Club / premium-pass PURCHASE CTAs. Flipped live 2026-07-17: the
// storefront is real — RevenueCat App Store app + appl_ key wired,
// ASC products (monthly/yearly/season_pass) staged to ride the 1.3
// review, revenuecat-webhook deployed as the authoritative is_vip flip.
// Buy buttons render on the Account membership card + the season pass
// PremiumLockedBanner. Purchases complete in sandbox/TestFlight now and
// in production once App Review approves the IAPs with the version.
export const PURCHASES_LIVE = true;

// Spotlight coach-marks (components/ui/Spotlight.tsx) — the dim-the-screen /
// cut-a-hole onboarding nudge. Lit for everyone as of 1.3 (build 149): the
// join-door target, hole placement, touch fall-through, and dismissal were all
// verified live, and the founder signed off on the tightened hole. It fires
// once per install (AsyncStorage seen-key), only on the Season-tab "join a
// Sounder" step; see hooks/useJoinSpotlight.ts.
export const SPOTLIGHT_ENABLED = true;
