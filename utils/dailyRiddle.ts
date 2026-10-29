// The Sheep's Riddle: one shared picture riddle a day (proposal A,
// docs/explorations/2026-10-29-small-games/proposal.md).
//
// The Ghost Sheep nods at three clue pictures; nine answers lie below; exactly
// one of the nine is kin to all three clues. Two guesses. The deal is a pure
// function of the UTC day, so every pig gets the same riddle on the same day
// and "got it in one" means the same thing to the whole herd.
//
// Built only from what the binary already has: the Snout Says deck (the twelve
// Satchel finds and the fifteen dig things) and its kinship tags
// (multiplayer/games/snout_says/deck.ts). Snout Says keeps its tags hidden;
// the riddle shows the shared ones on the reveal, so every answer teaches
// (the proposal's mitigation for a thin-feeling clue).
//
// v1 mints nothing: no server, no pass XP, no currency. The solve, the share
// line and a local "riddles solved" count are the reward.
//
// Everything here is pure. Storage and the React state live in
// hooks/useDailyRiddle.ts.
import { PICTURE_IDS, PICTURE_KIN, isPictureId, kinship, type PictureId, type PictureTag } from "@/multiplayer/games/snout_says/deck";
import { createRng } from "@/multiplayer/rng";

export const RIDDLE_CLUES = 3;
export const RIDDLE_ANSWERS = 9;
export const RIDDLE_GUESSES = 2;

/** Riddle 1's UTC day. The share line counts from here. */
export const RIDDLE_EPOCH = "2026-10-29";

// How many reseeds a day may take before it falls back to the epoch's deal.
// The test pins every day of 2026 and 2027 to a deal well inside this.
const MAX_ATTEMPTS = 64;
// Decoys that are kin to two of the three clues make the riddle a riddle;
// the rest are drawn at random so it never becomes a wall of near misses.
const NEAR_MISSES = 4;
// A clue should share two tags with the answer when the deck allows it.
const STRONG_KIN = 2;

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DailyRiddle {
	/** The UTC day, YYYY-MM-DD. */
	day: string;
	/** Riddle 1 is RIDDLE_EPOCH. */
	number: number;
	/** The one answer kin to every clue. */
	secret: PictureId;
	/** The three clues, in reveal order. */
	clues: readonly PictureId[];
	/** The nine answers, in grid order (the secret among them). */
	answers: readonly PictureId[];
}

/** Today's riddle day: the UTC calendar date. */
export function utcDayKey(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

function dayMs(day: string): number {
	return Date.parse(`${day}T00:00:00Z`);
}

/** The riddle's number in the share line (Riddle 1 on RIDDLE_EPOCH). */
export function riddleNumber(day: string): number {
	return Math.round((dayMs(day) - dayMs(RIDDLE_EPOCH)) / DAY_MS) + 1;
}

/** When the next riddle deals: the next UTC midnight after `now`. */
export function nextRiddleAt(now: Date = new Date()): Date {
	return new Date(dayMs(utcDayKey(now)) + DAY_MS);
}

/** True when `picture` shares at least one tag with every clue. */
export function isKinToAll(picture: PictureId, clues: readonly PictureId[]): boolean {
	return clues.every((clue) => kinship(picture, clue) > 0);
}

/** The tags two pictures share, in the first picture's tag order. */
export function sharedTags(a: PictureId, b: PictureId): PictureTag[] {
	const theirs = PICTURE_KIN[b];
	return PICTURE_KIN[a].filter((tag) => theirs.includes(tag));
}

function tryDeal(day: string, attempt: number): DailyRiddle | null {
	const rng = createRng(`sheeps-riddle:${day}:${attempt}`);
	const secret = rng.pick(PICTURE_IDS);
	const others = PICTURE_IDS.filter((p) => p !== secret);

	// Three clues, each kin to the secret: strong ties first.
	const strong = rng.shuffle(others.filter((p) => kinship(p, secret) >= STRONG_KIN));
	const weak = rng.shuffle(others.filter((p) => kinship(p, secret) > 0 && kinship(p, secret) < STRONG_KIN));
	const clues = [...strong, ...weak].slice(0, RIDDLE_CLUES);
	if (clues.length < RIDDLE_CLUES) return null;

	// Eight decoys, each missing at least one clue entirely, so the secret is
	// the only answer kin to all three.
	const pool = others.filter((p) => !clues.includes(p) && !isKinToAll(p, clues));
	const kinTo = (p: PictureId) => clues.filter((c) => kinship(p, c) > 0).length;
	const near = rng.shuffle(pool.filter((p) => kinTo(p) === RIDDLE_CLUES - 1));
	const rest = rng.shuffle(pool.filter((p) => kinTo(p) < RIDDLE_CLUES - 1));
	const want = RIDDLE_ANSWERS - 1;
	const picked = [...near.slice(0, NEAR_MISSES), ...rest];
	const decoys = [...picked, ...near.slice(NEAR_MISSES)].slice(0, want);
	if (decoys.length < want) return null;

	return {
		day,
		number: riddleNumber(day),
		secret,
		clues,
		answers: rng.shuffle([secret, ...decoys]),
	};
}

/** The riddle for a UTC day: the same for every player, every time. */
export function dealRiddle(day: string): DailyRiddle {
	const key = DAY_RE.test(day) && Number.isFinite(dayMs(day)) ? day : RIDDLE_EPOCH;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const riddle = tryDeal(key, attempt);
		if (riddle) return { ...riddle, day };
	}
	// Never expected (the test pins 2026 and 2027); a day must still deal.
	if (key === RIDDLE_EPOCH) throw new Error("the epoch riddle must deal");
	return { ...dealRiddle(RIDDLE_EPOCH), day, number: riddleNumber(key) };
}

