// Toy games for the server's tests and the e2e harness. They borrow real
// GameIds (the union is closed) but nothing else: the server is tested
// against these, never against the real registry, so a rules change in a
// real game can never break a transport test.
//
//   nim     2 seats, turn-based, live + async (from the engine's own suite)
//   sealed  2 seats, simultaneous sealed picks with a secret, live
//   race    2-4 seats, turn-based race to a total, live + async (party)
//   dig     2-3 seats, cooperative, live + async
//   beat    2 seats, sealed picks with a reveal beat the server clock ends (tick)

import type { GameDefinition, Seat } from "../../../multiplayer/types";

// ── Nim: take 1-2 sticks; whoever takes the last stick wins. ────────────────

export type NimState = { sticks: number; turn: Seat; winner: Seat | null };
type NimAction = { type: "take"; n: 1 | 2 };

export const nim: GameDefinition<NimState, NimAction, NimState> = {
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
	result: (s) =>
		s.winner === null
			? null
			: { kind: "win", winners: [s.winner], scores: [s.winner === 0 ? 1 : 0, s.winner === 1 ? 1 : 0], summary: "last stick" },
	bot: (v, seat) => (v.turn === seat && v.winner === null ? { type: "take", n: v.sticks % 3 === 2 ? 2 : 1 } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown } | null;
		return r && r.type === "take" && (r.n === 1 || r.n === 2) ? { type: "take", n: r.n } : null;
	},
};

// ── Sealed: both pick 1-3 at once; higher wins the round; best of 3. ────────

// Each pick carries a tag ("sealed-r1-s0-3") that only its owner may see:
// a view that leaked the state would leak the tag, which secretsOf names.
type SealedState = { picks: (number | null)[]; tags: (string | null)[]; wins: number[]; round: number; last: number[] | null };
type SealedView = {
	mine: number | null;
	myTag: string | null;
	theirsIn: boolean;
	wins: number[];
	round: number;
	lastReveal: number[] | null;
};

export const sealed: GameDefinition<SealedState, { type: "pick"; n: number }, SealedView> = {
	id: "mud_volley",
	title: "Sealed",
	tagline: "Pick high.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live"],
	decisionMs: { live: 8_000 },
	setup: () => ({ picks: [null, null], tags: [null, null], wins: [0, 0], round: 1, last: null }),
	activeSeats: (s) => (s.round > 3 ? [] : ([0, 1] as Seat[]).filter((i) => s.picks[i] === null)),
	apply: (s, seat, a) => {
		if (s.picks[seat] !== null) return { ok: false, error: "not_your_turn" };
		const picks = s.picks.slice();
		const tags = s.tags.slice();
		picks[seat] = a.n;
		tags[seat] = `sealed-r${s.round}-s${seat}-${a.n}`;
		if (picks.some((p) => p === null)) return { ok: true, state: { ...s, picks, tags } };
		const [p0, p1] = picks as number[];
		const wins = s.wins.slice();
		if (p0 > p1) wins[0]++;
		else if (p1 > p0) wins[1]++;
		return {
			ok: true,
			state: { picks: [null, null], tags: [null, null], wins, round: s.round + 1, last: [p0, p1] },
			events: [{ type: "reveal", picks: [p0, p1] }],
		};
	},
	onTimeout: (s, seat, ctx) => {
		const res = sealed.apply(s, seat, { type: "pick", n: 1 }, ctx);
		if (!res.ok) throw new Error("timeout pick must be legal");
		return { state: res.state, events: res.events };
	},
	view: (s, seat) => ({
		mine: s.picks[seat],
		myTag: s.tags[seat],
		theirsIn: s.picks[1 - seat] !== null,
		wins: s.wins,
		round: s.round,
		lastReveal: s.last,
	}),
	secretsOf: (s, seat) => {
		const theirs = s.tags[1 - seat];
		return theirs ? [theirs] : [];
	},
	result: (s) => {
		if (s.round <= 3) return null;
		const [a, b] = s.wins;
		return a === b
			? { kind: "draw", winners: [], scores: s.wins, summary: `${a} to ${b}` }
			: { kind: "win", winners: [a > b ? 0 : 1], scores: s.wins, summary: `${a} to ${b}` };
	},
	bot: (v, _seat, rng) => (v.mine === null && v.round <= 3 ? { type: "pick", n: rng.range(1, 3) } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown } | null;
		return r && r.type === "pick" && (r.n === 1 || r.n === 2 || r.n === 3) ? { type: "pick", n: r.n } : null;
	},
};

