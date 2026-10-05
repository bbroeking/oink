// Fence the Pen's rules module (multiplayer/games/fence_the_pen): the shared
// edge arithmetic, one fence at a time (closing, the double close, the
// mandatory extra move, the last fence), the timeout default and its internal
// loop, turn order around a pig who left and an open async chair, the result
// line, the practice pig, determinism, and whole tables fuzzed through the
// real room engine at both paces.

import type { Pace, Seat, StepContext } from "../../multiplayer/types";
import type { PlayerCard } from "../../multiplayer/protocol";
import {
	BOARD_SIDE,
	chainAfter,
	chooseFence,
	defaultFence,
	fence_the_pen,
	nextSeat,
	summaryOf,
	type FenceState,
} from "../../multiplayer/games/fence_the_pen/rules";
import {
	edgeAt,
	edgeCount,
	edgePosts,
	hEdge,
	horizontalCount,
	penCount,
	penSides,
	pensOfEdge,
	sidesDrawn,
	vEdge,
	type Grid,
} from "../../multiplayer/games/fence_the_pen/geometry";
import { applyAction, applyTimeouts, createRoom, markGone, startGame, takeSeat, type RoomState } from "../../multiplayer/engine";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import { createRng } from "../../multiplayer/rng";

const NOW = 1_700_000_000_000;
const G4: Grid = { rows: 4, cols: 4 };
const G3: Grid = { rows: 3, cols: 3 };

const everyone = (n: number) => Array.from({ length: n }, () => true);
const ctx = (present: boolean[] = everyone(2)): StepContext => ({ now: NOW, rng: createRng("ctx"), pace: "live", present });

function fresh(seats = 2, pace: Pace = "live"): FenceState {
	return fence_the_pen.setup({ seats, pace, rng: createRng("setup") });
}

/** A hand-built yard of any size: `drawn` fences are up (marked as seat 0's),
 *  any pen they close belongs to seat 0, and `turn` owes the next fence. */
function craft(g: Grid, drawn: number[], opts: { seats?: number; turn?: Seat } = {}): FenceState {
	const seats = opts.seats ?? 2;
	const edges = Array.from({ length: edgeCount(g) }, (_, e) => (drawn.includes(e) ? 1 : 0));
	const pens = Array.from({ length: penCount(g) }, (_, p) => (sidesDrawn(g, edges, p) === 4 ? 0 : -1));
	const scores = Array.from({ length: seats }, (_, i) => (i === 0 ? pens.filter((p) => p === 0).length : 0));
	return {
		v: 1,
		rows: g.rows,
		cols: g.cols,
		seats,
		edges,
		pens,
		scores,
		fencesLeft: edges.length - drawn.length,
		turn: opts.turn ?? 0,
		last: null,
		over: false,
	};
}

function fence(s: FenceState, seat: Seat, edge: number, present = everyone(s.seats)) {
	const res = fence_the_pen.apply(s, seat, { type: "fence", edge }, ctx(present));
	if (!res.ok) throw new Error(`fence ${edge} refused: ${res.error}`);
	return res;
}

function liveRoom(seats: number, pace: Pace = "live", cards: (PlayerCard | null)[] = testCards(seats)): RoomState {
	const room = createRoom({ roomId: "00000000-fence", game: fence_the_pen, pace, source: "queue", seatCount: seats, seats: cards, seed: "fence-seed", now: NOW });
	return startGame({ ...room, phase: "starting" }, fence_the_pen, NOW);
}

function act(room: RoomState, seat: Seat, edge: number, at = NOW + 1_000): RoomState {
	const res = applyAction(room, fence_the_pen, seat, { type: "fence", edge }, at);
	if (!res.ok) throw new Error(`room refused fence ${edge} from seat ${seat}: ${res.error}`);
	return res.room;
}

const game = (room: RoomState) => room.game as FenceState;

/** The game's own cues, plus the room engine's. */
const KNOWN_EVENTS = ["fence", "pen", "again", "turn", "end", "start", "timeout", "gone", "idle", "aborted"];

