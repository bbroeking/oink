// Project-wide feature visibility flags. Use these to dark-launch /
// dark-relaunch UI surfaces without ripping out the implementation.
// The backend stays as-is; only the UI is hidden.

// DEV_PREVIEW: true in local dev (Expo dev client / simulator), but __DEV__ is
// false in EVERY release build — TestFlight and the App Store included — so a
// surface gated on this can be trialled locally yet can never reach users until
// it's promoted to a hard `true`. The safe way to "see it in the UI" without
// risking a leak to production.
const DEV_PREVIEW = __DEV__;

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

// Sounder Mud Fights (clan wars) — server (P1) ships live; the crew card on
// the Friends hub, the /mud-war screen, and the resolved-modal render in local
// dev so we can trial the feature, but stay hidden in TestFlight + production
// via DEV_PREVIEW. Flip to a hard `true` to launch (season 2).
export const MUD_FIGHTS_VISIBLE = DEV_PREVIEW;
