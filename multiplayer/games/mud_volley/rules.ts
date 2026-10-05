// Mud Volley · Wind-up: the rules. Spec: docs/multiplayer/explorations/
// 02-arcade-and-party.md §2.1 and §4.1, with the lead's 2026-10-04 review
// (no tick; the next toss opens in the same step; seeded-random fallbacks;
// the room engine owns emotes, presence, idling and forfeits). README.md
// beside this file has the rules in four lines, the timing and the deviations.
//
// Two pigs, six tosses, the tosser alternating (the first tosser is dealt
// from the seed). Every toss the tosser is dealt a PUBLIC wind-up lane; then
// both pigs seal a lane at once, the tosser where the mudball goes and the
// catcher where the bucket goes:
//   toss on the wind-up, not caught   big splat, 2 to the tosser
//   toss off the wind-up, not caught  splat (the flick), 1 to the tosser
//   same lane                          clean catch, 1 to the catcher
// At equilibrium the tosser follows through one time in four, the catcher
// covers the wind-up half the time, and a toss is worth half a point.
//
// Two paces. Live: one sealed beat per toss; the beat closes the moment both
// lanes are in, and the next toss opens in the same step (its window starts
// after the settle + reveal beat the boards play). Async ("the envelope"):
// each pig seals all six decisions in one action; the match resolves when the
// second envelope arrives.
//
// Secrets, and the markers the test kit hunts for: every sealed lane, every
// envelope and every wind-up carries a `seal` string in state that no view
// ever copies, so a view that spreads the wrong object leaks a marker the
// fuzz catches (`secretsOf`).
//
// Pure module: relative imports only, JSON-only state, ctx.rng for every roll.

import type { GameDefinition, GameEvent, GameResult, Rng, Seat, StepContext, StepResult } from "../../types";
import { actionType, isInt, isOneOf, isRecord } from "../../validate";

// ── Vocabulary ───────────────────────────────────────────────────────────────

export type Lane = "L" | "M" | "R";
export const LANES: readonly Lane[] = ["L", "M", "R"];

/** splat2: the follow-through landed. splat1: the flick landed. catch: the
 *  catcher was in the lane. */
export type Outcome = "splat2" | "splat1" | "catch";

export type VolleyMode = "live" | "envelope";

/** A pig's job on the current toss. */
export type VolleyRole = "toss" | "catch";

export const EXCHANGES = 6;
/** Each pig tosses three times and catches three times. */
export const TOSSES_EACH = EXCHANGES / 2;

export const VOLLEY_PAYOFF = Object.freeze({ bigSplat: 2, splat: 1, catch: 1 });

/** Live timing (ms). The engine arms one shared deadline per toss:
 *  beat + commit + late grace, where the beat is the wind-up on the first
 *  toss and the settle + reveal on every later one. The visible window
 *  (commitOpensAt → commitClosesAt) leaves the grace out, so a stalled lane
 *  that lands inside it still counts. */
export const VOLLEY_TIMING = Object.freeze({
	/** The tosser swings toward the wind-up post; the cards open after it. */
	windupMs: 800,
	/** The visible commit window. */
	commitMs: 9_000,
	/** Past the visible window, before the seeded fallback lands. */
	lateGraceMs: 1_500,
	/** After the second lock, so the lock stamp lands before the reveal. */
	settleMs: 400,
	/** The reveal: the arc, then the splat or the catch. */
	revealMs: 2_600,
	/** The reveal's two halves (they sum to revealMs). */
	arcMs: 1_400,
	reactMs: 1_200,
	/** The envelope's deadline. */
	envelopeMs: 24 * 3_600_000,
});

/** A practice pig's personality: p = how often it follows through on its own
 *  wind-up, q = how often it covers the tosser's wind-up when catching. */
export interface VolleyTemper {
	p: number;
	q: number;
}

export const VOLLEY_BOTS = Object.freeze({
	/** Follows through two times in three: covering the wind-up catches him. */
	honestHank: Object.freeze({ p: 2 / 3, q: 1 / 2 }),
	/** The equilibrium. The default practice pig. */
	evenEdna: Object.freeze({ p: 1 / 4, q: 1 / 2 }),
	/** Almost never honest: the flick lanes catch her. */
	slipperySal: Object.freeze({ p: 1 / 10, q: 2 / 5 }),
});

// ── State ────────────────────────────────────────────────────────────────────

