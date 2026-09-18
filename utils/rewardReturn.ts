// The reward return — the choreography of a pig coming home with something.
//
// One moment, three beats, always in this order: the pig ARRIVES (walks in,
// stops, celebrates), the card REVEALS (springs up under the pig with what it
// found), and the reward is GRANTED (the items fly to where they now live and
// the server is told). This file is the pure part: the phase machine, the
// beat script, and the fly geometry. No React, no Animated — so the order of
// the beats, what a failed grant does, and what Reduce Motion cuts are all
// unit-tested facts rather than component behaviour. The hook
// (hooks/useRewardReturn.ts) drives Animated values from this; the component
// (components/RewardReturn.tsx) draws it.
//
// Built for the errand's homecoming (docs/pig-errands-spec.md §6.6) but owned
// by nobody in particular: anything that "comes back with something" — a
// return from the hedge, a postcard, a draw — is a RewardReturn with a
// different pig, items and grant. (2026-09-18)

import { MOTION_DURATION, type MotionPolicy } from "@/hooks/useMotionPolicy";

/** One thing the pig brought back. `kind` picks the art path; `count` > 1
 *  draws one coin with a numeral. */
export interface RewardItem {
	id: string;
	kind: "find" | "furnishing" | "other";
	name: string;
	count?: number;
}

/** What the grant callback answers. A refusal carries the server's reason so
 *  the card can say it (`bag_full`, `wish_moved`) rather than a generic sorry. */
export type GrantResult = { ok: true } | { ok: false; reason: string; retryable?: boolean };

export type ReturnPhase =
	| "closed"
	| "arrive" // the pig is walking in
	| "reveal" // the card is up; waiting on the player
	| "granting" // the grant is in flight; items are flying
	| "granted" // the grant landed; the "in your Satchel" beat
	| "failed" // the grant refused; the card says why
	| "done"; // dismissed; the host unmounts us

export type ReturnEvent =
	| { type: "open" }
	| { type: "arrived" }
	| { type: "grant" }
	| { type: "grantOk" }
	| { type: "grantFail"; reason: string; retryable?: boolean }
	| { type: "retry" }
	| { type: "skip" } // secondary action: leave without granting (keep for later)
	| { type: "dismiss" };

export interface ReturnState {
	phase: ReturnPhase;
	/** The refusal the card is showing, when `failed`. */
	failure: { reason: string; retryable: boolean } | null;
	/** How many grants were attempted — the retry copy changes after the first. */
	attempts: number;
}

export const INITIAL_RETURN: ReturnState = { phase: "closed", failure: null, attempts: 0 };

/**
 * The phase machine. Illegal events are ignored (a second `grant` tap while
 * one is in flight, a stray `arrived` after a skip) rather than thrown, so a
 * double-tap or a late animation callback can never wedge the moment.
 */
export function advanceReturn(state: ReturnState, event: ReturnEvent): ReturnState {
	switch (event.type) {
		case "open":
			return state.phase === "closed" ? { ...INITIAL_RETURN, phase: "arrive" } : state;
		case "arrived":
			return state.phase === "arrive" ? { ...state, phase: "reveal" } : state;
		case "grant":
			return state.phase === "reveal" || state.phase === "failed"
				? { ...state, phase: "granting", failure: null, attempts: state.attempts + 1 }
				: state;
		case "grantOk":
			return state.phase === "granting" ? { ...state, phase: "granted" } : state;
		case "grantFail":
			return state.phase === "granting"
				? {
						...state,
						phase: "failed",
						failure: { reason: event.reason, retryable: event.retryable ?? true },
					}
				: state;
		case "retry":
			return state.phase === "failed" ? advanceReturn(state, { type: "grant" }) : state;
		case "skip":
			return state.phase === "reveal" || state.phase === "failed" ? { ...state, phase: "done" } : state;
		case "dismiss":
			return state.phase === "granted" || state.phase === "failed" || state.phase === "reveal"
				? { ...state, phase: "done" }
				: state;
		default:
			return state;
	}
}

