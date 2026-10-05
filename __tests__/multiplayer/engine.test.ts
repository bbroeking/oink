// The room engine against two toy games: a turn-based one (Nim) and a
// simultaneous sealed-choice one with a secret. Real games have their own
// suites; this one pins the engine's contract: revisions, the clock rule,
// timeouts, departures, rematch and per-seat secrecy.

import type { AnyGame, GameDefinition, Seat, StepContext } from "../../multiplayer/types";
import {
	applyAction,
	applyTimeouts,
	beginCountdown,
	canStart,
	createRoom,
	DEFAULT_ENGINE_OPTIONS,
	markGone,
	rematchSeats,
	snapshotFor,
	startGame,
	takeSeat,
	voteRematch,
	type RoomState,
} from "../../multiplayer/engine";
import { fuzz, playOut, testCards } from "../../multiplayer/testkit";
import { createRng } from "../../multiplayer/rng";
import { parseClientMessage } from "../../multiplayer/protocol";
import { parseInviteCode, inviteUrl, makeInviteCode } from "../../multiplayer/links";

// Nim: take 1–2 sticks; whoever takes the last stick wins. Seat 0 starts.
type NimState = { sticks: number; turn: Seat; winner: Seat | null };
type NimAction = { type: "take"; n: 1 | 2 };
const nim: GameDefinition<NimState, NimAction, NimState> = {
	id: "fence_the_pen",
	title: "Nim",
	tagline: "Take one or two; take the last.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live", "async"],
	decisionMs: { live: 10_000, async: 3_600_000 },
	setup: () => ({ sticks: 7, turn: 0, winner: null }),
	activeSeats: (s) => (s.winner === null ? [s.turn] : []),
	apply: (s, seat, a) => {
		if (s.winner !== null) return { ok: false, error: "game_over" };
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		if (a.n > s.sticks) return { ok: false, error: "illegal_move" };
		const sticks = s.sticks - a.n;
		return {
			ok: true,
			state: { sticks, turn: sticks === 0 ? s.turn : 1 - s.turn, winner: sticks === 0 ? seat : null },
			events: [{ type: "take", seat, n: a.n }],
		};
	},
	onTimeout: (s, seat) => {
		const sticks = s.sticks - 1;
		return { state: { sticks, turn: sticks === 0 ? seat : 1 - seat, winner: sticks === 0 ? seat : null } };
	},
	view: (s) => s,
	result: (s) => (s.winner === null ? null : { kind: "win", winners: [s.winner], scores: [s.winner === 0 ? 1 : 0, s.winner === 1 ? 1 : 0], summary: "last stick" }),
	bot: (v, seat) => (v.turn === seat && v.winner === null ? { type: "take", n: v.sticks % 3 === 2 ? 2 : 1 } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown };
		return r && r.type === "take" && (r.n === 1 || r.n === 2) ? { type: "take", n: r.n } : null;
	},
};

