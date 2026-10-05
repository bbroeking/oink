// Rootle: the dice game Pig, with truffles.
//
// Spec: docs/multiplayer/explorations/01-classic-board-games.md §4.1, as
// amended by the lead's review. Every deviation from the spec, and why, is in
// ./README.md. The rules as the player reads them:
//
//   1. On your turn, rootle (roll the die). A 2 to 6 drops that many truffles
//      in your basket; roll again if you like.
//   2. Roll the Hungerer (the one) and he eats everything in the basket. Your
//      turn is over.
//   3. Trot home any time after your first roll: the basket empties into your
//      barn, and the next pig rootles.
//   4. When a pig trots home with 50 or more, every other pig gets one last
//      turn. Then the biggest barn wins; equal barns share the win.
//
// Nothing is hidden. The die is rolled with `ctx.rng` at the moment `roll` is
// applied, so the next face never exists anywhere in state and `view` is the
// state itself.
//
// What this module does NOT do, because the room engine (../../engine.ts)
// owns it: leaving and forfeits, missed-turn counting, idle no-contests,
// emotes and rematches. The one thing it reads about presence is
// `ctx.present`, to hand the die past a pig who has left the table and to
// leave such a pig out of the last round. A departed pig whose turn it was
// when it left is resolved through `onTimeout` like any other missed turn.

import type { GameDefinition, GameEvent, GameResult, Pace, Seat, StepContext } from "../../types";
import { actionType, isRecord } from "../../validate";

const HOUR_MS = 3_600_000;

/** Every number the game is tuned by, in one place (README §Tuning). */
export const ROOTLE_TUNING = {
	/** A pig that trots home with this many starts the last round. ≈ 6 to 8
	 *  turns a pig; the classic 100 doubled the async hand-offs for no gain. */
	target: 50,
	/** One six-sided die. */
	faces: 6,
	/** The face that is the Hungerer. Faces 2 to 6 pay their pips. */
	hungerer: 1,
	/** Turns kept in `log`: enough for the board's strip and a reconnect. */
	logLength: 12,
	/** Per-decision clocks. A hand-off (no roll yet this turn) gets the long
	 *  one; once a pig has rolled, the rest of its turn is one sitting. */
	deadlineMs: {
		live: { handOff: 20_000, midTurn: 10_000 },
		async: { handOff: 12 * HOUR_MS, midTurn: 60_000 },
	},
	/** The practice pig holds at 20 (the well-known near-optimal line), give
	 *  or take this much, so it is not a metronome. */
	bot: { holdAt: 20, jitter: 2 },
} as const;

// ── State, actions, view ─────────────────────────────────────────────────────

/** One finished turn, for the board's strip and a reconnecting client. */
export interface RootleTurn {
	seat: Seat;
	/** Every face rolled that turn, in order. A bust ends on the Hungerer; a
	 *  pass by a pig who never rolled is empty. */
	faces: number[];
	/** Truffles carried into the barn. 0 for a bust or a pass. */
	banked: number;
	/** hold: trotted home. bust: the Hungerer ate the basket. pass: the clock
	 *  ran out before the first roll, or the pig left the table mid-turn. */
	end: "hold" | "bust" | "pass";
}

export interface RootleState {
	v: 1;
	/** 2..4. */
	seats: number;
	target: number;
	/** Banked truffles, one per seat. Kept for a pig who left, too. */
	barn: number[];
	/** This turn's unbanked truffles. */
	basket: number;
	/** The seat whose turn it is. */
	turn: Seat;
	/** Faces rolled so far this turn (all 2 to 6: a Hungerer ends the turn).
	 *  Empty at a hand-off; `faces.length` is the spec's `rolls`. */
	faces: number[];
	/** Set once, by the first pig to trot home with `target` or more. `owed`
	 *  lists the seats still owed their last turn, in turn order. */
	lastRound: { leader: Seat; owed: Seat[] } | null;
	/** The last `ROOTLE_TUNING.logLength` finished turns, oldest first. */
	log: RootleTurn[];
	over: boolean;
}

export type RootleAction = { type: "roll" } | { type: "hold" };

/** Nothing in Rootle is secret, so a seat sees the whole state. */
export type RootleView = RootleState;

const ACTION_TYPES = ["roll", "hold"] as const;

// ── Turn order ───────────────────────────────────────────────────────────────

/** Missing entries count as present: only an explicit `false` has left. */
function isPresent(present: readonly boolean[], seat: Seat): boolean {
	return present[seat] !== false;
}

/** The seats after `from`, in turn order, wrapping, without `from` itself,
 *  leaving out any pig that has left the table. */
function othersAfter(from: Seat, seats: number, present: readonly boolean[]): Seat[] {
	const out: Seat[] = [];
	for (let step = 1; step < seats; step++) {
		const seat = (from + step) % seats;
		if (isPresent(present, seat)) out.push(seat);
	}
	return out;
}

/** Who rootles after `from` outside the last round: the next pig still at the
 *  table. Only when nobody else is left does the die come back to `from`
 *  (the engine has already ended such a table; this keeps the module total). */
