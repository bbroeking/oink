// Snout Says' board, as numbers: how big every tile, tray and answer row is
// drawn so the board fits the height the match screen gives it
// (BoardProps.height; ../fit.ts holds the contract). Pure functions of the
// width, the height, the text scale and the words on show, so a test can
// check every phone without a layout engine.
//
// Each plan walks a short list of tiers, roomiest first, and keeps the first
// one whose tiles stand at least TAP_MIN tall: the gaps tighten, then the
// secondary words go (the tally, the Nose's how-to line, the other Noses'
// line), then the answer card folds (the small spread beside the words, then
// one row of nine under them, then a single line), and only last does a
// hand line drop to one line or a tile rely on its hitSlop for the last few
// points of its frame. With no height yet (before the match screen's first
// layout) every plan is the natural board: tiles as wide as the width
// allows, every label, the full answer card.
import { ART_SIZE, BORDER, SPACE, TAP_MIN } from "@/constants/theme";
import { buttonSlot, lineSlot, linesFor, widthFor } from "../fit";

// ── Drawing geometry ─────────────────────────────────────────────────────────

/** The spread's tile at most: a third of the board, up to this. */
export const SPREAD_TILE_MAX = 96;
/** The gap between tiles, and its tight step. */
export const GRID_GAP = SPACE.sm;
const TIGHT_GAP = SPACE.xs;
/** The tray four across (three rows); on a board too short for a
 *  comfortable four-across tile, six across (two rows) when that draws the
 *  bigger picture. */
export const TRAY_COLUMNS = 4;
const TRAY_WIDE_COLUMNS = 6;
/** The small spread's tile, roomy and folded, and the gap between its tiles. */
export const MINI_TILE = ART_SIZE.glyph;
const MINI_TILE_SM = ART_SIZE.glyphMd;
const MINI_TILE_XS = ART_SIZE.glyphSm;
export const MINI_GAP = SPACE.xs;
/** A guess pip's diameter. */
export const PIP = 14;
/** A tray tile this tall is comfortable; below it the plan folds the answer
 *  card before it lets the tray shrink further. */
const COMFORT = 52;
/** Room under the last row for a tile's hard shadow. */
export const FOOT = SPACE.xs;
/** The answer card's gap between the small spread and its words. */
const ANSWER_GAP = SPACE.md;
/** The reveal's card inset, roomy (the Sticker's `pad`) and tight. */
const CARD_PAD = SPACE.card;
const CARD_PAD_TIGHT = SPACE.sm;
/** The clue bubble's floor (ClueBubble's BUBBLE_MIN). */
const BUBBLE_MIN = ART_SIZE.badge;
// The rendered styles' own steps, named once so a plan can count them into a
// height (a gap summed, never a new spacing value).
/** The footer row's gap (pips to tally, and between its wrapped lines). */
const FOOTER_GAP = SPACE.sm;
/** Between the pips and their words. */
const PIP_GAP = SPACE.xs;
/** Between stacked words (the answer card's kicker, name and how-to; the
 *  reveal's word, line and tally; a bubble's picture and name). */
const TEXT_GAP = SPACE.xxs;
/** A clue bubble's inset, down and across. */
const BUBBLE_PAD = SPACE.xs;
const BUBBLE_INSET_X = SPACE.sm;
/** The reveal's small spread and its words. */
const RESULT_GAP = SPACE.md;

// ── A tile's face ────────────────────────────────────────────────────────────
// Every tile is the same sticker: the heavy outline a lifted or ringed tile
// wears, an inset, the picture, and its short name under it when it fits.

const TILE_BORDER = BORDER.heavy;
const TILE_PAD_X = SPACE.xxs;
const TILE_LABEL_GAP = SPACE.xxs;
/** A label only sits under a picture at least this big. */
const LABELLED_GLYPH_MIN = ART_SIZE.glyphMd;
/** The smallest picture a tile draws. */
const GLYPH_MIN = ART_SIZE.mark;

/** A tile's vertical inset: the roomy step on a tile you can tap, a hairline
 *  on a small spread's mini tile. */
export function tilePadY(height: number): number {
	return height >= TAP_MIN ? SPACE.xs : SPACE.xxs;
}

