// Out Looking's board fitted to the height the match screen gives it (the
// contract: ../fit.ts). Top to bottom: the day signpost, the yard, and the
// thumb zone pinned at the foot with the picks and the Send button.
//
// The thumb zone keeps one height through every state (picking, sent, the
// reveal, the end): the tallest of them in this table's own words (my pig's
// name, the places, the other pigs' names), so the yard never jumps when a
// pig is sent or a day is revealed, and a long day still fits. The yard takes
// what is left. Its cards scale down from 132pt (./model.ts sceneSizes), and
// on the way the board gives up, in this order: the roomy gaps; the place
// chips (the place cards in the yard are picks too, with the same hint); the
// signpost's sticker, which becomes a one-line kicker. Below the card floor
// the yard scrolls above the thumb zone instead, and the thumb zone keeps its
// chips there, so every pick stays in reach without scrolling.
//
// Pure: a function of the board's width, its height, the capped text scale
// and the table's words, so the tests check every phone without a renderer.

import { BORDER, BUTTON_SIZE, SPACE, TAP_MIN } from "@/constants/theme";
import type { PlaceId } from "@/multiplayer/games/out_looking/rules";
import { buttonSlot, lineSlot, linesFor, widthFor } from "../fit";
import { CARD_H, CONTROLS_COPY, FIELD_PAD, PLACE_NAME, cameHomeLine, cardFloor, longestOutcomes, sendLabel } from "./model";

// --- ART -------------------------------------------------------------------
/** Under the thumb zone: the gold button's hard shadow (2pt) stays inside. */
export const FOOT = SPACE.xs;
/** Over the signpost: its tilt lifts a corner by a point. */
export const TOP_AIR = SPACE.xxs;
/** The card height a yard still reads comfortably at (a 34pt sticker under
 *  the heap). Above it the board keeps everything it can; below it, it
 *  starts giving things up. */
export const CARD_COMFORT = 96;
/** Chips that would cost the thumb zone no more than this stay: they are the
 *  picks a screen reader and a thumb find first, and two points of card are
 *  not worth them. */
const CHIPS_FREE = SPACE.xs;
/** The thumb zone's rows sit this far apart. */
export const CONTROLS_GAP = SPACE.sm;
/** The place chips' row: a capsule is 24pt of visual, wrapped rows sit this
 *  far apart (each chip's 44pt frame comes back as hitSlop), and the row
 *  keeps this much air above and below. Chip.tsx's own geometry. */
const CHIP_VISUAL = SPACE.xl;
const CHIP_ROW_GAP = SPACE.lg;
const CHIP_COL_GAP = SPACE.sm;
const CHIP_PAD_V = SPACE.xs;
/** Two digits: the widest a pouch weight ever reads, for the last day's line. */
const WIDE_POUCH = 88;

// --- THE TABLE'S WORDS -----------------------------------------------------

/** Every line the thumb zone can say at this table, per state. */
export interface ControlsCopy {
	pickerTitles: string[];
	sendLabels: string[];
	chips: string[];
	sentTitles: string[];
	sentSubs: string[];
	revealTitles: string[];
	revealSubs: string[];
	skips: string[];
	endedTitles: string[];
	endedSubs: string[];
}

export function controlsCopy({
	pigName,
	places,
	others,
	rounds,
	seats,
}: {
	pigName: string;
	places: readonly PlaceId[];
	/** The other pigs' names (a met-everyone day names them all). */
	others: readonly string[];
	rounds: number;
	seats: number;
}): ControlsCopy {
	const outcomes = longestOutcomes(pigName, places, others);
	return {
		pickerTitles: [CONTROLS_COPY.pickTitle(pigName), CONTROLS_COPY.pickAgain],
		sendLabels: [CONTROLS_COPY.pickLabel(pigName), ...places.map((place) => sendLabel(pigName, place))],
		chips: places.map((place) => PLACE_NAME[place]),
		sentTitles: places.map((place) => CONTROLS_COPY.sentTitle(pigName, place)),
		sentSubs: [
			CONTROLS_COPY.sending(pigName),
			CONTROLS_COPY.pingYou,
			CONTROLS_COPY.everyoneOut,
			CONTROLS_COPY.waitingOn(1),
			CONTROLS_COPY.waitingOn(Math.max(1, seats - 1)),
		],
		revealTitles: outcomes.map((lines) => lines.title),
		revealSubs: outcomes.map((lines) => lines.sub),
		skips: [CONTROLS_COPY.onToDay(rounds), CONTROLS_COPY.seePouches],
		endedTitles: [CONTROLS_COPY.lastDay],
		endedSubs: [cameHomeLine(pigName, WIDE_POUCH, rounds), cameHomeLine(pigName, 0, rounds)],
	};
}

