// Session-scoped popup presentation tracking — the "did anything present this
// login?" signal for the quiet-login Sounder nudge.
//
// The Sounder launch nudge is a FALLBACK: "every time a user logs in, show them
// something about joining a Sounder if no other dialog is going to show up"
// (founder, 2026-07). It must fire at most once per SESSION, and ONLY when no
// other popup presented this session — a real dialog (schism, finale, rituals,
// achievements, season recap, hunger intro, …) always wins.
//
// Why session-scoped + queue-empty instead of the old AsyncStorage daily cap:
// the daily cap was a crude proxy for "don't nag." The real limiter is "nothing
// else needed the screen this login" — which is both a better UX rule (the nudge
// fills the quiet, never competes) AND self-limiting: on an active account
// something usually presents, so the nudge naturally stays rare without a
// persistent stamp. In-memory ONLY (like ceremonyGate) — it resets on every app
// restart, and the queue-empty AND-gate is the actual frequency ceiling.
//
// PopupQueue calls markPopupPresented(id) on every presenting transition. The
// quiet-fill fallback nudges (sounderLaunch, feedbackNudge) are EXCLUDED by the
// arbiter BEFORE it calls in — the exclusion set + its rationale now live beside
// the priorities in constants/popupPriorities.ts (QUIET_FILL_SLOT_IDS), so the
// "which slots are quiet fill" policy sits next to their (lowest) numbers. This
// module just owns the latch; it trusts the arbiter to filter. The sounder
// slot's `want` reads anyPopupPresentedThisSession().

let anyPresented = false;
// Session latch: the nudge fires at most once per app session even if the queue
// later empties again (e.g. the player dismisses everything). Once armed-and-
// fired, it stays suppressed until the next cold launch.
let sounderNudgeFired = false;
// The feedback nudge's own once-per-session latch (mirrors the Sounder one).
let feedbackNudgeFired = false;

/** PopupQueue calls this on every presenting transition — but only for slots
 *  that count toward "a popup presented this session". The arbiter filters out
 *  the quiet-fill fallback nudges (QUIET_FILL_SLOT_IDS) before calling, so their
 *  own presentation can't retroactively suppress them; this latch is
 *  unconditional. `id` is accepted for symmetry / future policy but unused. */
export function markPopupPresented(_id: string): void {
	anyPresented = true;
}

/** True once any NON-sounder popup has presented this app session. */
export function anyPopupPresentedThisSession(): boolean {
	return anyPresented;
}

/** True once the sounder nudge has fired this session (fire-at-most-once latch). */
export function sounderNudgeFiredThisSession(): boolean {
	return sounderNudgeFired;
}

/** Call when the sounder nudge PRESENTS — latches it off for the rest of the session. */
export function markSounderNudgeFired(): void {
	sounderNudgeFired = true;
}

/** True once the feedback nudge has fired this session (fire-at-most-once latch). */
export function feedbackNudgeFiredThisSession(): boolean {
	return feedbackNudgeFired;
}

/** Call when the feedback nudge PRESENTS — latches it off for the rest of the session. */
export function markFeedbackNudgeFired(): void {
	feedbackNudgeFired = true;
}

/** Test-only: reset the in-memory session state between cases. */
export function __resetPopupSession(): void {
	anyPresented = false;
	sounderNudgeFired = false;
	feedbackNudgeFired = false;
}
