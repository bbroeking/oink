// The Rootle board's few fixed numbers, and how the board fits the height the
// match screen gives it: drawing geometry and the Dynamic Type ceiling, named
// once so no component re-declares them. Spacing, radii, borders and type all
// come from constants/theme.ts.

import { ART_SIZE, BORDER, CHROME_TYPE_CAP, SPACE } from "@/constants/theme";
import { ROOTLE_TUNING } from "@/multiplayer/games/rootle/rules";
import { buttonSlot, lineSlot, linesFor } from "../fit";

/** The board is fixed-height chrome around the die: past one step of
 *  Dynamic Type it would clip rather than grow, so its words cap at the
 *  chrome ceiling (the visit's and the friend row's). */
export const BOARD_TYPE_CAP = CHROME_TYPE_CAP;

/** The die tray's edge at full size (the spec's 128pt sticker, plus room
 *  for the painted face's sparkles). */
export const DIE_TRAY = 132;

/** On a narrow board the tray takes at most this share of the width. */
export const DIE_WIDTH_SHARE = 0.4;

/** The smallest the tray is drawn on a short board: the painted face still
 *  reads at a glance (its art is 82% of the tray). */
export const DIE_MIN = 48;

/** Turns shown in the strip: the last two or three, newest first. */
export const STRIP_ROWS = 3;

/** The fence rail's thickness: a drawn rail, not a rule. */
export const RAIL_H = 6;

/** The first-turn hint over an empty strip, and its short form for a strip
 *  too short to hold it. */
export const STRIP_HINT = `no turns yet · the first pig home with ${ROOTLE_TUNING.target} starts the last round`;
export const STRIP_HINT_SHORT = "no turns yet";

// --- FITTING ---------------------------------------------------------------
// Drawing geometry, named once: the die's stage pads the tray above for the
// "last turn" tape's overhang and below for its sticker shadow; a sticker row
// keeps room for its small hard shadow and tilt; a ledger line's floor is the
// seat disc and the Hungerer's glyph; a dashed rule sits between two of them.
const DIE_PAD = SPACE.sm;
const SHADOW_ROOM = SPACE.xs;
const LEDGER_LINE = ART_SIZE.glyphSm;
const RULE_H = BORDER.hair * 2;
const LEDGER_GAP = SPACE.xs;
const PAPER_PAD_X = SPACE.md;
const PAPER_PAD_Y = SPACE.sm;
const HAUL_PAD = SPACE.sm;
const HAUL_LINE_GAP = SPACE.xxs;
const KICKER_GAP = SPACE.xs;
/** The board's rows sit this far apart, tightening on a short board when
 *  the space buys the die something. */
const GAP_ROOMY = SPACE.md;
const GAP_TIGHT = SPACE.sm;
/** The status line sits this far above the thumb zone, and the thumb zone
 *  keeps this much under it for the Buttons' hard shadow. */
const STATUS_GAP = SPACE.sm;
const FOOT_ROOM = SPACE.xs;
/** How big the die must still be before the strip earns each line: the die
 *  is the hero, the strip is the table's memory. */
const DIE_FOR_ROWS: Record<number, number> = { 3: 120, 2: 104, 1: 88, 0: DIE_MIN };
/** The rows keep their roomy gaps while the die stays at least this big. */
const DIE_ROOMY = 112;

/** The haul row: two stickers of a numeral line over a caption. */
export function haulHeight(s: number): number {
	const line = Math.max(ART_SIZE.glyphMd, lineSlot("numeralLg", s), lineSlot("hand", s));
	return BORDER.ink * 2 + HAUL_PAD * 2 + line + HAUL_LINE_GAP + lineSlot("kickerPillSm", s) + SHADOW_ROOM;
}

/** One ledger line of the turn strip. */
export function ledgerLine(s: number): number {
	return Math.max(LEDGER_LINE, lineSlot("hand", s), lineSlot("label", s));
}

/** The ledger's height inside the paper, for `rows` lines. */
export function ledgerHeight(rows: number, s: number): number {
	return rows <= 0 ? 0 : rows * ledgerLine(s) + (rows - 1) * (LEDGER_GAP * 2 + RULE_H);
}

/** The whole turn strip: its kicker over the paper. Nothing at 0 rows. */
export function stripHeight(rows: number, s: number): number {
	if (rows <= 0) return 0;
	return lineSlot("kicker", s) + KICKER_GAP + BORDER.ink * 2 + PAPER_PAD_Y * 2 + ledgerHeight(rows, s) + SHADOW_ROOM;
}

