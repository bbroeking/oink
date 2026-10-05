// Out Looking: errands as a meeting game.
//
// Every day each pig secretly picks one place to look. Alone at a place, a pig
// takes the whole pile; pigs who meet take one find each (the oldest tile
// first, in a seat order that rotates every day) and each gets a heart. Then
// every place draws one tile from its own deck onto its pile, except a place
// emptied that day: it rests a night and sits bare tomorrow, so going there
// alone is a visible, chosen risk of muddy trotters. Heaviest pouch after the
// last day wins; hearts break a tie.
//
// Spec: docs/multiplayer/explorations/04-pig-native-originals.md (Top 2), with
// the lead's amendments: picks are final once made, the round resolves the
// moment every seat has decided (live and async alike), a missing pick stays
// home, the game piece is a heart, never a tickle, and an emptied pile rests a
// night. README.md beside this file has the rules in four lines, the tuning
// and every deviation.
//
// Pure module: JSON-only state, `ctx.rng` only, relative imports only.

import type { GameDefinition, GameEvent, GameResult, Pace, Seat, StepResult } from "../../types";
import { isInt, isRecord } from "../../validate";

// ── The finds and the places ─────────────────────────────────────────────────

/** The twelve Satchel finds (ids mirror constants/satchel.ts SATCHEL_FIND_IDS). */
export type FindId =
	| "river_pebble"
	| "snail_shell"
	| "marble"
	| "blue_feather"
	| "pinecone"
	| "red_berries"
	| "clover"
	| "wool_tuft"
	| "honeycomb"
	| "brass_button"
	| "old_key"
	| "tin_whistle";

export type PlaceId = "river" | "hedge" | "meadow" | "farmhouse";

/**
 * A find's weight in a pouch: its Satchel rarity read as weight (common 1 ·
 * uncommon 2 · rare 3). multiplayer/ is shared with the Node play server and
 * stays self-contained, so this is a copy of the catalog's rarities, not an
 * import of it; __tests__/multiplayer/out_looking.test.ts pins it to
 * constants/satchel.ts so the two can never drift.
 */
export const FIND_WEIGHT: Readonly<Record<FindId, number>> = Object.freeze({
	river_pebble: 1,
	snail_shell: 1,
	marble: 2,
	blue_feather: 1,
	pinecone: 1,
	red_berries: 1,
	clover: 1,
	wool_tuft: 1,
	honeycomb: 2,
	brass_button: 1,
	old_key: 2,
	tin_whistle: 3,
});

/** Where each find comes from. The Farmhouse is the richest by construction
 *  (1 + 2 + 3 a set, against 4 · 3 · 4), so the obvious place is the
 *  contested one. */
export const PLACE_FINDS: Readonly<Record<PlaceId, readonly FindId[]>> = Object.freeze({
	river: ["river_pebble", "snail_shell", "marble"],
	hedge: ["blue_feather", "pinecone", "red_berries"],
	meadow: ["clover", "wool_tuft", "honeycomb"],
	farmhouse: ["brass_button", "old_key", "tin_whistle"],
});

export interface TableShape {
	places: readonly PlaceId[];
	rounds: number;
	/** Day-one pile sizes, shuffled across the places by seed. */
	dayOnePiles: readonly number[];
}

export const TUNING = Object.freeze({
	/** Each place's deck holds this many of each of its three finds (nine tiles). */
	copiesPerFind: 3,
	/** Two pigs over four places is matching pennies; three places with one
	 *  rich one keeps a real read. */
	twoSeats: { places: ["river", "hedge", "farmhouse"], rounds: 4, dayOnePiles: [3, 2, 1] } as TableShape,
	party: { places: ["river", "hedge", "meadow", "farmhouse"], rounds: 5, dayOnePiles: [3, 2, 1, 1] } as TableShape,
	/** A live pick, and the reveal scene the next day's clock waits for. */
	livePickMs: 15_000,
	liveRevealMs: 6_000,
	/** An async day closes at the earlier of every pig deciding or this. */
	asyncPickMs: 20 * 3_600_000,
	/** The practice pig: a heart is worth half a weight to it, and it scores
	 *  each place with ±15% noise so it is not clockwork. */
	botHeartValue: 0.5,
	botNoise: 0.15,
});

/** The most places any table has (the action guard's upper bound). */
const MAX_PLACES = TUNING.party.places.length;

export function tableFor(seats: number): TableShape {
	return seats <= 2 ? TUNING.twoSeats : TUNING.party;
}

export function weightOf(finds: readonly FindId[]): number {
	let total = 0;
	for (const find of finds) total += FIND_WEIGHT[find];
	return total;
}

