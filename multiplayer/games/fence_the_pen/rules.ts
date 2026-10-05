// Fence the Pen: Dots and Boxes (Lucas, 1889) in the yard. Spec:
// docs/multiplayer/explorations/01-classic-board-games.md §4.2, with the lead's
// amendments (the engine owns emotes, resigning, missed-turn counting and
// departures, so none of that lives here). README.md beside this file has the
// rules in four lines, the tuning and every deviation.
//
//   1. On your turn, draw one fence between two posts.
//   2. Close a pen and its truffle is yours, and you MUST draw again.
//   3. When every fence is up, the most pens wins; equal pens share it.
//
// Nothing is hidden: the view is the state. No randomness either: `setup`
// consumes no rng, the timeout default is the lowest-index rule below, and
// only the practice pig's tie-breaks use the rng it is handed.

import type { GameDefinition, GameEvent, GameResult, Pace, Rng, Seat, StepContext } from "../../types";
import { actionType, isInt, isRecord } from "../../validate";
import { edgeCount, penCount, penSides, pensOfEdge, sidesDrawn, type Grid } from "./geometry";

/** Pens per side, by pace: a 4×4 yard live (40 fences), 3×3 by post (24), so a
 *  play-by-push game is about eight hand-offs a pig, not fourteen. */
export const BOARD_SIDE: Readonly<Record<Pace, number>> = { live: 4, async: 3 };

/** The largest yard any pace deals; parseAction's edge bound. */
const MAX_EDGES = edgeCount({ rows: BOARD_SIDE.live, cols: BOARD_SIDE.live });

export interface FenceLast {
	seat: Seat;
	edge: number;
	/** Pens that fence closed (0, 1 or 2). */
	closed: number[];
}

export interface FenceState {
	v: 1;
	/** Pens per column and per row. */
	rows: number;
	cols: number;
	seats: number;
	/** One entry per fence (geometry.ts indexing): 0 = open, else seat + 1. */
	edges: number[];
	/** One entry per pen: -1 = open, else the seat that closed it. */
	pens: number[];
	/** Pens per seat (derived from `pens`, kept for the board and the result). */
	scores: number[];
	fencesLeft: number;
	/** The seat that owes the next fence. */
	turn: Seat;
	/** The most recent fence, for a client that arrives without the events. */
	last: FenceLast | null;
	over: boolean;
}

export type FenceAction = { type: "fence"; edge: number };

/** Nothing is hidden in Fence the Pen. */
export type FenceView = FenceState;

export function gridOf(s: { rows: number; cols: number }): Grid {
	return { rows: s.rows, cols: s.cols };
}

// ── Turn order ───────────────────────────────────────────────────────────────

/**
 * The seat after `from` that owes the next turn: the first one in seat order
 * still at the table. `present` is false only for a pig who has left (an open
 * async chair counts as present, so the turn waits on it and the room holds
 * no clock there). A pig who left is skipped; its pens stay its own. Falls
 * back to `from` when nobody else can move, which the room never lets happen
 * in play (a competitive table down to one pig ends).
 */
export function nextSeat(seats: number, from: Seat, present: readonly boolean[]): Seat {
	for (let k = 1; k <= seats; k++) {
		const s = (from + k) % seats;
		if (present[s] !== false) return s;
	}
	return from;
}

// ── One fence ────────────────────────────────────────────────────────────────

/** Draw `edge` for `seat`: close what it closes, then end the game, give the
 *  same pig another fence, or pass the turn. Assumes the move is legal. */
function place(s: FenceState, seat: Seat, edge: number, present: readonly boolean[]): { state: FenceState; events: GameEvent[] } {
	const g = gridOf(s);
	const edges = s.edges.slice();
	edges[edge] = seat + 1;
	const closed = pensOfEdge(g, edge).filter((p) => s.pens[p] === -1 && sidesDrawn(g, edges, p) === 4);
	const pens = s.pens.slice();
	const scores = s.scores.slice();
	for (const p of closed) {
		pens[p] = seat;
		scores[seat] += 1;
	}
	const fencesLeft = s.fencesLeft - 1;
	const events: GameEvent[] = [{ type: "fence", seat, edge }, ...closed.map((pen) => ({ type: "pen", seat, pen }))];
	let turn = seat;
	let over = false;
	if (fencesLeft === 0) {
		// The last fence always closes at least one pen; the game ends and no
		// extra move is owed.
		over = true;
		events.push({ type: "end" });
	} else if (closed.length > 0) {
		// The extra move is mandatory: it keeps the one sentence true.
		events.push({ type: "again", seat });
	} else {
		turn = nextSeat(s.seats, seat, present);
		events.push({ type: "turn", seat: turn });
	}
	return {
		state: { ...s, edges, pens, scores, fencesLeft, turn, over, last: { seat, edge, closed } },
		events,
	};
}