/** A lane nobody else may see yet, with its leak marker. */
export interface SealedLane {
	lane: Lane;
	seal: string;
}

interface Commit extends SealedLane {
	/** Thrown by the clock (the pig lobbed it anyhow), not by the pig. */
	fallback: boolean;
}

/** One pig's whole match, sealed: its three tosses (for its own three
 *  wind-ups, in toss order) and its three catches (against the rival's
 *  three, in toss order). */
export interface VolleyEnvelope {
	tosses: Lane[];
	catches: Lane[];
}

interface SealedEnvelope extends VolleyEnvelope {
	seal: string;
	fallback: boolean;
}

/** One resolved toss. Public from the moment it resolves. */
export interface VolleyRow {
	/** Toss index, 0..5. */
	ex: number;
	attacker: Seat;
	windup: Lane;
	toss: Lane;
	catchLane: Lane;
	outcome: Outcome;
	/** Who the points went to: the tosser on a splat, the catcher on a catch. */
	scorer: Seat;
	points: number;
	/** Per seat: was that pig's lane a timeout fallback? */
	fallback: boolean[];
	/** Server ms the toss resolved. */
	at: number;
}

export interface VolleyState {
	mode: VolleyMode;
	firstAttacker: Seat;
	/** Six wind-ups dealt at setup. Live: each turns public as its toss
	 *  opens. Envelope: all public from the start. */
	windups: SealedLane[];
	/** The toss being decided, 0..5; 6 once every toss has resolved. */
	exchange: number;
	phase: "commit" | "done";
	/** Live: this toss's sealed lanes, by seat. */
	commits: (Commit | null)[];
	/** Envelope: each pig's sealed match, by seat. */
	envelopes: (SealedEnvelope | null)[];
	/** Points by seat. */
	score: number[];
	history: VolleyRow[];
	/** Live: the visible commit window of the current toss, server ms (the
	 *  deadline adds the late grace). The first toss opens after the wind-up
	 *  from the table's start (`SetupContext.now`); a setup called without a
	 *  clock (a unit test) leaves it null. Null in envelope mode and when done. */
	commitOpensAt: number | null;
	commitClosesAt: number | null;
}

export type VolleyAction =
	/** Seal a lane for the current toss. `ex` names the toss it is for; a lane
	 *  for a toss that already resolved is refused rather than silently
	 *  becoming the next toss's lane (a retry after a lost ack). */
	| { type: "lane"; lane: Lane; ex?: number }
	| { type: "envelope"; tosses: Lane[]; catches: Lane[] };

// ── View ─────────────────────────────────────────────────────────────────────

export interface VolleyView {
	mode: VolleyMode;
	you: Seat;
	rival: Seat;
	phase: "commit" | "done";
	/** The toss being decided, 0..5; 6 when done. */
	exchange: number;
	exchanges: number;
	firstAttacker: Seat;
	/** Live, while a toss is open: who tosses it. */
	attacker: Seat | null;
	/** Live, while a toss is open: your job on it. */
	role: VolleyRole | null;
	/** Live, while a toss is open: its public wind-up. */
	windup: Lane | null;
	/** Envelope: the whole public schedule, by toss. */
	windups: Lane[] | null;
	/** Live: the lane you sealed for this toss. */
	yourLane: Lane | null;
	/** Live: the rival sealed this toss (never which lane). Envelope: the
	 *  rival's envelope is in (never what it says). */
	rivalLocked: boolean;
	/** Envelope: your own envelope, once sealed. */
	yourEnvelope: VolleyEnvelope | null;
	/** Points by seat. */
	score: number[];
	/** Every resolved toss, in order. */
	history: VolleyRow[];
	/** The most recent resolved toss (the one a board reveals). */
	lastReveal: VolleyRow | null;
	commitOpensAt: number | null;
	commitClosesAt: number | null;
	/** Live, while a toss is open: the beat a board plays before the lane cards
	 *  open (the wind-up on the first toss, the settle + reveal after). */
	beatMs: number;
	/** Live: the visible commit window. */
	windowMs: number;
}

// ── Pure helpers (shared with the board) ─────────────────────────────────────

const SEATS: readonly Seat[] = [0, 1];

export function attackerOf(firstAttacker: Seat, ex: number): Seat {
	return (firstAttacker + ex) % 2;
}