// --- THE THUMB ZONE --------------------------------------------------------

type Role = Parameters<typeof lineSlot>[0];

function mostLines(texts: readonly string[], role: Role, s: number, width: number): number {
	return texts.reduce((most, text) => Math.max(most, linesFor(text, role, s, width)), 1);
}

/** How many rows the chips wrap into across `width`. */
export function chipRows(labels: readonly string[], s: number, width: number): number {
	let rows = 1;
	let used = 0;
	for (const label of labels) {
		// A chip is its label, its padding and, selected, the heavy outline.
		const chip = widthFor(label, "label", s) + SPACE.md * 2 + BORDER.heavy * 2;
		if (used > 0 && used + CHIP_COL_GAP + chip > width) {
			rows += 1;
			used = chip;
		} else {
			used += used > 0 ? CHIP_COL_GAP + chip : chip;
		}
	}
	return rows;
}

export interface ControlsHeights {
	/** Picking, with the place chips, and without them. */
	pickerChips: number;
	picker: number;
	sent: number;
	reveal: number;
	ended: number;
}

/** Each state's thumb zone, in this table's words, at text scale `s`. */
export function controlsHeights(copy: ControlsCopy, s: number, width: number): ControlsHeights {
	const title = (texts: readonly string[]) => lineSlot("handLg", s, mostLines(texts, "handLg", s, width));
	const sub = (texts: readonly string[]) => lineSlot("hand", s, mostLines(texts, "hand", s, width));
	// A wrapped label grows the pill line by line, which is a one-line button
	// at a text scale that many times larger.
	const sendLines = mostLines(copy.sendLabels, "body", s, width - BUTTON_SIZE.md.px * 2 - BORDER.ink * 2);
	const send = buttonSlot("md", s * sendLines);
	const skipLines = mostLines(copy.skips, "hand", s, width - BUTTON_SIZE.sm.px * 2);
	const skip = Math.max(TAP_MIN, BUTTON_SIZE.sm.py * 2 + lineSlot("hand", s, skipLines));
	const chip = Math.max(CHIP_VISUAL, SPACE.xs * 2 + lineSlot("label", s) + BORDER.heavy * 2);
	const rows = chipRows(copy.chips, s, width);
	const chips = rows * chip + (rows - 1) * CHIP_ROW_GAP + CHIP_PAD_V * 2;
	const gap = CONTROLS_GAP;
	const picker = title(copy.pickerTitles) + gap + send;
	return {
		pickerChips: picker + gap + chips,
		picker,
		sent: title(copy.sentTitles) + gap + sub(copy.sentSubs),
		reveal: title(copy.revealTitles) + gap + sub(copy.revealSubs) + gap + skip,
		ended: title(copy.endedTitles) + gap + sub(copy.endedSubs),
	};
}

/** The thumb zone's one height: its tallest state. */
export function controlsHeight(heights: ControlsHeights, chips: boolean): number {
	return Math.max(chips ? heights.pickerChips : heights.picker, heights.sent, heights.reveal, heights.ended);
}

// --- THE PLAN --------------------------------------------------------------

export type DayStyle = "sign" | "kicker";

/** The signpost: a sticker (its title line, padding and outline), or on a
 *  short board a one-line kicker. */
