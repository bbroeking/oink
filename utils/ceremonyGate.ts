// Flip-day stacking ceiling (SKILL.md decision log 2026-07-11, "season-flip
// login liturgy"). On any login where a CEREMONY fires — the season-end recap
// (seasonEnd, pri 25) or the Great Hunger intro (hungerIntro, pri 27) — the
// housekeeping popups (achievements carousel pri 40 at root, release notes pri
// 45 in Barn) must NOT also fire that session. They surface next login instead.
//
// A ceremony + a carousel of achievement reveals + release notes stacked on the
// same flip-day login is too much liturgy at once; the ceremony is the moment,
// the housekeeping can wait a day.
//
// In-memory ONLY — this resets on every app restart (no AsyncStorage). A player
// who force-quits and relaunches the same day gets the housekeeping then. The
// gate exists purely to keep ONE launch session from over-stacking.
//
// WHICH SLOTS STAMP THIS GATE is recorded once, next to the priority table, as
// CEREMONY_SLOT_IDS in constants/popupPriorities.ts (seasonEnd, hungerIntro).
// The actual markCeremonyShown() call lives at each ceremony slot's
// `if (slot.visible) markCeremonyShown()` effect (app/(tabs)/season.tsx for the
// recap, app/_layout.tsx for the hunger intro). Keep those in sync with the set.

let ceremonyShown = false;

/** Call when a ceremony (seasonEnd recap or hungerIntro) PRESENTS this session. */
export function markCeremonyShown(): void {
	ceremonyShown = true;
}

/** True if a ceremony already presented this app session — housekeeping should hold. */
export function ceremonyShownThisSession(): boolean {
	return ceremonyShown;
}

/** Test-only: reset the in-memory session gate between cases. */
export function __resetCeremonyGate(): void {
	ceremonyShown = false;
}