/** The tosses a seat tosses and the tosses it catches, in order. An
 *  envelope's tosses[i] belongs to tossExchanges[i], catches[i] to
 *  catchExchanges[i]. */
export function envelopeSlots(firstAttacker: Seat, seat: Seat): { tossExchanges: number[]; catchExchanges: number[] } {
	const tossExchanges: number[] = [];
	const catchExchanges: number[] = [];
	for (let ex = 0; ex < EXCHANGES; ex++) {
		if (attackerOf(firstAttacker, ex) === seat) tossExchanges.push(ex);
		else catchExchanges.push(ex);
	}
	return { tossExchanges, catchExchanges };
}

/** What a lane is worth to the pig picking it, if it lands: a toss on the
 *  wind-up 2, any other toss 1, any catch 1. */
export function lanePoints(role: VolleyRole, lane: Lane, windup: Lane): number {
	if (role === "catch") return VOLLEY_PAYOFF.catch;
	return lane === windup ? VOLLEY_PAYOFF.bigSplat : VOLLEY_PAYOFF.splat;
}

/** The payoff table. */
export function scoreToss(windup: Lane, toss: Lane, catchLane: Lane): { outcome: Outcome; toTosser: boolean; points: number } {
	if (catchLane === toss) return { outcome: "catch", toTosser: false, points: VOLLEY_PAYOFF.catch };
	if (toss === windup) return { outcome: "splat2", toTosser: true, points: VOLLEY_PAYOFF.bigSplat };
	return { outcome: "splat1", toTosser: true, points: VOLLEY_PAYOFF.splat };
}

function beatMsFor(ex: number): number {
	return ex === 0 ? VOLLEY_TIMING.windupMs : VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs;
}

function randomLane(rng: Rng): Lane {
	return LANES[rng.int(LANES.length)];
}

/** Follow `windup` with probability `honesty`, else either other lane. */
export function pickLane(windup: Lane, honesty: number, rng: Rng): Lane {
	if (rng.chance(honesty)) return windup;
	const others = LANES.filter((l) => l !== windup);
	return others[rng.int(others.length)];
}

const NTH = ["first", "second", "third", "fourth", "fifth", "sixth"];
const OUTCOME_PHRASE: Record<Outcome, string> = {
	catch: "a clean catch",
	splat2: "a big splat",
	splat1: "a sneaky flick",
};

/** The match's loudest toss: the last one that changed who was ahead (or
 *  levelled it). Every toss scores, so there always is one. */
export function loudestRow(history: readonly VolleyRow[]): VolleyRow | null {
	const running = [0, 0];
	let lead = 0;
	let turning: VolleyRow | null = null;
	for (const row of history) {
		running[row.scorer] += row.points;
		const next = Math.sign(running[0] - running[1]);
		if (next !== lead) {
			lead = next;
			turning = row;
		}
	}
	return turning ?? history[history.length - 1] ?? null;
}

/** The result card's name-free line: "a clean catch on the last toss". */
export function summaryLine(history: readonly VolleyRow[], score: readonly number[]): string {
	const row = loudestRow(history);
	if (!row) return "";
	const when = row.ex === EXCHANGES - 1 ? "the last toss" : `the ${NTH[row.ex]} toss`;
	const line = `${OUTCOME_PHRASE[row.outcome]} on ${when}`;
	return score[0] === score[1] ? `${line} to level it` : line;
}

/** The depth metric to watch in playtests (README): how often each seat
 *  followed through on its own wind-up, and how often it covered the
 *  tosser's wind-up when catching. Fallback lanes are the clock's, not the
 *  pig's, so they are left out. */
export function depthStats(history: readonly VolleyRow[]): { tosses: number; followThroughs: number; catches: number; covers: number }[] {
	const out = SEATS.map(() => ({ tosses: 0, followThroughs: 0, catches: 0, covers: 0 }));
	for (const row of history) {
		const defender = 1 - row.attacker;
		if (!row.fallback[row.attacker]) {
			out[row.attacker].tosses++;
			if (row.toss === row.windup) out[row.attacker].followThroughs++;
		}
		if (!row.fallback[defender]) {
			out[defender].catches++;
			if (row.catchLane === row.windup) out[defender].covers++;
		}
	}
	return out;
}

// ── Internals ────────────────────────────────────────────────────────────────

function laneSeal(ex: number, seat: Seat, lane: Lane): string {
	return `mv-sealed:lane:${ex}:${seat}:${lane}`;
}