// Sealed: both seats pick 1–3 at once; higher wins the round; best of 3.
// The pick is secret until both are in.
type SealedState = { picks: (number | null)[]; wins: number[]; round: number };
type SealedView = { mine: number | null; theirsIn: boolean; wins: number[]; round: number; lastReveal: number[] | null };
const sealed: GameDefinition<SealedState & { last: number[] | null }, { type: "pick"; n: number }, SealedView> = {
	id: "mud_volley",
	title: "Sealed",
	tagline: "Pick high.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live"],
	decisionMs: { live: 8_000 },
	setup: () => ({ picks: [null, null], wins: [0, 0], round: 1, last: null }),
	activeSeats: (s) => (s.round > 3 ? [] : ([0, 1] as Seat[]).filter((i) => s.picks[i] === null)),
	apply: (s, seat, a) => {
		if (s.picks[seat] !== null) return { ok: false, error: "not_your_turn" };
		const picks = s.picks.slice();
		picks[seat] = a.n;
		if (picks.some((p) => p === null)) return { ok: true, state: { ...s, picks } };
		const [p0, p1] = picks as number[];
		const wins = s.wins.slice();
		if (p0 > p1) wins[0]++;
		else if (p1 > p0) wins[1]++;
		return { ok: true, state: { picks: [null, null], wins, round: s.round + 1, last: [p0, p1] }, events: [{ type: "reveal", picks: [p0, p1] }] };
	},
	onTimeout: (s, seat, ctx) => {
		const res = sealed.apply(s, seat, { type: "pick", n: 1 }, ctx);
		if (!res.ok) throw new Error("timeout pick must be legal");
		return { state: res.state, events: res.events };
	},
	view: (s, seat) => ({ mine: s.picks[seat], theirsIn: s.picks[1 - seat] !== null, wins: s.wins, round: s.round, lastReveal: s.last }),
	secretsOf: (s, seat) => (s.picks[1 - seat] !== null ? [`"theirPick":${s.picks[1 - seat]}`] : []),
	result: (s) => {
		if (s.round <= 3) return null;
		const [a, b] = s.wins;
		return a === b ? { kind: "draw", winners: [], scores: s.wins, summary: `${a} to ${b}` } : { kind: "win", winners: [a > b ? 0 : 1], scores: s.wins, summary: `${a} to ${b}` };
	},
	bot: (v, _seat, rng) => (v.mine === null && v.round <= 3 ? { type: "pick", n: rng.range(1, 3) } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown };
		return r && r.type === "pick" && (r.n === 1 || r.n === 2 || r.n === 3) ? { type: "pick", n: r.n } : null;
	},
};

const NOW = 1_700_000_000_000;

function liveTable(game: AnyGame = nim, seats = 2): RoomState {
	const room = createRoom({ roomId: "00000000-aaaa", game, pace: "live", source: "queue", seatCount: seats, seats: testCards(seats), seed: "seed-1", now: NOW });
	return startGame(beginCountdown(room, game, NOW), game, NOW + 3_000);
}

