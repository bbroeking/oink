// Mud Volley · Wind-up (multiplayer/games/mud_volley/rules.ts) against its
// spec (docs/multiplayer/explorations/02-arcade-and-party.md §4.1 with the
// lead's review): the payoff table, alternating tossers, seeded wind-ups,
// the live beat (early close, the shared deadline, the next toss opening in
// the same step), seeded-random fallbacks, sealed-is-sealed, the envelope,
// secrecy (markers and non-interference), determinism, the practice pig and
// the fuzz through the real room engine.

import {
	EXCHANGES,
	LANES,
	VOLLEY_BOTS,
	VOLLEY_PAYOFF,
	VOLLEY_TIMING,
	attackerOf,
	depthStats,
	envelopeSlots,
	loudestRow,
	mud_volley,
	scoreToss,
	summaryLine,
	volleyBot,
	type Lane,
	type VolleyAction,
	type VolleyRow,
	type VolleyState,
	type VolleyView,
} from "../../multiplayer/games/mud_volley/rules";
import {
	applyAction,
	applyTimeouts,
	beginCountdown,
	createRoom,
	snapshotFor,
	startGame,
	takeSeat,
	type RoomState,
} from "../../multiplayer/engine";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import { createRng } from "../../multiplayer/rng";
import type { Pace, Seat, StepContext } from "../../multiplayer/types";

const NOW = 1_700_000_000_000;
const START = NOW + 3_000;
const T = VOLLEY_TIMING;

function ctx(now = NOW, seed = "ctx", pace: Pace = "live"): StepContext {
	return { now, rng: createRng(seed), pace, present: [true, true] };
}

function fresh(pace: Pace = "live", seed = "fresh"): VolleyState {
	return mud_volley.setup({ seats: 2, rng: createRng(seed), pace });
}

/** A state with a known schedule: who tosses first and the six wind-ups. */
function known(firstAttacker: Seat, windups: Lane[], pace: Pace = "live"): VolleyState {
	return {
		...fresh(pace),
		firstAttacker,
		windups: windups.map((lane, ex) => ({ lane, seal: `test-windup-${ex}-${lane}` })),
	};
}

function step(s: VolleyState, seat: Seat, action: VolleyAction, now = NOW) {
	const res = mud_volley.apply(s, seat, action, ctx(now));
	if (!res.ok) throw new Error(`apply refused: ${res.error}`);
	return res;
}

/** Both pigs lock a toss: the tosser `toss`, the catcher `catchLane`. */
function playToss(s: VolleyState, toss: Lane, catchLane: Lane, now = NOW) {
	const attacker = attackerOf(s.firstAttacker, s.exchange);
	const first = step(s, attacker, { type: "lane", lane: toss }, now);
	return step(first.state, 1 - attacker, { type: "lane", lane: catchLane }, now);
}

function liveTable(seed = "mv-seed"): RoomState {
	const room = createRoom({ roomId: "00000000-mv01", game: mud_volley, pace: "live", source: "queue", seatCount: 2, seats: testCards(2), seed, now: NOW });
	return startGame(beginCountdown(room, mud_volley, NOW), mud_volley, START);
}

function act(room: RoomState, seat: Seat, action: VolleyAction, at: number): RoomState {
	const res = applyAction(room, mud_volley, seat, action, at);
	if (!res.ok) throw new Error(`action refused: ${res.error}`);
	return res.room;
}

const game = (room: RoomState) => room.game as VolleyState;

function row(ex: number, attacker: Seat, outcome: VolleyRow["outcome"]): VolleyRow {
	const points = outcome === "splat2" ? 2 : 1;
	return {
		ex,
		attacker,
		windup: "L",
		toss: outcome === "splat1" ? "M" : "L",
		catchLane: outcome === "catch" ? "L" : "R",
		outcome,
		scorer: outcome === "catch" ? 1 - attacker : attacker,
		points,
		fallback: [false, false],
		at: NOW,
	};
}