function windupSeal(ex: number, lane: Lane): string {
	return `mv-sealed:windup:${ex}:${lane}`;
}

function envelopeSeal(seat: Seat, env: VolleyEnvelope): string {
	return `mv-sealed:envelope:${seat}:${env.tosses.join("")}/${env.catches.join("")}`;
}

function makeRow(s: VolleyState, ex: number, toss: Lane, catchLane: Lane, fallback: boolean[], at: number): VolleyRow {
	const attacker = attackerOf(s.firstAttacker, ex);
	const windup = s.windups[ex].lane;
	const scored = scoreToss(windup, toss, catchLane);
	return {
		ex,
		attacker,
		windup,
		toss,
		catchLane,
		outcome: scored.outcome,
		scorer: scored.toTosser ? attacker : 1 - attacker,
		points: scored.points,
		fallback,
		at,
	};
}

function revealEvent(row: VolleyRow): GameEvent {
	return { type: "reveal", ...row, fallback: row.fallback.slice() };
}

function finalEvent(score: readonly number[]): GameEvent {
	return { type: "final", scores: score.slice() };
}

/** Both lanes are in: score the toss, open the next one in the same step. */
function resolveToss(s: VolleyState, now: number, lead: GameEvent[]): StepResult<VolleyState> {
	const ex = s.exchange;
	const attacker = attackerOf(s.firstAttacker, ex);
	const tossC = s.commits[attacker] as Commit;
	const catchC = s.commits[1 - attacker] as Commit;
	const fallback = SEATS.map((seat) => (s.commits[seat] as Commit).fallback);
	const row = makeRow(s, ex, tossC.lane, catchC.lane, fallback, now);
	const score = s.score.slice();
	score[row.scorer] += row.points;
	const next = ex + 1;
	const done = next >= EXCHANGES;
	const opensAt = done ? null : now + beatMsFor(next);
	const state: VolleyState = {
		...s,
		exchange: next,
		phase: done ? "done" : "commit",
		commits: [null, null],
		score,
		history: [...s.history, row],
		commitOpensAt: opensAt,
		commitClosesAt: opensAt === null ? null : opensAt + VOLLEY_TIMING.commitMs,
	};
	const events = [...lead, revealEvent(row)];
	events.push(
		done
			? finalEvent(score)
			: { type: "windup", ex: next, attacker: attackerOf(s.firstAttacker, next), lane: s.windups[next].lane },
	);
	return { state, events };
}

function lock(s: VolleyState, seat: Seat, lane: Lane, fallback: boolean, ctx: StepContext): StepResult<VolleyState> {
	const commits = s.commits.slice();
	commits[seat] = { lane, seal: laneSeal(s.exchange, seat, lane), fallback };
	const next: VolleyState = { ...s, commits };
	// The clock's lane is not a lock the pig made; the engine's own `timeout`
	// cue already marks it.
	const lead: GameEvent[] = fallback ? [] : [{ type: "locked", seat }];
	if (commits.some((c) => c === null)) return { state: next, events: lead };
	return resolveToss(next, ctx.now, lead);
}

/** Both envelopes are in: resolve all six tosses in order. */
function resolveEnvelopes(s: VolleyState, now: number, lead: GameEvent[]): StepResult<VolleyState> {
	const envelopes = s.envelopes as SealedEnvelope[];
	const fallback = SEATS.map((seat) => envelopes[seat].fallback);
	const score = [0, 0];
	const history: VolleyRow[] = [];
	for (let ex = 0; ex < EXCHANGES; ex++) {
		const attacker = attackerOf(s.firstAttacker, ex);
		const slot = Math.floor(ex / 2);
		const row = makeRow(s, ex, envelopes[attacker].tosses[slot], envelopes[1 - attacker].catches[slot], fallback.slice(), now);
		score[row.scorer] += row.points;
		history.push(row);
	}
	const state: VolleyState = {
		...s,
		exchange: EXCHANGES,
		phase: "done",
		score,
		history,
		commitOpensAt: null,
		commitClosesAt: null,
	};
	return { state, events: [...lead, ...history.map(revealEvent), finalEvent(score)] };
}