/** Whether the primary action is tappable in this phase. */
export function canGrant(state: ReturnState): boolean {
	return state.phase === "reveal" || state.phase === "failed";
}

// ── The beat script ────────────────────────────────────────────────────────
// Every duration comes from MOTION_DURATION so the return keeps time with the
// rest of the app; the only bespoke number is the walk, which is a distance
// (the pig crosses half a screen) more than a duration. Under Reduce Motion
// the walk and the flight are cuts, the card crossfades, and the celebration
// beat still holds (a pause is not motion).

/** The walk-in: long enough for four walk frames at the family's 3.2 fps. */
export const WALK_IN_MS = 1250;
/** How long the pig celebrates (the `happy` reaction) before the card rises. */
export const CELEBRATE_MS = MOTION_DURATION.celebration;
/** The items' flight to the bag. */
export const FLY_MS = MOTION_DURATION.celebration;
/** The "in your Satchel" beat before we hand control back. */
export const GRANTED_HOLD_MS = 800;
/** Stagger between two flying items. */
export const FLY_STAGGER_MS = 90;

export interface ReturnScript {
	walkMs: number;
	celebrateMs: number;
	flyMs: number;
	flyStaggerMs: number;
	grantedHoldMs: number;
	/** Reduce Motion: the pig is simply there and the items simply land. */
	cuts: boolean;
}

export function returnScript(policy: Pick<MotionPolicy, "reduceMotion">): ReturnScript {
	if (policy.reduceMotion) {
		return { walkMs: 0, celebrateMs: CELEBRATE_MS, flyMs: 0, flyStaggerMs: 0, grantedHoldMs: GRANTED_HOLD_MS, cuts: true };
	}
	return {
		walkMs: WALK_IN_MS,
		celebrateMs: CELEBRATE_MS,
		flyMs: FLY_MS,
		flyStaggerMs: FLY_STAGGER_MS,
		grantedHoldMs: GRANTED_HOLD_MS,
		cuts: false,
	};
}

// ── The flight ─────────────────────────────────────────────────────────────

export interface Point {
	x: number;
	y: number;
}

/** A point on the arc from `from` to `to` at progress t ∈ [0, 1]: a straight
 *  line with a lift in the middle, so a coin hops to the bag rather than
 *  sliding. `lift` is how high the hump is, in px (negative = up on screen). */
export function flyPoint(from: Point, to: Point, t: number, lift = -48): Point {
	const k = Math.min(1, Math.max(0, t));
	const hump = 4 * k * (1 - k); // 0 at the ends, 1 in the middle
	return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k + lift * hump };
}

/** The keyframes an Animated interpolation wants for the hop: five stops on
 *  the arc, so `translateX`/`translateY` can each be one interpolate call. */
export function flyKeyframes(from: Point, to: Point, lift = -48): { input: number[]; x: number[]; y: number[] } {
	const stops = [0, 0.25, 0.5, 0.75, 1];
	const pts = stops.map((t) => flyPoint(from, to, t, lift));
	return { input: stops, x: pts.map((p) => p.x - from.x), y: pts.map((p) => p.y - from.y) };
}

// ── Copy ───────────────────────────────────────────────────────────────────

/** The one-line reason a refused grant shows. Unknown reasons get the warm
 *  generic; known ones say what happened. */
export function grantFailureLine(reason: string): string {
	switch (reason) {
		case "bag_full":
			return "Your Satchel is full — he's keeping it in his mouth until there's room.";
		case "wish_moved":
			return "Someone beat him to it — that wish is already filled. Keep it instead?";
		case "host_bag_full":
			return "Their Satchel is full right now. Keep it, or try again later.";
		case "offline":
		case "network":
			return "Couldn't reach the Barn. Give it another go.";
		default:
			return "That didn't go through. Give it another go.";
	}
}
