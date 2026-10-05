// Rootle's rules module (multiplayer/games/rootle/rules.ts) against its spec,
// docs/multiplayer/explorations/01-classic-board-games.md §4.1 as amended by
// the lead (README in the module's folder lists every deviation). Unit tests
// drive the pure module with a scripted die; the integration tests drive it
// through the real room engine, which owns departures, missed turns and the
// clock; the fuzz runs whole tables of practice pigs at both paces.

import type { GameEvent, Pace, Rng, Seat, StepContext } from "../../multiplayer/types";
import {
	ROOTLE_TUNING,
	rootle,
	rootleBestOther,
	rootleCanTrotHome,
	rootleLastFace,
	rootleSummary,
	rootleTurnHaul,
	rootleUpNext,
	type RootleAction,
	type RootleState,
} from "../../multiplayer/games/rootle/rules";
import { GAMES } from "../../multiplayer/games";
import {
	applyAction,
	applyTimeouts,
	beginCountdown,
	createRoom,
	markGone,
	snapshotFor,
	startGame,
	type RoomState,
} from "../../multiplayer/engine";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import { createRng } from "../../multiplayer/rng";

// ── Harness ──────────────────────────────────────────────────────────────────

const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;

/** A die that lands on exactly these faces, in order, then refuses. */
function dice(...faces: number[]): Rng {
	const queue = faces.slice();
	const int = (maxExclusive: number): number => {
		expect(maxExclusive).toBe(6);
		const face = queue.shift();
		if (face === undefined) throw new Error("the scripted die ran out of faces");
		return face - 1;
	};
	return {
		next: () => 0,
		int,
		range: (min) => min,
		pick: (items) => items[0],
		shuffle: (items) => items.slice(),
		chance: () => false,
	};
}

/** An rng whose `int` always answers `k` (for the practice pig's jitter). */
function fixedInt(k: number): Rng {
	return { ...dice(), int: () => k };
}

function ctx(rng: Rng = dice(), present?: boolean[]): StepContext {
	return { now: NOW, rng, pace: "live", present: present ?? [true, true, true, true] };
}

function fresh(seats = 2, over: Partial<RootleState> = {}): RootleState {
	return { ...rootle.setup({ seats, rng: createRng("setup"), pace: "live" }), ...over };
}

/** Apply an action that must be legal; returns the next state and its cues. */
function play(state: RootleState, seat: Seat, action: RootleAction, rng: Rng = dice(), present?: boolean[]) {
	const res = rootle.apply(state, seat, action, ctx(rng, present));
	if (!res.ok) throw new Error(`refused: ${res.error}`);
	return { state: res.state, events: res.events ?? [] };
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
	}
	return value;
}

function table(seats: number, seed: string, pace: Pace = "live"): RoomState {
	const room = createRoom({
		roomId: "00000000-rootle",
		game: rootle,
		pace,
		source: "queue",
		seatCount: seats,
		seats: testCards(seats),
		seed,
		now: NOW,
	});
	return startGame(beginCountdown(room, rootle, NOW), rootle, NOW + 3_000);
}

/** Let the practice pigs play a room to its end. */
function finish(room: RoomState, from: number): RoomState {
	let current = room;
	let now = from;
	for (let i = 0; i < 2_000 && current.phase === "playing"; i++) {
		const seat = current.activeSeats[0];
		const action = rootle.bot(rootle.view(current.game as RootleState, seat), seat, createRng(`finish:${i}`));
		now += 250;
		const res = applyAction(current, rootle, seat, action, now);
		if (!res.ok) throw new Error(`practice pig refused: ${res.error}`);
		current = res.room;
	}
	return current;
}

const gameOf = (room: RoomState) => room.game as RootleState;

// ── The definition ───────────────────────────────────────────────────────────