function seal(s: VolleyState, seat: Seat, env: VolleyEnvelope, fallback: boolean, ctx: StepContext): StepResult<VolleyState> {
	const envelopes = s.envelopes.slice();
	const copy = { tosses: env.tosses.slice(), catches: env.catches.slice() };
	envelopes[seat] = { ...copy, seal: envelopeSeal(seat, copy), fallback };
	const next: VolleyState = { ...s, envelopes };
	const lead: GameEvent[] = fallback ? [] : [{ type: "sealed", seat }];
	if (envelopes.some((e) => e === null)) return { state: next, events: lead };
	return resolveEnvelopes(next, ctx.now, lead);
}

function sameEnvelope(a: VolleyEnvelope, b: VolleyEnvelope): boolean {
	return a.tosses.join("") === b.tosses.join("") && a.catches.join("") === b.catches.join("");
}

function isLaneList(value: unknown): value is Lane[] {
	return Array.isArray(value) && value.length === TOSSES_EACH && value.every((v) => isOneOf(v, LANES));
}

function isSeat(seat: Seat): boolean {
	return seat === 0 || seat === 1;
}

/** A practice pig with the given temper. It reads only its own view, so it
 *  can never see a sealed lane. */
export function volleyBot(temper: VolleyTemper) {
	return (view: VolleyView, seat: Seat, rng: Rng): VolleyAction | null => {
		if (view.phase !== "commit") return null;
		if (view.mode === "live") {
			if (view.yourLane !== null || view.role === null || view.windup === null) return null;
			const honesty = view.role === "toss" ? temper.p : temper.q;
			return { type: "lane", lane: pickLane(view.windup, honesty, rng), ex: view.exchange };
		}
		if (view.yourEnvelope !== null || view.windups === null) return null;
		const tosses: Lane[] = [];
		const catches: Lane[] = [];
		for (let ex = 0; ex < EXCHANGES; ex++) {
			const windup = view.windups[ex];
			if (attackerOf(view.firstAttacker, ex) === seat) tosses.push(pickLane(windup, temper.p, rng));
			else catches.push(pickLane(windup, temper.q, rng));
		}
		return { type: "envelope", tosses, catches };
	};
}

// ── The game ─────────────────────────────────────────────────────────────────