// ── Race: add 1-3 to a shared pile in turn; whoever reaches 12 wins. ────────

export type RaceState = { pile: number; turn: Seat; seats: number; winner: Seat | null };

function raceStep(s: RaceState, seat: Seat, n: number): RaceState {
	const pile = s.pile + n;
	return { ...s, pile, turn: pile >= 12 ? s.turn : (seat + 1) % s.seats, winner: pile >= 12 ? seat : null };
}

export const race: GameDefinition<RaceState, { type: "add"; n: number }, RaceState> = {
	id: "rootle",
	title: "Race",
	tagline: "Add one to three; reach twelve.",
	rulesVersion: 1,
	seats: { min: 2, max: 4 },
	kind: "competitive",
	paces: ["live", "async"],
	decisionMs: { live: 10_000, async: 3_600_000 },
	setup: ({ seats }) => ({ pile: 0, turn: 0, seats, winner: null }),
	activeSeats: (s) => (s.winner === null ? [s.turn] : []),
	apply: (s, seat, a) => {
		if (s.winner !== null) return { ok: false, error: "game_over" };
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		return { ok: true, state: raceStep(s, seat, a.n), events: [{ type: "add", seat, n: a.n }] };
	},
	onTimeout: (s, seat) => ({ state: raceStep(s, seat, 1) }),
	view: (s) => s,
	result: (s) =>
		s.winner === null
			? null
			: {
					kind: "win",
					winners: [s.winner],
					scores: Array.from({ length: s.seats }, (_, i) => (i === s.winner ? 1 : 0)),
					summary: "first to twelve",
				},
	bot: (v, seat, rng) => (v.turn === seat && v.winner === null ? { type: "add", n: rng.range(1, 3) } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown } | null;
		return r && r.type === "add" && (r.n === 1 || r.n === 2 || r.n === 3) ? { type: "add", n: r.n } : null;
	},
};

// ── Dig: take turns digging 1-3; after six digs the table needs 10. ─────────

export type DigState = { dug: number; turns: number; turn: Seat; seats: number };

export const dig: GameDefinition<DigState, { type: "dig"; n: number }, DigState> = {
	id: "snout_says",
	title: "Dig",
	tagline: "Dig together; ten truffles in six digs.",
	rulesVersion: 1,
	seats: { min: 2, max: 3 },
	kind: "cooperative",
	paces: ["live", "async"],
	decisionMs: { live: 10_000, async: 3_600_000 },
	setup: ({ seats }) => ({ dug: 0, turns: 0, turn: 0, seats }),
	activeSeats: (s) => (s.turns >= 6 ? [] : [s.turn]),
	apply: (s, seat, a) => {
		if (s.turns >= 6) return { ok: false, error: "game_over" };
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		return { ok: true, state: { ...s, dug: s.dug + a.n, turns: s.turns + 1, turn: (seat + 1) % s.seats } };
	},
	onTimeout: (s, seat) => ({ state: { ...s, dug: s.dug + 1, turns: s.turns + 1, turn: (seat + 1) % s.seats } }),
	view: (s) => s,
	result: (s) =>
		s.turns < 6
			? null
			: {
					kind: "coop",
					winners: Array.from({ length: s.seats }, (_, i) => i),
					scores: Array.from({ length: s.seats }, () => s.dug),
					success: s.dug >= 10,
					summary: `${s.dug} truffles`,
				},
	bot: (v, seat, rng) => (v.turn === seat && v.turns < 6 ? { type: "dig", n: rng.range(1, 3) } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown } | null;
		return r && r.type === "dig" && (r.n === 1 || r.n === 2 || r.n === 3) ? { type: "dig", n: r.n } : null;
	},
};