describe("room engine", () => {
	it("starts a table, arms the clock, and moves the revision on every step", () => {
		const room = liveTable();
		expect(room.phase).toBe("playing");
		expect(room.activeSeats).toEqual([0]);
		expect(room.deadline).toBe(NOW + 3_000 + 10_000);
		const res = applyAction(room, nim, 0, { type: "take", n: 1 }, NOW + 4_000);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.room.rev).toBe(room.rev + 1);
		expect(res.room.activeSeats).toEqual([1]);
		expect(res.room.deadline).toBe(NOW + 4_000 + 10_000);
		expect(res.room.events).toEqual([{ type: "take", seat: 0, n: 1 }]);
	});

	it("refuses out-of-turn, malformed and illegal actions without changing the room", () => {
		const room = liveTable();
		expect(applyAction(room, nim, 1, { type: "take", n: 1 }, NOW)).toEqual({ ok: false, error: "not_your_turn" });
		expect(applyAction(room, nim, 0, { type: "take", n: 3 }, NOW)).toEqual({ ok: false, error: "bad_action" });
		expect(applyAction(room, nim, 0, "take two", NOW)).toEqual({ ok: false, error: "bad_action" });
	});

	it("keeps a shared deadline in a simultaneous beat when the first pig answers", () => {
		const room = liveTable(sealed);
		const deadline = room.deadline;
		const res = applyAction(room, sealed, 0, { type: "pick", n: 3 }, NOW + 5_000);
		expect(res.ok && res.room.deadline).toBe(deadline);
		expect(res.ok && res.room.activeSeats).toEqual([1]);
	});

	it("resolves a missed deadline through the game's default and marks the seat after three misses", () => {
		let room = liveTable();
		room = applyTimeouts(room, nim, room.deadline as number);
		expect(room.seats[0]?.missed).toBe(1);
		expect(room.activeSeats).toEqual([1]);
		// Nothing happens before the deadline.
		expect(applyTimeouts(room, nim, (room.deadline as number) - 1)).toBe(room);
	});

	it("gives a competitive table to the pig who stayed when the other leaves", () => {
		const room = markGone(liveTable(), nim, 1, NOW + 5_000);
		expect(room.phase).toBe("ended");
		expect(room.result).toMatchObject({ kind: "win", winners: [0], reason: "forfeit" });
	});

	it("calls a table that loses a pig during the countdown a no contest", () => {
		const room = createRoom({ roomId: "00000000-bbbb", game: nim, pace: "live", source: "queue", seatCount: 2, seats: testCards(2), seed: "s", now: NOW });
		const counting = beginCountdown(room, nim, NOW);
		const ended = markGone(counting, nim, 0, NOW + 1_000);
		expect(ended.result).toMatchObject({ kind: "no_contest", reason: "ended_early" });
	});

	it("fills a lobby, starts early at the minimum, and drops open chairs", () => {
		let room = createRoom({ roomId: "00000000-cccc", game: { ...nim, seats: { min: 2, max: 4 } }, pace: "live", source: "invite", seatCount: 4, seats: [testCards(1)[0]], seed: "s", now: NOW, host: 0 });
		const game = { ...nim, seats: { min: 2, max: 4 } };
		expect(canStart(room, game, true)).toBe(false);
		const taken = takeSeat(room, game, testCards(2)[1], NOW);
		expect(taken.ok && taken.seat).toBe(1);
		if (!taken.ok) return;
		room = taken.room;
		expect(canStart(room, game, true)).toBe(true);
		expect(canStart(room, game, false)).toBe(false);
		expect(beginCountdown(room, game, NOW).seats).toHaveLength(2);
	});

	it("holds an async open chair without a clock, then arms it when the chair is filled", () => {
		const room = createRoom({ roomId: "00000000-dddd", game: nim, pace: "async", source: "queue", seatCount: 2, seats: [testCards(1)[0], null], seed: "s", now: NOW });
		let playing = startGame(room, nim, NOW);
		const moved = applyAction(playing, nim, 0, { type: "take", n: 1 }, NOW + 1_000);
		expect(moved.ok).toBe(true);
		if (!moved.ok) return;
		playing = moved.room;
		expect(playing.activeSeats).toEqual([1]);
		expect(playing.deadline).toBeNull();
		const filled = takeSeat(playing, nim, testCards(2)[1], NOW + 60_000);
		expect(filled.ok && filled.room.deadline).toBe(NOW + 60_000 + 3_600_000);
	});

	it("runs a rematch vote and rotates the seats", () => {
		let room = liveTable();
		room = markGone(room, nim, 1, NOW); // ends by forfeit; seat 1 gone
		expect(voteRematch(room, 1, NOW).ok).toBe(false);
		const finished = playOut(nim, { seats: 2, seed: "rematch" }).room;
		const first = voteRematch(finished, 0, NOW);
		expect(first.ok && first.ready).toBe(false);
		if (!first.ok) return;
		const second = voteRematch(first.room, 1, NOW + 1_000);
		expect(second.ok && second.ready).toBe(true);
		expect(rematchSeats(finished).map((c) => c.userId)).toEqual(["user-1", "user-0"]);
	});

	it("never puts the seed or another seat's sealed pick in a snapshot", () => {
		const room = liveTable(sealed);
		const res = applyAction(room, sealed, 0, { type: "pick", n: 3 }, NOW + 1_000);
		if (!res.ok) throw new Error("pick failed");
		const theirs = JSON.stringify(snapshotFor(res.room, sealed, 1));
		expect(theirs).not.toContain("seed-1");
		expect(snapshotFor(res.room, sealed, 1).view).toMatchObject({ mine: null, theirsIn: true });
		expect(snapshotFor(res.room, sealed, 0).view).toMatchObject({ mine: 3 });
	});

	it("fuzzes both toy games to completion with no illegal bot moves and no leaks", () => {
		for (const game of [nim, sealed]) {
			const run = fuzz(game, 40, { timeoutRate: 0.15 });
			expect(run.unfinished).toBe(0);
			expect(run.illegal).toBe(0);
			expect(run.leaks).toBe(0);
		}
	});

	it("never crowns a pig who left; the best-placed pig still seated takes it", () => {
		// One move each, then a fixed result naming seat 2 (who will have left).
		type S = { moved: boolean[] };
		const fixed: GameDefinition<S, { type: "go" }, S> = {
			...(nim as unknown as GameDefinition<S, { type: "go" }, S>),
			seats: { min: 2, max: 3 },
			setup: ({ seats }) => ({ moved: Array.from({ length: seats }, () => false) }),
			activeSeats: (s) => s.moved.flatMap((m, i) => (m ? [] : [i])),
			apply: (s, seat) => ({ ok: true, state: { moved: s.moved.map((m, i) => m || i === seat) } }),
			onTimeout: (s, seat) => ({ state: { moved: s.moved.map((m, i) => m || i === seat) } }),
			view: (s) => s,
			result: (s) => (s.moved.every(Boolean) ? { kind: "win", winners: [2], scores: [1, 2, 3], summary: "" } : null),
			bot: () => ({ type: "go" }),
			parseAction: () => ({ type: "go" }),
		};
		let room = liveTable(fixed, 3);
		room = (applyAction(room, fixed, 0, { type: "go" }, NOW + 1) as { ok: true; room: RoomState }).room;
		room = (applyAction(room, fixed, 1, { type: "go" }, NOW + 2) as { ok: true; room: RoomState }).room;
		room = markGone(room, fixed, 2, NOW + 3);
		expect(room.phase).toBe("ended");
		expect(room.result).toMatchObject({ kind: "win", winners: [1], reason: "complete" });
	});

	it("ends a table where both pigs idle out as a no contest, not a forfeit", () => {
		// Simultaneous beats: both miss together.
		const longSealed = { ...sealed, result: (s: SealedState & { last: number[] | null }) => (s.round > 20 ? sealed.result(s) : null) } as typeof sealed;
		let room = liveTable(longSealed);
		while (room.phase === "playing") room = applyTimeouts(room, longSealed, room.deadline as number);
		expect(room.result).toMatchObject({ kind: "no_contest", reason: "ended_early" });
		// Turn-based: they miss in alternation.
		const longNim = { ...nim, setup: () => ({ sticks: 40, turn: 0 as Seat, winner: null }) } as typeof nim;
		let turns = liveTable(longNim);
		while (turns.phase === "playing") turns = applyTimeouts(turns, longNim, turns.deadline as number);
		expect(turns.result).toMatchObject({ kind: "no_contest", reason: "ended_early" });
	});

	it("still gives the table to the pig who stayed when only the other idles out", () => {
		const longNim = { ...nim, setup: () => ({ sticks: 40, turn: 0 as Seat, winner: null }) } as typeof nim;
		let room = liveTable(longNim);
		for (let i = 0; i < 12 && room.phase === "playing"; i++) {
			if (room.activeSeats[0] === 0) room = applyTimeouts(room, longNim, room.deadline as number);
			else {
				const res = applyAction(room, longNim, 1, { type: "take", n: 1 }, (room.deadline as number) - 1);
				if (res.ok) room = res.room;
			}
		}
		expect(room.result).toMatchObject({ kind: "win", winners: [1], reason: "forfeit" });
	});

	it("tells the game which pigs are still at the table", () => {
		const seen: boolean[][] = [];
		const watching = { ...nim, seats: { min: 2, max: 3 }, apply: (s: NimState, seat: Seat, a: NimAction, ctx: StepContext) => {
			seen.push([...ctx.present]);
			return nim.apply(s, seat, a, ctx);
		} } as GameDefinition<NimState, NimAction, NimState>;
		let room = liveTable(watching, 3);
		room = markGone(room, watching, 2, NOW + 1);
		applyAction(room, watching, 0, { type: "take", n: 1 }, NOW + 2);
		expect(seen.at(-1)).toEqual([true, true, false]);
	});

	it("counts an open async chair as present, so a turn waits for the newcomer", () => {
		// Rotates turns past seats that are not present (the pattern games use).
		const rotate = {
			...nim,
			apply: (s: NimState, seat: Seat, a: NimAction, ctx: StepContext) => {
				const res = nim.apply(s, seat, a, ctx);
				if (!res.ok || res.state.winner !== null) return res;
				let next = (seat + 1) % 2;
				if (!ctx.present[next]) next = seat; // would skip an absent pig
				return { ...res, state: { ...res.state, turn: next as Seat } };
			},
		} as GameDefinition<NimState, NimAction, NimState>;
		const room = createRoom({ roomId: "00000000-eeee", game: rotate, pace: "async", source: "queue", seatCount: 2, seats: [testCards(1)[0], null], seed: "s", now: NOW });
		const playing = startGame(room, rotate, NOW);
		const moved = applyAction(playing, rotate, 0, { type: "take", n: 1 }, NOW + 1);
		expect(moved.ok && moved.room.activeSeats).toEqual([1]); // the open chair owes the move
		expect(moved.ok && moved.room.deadline).toBeNull(); // and carries no clock until filled
	});

	it("plays on around a departed seat in a three-pig competitive table", () => {
		const three = { ...nim, seats: { min: 2, max: 3 } } as typeof nim;
		const report = playOut(three, { seats: 3, seed: "three", leave: { seat: 2, atStep: 1 } });
		expect(report.room.phase).toBe("ended");
		expect(report.room.seats[2]?.gone).toBe(true);
	});
});

