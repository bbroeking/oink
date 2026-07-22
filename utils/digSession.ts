// The dig-session state machine — a PURE reducer for the Truffle Patch session.
//
// hooks/useRooting is a thin adapter around this: it owns React state, the
// AsyncStorage cold-start mirror, and the RPC/effect plumbing, but every state
// TRANSITION lives here as (state, event) → state. Every founder-reported
// production bug in the dig session happened in this transition logic, so it is
// pulled out where it can be unit-tested as plain data — no renderHook, no
// timers, no network. The documented incidents, each pinned by a fixture in
// __tests__/digSession.test.ts:
//   • rollover expiry — the dug flag is the WINDOW a dig landed in, never a bare
//     boolean, so it expires by construction when the 8h feeding rolls over
//     (isDugThisWindow re-compares against the live clock).
//   • practice-vs-real lockout — a PRACTICE dig must never record the real
//     "dug this feeding" flag (a fresh player who practiced then founded a
//     Sounder in the same window got locked out of their first real dig).
//   • per-user mirror keying — the cold-start mirror is namespaced per uid so an
//     account switch on a shared device can't inherit another player's flag.
//   • reconcile debounce — rapid foreground/background flips collapse into one
//     feeding_state read (shouldReconcile), and the server's truth for ITS
//     window index reconciles the local flag.

import { dugInCurrentWindow } from "@/utils/rooting";
// Type-only (erased at compile) — no runtime import cycle with the hook, which
// still OWNS these session/carry types and re-exports them for its callers.
import type { RootingSession } from "@/hooks/useRooting";

export interface DigSessionState {
	/** The open Truffle Patch session (server, practice, or dev), or null. */
	session: RootingSession | null;
	/**
	 * The WINDOW the caller's last known dig landed in, or null — never a plain
	 * boolean. isDugThisWindow re-compares it against the live window every
	 * render, so the flag EXPIRES the instant the 8h window rolls over (the
	 * founder's "still dug two hours later" bug: a boolean set at dig time had
	 * nothing to un-set it across the rollover).
	 */
	dugWindow: number | null;
	/** The caller has no Sounder — digging is crew-gated (UI shows a join prompt). */
	noCrew: boolean;
}

export const initialDigSessionState: DigSessionState = {
	session: null,
	dugWindow: null,
	noCrew: false,
};

export type DigSessionEvent =
	// A session was established (server open, practice fallback, or dev practice).
	// `clearNoCrew` is set ONLY for a real server success — a practice/dev open
	// leaves noCrew alone (a crewless player practicing is still crewless).
	// `alreadyDug` mirrors open_rooting's `already` — the server says this caller
	// already dug THIS session's window.
	| { type: "opened"; session: RootingSession; alreadyDug?: boolean; clearNoCrew?: boolean }
	// open_rooting refused with no_crew — the join-a-Sounder state.
	| { type: "open_no_crew" }
	// open_rooting refused with already_rooted — a refusal that is by definition
	// about the current window (no payload to read a server index from).
	| { type: "open_already_rooted"; window: number }
	// A submit landed. PRACTICE digs never lock the real "dug this feeding" flag —
	// the reducer is the single gate that enforces that incident. A real submit
	// records the session's SERVER-issued window (so the flag expires at rollover).
	| { type: "submit_landed"; practice: boolean }
	// The server's feeding_state truth for ITS window index (the reconcile).
	| { type: "reconciled"; dug: boolean; window: number }
	// Cold-start AsyncStorage mirror said the caller dug in `window`.
	| { type: "mirror_hydrated"; window: number }
	// The session was dismissed (leave-it-for-now / end card close).
	| { type: "cleared" };

export function digSessionReducer(
	state: DigSessionState,
	event: DigSessionEvent
): DigSessionState {
	switch (event.type) {
		case "opened":
			return {
				...state,
				session: event.session,
				// Only a real server success resets the crewless flag; practice/dev
				// opens leave it untouched (preserves the crewless-practice path).
				noCrew: event.clearNoCrew ? false : state.noCrew,
				// The server's window index (not the client clock) keys the
				// one-dig-per-feeding rule when it says the caller already dug.
				dugWindow: event.alreadyDug ? event.session.windowIndex : state.dugWindow,
			};
		case "open_no_crew":
			return { ...state, noCrew: true };
		case "open_already_rooted":
			return { ...state, dugWindow: event.window };
		case "submit_landed":
			// THE PRACTICE LOCKOUT INCIDENT: a practice dig banks nothing and is
			// freely replayable — it must NOT persist the real dug flag, or a player
			// who practiced then founded a Sounder in the SAME window is locked out
			// of their first real dig. The server never records a practice dig; the
			// local flag was the only thing that ever lied, so the reducer refuses it.
			if (event.practice || !state.session) return state;
			return { ...state, dugWindow: state.session.windowIndex };
		case "reconciled":
			// The server is authoritative for ITS window. Dug → adopt it. Not-dug →
			// retire only a LOCAL claim that matches the same window, so a stale flag
			// can't outlive the truth while a claim for a different window survives.
			return event.dug
				? { ...state, dugWindow: event.window }
				: {
						...state,
						dugWindow: state.dugWindow === event.window ? null : state.dugWindow,
				  };
		case "mirror_hydrated":
			return { ...state, dugWindow: event.window };
		case "cleared":
			return { ...state, session: null };
		default:
			return state;
	}
}

/**
 * Did the caller's recorded dig still belong to the CURRENT feeding? Pure
 * selector over the reducer state + the live clock — the dug flag expires by
 * construction at window rollover (the founder's "still dug two hours later"
 * bug). `nowMs` defaults to the live clock; tests pin it.
 */
export function isDugThisWindow(
	state: DigSessionState,
	nowMs: number = Date.now()
): boolean {
	return dugInCurrentWindow(state.dugWindow, nowMs);
}

// ── Cold-start mirror keying (per-user) ──────────────────────────────────────
// Per-user (the sounderPath `:${uid}` convention) so an account switch on a
// shared device can't inherit another player's dug-this-feeding state — the old
// un-namespaced `rooting_done_${win}` leaked the demo account's dug flag into a
// fresh signup and locked its first dig. Legacy keys are simply ignored: they
// expire naturally when the window rolls over, and the server (open_rooting /
// feeding_state) stays authoritative meanwhile.
export function dugMirrorKey(uid: string, win: number): string {
	return `rooting_done_${win}:${uid}`;
}

// ── Reconcile debounce (pure decision) ───────────────────────────────────────
// Debounce floor for the feeding_state reconcile — rapid foreground/background
// flips (or a rollover racing an AppState 'active') collapse into one RPC. The
// hook holds the last-fired timestamp in a ref; this decides whether to fire.
export const RECONCILE_MIN_MS = 5000;

export function shouldReconcile(
	lastReconcileMs: number,
	nowMs: number,
	minMs: number = RECONCILE_MIN_MS
): boolean {
	return nowMs - lastReconcileMs >= minMs;
}