export function dayHeight(day: DayStyle, s: number): number {
	return day === "sign" ? lineSlot("cardTitleSm", s) + SPACE.xxs * 2 + BORDER.ink * 2 : lineSlot("kicker", s);
}

/** The yard's pasture: two rows of cards, the gap between, the inset round
 *  them and the outline. */
export function fieldHeight(cardH: number, rowGap: number): number {
	return cardH * 2 + rowGap + FIELD_PAD * 2 + BORDER.ink * 2;
}

export interface LookingPlan {
	/** The place chips are in the thumb zone (else the place cards are the picks). */
	chips: boolean;
	day: DayStyle;
	/** Between the signpost, the yard and the thumb zone. */
	gap: number;
	dayH: number;
	cardH: number;
	rowGap: number;
	fieldH: number;
	/** The thumb zone, pinned at the foot. */
	controlsH: number;
	/** Everything above the thumb zone: TOP_AIR, the signpost, a gap, the yard. */
	topH: number;
	/** Even at the floor the yard does not fit: it scrolls above the thumb zone. */
	scroll: boolean;
}

interface Chrome {
	gap: number;
	rowGap: number;
	day: DayStyle;
}

const ROOMY: Chrome = { gap: SPACE.md, rowGap: SPACE.md, day: "sign" };
const SNUG: Chrome = { gap: SPACE.sm, rowGap: SPACE.sm, day: "sign" };
const TIGHT: Chrome = { gap: SPACE.sm, rowGap: SPACE.sm, day: "kicker" };

export interface FitInput {
	/** The board's width (the match screen's gutters already removed). */
	width: number;
	height: number;
	/** The capped text scale (../fit.ts useTextScale). */
	scale: number;
	copy: ControlsCopy;
}

/**
 * The board at `height`: the first of these whose yard reads comfortably
 * (the full-size board with its roomy gaps; snug gaps; snug without the
 * chips), else the tight board (the kicker signpost, without the chips if
 * that is what it takes) while its cards clear the floor, else the tight
 * board with the chips back and the yard scrolling at the floor. The chips
 * are only ever dropped when they cost the yard real room: when another
 * state already sets the thumb zone's height (give or take CHIPS_FREE),
 * they stay.
 */
export function lookingFit({ width, height, scale: s, copy }: FitInput): LookingPlan {
	const heights = controlsHeights(copy, s, width);
	const withChips = controlsHeight(heights, true);
	const chipsFree = withChips - controlsHeight(heights, false) <= CHIPS_FREE;
	const floor = cardFloor(s);
	const plan = (chrome: Chrome, chips: boolean, scroll = false): LookingPlan => {
		const controlsH = controlsHeight(heights, chips);
		const topH = height - FOOT - controlsH - chrome.gap;
		const dayH = dayHeight(chrome.day, s);
		const room = Math.floor((topH - TOP_AIR - dayH - chrome.gap - fieldHeight(0, chrome.rowGap)) / 2);
		const cardH = scroll ? floor : Math.min(CARD_H, room);
		return { chips, day: chrome.day, gap: chrome.gap, dayH, cardH, rowGap: chrome.rowGap, fieldH: fieldHeight(cardH, chrome.rowGap), controlsH, topH, scroll };
	};
	const roomy = plan(ROOMY, true);
	if (roomy.cardH >= CARD_H) return roomy;
	const snug = plan(SNUG, true);
	if (snug.cardH >= CARD_COMFORT) return snug;
	const snugBare = plan(SNUG, chipsFree);
	if (snugBare.cardH >= CARD_COMFORT) return snugBare;
	const tight = plan(TIGHT, chipsFree);
	if (tight.cardH >= floor) return tight;
	// At the floor every point counts, even a free chip row's.
	const tightBare = plan(TIGHT, false);
	if (tightBare.cardH >= floor) return tightBare;
	return plan(TIGHT, true, true);
}

/** What the top region's content takes (it may be less than `topH`: the
 *  slack centres the yard between the seat strip and the thumb zone). */
export function topContentHeight(plan: LookingPlan): number {
	return TOP_AIR + plan.dayH + plan.gap + plan.fieldH;
}