export interface TileFace {
	/** The picture's edge. */
	glyph: number;
	/** Label lines drawn (0: the picture alone; the name stays in the
	 *  accessibility label). */
	labelLines: number;
	/** The vertical inset. */
	padY: number;
}

/** What a `width` × `height` tile holds at text scale `s`, asked for
 *  `labelLines` lines of label. */
export function tileFace(width: number, height: number, s: number, labelLines: number): TileFace {
	const padY = tilePadY(height);
	const innerW = width - 2 * (TILE_BORDER + TILE_PAD_X);
	const innerH = height - 2 * (TILE_BORDER + padY);
	const labelH = labelLines > 0 ? TILE_LABEL_GAP + lineSlot("kicker", s, labelLines) : 0;
	const labelled = labelLines > 0 && innerH - labelH >= LABELLED_GLYPH_MIN && innerW >= LABELLED_GLYPH_MIN;
	const room = Math.min(ART_SIZE.badge, innerW, innerH - (labelled ? labelH : 0));
	return { glyph: Math.max(GLYPH_MIN, Math.floor(room)), labelLines: labelled ? labelLines : 0, padY };
}

/** The label lines a grid of tiles reserves: its longest name, at most two. */
export function labelLinesFor(names: readonly string[], tileW: number, s: number): number {
	const innerW = tileW - 2 * (TILE_BORDER + TILE_PAD_X);
	return Math.min(2, Math.max(1, ...names.map((name) => linesFor(name, "kicker", s, innerW))));
}

/** The natural spread tile: a third of the board, up to SPREAD_TILE_MAX. */
export function spreadTileWidth(width: number, gap: number = GRID_GAP): number {
	return Math.max(0, Math.min(SPREAD_TILE_MAX, Math.floor((width - gap * 2) / 3)));
}

/** The natural tray tile: four across the board. */
export function trayTileWidth(width: number, columns: number = TRAY_COLUMNS, gap: number = GRID_GAP): number {
	return Math.max(0, Math.floor((width - gap * (columns - 1)) / columns));
}

/** The vertical hitSlop that brings a `tileH` tile's frame back to TAP_MIN,
 *  never reaching past half the gap to the next row. */
function slopFor(tileH: number, gridGap: number): number {
	return tileH >= TAP_MIN ? 0 : Math.min(gridGap / 2, Math.ceil((TAP_MIN - tileH) / 2));
}

// ── The spread (the Guesser, and a Nose watching the guess) ──────────────────

export type FooterKind = "full" | "short" | "none";

export interface SpreadInput {
	width: number;
	/** The match screen's measure; undefined: the natural board. */
	height?: number;
	/** The board's capped text scale. */
	s: number;
	/** The hand line over the spread. */
	line: string;
	/** The pips' words ("two guesses") under the Guesser's spread; null when
	 *  this pig has no guesses (a Nose, a pig sitting the round out). */
	pips: string | null;
	/** The round and the running total, under the spread. */
	tally: string;
	/** The nine pictures' short names (the label reserve). */
	labels: readonly string[];
}

export interface SpreadPlan {
	gap: number;
	gridGap: number;
	tileW: number;
	/** Undefined: the natural tile (at least as tall as it is wide). */
	tileH: number | undefined;
	/** Label lines the tiles ask for. */
	labelLines: number;
	/** Each tile's vertical hitSlop (0 at TAP_MIN and over). */
	hitSlop: number;
	/** Undefined: the hand line wraps freely (the natural board). */
	handLines: number | undefined;
	handH: number;
	/** full: pips and tally; short: the pips alone (nothing without pips). */
	footer: FooterKind;
	footerLines: number;
	footerH: number;
	gridH: number;
	/** The pinned foot (the spread, the footer and the shadow room), from
	 *  the board's top. */
	footTop: number;
	/** Everything planned, top to bottom. */
	total: number;
}

interface SpreadTier {
	gap: number;
	gridGap: number;
	footer: "full" | "short";
	handCap: number;
	slop: boolean;
}

