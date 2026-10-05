// The room engine: one pure state machine that turns a GameDefinition into a
// playable table. It owns phases, revisions, deadlines, timeouts, departures,
// rematch votes and per-seat snapshots — and nothing else. No sockets, no
// timers, no storage: every function takes `now` and returns a new RoomState.
//
//   server/src/room.ts   wraps it with sockets, setTimeout and persistence;
//   utils/multiplayer/localRoom.ts wraps it with bot pigs for Practice;
//   the test kit drives it with bots to fuzz every game.
//
// Because Practice and the real server share this file, a practice table can
// never behave differently from a live one.

import type { GameErrorCode, GameEvent, GameId, GameResult, Pace, Seat, AnyGame, StepContext } from "./types";
import type {
	PlayerCard,
	ProtocolErrorCode,
	RoomPhase,
	RoomResult,
	RoomSnapshot,
	RoomSource,
	RoomSummary,
	SeatInfo,
} from "./protocol";
import { stepRng } from "./rng";

export interface EngineSeat extends PlayerCard {
	connected: boolean;
	gone: boolean;
	/** Practice only: a bot pig fills this seat. Never true on the server. */
	bot?: boolean;
	/** Missed deadlines in a row; resets on any accepted action. */
	missed: number;
}

export interface LogEntry {
	rev: number;
	seat: Seat;
	kind: "action" | "timeout" | "gone";
	action?: unknown;
	at: number;
}

export interface RoomState {
	roomId: string;
	gameId: GameId;
	rulesVersion: number;
	pace: Pace;
	source: RoomSource;
	phase: RoomPhase;
	/** One entry per seat; null is an open seat (lobby, or an async table
	 *  still waiting for its opponent). */
	seats: (EngineSeat | null)[];
	/** Server-secret. Never serialised into a snapshot. */
	seed: string;
	rev: number;
	/** The game's own state; null before setup. */
	game: unknown;
	activeSeats: Seat[];
	deadline: number | null;
	startsAt: number | null;
	result: RoomResult | null;
	/** Cues produced by the step that made `rev`. */
	events: GameEvent[];
	host: Seat | null;
	rematch: { votes: Seat[]; until: number } | null;
	createdAt: number;
	updatedAt: number;
	log: LogEntry[];
}

export interface EngineOptions {
	countdownMs: number;
	rematchWindowMs: number;
	/** A seat that misses this many deadlines in a row has left the table. */
	maxMissedInARow: Record<Pace, number>;
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
	countdownMs: 3_000,
	rematchWindowMs: 30_000,
	maxMissedInARow: { live: 3, async: 2 },
};

export type EngineResult = { ok: true; room: RoomState } | { ok: false; error: ProtocolErrorCode };

/** Upper bound on chained automatic resolutions inside one step (a departed
 *  seat whose every turn resolves by timeout). Guards against a game whose
 *  onTimeout never clears the seat's obligation. */
const MAX_AUTO_STEPS = 256;
const MAX_LOG = 2_000;

// ── Construction ─────────────────────────────────────────────────────────────

export function createRoom(input: {
	roomId: string;
	game: AnyGame;
	pace: Pace;
	source: RoomSource;
	seatCount: number;
	seats: (PlayerCard | null)[];
	seed: string;
	now: number;
	host?: Seat | null;
	bots?: Seat[];
}): RoomState {
	const { game, seatCount } = input;
	if (seatCount < game.seats.min || seatCount > game.seats.max) {
		throw new RangeError(`${game.id} seats ${game.seats.min}-${game.seats.max}, asked for ${seatCount}`);
	}
	if (!game.paces.includes(input.pace)) {
		throw new RangeError(`${game.id} does not support pace ${input.pace}`);
	}
	const seats: (EngineSeat | null)[] = Array.from({ length: seatCount }, (_, i) => {
		const card = input.seats[i] ?? null;
		return card
			? { ...card, connected: false, gone: false, missed: 0, bot: input.bots?.includes(i) || undefined }
			: null;
	});
	return {
		roomId: input.roomId,
		gameId: game.id,
		rulesVersion: game.rulesVersion,
		pace: input.pace,
		source: input.source,
		phase: "lobby",
		seats,
		seed: input.seed,
		rev: 0,
		game: null,
		activeSeats: [],
		deadline: null,
		startsAt: null,
		result: null,
		events: [],
		host: input.host ?? null,
		rematch: null,
		createdAt: input.now,
		updatedAt: input.now,
		log: [],
	};
}