// ── Reading the yard ─────────────────────────────────────────────────────────

/** Open fence indices, lowest first. */
export function openEdges(edges: readonly number[]): number[] {
	const out: number[] = [];
	for (let e = 0; e < edges.length; e++) if (edges[e] === 0) out.push(e);
	return out;
}

/** How many pens drawing `edge` would close right now (0, 1 or 2). */
export function closesCount(g: Grid, edges: readonly number[], edge: number): number {
	return pensOfEdge(g, edge).filter((p) => sidesDrawn(g, edges, p) === 3).length;
}

/** A fence is safe when it leaves no touching pen three-sided, so it hands
 *  the next pig nothing. (Closing a pen does not make it three-sided.) */
export function isSafe(g: Grid, edges: readonly number[], edge: number): boolean {
	return pensOfEdge(g, edge).every((p) => sidesDrawn(g, edges, p) !== 2);
}

/**
 * How many pens the next pig takes in a row if `edge` is drawn now: follow
 * every pen the fence leaves three-sided through its one open side, and keep
 * going while that makes the neighbour three-sided too (both directions of a
 * chain, and a loop, come out right). Meant for fences that close nothing.
 */
export function chainAfter(g: Grid, edges: readonly number[], edge: number): number {
	const sim = edges.slice();
	sim[edge] = 1;
	let taken = 0;
	for (;;) {
		let move = -1;
		for (let p = 0; p < penCount(g) && move < 0; p++) {
			if (sidesDrawn(g, sim, p) === 3) move = penSides(g, p).find((side) => sim[side] === 0) ?? -1;
		}
		if (move < 0) return taken;
		sim[move] = 1;
		taken += pensOfEdge(g, move).filter((p) => sidesDrawn(g, sim, p) === 4).length;
	}
}

/**
 * The fence a missed turn draws (spec §4.2 onTimeout): the lowest-index open
 * fence that gives no pen away; else the lowest-index one that closes a pen
 * (take what is free); else the lowest-index open fence. Deterministic.
 */
export function defaultFence(s: FenceState): number {
	const g = gridOf(s);
	let free = -1;
	let first = -1;
	for (let e = 0; e < s.edges.length; e++) {
		if (s.edges[e] !== 0) continue;
		if (first < 0) first = e;
		if (isSafe(g, s.edges, e)) return e;
		if (free < 0 && closesCount(g, s.edges, e) > 0) free = e;
	}
	return free >= 0 ? free : first;
}

/**
 * The practice pig's fence (one ply, beginner chain sense; spec §4.2 bot):
 *   1. take the fence that closes the most pens (two beats one), lowest first;
 *   2. else a random safe fence;
 *   3. else every fence gives something away: give the shortest chain, ties
 *      by rng.
 * No double-cross. A pig who learns to count chains beats it, which is the
 * lesson the game teaches.
 */
export function chooseFence(v: FenceView, rng: Rng): number {
	const g = gridOf(v);
	const open = openEdges(v.edges);
	let best = -1;
	let bestCount = 0;
	for (const e of open) {
		const n = closesCount(g, v.edges, e);
		if (n > bestCount) {
			best = e;
			bestCount = n;
		}
	}
	if (best >= 0) return best;
	const safe = open.filter((e) => isSafe(g, v.edges, e));
	if (safe.length > 0) return rng.pick(safe);
	let least = Number.POSITIVE_INFINITY;
	let picks: number[] = [];
	for (const e of open) {
		const n = chainAfter(g, v.edges, e);
		if (n < least) {
			least = n;
			picks = [e];
		} else if (n === least) picks.push(e);
	}
	return rng.pick(picks);
}