export const mud_volley: GameDefinition<VolleyState, VolleyAction, VolleyView> = {
	id: "mud_volley",
	title: "Mud Volley",
	tagline:
		"Everyone sees where your pig winds up: follow through for a big splat, flick it for a small one, and a catch scores for the catcher.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live", "async"],
	// A fallback only: deadlineMs drives every decision.
	decisionMs: { live: 12_000, async: VOLLEY_TIMING.envelopeMs },

	setup(ctx) {
		const live = ctx.pace !== "async";
		const firstAttacker = ctx.rng.int(2);
		const windups = Array.from({ length: EXCHANGES }, (_, ex) => {
			const lane = randomLane(ctx.rng);
			return { lane, seal: windupSeal(ex, lane) };
		});
		// The first toss opens once the tosser has swung toward its wind-up.
		const opensAt = live && ctx.now !== undefined ? ctx.now + VOLLEY_TIMING.windupMs : null;
		return {
			mode: live ? "live" : "envelope",
			firstAttacker,
			windups,
			exchange: 0,
			phase: "commit",
			commits: [null, null],
			envelopes: [null, null],
			score: [0, 0],
			history: [],
			commitOpensAt: opensAt,
			commitClosesAt: opensAt === null ? null : opensAt + VOLLEY_TIMING.commitMs,
		};
	},

	activeSeats(s) {
		if (s.phase === "done") return [];
		return SEATS.filter((seat) => (s.mode === "live" ? s.commits[seat] === null : s.envelopes[seat] === null));
	},

	deadlineMs(s) {
		if (s.phase === "done") return null;
		if (s.mode === "envelope") return VOLLEY_TIMING.envelopeMs;
		return beatMsFor(s.exchange) + VOLLEY_TIMING.commitMs + VOLLEY_TIMING.lateGraceMs;
	},

	apply(s, seat, action, ctx) {
		if (s.phase === "done") return { ok: false, error: "game_over" };
		if (!isSeat(seat)) return { ok: false, error: "not_your_turn" };
		if (action.type === "lane") {
			if (s.mode !== "live") return { ok: false, error: "illegal_move" };
			if (action.ex !== undefined && action.ex !== s.exchange) return { ok: false, error: "illegal_move" };
			const mine = s.commits[seat];
			// Sealed is sealed: the same lane again is a free retry, a
			// different one is refused.
			if (mine) return mine.lane === action.lane ? { ok: true, state: s } : { ok: false, error: "illegal_move" };
			return { ok: true, ...lock(s, seat, action.lane, false, ctx) };
		}
		if (s.mode !== "envelope") return { ok: false, error: "illegal_move" };
		const mine = s.envelopes[seat];
		if (mine) return sameEnvelope(mine, action) ? { ok: true, state: s } : { ok: false, error: "illegal_move" };
		return { ok: true, ...seal(s, seat, action, false, ctx) };
	},

	onTimeout(s, seat, ctx) {
		if (s.phase === "done" || !isSeat(seat)) return { state: s };
		if (s.mode === "live") {
			if (s.commits[seat] !== null) return { state: s };
			// A seeded uniform lane, never a fixed one: a stalled pig must not
			// hand its rival a known answer.
			return lock(s, seat, randomLane(ctx.rng), true, ctx);
		}
		if (s.envelopes[seat] !== null) return { state: s };
		const env = {
			tosses: Array.from({ length: TOSSES_EACH }, () => randomLane(ctx.rng)),
			catches: Array.from({ length: TOSSES_EACH }, () => randomLane(ctx.rng)),
		};
		return seal(s, seat, env, true, ctx);
	},

	view(s, seat) {
		const rival = 1 - seat;
		const live = s.mode === "live";
		const open = s.phase === "commit";
		const attacker = live && open ? attackerOf(s.firstAttacker, s.exchange) : null;
		const mine = s.envelopes[seat];
		const history = s.history.map((row) => ({ ...row, fallback: row.fallback.slice() }));
		return {
			mode: s.mode,
			you: seat,
			rival,
			phase: s.phase,
			exchange: s.exchange,
			exchanges: EXCHANGES,
			firstAttacker: s.firstAttacker,
			attacker,
			role: attacker === null ? null : attacker === seat ? "toss" : "catch",
			windup: live && open ? s.windups[s.exchange].lane : null,
			windups: live ? null : s.windups.map((w) => w.lane),
			yourLane: live ? (s.commits[seat]?.lane ?? null) : null,
			rivalLocked: live ? open && s.commits[rival] !== null : s.envelopes[rival] !== null,
			yourEnvelope: !live && mine ? { tosses: mine.tosses.slice(), catches: mine.catches.slice() } : null,
			score: s.score.slice(),
			history,
			lastReveal: history.length > 0 ? history[history.length - 1] : null,
			commitOpensAt: s.commitOpensAt,
			commitClosesAt: s.commitClosesAt,
			beatMs: live && open ? beatMsFor(s.exchange) : 0,
			windowMs: live ? VOLLEY_TIMING.commitMs : 0,
		};
	},

	secretsOf(s, seat) {
		if (s.phase === "done") return [];
		const rival = 1 - seat;
		if (s.mode === "live") {
			const out: string[] = [];
			const theirs = s.commits[rival];
			if (theirs) out.push(theirs.seal);
			for (let ex = s.exchange + 1; ex < EXCHANGES; ex++) out.push(s.windups[ex].seal);
			return out;
		}
		const theirs = s.envelopes[rival];
		return theirs ? [theirs.seal] : [];
	},

	result(s): GameResult | null {
		if (s.phase !== "done") return null;
		const scores = s.score.slice();
		const summary = summaryLine(s.history, scores);
		// A draw names the seats sharing the top place: here, both pigs.
		if (scores[0] === scores[1]) return { kind: "draw", winners: [0, 1], scores, summary };
		return { kind: "win", winners: [scores[0] > scores[1] ? 0 : 1], scores, summary };
	},

	bot: volleyBot(VOLLEY_BOTS.evenEdna),

	parseAction(raw) {
		const type = actionType(raw, ["lane", "envelope"] as const);
		if (type === null || !isRecord(raw)) return null;
		if (type === "lane") {
			if (!isOneOf(raw.lane, LANES)) return null;
			if (raw.ex === undefined) return { type, lane: raw.lane };
			return isInt(raw.ex, 0, EXCHANGES - 1) ? { type, lane: raw.lane, ex: raw.ex } : null;
		}
		if (!isLaneList(raw.tosses) || !isLaneList(raw.catches)) return null;
		return { type, tosses: raw.tosses.slice(), catches: raw.catches.slice() };
	},
};