// ── Seats ────────────────────────────────────────────────────────────────────

export function filledSeats(room: RoomState): Seat[] {
	return room.seats.flatMap((s, i) => (s ? [i] : []));
}

export function presentSeats(room: RoomState): Seat[] {
	return room.seats.flatMap((s, i) => (s && !s.gone ? [i] : []));
}

export function seatOf(room: RoomState, userId: string): Seat | null {
	const i = room.seats.findIndex((s) => s?.userId === userId);
	return i >= 0 ? i : null;
}

/** Seat a player in the first open chair (lobby, or an async open seat). */
export function takeSeat(room: RoomState, game: AnyGame, card: PlayerCard, now: number): EngineResult & { seat?: Seat } {
	if (room.phase === "ended") return { ok: false, error: "expired" };
	if (seatOf(room, card.userId) !== null) return { ok: false, error: "busy" };
	const open = room.seats.findIndex((s) => s === null);
	if (open < 0) return { ok: false, error: "full" };
	const seats = room.seats.slice();
	seats[open] = { ...card, connected: false, gone: false, missed: 0 };
	let next: RoomState = { ...room, seats, rev: room.rev + 1, events: [], updatedAt: now };
	// An async table already in play gets its clock back once the chair that
	// owes a decision is filled.
	if (next.phase === "playing") next = rearm(next, game, room, now, null);
	return { ok: true, room: next, seat: open };
}

/** Lobby only: a guest backs out before play; their chair reopens. */
export function releaseSeat(room: RoomState, seat: Seat, now: number): RoomState {
	if (room.phase !== "lobby" || !room.seats[seat]) return room;
	const seats = room.seats.slice();
	seats[seat] = null;
	return { ...room, seats, rev: room.rev + 1, events: [], updatedAt: now };
}

export function setConnected(room: RoomState, seat: Seat, connected: boolean, now: number): RoomState {
	const current = room.seats[seat];
	if (!current || current.connected === connected) return room;
	const seats = room.seats.slice();
	seats[seat] = { ...current, connected };
	return { ...room, seats, rev: room.rev + 1, events: [], updatedAt: now };
}

// ── Phases ───────────────────────────────────────────────────────────────────

/** Can a lobby begin now? `early` lets a host start with fewer than every
 *  chair filled, down to the game's minimum. */
export function canStart(room: RoomState, game: AnyGame, early = false): boolean {
	if (room.phase !== "lobby") return false;
	const filled = filledSeats(room).length;
	return early ? filled >= game.seats.min : filled === room.seats.length;
}

/** Lobby → starting. Open chairs are dropped (a 4-seat invite started with
 *  three pigs becomes a 3-seat table). */
export function beginCountdown(room: RoomState, game: AnyGame, now: number, opts = DEFAULT_ENGINE_OPTIONS): RoomState {
	const seats = room.seats.filter((s): s is EngineSeat => s !== null);
	if (seats.length < game.seats.min) throw new RangeError("not enough pigs to start");
	const hostUser = room.host !== null ? room.seats[room.host]?.userId : null;
	const host = hostUser ? seats.findIndex((s) => s.userId === hostUser) : null;
	return {
		...room,
		phase: "starting",
		seats,
		host: host !== null && host >= 0 ? host : null,
		startsAt: now + opts.countdownMs,
		rev: room.rev + 1,
		events: [],
		updatedAt: now,
	};
}