describe("rootle · the definition", () => {
	it("declares what the lead set: 2 to 4 seats, live and async, to 50, the decision clocks", () => {
		expect(rootle.id).toBe("rootle");
		expect(rootle.title).toBe("Rootle");
		expect(rootle.rulesVersion).toBeGreaterThanOrEqual(1);
		expect(rootle.seats).toEqual({ min: 2, max: 4 });
		expect(rootle.kind).toBe("competitive");
		expect(rootle.paces).toEqual(["live", "async"]);
		expect(rootle.decisionMs).toEqual({ live: 20_000, async: 12 * HOUR });
		expect(ROOTLE_TUNING.target).toBe(50);
		expect(rootle.secretsOf).toBeUndefined();
		expect(rootle.tagline).not.toContain("\u2014");
	});

	it("is the game the registry serves", () => {
		expect(GAMES.rootle).toBe(rootle);
	});
});

describe("rootle · setup", () => {
	it.each([2, 3, 4])("seats %i pigs with empty barns, seat 0 to rootle", (seats) => {
		const state = rootle.setup({ seats, rng: createRng("x"), pace: "async" });
		expect(state).toEqual({
			v: 1,
			seats,
			target: 50,
			barn: Array.from({ length: seats }, () => 0),
			basket: 0,
			turn: 0,
			faces: [],
			lastRound: null,
			log: [],
			over: false,
		});
		expect(JSON.parse(JSON.stringify(state))).toEqual(state);
		expect(rootle.activeSeats(state)).toEqual([0]);
		expect(rootle.result(state)).toBeNull();
	});
});

// ── Rolling ──────────────────────────────────────────────────────────────────

describe("rootle · rolling", () => {
	it("drops a 2 to 6 into the basket and lets the pig roll again", () => {
		const first = play(fresh(), 0, { type: "roll" }, dice(4));
		expect(first.state).toMatchObject({ basket: 4, faces: [4], turn: 0, barn: [0, 0] });
		expect(first.events).toEqual([{ type: "roll", seat: 0, face: 4, basket: 4 }]);
		const second = play(first.state, 0, { type: "roll" }, dice(6));
		expect(second.state).toMatchObject({ basket: 10, faces: [4, 6], turn: 0 });
		expect(second.events).toEqual([{ type: "roll", seat: 0, face: 6, basket: 10 }]);
		expect(rootle.activeSeats(second.state)).toEqual([0]);
	});

	it("reads every face off ctx.rng as 1 + int(6), and only 2 to 6 pay their pips", () => {
		for (const face of [2, 3, 4, 5, 6]) {
			expect(play(fresh(), 0, { type: "roll" }, dice(face)).state.basket).toBe(face);
		}
		expect(play(fresh(), 0, { type: "roll" }, dice(1)).state.basket).toBe(0);
	});

	it("lets the Hungerer eat the basket, logs a bust and hands the die on", () => {
		const midTurn = fresh(2, { basket: 10, faces: [4, 6], barn: [7, 3] });
		const { state, events } = play(midTurn, 0, { type: "roll" }, dice(1));
		expect(state).toMatchObject({ basket: 0, faces: [], turn: 1, barn: [7, 3], over: false });
		expect(state.log).toEqual([{ seat: 0, faces: [4, 6, 1], banked: 0, end: "bust" }]);
		expect(events).toEqual([
			{ type: "roll", seat: 0, face: 1, basket: 0 },
			{ type: "bust", seat: 0, lost: 10 },
			{ type: "turn", seat: 1, last: false },
		]);
	});

	it("ends the turn on a first-roll Hungerer, with nothing lost", () => {
		const { state, events } = play(fresh(3, { turn: 2 }), 2, { type: "roll" }, dice(1));
		expect(state.turn).toBe(0);
		expect(events).toContainEqual({ type: "bust", seat: 2, lost: 0 });
		expect(state.log[0]).toEqual({ seat: 2, faces: [1], banked: 0, end: "bust" });
	});
});

// ── Trotting home ────────────────────────────────────────────────────────────