function nextAfter(from: Seat, seats: number, present: readonly boolean[]): Seat {
	const others = othersAfter(from, seats, present);
	if (others.length > 0) return others[0];
	return isPresent(present, from) ? from : (from + 1) % seats;
}

// ── Steps ────────────────────────────────────────────────────────────────────

/**
 * End the current turn: log it, empty the basket, and hand the die on. In the
 * last round the die goes to the next seat still owed (a pig who has left is
 * dropped from `owed` here); when nobody is owed, the game is over.
 */
function handOn(state: RootleState, finished: RootleTurn, ctx: StepContext, events: GameEvent[]): RootleState {
	const log = [...state.log, finished].slice(-ROOTLE_TUNING.logLength);
	const cleared: RootleState = { ...state, basket: 0, faces: [], log };
	if (state.lastRound) {
		const [next, ...rest] = state.lastRound.owed.filter((seat) => isPresent(ctx.present, seat));
		if (next === undefined) {
			events.push({ type: "end" });
			return { ...cleared, lastRound: { leader: state.lastRound.leader, owed: [] }, over: true };
		}
		events.push({ type: "turn", seat: next, last: true });
		return { ...cleared, turn: next, lastRound: { leader: state.lastRound.leader, owed: rest } };
	}
	const next = nextAfter(state.turn, state.seats, ctx.present);
	events.push({ type: "turn", seat: next, last: false });
	return { ...cleared, turn: next };
}

function roll(state: RootleState, seat: Seat, ctx: StepContext, events: GameEvent[]): RootleState {
	const face = ctx.rng.int(ROOTLE_TUNING.faces) + 1;
	const faces = [...state.faces, face];
	if (face === ROOTLE_TUNING.hungerer) {
		events.push({ type: "roll", seat, face, basket: 0 }, { type: "bust", seat, lost: state.basket });
		return handOn(state, { seat, faces, banked: 0, end: "bust" }, ctx, events);
	}
	const basket = state.basket + face;
	events.push({ type: "roll", seat, face, basket });
	return { ...state, basket, faces };
}

/** Trot home: the basket goes into the barn. The first pig to reach the
 *  target starts the last round; nobody can start it twice. */
function trotHome(state: RootleState, seat: Seat, ctx: StepContext, events: GameEvent[]): RootleState {
	const banked = state.basket;
	const barn = state.barn.map((b, i) => (i === seat ? b + banked : b));
	events.push({ type: "hold", seat, banked, barn: barn[seat] });
	let lastRound = state.lastRound;
	if (lastRound === null && barn[seat] >= state.target) {
		lastRound = { leader: seat, owed: othersAfter(seat, state.seats, ctx.present) };
		events.push({ type: "lastRound", leader: seat });
	}
	return handOn({ ...state, barn, lastRound }, { seat, faces: state.faces, banked, end: "hold" }, ctx, events);
}

/** The turn ends with nothing banked. For a pig still at the table this is a
 *  missed hand-off (it never rolled, so there is nothing to bank). For a pig
 *  that has left, whatever was in its basket is lost, as when a pig resigns. */
function pass(state: RootleState, seat: Seat, ctx: StepContext, events: GameEvent[], left: boolean): RootleState {
	events.push(left ? { type: "pass", seat, left: true } : { type: "pass", seat });
	return handOn(state, { seat, faces: state.faces, banked: 0, end: "pass" }, ctx, events);
}

// ── Result ───────────────────────────────────────────────────────────────────

/** A name-free line for the result card; the client adds the names. The top
 *  barn first, then the others biggest first. A barn with nothing in it is
 *  left out: nobody wears a zero. */
export function rootleSummary(barn: readonly number[], winners: readonly Seat[]): string {
	const top = winners.length > 0 ? barn[winners[0]] : Math.max(0, ...barn);
	if (top <= 0) return "nobody trotted home";
	const rest = barn
		.filter((b, i) => !winners.includes(i) && b > 0)
		.sort((a, b) => b - a);
	const tail = rest.length > 0 ? ` to ${rest.join(" to ")}` : "";
	return winners.length > 1 ? `shared the win at ${top}${tail}` : `trotted home with ${top}${tail}`;
}

// ── The definition ───────────────────────────────────────────────────────────

