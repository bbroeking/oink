// Snout Says: a cooperative picture-clue game for two to four pigs.
// "Show me one picture that reminds you of it, and I'll guess which one you mean."
//
// Lineage: Just One (everyone clues; identical clues cancel) crossed with
// Codenames Duet (a grid, one target), in pictures. Spec:
// docs/multiplayer/explorations/03-cooperative-and-asymmetric.md §2.2 and
// §4.2, with the lead's amendments (see ./README.md, "Deviations").
//
// A round, in two beats:
//   clue   Every Nose (each seat but the Guesser) knows the answer and
//          secretly shows ONE picture from its tray of twelve. When every
//          Nose has answered (or the clock runs out), pictures two or more
//          Noses showed cancel; the survivors go up beside their Noses. If
//          nothing survives, three wrong tiles fog over (the free sniff).
//   guess  The Guesser taps the spread: right first tap 2, right second tap
//          1, else 0. A wrong tap dims that tile for everyone.
// There is no reveal beat on the server: a scored round is kept as the
// view's `lastRound`, the next round opens at once, and the clock pads the
// next clue beat by the board's reveal time.
//
// Pure: relative imports only, JSON-only state, ctx.rng for every draw.

import type { GameDefinition, GameEvent, GameResult, Pace, Rng, Seat, StepContext, StepResult } from "../../types";
import { actionType, isRecord } from "../../validate";
import { PICTURE_IDS, isPictureId, kinCount, kinship, type PictureId } from "./deck";

const HOUR_MS = 3_600_000;

/** Every number the game is tuned by. Changing one is a rulesVersion bump. */
export const SNOUT_SAYS_TUNING = Object.freeze({
	rounds: { live: 6, async: 3 } as Readonly<Record<Pace, number>>,
	spread: 9,
	tray: 12,
	/** At least this many tray pictures share a tag with the answer. */
	kindMinimum: 3,
	/** Tiles fogged when no clue survives. */
	freeSniff: 3,
	guesses: 2,
	points: { first: 2, second: 1, none: 0 },
	clueMs: { live: 10_000, async: 12 * HOUR_MS } as Readonly<Record<Pace, number>>,
	guessMs: { live: 10_000, async: 12 * HOUR_MS } as Readonly<Record<Pace, number>>,
	/** How long the board plays a scored round before the next beat. Live
	 *  only; an async table opens its next round straight away. */
	revealMs: { live: 3_000, async: 0 } as Readonly<Record<Pace, number>>,
	/** Bounded redeals: spreads tried, then trays tried per spread, before
	 *  the constructive deal (which cannot fail). */
	dealTries: { spread: 16, tray: 16 },
	/** The practice Nose shows its best picture this often, else its second. */
	botBestChance: 0.7,
});

export type SnoutSaysPhase = "clue" | "guess" | "over";

/** knew 2 · nearly 1 · got away 0 after a wrong tap · in the mud 0 with no tap. */
export type SnoutSaysOutcome = "knew" | "nearly" | "got_away" | "mud";

/** One Nose's picture once the clue beat has closed. */
export interface SaidClue {
	seat: Seat;
	picture: PictureId;
	/** Another Nose showed the same picture, so both tore away. */
	cancelled: boolean;
}