describe("mud volley · the payoff table", () => {
	it("pays a big splat 2, the flick 1, and a clean catch 1 to the catcher", () => {
		expect(scoreToss("L", "L", "M")).toEqual({ outcome: "splat2", toTosser: true, points: 2 });
		expect(scoreToss("L", "R", "M")).toEqual({ outcome: "splat1", toTosser: true, points: 1 });
		expect(scoreToss("L", "L", "L")).toEqual({ outcome: "catch", toTosser: false, points: 1 });
		expect(scoreToss("L", "R", "R")).toEqual({ outcome: "catch", toTosser: false, points: 1 });
		expect(VOLLEY_PAYOFF).toEqual({ bigSplat: 2, splat: 1, catch: 1 });
	});

	it("scores each row to the right pig through apply", () => {
		let s = known(0, ["L", "M", "R", "L", "M", "R"]);
		// Toss 0: seat 0 follows through on L, seat 1 guards M.
		s = playToss(s, "L", "M").state;
		expect(s.history[0]).toMatchObject({ ex: 0, attacker: 0, windup: "L", toss: "L", catchLane: "M", outcome: "splat2", scorer: 0, points: 2 });
		expect(s.score).toEqual([2, 0]);
		// Toss 1: seat 1 flicks off its M wind-up to R, seat 0 guards L.
		s = playToss(s, "R", "L").state;
		expect(s.history[1]).toMatchObject({ attacker: 1, windup: "M", outcome: "splat1", scorer: 1, points: 1 });
		expect(s.score).toEqual([2, 1]);
		// Toss 2: seat 0 tosses R (its wind-up), seat 1 is waiting in R.
		s = playToss(s, "R", "R").state;
		expect(s.history[2]).toMatchObject({ attacker: 0, outcome: "catch", scorer: 1, points: 1 });
		expect(s.score).toEqual([2, 2]);
	});
});

describe("mud volley · tossers and wind-ups", () => {
	it("alternates the tosser from a seeded first tosser", () => {
		expect([0, 1, 2, 3, 4, 5].map((ex) => attackerOf(0, ex))).toEqual([0, 1, 0, 1, 0, 1]);
		expect([0, 1, 2, 3, 4, 5].map((ex) => attackerOf(1, ex))).toEqual([1, 0, 1, 0, 1, 0]);
		const firsts = new Set(Array.from({ length: 40 }, (_, i) => fresh("live", `first-${i}`).firstAttacker));
		expect(firsts).toEqual(new Set([0, 1]));
		const played = playOut(mud_volley, { seats: 2, seed: "alternate" }).room;
		const g = game(played);
		expect(g.history.map((r) => r.attacker)).toEqual([0, 1, 2, 3, 4, 5].map((ex) => attackerOf(g.firstAttacker, ex)));
	});

	it("deals six wind-ups from the seed, the same every time for one seed", () => {
		const a = fresh("live", "deal");
		expect(a.windups).toHaveLength(EXCHANGES);
		expect(fresh("live", "deal")).toEqual(a);
		const schedules = new Set(Array.from({ length: 30 }, (_, i) => fresh("live", `deal-${i}`).windups.map((w) => w.lane).join("")));
		expect(schedules.size).toBeGreaterThan(20);
		const lanes = new Set(Array.from({ length: 30 }, (_, i) => fresh("live", `deal-${i}`).windups.map((w) => w.lane)).flat());
		expect(lanes).toEqual(new Set(LANES));
	});

	it("shows a live pig only the wind-up of the open toss, and an envelope pig all six", () => {
		const live = known(1, ["R", "L", "M", "M", "L", "R"]);
		const v = mud_volley.view(live, 0);
		expect(v).toMatchObject({ windup: "R", windups: null, attacker: 1, role: "catch", exchange: 0 });
		expect(mud_volley.view(live, 1)).toMatchObject({ windup: "R", role: "toss" });
		const env = known(1, ["R", "L", "M", "M", "L", "R"], "async");
		expect(mud_volley.view(env, 0)).toMatchObject({ windup: null, windups: ["R", "L", "M", "M", "L", "R"], role: null });
	});
});

