// Out Looking's board, the pure half: where everything sits on the yard, what
// every pig is doing at each beat of a reveal, which tiles fly where, and the
// copy. No React here, so the staging is testable without a renderer and the
// board stays a function of the view.

import type { FindId, DayRecord, OlView, PlaceId } from "@/multiplayer/games/out_looking/rules";
import { FIND_WEIGHT, PLACE_FINDS, lineOrder, weightOf } from "@/multiplayer/games/out_looking/rules";
import { satchelFind } from "@/constants/satchel";
import { ART_SIZE, BORDER, MOTION, SPACE } from "@/constants/theme";
import type { PigStageProps } from "@/components/ui";
import { lineSlot } from "../fit";

type PigFacing = NonNullable<PigStageProps["facing"]>;

// ── Copy ─────────────────────────────────────────────────────────────────────

export const PLACE_NAME: Readonly<Record<PlaceId, string>> = Object.freeze({
	river: "River",
	hedge: "Hedge",
	meadow: "Meadow",
	farmhouse: "Farmhouse",
});

export function dayLabel(round: number, rounds: number): string {
	return `Day ${round} of ${rounds}`;
}

export function sendLabel(pigName: string, place: PlaceId): string {
	return `Send ${pigName} to the ${PLACE_NAME[place]}`;
}

/** Every line the thumb zone says, as functions of the table, so the board
 *  draws them and the fit (./layout.ts) reserves exactly what is drawn. */
export const CONTROLS_COPY = Object.freeze({
	pickTitle: (pigName: string) => `Where will ${pigName} look?`,
	pickAgain: "That didn't go through. Pick again?",
	pickLabel: (pigName: string) => `Pick a place for ${pigName}`,
	sending: (pigName: string) => `Sending ${pigName}…`,
	sentTitle: (pigName: string, place: PlaceId) => `${pigName} is out looking at the ${PLACE_NAME[place]}.`,
	pingYou: "We'll ping you when the round closes.",
	everyoneOut: "Everyone's out looking.",
	waitingOn: (pigs: number) => `Waiting on ${pigs === 1 ? "one more pig" : `${pigs} more pigs`}.`,
	onToDay: (round: number) => `On to day ${round}`,
	seePouches: "See the pouches",
	lastDay: "That was the last day.",
});

/** The ended thumb zone's second line: what my pig brought home. */
export function cameHomeLine(pigName: string, weight: number, hearts: number): string {
	return weight > 0
		? `${pigName} came home with a pouch of ${weight}${hearts > 0 ? ` and ${heartsLabel(hearts)}` : ""}.`
		: `${pigName} came home light this time${hearts > 0 ? `, with ${heartsLabel(hearts)}` : ""}.`;
}

/** A find naming itself as it lands: "a glass marble · 2". */
export function findLabel(find: FindId): string {
	return `${findName(find)} · ${FIND_WEIGHT[find]}`;
}