/** Starting (or an async table created straight into play) → playing. */
export function startGame(room: RoomState, game: AnyGame, now: number, opts = DEFAULT_ENGINE_OPTIONS): RoomState {
	const state = game.setup({ seats: room.seats.length, rng: stepRng(room.seed, 0, "setup"), pace: room.pace, now });
	const base: RoomState = { ...room, phase: "playing", startsAt: null, game: state, activeSeats: [], deadline: null };
	return settle(base, game, state, [{ type: "start" }], now, null, opts, room);
}

// ── Play ─────────────────────────────────────────────────────────────────────

/** `present[seat]` for a step: false only for a pig that has LEFT. An open
 *  chair (an async table still waiting for its pig) counts as present, so a
 *  game that skips absent seats waits for the newcomer instead of letting the
 *  first pig play every turn alone. */
function presence(room: RoomState): boolean[] {
	return room.seats.map((s) => !(s && s.gone));
}

function stepCtx(room: RoomState, now: number, salt: string): StepContext {
	return { now, rng: stepRng(room.seed, room.rev + 1, salt), pace: room.pace, present: presence(room) };
}

export function applyAction(
	room: RoomState,
	game: AnyGame,
	seat: Seat,
	rawAction: unknown,
	now: number,
	opts = DEFAULT_ENGINE_OPTIONS,
): EngineResult {
	if (room.phase === "ended") return { ok: false, error: "game_over" };
	if (room.phase !== "playing") return { ok: false, error: "not_your_turn" };
	const occupant = room.seats[seat];
	if (!occupant || occupant.gone) return { ok: false, error: "forbidden" };
	if (!room.activeSeats.includes(seat)) return { ok: false, error: "not_your_turn" };
	const action = game.parseAction(rawAction);
	if (action === null) return { ok: false, error: "bad_action" };
	const res = game.apply(room.game, seat, action, stepCtx(room, now, `a${seat}`));
	if (!res.ok) return { ok: false, error: res.error as GameErrorCode };

	const seats = room.seats.slice();
	seats[seat] = { ...occupant, missed: 0 };
	const logged = appendLog(room.log, { rev: room.rev + 1, seat, kind: "action", action, at: now });
	const next = settle({ ...room, seats, log: logged }, game, res.state, res.events ?? [], now, seat, opts, room);
	return { ok: true, room: next };
}

/** Resolve every active seat whose deadline has passed. Returns the room
 *  unchanged when nothing is due. */
