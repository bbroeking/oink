// Fitting a board to the height the match screen gives it.
//
// The contract (components/play/types.ts): a game that sets
// `GameUI.fillsHeight` is drawn in a box of exactly `BoardProps.height`
// with no outer scroll, so a turn's answer can never sit below the fold
// where a tap lands on the emote tray. Every board follows the same shape:
//
//   - The root is exactly `height` tall (natural height while `height` is
//     still undefined, before the match screen's first layout).
//   - The primary actions (the cards, buttons or chips that answer your turn)
//     are pinned at the root's foot at their full size.
//   - Everything above them is planned from what is left: hero art and tiles
//     scale down, and only secondary content (a ledger, a history) shrinks,
//     hides or scrolls. The planned region is `flex: 1, minHeight: 0` with
//     its overflow clipped, so even a wrong estimate costs the art an edge,
//     never the actions their place.
//
// A board's plan is a pure function of (width, height, text scale), so a test
// can check the arithmetic for every phone without a layout engine. Text
// heights come from the TYPE roles at the board's capped text scale: every
// word on a board states CHROME_TYPE_CAP, so a slot reserved here is the
// height the word will really take.
import { useWindowDimensions } from "react-native";
import { BORDER, BUTTON_SIZE, CHROME_TYPE_CAP, FONTS, TYPE } from "@/constants/theme";

type Role = keyof typeof TYPE;

/** How much a capped board word has grown: the system font scale, never
 *  below 1 (a smaller text size only leaves slack), never past the cap. */
export function textScale(fontScale: number, cap: number = CHROME_TYPE_CAP): number {
	return Math.min(Math.max(fontScale || 1, 1), cap);
}

/** The board's text scale, live: re-plans when the text size changes. */
export function useTextScale(cap: number = CHROME_TYPE_CAP): number {
	const { fontScale } = useWindowDimensions();
	return textScale(fontScale, cap);
}

/** The height `lines` lines of a role take at text scale `s` (React Native
 *  scales a role's lineHeight with its font size, under the same cap). */
export function lineSlot(role: Role, s: number, lines = 1): number {
	return Math.ceil(TYPE[role].lineHeight * s) * Math.max(0, lines);
}

// A Button's label has no lineHeight of its own: Nunito's ascent plus descent
// is 1.364 em (measured from the font, 2026-10-04).
const NUNITO_LINE_EM = 1.364;

/** A one-line Button's height at text scale `s`: its floor, or its padding,
 *  ink outline and label line when the label outgrows it. */
export function buttonSlot(size: keyof typeof BUTTON_SIZE, s: number): number {
	const sz = BUTTON_SIZE[size];
	return Math.max(sz.minH, Math.ceil(sz.py * 2 + BORDER.ink * 2 + sz.fs * NUNITO_LINE_EM * s));
}

/** The TicketButton is fixed chrome: a 64pt face on a 74pt box. */
export const TICKET_SLOT = 74;

// Average advance per character, in em, over the board copy (PIL against the
// shipped fonts, 2026-10-04: hand 0.38, Nunito 0.51, Caprasimo 0.54), with a
// margin so a reserve errs towards one line too many, never one too few.
// Capitals run wider in every family.
const EM_PER_CHAR: Record<string, number> = {
	[FONTS.hand]: 0.42,
	[FONTS.body]: 0.56,
	[FONTS.bodySemi]: 0.56,
	[FONTS.bodyExtra]: 0.58,
	[FONTS.bodyBlack]: 0.6,
	[FONTS.whimsy]: 0.6,
	[FONTS.display]: 0.6,
	[FONTS.displaySemi]: 0.6,
};
const EM_PER_CAPITAL = 0.74;

interface RoleMetrics {
	fontFamily: string;
	fontSize: number;
	letterSpacing?: number;
	textTransform?: string;
}

/** How wide `text` runs in a role at scale `s`: an estimate, never a
 *  measurement, erring wide. */
export function widthFor(text: string, role: Role, s: number): number {
	const style: RoleMetrics = TYPE[role];
	const em = style.textTransform === "uppercase" ? EM_PER_CAPITAL : (EM_PER_CHAR[style.fontFamily] ?? EM_PER_CAPITAL);
	return text.length * (style.fontSize * em + (style.letterSpacing ?? 0)) * s;
}

/** How many lines `text` needs in a role at scale `s` across `width` points:
 *  an estimate for reserving a slot, never a measurement. */
export function linesFor(text: string, role: Role, s: number, width: number): number {
	if (text.length === 0) return 0;
	return Math.max(1, Math.ceil(widthFor(text, role, s) / Math.max(1, width)));
}

// ── The phones we design for ─────────────────────────────────────────────────

/** Board widths: the window less the match screen's two PAGE_PAD gutters. */
export const BOARD_WIDTHS = { pro: 366, se: 339 } as const;

/**
 * The height the match screen hands a board (`BoardProps.height`), from the
 * 2026-10-04 simulator captures (artifacts/play-2026-10-04): the board area
 * between the clock and the emote tray, less the match screen's 8pt foot
 * (BOARD_FOOT in MatchScreen.tsx). By seat strip: `pigs` (Rootle, Fence the
 * Pen), `bubble` (pigs plus the clue sky, Snout Says) and `compact` (portrait
 * chips, Mud Volley and Out Looking).
 *
 * Default text: the iPhone 17 Pro (402x874, insets 62/34) leaves a 449pt
 * area under a pigs strip (crown to 142, strip 158, clock 24 and its gaps,
 * tray 56), the bubble sky takes 64 more and compact chips give back about
 * 96; the SE (375x667, insets 20/0) runs the same chrome 131pt shorter.
 * `proAx` / `seAx` are accessibility-large, measured while the crown was
 * still uncapped: the match screen now caps it at CHROME_TYPE_CAP, which
 * gives a real board about 20pt more, so these rows are a floor, the worst
 * case the tests pin. Boards are planned continuously, so any other height
 * fits too.
 */
export const BOARD_HEIGHTS = {
	pro: { pigs: 441, bubble: 377, compact: 537 },
	proAx: { pigs: 391, bubble: 328, compact: 495 },
	se: { pigs: 308, bubble: 244, compact: 404 },
	seAx: { pigs: 260, bubble: 197, compact: 364 },
} as const;

/** The lead's design target for a small phone's board. */
export const SE_DESIGN_HEIGHT = 380;