/** "a pinecone", "a pinecone and an old key", up to three; then a count. */
export function listFinds(finds: readonly FindId[]): string {
	if (finds.length > 3) return `${finds.length} finds`;
	const names = finds.map(findName);
	return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function listNames(names: readonly string[]): string {
	if (names.length < 2) return names[0] ?? "a pig";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function heartsLabel(hearts: number): string {
	return hearts === 1 ? "1 heart" : `${hearts} hearts`;
}

/** The line under a seat's chip: "pouch 7 · 2 hearts". Never a zero in public. */
export function seatStatusLine(weight: number, hearts: number): string | null {
	const parts: string[] = [];
	if (weight > 0) parts.push(`pouch ${weight}`);
	if (hearts > 0) parts.push(heartsLabel(hearts));
	return parts.length > 0 ? parts.join(" · ") : null;
}

export interface Lines {
	title: string;
	sub: string;
}

/** The two-line outcomes, one builder each, shared by the reveal and the fit. */
const HOME = (pigName: string): Lines => ({ title: `${pigName} stayed home.`, sub: "A nap in the yard." });
const ALONE = (pigName: string, place: PlaceId, took: readonly FindId[]): Lines => ({
	title: `${pigName} had the ${PLACE_NAME[place]} alone.`,
	sub: `${capitalise(listFinds(took))} · +${weightOf(took)}`,
});
const MET = (pigName: string, company: readonly string[], place: PlaceId, took: readonly FindId[]): Lines => ({
	title: `${pigName} met ${listNames(company)} at the ${PLACE_NAME[place]}.`,
	sub: capitalise(took.length > 0 ? `${listFinds(took)} and a heart` : "No find left, but a heart"),
});
const MUDDY = (place: PlaceId): Lines => ({ title: `Muddy trotters at the ${PLACE_NAME[place]}.`, sub: "Nothing there today." });

/** What happened to my pig on a revealed day, in two lines. */
export function outcomeLines(day: DayRecord, you: number, pigName: string, places: readonly PlaceId[], nameOf: (seat: number) => string): Lines {
	const pick = day.picks[you];
	const took = day.took[you] ?? [];
	if (pick === "home" || pick === undefined) return HOME(pigName);
	const place = places[pick];
	switch (day.outcomes[you]) {
		case "alone":
			return ALONE(pigName, place, took);
		case "shared":
			return MET(pigName, day.picks.flatMap((p, s) => (p === pick && s !== you ? [nameOf(s)] : [])), place, took);
		case "muddy":
			return MUDDY(place);
		default:
			return HOME(pigName);
	}
}

/**
 * Every outcome my pig could have at this table, at its longest: alone with
 * a pile of three of the place's longest-named find, meeting every other pig
 * at once, muddy trotters, a nap. The fit reserves the thumb zone for the
 * longest, so a long day never moves the yard.
 */
export function longestOutcomes(pigName: string, places: readonly PlaceId[], others: readonly string[]): Lines[] {
	const out: Lines[] = [HOME(pigName)];
	for (const place of places) {
		const finds = PLACE_FINDS[place];
		const longest = finds.reduce((a, b) => (findName(b).length > findName(a).length ? b : a), finds[0]);
		out.push(ALONE(pigName, place, [longest, longest, longest]));
		out.push(MET(pigName, others.length > 0 ? others : ["a pig"], place, [longest]));
		out.push(MUDDY(place));
	}
	return out;
}

function findName(find: FindId): string {
	return satchelFind(find)?.withArticle ?? find.replace(/_/g, " ");
}

function capitalise(text: string): string {
	return text.length > 0 ? text[0].toUpperCase() + text.slice(1) : text;
}

// ── Geometry ─────────────────────────────────────────────────────────────────
// The yard is a drawn scene, so its measurements are art, not spacing: a
// place card is sized to hold its name, a heap of finds and its sticker, and
// a pig is sized to stand in front of that sticker.

/** My pig in the yard while I choose, and every pig away from it. */
export const PIG_BIG = 96;
export const PIG_SMALL = 44;
/** A place card: name row, heap row and sticker, padded. */
export const CARD_H = 132;
export const CARD_NAME_H = 21;
export const PLACE_ART = 64;
export const HEAP_GLYPH = ART_SIZE.glyphSm;
/** A heap shows this many tiles, overlapping like a pile, then "+N". */
export const HEAP_SHOWN = 5;
const HEAP_PITCH = 18;
const HEAP_PLUS_W = 26;
const CARD_MIN_W = 96;
const CARD_MAX_W = 132;
const YARD_MIN_W = 112;
const ROW_GAP = SPACE.md;
/** A card's inner padding and the gap between its rows (Scene's card style
 *  reads the same three, so the heap math and the drawn card cannot drift). */
export const CARD_PAD_TOP = SPACE.sm;
export const CARD_PAD_X = SPACE.sm;
export const CARD_GAP = SPACE.xs;
/** The pasture's inset around the yard: room for a weight tag over the top
 *  edge and a "Looking…" tag under a bottom card. */
export const FIELD_PAD = SPACE.md;
/** Pigs in a row stand this far apart at most; my pig keeps this much air
 *  above the row of waiting pigs. */
const PIG_GAP = SPACE.xxs;
const YARD_BREATH = SPACE.xs;
/** A shared heart starts above the zone where the finds name themselves. */
const HEART_LIFT = 40;
/** Where a pig's hooves sit below the centre of its 300pt canvas, as a share
 *  of the drawn size (REST_ANCHORS put the feet near y 290 of 300). */
export const PIG_GROUND_FRAC = 0.46;
/** Where its head sits above that centre (the head anchor, y 16 of 300). */
export const PIG_HEAD_FRAC = 0.4;
/** How far above a card's bottom edge a visiting pig stands. */
const CARD_GROUND = SPACE.sm;
const YARD_GROUND = SPACE.xs;

// A short board draws the yard smaller (./layout.ts picks the card height):
// everything inside a card scales with it, down to these floors, so a find
// in a heap is still a find and a pig is still a pig. The name row never
// shrinks: it is words, so it holds the hand line at the board's text scale.
/** A heap tile's smallest glyph. */
export const HEAP_GLYPH_MIN = 18;
/** The smallest place sticker a card keeps; below this the card is too short
 *  for the yard and the board scrolls it instead (./layout.ts). */
export const PLACE_ART_MIN = 20;
const PIG_SMALL_MIN = 30;
const PIG_BIG_MIN = 56;
const MUDDY_MIN = ART_SIZE.glyph;
/** The air under the sticker in a lifted card (its heavier outline included). */
const CARD_SLACK = 1;

/** Every drawing size inside the yard, derived from one card height. At
 *  CARD_H and text scale 1 they are exactly the full-size constants. */
export interface SceneSizes {
	cardH: number;
	/** The card's name row. */
	nameH: number;
	/** A heap tile's glyph, and how far apart tiles overlap. */
	heap: number;
	heapPitch: number;
	/** The place sticker under the heap. */
	art: number;
	pigBig: number;
	pigSmall: number;
	/** The muddy-trotters sticker that lands on a bare heap. */
	muddy: number;
	/** The heap row's centre, from a card's top edge. */
	heapY: number;
	/** Between the two rows of cards. */
	rowGap: number;
}

export interface GeometryOptions {
	/** A card height under CARD_H, for a short board. */
	cardH?: number;
	/** The gap between the rows of cards (ROW_GAP by default). */
	rowGap?: number;
	/** The board's capped text scale (the name row holds a hand line at it). */
	scale?: number;
}

/** What a card spends on everything but its sticker: padding, the name row,
 *  the heap row, the gaps between them and a lifted card's outline. */
export function cardChrome(nameH: number, heap: number): number {
	return CARD_PAD_TOP + nameH + CARD_GAP + heap + CARD_GAP + BORDER.heavy * 2 + CARD_SLACK;
}

/** The name row at a text scale: never under the full-size row. */
export function nameRowFor(scale: number): number {
	return Math.max(CARD_NAME_H, lineSlot("hand", scale));
}

/** The shortest card the yard may draw at a text scale. */
export function cardFloor(scale: number): number {
	return cardChrome(nameRowFor(scale), HEAP_GLYPH_MIN) + PLACE_ART_MIN;
}

export function sceneSizes(opts: GeometryOptions = {}): SceneSizes {
	const cardH = Math.min(CARD_H, opts.cardH ?? CARD_H);
	const k = cardH / CARD_H;
	const nameH = nameRowFor(opts.scale ?? 1);
	const heap = Math.max(HEAP_GLYPH_MIN, Math.round(HEAP_GLYPH * k));
	return {
		cardH,
		nameH,
		heap,
		heapPitch: (HEAP_PITCH * heap) / HEAP_GLYPH,
		art: Math.max(0, Math.min(PLACE_ART, cardH - cardChrome(nameH, heap))),
		pigBig: Math.max(PIG_BIG_MIN, Math.round(PIG_BIG * k)),
		pigSmall: Math.max(PIG_SMALL_MIN, Math.round(PIG_SMALL * k)),
		muddy: Math.max(MUDDY_MIN, Math.round(ART_SIZE.badge * k)),
		heapY: BORDER.ink + CARD_PAD_TOP + nameH + CARD_GAP + heap / 2,
		rowGap: opts.rowGap ?? ROW_GAP,
	};
}

const FULL_SIZE = sceneSizes();

export interface Point {
	x: number;
	y: number;
}

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Geometry {
	width: number;
	height: number;
	/** One card per place, in the view's place order. */
	cards: Rect[];
	yard: Rect;
	/** The drawing sizes inside the yard (full size unless the board is short). */
	sizes: SceneSizes;
}

/**
 * Four places sit at the corners around a tall yard; three (a two-pig table)
 * make a triangle: the River on top, the Hedge and the Farmhouse below, the
 * yard between them. A short board passes a smaller card height; the cards
 * keep their width, so the yard stays as wide as ever.
 */
export function geometry(width: number, placeCount: number, opts: GeometryOptions = {}): Geometry {
	const sizes = opts.cardH === undefined && opts.rowGap === undefined && opts.scale === undefined ? FULL_SIZE : sceneSizes(opts);
	const cardH = sizes.cardH;
	const cardW = Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, Math.floor((width - YARD_MIN_W) / 2)));
	const height = cardH * 2 + sizes.rowGap;
	const right = width - cardW;
	const lower = cardH + sizes.rowGap;
	const card = (x: number, y: number): Rect => ({ x, y, w: cardW, h: cardH });
	if (placeCount === 3) {
		return {
			width,
			height,
			cards: [card((width - cardW) / 2, 0), card(0, lower), card(right, lower)],
			yard: { x: cardW, y: lower, w: width - 2 * cardW, h: cardH },
			sizes,
		};
	}
	return {
		width,
		height,
		cards: [card(0, 0), card(right, 0), card(0, lower), card(right, lower)],
		yard: { x: cardW, y: 0, w: width - 2 * cardW, h: height },
		sizes,
	};
}