export interface SnoutSaysRound {
	index: number;
	guesser: Seat;
	/** Seats clueing this round: every seat at the table but the Guesser. */
	noses: Seat[];
	/** A canary that is never copied into any view: `secretsOf` lists it for
	 *  every seat, so a round leaked into a view wholesale is caught. */
	seal: string;
	spread: PictureId[];
	/** Hidden from the Guesser until the round is scored. */
	target: PictureId;
	/** Hidden from the Guesser. Dealt from the 18 pictures not in the spread. */
	tray: PictureId[];
	/** Per seat; hidden from every other seat until the clue beat closes. */
	picks: (PictureId | null)[];
	/** Per seat: this Nose no longer owes a pick (it picked, or it passed). */
	answered: boolean[];
	/** Null while the clue beat is open. */
	said: SaidClue[] | null;
	/** The free sniff's fogged tiles (empty when a clue survived). */
	sniffed: PictureId[];
	/** Fogged tiles plus wrong taps; none of these can be tapped. */
	dimmed: PictureId[];
	/** Every tap the Guesser made, in order (the last one may be right). */
	guesses: PictureId[];
	/** Live: server time the previous round's reveal ends on the boards. */
	revealUntil: number | null;
	/** Reveal time still unplayed when the clue beat closed early; the first
	 *  guess gets it back so a fast table never eats the Guesser's clock. */
	guessPadMs: number;
	score: number | null;
	outcome: SnoutSaysOutcome | null;
}

export interface SnoutSaysState {
	rulesVersion: 1;
	seats: number;
	pace: Pace;
	rounds: number;
	phase: SnoutSaysPhase;
	/** The round in play; null once the game is over. */
	round: SnoutSaysRound | null;
	/** Every scored round, in order. */
	done: SnoutSaysRound[];
	total: number;
}

export type SnoutSaysAction = { type: "clue"; picture: PictureId } | { type: "guess"; picture: PictureId };

/** A scored round, as every seat may see it (the reveal, the ledger). */
export interface SnoutSaysRecord {
	index: number;
	guesser: Seat;
	spread: PictureId[];
	target: PictureId;
	said: SaidClue[];
	clues: PictureId[];
	cancelled: PictureId[];
	sniffed: PictureId[];
	guesses: PictureId[];
	score: number;
	outcome: SnoutSaysOutcome;
}

/** Where a Nose stands in the open clue beat. Never which picture. */
export type NoseStatus = "thinking" | "picked" | "out";

export interface SnoutSaysNoseView {
	target: PictureId;
	tray: PictureId[];
	myPick: PictureId | null;
}

export interface SnoutSaysView {
	phase: SnoutSaysPhase;
	pace: Pace;
	seats: number;
	rounds: number;
	/** The round in play (0-based); equals `rounds` once the game is over. */
	round: number;
	total: number;
	maxTotal: number;
	role: "guesser" | "nose" | "out";
	guesser: Seat | null;
	spread: PictureId[];
	dimmed: PictureId[];
	sniffed: PictureId[];
	guesses: PictureId[];
	guessesLeft: number;
	noses: { seat: Seat; status: NoseStatus }[];
	/** Null until the clue beat closes. */
	said: SaidClue[] | null;
	clues: PictureId[] | null;
	cancelled: PictureId[] | null;
	/** A Nose's own knowledge; null for the Guesser (and a pig sitting out). */
	nose: SnoutSaysNoseView | null;
	/** The round scored most recently, for the board's reveal. */
	lastRound: SnoutSaysRecord | null;
	/** Every scored round, for the result ledger. */
	history: SnoutSaysRecord[];
}

const TUNE = SNOUT_SAYS_TUNING;

// ── The deal ────────────────────────────────────────────────────────────────

export interface Deal {
	spread: PictureId[];
	target: PictureId;
	tray: PictureId[];
}

/**
 * Nine pictures, one of them the answer, and a kind tray of twelve from the
 * other eighteen. Redealt until the tray holds at least `kindMinimum`
 * pictures that share a tag with the answer: the tray first, and the spread
 * when the spread swallowed so much of the answer's kin that no tray could
 * be kind. Bounded; the constructive deal closes the (vanishing) gap.
 */
export function dealRound(rng: Rng): Deal {
	for (let s = 0; s < TUNE.dealTries.spread; s++) {
		const deck = rng.shuffle(PICTURE_IDS);
		const spread = deck.slice(0, TUNE.spread);
		const target = rng.pick(spread);
		const pool = deck.slice(TUNE.spread);
		if (kinCount(pool, target) < TUNE.kindMinimum) continue;
		for (let t = 0; t < TUNE.dealTries.tray; t++) {
			const tray = rng.shuffle(pool).slice(0, TUNE.tray);
			if (kinCount(tray, target) >= TUNE.kindMinimum) return { spread, target, tray };
		}
	}
	return constructiveDeal(rng);
}