/** The pinned foot: the status line (one line, or two for a table whose
 *  longest line will not fit one) over the thumb zone. */
export function footHeight(button: "lg" | "md", s: number, statusLines = 1): number {
	return GAP_TIGHT + lineSlot("handLg", s, statusLines) + STATUS_GAP + buttonSlot(button, s) + FOOT_ROOM;
}

/** How many lines the status line keeps for a table: the widest line it can
 *  say (the longest name rootling, or the longest fixed line) at the scale. */
export function statusLines(width: number, s: number, widest: string): number {
	return Math.min(2, linesFor(widest, "handLg", s, width));
}

export interface RootlePlan {
	/** The board knows its height (else the natural layout, as before the
	 *  match screen's first layout). */
	fit: boolean;
	/** The die tray's edge. */
	die: number;
	/** Ledger lines in the turn strip; 0 hides the strip. */
	rows: number;
	/** The long first-turn hint fits over the empty ledger. */
	longHint: boolean;
	/** The gap between the planned rows. */
	gap: number;
	/** The fence rail across the top (dropped only on the shortest boards;
	 *  the die's "last turn" tape still marks the last round). */
	rail: boolean;
	/** The thumb zone's Button size. */
	button: "lg" | "md";
	/** The pinned foot's height and the planned region's above it. */
	foot: number;
	top: number;
	/** What the planned rows add up to at the planned die (<= top). */
	content: number;
}

function hintFits(rows: number, width: number, s: number): boolean {
	if (rows <= 0) return false;
	const inner = width - BORDER.ink * 2 - PAPER_PAD_X * 4;
	return linesFor(STRIP_HINT, "hand", s, inner) * lineSlot("hand", s) <= ledgerHeight(rows, s);
}

/**
 * Fits the board to `height` at text scale `s`. The foot (status line and
 * thumb zone) is pinned at full size; above it the die is the hero, the
 * strip takes a line only while the die stays big enough for it, the gaps
 * tighten before the die gives way, and on the shortest boards the Buttons
 * step down a size and the rail goes. Undefined height: the natural board.
 */
export function rootleFit(width: number, height: number | undefined, s: number, lines = 1): RootlePlan {
	const dieMax = Math.max(DIE_MIN, Math.min(DIE_TRAY, Math.round(width * DIE_WIDTH_SHARE)));
	if (height === undefined) {
		return {
			fit: false,
			die: dieMax,
			rows: STRIP_ROWS,
			longHint: true,
			gap: GAP_ROOMY,
			rail: true,
			button: "lg",
			foot: 0,
			top: 0,
			content: 0,
		};
	}
	const plan = (button: "lg" | "md", rail: boolean, rows: number, gap: number, die: number): RootlePlan => {
		const foot = footHeight(button, s, lines);
		const top = Math.max(0, height - foot);
		const content = fixedRows(rail, rows, gap, s) + DIE_PAD * 2 + die;
		return { fit: true, die, rows, longHint: hintFits(rows, width, s), gap, rail, button, foot, top, content };
	};
	for (const button of ["lg", "md"] as const) {
		const top = height - footHeight(button, s, lines);
		for (const rail of [true, false]) {
			for (let rows = STRIP_ROWS; rows >= 0; rows--) {
				const room = (gap: number) => Math.min(dieMax, Math.floor(top - fixedRows(rail, rows, gap, s) - DIE_PAD * 2));
				const tight = room(GAP_TIGHT);
				if (tight < DIE_FOR_ROWS[rows]) continue;
				// Roomy gaps while they cost the die nothing, or leave it big.
				const roomy = room(GAP_ROOMY);
				const breathe = roomy >= tight || roomy >= Math.max(DIE_ROOMY, DIE_FOR_ROWS[rows]);
				return breathe ? plan(button, rail, rows, GAP_ROOMY, roomy) : plan(button, rail, rows, GAP_TIGHT, tight);
			}
		}
	}
	// Shorter than the board can draw: the foot keeps its place and size, the
	// die stops at its floor, and the planned region clips what is left.
	return plan("md", false, 0, GAP_TIGHT, DIE_MIN);
}

/** The planned rows besides the die's stage: the rail, the haul, the strip
 *  and the gaps between them. */
function fixedRows(rail: boolean, rows: number, gap: number, s: number): number {
	const gaps = (rail ? 1 : 0) + 1 + (rows > 0 ? 1 : 0);
	return (rail ? RAIL_H : 0) + haulHeight(s) + stripHeight(rows, s) + gaps * gap;
}