/** Centres of a heap's tiles on a card (tiles past the fifth share the "+N" spot). */
export function heapSlots(card: Rect, count: number, sizes: SceneSizes = FULL_SIZE): Point[] {
	const glyph = sizes.heap;
	const shown = Math.min(count, HEAP_SHOWN);
	const plus = count > HEAP_SHOWN ? HEAP_PLUS_W : 0;
	const inner = card.w - 2 * CARD_PAD_X;
	const pitch = shown > 1 ? Math.min(sizes.heapPitch, (inner - glyph - plus) / (shown - 1)) : 0;
	const heapW = glyph + (shown - 1) * pitch + plus;
	const left = card.x + (card.w - heapW) / 2 + glyph / 2;
	const y = card.y + sizes.heapY;
	return Array.from({ length: count }, (_, i) =>
		i < HEAP_SHOWN ? { x: left + i * pitch, y } : { x: left + (shown - 1) * pitch + glyph / 2 + plus / 2, y },
	);
}

export function heapCentre(card: Rect, sizes: SceneSizes = FULL_SIZE): Point {
	return { x: card.x + card.w / 2, y: card.y + sizes.heapY };
}

/** Where `count` pigs of `size` stand in a row of `width` centred on
 *  `centreX`. No pigs, no spots: an empty place draws nobody. */