// ── Play ────────────────────────────────────────────────────────────────────

export type RiddleOutcome = "playing" | "solved" | "failed";

/** One day's play: how many clues are showing and what was guessed. */
export interface RiddlePlay {
	day: string;
	/** Clues showing, 1 to RIDDLE_CLUES. The first is always up. */
	revealed: number;
	/** Guesses in order, at most RIDDLE_GUESSES. */
	guesses: PictureId[];
}

export function startPlay(day: string): RiddlePlay {
	return { day, revealed: 1, guesses: [] };
}

export function riddleOutcome(riddle: DailyRiddle, play: RiddlePlay): RiddleOutcome {
	if (play.guesses.includes(riddle.secret)) return "solved";
	if (play.guesses.length >= RIDDLE_GUESSES) return "failed";
	return "playing";
}

export function guessesLeft(play: RiddlePlay): number {
	return Math.max(0, RIDDLE_GUESSES - play.guesses.length);
}

/** Show the next clue. A no-op once all three are up or the riddle is over. */
export function revealNextClue(riddle: DailyRiddle, play: RiddlePlay): RiddlePlay {
	if (riddleOutcome(riddle, play) !== "playing") return play;
	if (play.revealed >= RIDDLE_CLUES) return play;
	return { ...play, revealed: play.revealed + 1 };
}

/** Guess an answer. Ignored when the riddle is over, the picture is not one
 *  of the nine, or it was already guessed. */
export function guessAnswer(riddle: DailyRiddle, play: RiddlePlay, picture: PictureId): RiddlePlay {
	if (riddleOutcome(riddle, play) !== "playing") return play;
	if (!riddle.answers.includes(picture) || play.guesses.includes(picture)) return play;
	return { ...play, guesses: [...play.guesses, picture] };
}

// ── The book: today's play plus the device's tally ─────────────────────────

/** What the device keeps: today's play and how many riddles it has solved. */
export interface RiddleBook {
	play: RiddlePlay;
	solved: number;
}

export function freshBook(riddle: DailyRiddle, solved = 0): RiddleBook {
	return { play: startPlay(riddle.day), solved };
}

function validPlay(riddle: DailyRiddle, value: unknown): RiddlePlay | null {
	if (!value || typeof value !== "object") return null;
	const v = value as Partial<RiddlePlay>;
	if (v.day !== riddle.day) return null;
	const revealed = v.revealed;
	if (typeof revealed !== "number" || !Number.isInteger(revealed) || revealed < 1 || revealed > RIDDLE_CLUES) return null;
	if (!Array.isArray(v.guesses) || v.guesses.length > RIDDLE_GUESSES) return null;
	// Replay the guesses through the rules: anything the rules would refuse
	// (a stranger's picture, a repeat, a guess after the solve) voids the record.
	let play = startPlay(riddle.day);
	for (const g of v.guesses) {
		if (!isPictureId(g)) return null;
		const next = guessAnswer(riddle, play, g);
		if (next === play) return null;
		play = next;
	}
	return { ...play, revealed };
}

/**
 * Open the stored book against today's riddle. A missing, corrupt or older
 * day's record starts today fresh; the solved tally carries over.
 */
export function openBook(raw: string | null, riddle: DailyRiddle): RiddleBook {
	if (!raw) return freshBook(riddle);
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return freshBook(riddle);
	}
	if (!parsed || typeof parsed !== "object") return freshBook(riddle);
	const p = parsed as { play?: unknown; solved?: unknown };
	const solved = typeof p.solved === "number" && Number.isInteger(p.solved) && p.solved >= 0 ? p.solved : 0;
	const play = validPlay(riddle, p.play);
	return play ? { play, solved } : freshBook(riddle, solved);
}

export function serializeBook(book: RiddleBook): string {
	return JSON.stringify(book);
}

/** The book after showing the next clue. */
export function revealInBook(riddle: DailyRiddle, book: RiddleBook): RiddleBook {
	const play = revealNextClue(riddle, book.play);
	return play === book.play ? book : { ...book, play };
}

/** The book after a guess. The tally counts a solve exactly once. */
export function guessInBook(riddle: DailyRiddle, book: RiddleBook, picture: PictureId): RiddleBook {
	const play = guessAnswer(riddle, book.play, picture);
	if (play === book.play) return book;
	const solvedNow = riddleOutcome(riddle, play) === "solved";
	return { play, solved: book.solved + (solvedNow ? 1 : 0) };
}

// ── Copy ────────────────────────────────────────────────────────────────────

function clueWord(n: number): string {
	return n === 1 ? "1 clue" : `${n} clues`;
}

/** The share line: plain text, no emoji. "Riddle 12 · got it in 1 · 2 clues". */
export function shareLine(riddle: DailyRiddle, play: RiddlePlay): string {
	const outcome = riddleOutcome(riddle, play);
	const head = `The Sheep's Riddle ${riddle.number}`;
	if (outcome === "solved") return `${head} · got it in ${play.guesses.length} · ${clueWord(play.revealed)}`;
	if (outcome === "failed") return `${head} · the sheep kept this one`;
	return head;
}

/** The fan row's hand line. */
export function riddleFanLine(riddle: DailyRiddle, play: RiddlePlay): string {
	const outcome = riddleOutcome(riddle, play);
	if (outcome === "solved") return `got it in ${play.guesses.length} · back tomorrow`;
	if (outcome === "failed") return "the sheep kept it · back tomorrow";
	if (play.guesses.length > 0) return "one guess left";
	return "three clues, nine pictures";
}