const SPREAD_TIERS: readonly SpreadTier[] = [
	{ gap: SPACE.md, gridGap: GRID_GAP, footer: "full", handCap: 3, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, footer: "full", handCap: 3, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, footer: "short", handCap: 3, slop: false },
	{ gap: SPACE.xs, gridGap: TIGHT_GAP, footer: "short", handCap: 3, slop: false },
	{ gap: SPACE.xs, gridGap: TIGHT_GAP, footer: "short", handCap: 3, slop: true },
	{ gap: SPACE.xs, gridGap: TIGHT_GAP, footer: "short", handCap: 1, slop: true },
];

/** The footer row's line: a pip or a kicker line, whichever is taller. */
function footerLine(s: number): number {
	return Math.max(PIP, lineSlot("kicker", s));
}

/** The pips and their words: two pips and the words, a gutter apart. */
function pipsWidth(words: string, s: number): number {
	return PIP * 2 + PIP_GAP * 2 + widthFor(words, "kicker", s);
}

function footerFor(kind: "full" | "short", input: SpreadInput): { kind: FooterKind; lines: number; h: number } {
	const { pips, tally, s, width } = input;
	const line = footerLine(s);
	if (kind === "short") return pips === null ? { kind: "none", lines: 0, h: 0 } : { kind: "short", lines: 1, h: line };
	if (pips === null) {
		const lines = Math.min(2, linesFor(tally, "kicker", s, width));
		return { kind: "full", lines, h: lineSlot("kicker", s, lines) };
	}
	const oneLine = pipsWidth(pips, s) + FOOTER_GAP + widthFor(tally, "kicker", s) <= width;
	return oneLine ? { kind: "full", lines: 1, h: line } : { kind: "full", lines: 2, h: line * 2 + FOOTER_GAP };
}

export function spreadPlan(input: SpreadInput): SpreadPlan {
	const { width, height, s, line } = input;
	if (height === undefined) {
		const tileW = spreadTileWidth(width);
		const footer = footerFor("full", input);
		return {
			gap: SPACE.md,
			gridGap: GRID_GAP,
			tileW,
			tileH: undefined,
			labelLines: 2,
			hitSlop: 0,
			handLines: undefined,
			handH: 0,
			footer: footer.kind,
			footerLines: footer.lines,
			footerH: footer.h,
			gridH: tileW * 3 + GRID_GAP * 2,
			footTop: 0,
			total: 0,
		};
	}
	let plan: SpreadPlan | null = null;
	for (const tier of SPREAD_TIERS) {
		const tileW = spreadTileWidth(width, tier.gridGap);
		const handLines = Math.min(tier.handCap, linesFor(line, "handLg", s, width));
		const handH = lineSlot("handLg", s, handLines);
		const footer = footerFor(tier.footer, input);
		const footerBlock = footer.h > 0 ? tier.gap + footer.h : 0;
		const room = height - handH - tier.gap - tier.gridGap * 2 - footerBlock - FOOT;
		const floor = tier.slop ? TAP_MIN - tier.gridGap : TAP_MIN;
		const tileH = Math.max(floor, Math.min(tileW, Math.floor(room / 3)));
		const gridH = tileH * 3 + tier.gridGap * 2;
		const foot = gridH + footerBlock + FOOT;
		plan = {
			gap: tier.gap,
			gridGap: tier.gridGap,
			tileW,
			tileH,
			labelLines: labelLinesFor(input.labels, tileW, s),
			hitSlop: slopFor(tileH, tier.gridGap),
			handLines,
			handH,
			footer: footer.kind,
			footerLines: footer.lines,
			footerH: footer.h,
			gridH,
			footTop: height - foot,
			total: handH + tier.gap + foot,
		};
		if (Math.floor(room / 3) >= floor) break;
	}
	return plan as SpreadPlan;
}

// ── A Nose's clue beat ───────────────────────────────────────────────────────

/** The answer card's three shapes: the small spread beside the words; one
 *  row of nine under a title line; a title line alone with the answer's own
 *  ringed tile. */
export type AnswerShape = "grid" | "row" | "line";

export interface NoseInput {
	width: number;
	height?: number;
	s: number;
	/** "the tickle boom". */
	title: string;
	/** "show a picture that reminds you of it. Pepper guesses." */
	instruction: string;
	/** The other Noses' line ("Pip has picked · Bun is still thinking"), or
	 *  null at a two-pig table. */
	others: string | null;
	/** The twelve tray pictures' short names (the label reserve). */
	labels: readonly string[];
}

