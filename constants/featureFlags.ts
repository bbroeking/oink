// Project-wide feature visibility flags. Use these to dark-launch /
// dark-relaunch UI surfaces without ripping out the implementation.
// The backend stays as-is; only the UI is hidden.

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

// Sounder Mud Fights (clan wars) — dark-launched. Server (P1) ships
// live; the crew card on the Friends hub, the /mud-war screen, and the
// resolved-modal only render once this flips to true (season 2).
export const MUD_FIGHTS_VISIBLE = false;