// ── State, actions, view ─────────────────────────────────────────────────────

/** One face-down tile. `tile` is a secrecy marker (see `secretsOf`): it never
 *  leaves the server, so finding it in any view means a deck leaked. */
export interface DeckTile {
	tile: string;
	find: FindId;
}

export interface Place {
	id: PlaceId;
	/** Face-up and public, oldest tile first. */
	pile: FindId[];
	/** SECRET order: the next tile drawn is deck[0]. */
	deck: DeckTile[];
}

/** A sealed pick: final once made, secret until the day resolves. `seal` is a
 *  secrecy marker in the same way as a deck tile's `tile`. */
export interface SealedPick {
	place: number;
	seal: string;
}

/** null: still deciding. "home": resolved without a pick (the deadline passed,
 *  or the pig left the table). */
export type Pick = SealedPick | "home" | null;

export type Outcome = "alone" | "shared" | "muddy" | "home";

/** One resolved day, in full. Public: where everyone went is the read. */
export interface DayRecord {
	round: number;
	/** Place index per seat, or "home". */
	picks: (number | "home")[];
	outcomes: Outcome[];
	/** What each seat put in its pouch that day. */
	took: FindId[][];
	/** Each place's pile as it stood when the pigs arrived. */
	piles: FindId[][];
	/** The tile each place drew afterwards (null: none, on the last day or from a dry deck). */
	grew: (FindId | null)[];
	/** Who headed the line that day (so a reveal can show who took which tile). */
	firstInLine: Seat;
}

export interface OlState {
	seats: number;
	places: Place[];
	/** 1-based; stays at `rounds` once the game has ended. */
	round: number;
	rounds: number;
	picks: Pick[];
	/** The seat first in line at a shared pile today; rotates every day. */
	shareOffset: Seat;
	pouches: FindId[][];
	hearts: number[];
	history: DayRecord[];
	phase: "picking" | "ended";
}

export type OlAction = { type: "go"; place: number };

export interface PlaceView {
	id: PlaceId;
	pile: FindId[];
	pileWeight: number;
	/** How many tiles the deck still holds (its order is never shown). */
	deckLeft: number;
}