describe("edge indexing (the shared arithmetic)", () => {
	it("counts a 4×4 yard as 20 + 20 fences and 16 pens, a 3×3 as 12 + 12 and 9", () => {
		expect(horizontalCount(G4)).toBe(20);
		expect(edgeCount(G4)).toBe(40);
		expect(penCount(G4)).toBe(16);
		expect(horizontalCount(G3)).toBe(12);
		expect(edgeCount(G3)).toBe(24);
		expect(penCount(G3)).toBe(9);
	});

	it("numbers horizontals row by row, then verticals after H", () => {
		expect(hEdge(G4, 0, 0)).toBe(0);
		expect(hEdge(G4, 1, 0)).toBe(4);
		expect(hEdge(G4, 4, 3)).toBe(19);
		expect(vEdge(G4, 0, 0)).toBe(20);
		expect(vEdge(G4, 0, 4)).toBe(24);
		expect(vEdge(G4, 1, 0)).toBe(25);
		expect(vEdge(G4, 3, 4)).toBe(39);
		expect(vEdge(G3, 2, 3)).toBe(23);
	});

	it("gives pen (r, c) the sides h(r,c), h(r+1,c), v(r,c), v(r,c+1)", () => {
		expect(penSides(G4, 0)).toEqual([0, 4, 20, 21]);
		expect(penSides(G4, 5)).toEqual([5, 9, 26, 27]);
		expect(penSides(G4, 15)).toEqual([15, 19, 38, 39]);
		expect(penSides(G3, 4)).toEqual([4, 7, 17, 18]);
	});

	it("round-trips every index through edgeAt, and knows each fence's posts", () => {
		for (const g of [G4, G3]) {
			for (let e = 0; e < edgeCount(g); e++) {
				const at = edgeAt(g, e);
				expect(at.dir === "h" ? hEdge(g, at.r, at.c) : vEdge(g, at.r, at.c)).toBe(e);
				const [a, b] = edgePosts(g, e);
				expect(Math.abs(a.r - b.r) + Math.abs(a.c - b.c)).toBe(1);
				expect(at.dir === "h" ? a.r === b.r : a.c === b.c).toBe(true);
			}
		}
		expect(edgePosts(G4, hEdge(G4, 2, 1))).toEqual([{ r: 2, c: 1 }, { r: 2, c: 2 }]);
		expect(edgePosts(G4, vEdge(G4, 2, 1))).toEqual([{ r: 2, c: 1 }, { r: 3, c: 1 }]);
	});

	it("puts a rim fence on one pen and an inside fence on two, each pen on exactly its four sides", () => {
		for (const g of [G4, G3]) {
			const touches = Array.from({ length: penCount(g) }, () => 0);
			for (let e = 0; e < edgeCount(g); e++) {
				const { dir, r, c } = edgeAt(g, e);
				const rim = dir === "h" ? r === 0 || r === g.rows : c === 0 || c === g.cols;
				const pens = pensOfEdge(g, e);
				expect(pens).toHaveLength(rim ? 1 : 2);
				for (const p of pens) {
					expect(penSides(g, p)).toContain(e);
					touches[p]++;
				}
			}
			expect(touches.every((n) => n === 4)).toBe(true);
		}
	});
});

describe("setup", () => {
	it("deals a 4×4 yard live and a 3×3 yard by post, seat 0 first, consuming no rng", () => {
		const live = fresh(2, "live");
		expect([live.rows, live.cols, live.edges.length, live.pens.length, live.fencesLeft]).toEqual([4, 4, 40, 16, 40]);
		const post = fresh(4, "async");
		expect([post.rows, post.cols, post.edges.length, post.pens.length, post.fencesLeft]).toEqual([3, 3, 24, 9, 24]);
		expect(post.scores).toEqual([0, 0, 0, 0]);
		expect(post.turn).toBe(0);
		expect(fence_the_pen.activeSeats(post)).toEqual([0]);
		expect(fence_the_pen.setup({ seats: 4, pace: "async", rng: createRng("other") })).toEqual(post);
		expect(BOARD_SIDE).toEqual({ live: 4, async: 3 });
	});

	it("keeps state and view plain JSON, and hides nothing", () => {
		const s = fence(fresh(), 0, 7).state;
		expect(JSON.parse(JSON.stringify(s))).toEqual(s);
		expect(fence_the_pen.view(s, 1)).toEqual(s);
		expect(fence_the_pen.secretsOf).toBeUndefined();
	});
});

