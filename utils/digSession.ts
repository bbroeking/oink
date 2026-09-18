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

import { feedingNowMs } from "@/utils/feedingClock";
import { dugInCurrentWindow } from "@/utils/rooting";
import type { WakeMeter } from "@/constants/dig";
// A crewmate who has already dug this feeding — the feeding-state read module
// owns that shape.
import type { CrewDug } from "@/utils/dig";

// The open Truffle Patch session. It lives HERE, next to the state machine that
// stores it, so the pure reducer never has to reach back up into the React hook
// for its own state's type (that import was a module cycle). hooks/useRooting
// re-exports both types, so existing `from "@/hooks/useRooting"` call sites keep
// resolving.
export interface RootingSession {
  /** Account that owns a real server session; null/omitted for practice fixtures. */
  userId?: string | null;
  seed: number;
  windowIndex: number;
  windowEndsAtMs: number;
  practice: boolean;
  // Co-op depth: a crewmate already dug this feeding → the patch lets you dig
  // deeper (bigger stir budget); an active blessing makes digs luckier.
  coop: boolean;
  blessed: boolean;
  crewDug: CrewDug[];
  // The unique relic the server rolled onto this board (~2 in 5), or null.
  // Practice mode + a server that hasn't migrated → null → no unique on the board.
  uniqueId: string | null;
  // "The One That Got Away": the caller's carry slot re-buried on this board, or
  // null (empty slot / server not migrated → feature-dark). kind is the missed
  // find (truffle_l/truffle_d/unique); a unique carry pins THIS board's relic.
  carry: RootingCarry | null;
  // ── Snout Deep (20260913060000) ────────────────────────────────────────
  // The dig's mode, decided by the SERVER at open (the snout_deep flag).
  // Absent/"classic" → the stir-budget TrufflePatch; "snout_deep" → the
  // three-layer press-your-luck dig (components/mudwar/SnoutDeepDig).
  mode?: "classic" | "snout_deep";
  // When the server opened this row. A device snapshot saved BEFORE it is a
  // ghost of an earlier row (a reset, a re-open) and must not restore.
  openedAtMs?: number;
  // The caller has no Sounder: the same board, things + XP, no Golden
  // Truffles / Sounder Bonus / race find. Server-derived, never client-sent.
  uncrewed?: boolean;
  // The server's per-layer find odds (app_settings.dig_finds), or null.
  digFinds?: unknown;
  // Which Snout Deep rule set the server stamped on this row at open
  // (20260917160000): 1 is build 192's per-action roll, 2 the wake meter.
  // Absent (an un-migrated server, an older row) → 1.
  rules?: 1 | 2;
  // The wake-meter tuning STAMPED on this row (war_rootings.wake_meter): the
  // band his sleep depth is drawn from, where the meter resets, and whether
  // the root tie pays. Absent under rules 1 — there is no meter to tune.
  wakeMeter?: WakeMeter;
  // The log the server holds for an OPEN snout_deep row (sync_rooting) — the
  // restore source when the device has no local snapshot.
  synced?: { layer: number; actions: string[]; finds: string[] } | null;
}

// The carried miss the server re-buries next feeding (gilded).
export interface RootingCarry {
  kind: "truffle_l" | "truffle_d" | "unique";
  uniqueId: string | null;
  gild: number;
}

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
  submissionStatus: "idle" | "submitting" | "uncertain";
}

export const initialDigSessionState: DigSessionState = {
  session: null,
  dugWindow: null,
  noCrew: false,
  submissionStatus: "idle",
};

export type DigSessionEvent =
  // A session was established (server open, practice fallback, or dev practice).
  // `clearNoCrew` is set ONLY for a real server success — a practice/dev open
  // leaves noCrew alone (a crewless player practicing is still crewless).
  // `alreadyDug` mirrors open_rooting's `already` — the server says this caller
  // already dug THIS session's window.
  | {
      type: "opened";
      session: RootingSession;
      alreadyDug?: boolean;
      clearNoCrew?: boolean;
    }
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
  | { type: "submission_started" }
  | { type: "submission_uncertain" }
  | { type: "submission_settled" }
  // The session was dismissed (leave-it-for-now / end card close).
  | { type: "cleared" };

export function digSessionReducer(
  state: DigSessionState,
  event: DigSessionEvent,
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
        dugWindow: event.alreadyDug
          ? event.session.windowIndex
          : state.dugWindow,
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
            dugWindow:
              state.dugWindow === event.window ? null : state.dugWindow,
          };
    case "mirror_hydrated":
      return { ...state, dugWindow: event.window };
    case "submission_started":
      return { ...state, submissionStatus: "submitting" };
    case "submission_uncertain":
      return { ...state, submissionStatus: "uncertain" };
    case "submission_settled":
      return { ...state, submissionStatus: "idle" };
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
  nowMs: number = feedingNowMs(),
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
  minMs: number = RECONCILE_MIN_MS,
): boolean {
  return nowMs - lastReconcileMs >= minMs;
}