export interface OlView {
	seats: number;
	places: PlaceView[];
	round: number;
	rounds: number;
	phase: OlState["phase"];
	/** My sealed place today (null: not picked yet, or resolved home). */
	myPick: number | null;
	/** Who has decided today, never where. */
	picked: boolean[];
	/** Who takes the oldest tile if pigs meet today. */
	firstInLine: Seat;
	pouches: FindId[][];
	weights: number[];
	hearts: number[];
	/** Every resolved day in full. */
	history: DayRecord[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSealed(pick: Pick): pick is SealedPick {
	return typeof pick === "object" && pick !== null;
}

function sealFor(round: number, seat: Seat): string {
	return `sealed:r${round}:s${seat}`;
}

function freshPicks(seats: number): Pick[] {
	return Array.from({ length: seats }, () => null);
}

/** Has every seat decided today? An open async chair has not, so the day waits
 *  for it; a chair whose pig has left is resolved home by the room (through
 *  `onTimeout`) before anyone else can act, so it never holds the day up. */
function allDecided(picks: readonly Pick[]): boolean {
	return picks.every((p) => p !== null);
}

/** A day's queue at a shared pile: seat order starting at `offset` (the seat
 *  first in line). Exported so a reveal draws the same queue the rules used. */
export function lineOrder(seats: readonly Seat[], offset: Seat, n: number): Seat[] {
	return seats.slice().sort((a, b) => ((a - offset + n) % n) - ((b - offset + n) % n));
}

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve the day once every seat has decided: group the pigs by place; a pig
 * alone takes the whole pile (or finds muddy trotters at a bare one); pigs who
 * meet each take one tile, oldest first, in today's line order, and each gets
 * a heart whether or not a tile was left for it; a seat with no pick stayed
 * home. Then every place draws one tile, except a place emptied today (it
 * rests a night and is bare tomorrow), never after the last day and never
 * from a dry deck; the line rotates, and the next day opens.
 */
export function resolveDay(state: OlState): StepResult<OlState> {
	const n = state.seats;
	const picks: (number | "home")[] = state.picks.map((p) => (isSealed(p) ? p.place : "home"));
	const outcomes: Outcome[] = picks.map(() => "home");
	const took: FindId[][] = picks.map(() => []);
	const hearts = state.hearts.slice();
	const arrived = state.places.map((place) => place.pile.slice());

	const taken = state.places.map((place, j) => {
		const here = picks.flatMap((p, s) => (p === j ? [s] : []));
		if (here.length === 0) return place;
		if (here.length === 1) {
			const [seat] = here;
			if (place.pile.length === 0) {
				outcomes[seat] = "muddy";
				return place;
			}
			outcomes[seat] = "alone";
			took[seat] = place.pile.slice();
			return { ...place, pile: [] };
		}
		const line = lineOrder(here, state.shareOffset, n);
		line.forEach((seat, k) => {
			outcomes[seat] = "shared";
			hearts[seat] += 1;
			if (k < place.pile.length) took[seat] = [place.pile[k]];
		});
		return { ...place, pile: place.pile.slice(Math.min(line.length, place.pile.length)) };
	});

	const lastDay = state.round >= state.rounds;
	const grew: (FindId | null)[] = taken.map(() => null);
	const places = lastDay
		? taken
		: taken.map((place, j) => {
				// Taken whole today (by a lone pig, or down to the last tile by pigs
				// who met): the place rests a night and sits bare tomorrow.
				if (arrived[j].length > 0 && place.pile.length === 0) return place;
				const [next, ...rest] = place.deck;
				if (!next) return place;
				grew[j] = next.find;
				return { ...place, pile: [...place.pile, next.find], deck: rest };
			});

	const record: DayRecord = { round: state.round, picks, outcomes, took, piles: arrived, grew, firstInLine: state.shareOffset };
	const events: GameEvent[] = [{ type: "revealed", round: state.round }];
	if (grew.some((g) => g !== null)) events.push({ type: "grew", round: state.round });

	return {
		state: {
			...state,
			places,
			round: lastDay ? state.round : state.round + 1,
			picks: freshPicks(n),
			shareOffset: (state.shareOffset + 1) % n,
			pouches: state.pouches.map((pouch, s) => (took[s].length > 0 ? [...pouch, ...took[s]] : pouch)),
			hearts,
			history: [...state.history, record],
			phase: lastDay ? "ended" : "picking",
		},
		events,
	};
}

function afterDecision(state: OlState, events: GameEvent[]): StepResult<OlState> {
	if (!allDecided(state.picks)) return { state, events };
	const resolved = resolveDay(state);
	return { state: resolved.state, events: [...events, ...(resolved.events ?? [])] };
}

// ── Result ───────────────────────────────────────────────────────────────────

function summaryLine(weights: number[], hearts: number[], topWeight: Seat[], winners: Seat[]): string {
	const tally = weights
		.slice()
		.sort((a, b) => b - a)
		.join(" to ");
	if (topWeight.length < 2) return tally;
	if (winners.length === 1) {
		const tied = topWeight
			.map((s) => hearts[s])
			.sort((a, b) => b - a)
			.join(" to ");
		return `${tally} · on hearts, ${tied}`;
	}
	return `${tally} · level on hearts too`;
}

function finalResult(state: OlState): GameResult {
	const weights = state.pouches.map(weightOf);
	const best = Math.max(...weights);
	const topWeight = weights.flatMap((w, s) => (w === best ? [s] : []));
	const bestHearts = Math.max(...topWeight.map((s) => state.hearts[s]));
	const top = topWeight.filter((s) => state.hearts[s] === bestHearts);
	return {
		// Level on weight and hearts at the top is a draw among those seats
		// (every seat, when the whole table is level); anyone below placed below.
		kind: top.length === 1 ? "win" : "draw",
		winners: top,
		scores: weights,
		summary: summaryLine(weights, state.hearts, topWeight, top),
	};
}

// ── The game ─────────────────────────────────────────────────────────────────

export const out_looking: GameDefinition<OlState, OlAction, OlView> = {
	id: "out_looking",
	title: "Out Looking",
	tagline: "Each round send your pig to one of four places; alone you take the pile, pigs who meet share it.",
	rulesVersion: 1,
	seats: { min: 2, max: 4 },
	kind: "competitive",
	paces: ["live", "async"],
	decisionMs: { live: TUNING.livePickMs, async: TUNING.asyncPickMs },

	setup({ seats, rng }) {
		const shape = tableFor(seats);
		const sizes = rng.shuffle(shape.dayOnePiles);
		const places: Place[] = shape.places.map((id, j) => {
			const tiles: DeckTile[] = [];
			for (const find of PLACE_FINDS[id]) {
				for (let c = 0; c < TUNING.copiesPerFind; c++) tiles.push({ tile: `tile:${id}:${tiles.length}`, find });
			}
			const deck = rng.shuffle(tiles);
			const size = sizes[j];
			return { id, pile: deck.slice(0, size).map((t) => t.find), deck: deck.slice(size) };
		});
		return {
			seats,
			places,
			round: 1,
			rounds: shape.rounds,
			picks: freshPicks(seats),
			shareOffset: rng.int(seats),
			pouches: Array.from({ length: seats }, () => []),
			hearts: Array.from({ length: seats }, () => 0),
			history: [],
			phase: "picking",
		};
	},

	activeSeats(state) {
		if (state.phase !== "picking") return [];
		return state.picks.flatMap((p, s) => (p === null ? [s] : []));
	},

	deadlineMs(state, pace: Pace) {
		if (state.phase !== "picking") return null;
		if (pace === "async") return TUNING.asyncPickMs;
		// A day that opens straight out of a reveal waits for the scene first, so
		// no pig loses pick time to watching where everyone went.
		const afterReveal = state.history.length > 0 && !state.picks.some(isSealed);
		return TUNING.livePickMs + (afterReveal ? TUNING.liveRevealMs : 0);
	},

	apply(state, seat, action) {
		if (state.phase !== "picking") return { ok: false, error: "game_over" };
		if (!isInt(seat, 0, state.seats - 1)) return { ok: false, error: "not_your_turn" };
		if (!isInt(action.place, 0, state.places.length - 1)) return { ok: false, error: "illegal_move" };
		const current = state.picks[seat];
		if (current === "home") return { ok: false, error: "not_your_turn" };
		// Picks are final: the same place again is a harmless repeat, a
		// different one is refused.
		if (current !== null) return current.place === action.place ? { ok: true, state } : { ok: false, error: "illegal_move" };
		const picks = state.picks.slice();
		picks[seat] = { place: action.place, seal: sealFor(state.round, seat) };
		const res = afterDecision({ ...state, picks }, [{ type: "picked", seat }]);
		return { ok: true, state: res.state, events: res.events };
	},

	// A pig with no pick by the deadline stays home: the game never guesses a
	// place for an absent pig (that would hand its rivals a move it never
	// made). The room also lands here, at once, for a pig that has left.
	onTimeout(state, seat) {
		if (state.phase !== "picking" || state.picks[seat] !== null) return { state };
		const picks = state.picks.slice();
		picks[seat] = "home";
		return afterDecision({ ...state, picks }, []);
	},

	view(state, seat) {
		const mine = state.picks[seat];
		return {
			seats: state.seats,
			places: state.places.map((place) => ({
				id: place.id,
				pile: place.pile.slice(),
				pileWeight: weightOf(place.pile),
				deckLeft: place.deck.length,
			})),
			round: state.round,
			rounds: state.rounds,
			phase: state.phase,
			myPick: isSealed(mine) ? mine.place : null,
			picked: state.picks.map((p) => p !== null),
			firstInLine: state.shareOffset,
			pouches: state.pouches.map((pouch) => pouch.slice()),
			weights: state.pouches.map(weightOf),
			hearts: state.hearts.slice(),
			history: state.history,
		};
	},

	secretsOf(state, seat) {
		const markers: string[] = [];
		state.picks.forEach((pick, s) => {
			if (s !== seat && isSealed(pick)) markers.push(pick.seal);
		});
		for (const place of state.places) for (const tile of place.deck) markers.push(tile.tile);
		return markers;
	},

	result(state) {
		return state.phase === "ended" ? finalResult(state) : null;
	},

	// The practice pig reads only its own view. It guesses that the other pigs
	// go where it is fat (each place in proportion to its pile weight squared),
	// scores each place as P(alone) × the pile + P(company) × (the oldest
	// tile + a heart), and takes the best with ±15% noise.
	bot(view, seat, rng) {
		if (view.phase !== "picking" || view.picked[seat] || view.myPick !== null) return null;
		const others = view.seats - 1;
		const squares = view.places.map((p) => p.pileWeight * p.pileWeight);
		const total = squares.reduce((a, b) => a + b, 0);
		let best = 0;
		let bestScore = Number.NEGATIVE_INFINITY;
		view.places.forEach((place, j) => {
			const share = total > 0 ? squares[j] / total : 1 / view.places.length;
			const alone = Math.pow(1 - share, others);
			const meet = (place.pile.length > 0 ? FIND_WEIGHT[place.pile[0]] : 0) + TUNING.botHeartValue;
			const expected = alone * place.pileWeight + (1 - alone) * meet;
			const score = expected * (1 + TUNING.botNoise * (2 * rng.next() - 1));
			if (score > bestScore) {
				bestScore = score;
				best = j;
			}
		});
		return { type: "go", place: best };
	},

	parseAction(raw) {
		if (!isRecord(raw) || raw.type !== "go" || !isInt(raw.place, 0, MAX_PLACES - 1)) return null;
		return { type: "go", place: raw.place };
	},
};