// ── Beat: sealed picks, then a reveal beat that only the server clock ends. ─

export type BeatState = {
	phase: "pick" | "reveal" | "done";
	picks: (number | null)[];
	tags: (string | null)[];
	wins: number[];
	round: number;
	revealUntil: number | null;
	shown: number[] | null;
};
type BeatView = Omit<BeatState, "picks" | "tags"> & { mine: number | null; myTag: string | null; theirsIn: boolean };

export const BEAT_REVEAL_MS = 400;

export const beat: GameDefinition<BeatState, { type: "pick"; n: number }, BeatView> = {
	id: "out_looking",
	title: "Beat",
	tagline: "Pick, reveal, again.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live"],
	decisionMs: { live: 8_000 },
	setup: () => ({ phase: "pick", picks: [null, null], tags: [null, null], wins: [0, 0], round: 1, revealUntil: null, shown: null }),
	activeSeats: (s) => (s.phase === "pick" ? ([0, 1] as Seat[]).filter((i) => s.picks[i] === null) : []),
	apply: (s, seat, a, ctx) => {
		if (s.phase !== "pick" || s.picks[seat] !== null) return { ok: false, error: "not_your_turn" };
		const picks = s.picks.slice();
		const tags = s.tags.slice();
		picks[seat] = a.n;
		tags[seat] = `beat-r${s.round}-s${seat}-${a.n}`;
		if (picks.some((p) => p === null)) return { ok: true, state: { ...s, picks, tags } };
		const [p0, p1] = picks as number[];
		const wins = s.wins.slice();
		if (p0 > p1) wins[0]++;
		else if (p1 > p0) wins[1]++;
		return {
			ok: true,
			state: {
				...s,
				phase: "reveal",
				picks: [null, null],
				tags: [null, null],
				wins,
				shown: [p0, p1],
				revealUntil: ctx.now + BEAT_REVEAL_MS,
			},
			events: [{ type: "reveal", picks: [p0, p1] }],
		};
	},
	onTimeout: (s, seat, ctx) => {
		const res = beat.apply(s, seat, { type: "pick", n: 1 }, ctx);
		if (!res.ok) throw new Error("timeout pick must be legal");
		return { state: res.state, events: res.events };
	},
	tick: {
		everyMs: 100,
		run: (s, ctx) => {
			if (s.phase !== "reveal" || s.revealUntil === null || ctx.now < s.revealUntil) return null;
			const done = s.round >= 2;
			return { state: { ...s, phase: done ? "done" : "pick", round: done ? s.round : s.round + 1, revealUntil: null } };
		},
	},
	view: (s, seat) => {
		const { picks, tags, ...rest } = s;
		return { ...rest, mine: picks[seat], myTag: tags[seat], theirsIn: picks[1 - seat] !== null };
	},
	secretsOf: (s, seat) => {
		const theirs = s.tags[1 - seat];
		return theirs ? [theirs] : [];
	},
	result: (s) => {
		if (s.phase !== "done") return null;
		const [a, b] = s.wins;
		return a === b
			? { kind: "draw", winners: [], scores: s.wins, summary: `${a} to ${b}` }
			: { kind: "win", winners: [a > b ? 0 : 1], scores: s.wins, summary: `${a} to ${b}` };
	},
	bot: (v, _seat, rng) => (v.phase === "pick" && v.mine === null ? { type: "pick", n: rng.range(1, 3) } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown } | null;
		return r && r.type === "pick" && (r.n === 1 || r.n === 2 || r.n === 3) ? { type: "pick", n: r.n } : null;
	},
};

export const FIXTURE_GAMES = [nim, sealed, race, dig, beat];