export function spread(centreX: number, width: number, count: number, size: number): number[] {
	if (count <= 0) return [];
	if (count === 1) return [centreX];
	const pitch = Math.min(size + PIG_GAP, (width - size) / (count - 1));
	const start = centreX - (pitch * (count - 1)) / 2;
	return Array.from({ length: count }, (_, i) => start + i * pitch);
}

function standing(x: number, feet: number, size: number): { x: number; y: number; size: number } {
	return { x, y: feet - PIG_GROUND_FRAC * size, size };
}

/** My pig's spot in the yard while I choose: as big as the yard allows above
 *  the row where everyone else waits. */
export function bigSpot(geo: Geometry): { x: number; y: number; size: number } {
	const { yard, sizes } = geo;
	const size = Math.min(sizes.pigBig, yard.h - sizes.pigSmall - 2 * YARD_GROUND - YARD_BREATH);
	const centreY = yard.y + Math.min(yard.h / 2, yard.h - sizes.pigSmall - YARD_GROUND - YARD_BREATH - size / 2);
	return { x: yard.x + yard.w / 2, y: centreY, size };
}

/** The row along the yard's foot where pigs wait (and nap). */
export function yardRow(geo: Geometry, count: number): { x: number; y: number; size: number }[] {
	const { yard, sizes } = geo;
	const feet = yard.y + yard.h - YARD_GROUND;
	return spread(yard.x + yard.w / 2, yard.w, count, sizes.pigSmall).map((x) => standing(x, feet, sizes.pigSmall));
}