describe("mud volley · the live beat", () => {
	it("opens the first toss after the wind-up, its window stamped from the table's start", () => {
		const live = mud_volley.setup({ seats: 2, rng: createRng("start"), pace: "live", now: NOW });
		expect(live.commitOpensAt).toBe(NOW + T.windupMs);
		expect(live.commitClosesAt).toBe(NOW + T.windupMs + T.commitMs);
		const v = mud_volley.view(live, 0);
		expect(v).toMatchObject({ phase: "commit", exchange: 0, beatMs: T.windupMs, windowMs: T.commitMs, commitOpensAt: NOW + T.windupMs });
		expect(mud_volley.deadlineMs?.(live, "live")).toBe(T.windupMs + T.commitMs + T.lateGraceMs);
		// An envelope has no window, and a setup without a clock stamps none.
		const env = mud_volley.setup({ seats: 2, rng: createRng("start"), pace: "async", now: NOW });
		expect([env.commitOpensAt, env.commitClosesAt]).toEqual([null, null]);
		expect(mud_volley.deadlineMs?.(env, "async")).toBe(T.envelopeMs);
		expect([fresh().commitOpensAt, fresh().commitClosesAt]).toEqual([null, null]);
		// Through the room: the engine passes the start, and the deadline is the
		// visible window plus the late grace.
		const room = liveTable();
		expect(game(room).commitOpensAt).toBe(START + T.windupMs);
		expect(game(room).commitClosesAt).toBe(START + T.windupMs + T.commitMs);
		expect(room.deadline).toBe((game(room).commitClosesAt as number) + T.lateGraceMs);
	});

	it("closes early when both lanes are in and opens the next toss in the same step", () => {
		const s = known(0, ["L", "M", "R", "L", "M", "R"]);
		const first = step(s, 0, { type: "lane", lane: "L" }, NOW);
		expect(first.events).toEqual([{ type: "locked", seat: 0 }]);
		expect(first.state.exchange).toBe(0);
		const second = step(first.state, 1, { type: "lane", lane: "R" }, NOW + 2_000);
		const next = second.state;
		expect(next.phase).toBe("commit");
		expect(next.exchange).toBe(1);
		expect(next.commits).toEqual([null, null]);
		expect(next.commitOpensAt).toBe(NOW + 2_000 + T.settleMs + T.revealMs);
		expect(next.commitClosesAt).toBe(NOW + 2_000 + T.settleMs + T.revealMs + T.commitMs);
		expect(second.events?.map((e) => e.type)).toEqual(["locked", "reveal", "windup"]);
		expect(second.events?.[2]).toEqual({ type: "windup", ex: 1, attacker: 1, lane: "M" });
		const v = mud_volley.view(next, 0);
		expect(v.lastReveal).toMatchObject({ ex: 0, toss: "L", catchLane: "R", outcome: "splat2", at: NOW + 2_000 });
		expect(v).toMatchObject({ beatMs: T.settleMs + T.revealMs, windup: "M", role: "catch", yourLane: null, rivalLocked: false });
		expect(mud_volley.deadlineMs?.(next, "live")).toBe(T.settleMs + T.revealMs + T.commitMs + T.lateGraceMs);
	});

	it("arms the engine's deadline with the late grace inside it, and keeps it when the first pig locks", () => {
		let room = liveTable();
		expect(room.activeSeats).toEqual([0, 1]);
		expect(room.deadline).toBe(START + T.windupMs + T.commitMs + T.lateGraceMs);
		const deadline = room.deadline;
		room = act(room, 0, { type: "lane", lane: "M", ex: 0 }, START + 2_000);
		expect(room.deadline).toBe(deadline);
		expect(room.activeSeats).toEqual([1]);
		room = act(room, 1, { type: "lane", lane: "L", ex: 0 }, START + 4_000);
		expect(room.activeSeats).toEqual([0, 1]);
		expect(game(room).exchange).toBe(1);
		expect(room.deadline).toBe((game(room).commitClosesAt as number) + T.lateGraceMs);
		expect(room.deadline).toBe(START + 4_000 + T.settleMs + T.revealMs + T.commitMs + T.lateGraceMs);
		expect(room.events.map((e) => e.type)).toEqual(["locked", "reveal", "windup"]);
	});

	it("plays six tosses to a result", () => {
		let s = fresh("live", "six");
		for (let i = 0; i < EXCHANGES; i++) s = playToss(s, "L", "M", NOW + i).state;
		expect(s.phase).toBe("done");
		expect(s.exchange).toBe(EXCHANGES);
		expect(s.history).toHaveLength(EXCHANGES);
		expect(mud_volley.activeSeats(s)).toEqual([]);
		expect(mud_volley.deadlineMs?.(s, "live")).toBeNull();
		expect(mud_volley.result(s)).not.toBeNull();
		expect(mud_volley.apply(s, 0, { type: "lane", lane: "L" }, ctx())).toEqual({ ok: false, error: "game_over" });
	});
});