export const rootle: GameDefinition<RootleState, RootleAction, RootleView> = {
	id: "rootle",
	title: "Rootle",
	tagline: "Roll for truffles as long as you dare; roll the Hungerer and he eats this turn's basket.",
	rulesVersion: 1,
	seats: { min: 2, max: 4 },
	kind: "competitive",
	paces: ["live", "async"],
	decisionMs: {
		live: ROOTLE_TUNING.deadlineMs.live.handOff,
		async: ROOTLE_TUNING.deadlineMs.async.handOff,
	},

	setup: ({ seats }) => ({
		v: 1,
		seats,
		target: ROOTLE_TUNING.target,
		barn: Array.from({ length: seats }, () => 0),
		basket: 0,
		// The room already shuffled who sits where, so seat 0 is a random pig.
		turn: 0,
		faces: [],
		lastRound: null,
		log: [],
		over: false,
	}),

	activeSeats: (state) => (state.over ? [] : [state.turn]),

	deadlineMs: (state: RootleState, pace: Pace) => {
		if (state.over) return null;
		const clock = ROOTLE_TUNING.deadlineMs[pace];
		return state.faces.length === 0 ? clock.handOff : clock.midTurn;
	},

	apply: (state, seat, action, ctx) => {
		if (state.over) return { ok: false, error: "game_over" };
		if (seat !== state.turn) return { ok: false, error: "not_your_turn" };
		const events: GameEvent[] = [];
		switch (action.type) {
			case "roll":
				return { ok: true, state: roll(state, seat, ctx, events), events };
			case "hold":
				// Trot home only after the first roll (the board locks the
				// button the same way).
				if (state.faces.length === 0) return { ok: false, error: "illegal_move" };
				return { ok: true, state: trotHome(state, seat, ctx, events), events };
			default:
				return { ok: false, error: "bad_action" };
		}
	},

	onTimeout: (state, seat, ctx) => {
		// Only the pig whose turn it is owes anything; for anyone else there is
		// nothing to resolve.
		if (state.over || seat !== state.turn) return { state };
		const events: GameEvent[] = [];
		if (!isPresent(ctx.present, seat)) return { state: pass(state, seat, ctx, events, true), events };
		// Never rolled: the turn passes with nothing banked. Rolled at least
		// once: the gentle default, an absent pig keeps what it rolled.
		const next = state.faces.length === 0 ? pass(state, seat, ctx, events, false) : trotHome(state, seat, ctx, events);
		return { state: next, events };
	},

	view: (state) => state,

	result: (state): GameResult | null => {
		if (!state.over) return null;
		const top = Math.max(...state.barn);
		const winners = state.barn.flatMap((b, i) => (b === top ? [i] : []));
		return {
			// Equal top barns share the win: every one of them is a winner.
			kind: winners.length > 1 ? "draw" : "win",
			winners,
			scores: state.barn.slice(),
			summary: rootleSummary(state.barn, winners),
		};
	},

	bot: (view, seat, rng) => {
		if (view.over || view.turn !== seat) return null;
		if (view.faces.length === 0) return { type: "roll" };
		const total = view.barn[seat] + view.basket;
		if (view.lastRound) {
			// A last turn: the only thing that matters is the best barn on
			// the table, so hold only once it is beaten.
			const best = Math.max(0, ...view.barn.filter((_, i) => i !== seat));
			return total > best ? { type: "hold" } : { type: "roll" };
		}
		// Finishes when it can: trotting home now sets off the last round.
		if (total >= view.target) return { type: "hold" };
		const { holdAt, jitter } = ROOTLE_TUNING.bot;
		const threshold = holdAt - jitter + rng.int(jitter * 2 + 1);
		return view.basket >= threshold ? { type: "hold" } : { type: "roll" };
	},

	parseAction: (raw) => {
		const type = actionType(raw, ACTION_TYPES);
		// A bare `{ type }` and nothing else.
		if (type === null || !isRecord(raw) || Object.keys(raw).length !== 1) return null;
		return { type };
	},
};

// ── Read-only helpers for the board ──────────────────────────────────────────
// Pure functions of a view, so the board never re-derives a rule of its own.

/** The face the die last landed on at this table: this turn's latest roll,
 *  else the latest roll of an earlier turn still in the log. Null before the
 *  first roll of the game. */
export function rootleLastFace(view: RootleView): number | null {
	if (view.faces.length > 0) return view.faces[view.faces.length - 1];
	for (let i = view.log.length - 1; i >= 0; i--) {
		const faces = view.log[i].faces;
		if (faces.length > 0) return faces[faces.length - 1];
	}
	return null;
}

/** Truffles a turn put in the basket before it ended (a bust's loss). */
export function rootleTurnHaul(turn: RootleTurn): number {
	return turn.faces.reduce((sum, face) => (face === ROOTLE_TUNING.hungerer ? sum : sum + face), 0);
}

/** May `seat` trot home right now? (Its turn, and it has rolled.) */
export function rootleCanTrotHome(view: RootleView, seat: Seat): boolean {
	return !view.over && view.turn === seat && view.faces.length > 0;
}

/** The seats still to rootle after the current one, in order: the rest of
 *  the last round, or one lap of the pigs at the table. */
export function rootleUpNext(view: RootleView, present: readonly boolean[]): Seat[] {
	if (view.over) return [];
	if (view.lastRound) return view.lastRound.owed.filter((seat) => isPresent(present, seat));
	return othersAfter(view.turn, view.seats, present);
}

/** The best barn among the other pigs still at the table: the number a last
 *  turn has to beat. */
export function rootleBestOther(view: RootleView, seat: Seat, present: readonly boolean[]): number {
	return Math.max(0, ...view.barn.filter((_, i) => i !== seat && isPresent(present, i)));
}