describe("rng", () => {
	it("is deterministic per seed and spreads across its range", () => {
		const a = createRng("x");
		const b = createRng("x");
		const seqA = Array.from({ length: 50 }, () => a.int(6));
		expect(Array.from({ length: 50 }, () => b.int(6))).toEqual(seqA);
		expect(new Set(seqA).size).toBe(6);
		expect(createRng("y").int(1000)).not.toBe(createRng("x").int(1000));
	});
});

describe("protocol + links", () => {
	const games = ["fence_the_pen", "mud_volley"] as const;
	it("accepts well-formed frames and rejects everything else", () => {
		expect(parseClientMessage({ t: "queue.join", rid: 3, games: ["mud_volley"], pace: "live" }, games)).toEqual({ t: "queue.join", rid: 3, games: ["mud_volley"], pace: "live" });
		expect(parseClientMessage({ t: "queue.join", games: ["chess"], pace: "live" }, games)).toBeNull();
		expect(parseClientMessage({ t: "invite.create", game: "mud_volley", kind: "link", pace: "live", to: ["x"] }, games)).toBeNull();
		expect(parseClientMessage({ t: "invite.accept", code: "abcd2345" }, games)).toEqual({ t: "invite.accept", code: "ABCD2345" });
		expect(parseClientMessage({ t: "invite.accept", code: "ABCD1111" }, games)).toBeNull();
		expect(parseClientMessage({ t: "room.emote", roomId: "0000aaaa-1111", emote: "shout" }, games)).toBeNull();
		expect(parseClientMessage({ t: "nope" }, games)).toBeNull();
	});
	it("round-trips invite codes through URLs and typed input", () => {
		const code = makeInviteCode(createRng("code").int);
		expect(parseInviteCode(inviteUrl(code))).toBe(code);
		expect(parseInviteCode(`ticklethepig://play/${code.toLowerCase()}`)).toBe(code);
		expect(parseInviteCode(` ${code} `)).toBe(code);
		expect(parseInviteCode("https://ticklethepig.com/i/ABCDE-1234")).toBeNull();
	});
});