describe("mud volley · fallbacks", () => {
	it("gives a missing pig a seeded random lane, flagged, and resolves the toss", () => {
		const s = step(known(0, ["L", "M", "R", "L", "M", "R"]), 0, { type: "lane", lane: "L" }).state;
		const res = mud_volley.onTimeout(s, 1, ctx(NOW + 9_000, "fallback-a"));
		expect(res.state.exchange).toBe(1);
		const r = res.state.history[0];
		expect(r.fallback).toEqual([false, true]);
		expect(LANES).toContain(r.catchLane);
		// The same rng gives the same lane: replays are exact.
		expect(mud_volley.onTimeout(s, 1, ctx(NOW + 9_000, "fallback-a")).state).toEqual(res.state);
		expect(res.events?.map((e) => e.type)).toEqual(["reveal", "windup"]);
	});

	it("draws the fallback lane uniformly, never a fixed lane", () => {
		const s = known(0, ["L", "M", "R", "L", "M", "R"]);
		const counts: Record<Lane, number> = { L: 0, M: 0, R: 0 };
		for (let i = 0; i < 3_000; i++) {
			const timed = mud_volley.onTimeout(s, 0, ctx(NOW, `uniform-${i}`)).state;
			counts[(timed.commits[0] as { lane: Lane }).lane]++;
		}
		for (const lane of LANES) {
			expect(counts[lane]).toBeGreaterThan(900);
			expect(counts[lane]).toBeLessThan(1_100);
		}
	});

	it("resolves a toss both pigs missed with two fallbacks, and lets the engine call the idle table", () => {
		let room = liveTable("both-idle");
		room = applyTimeouts(room, mud_volley, room.deadline as number);
		expect(game(room).history[0].fallback).toEqual([true, true]);
		expect(room.seats.map((s) => s?.missed)).toEqual([1, 1]);
		while (room.phase === "playing") room = applyTimeouts(room, mud_volley, room.deadline as number);
		expect(room.result).toMatchObject({ kind: "no_contest", reason: "ended_early" });
	});

	it("leaves a pig that already locked alone and never resolves a finished game", () => {
		const s = step(fresh(), 0, { type: "lane", lane: "R" }).state;
		expect(mud_volley.onTimeout(s, 0, ctx()).state).toBe(s);
		let done = fresh("live", "done");
		for (let i = 0; i < EXCHANGES; i++) done = playToss(done, "L", "R").state;
		expect(mud_volley.onTimeout(done, 1, ctx()).state).toBe(done);
	});

	it("gives a missing envelope six seeded random lanes, flagged on every row", () => {
		const s = step(fresh("async", "env-fallback"), 0, { type: "envelope", tosses: ["L", "L", "L"], catches: ["M", "M", "M"] }).state;
		const res = mud_volley.onTimeout(s, 1, ctx(NOW, "env-timeout", "async"));
		expect(res.state.phase).toBe("done");
		expect(res.state.history.every((r) => r.fallback[0] === false && r.fallback[1] === true)).toBe(true);
		expect(mud_volley.onTimeout(s, 1, ctx(NOW, "env-timeout", "async")).state).toEqual(res.state);
	});
});