describe("one fence at a time", () => {
	it("passes the turn when a fence closes nothing", () => {
		const res = fence(fresh(), 0, 0);
		expect(res.state.turn).toBe(1);
		expect(res.state.edges[0]).toBe(1);
		expect(res.state.fencesLeft).toBe(39);
		expect(res.state.last).toEqual({ seat: 0, edge: 0, closed: [] });
		expect(res.events).toEqual([
			{ type: "fence", seat: 0, edge: 0 },
			{ type: "turn", seat: 1 },
		]);
	});

	it("gives a closed pen to the mover and makes the extra move mandatory", () => {
		// Pen 0 has three sides up; seat 1 owes the fence.
		const s = craft(G4, [0, 4, 20], { turn: 1 });
		const res = fence(s, 1, 21);
		expect(res.state.pens[0]).toBe(1);
		expect(res.state.scores).toEqual([0, 1]);
		expect(res.state.edges[21]).toBe(2);
		expect(res.events).toEqual([
			{ type: "fence", seat: 1, edge: 21 },
			{ type: "pen", seat: 1, pen: 0 },
			{ type: "again", seat: 1 },
		]);
		// Still seat 1's move: there is no "decline", and nobody else may draw.
		expect(fence_the_pen.activeSeats(res.state)).toEqual([1]);
		expect(fence_the_pen.apply(res.state, 0, { type: "fence", edge: 1 }, ctx())).toEqual({ ok: false, error: "not_your_turn" });
		const next = fence(res.state, 1, 39);
		expect(next.state.turn).toBe(0);
	});

	it("closes two pens with one shared middle rail: two pen beats, one again", () => {
		// Pens 0 and 1 share v(0,1) = 21; everything else around both is up.
		const s = craft(G4, [0, 4, 20, 1, 5, 22]);
		const res = fence(s, 0, 21);
		expect(res.state.pens.slice(0, 2)).toEqual([0, 0]);
		expect(res.state.scores[0]).toBe(2);
		expect(res.state.last).toEqual({ seat: 0, edge: 21, closed: [0, 1] });
		expect((res.events ?? []).map((e) => e.type)).toEqual(["fence", "pen", "pen", "again"]);
		expect(res.state.turn).toBe(0);
	});

	it("ends the game on the last fence, which always closes a pen, with no extra move", () => {
		const all = Array.from({ length: edgeCount(G3) }, (_, e) => e).filter((e) => e !== 0);
		const s = craft(G3, all, { turn: 1 });
		expect(s.scores).toEqual([8, 0]);
		const res = fence(s, 1, 0);
		expect(res.state.over).toBe(true);
		expect(res.state.fencesLeft).toBe(0);
		expect(res.events).toEqual([
			{ type: "fence", seat: 1, edge: 0 },
			{ type: "pen", seat: 1, pen: 0 },
			{ type: "end" },
		]);
		expect(fence_the_pen.activeSeats(res.state)).toEqual([]);
		expect(fence_the_pen.result(res.state)).toEqual({ kind: "win", winners: [0], scores: [8, 1], summary: "8 pens to 1" });
		expect(fence_the_pen.apply(res.state, 1, { type: "fence", edge: 0 }, ctx())).toEqual({ ok: false, error: "game_over" });
	});

	it("refuses a taken fence, a fence off this yard, and a pig out of turn", () => {
		const s = fence(fresh(2, "async"), 0, 3).state;
		expect(fence_the_pen.apply(s, 1, { type: "fence", edge: 3 }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(fence_the_pen.apply(s, 1, { type: "fence", edge: 24 }, ctx())).toEqual({ ok: false, error: "illegal_move" });
		expect(fence_the_pen.apply(s, 0, { type: "fence", edge: 4 }, ctx())).toEqual({ ok: false, error: "not_your_turn" });
		expect(fence_the_pen.result(s)).toBeNull();
	});
});

describe("parseAction", () => {
	it("takes exactly { type: 'fence', edge } with an integer edge on the largest yard", () => {
		const parse = fence_the_pen.parseAction;
		expect(parse({ type: "fence", edge: 0 })).toEqual({ type: "fence", edge: 0 });
		expect(parse({ type: "fence", edge: 39 })).toEqual({ type: "fence", edge: 39 });
		expect(parse({ type: "fence", edge: 40 })).toBeNull();
		expect(parse({ type: "fence", edge: -1 })).toBeNull();
		expect(parse({ type: "fence", edge: 2.5 })).toBeNull();
		expect(parse({ type: "fence", edge: "3" })).toBeNull();
		expect(parse({ type: "fence" })).toBeNull();
		expect(parse({ type: "fence", edge: 3, seat: 1 })).toBeNull();
		expect(parse({ type: "resign" })).toBeNull();
		expect(parse({ type: "emote", id: "heart" })).toBeNull();
		expect(parse([{ type: "fence", edge: 3 }])).toBeNull();
		expect(parse("fence 3")).toBeNull();
		expect(parse(null)).toBeNull();
	});
});

// A 1×2 strip and a 2×2 yard, small enough to read by eye:
//   1×2: h(0,0)=0 h(0,1)=1 · h(1,0)=2 h(1,1)=3 · v(0,0)=4 v(0,1)=5 v(0,2)=6
//   2×2: h 0..5 (rows 0,1,2) · v(0,·)=6,7,8 · v(1,·)=9,10,11
const STRIP: Grid = { rows: 1, cols: 2 };
const G2: Grid = { rows: 2, cols: 2 };

describe("the timeout default", () => {
	it("draws the lowest fence that gives nothing away", () => {
		expect(defaultFence(fresh())).toBe(0);
		// Pen 0 has two sides up, so fence 0 would hand it over; fence 1 is safe.
		expect(defaultFence(craft(G4, [4, 20]))).toBe(1);
	});

	it("takes the lowest free pen when every fence gives something away", () => {
		// Pen 0 three-sided (0, 2, 4), pen 1 two-sided (1, 3): 5 closes pen 0 but
		// hands over pen 1, 6 hands over pen 1. No safe fence; 5 takes what is free.
		expect(defaultFence(craft(STRIP, [0, 2, 4, 1, 3]))).toBe(5);
	});

	it("falls back to the lowest open fence when nothing is safe or free", () => {
		expect(defaultFence(craft(STRIP, [0, 2, 1, 3]))).toBe(4);
	});

	it("keeps drawing defaults inside one call until one closes nothing, then the turn passes", () => {
		// Pen 0 three-sided with its open side on the rim; pens 1–3 two-sided.
		const s = craft(G2, [2, 6, 7, 8, 9, 5, 11]);
		const res = fence_the_pen.onTimeout(s, 0, ctx());
		expect(res.events).toEqual([
			{ type: "fence", seat: 0, edge: 0 },
			{ type: "pen", seat: 0, pen: 0 },
			{ type: "again", seat: 0 },
			{ type: "fence", seat: 0, edge: 1 },
			{ type: "turn", seat: 1 },
		]);
		expect(res.state.turn).toBe(1);
		expect(fence_the_pen.activeSeats(res.state)).not.toContain(0);
		expect(res.state.scores).toEqual([1, 0]);
	});

	it("runs a free chain to the end of the yard if the defaults take it all", () => {
		const res = fence_the_pen.onTimeout(craft(STRIP, [0, 2, 4, 1, 3]), 0, ctx());
		expect((res.events ?? []).map((e) => e.type)).toEqual(["fence", "pen", "again", "fence", "pen", "end"]);
		expect(res.state.over).toBe(true);
		expect(fence_the_pen.activeSeats(res.state)).toEqual([]);
	});

	it("leaves the state alone for a seat that owes nothing", () => {
		const s = fresh();
		expect(fence_the_pen.onTimeout(s, 1, ctx()).state).toBe(s);
	});
});

describe("turn order around empty chairs", () => {
	it("skips a pig who left, in seat order, wrapping", () => {
		expect(nextSeat(3, 0, [true, true, true])).toBe(1);
		expect(nextSeat(3, 1, [true, true, false])).toBe(0);
		expect(nextSeat(4, 0, [true, false, true, true])).toBe(2);
		expect(nextSeat(4, 3, [false, false, true, true])).toBe(2);
		// Nobody else at the table: the room ends such a game before it asks.
		expect(nextSeat(2, 0, [true, false])).toBe(0);
	});

	it("passes over a departed pig at a three-pig table; its pens stay its own", () => {
		let room = liveRoom(3);
		room = act(room, 0, 0);
		room = markGone(room, fence_the_pen, 2, NOW + 1_500);
		expect(room.phase).toBe("playing");
		room = act(room, 1, 1, NOW + 2_000);
		expect(room.activeSeats).toEqual([0]);
		room = act(room, 0, 2, NOW + 3_000);
		expect(room.activeSeats).toEqual([1]);
	});

	it("resolves a pig who leaves on its own turn through the default, then skips it", () => {
		let room = liveRoom(3);
		room = act(room, 0, 39);
		room = act(room, 1, 38);
		expect(room.activeSeats).toEqual([2]);
		room = markGone(room, fence_the_pen, 2, NOW + 2_000);
		// The departed chair drew the default (the lowest safe fence, 0) and the
		// turn moved on to seat 0.
		expect(game(room).edges[0]).toBe(3);
		expect(room.activeSeats).toEqual([0]);
		expect(room.events.map((e) => e.type)).toEqual(["gone", "fence", "turn"]);
		room = act(room, 0, 37, NOW + 3_000);
		room = act(room, 1, 36, NOW + 4_000);
		expect(room.activeSeats).toEqual([0]);
	});

	it("holds an open async chair's turn without a clock until a pig takes it", () => {
		let room = liveRoom(2, "async", [testCards(1)[0], null]);
		room = act(room, 0, 0);
		expect(room.activeSeats).toEqual([1]);
		expect(room.deadline).toBeNull();
		const taken = takeSeat(room, fence_the_pen, testCards(2)[1], NOW + 60_000);
		expect(taken.ok && taken.room.deadline).toBe(NOW + 60_000 + 24 * 3_600_000);
		if (!taken.ok) return;
		const moved = act(taken.room, 1, 1, NOW + 61_000);
		expect(moved.activeSeats).toEqual([0]);
	});

	it("re-arms the twenty seconds after an extra move, and times out through the default", () => {
		let room = liveRoom(2);
		// Seat 0 draws three sides of pen 0 across turns; seat 1 closes it.
		room = act(room, 0, 0, NOW + 1_000);
		room = act(room, 1, 4, NOW + 2_000);
		room = act(room, 0, 20, NOW + 3_000);
		room = act(room, 1, 21, NOW + 4_000);
		expect(room.activeSeats).toEqual([1]);
		expect(room.deadline).toBe(NOW + 4_000 + 20_000);
		room = applyTimeouts(room, fence_the_pen, room.deadline as number);
		expect(room.activeSeats).toEqual([0]);
		expect(room.seats[1]?.missed).toBe(1);
		expect(room.events[0]).toEqual({ type: "timeout", seat: 1 });
	});
});

describe("result", () => {
	it("crowns the most pens, shares a tie, and writes a name-free line", () => {
		const over = (scores: number[]): FenceState => ({ ...fresh(scores.length), scores, fencesLeft: 0, over: true });
		expect(fence_the_pen.result(over([9, 7]))).toEqual({ kind: "win", winners: [0], scores: [9, 7], summary: "9 pens to 7" });
		expect(fence_the_pen.result(over([8, 8]))).toEqual({ kind: "draw", winners: [0, 1], scores: [8, 8], summary: "8 pens each" });
		expect(fence_the_pen.result(over([6, 6, 4]))?.winners).toEqual([0, 1]);
	});

	it("never prints a zero", () => {
		expect(summaryOf([9, 7])).toBe("9 pens to 7");
		expect(summaryOf([7, 9])).toBe("9 pens to 7");
		expect(summaryOf([8, 8])).toBe("8 pens each");
		expect(summaryOf([9, 0])).toBe("all 9 pens");
		expect(summaryOf([6, 5, 3, 2])).toBe("6 pens to 5 to 3 to 2");
		expect(summaryOf([4, 4, 1, 0])).toBe("4 pens to 4 to 1");
		expect(summaryOf([3, 3, 3])).toBe("3 pens each");
		expect(summaryOf([5, 4, 0])).toBe("5 pens to 4");
	});
});

describe("the practice pig", () => {
	it("takes the double close over a single one", () => {
		// Pen 0 closes with 21 together with pen 1; pen 15 closes alone with 39.
		const s = craft(G4, [0, 4, 20, 1, 5, 22, 15, 19, 38]);
		expect(fence_the_pen.bot(s, 0, createRng("b"))).toEqual({ type: "fence", edge: 21 });
		expect(fence_the_pen.bot(s, 1, createRng("b"))).toBeNull();
	});

	it("plays a safe fence while one exists", () => {
		// Pen 0 is two-sided (4, 20): its open sides 0 and 21 would hand it over.
		const s = craft(G4, [4, 20]);
		const picks = new Set(Array.from({ length: 30 }, (_, i) => chooseFence(s, createRng(`safe-${i}`))));
		expect(picks.has(0) || picks.has(21)).toBe(false);
		expect(picks.size).toBeGreaterThan(1);
	});

	it("gives away the shortest chain when every fence gives something", () => {
		// A 1×4 strip: pen 0 sealed on the right and two-sided (a chain of one);
		// pens 1–3 a chain of three. Open: 4, 8 (the one) and 5, 10, 11, 12 (the three).
		const g: Grid = { rows: 1, cols: 4 };
		const s = craft(g, [0, 9, 1, 2, 6, 3, 7]);
		expect([4, 8].map((e) => chainAfter(g, s.edges, e))).toEqual([1, 1]);
		expect([5, 10, 11, 12].map((e) => chainAfter(g, s.edges, e))).toEqual([3, 3, 3, 3]);
		for (let i = 0; i < 20; i++) expect([4, 8]).toContain(chooseFence(s, createRng(`chain-${i}`)));
	});

	it("returns null once the game is over", () => {
		expect(fence_the_pen.bot({ ...fresh(), over: true }, 0, createRng("x"))).toBeNull();
	});
});

describe("whole tables", () => {
	it("replays a seed exactly (the module is deterministic)", () => {
		const a = playOut(fence_the_pen, { seats: 3, seed: "replay", timeoutRate: 0.2 });
		const b = playOut(fence_the_pen, { seats: 3, seed: "replay", timeoutRate: 0.2 });
		expect(a.room.phase).toBe("ended");
		expect(b.room.game).toEqual(a.room.game);
		expect(b.room.log).toEqual(a.room.log);
		expect(b.room.result).toEqual(a.room.result);
	});

	it.each<Pace>(["live", "async"])("fuzzes %s tables of 2–4 pigs to the end with legal bots", (pace) => {
		const ended: string[] = [];
		const run = fuzz(fence_the_pen, 200, {
			timeoutRate: 0.1,
			pace,
			onRevision: (room) => {
				const s = room.game as FenceState | null;
				if (!s) return;
				// Scores always equal the pens on the board, and the last fence
				// always closes a pen.
				expect(s.scores.reduce((a, b) => a + b, 0)).toBe(s.pens.filter((p) => p >= 0).length);
				const types = room.events.map((e) => e.type);
				// Every cue is one the board (or the room) knows.
				for (const t of types) expect(KNOWN_EVENTS).toContain(t);
				const end = types.indexOf("end");
				if (end >= 0) {
					expect(types[end - 1]).toBe("pen");
					ended.push(room.roomId);
				}
			},
		});
		expect(run.unfinished).toBe(0);
		expect(run.illegal).toBe(0);
		expect(run.leaks).toBe(0);
		expect(ended.length).toBeGreaterThan(0);
		// The run really exercised the clock and the empty-chair paths.
		expect(run.reports.reduce((n, r) => n + r.timeouts, 0)).toBeGreaterThan(100);
		expect(run.reports.some((r) => r.room.seats.some((seat) => seat?.gone))).toBe(true);
		expect(run.reports.filter((r) => r.room.result?.reason === "complete").length).toBeGreaterThan(300);
		const side = BOARD_SIDE[pace];
		for (const r of run.reports) {
			const s = r.room.game as FenceState;
			expect(s.rows).toBe(side);
			if (r.room.result?.reason === "complete") {
				expect(s.fencesLeft).toBe(0);
				expect(r.room.result.scores.reduce((a, b) => a + b, 0)).toBe(side * side);
			}
		}
	});

	it("plays out three- and four-pig tables when a pig leaves mid-game", () => {
		for (const seats of [3, 4]) {
			for (let i = 0; i < 25; i++) {
				const report = playOut(fence_the_pen, { seats, seed: `leave-${seats}-${i}`, timeoutRate: 0.1, leave: { seat: i % seats, atStep: 3 + (i % 9) } });
				expect(report.room.phase).toBe("ended");
				expect(report.illegalBotMoves).toEqual([]);
				const s = report.room.game as FenceState;
				const gone = report.room.seats.flatMap((seat, k) => (seat?.gone ? [k] : []));
				expect(gone.length).toBeGreaterThan(0);
				// A pig who left is never crowned.
				for (const k of gone) expect(report.room.result?.winners).not.toContain(k);
				if (report.room.result?.reason === "complete") expect(s.fencesLeft).toBe(0);
			}
		}
	});
});
