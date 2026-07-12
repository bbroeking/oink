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
// PopupQueue calls markPopupPresented(id) on every presenting transition; the
// sounderLaunch slot itself is EXCLUDED (it presenting can't be the thing that
// suppresses it). The sounder slot's `want` reads anyPopupPresentedThisSession().

// The id the fallback nudge presents under — its own presentation must never
// count as "another popup presented this session".
export const SOUNDER_LAUNCH_SLOT_ID = "sounderLaunch";

let anyPresented = false;
// Session latch: the nudge fires at most once per app session even if the queue
// later empties again (e.g. the player dismisses everything). Once armed-and-
// fired, it stays suppressed until the next cold launch.
let sounderNudgeFired = false;

/** PopupQueue calls this on every presenting transition. The sounderLaunch slot
 *  is excluded so its own presentation doesn't retroactively suppress it. */
export function markPopupPresented(id: string): void {
	if (id === SOUNDER_LAUNCH_SLOT_ID) return;
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

/** Test-only: reset the in-memory session state between cases. */
export function __resetPopupSession(): void {
	anyPresented = false;
	sounderNudgeFired = false;
}
