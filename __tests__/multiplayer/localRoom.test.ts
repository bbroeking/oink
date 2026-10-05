// Practice tables on the shared engine with bot pigs, driven by a
// hand-cranked clock: a toy table plays to its end, bots think 700–1600 ms,
// timed vs untimed, leave cleans up, rematch rotates the chairs.

import type { GameDefinition, Seat } from "../../multiplayer/types";
import type { PlayerCard, RoomSnapshot } from "../../multiplayer/protocol";
import { createRng } from "../../multiplayer/rng";
import {
	PRACTICE_PIG_IDS,
	createPracticeRoom,
	isPracticeRoomId,
	practiceBots,
	type LocalRoomSource,
	type PracticeDeps,
	type PracticeOptions,
} from "../../utils/multiplayer/localRoom";
import { isMyTurn } from "../../utils/multiplayer/store";

// ── Toy games (the engine suite's Nim and Sealed) ───────────────────────────

type NimState = { sticks: number; turn: Seat; winner: Seat | null };
type NimAction = { type: "take"; n: 1 | 2 };
const nim: GameDefinition<NimState, NimAction, NimState> = {
	id: "fence_the_pen",
	title: "Nim",
	tagline: "Take one or two; take the last.",
	rulesVersion: 1,
	seats: { min: 2, max: 3 },
	kind: "competitive",
	paces: ["live", "async"],
	decisionMs: { live: 10_000, async: 3_600_000 },
	setup: () => ({ sticks: 7, turn: 0, winner: null }),
	activeSeats: (s) => (s.winner === null ? [s.turn] : []),
	apply: (s, seat, a, ctx) => {
		if (s.winner !== null) return { ok: false, error: "game_over" };
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		if (a.n > s.sticks) return { ok: false, error: "illegal_move" };
		const sticks = s.sticks - a.n;
		const seats = ctx.present.length;
		return {
			ok: true,
			state: { sticks, turn: sticks === 0 ? s.turn : (s.turn + 1) % seats, winner: sticks === 0 ? seat : null },
			events: [{ type: "take", seat, n: a.n }],
		};
	},
	onTimeout: (s, seat, ctx) => {
		const sticks = s.sticks - 1;
		return { state: { sticks, turn: sticks === 0 ? seat : (seat + 1) % ctx.present.length, winner: sticks === 0 ? seat : null } };
	},
	view: (s) => s,
	result: (s) =>
		s.winner === null ? null : { kind: "win", winners: [s.winner], scores: [0, 1, 2].map((i) => (i === s.winner ? 1 : 0)), summary: "last stick" },
	bot: (v, seat) => (v.turn === seat && v.winner === null ? { type: "take", n: v.sticks % 3 === 2 ? 2 : 1 } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown };
		return r && r.type === "take" && (r.n === 1 || r.n === 2) ? { type: "take", n: r.n } : null;
	},
};