/** The deal that cannot fail: seat three of the answer's kin in the tray
 *  first, then fill the spread and the tray around them. Every picture has
 *  at least five kin in the deck (pinned by the deck test). */
export function constructiveDeal(rng: Rng): Deal {
	const target = rng.pick(PICTURE_IDS);
	const kin = rng.shuffle(PICTURE_IDS.filter((p) => p !== target && kinship(p, target) > 0)).slice(0, TUNE.kindMinimum);
	const rest = rng.shuffle(PICTURE_IDS.filter((p) => p !== target && !kin.includes(p)));
	const spread = rng.shuffle([target, ...rest.slice(0, TUNE.spread - 1)]);
	const pool = rest.slice(TUNE.spread - 1);
	const tray = rng.shuffle([...kin, ...rng.shuffle(pool).slice(0, TUNE.tray - kin.length)]);
	return { spread, target, tray };
}

// ── Steps ───────────────────────────────────────────────────────────────────

function seatList(seats: number): Seat[] {
	return Array.from({ length: seats }, (_, i) => i);
}

/** The next pig still at the table after `prev`, in seat order. */
function nextGuesser(prev: Seat, seats: number, present: readonly boolean[]): Seat {
	for (let k = 1; k <= seats; k++) {
		const s = (prev + k) % seats;
		if (present[s] !== false) return s;
	}
	return (prev + 1) % seats;
}

function owing(round: SnoutSaysRound): Seat[] {
	return round.noses.filter((s) => !round.answered[s]);
}

function openRound(
	state: Pick<SnoutSaysState, "seats" | "pace">,
	index: number,
	guesser: Seat,
	present: readonly boolean[],
	rng: Rng,
	now: number | null,
): SnoutSaysRound {
	const { spread, target, tray } = dealRound(rng);
	const revealMs = TUNE.revealMs[state.pace];
	return {
		index,
		guesser,
		noses: seatList(state.seats).filter((s) => s !== guesser && present[s] !== false),
		seal: `seal:${index}`,
		spread,
		target,
		tray,
		picks: seatList(state.seats).map(() => null),
		answered: seatList(state.seats).map(() => false),
		said: null,
		sniffed: [],
		dimmed: [],
		guesses: [],
		revealUntil: now !== null && index > 0 && revealMs > 0 ? now + revealMs : null,
		guessPadMs: 0,
		score: null,
		outcome: null,
	};
}

/** Close the clue beat: cancel the doubles, fog three tiles if nothing
 *  survived, hand the round to the Guesser. */
function closeClues(state: SnoutSaysState, round: SnoutSaysRound, rng: Rng, now: number): StepResult<SnoutSaysState> {
	const counts = new Map<PictureId, number>();
	for (const s of round.noses) {
		const p = round.picks[s];
		if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
	}
	const said: SaidClue[] = round.noses.flatMap((s) => {
		const p = round.picks[s];
		return p ? [{ seat: s, picture: p, cancelled: (counts.get(p) ?? 0) > 1 }] : [];
	});
	const clues = said.filter((c) => !c.cancelled).map((c) => c.picture);
	const cancelled = uniq(said.filter((c) => c.cancelled).map((c) => c.picture));
	let sniffed: PictureId[] = [];
	if (clues.length === 0) {
		const fog = new Set(rng.shuffle(round.spread.filter((p) => p !== round.target)).slice(0, TUNE.freeSniff));
		sniffed = round.spread.filter((p) => fog.has(p));
	}
	const reveal = TUNE.revealMs[state.pace];
	const guessPadMs = round.revealUntil === null ? 0 : Math.min(reveal, Math.max(0, round.revealUntil - now));
	const next: SnoutSaysRound = { ...round, said, sniffed, dimmed: sniffed.slice(), guessPadMs };
	const events: GameEvent[] = [{ type: "cluesRevealed", round: round.index, said, clues, cancelled }];
	if (sniffed.length > 0) events.push({ type: "freeSniff", round: round.index, sniffed });
	events.push({ type: "beat", phase: "guess", round: round.index });
	return { state: { ...state, phase: "guess", round: next }, events };
}