/** The row along a card's foot where the pigs who went there stand. */
export function placeRow(geo: Geometry, card: Rect, count: number): { x: number; y: number; size: number }[] {
	const size = geo.sizes.pigSmall;
	const feet = card.y + card.h - CARD_GROUND;
	return spread(card.x + card.w / 2, card.w, count, size).map((x) => standing(x, feet, size));
}

export function headOf(spot: { x: number; y: number; size: number }): Point {
	return { x: spot.x, y: spot.y - PIG_HEAD_FRAC * spot.size };
}

// ── Staging ──────────────────────────────────────────────────────────────────

/** A reveal plays in three beats: the pigs walk out, the day plays out at each
 *  place, then every pile draws its new tile. */
export type Beat = "out" | "outcome" | "grew";

/** When each beat starts and when the scene hands back to picking, in ms. The
 *  whole scene fits inside the six seconds the live clock waits for it. */
export const BEAT_AT = Object.freeze({ outcome: 1_200, grew: 3_900, done: 5_600 });

export type Pose = "idle" | "happy" | "sad" | "tired";
export type Mark = "check" | "looking" | "zzz" | null;

export interface PigSpot {
	x: number;
	y: number;
	size: number;
	pose: Pose;
	facing: PigFacing | null;
	mark: Mark;
}

export interface StageInput {
	geo: Geometry;
	view: OlView;
	you: number;
	/** The seats that hold a pig (an open async chair has none yet). */
	seated: number[];
	/** gone[seat]: that pig has left the table. */
	gone: readonly boolean[];
	/** Where my pig is looking today (my sealed pick, or the one in flight). */
	sent: number | null;
	reveal: { day: DayRecord; beat: Beat } | null;
}

export function stagePigs(input: StageInput): Record<number, PigSpot> {
	return input.reveal ? stageReveal(input, input.reveal.day, input.reveal.beat) : stageYard(input);
}

function stageYard({ geo, view, you, seated, gone, sent }: StageInput): Record<number, PigSpot> {
	const out: Record<number, PigSpot> = {};
	const ended = view.phase === "ended";
	const others = seated.filter((s) => s !== you);
	const row = yardRow(geo, others.length);
	others.forEach((seat, i) => {
		const away = !!gone[seat];
		const mark: Mark = away ? "zzz" : !ended && view.picked[seat] ? "check" : null;
		out[seat] = { ...row[i], pose: away ? "tired" : ended ? "happy" : "idle", facing: null, mark };
	});
	if (seated.includes(you)) {
		if (sent !== null && !ended) out[you] = { ...placeRow(geo, geo.cards[sent], 1)[0], pose: "idle", facing: null, mark: "looking" };
		else out[you] = { ...bigSpot(geo), pose: ended ? "happy" : "idle", facing: null, mark: null };
	}
	return out;
}