type SealedState = { picks: (number | null)[]; wins: number[]; round: number; last: number[] | null };
type SealedView = { mine: number | null; theirsIn: boolean; wins: number[]; round: number; lastReveal: number[] | null };
const sealed: GameDefinition<SealedState, { type: "pick"; n: number }, SealedView> = {
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

// ── Harness ──────────────────────────────────────────────────────────────────

function fakeClock(start = 1_700_000_000_000) {
	let now = start;
	let seq = 0;
	const tasks = new Map<number, { at: number; fn: () => void }>();
	return {
		now: () => now,
		timers: {
			setTimeout: (fn: () => void, ms: number) => {
				const id = ++seq;
				tasks.set(id, { at: now + Math.max(0, ms), fn });
				return id;
			},
			clearTimeout: (id: unknown) => {
				tasks.delete(id as number);
			},
		},
		advance(ms: number) {
			const target = now + ms;
			for (;;) {
				let nextId: number | null = null;
				let nextAt = Infinity;
				for (const [id, task] of tasks) {
					if (task.at <= target && task.at < nextAt) {
						nextAt = task.at;
						nextId = id;
					}
				}
				if (nextId === null) break;
				const task = tasks.get(nextId)!;
				tasks.delete(nextId);
				now = task.at;
				task.fn();
			}
			now = target;
		},
		pending: () => tasks.size,
	};
}

const YOU: PlayerCard = {
	userId: "user-me",
	name: "Rosie",
	look: { pigId: "rosie", hat: "wizard", bow: null, glasses: null, mask: null, neck: null, held: null, aura: null, wallow: 2 },
};

function open(options: Partial<PracticeOptions> = {}, deps: Partial<PracticeDeps> = {}) {
	const clock = fakeClock();
	const source = createPracticeRoom(
		{ gameId: "fence_the_pen", you: YOU, ...options },
		{ game: nim, now: clock.now, timers: clock.timers, random: () => 0.5, seed: "seed-1", roomId: "practice-test", ...deps },
	) as LocalRoomSource;
	const seen: RoomSnapshot[] = [];
	source.subscribe(() => {
		if (source.snapshot && seen[seen.length - 1] !== source.snapshot) seen.push(source.snapshot);
	});
	return { source, clock, seen };
}

/** Play to the end: my moves from my own view (through the game's bot),
 *  the bots on their own timers. */
async function playToEnd(source: LocalRoomSource, clock: ReturnType<typeof fakeClock>, game: typeof nim | typeof sealed = nim) {
	for (let guard = 0; guard < 200 && source.snapshot?.phase !== "ended"; guard++) {
		const snap = source.snapshot!;
		if (snap.phase === "starting") {
			clock.advance((snap.startsAt as number) - clock.now());
			continue;
		}
		if (isMyTurn(snap)) {
			const you = snap.you as Seat;
			const action = (game.bot as (v: unknown, s: Seat, r: ReturnType<typeof createRng>) => unknown)(snap.view, you, createRng(`me:${snap.rev}`));
			const res = await source.act(action);
			expect(res).toEqual({ ok: true });
		} else {
			clock.advance(1_600);
		}
	}
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("practice tables", () => {
	it("seats me with bot pigs from the companion roster, each in its own sprite", () => {
		const { source } = open({ seats: 3 });
		const snap = source.snapshot!;
		expect(source.practice).toBe(true);
		expect(isPracticeRoomId(source.roomId)).toBe(true);
		expect(snap.roomId).toBe("practice-test");
		expect(snap.phase).toBe("starting");
		expect(snap.you).toBe(0);
		expect(snap.seats).toHaveLength(3);
		expect(snap.seats[0]).toMatchObject({ userId: "user-me", name: "Rosie", connected: true });
		const bots = snap.seats.slice(1);
		for (const bot of bots) {
			expect(PRACTICE_PIG_IDS).toContain(bot.look.pigId);
			expect(bot.look.pigId).not.toBe("rosie");
			expect(bot.connected).toBe(true);
			expect(bot.userId).toBe(`bot:${bot.look.pigId}`);
		}
		expect(new Set(bots.map((b) => b.look.pigId)).size).toBe(2);
		expect(bots.map((b) => b.name).every((n) => ["Copper", "Pepper", "Bandit", "Pickles", "Biscuit"].includes(n))).toBe(true);
	});

	it("never deals a bot the pig I brought", () => {
		for (let i = 0; i < 20; i++) {
			const bots = practiceBots(4, `seed-${i}`, "copper");
			expect(bots.map((b) => b.look.pigId)).not.toContain("copper");
		}
	});

	it("plays a toy table to its end with fake timers", async () => {
		const { source, clock, seen } = open();
		expect(source.snapshot!.startsAt).toBe(clock.now() + 3_000);
		clock.advance(3_000);
		expect(source.snapshot!.phase).toBe("playing");
		expect(source.snapshot!.deadline).not.toBeNull();
		await playToEnd(source, clock);
		const end = source.snapshot!;
		expect(end.phase).toBe("ended");
		expect(end.result).toMatchObject({ kind: "win", reason: "complete" });
		// Revisions only ever climb, and each snapshot is a new object.
		const revs = seen.map((s) => s.rev);
		expect(revs).toEqual([...revs].sort((a, b) => a - b));
		expect(new Set(revs).size).toBe(revs.length);
		expect(source.pendingTimers).toBeLessThanOrEqual(1); // at most a bot's "gg"
	});

	it("plays a simultaneous-choice table too", async () => {
		const clock = fakeClock();
		const source = createPracticeRoom(
			{ gameId: "mud_volley", you: YOU },
			{ game: sealed, now: clock.now, timers: clock.timers, random: () => 0.3, seed: "sealed" },
		)!;
		await playToEnd(source as LocalRoomSource, clock, sealed);
		expect(source.snapshot!.phase).toBe("ended");
		expect((source.snapshot!.view as SealedView).round).toBe(4);
	});

	it("lets a bot think 700–1600 ms before it moves", async () => {
		const fast = open({}, { random: () => 0 });
		fast.clock.advance(3_000);
		await fast.source.act({ type: "take", n: 1 });
		expect(fast.source.snapshot!.activeSeats).toEqual([1]);
		fast.clock.advance(699);
		expect(fast.source.snapshot!.activeSeats).toEqual([1]);
		fast.clock.advance(1);
		expect(fast.source.snapshot!.activeSeats).toEqual([0]);

		const slow = open({}, { random: () => 0.999999 });
		slow.clock.advance(3_000);
		await slow.source.act({ type: "take", n: 1 });
		slow.clock.advance(1_599);
		expect(slow.source.snapshot!.activeSeats).toEqual([1]);
		slow.clock.advance(1);
		expect(slow.source.snapshot!.activeSeats).toEqual([0]);
	});

	it("refuses an out-of-turn or malformed move with the engine's code", async () => {
		const { source, clock } = open();
		expect(await source.act({ type: "take", n: 1 })).toEqual({ ok: false, error: "not_your_turn" }); // still counting down
		clock.advance(3_000);
		expect(await source.act({ type: "take", n: 3 })).toEqual({ ok: false, error: "bad_action" });
		expect(await source.act({ type: "take", n: 1 })).toEqual({ ok: true });
		expect(await source.act({ type: "take", n: 1 })).toEqual({ ok: false, error: "not_your_turn" });
	});

	it("times out a pig who never moves, and three misses in a row hand the table over", () => {
		const { source, clock } = open();
		clock.advance(3_000);
		for (let i = 0; i < 40 && source.snapshot!.phase === "playing"; i++) clock.advance(1_000);
		const end = source.snapshot!;
		expect(end.phase).toBe("ended");
		expect(end.result).toMatchObject({ kind: "win", winners: [1], reason: "forfeit" });
		expect(end.seats[0].gone).toBe(true);
	});

	it("runs untimed: no deadline on the table and nobody ever times out", async () => {
		const { source, clock } = open({ untimed: true });
		clock.advance(3_000);
		expect(source.snapshot!.phase).toBe("playing");
		expect(source.snapshot!.deadline).toBeNull();
		clock.advance(60 * 60_000);
		expect(source.snapshot!.phase).toBe("playing");
		expect(isMyTurn(source.snapshot)).toBe(true);
		await playToEnd(source, clock);
		expect(source.snapshot!.result?.reason).toBe("complete");
	});

	it("cleans up every timer on leave and goes quiet", async () => {
		const { source, clock } = open();
		clock.advance(3_000);
		await source.act({ type: "take", n: 1 }); // a bot is now thinking
		expect(source.pendingTimers).toBeGreaterThan(0);
		const before = source.snapshot;
		await source.leave();
		expect(source.pendingTimers).toBe(0);
		expect(clock.pending()).toBe(0);
		clock.advance(60_000);
		expect(source.snapshot).toBe(before);
		expect(await source.act({ type: "take", n: 1 })).toEqual({ ok: false, error: "expired" });
	});

	it("rematches in place: chairs rotate, the room id stays, rev keeps climbing", async () => {
		const { source, clock } = open();
		await playToEnd(source, clock);
		const finalRev = source.snapshot!.rev;
		await source.rematch();
		const next = source.snapshot!;
		expect(next.roomId).toBe("practice-test");
		expect(next.phase).toBe("starting");
		expect(next.source).toBe("rematch");
		expect(next.rev).toBeGreaterThan(finalRev);
		expect(next.you).toBe(1); // I moved first last time; I move second now
		expect(next.result).toBeNull();
		await playToEnd(source, clock);
		expect(source.snapshot!.phase).toBe("ended");
		expect(source.snapshot!.rev).toBeGreaterThan(next.rev);
	});

	it("ignores a rematch before the table has ended", async () => {
		const { source, clock } = open();
		clock.advance(3_000);
		const snap = source.snapshot;
		await source.rematch();
		expect(source.snapshot).toBe(snap);
	});

	it("records my emote, drops spam inside the cooldown, and a practice pig waves back", () => {
		const { source, clock } = open({}, { random: () => 0 });
		source.emote("love");
		expect(source.emotes[0]).toEqual({ emote: "love", at: clock.now() });
		clock.advance(500);
		source.emote("oops"); // inside the 2 s cooldown
		expect(source.emotes[0].emote).toBe("love");
		clock.advance(1_000);
		expect(source.emotes[1]?.emote).toBeDefined();
	});

	it("runs a game's own clock (tick) like the server does, and stops it on leave", () => {
		type Clock = { left: number };
		const hourglass: GameDefinition<Clock, never, Clock> = {
			id: "out_looking",
			title: "Hourglass",
			tagline: "Wait for it.",
			rulesVersion: 1,
			seats: { min: 2, max: 2 },
			kind: "social",
			paces: ["live"],
			decisionMs: { live: 10_000 },
			setup: () => ({ left: 3 }),
			activeSeats: () => [],
			apply: () => ({ ok: false, error: "bad_action" }),
			onTimeout: (s) => ({ state: s }),
			tick: { everyMs: 500, run: (s) => (s.left > 0 ? { state: { left: s.left - 1 }, events: [{ type: "grain" }] } : null) },
			view: (s) => s,
			result: (s) => (s.left === 0 ? { kind: "coop", winners: [0, 1], scores: [0, 0], summary: "the sand ran out" } : null),
			bot: () => null,
			parseAction: () => null,
		};
		const clock = fakeClock();
		const source = createPracticeRoom({ gameId: "out_looking", you: YOU }, { game: hourglass, now: clock.now, timers: clock.timers, random: () => 0.5 })!;
		clock.advance(3_000);
		expect(source.snapshot!.phase).toBe("playing");
		clock.advance(500);
		expect((source.snapshot!.view as Clock).left).toBe(2);
		expect(source.snapshot!.events).toEqual([{ type: "grain" }]);
		clock.advance(1_000);
		expect(source.snapshot!.phase).toBe("ended");
		expect(source.snapshot!.result?.summary).toBe("the sand ran out");

		const again = createPracticeRoom({ gameId: "out_looking", you: YOU }, { game: hourglass, now: clock.now, timers: clock.timers, random: () => 0.5 }) as LocalRoomSource;
		clock.advance(3_500);
		void again.leave();
		const frozen = again.snapshot;
		clock.advance(5_000);
		expect(again.snapshot).toBe(frozen);
		expect(again.pendingTimers).toBe(0);
	});

	it("returns null for a game the app does not have", () => {
		expect(createPracticeRoom({ gameId: "nope" as never, you: YOU })).toBeNull();
	});
});