/** Score the round in play, then open the next one (or end the game). */
function scoreRound(
	state: SnoutSaysState,
	round: SnoutSaysRound,
	score: number,
	outcome: SnoutSaysOutcome,
	ctx: StepContext,
	events: GameEvent[],
): StepResult<SnoutSaysState> {
	const scored: SnoutSaysRound = { ...round, score, outcome };
	const done = [...state.done, scored];
	const total = state.total + score;
	events.push({ type: "roundScored", round: round.index, score, outcome, target: round.target, total });
	if (done.length >= state.rounds) {
		events.push({ type: "done", total });
		return { state: { ...state, phase: "over", round: null, done, total }, events };
	}
	const guesser = nextGuesser(round.guesser, state.seats, ctx.present);
	const next = openRound(state, round.index + 1, guesser, ctx.present, ctx.rng, ctx.now);
	events.push({ type: "beat", phase: "clue", round: next.index, guesser });
	const opened: SnoutSaysState = { ...state, phase: "clue", round: next, done, total };
	// A round with nobody left to clue plays straight on the free sniff.
	if (next.noses.length === 0) {
		const closed = closeClues(opened, next, ctx.rng, ctx.now);
		return { state: closed.state, events: [...events, ...(closed.events ?? [])] };
	}
	return { state: opened, events };
}

function withSeat<V>(list: readonly V[], seat: Seat, value: V): V[] {
	const out = list.slice();
	out[seat] = value;
	return out;
}

function uniq<V>(list: readonly V[]): V[] {
	return Array.from(new Set(list));
}

/** Rank by score, highest first; ties broken by the rng (shuffle, then a
 *  stable sort), so two practice pigs looking at one tray can disagree. */
function rankBy(pictures: readonly PictureId[], score: (p: PictureId) => number, rng: Rng): PictureId[] {
	return rng
		.shuffle(pictures)
		.map((p) => ({ p, s: score(p) }))
		.sort((a, b) => b.s - a.s)
		.map((x) => x.p);
}

function record(round: SnoutSaysRound): SnoutSaysRecord {
	const said = round.said ?? [];
	return {
		index: round.index,
		guesser: round.guesser,
		spread: round.spread,
		target: round.target,
		said,
		clues: said.filter((c) => !c.cancelled).map((c) => c.picture),
		cancelled: uniq(said.filter((c) => c.cancelled).map((c) => c.picture)),
		sniffed: round.sniffed,
		guesses: round.guesses,
		score: round.score ?? 0,
		outcome: round.outcome ?? "mud",
	};
}

// ── The game ────────────────────────────────────────────────────────────────