describe("rootle · trotting home", () => {
	it("is refused before the first roll of a turn", () => {
		const state = fresh();
		expect(rootle.apply(state, 0, { type: "hold" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("banks the basket, logs the turn and hands the die to the next pig", () => {
		const midTurn = fresh(2, { basket: 13, faces: [4, 6, 3], barn: [5, 20] });
		const { state, events } = play(midTurn, 0, { type: "hold" });
		expect(state).toMatchObject({ barn: [18, 20], basket: 0, faces: [], turn: 1, lastRound: null });
		expect(state.log).toEqual([{ seat: 0, faces: [4, 6, 3], banked: 13, end: "hold" }]);
		expect(events).toEqual([
			{ type: "hold", seat: 0, banked: 13, barn: 18 },
			{ type: "turn", seat: 1, last: false },
		]);
	});

	it("goes round the table in seat order and wraps", () => {
		let state = fresh(3);
		const order: Seat[] = [];
		for (let i = 0; i < 6; i++) {
			order.push(state.turn);
			state = play(play(state, state.turn, { type: "roll" }, dice(2)).state, state.turn, { type: "hold" }).state;
		}
		expect(order).toEqual([0, 1, 2, 0, 1, 2]);
	});
});

// ── Validation ───────────────────────────────────────────────────────────────

describe("rootle · validation", () => {
	it("refuses a pig out of turn and anything after the end, leaving the state alone", () => {
		const state = deepFreeze(fresh(3));
		expect(rootle.apply(state, 1, { type: "roll" }, ctx(dice(3)))).toEqual({ ok: false, error: "not_your_turn" });
		expect(rootle.apply(state, 7, { type: "roll" }, ctx(dice(3)))).toEqual({ ok: false, error: "not_your_turn" });
		const over = deepFreeze(fresh(2, { over: true }));
		expect(rootle.apply(over, 0, { type: "roll" }, ctx(dice(3)))).toEqual({ ok: false, error: "game_over" });
		expect(rootle.activeSeats(over)).toEqual([]);
	});

	it("parses only a bare { type } of roll or hold", () => {
		expect(rootle.parseAction({ type: "roll" })).toEqual({ type: "roll" });
		expect(rootle.parseAction({ type: "hold" })).toEqual({ type: "hold" });
		for (const raw of [
			null,
			undefined,
			"roll",
			3,
			[],
			["roll"],
			{},
			{ type: "resign" },
			{ type: "emote", id: "heart" },
			{ type: "ROLL" },
			{ type: "roll", n: 2 },
			{ type: "hold", basket: 50 },
			{ type: 1 },
		]) {
			expect(rootle.parseAction(raw)).toBeNull();
		}
	});

	it("never mutates the state it is given", () => {
		const midTurn = deepFreeze(fresh(3, { basket: 9, faces: [4, 5], barn: [10, 48, 2] }));
		expect(() => rootle.apply(midTurn, 0, { type: "roll" }, ctx(dice(6)))).not.toThrow();
		expect(() => rootle.apply(midTurn, 0, { type: "roll" }, ctx(dice(1)))).not.toThrow();
		expect(() => rootle.apply(midTurn, 0, { type: "hold" }, ctx())).not.toThrow();
		expect(() => rootle.onTimeout(midTurn, 0, ctx())).not.toThrow();
		expect(() => rootle.onTimeout(midTurn, 0, ctx(dice(), [false, true, true]))).not.toThrow();
		const lastRound = deepFreeze(fresh(3, { barn: [50, 10, 2], lastRound: { leader: 0, owed: [2] }, turn: 1, basket: 4, faces: [4] }));
		expect(() => rootle.apply(lastRound, 1, { type: "hold" }, ctx())).not.toThrow();
	});
});

// ── The last round ───────────────────────────────────────────────────────────

describe("rootle · the last round", () => {
	it("starts when a pig trots home with 50 or more: every other pig is owed one last turn, in order", () => {
		const nearly = fresh(4, { turn: 1, barn: [12, 45, 30, 8], basket: 5, faces: [5] });
		const { state, events } = play(nearly, 1, { type: "hold" });
		expect(state.barn[1]).toBe(50);
		expect(state.lastRound).toEqual({ leader: 1, owed: [3, 0] });
		expect(state.turn).toBe(2);
		expect(events).toEqual([
			{ type: "hold", seat: 1, banked: 5, barn: 50 },
			{ type: "lastRound", leader: 1 },
			{ type: "turn", seat: 2, last: true },
		]);
	});

	it("can start on the same turn a pig reaches 50 after a single roll", () => {
		const rolled = play(fresh(2, { barn: [48, 0] }), 0, { type: "roll" }, dice(2)).state;
		const { state } = play(rolled, 0, { type: "hold" });
		// Seat 1's last turn is already under way: it left `owed` for `turn`.
		expect(state.lastRound).toEqual({ leader: 0, owed: [] });
		expect(state.turn).toBe(1);
	});

	it("never gives the leader a second turn and ends after the last pig owed", () => {
		const leader = play(fresh(2, { barn: [47, 30], basket: 5, faces: [5] }), 0, { type: "hold" }).state;
		expect(leader.lastRound).toEqual({ leader: 0, owed: [] });
		expect(leader.turn).toBe(1);
		const rolled = play(leader, 1, { type: "roll" }, dice(6)).state;
		const { state, events } = play(rolled, 1, { type: "roll" }, dice(1));
		expect(state.over).toBe(true);
		expect(rootle.activeSeats(state)).toEqual([]);
		expect(events).toEqual([
			{ type: "roll", seat: 1, face: 1, basket: 0 },
			{ type: "bust", seat: 1, lost: 6 },
			{ type: "end" },
		]);
		expect(rootle.result(state)).toEqual({
			kind: "win",
			winners: [0],
			scores: [52, 30],
			summary: "trotted home with 52 to 30",
		});
	});

	it("is not restarted by a second pig passing 50; the bigger barn wins", () => {
		let state = fresh(3, { barn: [50, 40, 12], lastRound: { leader: 0, owed: [2] }, turn: 1, basket: 21, faces: [6, 5, 4, 6] });
		const held = play(state, 1, { type: "hold" });
		state = held.state;
		expect(held.events).not.toContainEqual(expect.objectContaining({ type: "lastRound" }));
		expect(state.lastRound).toEqual({ leader: 0, owed: [] });
		expect(state.turn).toBe(2);
		state = play(state, 2, { type: "roll" }, dice(1)).state;
		expect(rootle.result(state)).toMatchObject({ kind: "win", winners: [1], scores: [50, 61, 12] });
		expect(rootle.result(state)?.summary).toBe("trotted home with 61 to 50 to 12");
	});

	it("shares the win between equal barns", () => {
		const state = play(fresh(3, { barn: [52, 46, 0], lastRound: { leader: 0, owed: [] }, turn: 1, basket: 6, faces: [6] }), 1, {
			type: "hold",
		}).state;
		expect(state.over).toBe(true);
		expect(rootle.result(state)).toEqual({
			kind: "draw",
			winners: [0, 1],
			scores: [52, 52, 0],
			summary: "shared the win at 52",
		});
	});
});

// ── Timeouts ─────────────────────────────────────────────────────────────────

describe("rootle · timeouts", () => {
	it("passes an untouched turn with nothing banked", () => {
		const state = fresh(3, { turn: 1, barn: [4, 9, 0] });
		const { state: next, events } = rootle.onTimeout(state, 1, ctx());
		expect(next).toMatchObject({ turn: 2, barn: [4, 9, 0], basket: 0, faces: [] });
		expect(next.log).toEqual([{ seat: 1, faces: [], banked: 0, end: "pass" }]);
		expect(events).toEqual([
			{ type: "pass", seat: 1 },
			{ type: "turn", seat: 2, last: false },
		]);
		expect(rootle.activeSeats(next)).not.toContain(1);
	});

	it("trots a pig home with what it rolled once it has rolled", () => {
		const state = fresh(2, { basket: 9, faces: [4, 5], barn: [10, 0] });
		const { state: next, events } = rootle.onTimeout(state, 0, ctx());
		expect(next).toMatchObject({ barn: [19, 0], turn: 1, basket: 0, faces: [] });
		expect(next.log).toEqual([{ seat: 0, faces: [4, 5], banked: 9, end: "hold" }]);
		expect(events).toEqual([
			{ type: "hold", seat: 0, banked: 9, barn: 19 },
			{ type: "turn", seat: 1, last: false },
		]);
		expect(rootle.activeSeats(next)).not.toContain(0);
	});

	it("can start the last round from a timed-out trot home, and end it", () => {
		const timedOut = rootle.onTimeout(fresh(2, { barn: [44, 20], basket: 8, faces: [3, 5] }), 0, ctx());
		expect(timedOut.state.lastRound).toEqual({ leader: 0, owed: [] });
		expect(timedOut.state.turn).toBe(1);
		expect(timedOut.events).toContainEqual({ type: "lastRound", leader: 0 });
		const ended = rootle.onTimeout(timedOut.state, 1, ctx());
		expect(ended.state.over).toBe(true);
		expect(ended.events).toEqual([{ type: "pass", seat: 1 }, { type: "end" }]);
		expect(rootle.result(ended.state)?.winners).toEqual([0]);
	});

	it("changes nothing for a seat whose turn it is not, or once the game is over", () => {
		const state = fresh(3);
		expect(rootle.onTimeout(state, 2, ctx())).toEqual({ state });
		const over = fresh(2, { over: true });
		expect(rootle.onTimeout(over, 0, ctx())).toEqual({ state: over });
	});

	it("always leaves the timed-out pig owing nothing, at every point of a real game", () => {
		let checked = 0;
		for (let i = 0; i < 40; i++) {
			playOut(rootle, {
				seats: 2 + (i % 3),
				seed: `owes-${i}`,
				onRevision: (room) => {
					if (room.phase !== "playing") return;
					const state = gameOf(room);
					const seat = state.turn;
					const next = rootle.onTimeout(state, seat, ctx(createRng(`t${room.rev}`))).state;
					expect(next.over || next.turn !== seat).toBe(true);
					checked++;
				},
			});
		}
		expect(checked).toBeGreaterThan(500);
	});
});

// ── Pigs who leave ───────────────────────────────────────────────────────────

describe("rootle · pigs who leave the table", () => {
	it("hands the die past a pig who has left", () => {
		const midTurn = fresh(3, { basket: 6, faces: [6] });
		expect(play(midTurn, 0, { type: "hold" }, dice(), [true, false, true]).state.turn).toBe(2);
		const lastSeat = fresh(3, { turn: 1, basket: 6, faces: [6] });
		expect(play(lastSeat, 1, { type: "hold" }, dice(), [false, true, false]).state.turn).toBe(1);
	});

	it("leaves a pig who has left out of the last round", () => {
		const nearly = fresh(4, { barn: [46, 1, 2, 3], basket: 4, faces: [4] });
		const { state } = play(nearly, 0, { type: "hold" }, dice(), [true, true, false, true]);
		expect(state.lastRound).toEqual({ leader: 0, owed: [3] });
		expect(state.turn).toBe(1);
	});

	it("skips a pig owed a last turn who left after the round began", () => {
		const state = fresh(3, { barn: [50, 20, 30], lastRound: { leader: 0, owed: [2] }, turn: 1, basket: 3, faces: [3] });
		const { state: next, events } = play(state, 1, { type: "hold" }, dice(), [true, true, false]);
		expect(next.over).toBe(true);
		expect(events).toEqual([{ type: "hold", seat: 1, banked: 3, barn: 23 }, { type: "end" }]);
	});

	it("loses the basket of a pig who leaves mid-turn and hands the die on", () => {
		const state = fresh(3, { barn: [40, 5, 5], basket: 12, faces: [6, 6] });
		const { state: next, events } = rootle.onTimeout(state, 0, ctx(dice(), [false, true, true]));
		expect(next).toMatchObject({ barn: [40, 5, 5], turn: 1, lastRound: null, basket: 0 });
		expect(next.log).toEqual([{ seat: 0, faces: [6, 6], banked: 0, end: "pass" }]);
		expect(events).toEqual([
			{ type: "pass", seat: 0, left: true },
			{ type: "turn", seat: 1, last: false },
		]);
	});

	it("in a real room: a pig who walks out mid-turn hands on, keeps its barn, and never wins", () => {
		let room: RoomState | null = null;
		for (let i = 0; i < 40 && room === null; i++) {
			const start = table(3, `walkout-${i}`);
			const rolled = applyAction(start, rootle, 0, { type: "roll" }, NOW + 4_000);
			if (rolled.ok && gameOf(rolled.room).faces.length > 0) room = rolled.room;
		}
		if (!room) throw new Error("no seed rolled a 2 to 6 first");
		const rolledFace = gameOf(room).faces[0];
		const gone = markGone(room, rootle, 0, NOW + 5_000);
		expect(gone.phase).toBe("playing");
		expect(gameOf(gone).turn).toBe(1);
		expect(gameOf(gone).barn[0]).toBe(0);
		expect(gameOf(gone).log.at(-1)).toEqual({ seat: 0, faces: [rolledFace], banked: 0, end: "pass" });
		expect(gone.events).toEqual([
			{ type: "gone", seat: 0 },
			{ type: "pass", seat: 0, left: true },
			{ type: "turn", seat: 1, last: false },
		]);
		const ended = finish(gone, NOW + 6_000);
		expect(ended.phase).toBe("ended");
		expect(ended.result?.winners).not.toContain(0);
		// Seat 0 never had another turn after it left.
		expect(gameOf(ended).log.filter((t) => t.seat === 0)).toHaveLength(1);
	});

	it("in a real room: the last pig standing takes it when the other walks out", () => {
		const room = markGone(table(2, "forfeit"), rootle, 1, NOW + 4_000);
		expect(room.result).toMatchObject({ kind: "win", winners: [0], reason: "forfeit" });
	});
});

// ── Deadlines ────────────────────────────────────────────────────────────────

describe("rootle · deadlines", () => {
	it("gives a hand-off the long clock and a turn in progress the short one", () => {
		const handOff = fresh();
		const midTurn = fresh(2, { basket: 4, faces: [4] });
		expect(rootle.deadlineMs?.(handOff, "live")).toBe(20_000);
		expect(rootle.deadlineMs?.(midTurn, "live")).toBe(10_000);
		expect(rootle.deadlineMs?.(handOff, "async")).toBe(12 * HOUR);
		expect(rootle.deadlineMs?.(midTurn, "async")).toBe(60_000);
		expect(rootle.deadlineMs?.(fresh(2, { over: true }), "live")).toBeNull();
	});

	it.each(["live", "async"] as const)("is how the %s room arms its clock", (pace) => {
		let room = table(2, `clock-${pace}`, pace);
		expect(room.deadline).toBe(NOW + 3_000 + (pace === "live" ? 20_000 : 12 * HOUR));
		let now = NOW + 4_000;
		for (let i = 0; i < 12 && room.phase === "playing"; i++) {
			const res = applyAction(room, rootle, room.activeSeats[0], { type: "roll" }, now);
			if (!res.ok) throw new Error(res.error);
			room = res.room;
			const midTurn = gameOf(room).faces.length > 0;
			const expected = pace === "live" ? (midTurn ? 10_000 : 20_000) : midTurn ? 60_000 : 12 * HOUR;
			expect(room.deadline).toBe(now + expected);
			now += 1_000;
		}
	});

	it("resolves a missed deadline through the room engine", () => {
		const room = table(2, "missed");
		const timedOut = applyTimeouts(room, rootle, room.deadline as number);
		expect(gameOf(timedOut).turn).toBe(1);
		expect(gameOf(timedOut).log).toEqual([{ seat: 0, faces: [], banked: 0, end: "pass" }]);
		expect(timedOut.events).toEqual([{ type: "timeout", seat: 0 }, { type: "pass", seat: 0 }, { type: "turn", seat: 1, last: false }]);
		expect(timedOut.seats[0]?.missed).toBe(1);
	});
});

// ── View, log, JSON ──────────────────────────────────────────────────────────

describe("rootle · view, log and JSON", () => {
	it("shows every seat the whole state: nothing in Rootle is hidden", () => {
		const state = fresh(3, { basket: 7, faces: [3, 4], barn: [1, 2, 3] });
		for (const seat of [0, 1, 2]) expect(rootle.view(state, seat)).toEqual(state);
		const room = table(3, "view");
		expect(snapshotFor(room, rootle, 2).view).toEqual(room.game);
	});

	it("keeps the last twelve turns", () => {
		let state = fresh(2);
		for (let i = 0; i < 15; i++) state = rootle.onTimeout(state, state.turn, ctx()).state;
		expect(state.log).toHaveLength(ROOTLE_TUNING.logLength);
		expect(state.log).toHaveLength(12);
		expect(state.log.every((t) => t.end === "pass")).toBe(true);
		expect(state.log[0].seat).toBe(1);
	});

	it("is plain JSON at every revision of a real game", () => {
		for (let i = 0; i < 12; i++) {
			playOut(rootle, {
				seats: 2 + (i % 3),
				seed: `json-${i}`,
				timeoutRate: 0.1,
				onRevision: (room) => {
					const state = room.game;
					expect(JSON.parse(JSON.stringify(state))).toEqual(state);
					expect(JSON.parse(JSON.stringify(room.events))).toEqual(room.events);
				},
			});
		}
	});
});

// ── Result ───────────────────────────────────────────────────────────────────

describe("rootle · result", () => {
	it("is null while play goes on", () => {
		expect(rootle.result(fresh(2, { barn: [60, 2], lastRound: { leader: 0, owed: [1] }, turn: 1 }))).toBeNull();
	});

	it("names nobody and never wears a zero", () => {
		expect(rootleSummary([54, 47, 31], [0])).toBe("trotted home with 54 to 47 to 31");
		expect(rootleSummary([31, 54, 47], [1])).toBe("trotted home with 54 to 47 to 31");
		expect(rootleSummary([51, 0], [0])).toBe("trotted home with 51");
		expect(rootleSummary([0, 51, 20, 0], [1])).toBe("trotted home with 51 to 20");
		expect(rootleSummary([52, 52, 31], [0, 1])).toBe("shared the win at 52 to 31");
		expect(rootleSummary([52, 52], [0, 1])).toBe("shared the win at 52");
		expect(rootleSummary([0, 0], [0, 1])).toBe("nobody trotted home");
		for (const line of [rootleSummary([54, 47, 31], [0]), rootleSummary([52, 52, 31], [0, 1])]) {
			expect(line).not.toMatch(/Pig|\u2014/);
		}
	});
});

// ── The practice pig ─────────────────────────────────────────────────────────

describe("rootle · the practice pig", () => {
	it("always rolls at a hand-off, and never trots home before its first roll", () => {
		for (let k = 0; k <= 4; k++) {
			expect(rootle.bot(fresh(2, { barn: [49, 0] }), 0, fixedInt(k))).toEqual({ type: "roll" });
		}
	});

	it("holds at twenty, give or take two", () => {
		const at = (basket: number, k: number) =>
			rootle.bot(fresh(2, { basket, faces: [basket] }), 0, fixedInt(k))?.type;
		for (let k = 0; k <= 4; k++) {
			expect(at(17, k)).toBe("roll");
			expect(at(22, k)).toBe("hold");
		}
		expect(at(18, 0)).toBe("hold");
		expect(at(18, 1)).toBe("roll");
		expect(at(21, 3)).toBe("hold");
		expect(at(21, 4)).toBe("roll");
	});

	it("finishes when it can", () => {
		expect(rootle.bot(fresh(2, { barn: [44, 0], basket: 6, faces: [6] }), 0, fixedInt(4))).toEqual({ type: "hold" });
		expect(rootle.bot(fresh(2, { barn: [44, 0], basket: 5, faces: [5] }), 0, fixedInt(0))).toEqual({ type: "roll" });
	});

	it("on its last turn holds only once it beats the best barn, even past 50", () => {
		const last = (basket: number) =>
			rootle.bot(fresh(3, { barn: [61, 40, 55], lastRound: { leader: 0, owed: [2] }, turn: 1, basket, faces: [basket] }), 1, fixedInt(0))
				?.type;
		expect(last(10)).toBe("roll");
		expect(last(21)).toBe("roll");
		expect(last(22)).toBe("hold");
	});

	it("has nothing to do when it is not its turn or the game is over", () => {
		expect(rootle.bot(fresh(2), 1, fixedInt(0))).toBeNull();
		expect(rootle.bot(fresh(2, { over: true }), 0, fixedInt(0))).toBeNull();
	});
});

// ── Board helpers ────────────────────────────────────────────────────────────

describe("rootle · read-only helpers for the board", () => {
	it("knows the face the die last landed on, across hand-offs", () => {
		expect(rootleLastFace(fresh())).toBeNull();
		expect(rootleLastFace(fresh(2, { faces: [3, 5] }))).toBe(5);
		const afterBust = play(fresh(2, { basket: 4, faces: [4] }), 0, { type: "roll" }, dice(1)).state;
		expect(rootleLastFace(afterBust)).toBe(1);
		const afterPass = rootle.onTimeout(afterBust, 1, ctx()).state;
		expect(rootleLastFace(afterPass)).toBe(1);
	});

	it("counts a turn's haul, says when a pig may trot home, and who is up next", () => {
		expect(rootleTurnHaul({ seat: 0, faces: [4, 6, 1], banked: 0, end: "bust" })).toBe(10);
		expect(rootleCanTrotHome(fresh(), 0)).toBe(false);
		expect(rootleCanTrotHome(fresh(2, { faces: [2], basket: 2 }), 0)).toBe(true);
		expect(rootleCanTrotHome(fresh(2, { faces: [2], basket: 2 }), 1)).toBe(false);
		const all = [true, true, true, true];
		expect(rootleUpNext(fresh(4, { turn: 2 }), all)).toEqual([3, 0, 1]);
		expect(rootleUpNext(fresh(4, { turn: 2 }), [true, false, true, true])).toEqual([3, 0]);
		expect(rootleUpNext(fresh(3, { lastRound: { leader: 0, owed: [2] }, turn: 1 }), all)).toEqual([2]);
		expect(rootleBestOther(fresh(3, { barn: [61, 40, 55] }), 1, all)).toBe(61);
		expect(rootleBestOther(fresh(3, { barn: [61, 40, 55] }), 1, [false, true, true])).toBe(55);
	});
});

// ── Determinism and fuzz ─────────────────────────────────────────────────────

describe("rootle · whole tables", () => {
	it("replays the same game from the same seed", () => {
		const a = playOut(rootle, { seats: 3, seed: "rootle-replay", timeoutRate: 0.05 });
		const b = playOut(rootle, { seats: 3, seed: "rootle-replay", timeoutRate: 0.05 });
		expect(b.room.game).toEqual(a.room.game);
		expect(b.room.log).toEqual(a.room.log);
		expect(b.room.result).toEqual(a.room.result);
		const c = playOut(rootle, { seats: 3, seed: "rootle-other", timeoutRate: 0.05 });
		expect(c.room.log).not.toEqual(a.room.log);
	});

	it("plays practice tables to a complete race when nobody misses a turn", () => {
		const run = fuzz(rootle, 40);
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		for (const report of run.reports) {
			expect(report.room.result?.reason).toBe("complete");
			const state = gameOf(report.room);
			expect(state.lastRound).not.toBeNull();
			expect(state.barn[state.lastRound?.leader ?? 0]).toBeGreaterThanOrEqual(50);
			expect(report.room.result?.winners.length).toBeGreaterThan(0);
		}
	});

	it.each(["live", "async"] as const)("fuzzes 200 %s tables a seat count to the end: no stalls, no illegal moves, no leaks", (pace) => {
		const run = fuzz(rootle, 200, { timeoutRate: 0.1, pace });
		expect(run.reports).toHaveLength(600);
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
	});

	it("plays on around a pig who leaves, who is never crowned", () => {
		for (let i = 0; i < 60; i++) {
			const seats = 3 + (i % 2);
			const leaving = i % seats;
			const report = playOut(rootle, { seats, seed: `leave-${i}`, leave: { seat: leaving, atStep: 3 + (i % 17) } });
			expect(report.room.phase).toBe("ended");
			expect(report.illegalBotMoves).toEqual([]);
			expect(report.room.result?.winners).not.toContain(leaving);
		}
	});

	it("emits only the events the board knows", () => {
		const known = new Set(["start", "timeout", "gone", "idle", "turn", "roll", "bust", "hold", "lastRound", "pass", "end"]);
		const seen = new Set<string>();
		for (let i = 0; i < 30; i++) {
			playOut(rootle, {
				seats: 2 + (i % 3),
				seed: `cues-${i}`,
				timeoutRate: 0.1,
				onRevision: (room) => room.events.forEach((e: GameEvent) => seen.add(e.type)),
			});
		}
		for (const type of seen) expect(known.has(type)).toBe(true);
		for (const type of ["turn", "roll", "bust", "hold", "lastRound", "pass", "end"]) expect(seen.has(type)).toBe(true);
	});
});