function stageReveal({ geo, seated, view }: StageInput, day: DayRecord, beat: Beat): Record<number, PigSpot> {
	const out: Record<number, PigSpot> = {};
	const settled = beat !== "out";
	const home = seated.filter((s) => day.picks[s] === "home" || day.picks[s] === undefined);
	yardRow(geo, home.length).forEach((spot, i) => {
		out[home[i]] = { ...spot, pose: settled ? "tired" : "idle", facing: null, mark: settled ? "zzz" : null };
	});
	geo.cards.forEach((card, j) => {
		const here = lineOrder(
			seated.filter((s) => day.picks[s] === j),
			day.firstInLine,
			view.seats,
		);
		const met = here.length > 1;
		placeRow(geo, card, here.length).forEach((spot, i) => {
			const seat = here[i];
			const outcome = day.outcomes[seat];
			const pose: Pose = !settled ? "idle" : outcome === "alone" ? "happy" : outcome === "muddy" ? "sad" : "idle";
			// Pigs who meet turn to face each other; an odd one out in the middle faces us.
			const facing: PigFacing | null = !settled || !met ? null : i < (here.length - 1) / 2 ? "right" : i > (here.length - 1) / 2 ? "left" : null;
			out[seat] = { ...spot, pose, facing, mark: null };
		});
	});
	return out;
}

export interface HeapTile {
	key: string;
	find: FindId;
	at: Point;
	/** The tile that dropped on this pile tonight (it lands with a little fall). */
	fresh: boolean;
}

export interface Heap {
	tiles: HeapTile[];
	/** Tiles past the fifth, counted on a "+N" at the heap's end. */
	more: { count: number; at: Point } | null;
	finds: FindId[];
	weight: number;
	/** Taken whole yesterday and resting: a day you can pick, with nothing in
	 *  the heap. The card says so, so the gap reads as chosen, not broken. */
	bare: boolean;
	centre: Point;
}

/**
 * Each place's heap as the scene shows it. Picking: the view's piles. In a
 * reveal: the piles the pigs found, then (once the takers have taken) what is
 * left, still in the spots it lay in so the leaving tiles read as leaving, and
 * last the pile with the night's tile on it.
 */
export function heapsAt(geo: Geometry, view: OlView, reveal: { day: DayRecord; beat: Beat } | null): Heap[] {
	return geo.cards.map((card, j) => {
		let finds: FindId[] = view.places[j]?.pile ?? [];
		let slots = finds.length;
		let first = 0;
		let fresh = -1;
		if (reveal) {
			const arrived = reveal.day.piles[j] ?? [];
			const left = remainder(reveal.day)[j] ?? [];
			const grown = reveal.day.grew[j];
			if (reveal.beat === "out") {
				finds = arrived;
				slots = arrived.length;
			} else if (reveal.beat === "outcome") {
				finds = left;
				slots = arrived.length;
				first = arrived.length - left.length;
			} else {
				finds = grown ? [...left, grown] : left;
				slots = finds.length;
				fresh = grown ? finds.length - 1 : -1;
			}
		}
		const at = heapSlots(card, slots, geo.sizes);
		const tiles: HeapTile[] = [];
		let hidden = 0;
		finds.forEach((find, i) => {
			const slot = first + i;
			if (slot < HEAP_SHOWN) tiles.push({ key: `${j}:${slot}:${find}`, find, at: at[slot], fresh: i === fresh });
			else hidden += 1;
		});
		return {
			tiles,
			more: hidden > 0 ? { count: hidden, at: at[HEAP_SHOWN] } : null,
			finds,
			weight: weightOf(finds),
			bare: !reveal && view.phase === "picking" && finds.length === 0,
			centre: heapCentre(card, geo.sizes),
		};
	});
}

/** What each place had left once the pigs took their share. */
export function remainder(day: DayRecord): FindId[][] {
	return day.piles.map((pile, j) => {
		const taken = day.picks.reduce<number>((n, p, s) => (p === j ? n + day.took[s].length : n), 0);
		return pile.slice(taken);
	});
}