export const snout_says: GameDefinition<SnoutSaysState, SnoutSaysAction, SnoutSaysView> = {
	id: "snout_says",
	title: "Snout Says",
	tagline: "Show me one picture that reminds you of it, and I'll guess which one you mean.",
	rulesVersion: 1,
	seats: { min: 2, max: 4 },
	kind: "cooperative",
	paces: ["live", "async"],
	decisionMs: { live: 10_000, async: 12 * HOUR_MS },

	setup({ seats, rng, pace }) {
		const base = { seats, pace };
		const everyone = seatList(seats).map(() => true);
		return {
			rulesVersion: 1,
			seats,
			pace,
			rounds: TUNE.rounds[pace],
			phase: "clue",
			round: openRound(base, 0, 0, everyone, rng, null),
			done: [],
			total: 0,
		};
	},

	activeSeats(state) {
		const round = state.round;
		if (state.phase === "over" || !round) return [];
		return state.phase === "clue" ? owing(round) : [round.guesser];
	},

	deadlineMs(state, pace) {
		const round = state.round;
		if (state.phase === "over" || !round) return null;
		if (state.phase === "clue") return TUNE.clueMs[pace] + (round.revealUntil !== null ? TUNE.revealMs[pace] : 0);
		return TUNE.guessMs[pace] + round.guessPadMs;
	},

	apply(state, seat, action, ctx) {
		const round = state.round;
		if (state.phase === "over" || !round) return { ok: false, error: "game_over" };

		if (action.type === "clue") {
			if (state.phase !== "clue" || !round.noses.includes(seat)) return { ok: false, error: "not_your_turn" };
			const prior = round.picks[seat];
			// Picks are final: the same picture again is a harmless resend.
			if (prior !== null) return prior === action.picture ? { ok: true, state } : { ok: false, error: "illegal_move" };
			if (round.answered[seat]) return { ok: false, error: "not_your_turn" };
			if (!round.tray.includes(action.picture)) return { ok: false, error: "illegal_move" };
			const next: SnoutSaysRound = {
				...round,
				picks: withSeat(round.picks, seat, action.picture),
				answered: withSeat(round.answered, seat, true),
			};
			const events: GameEvent[] = [{ type: "picked", seat, round: round.index }];
			if (owing(next).length > 0) return { ok: true, state: { ...state, round: next }, events };
			const closed = closeClues(state, next, ctx.rng, ctx.now);
			return { ok: true, state: closed.state, events: [...events, ...(closed.events ?? [])] };
		}

		// A guess.
		if (state.phase !== "guess" || seat !== round.guesser) return { ok: false, error: "not_your_turn" };
		if (!round.spread.includes(action.picture)) return { ok: false, error: "illegal_move" };
		// A dimmed tile cannot be tapped, a resent wrong tap included (see README).
		if (round.dimmed.includes(action.picture)) return { ok: false, error: "illegal_move" };
		const guesses = [...round.guesses, action.picture];
		const correct = action.picture === round.target;
		const events: GameEvent[] = [{ type: "guessed", seat, round: round.index, picture: action.picture, correct }];
		if (correct) {
			const first = guesses.length === 1;
			return {
				ok: true,
				...scoreRound(state, { ...round, guesses }, first ? TUNE.points.first : TUNE.points.second, first ? "knew" : "nearly", ctx, events),
			};
		}
		const missed: SnoutSaysRound = { ...round, guesses, dimmed: [...round.dimmed, action.picture], guessPadMs: 0 };
		if (guesses.length >= TUNE.guesses) {
			return { ok: true, ...scoreRound(state, missed, TUNE.points.none, "got_away", ctx, events) };
		}
		return { ok: true, state: { ...state, round: missed }, events };
	},

	onTimeout(state, seat, ctx) {
		const round = state.round;
		if (state.phase === "over" || !round) return { state };
		if (state.phase === "clue") {
			// A missing clue adds nothing.
			if (!round.noses.includes(seat) || round.answered[seat]) return { state };
			const next: SnoutSaysRound = { ...round, answered: withSeat(round.answered, seat, true) };
			if (owing(next).length > 0) return { state: { ...state, round: next } };
			return closeClues(state, next, ctx.rng, ctx.now);
		}
		// A missing guess leaves the round in the mud (or got away, after a wrong tap).
		if (seat !== round.guesser) return { state };
		return scoreRound(state, round, TUNE.points.none, round.guesses.length === 0 ? "mud" : "got_away", ctx, []);
	},

	view(state, seat) {
		const round = state.round;
		const history = state.done.map(record);
		const role: SnoutSaysView["role"] =
			!round ? "out" : seat === round.guesser ? "guesser" : round.noses.includes(seat) ? "nose" : "out";
		const said = round?.said ?? null;
		return {
			phase: state.phase,
			pace: state.pace,
			seats: state.seats,
			rounds: state.rounds,
			round: round ? round.index : state.rounds,
			total: state.total,
			maxTotal: state.rounds * TUNE.points.first,
			role,
			guesser: round ? round.guesser : null,
			spread: round ? round.spread : [],
			dimmed: round ? round.dimmed : [],
			sniffed: round ? round.sniffed : [],
			guesses: round ? round.guesses : [],
			guessesLeft: round ? Math.max(0, TUNE.guesses - round.guesses.length) : 0,
			noses: round
				? round.noses.map((s) => ({
						seat: s,
						status: round.picks[s] !== null ? "picked" : round.answered[s] ? "out" : "thinking",
					}))
				: [],
			said,
			clues: said ? said.filter((c) => !c.cancelled).map((c) => c.picture) : null,
			cancelled: said ? uniq(said.filter((c) => c.cancelled).map((c) => c.picture)) : null,
			nose: round && role === "nose" ? { target: round.target, tray: round.tray, myPick: round.picks[seat] } : null,
			lastRound: history.length > 0 ? history[history.length - 1] : null,
			history,
		};
	},

	secretsOf(state, seat) {
		const round = state.round;
		if (state.phase === "over" || !round) return [];
		const markers = [round.seal];
		if (seat === round.guesser) {
			markers.push(`"nose":{"target":"${round.target}"`, `"tray":${JSON.stringify(round.tray)}`);
			// A bare `"target":"x"` also appears, legitimately, in a scored
			// round's record whenever x was an earlier round's answer too; only
			// then is the key-and-value marker ambiguous, so it is left out (a
			// leak would be systematic and the other rounds still catch it).
			if (!state.done.some((r) => r.target === round.target)) markers.push(`"target":"${round.target}"`);
		}
		if (state.phase === "clue") {
			const mine = round.picks[seat];
			const theirs = round.noses.filter((s) => s !== seat && round.picks[s] !== null);
			if (theirs.length > 0) {
				markers.push(`"picks":${JSON.stringify(round.picks)}`);
				for (const s of theirs) {
					const p = round.picks[s];
					if (p !== mine) markers.push(`"myPick":"${p}"`);
				}
			}
		}
		return markers;
	},

	result(state): GameResult | null {
		if (state.phase !== "over") return null;
		const everyone = seatList(state.seats);
		return {
			kind: "coop",
			winners: everyone,
			scores: everyone.map(() => state.total),
			success: state.total >= state.rounds,
			summary: `${state.total} of ${state.rounds * TUNE.points.first}`,
		};
	},

	bot(view, seat, rng) {
		if (view.phase === "clue" && view.role === "nose" && view.nose) {
			const me = view.noses.find((n) => n.seat === seat);
			if (!me || me.status !== "thinking" || view.nose.myPick !== null) return null;
			const { target, tray } = view.nose;
			const ranked = rankBy(tray, (p) => kinship(p, target), rng);
			if (ranked.length === 0) return null;
			const best = ranked.length < 2 || rng.chance(TUNE.botBestChance) ? ranked[0] : ranked[1];
			return { type: "clue", picture: best };
		}
		if (view.phase === "guess" && view.role === "guesser") {
			const open = view.spread.filter((p) => !view.dimmed.includes(p));
			if (open.length === 0) return null;
			const clues = view.clues ?? [];
			if (clues.length === 0) return { type: "guess", picture: rng.pick(open) };
			const ranked = rankBy(open, (p) => clues.reduce((n, c) => n + kinship(p, c), 0), rng);
			return { type: "guess", picture: ranked[0] };
		}
		return null;
	},

	parseAction(raw) {
		const type = actionType(raw, ["clue", "guess"] as const);
		if (!type || !isRecord(raw) || !isPictureId(raw.picture)) return null;
		return { type, picture: raw.picture };
	},
};