export interface TrayPlan {
	columns: number;
	rows: number;
	gap: number;
	tileW: number;
	/** Undefined: the natural tile. */
	tileH: number | undefined;
	labelLines: number;
	hitSlop: number;
	h: number;
}

export interface NosePlan {
	gap: number;
	answer: AnswerShape;
	/** The small spread's tile (grid, row), or the line's ringed tile. */
	mini: number;
	/** The how-to line under the answer's name (grid only). */
	instruction: boolean;
	/** Lines reserved for the name and the how-to (grid); undefined: wrap. */
	titleLines: number | undefined;
	instructionLines: number | undefined;
	/** The compact answer line's height (row, line); 0 for the grid. */
	titleRowH: number;
	answerH: number;
	tray: TrayPlan;
	others: boolean;
	othersLines: number | undefined;
	othersH: number;
	/** The Show this one button's slot (the "you showed it" card wears the
	 *  same height). */
	button: number;
	/** The pinned foot (tray, the others' line, the button and the shadow
	 *  room), from the board's top. */
	footTop: number;
	total: number;
}

interface NoseTier {
	gap: number;
	gridGap: number;
	answer: AnswerShape;
	mini: number;
	instruction: boolean;
	others: boolean;
	accept: number;
	slop: boolean;
}

const NOSE_TIERS: readonly NoseTier[] = [
	{ gap: SPACE.md, gridGap: GRID_GAP, answer: "grid", mini: MINI_TILE, instruction: true, others: true, accept: COMFORT, slop: false },
	{ gap: SPACE.md, gridGap: GRID_GAP, answer: "grid", mini: MINI_TILE_SM, instruction: true, others: true, accept: COMFORT, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, answer: "grid", mini: MINI_TILE_SM, instruction: false, others: false, accept: COMFORT, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, answer: "row", mini: MINI_TILE_SM, instruction: false, others: false, accept: COMFORT, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, answer: "row", mini: MINI_TILE_SM, instruction: false, others: false, accept: TAP_MIN, slop: false },
	{ gap: SPACE.sm, gridGap: GRID_GAP, answer: "line", mini: 0, instruction: false, others: false, accept: TAP_MIN, slop: false },
	{ gap: SPACE.xs, gridGap: TIGHT_GAP, answer: "line", mini: 0, instruction: false, others: false, accept: TAP_MIN, slop: false },
	{ gap: SPACE.xs, gridGap: TIGHT_GAP, answer: "line", mini: 0, instruction: false, others: false, accept: TAP_MIN - TIGHT_GAP, slop: true },
];

/** The small spread's edge: `columns` tiles of `tile`, a MINI_GAP apart. */
export function miniSpan(tile: number, columns: number): number {
	return tile * columns + MINI_GAP * (columns - 1);
}

/** A row of nine mini tiles across the board, no bigger than `cap`. */
function rowTile(width: number, cap: number): number {
	return Math.min(cap, Math.floor((width - MINI_GAP * 8) / 9));
}

/** The compact answer line: the kicker and the name, one line. */
function answerLineH(s: number): number {
	return lineSlot("cardTitleSm", s);
}

function answerFor(
	tier: NoseTier,
	input: NoseInput,
): Pick<NosePlan, "answer" | "mini" | "instruction" | "titleLines" | "instructionLines" | "titleRowH" | "answerH"> {
	const { width, s } = input;
	if (tier.answer === "grid") {
		const span = miniSpan(tier.mini, 3);
		const textW = width - span - ANSWER_GAP;
		const titleLines = Math.min(2, linesFor(input.title, "cardTitle", s, textW));
		const instructionLines = tier.instruction ? Math.min(3, linesFor(input.instruction, "hand", s, textW)) : 0;
		const text =
			lineSlot("kicker", s) +
			TEXT_GAP +
			lineSlot("cardTitle", s, titleLines) +
			(instructionLines > 0 ? TEXT_GAP + lineSlot("hand", s, instructionLines) : 0);
		return { answer: "grid", mini: tier.mini, instruction: instructionLines > 0, titleLines, instructionLines, titleRowH: 0, answerH: Math.max(span, text) };
	}
	if (tier.answer === "row") {
		const tile = rowTile(width, tier.mini);
		return { answer: "row", mini: tile, instruction: false, titleLines: 1, instructionLines: 0, titleRowH: answerLineH(s), answerH: answerLineH(s) + MINI_GAP + tile };
	}
	// The answer's own tile rides the line, a mini tile tall, so its picture
	// stays legible beside the name.
	const line = Math.max(MINI_TILE_SM, answerLineH(s));
	return { answer: "line", mini: MINI_TILE_SM, instruction: false, titleLines: 1, instructionLines: 0, titleRowH: line, answerH: line };
}