export interface Flight {
	key: string;
	find: FindId;
	from: Point;
	to: Point;
	delay: number;
	/** How long the find's name hangs over the pig once it lands. */
	hold: number;
	/** The tile's glyph: the heap's, so it lifts off the pile at its own size. */
	tile: number;
	label: string;
	/** The name tag's left edge, kept inside the pasture. */
	labelLeft: number;
}

/** A find's name tag: wide enough for "a chip of honeycomb · 2" in the hand,
 *  allowed to hang this far past the yard's edge over the pasture's margin
 *  (geometry, not spacing: it is an overhang). */
export const NAME_W = 148;
const NAME_OVERHANG = SPACE.sm;
/** Each place hands out its tiles in turn, one landing every this often; a
 *  name hangs until the next one lands, and the last one a little longer. */
const TILE_GAP_MS = 360;
const LAST_HOLD_MS = 700;

/** Every tile that leaves a pile on the outcome beat, from its spot in the
 *  heap to the head of the pig that took it. */
export function flightsFor(geo: Geometry, day: DayRecord, spots: Record<number, PigSpot>, seats: number): Flight[] {
	const out: Flight[] = [];
	geo.cards.forEach((card, j) => {
		const arrived = day.piles[j] ?? [];
		const slots = heapSlots(card, arrived.length, geo.sizes);
		const here = lineOrder(
			day.picks.flatMap((p, s) => (p === j ? [s] : [])),
			day.firstInLine,
			seats,
		);
		// Alone: every tile goes to the one pig. Met: the k-th in line takes tile k.
		const alone = here.length === 1 && day.outcomes[here[0]] === "alone";
		const takers = alone ? arrived.map(() => here[0]) : here.slice(0, arrived.length);
		takers.forEach((seat, i) => {
			const spot = spots[seat];
			if (!spot) return;
			const to = headOf(spot);
			const last = i === takers.length - 1;
			out.push({
				key: `${j}:${i}`,
				find: arrived[i],
				from: slots[i],
				to,
				delay: i * TILE_GAP_MS,
				hold: last ? LAST_HOLD_MS : TILE_GAP_MS - MOTION.tap,
				tile: geo.sizes.heap,
				label: findLabel(arrived[i]),
				labelLeft: Math.max(-NAME_OVERHANG, Math.min(geo.width + NAME_OVERHANG - NAME_W, to.x - NAME_W / 2)),
			});
		});
	});
	return out;
}

/** One heart between every group of pigs that met, just above their heads. */
export function heartsFor(geo: Geometry, day: DayRecord, spots: Record<number, PigSpot>): Point[] {
	return geo.cards.flatMap((_, j) => {
		const here = day.picks.flatMap((p, s) => (p === j && day.outcomes[s] === "shared" && spots[s] ? [spots[s]] : []));
		if (here.length < 2) return [];
		const xs = here.map((s) => s.x);
		const top = Math.min(...here.map((s) => headOf(s).y));
		return [{ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: top - HEART_LIFT }];
	});
}

/** The places where a pig found muddy trotters. */
export function muddyAt(day: DayRecord, placeCount: number): number[] {
	return Array.from({ length: placeCount }, (_, j) => j).filter((j) => day.picks.some((p, s) => p === j && day.outcomes[s] === "muddy"));
}

/** The latest day a pig should see revealed on arrival: a live table only
 *  replays the reveal it is being cued for (a pig who rejoins mid-day goes
 *  straight to picking, so the clock is all theirs); an async pig coming back
 *  sees the last day play out until they have picked again. */
export function firstUnwatched(view: OlView, cued: boolean, pace: "live" | "async"): number | null {
	const last = view.history[view.history.length - 1];
	if (!last) return null;
	if (cued) return last.round;
	if (pace === "async" && (view.phase === "ended" || view.myPick === null)) return last.round;
	return null;
}