describe("mud volley · sealed is sealed", () => {
	it("treats the same lane again as a free retry and a different lane as illegal", () => {
		const s = step(fresh(), 0, { type: "lane", lane: "M" }).state;
		const again = mud_volley.apply(s, 0, { type: "lane", lane: "M" }, ctx());
		expect(again).toEqual({ ok: true, state: s });
		expect(mud_volley.apply(s, 0, { type: "lane", lane: "L" }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("refuses a lane meant for a toss that already resolved", () => {
		const s = playToss(fresh(), "L", "M").state;
		expect(mud_volley.apply(s, 0, { type: "lane", lane: "L", ex: 0 }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(mud_volley.apply(s, 0, { type: "lane", lane: "L", ex: 1 }, ctx()).ok).toBe(true);
	});

	it("keeps lanes to live tables and envelopes to envelope tables", () => {
		expect(mud_volley.apply(fresh("async"), 0, { type: "lane", lane: "L" }, ctx()).ok).toBe(false);
		expect(mud_volley.apply(fresh("live"), 0, { type: "envelope", tosses: ["L", "L", "L"], catches: ["L", "L", "L"] }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("answers a locked pig through the room with not_your_turn (the engine gates on activeSeats)", () => {
		let room = liveTable();
		room = act(room, 0, { type: "lane", lane: "L", ex: 0 }, START + 1_000);
		expect(applyAction(room, mud_volley, 0, { type: "lane", lane: "L", ex: 0 }, START + 1_500)).toEqual({ ok: false, error: "not_your_turn" });
	});
});

describe("mud volley · the envelope", () => {
	it("parses exactly three tosses and three catches, and nothing else", () => {
		const ok = { type: "envelope", tosses: ["L", "M", "R"], catches: ["R", "R", "L"] };
		expect(mud_volley.parseAction(ok)).toEqual(ok);
		expect(mud_volley.parseAction({ ...ok, extra: 1 })).toEqual(ok);
		expect(mud_volley.parseAction({ ...ok, tosses: ["L", "M"] })).toBeNull();
		expect(mud_volley.parseAction({ ...ok, catches: ["L", "M", "R", "L"] })).toBeNull();
		expect(mud_volley.parseAction({ ...ok, tosses: ["L", "M", "X"] })).toBeNull();
		expect(mud_volley.parseAction({ type: "envelope", tosses: ["L", "M", "R"] })).toBeNull();
		expect(mud_volley.parseAction({ type: "envelope", tosses: "LMR", catches: "LMR" })).toBeNull();
	});

	it("parses a lane with or without its toss index", () => {
		expect(mud_volley.parseAction({ type: "lane", lane: "M" })).toEqual({ type: "lane", lane: "M" });
		expect(mud_volley.parseAction({ type: "lane", lane: "R", ex: 5 })).toEqual({ type: "lane", lane: "R", ex: 5 });
		expect(mud_volley.parseAction({ type: "lane", lane: "R", ex: 6 })).toBeNull();
		expect(mud_volley.parseAction({ type: "lane", lane: "R", ex: 1.5 })).toBeNull();
		expect(mud_volley.parseAction({ type: "lane", lane: "Q" })).toBeNull();
		expect(mud_volley.parseAction({ type: "emote", id: 1 })).toBeNull();
		expect(mud_volley.parseAction("lane")).toBeNull();
		expect(mud_volley.parseAction(null)).toBeNull();
	});

	it("maps each envelope slot to its toss", () => {
		expect(envelopeSlots(0, 0)).toEqual({ tossExchanges: [0, 2, 4], catchExchanges: [1, 3, 5] });
		expect(envelopeSlots(0, 1)).toEqual({ tossExchanges: [1, 3, 5], catchExchanges: [0, 2, 4] });
		expect(envelopeSlots(1, 1)).toEqual({ tossExchanges: [0, 2, 4], catchExchanges: [1, 3, 5] });
	});

	it("waits for the second envelope, then resolves all six tosses in order", () => {
		const s = known(0, ["L", "M", "R", "L", "M", "R"], "async");
		expect(mud_volley.activeSeats(s)).toEqual([0, 1]);
		const first = step(s, 1, { type: "envelope", tosses: ["M", "R", "L"], catches: ["L", "R", "R"] });
		expect(first.events).toEqual([{ type: "sealed", seat: 1 }]);
		expect(mud_volley.activeSeats(first.state)).toEqual([0]);
		expect(mud_volley.result(first.state)).toBeNull();
		const v = mud_volley.view(first.state, 0);
		expect(v.rivalLocked).toBe(true);
		expect(v.yourEnvelope).toBeNull();
		expect(mud_volley.view(first.state, 1).yourEnvelope).toEqual({ tosses: ["M", "R", "L"], catches: ["L", "R", "R"] });
		// Seat 0 tosses 0, 2, 4 (wind-ups L, R, M) and catches 1, 3, 5.
		const second = step(first.state, 0, { type: "envelope", tosses: ["L", "M", "M"], catches: ["M", "L", "L"] }, NOW + 60_000);
		const done = second.state;
		expect(done.phase).toBe("done");
		expect(done.history.map((r) => [r.ex, r.attacker, r.windup, r.toss, r.catchLane, r.outcome])).toEqual([
			[0, 0, "L", "L", "L", "catch"], // seat 1 waited in L
			[1, 1, "M", "M", "M", "catch"], // seat 0 waited in M
			[2, 0, "R", "M", "R", "splat1"], // flicked to M, seat 1 in R
			[3, 1, "L", "R", "L", "splat1"], // flicked to R, seat 0 in L
			[4, 0, "M", "M", "R", "splat2"], // followed through, seat 1 in R
			[5, 1, "R", "L", "L", "catch"], // seat 0 in L
		]);
		expect(done.score).toEqual([1 + 1 + 2 + 1, 1 + 1]);
		expect(second.events?.map((e) => e.type)).toEqual(["sealed", "reveal", "reveal", "reveal", "reveal", "reveal", "reveal", "final"]);
		expect(done.history.every((r) => r.at === NOW + 60_000)).toBe(true);
	});

	it("treats the same envelope again as a free retry and a different one as illegal", () => {
		const env = { type: "envelope" as const, tosses: ["L", "L", "L"] as Lane[], catches: ["R", "R", "R"] as Lane[] };
		const s = step(fresh("async"), 0, env).state;
		expect(mud_volley.apply(s, 0, env, ctx())).toEqual({ ok: true, state: s });
		expect(mud_volley.apply(s, 0, { ...env, catches: ["R", "R", "M"] }, ctx())).toEqual({ ok: false, error: "illegal_move" });
	});

	it("holds an async open chair without a clock, arms 24 h when it fills, and resolves on the second envelope", () => {
		const [card0, card1] = testCards(2);
		const lobby = createRoom({ roomId: "00000000-mv02", game: mud_volley, pace: "async", source: "queue", seatCount: 2, seats: [card0, null], seed: "async-open", now: NOW });
		let room = startGame(lobby, mud_volley, NOW);
		expect(room.deadline).toBe(NOW + T.envelopeMs);
		room = act(room, 0, { type: "envelope", tosses: ["L", "M", "R"], catches: ["L", "M", "R"] }, NOW + 1_000);
		expect(room.activeSeats).toEqual([1]);
		expect(room.deadline).toBeNull();
		const filled = takeSeat(room, mud_volley, card1, NOW + 5 * 3_600_000);
		if (!filled.ok) throw new Error("seat not taken");
		room = filled.room;
		expect(room.deadline).toBe(NOW + 5 * 3_600_000 + T.envelopeMs);
		room = act(room, 1, { type: "envelope", tosses: ["R", "R", "R"], catches: ["M", "M", "M"] }, NOW + 6 * 3_600_000);
		expect(room.phase).toBe("ended");
		expect(room.result?.reason).toBe("complete");
	});
});

describe("mud volley · secrecy", () => {
	it("gives a pig the same view whichever lane its rival sealed", () => {
		for (const toss of [0, 1, 2, 3]) {
			let s = fresh("live", `nonint-${toss}`);
			for (let i = 0; i < toss; i++) s = playToss(s, "M", "L").state;
			const views = LANES.map((lane) => mud_volley.view(step(s, 1, { type: "lane", lane }).state, 0));
			expect(views[1]).toEqual(views[0]);
			expect(views[2]).toEqual(views[0]);
			expect(views[0].rivalLocked).toBe(true);
			// ...and the lock's cue carries no lane either.
			const cues = LANES.map((lane) => step(s, 1, { type: "lane", lane }).events);
			expect(cues[1]).toEqual(cues[0]);
			expect(cues[2]).toEqual(cues[0]);
		}
	});

	it("gives neither pig a different view for a different future wind-up", () => {
		const base = playToss(known(0, ["L", "M", "R", "L", "M", "R"]), "L", "M").state;
		for (const future of [2, 3, 4, 5]) {
			for (const lane of LANES) {
				const windups = base.windups.map((w, ex) => (ex === future ? { lane, seal: `test-windup-${ex}-${lane}` } : w));
				const changed = { ...base, windups };
				expect(mud_volley.view(changed, 0)).toEqual(mud_volley.view(base, 0));
				expect(mud_volley.view(changed, 1)).toEqual(mud_volley.view(base, 1));
			}
		}
	});

	it("gives a pig the same view whatever its rival's envelope says", () => {
		const s = fresh("async", "nonint-env");
		const a = step(s, 1, { type: "envelope", tosses: ["L", "L", "L"], catches: ["L", "L", "L"] }).state;
		const b = step(s, 1, { type: "envelope", tosses: ["R", "M", "R"], catches: ["M", "R", "M"] }).state;
		expect(mud_volley.view(a, 0)).toEqual(mud_volley.view(b, 0));
	});

	it("names the rival's seal and every future wind-up as secrets, and no view ever carries one", () => {
		const s = step(known(0, ["L", "M", "R", "L", "M", "R"]), 1, { type: "lane", lane: "R" }).state;
		const secrets = mud_volley.secretsOf?.(s, 0) ?? [];
		expect(secrets).toContain((s.commits[1] as { seal: string }).seal);
		expect(secrets).toEqual(expect.arrayContaining(s.windups.slice(1).map((w) => w.seal)));
		expect(mud_volley.secretsOf?.(s, 1)).not.toContain((s.commits[1] as { seal: string }).seal);
		const seen = JSON.stringify(mud_volley.view(s, 0));
		for (const marker of secrets) expect(seen).not.toContain(marker);
		let done = s;
		done = step(done, 0, { type: "lane", lane: "L" }).state;
		for (let i = 1; i < EXCHANGES; i++) done = playToss(done, "L", "M").state;
		expect(mud_volley.secretsOf?.(done, 0)).toEqual([]);
	});

	it("would catch a view that leaked a sealed lane, an envelope or the schedule", () => {
		const leaky = (extra: (s: VolleyState) => object) => ({
			...mud_volley,
			view: (s: VolleyState, seat: Seat) => ({ ...mud_volley.view(s, seat), ...extra(s) }),
		});
		expect(fuzz(leaky((s) => ({ commits: s.commits })), 20).leaks).toBeGreaterThan(0);
		expect(fuzz(leaky((s) => ({ schedule: s.windups })), 20).leaks).toBeGreaterThan(0);
		expect(fuzz(leaky((s) => ({ envelopes: s.envelopes })), 20, { pace: "async" }).leaks).toBeGreaterThan(0);
	});

	it("keeps the seed and the rival's sealed lane out of the room snapshot", () => {
		let room = liveTable("snapshot-seed");
		room = act(room, 0, { type: "lane", lane: "R", ex: 0 }, START + 1_000);
		const theirs = JSON.stringify(snapshotFor(room, mud_volley, 1));
		expect(theirs).not.toContain("snapshot-seed");
		expect(theirs).not.toContain((game(room).commits[0] as { seal: string }).seal);
		expect(snapshotFor(room, mud_volley, 1).view).toMatchObject({ yourLane: null, rivalLocked: true });
		expect(snapshotFor(room, mud_volley, 0).view).toMatchObject({ yourLane: "R", rivalLocked: false });
	});
});

describe("mud volley · presence", () => {
	it("plays the same whoever the engine says is present (a 2-seat table leaves departures to it)", () => {
		const away = (c: StepContext): StepContext => ({ ...c, present: [true, false] });
		const s = step(known(0, ["L", "M", "R", "L", "M", "R"]), 1, { type: "lane", lane: "M" }).state;
		const here = mud_volley.apply(s, 0, { type: "lane", lane: "L" }, ctx(NOW, "p"));
		const gone = mud_volley.apply(s, 0, { type: "lane", lane: "L" }, away(ctx(NOW, "p")));
		expect(gone).toEqual(here);
		const t0 = known(0, ["L", "M", "R", "L", "M", "R"]);
		expect(mud_volley.onTimeout(t0, 1, away(ctx(NOW, "q")))).toEqual(mud_volley.onTimeout(t0, 1, ctx(NOW, "q")));
	});
});

describe("mud volley · determinism", () => {
	it("replays a seed to the identical match, timeouts included", () => {
		for (const pace of ["live", "async"] as const) {
			const a = playOut(mud_volley, { seats: 2, seed: `replay-${pace}`, pace, timeoutRate: 0.2 });
			const b = playOut(mud_volley, { seats: 2, seed: `replay-${pace}`, pace, timeoutRate: 0.2 });
			expect(b.room.game).toEqual(a.room.game);
			expect(b.room.log).toEqual(a.room.log);
			expect(b.room.result).toEqual(a.room.result);
		}
		const c = playOut(mud_volley, { seats: 2, seed: "replay-other" });
		const d = playOut(mud_volley, { seats: 2, seed: "replay-live" });
		expect(c.room.game).not.toEqual(d.room.game);
	});
});

describe("mud volley · the result", () => {
	it("keeps a draw a draw and crowns the higher score otherwise", () => {
		let s = known(0, ["L", "L", "L", "L", "L", "L"]);
		// Six flicks: 3 to each.
		for (let i = 0; i < EXCHANGES; i++) s = playToss(s, "M", "R").state;
		// A draw names both pigs as sharing the top place...
		expect(mud_volley.result(s)).toMatchObject({ kind: "draw", winners: [0, 1], scores: [3, 3] });
		// ...and the room settles it that way: six flicks, each caught nowhere.
		let room = liveTable("draw-room");
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const g = game(room);
			const attacker = attackerOf(g.firstAttacker, ex);
			const windup = g.windups[ex].lane;
			const flick = LANES.find((l) => l !== windup) as Lane;
			room = act(room, attacker, { type: "lane", lane: flick, ex }, START + ex * 1_000 + 100);
			room = act(room, 1 - attacker, { type: "lane", lane: windup, ex }, START + ex * 1_000 + 200);
		}
		expect(room.result).toMatchObject({ kind: "draw", winners: [0, 1], scores: [3, 3], reason: "complete" });
		let w = known(1, ["L", "L", "L", "L", "L", "L"]);
		for (let i = 0; i < EXCHANGES; i++) w = playToss(w, "L", i === 5 ? "L" : "R").state;
		// Seat 1 tosses 0, 2, 4 (three big splats) and catches the last toss;
		// seat 0 lands two big splats.
		expect(mud_volley.result(w)).toMatchObject({ kind: "win", winners: [1], scores: [4, 7] });
	});

	it("names the loudest toss without naming a pig", () => {
		// Led from the first toss: 0-2, 1-2, 1-4, 2-4, 3-4, 3-5.
		const wire = [row(0, 1, "splat2"), row(1, 0, "splat1"), row(2, 1, "splat2"), row(3, 0, "splat1"), row(4, 1, "catch"), row(5, 0, "catch")];
		expect(loudestRow(wire)?.ex).toBe(0);
		expect(summaryLine(wire, [3, 5])).toBe("a big splat on the first toss");
		// Taken on the last toss: 2-0, 2-1, 2-2, 2-4, 4-4, then seat 0 catches: 5-4.
		const lastCatch = [row(0, 0, "splat2"), row(1, 1, "splat1"), row(2, 0, "catch"), row(3, 1, "splat2"), row(4, 0, "splat2"), row(5, 1, "catch")];
		expect(summaryLine(lastCatch, [5, 4])).toBe("a clean catch on the last toss");
		const late = [row(0, 0, "splat1"), row(1, 1, "splat1"), row(2, 0, "splat1"), row(3, 1, "splat1"), row(4, 0, "splat1"), row(5, 0, "catch")];
		// 1-0, 1-1, 2-1, 2-2, 3-2, then seat 1 catches: 3-3.
		expect(summaryLine(late, [3, 3])).toBe("a clean catch on the last toss to level it");
		// Turned on the third toss and never turned back: 2-0, 2-2, 2-3, 2-4, 3-4, 3-6.
		const swing = [row(0, 0, "splat2"), row(1, 1, "splat2"), row(2, 0, "catch"), row(3, 1, "splat1"), row(4, 0, "splat1"), row(5, 1, "splat2")];
		expect(summaryLine(swing, [3, 6])).toBe("a clean catch on the third toss");
		expect(summaryLine([], [0, 0])).toBe("");
		const played = playOut(mud_volley, { seats: 2, seed: "summary" }).room;
		expect(played.result?.summary).toMatch(/^a (clean catch|big splat|sneaky flick) on the (first|second|third|fourth|fifth|last) toss( to level it)?$/);
		expect(played.result?.summary).not.toMatch(/Pig \d/);
	});

	it("counts follow-throughs and covers for the depth metric, leaving fallbacks out", () => {
		const rows: VolleyRow[] = [
			{ ...row(0, 0, "splat2"), windup: "L", toss: "L", catchLane: "R" },
			{ ...row(1, 1, "splat1"), windup: "M", toss: "R", catchLane: "M" },
			{ ...row(2, 0, "catch"), windup: "R", toss: "M", catchLane: "M", fallback: [false, true] },
		];
		expect(depthStats(rows)).toEqual([
			{ tosses: 2, followThroughs: 1, catches: 1, covers: 1 },
			{ tosses: 1, followThroughs: 0, catches: 1, covers: 0 },
		]);
	});
});

describe("mud volley · the practice pig", () => {
	const tossView = (role: "toss" | "catch"): VolleyView => ({
		...mud_volley.view(known(role === "toss" ? 0 : 1, ["L", "M", "R", "L", "M", "R"]), 0),
	});

	it("only answers when it owes a decision", () => {
		const s = step(fresh(), 0, { type: "lane", lane: "L" }).state;
		expect(mud_volley.bot(mud_volley.view(s, 0), 0, createRng("b"))).toBeNull();
		expect(mud_volley.bot(mud_volley.view(s, 1), 1, createRng("b"))).toMatchObject({ type: "lane", ex: 0 });
		const env = step(fresh("async"), 0, { type: "envelope", tosses: ["L", "L", "L"], catches: ["L", "L", "L"] }).state;
		expect(mud_volley.bot(mud_volley.view(env, 0), 0, createRng("b"))).toBeNull();
		const action = mud_volley.bot(mud_volley.view(env, 1), 1, createRng("b"));
		expect(mud_volley.parseAction(action)).toEqual(action);
	});

	it("is Even Edna by default: follows through about one time in four, covers about half", () => {
		const n = 4_000;
		let follows = 0;
		let covers = 0;
		const t = tossView("toss");
		const c = tossView("catch");
		for (let i = 0; i < n; i++) {
			const a = mud_volley.bot(t, 0, createRng(`edna-t-${i}`));
			const b = mud_volley.bot(c, 0, createRng(`edna-c-${i}`));
			if (a?.type === "lane" && a.lane === t.windup) follows++;
			if (b?.type === "lane" && b.lane === c.windup) covers++;
		}
		expect(follows / n).toBeGreaterThan(0.22);
		expect(follows / n).toBeLessThan(0.28);
		expect(covers / n).toBeGreaterThan(0.46);
		expect(covers / n).toBeLessThan(0.54);
		const hank = volleyBot(VOLLEY_BOTS.honestHank);
		let honest = 0;
		for (let i = 0; i < n; i++) {
			const a = hank(t, 0, createRng(`hank-${i}`));
			if (a?.type === "lane" && a.lane === t.windup) honest++;
		}
		expect(honest / n).toBeGreaterThan(0.62);
		expect(honest / n).toBeLessThan(0.71);
	});
});

describe("mud volley · fuzz through the room engine", () => {
	it("finishes 200 live tables with timeouts: no illegal bot move, no leak", () => {
		const run = fuzz(mud_volley, 200, { timeoutRate: 0.15 });
		expect(run.reports).toHaveLength(200);
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
		for (const report of run.reports) {
			const g = game(report.room);
			if (report.room.result?.reason === "complete") {
				expect(g.history).toHaveLength(EXCHANGES);
				expect(report.room.result.scores).toEqual(g.score);
				expect(g.score[0] + g.score[1]).toBe(g.history.reduce((n, r) => n + r.points, 0));
			} else {
				// The engine's calls: both pigs idle (no contest), or one pig kept
				// missing while the other played (it walked away: forfeit).
				expect(["ended_early", "forfeit"]).toContain(report.room.result?.reason);
			}
		}
	});

	it("finishes 200 envelope tables with timeouts: no illegal bot move, no leak", () => {
		const run = fuzz(mud_volley, 200, { pace: "async", timeoutRate: 0.15 });
		expect(run.reports).toHaveLength(200);
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
		expect(run.reports.filter((r) => r.room.result?.reason === "complete").length).toBeGreaterThan(150);
	});
});