/** The tray's two shapes at `avail` points tall: four across unless six
 *  across leaves the bigger picture. */
function trayFor(avail: number, gridGap: number, width: number, s: number, labels: readonly string[]): TrayPlan {
	const shape = (columns: number): TrayPlan => {
		const rows = Math.ceil(labels.length / columns) || 1;
		const tileW = trayTileWidth(width, columns, gridGap);
		const tileH = Math.min(tileW, Math.floor((avail - gridGap * (rows - 1)) / rows));
		return { columns, rows, gap: gridGap, tileW, tileH, labelLines: labelLinesFor(labels, tileW, s), hitSlop: 0, h: tileH * rows + gridGap * (rows - 1) };
	};
	const four = shape(TRAY_COLUMNS);
	const six = shape(TRAY_WIDE_COLUMNS);
	const picture = (t: TrayPlan) => tileFace(t.tileW, t.tileH ?? t.tileW, s, 0).glyph;
	if ((four.tileH ?? 0) >= COMFORT) return four;
	return picture(six) > picture(four) ? six : four;
}

export function nosePlan(input: NoseInput): NosePlan {
	const { width, height, s } = input;
	const button = buttonSlot("lg", s);
	if (height === undefined) {
		const tier = NOSE_TIERS[0];
		const answer = answerFor(tier, input);
		const tileW = trayTileWidth(width);
		const rows = Math.ceil(input.labels.length / TRAY_COLUMNS) || 1;
		return {
			gap: SPACE.md,
			...answer,
			titleLines: undefined,
			instructionLines: undefined,
			tray: { columns: TRAY_COLUMNS, rows, gap: GRID_GAP, tileW, tileH: undefined, labelLines: 2, hitSlop: 0, h: tileW * rows + GRID_GAP * (rows - 1) },
			others: input.others !== null,
			othersLines: undefined,
			othersH: 0,
			button,
			footTop: 0,
			total: 0,
		};
	}
	let plan: NosePlan | null = null;
	for (const tier of NOSE_TIERS) {
		const answer = answerFor(tier, input);
		const others = tier.others && input.others !== null;
		const othersLines = others ? Math.min(2, linesFor(input.others ?? "", "hand", s, width)) : 0;
		const othersH = others ? lineSlot("hand", s, othersLines) : 0;
		const pinnedWords = (others ? tier.gap + othersH : 0) + tier.gap + button + FOOT;
		const avail = height - answer.answerH - tier.gap - pinnedWords;
		const tray = trayFor(avail, tier.gridGap, width, s, input.labels);
		const floor = tier.slop ? tier.accept : TAP_MIN;
		const tileH = Math.max(floor, tray.tileH ?? 0);
		const sized: TrayPlan = { ...tray, tileH, hitSlop: slopFor(tileH, tier.gridGap), h: tileH * tray.rows + tier.gridGap * (tray.rows - 1) };
		const foot = sized.h + pinnedWords;
		plan = {
			gap: tier.gap,
			...answer,
			tray: sized,
			others,
			othersLines: others ? othersLines : undefined,
			othersH,
			button,
			footTop: height - foot,
			total: answer.answerH + tier.gap + foot,
		};
		if ((tray.tileH ?? 0) >= tier.accept) break;
	}
	return plan as NosePlan;
}

// ── The reveal ───────────────────────────────────────────────────────────────

export type OutcomeRole = "display" | "sectionTitle";