export function applyTimeouts(room: RoomState, game: AnyGame, now: number, opts = DEFAULT_ENGINE_OPTIONS): RoomState {
	if (room.phase !== "playing" || room.deadline === null || now < room.deadline) return room;
	let state = room.game;
	const events: GameEvent[] = [];
	const seats = room.seats.slice();
	let log = room.log;
	const due = room.activeSeats.filter((s) => seats[s] !== null);
	for (const seat of due) {
		if (!game.activeSeats(state).includes(seat)) continue;
		const res = game.onTimeout(state, seat, stepCtx(room, now, `t${seat}`));
		state = res.state;
		events.push({ type: "timeout", seat }, ...(res.events ?? []));
		const occupant = seats[seat];
		if (occupant) seats[seat] = { ...occupant, missed: occupant.missed + 1 };
		log = appendLog(log, { rev: room.rev + 1, seat, kind: "timeout", at: now });
	}
	let next = settle({ ...room, seats, log }, game, state, events, now, null, opts, room, due);
	// A seat that keeps missing its turn has walked away from the table — but
	// only from someone who is actually there. If every other pig still seated
	// also missed its latest decision (missed > 0 resets on any action), the
	// table is mutually empty: it ends as a no contest rather than handing a
	// forfeit to whichever idle pig happened to reach the limit second.
	const limit = opts.maxMissedInARow[room.pace];
	for (const seat of due) {
		const occupant = next.seats[seat];
		if (next.phase !== "playing" || !occupant || occupant.gone || occupant.missed < limit) continue;
		const others = presentSeats(next).filter((s) => s !== seat);
		const nobodyHome = others.length > 0 && others.every((s) => (next.seats[s]?.missed ?? 0) > 0);
		if (nobodyHome) {
			const seatsGone = next.seats.map((o) => (o && !o.gone ? { ...o, gone: true, connected: false } : o));
			return end(
				{ ...next, seats: seatsGone, rev: next.rev + 1, events: [{ type: "idle" }], updatedAt: now },
				{ kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" },
			);
		}
		next = markGone(next, game, seat, now, opts);
	}
	return next;
}

/** Run the game's optional server clock once (`GameDefinition.tick`). The
 *  host calls this every `tick.everyMs` while the table is in play; a tick
 *  that returns null changes nothing and costs no revision. Committed through
 *  the same `settle` as an action, so a beat the clock ends (a reveal timing
 *  out into the next commit window) gets the same result, presence and clock
 *  rules on the server and in Practice. */
export function applyTick(room: RoomState, game: AnyGame, now: number, opts = DEFAULT_ENGINE_OPTIONS): RoomState {
	if (!game.tick || room.phase !== "playing") return room;
	const res = game.tick.run(room.game, stepCtx(room, now, "tick"));
	if (!res) return room;
	return settle(room, game, res.state, res.events ?? [], now, null, opts, room);
}

/**
 * A seat leaves for good: an explicit Leave, a lapsed reconnect grace, or too
 * many missed turns. Policy by phase and kind:
 *   lobby    → the chair reopens (the server cancels the table if it was the host's);
 *   starting → nobody has played: no contest;
 *   playing  → competitive with one pig left: that pig takes it (forfeit);
 *              co-op/social below the game's minimum: ended early, no contest;
 *              otherwise play goes on and the empty chair's turns resolve by
 *              its own timeout default, immediately;
 *   ended    → withdraws from any rematch.
 */
export function markGone(room: RoomState, game: AnyGame, seat: Seat, now: number, opts = DEFAULT_ENGINE_OPTIONS): RoomState {
	const occupant = room.seats[seat];
	if (!occupant || occupant.gone) return room;
	if (room.phase === "lobby") return releaseSeat(room, seat, now);

	const seats = room.seats.slice();
	seats[seat] = { ...occupant, gone: true, connected: false };
	const log = appendLog(room.log, { rev: room.rev + 1, seat, kind: "gone", at: now });
	const gone: RoomState = { ...room, seats, log, rev: room.rev + 1, events: [{ type: "gone", seat }], updatedAt: now };

	if (room.phase === "starting") {
		return end(gone, { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" });
	}
	if (room.phase === "ended") {
		return room.rematch
			? { ...gone, rematch: { ...room.rematch, votes: room.rematch.votes.filter((v) => v !== seat) } }
			: gone;
	}

	const present = presentSeats(gone);
	if (game.kind === "competitive" && present.length <= 1) {
		return end(gone, { kind: "win", winners: present, scores: [], summary: "", reason: "forfeit" });
	}
	if (game.kind !== "competitive" && present.length < game.seats.min) {
		return end(gone, { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" });
	}
	// Play continues around the empty chair.
	return settle(gone, game, gone.game, gone.events, now, null, opts, room);
}

/** End a match early for a server reason (restart, fault). */
export function abortRoom(room: RoomState, now: number): RoomState {
	if (room.phase === "ended") return room;
	return end(
		{ ...room, rev: room.rev + 1, events: [{ type: "aborted" }], updatedAt: now },
		{ kind: "no_contest", winners: [], scores: [], summary: "", reason: "server" },
	);
}

// ── Rematch ──────────────────────────────────────────────────────────────────

/** Records a rematch vote. `ready` is true once every pig still at the table
 *  has voted; the caller then creates the next room (see `rematchSeats`). */
export function voteRematch(
	room: RoomState,
	seat: Seat,
	now: number,
	opts = DEFAULT_ENGINE_OPTIONS,
): EngineResult & { ready?: boolean } {
	if (room.phase !== "ended" || room.result?.reason === "server") return { ok: false, error: "expired" };
	const occupant = room.seats[seat];
	if (!occupant || occupant.gone) return { ok: false, error: "forbidden" };
	if (room.rematch && now > room.rematch.until) return { ok: false, error: "expired" };
	const votes = Array.from(new Set([...(room.rematch?.votes ?? []), seat])).sort((a, b) => a - b);
	const until = room.rematch?.until ?? now + opts.rematchWindowMs;
	const next: RoomState = { ...room, rematch: { votes, until }, rev: room.rev + 1, events: [], updatedAt: now };
	const present = presentSeats(next);
	const ready = present.length >= 2 && present.every((s) => votes.includes(s));
	return { ok: true, room: next, ready };
}

/** Seat order for the rematch: rotated by one, so whoever moved first moves
 *  second next time. */
export function rematchSeats(room: RoomState): PlayerCard[] {
	const cards = presentSeats(room).map((s) => {
		const { userId, name, look } = room.seats[s] as EngineSeat;
		return { userId, name, look };
	});
	return cards.length > 1 ? [...cards.slice(1), cards[0]] : cards;
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export function eventsFor(events: readonly GameEvent[], seat: Seat | null): GameEvent[] {
	return events
		.filter((e) => !e.visibleTo || (seat !== null && e.visibleTo.includes(seat)))
		.map((e) => {
			if (!e.visibleTo) return e;
			const { visibleTo: _scope, ...rest } = e;
			return rest as GameEvent;
		});
}

export function snapshotFor(room: RoomState, game: AnyGame, seat: Seat | null): RoomSnapshot {
	const seats: SeatInfo[] = room.seats.flatMap((s, i) =>
		s ? [{ seat: i, userId: s.userId, name: s.name, look: s.look, connected: s.connected, gone: s.gone }] : [],
	);
	return {
		roomId: room.roomId,
		game: room.gameId,
		rulesVersion: room.rulesVersion,
		pace: room.pace,
		source: room.source,
		phase: room.phase,
		seats,
		seatCount: room.seats.length,
		you: seat,
		view: room.game !== null && seat !== null ? game.view(room.game, seat) : null,
		activeSeats: room.activeSeats,
		deadline: room.deadline,
		startsAt: room.startsAt,
		rev: room.rev,
		events: eventsFor(room.events, seat),
		result: room.result,
		invite: null,
		rematch: room.rematch,
		host: room.host,
	};
}

export function summaryFor(room: RoomState, seat: Seat): RoomSummary {
	return {
		roomId: room.roomId,
		game: room.gameId,
		pace: room.pace,
		phase: room.phase,
		yourTurn: room.phase === "playing" && room.activeSeats.includes(seat),
		opponents: room.seats.flatMap((s, i) => (s && i !== seat ? [{ userId: s.userId, name: s.name, look: s.look }] : [])),
		deadline: room.deadline,
		updatedAt: room.updatedAt,
	};
}

// ── Internals ────────────────────────────────────────────────────────────────

function appendLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
	const next = log.length >= MAX_LOG ? log.slice(log.length - MAX_LOG + 1) : log.slice();
	next.push(entry);
	return next;
}

/**
 * A game's own result, made honest about departures: a pig that left the
 * table can keep its score on the sheet but is never among the winners. If
 * every top scorer has left, the best-placed pigs still at the table take it
 * (by the game's own per-seat scores).
 */
function finalResult(room: RoomState, result: GameResult): RoomResult {
	const present = presentSeats(room);
	if (result.kind === "coop") return { ...result, reason: "complete" };
	// A full draw written as an empty list means every seat drew.
	const declared = result.kind === "draw" && result.winners.length === 0 ? filledSeats(room) : result.winners;
	const winners = declared.filter((s) => present.includes(s));
	if (winners.length > 0) {
		const changed = winners.length !== declared.length;
		return {
			...result,
			winners,
			kind: winners.length > 1 ? "draw" : "win",
			// A summary written around a departed pig's score would misread.
			summary: changed ? "" : result.summary,
			reason: "complete",
		};
	}
	// Every top scorer has left: the best-placed pigs still seated take it,
	// by the game's own per-seat scores. The client composes the line.
	const best = Math.max(...present.map((s) => result.scores[s] ?? 0));
	const heirs = present.filter((s) => (result.scores[s] ?? 0) === best);
	return { ...result, winners: heirs, kind: heirs.length > 1 ? "draw" : "win", summary: "", reason: "complete" };
}

function end(room: RoomState, result: RoomResult): RoomState {
	return { ...room, phase: "ended", result, activeSeats: [], deadline: null, startsAt: null };
}

/**
 * Commit a new game state: bump the revision, detect the end, recompute who
 * owes a decision, re-arm the clock, and let departed chairs resolve their
 * turns by timeout. `actor` is the seat that just acted (null for timeouts and
 * seat changes); `prev` is the room before the step, for the clock rule.
 */
function settle(
	room: RoomState,
	game: AnyGame,
	state: unknown,
	events: GameEvent[],
	now: number,
	actor: Seat | null,
	opts: EngineOptions,
	prev: RoomState,
	timedOut: Seat[] = [],
): RoomState {
	let current = state;
	const allEvents = events.slice();
	let next: RoomState = { ...room, game: current, rev: prev.rev + 1, updatedAt: now };

	for (let i = 0; i < MAX_AUTO_STEPS; i++) {
		const result = game.result(current);
		if (result) {
			return end({ ...next, game: current, events: allEvents }, finalResult(next, result));
		}
		const active = game.activeSeats(current);
		const departed = active.find((s) => next.seats[s]?.gone);
		if (departed === undefined) {
			next = { ...next, game: current, activeSeats: active, events: allEvents };
			return rearm(next, game, prev, now, actor, timedOut);
		}
		const res = game.onTimeout(current, departed, {
			now,
			rng: stepRng(room.seed, prev.rev + 1, `g${departed}:${i}`),
			pace: room.pace,
			present: presence(next),
		});
		current = res.state;
		allEvents.push(...(res.events ?? []));
	}
	throw new Error(`${game.id}: departed seats never cleared their obligation`);
}

/** The clock rule: a fresh deadline when a new decision opens (a seat that
 *  did not owe one now does, the actor owes another, or there was no clock);
 *  otherwise the shared deadline stands — a partner in a simultaneous beat
 *  never gets extra time because the other pig answered first. Chairs that
 *  are still open (async, unmatched) carry no clock. */
function rearm(
	room: RoomState,
	game: AnyGame,
	prev: RoomState,
	now: number,
	actor: Seat | null,
	timedOut: Seat[] = [],
): RoomState {
	const owing = room.activeSeats.filter((s) => room.seats[s] !== null);
	if (room.phase !== "playing" || owing.length === 0) return { ...room, deadline: null };
	const opened =
		prev.deadline === null ||
		prev.phase !== "playing" ||
		owing.some((s) => !prev.activeSeats.includes(s) || prev.seats[s] === null) ||
		(actor !== null && owing.includes(actor)) ||
		timedOut.some((s) => owing.includes(s));
	if (!opened) return { ...room, deadline: prev.deadline };
	const ms = game.deadlineMs ? game.deadlineMs(room.game, room.pace) : (game.decisionMs[room.pace] ?? game.decisionMs.live);
	return { ...room, deadline: ms === null ? null : now + ms };
}