/** The result card's line, name-free: "9 pens to 7", "8 pens each",
 *  "6 pens to 5 to 3". A pig with no pens is left out of the line (nobody
 *  wears a zero), so a shut-out reads "all 9 pens". */
export function summaryOf(scores: readonly number[]): string {
	const unit = (n: number) => (n === 1 ? "pen" : "pens");
	const kept = scores.filter((n) => n > 0).sort((a, b) => b - a);
	if (kept.length === 0) return "no pens kept";
	if (kept.length === 1) return `all ${kept[0]} ${unit(kept[0])}`;
	if (kept.length === scores.length && kept.every((n) => n === kept[0])) return `${kept[0]} ${unit(kept[0])} each`;
	return `${kept[0]} ${unit(kept[0])} to ${kept.slice(1).join(" to ")}`;
}

// ── The definition ───────────────────────────────────────────────────────────

export const fence_the_pen: GameDefinition<FenceState, FenceAction, FenceView> = {
	id: "fence_the_pen",
	title: "Fence the Pen",
	tagline: "Draw a fence; close a pen and its truffle is yours, then draw again.",
	rulesVersion: 1,
	seats: { min: 2, max: 4 },
	kind: "competitive",
	paces: ["live", "async"],
	// The same clock after an extra move: the room re-arms it whenever the
	// mover owes another fence.
	decisionMs: { live: 20_000, async: 24 * 3_600_000 },

	setup({ seats, pace }) {
		const side = BOARD_SIDE[pace];
		const g = { rows: side, cols: side };
		const fences = edgeCount(g);
		return {
			v: 1,
			rows: side,
			cols: side,
			seats,
			edges: Array.from({ length: fences }, () => 0),
			pens: Array.from({ length: penCount(g) }, () => -1),
			scores: Array.from({ length: seats }, () => 0),
			fencesLeft: fences,
			turn: 0,
			last: null,
			over: false,
		};
	},

	activeSeats: (s) => (s.over ? [] : [s.turn]),

	apply(s, seat, action, ctx: StepContext) {
		if (s.over) return { ok: false, error: "game_over" };
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		if (action.type !== "fence") return { ok: false, error: "bad_action" };
		const { edge } = action;
		if (!Number.isInteger(edge) || edge < 0 || edge >= s.edges.length) return { ok: false, error: "illegal_move" };
		if (s.edges[edge] !== 0) return { ok: false, error: "illegal_move" };
		const step = place(s, seat, edge, ctx.present);
		return { ok: true, state: step.state, events: step.events };
	},

	// A missed turn (or the turn of a pig who left) draws the default fence. A
	// default that closes a pen owes another fence, so the defaults keep coming
	// inside this one call until one closes nothing and the turn has really
	// passed (or the yard is full): the room needs this seat to stop owing the
	// decision. Bounded by the open fences, one per pass.
	onTimeout(s, seat, ctx) {
		if (s.over || s.turn !== seat) return { state: s };
		let state = s;
		const events: GameEvent[] = [];
		while (!state.over && state.turn === seat) {
			const step = place(state, seat, defaultFence(state), ctx.present);
			state = step.state;
			events.push(...step.events);
		}
		return { state, events };
	},

	view: (s) => s,

	result(s): GameResult | null {
		if (!s.over) return null;
		const best = Math.max(...s.scores);
		const winners = s.scores.flatMap((n, i) => (n === best ? [i] : []));
		return {
			kind: winners.length > 1 ? "draw" : "win",
			winners,
			scores: s.scores.slice(),
			summary: summaryOf(s.scores),
		};
	},

	bot(v, seat, rng) {
		if (v.over || v.turn !== seat) return null;
		return { type: "fence", edge: chooseFence(v, rng) };
	},

	parseAction(raw) {
		if (actionType(raw, ["fence"] as const) === null || !isRecord(raw)) return null;
		if (Object.keys(raw).some((k) => k !== "type" && k !== "edge")) return null;
		return isInt(raw.edge, 0, MAX_EDGES - 1) ? { type: "fence", edge: raw.edge } : null;
	},
};