export interface RevealInput {
	width: number;
	height?: number;
	s: number;
	/** The word on each bubble in the recap (a clue's short name, or "great
	 *  minds" for a picture that tore). */
	bubbles: readonly string[];
	/** The line said when no clue was shown, or null when there were bubbles. */
	nothing: string | null;
	/** The outcome's hand line ("a nose that knew. +2"). */
	outcome: string;
}

export interface RevealPlan {
	pad: number;
	gap: number;
	mini: number;
	word: OutcomeRole;
	kicker: boolean;
	/** The recap's bubbles wear their names (false: the pictures alone). */
	names: boolean;
	/** The card's height. */
	h: number;
}

interface RevealTier {
	pad: number;
	gap: number;
	mini: number;
	word: OutcomeRole;
	kicker: boolean;
	names: boolean;
}

const REVEAL_TIERS: readonly RevealTier[] = [
	{ pad: CARD_PAD, gap: SPACE.md, mini: MINI_TILE, word: "display", kicker: true, names: true },
	{ pad: CARD_PAD_TIGHT, gap: SPACE.sm, mini: MINI_TILE_SM, word: "display", kicker: true, names: true },
	{ pad: CARD_PAD_TIGHT, gap: SPACE.sm, mini: MINI_TILE_SM, word: "sectionTitle", kicker: true, names: true },
	{ pad: CARD_PAD_TIGHT, gap: SPACE.sm, mini: MINI_TILE_SM, word: "sectionTitle", kicker: true, names: false },
	{ pad: CARD_PAD_TIGHT, gap: SPACE.xs, mini: MINI_TILE_SM, word: "sectionTitle", kicker: false, names: false },
	{ pad: CARD_PAD_TIGHT, gap: SPACE.xs, mini: MINI_TILE_XS, word: "sectionTitle", kicker: false, names: false },
];

/** A clue bubble's height: its floor, or its outline, inset, picture and
 *  (when it wears one) one line of name. */
function bubbleH(s: number, names: boolean): number {
	const name = names ? TEXT_GAP + lineSlot("kicker", s) : 0;
	return Math.max(BUBBLE_MIN, BORDER.ink * 2 + BUBBLE_PAD * 2 + ART_SIZE.glyphMd + name);
}

/** The recap's bubbles packed into rows `inner` wide, a FOOTER_GAP apart. */
function bubbleRows(words: readonly string[], s: number, inner: number, names: boolean): number {
	let rows = 0;
	let used = 0;
	for (const word of words) {
		const w = names ? Math.max(BUBBLE_MIN, widthFor(word, "kicker", s) + BUBBLE_INSET_X * 2 + BORDER.ink * 2) : BUBBLE_MIN;
		if (rows === 0 || used + FOOTER_GAP + w > inner) {
			rows += 1;
			used = w;
		} else {
			used += FOOTER_GAP + w;
		}
	}
	return rows;
}

function revealHeight(tier: RevealTier, input: RevealInput): number {
	const { width, s } = input;
	const inner = width - 2 * (tier.pad + BORDER.ink);
	const rows = bubbleRows(input.bubbles, s, inner, tier.names);
	const said =
		input.nothing !== null
			? lineSlot("hand", s, linesFor(input.nothing, "hand", s, inner))
			: rows > 0
				? rows * bubbleH(s, tier.names) + (rows - 1) * FOOTER_GAP
				: 0;
	const span = miniSpan(tier.mini, 3);
	const columnW = inner - span - RESULT_GAP;
	const column =
		lineSlot(tier.word, s) +
		TEXT_GAP +
		lineSlot("hand", s, linesFor(input.outcome, "hand", s, columnW)) +
		TEXT_GAP +
		lineSlot("numeral", s);
	const kicker = tier.kicker ? lineSlot("kicker", s) + tier.gap : 0;
	return 2 * (tier.pad + BORDER.ink) + kicker + (said > 0 ? said + tier.gap : 0) + Math.max(span, column);
}

export function revealPlan(input: RevealInput): RevealPlan {
	if (input.height === undefined) {
		const tier = REVEAL_TIERS[0];
		return { ...tier, h: revealHeight(tier, input) };
	}
	let plan: RevealPlan | null = null;
	for (const tier of REVEAL_TIERS) {
		plan = { ...tier, h: revealHeight(tier, input) };
		if (plan.h <= input.height) break;
	}
	return plan as RevealPlan;
}
