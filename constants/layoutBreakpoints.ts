// Phone width tiers and the friend row's action-panel geometry — the one place
// a layout is allowed to ask "how wide is this phone?".
//
// The friend row's actions live in ONE anchored panel that slides over the name
// column when the row's "…" trigger is tapped (the 2026-09-14 actions-menu
// spec). A narrow phone does not get a different grid, it gets a tighter *art*
// tier: the glyph yields a step, the label never does. Two tiers, named here so
// the row's styles and `__tests__/friendRowLayout.test.ts` read the same
// numbers.
//
// `utils/adaptiveLayout.ts` does not exist — `__tests__/adaptiveLayout.test.ts`
// is a source-scan guardrail (every geometry reads `useWindowDimensions`), not
// a module. This file is the module that guardrail implies. (2026-09-12)

import { BORDER, PAGE_PAD, SPACE, TAP_MIN, TYPE } from "@/constants/theme";

/**
 * A derivation is written as its NAMED PARTS and summed, never as one long
 * arithmetic expression: the parts are what the row's styles spend, so a test
 * can hold the two to the same tokens. (Also why `SPACE.a + SPACE.b` never
 * appears here — the spacing scale is a scale, and this is a sum of it.)
 */
const sum = (parts: readonly number[]) => parts.reduce((a, b) => a + b, 0);

/**
 * Below this the row is "narrow" — iPhone SE / mini / 13 mini territory, where
 * a 20pt glyph over a label in a fifth-width cell starts to crowd.
 */
export const PHONE_NARROW_MAX = 390;

/** The wide tier starts here (Plus / Pro Max). Kept for callers that want it. */
export const PHONE_WIDE_MIN = 430;

export type RowDensity = "narrow" | "regular";

/** Which type tier this window width gets. */
export function rowDensity(width: number): RowDensity {
	return width < PHONE_NARROW_MAX ? "narrow" : "regular";
}

export interface ActionCellTier {
	/**
	 * The `TYPE` role the cell's label speaks in. `label` on BOTH tiers since
	 * 2026-09-14: the narrow tier used to drop to `kickerPillSm`, whose 1.6pt
	 * tracking costs more width on a five-letter word than the smaller glyphs
	 * save. Measured against the 39.8pt content box a 375pt phone gives a cell
	 * (Nunito ExtraBold, the shipped face): CURSE 41.7 · AGAIN 41.0 · UNPIN
	 * 40.1 · PROFILE 53.2 all overflowed, and the cell's `adjustsFontSizeToFit`
	 * rescued the first three while "Profile" truncated anyway. At `label` the
	 * same five words measure 27.4 · 32.2 · 34.2 · 35.0 · 35.2 · 40.5 — every
	 * one inside the box, at full size, with no shrink-to-fit anywhere.
	 */
	labelRole: "kickerPillSm" | "label";
	/** Art size for the cell's glyph — a drawing box, not a spacing step. */
	glyph: number;
}

export const ACTION_CELL_TIER: Record<RowDensity, ActionCellTier> = {
	narrow: { labelRole: "label", glyph: 18 },
	regular: { labelRole: "label", glyph: 20 },
};

/** The friend-row action panel's cell type tier for a given window width. */
export function actionCellTier(width: number): ActionCellTier {
	return ACTION_CELL_TIER[rowDensity(width)];
}

// ── The action panel's geometry ────────────────────────────────────
// The founder's one explicit worry about the actions menu is overflow: five
// cells in a panel that covers the name column, on a 375pt phone, must not
// clip. Flex does the laying out — nothing below is read by a style except
// `ACTION_PANEL_INSETS` and `ROW_MIN_H`. The rest exists so a test can assert
// the geometry the styles imply, in the tokens the styles actually spend.

/** Visit · Bless · Curse · Pin · Profile. */
export const ACTION_PANEL_CELLS = 5;

/**
 * Everything the window's width is spent on before a cell gets any, in the
 * order the layout stacks it, outside-in. Each entry is one edge per side.
 */
export const ACTION_PANEL_CHROME = {
	/** The Friends panel's page gutter, both sides. */
	pageGutter: [PAGE_PAD, PAGE_PAD],
	/** The row sticker's own ink outline, both sides. */
	rowBorder: [BORDER.ink, BORDER.ink],
	/** The panel's inset from the row's inner edge, left and right. */
	panelInset: [SPACE.sm, SPACE.sm],
	/** The rail the panel must never cover: the 44pt trigger plus its gap. */
	triggerClearance: [TAP_MIN, SPACE.sm],
	/** The panel's own ink outline, both sides. */
	panelBorder: [BORDER.ink, BORDER.ink],
	/** The panel's inner padding, both sides. */
	panelPad: [SPACE.xs, SPACE.xs],
	/** The four gaps between five cells. */
	cellGaps: [SPACE.xs, SPACE.xs, SPACE.xs, SPACE.xs],
	/** One cell's own outline and inner padding, both sides. */
	cellBorder: [BORDER.ink, BORDER.ink],
	cellPad: [SPACE.xxs, SPACE.xxs],
} as const;

/**
 * The panel's absolute insets inside the row, derived from those parts. The
 * row's own padding is deliberately NOT in here: Yoga positions an absolutely
 * positioned child with defined insets against the parent's PADDING BOX (its
 * border, not its padding — `AbsoluteLayout.cpp`), so these insets measure from
 * just inside the row's ink outline. The right inset therefore has to clear the
 * row's own `paddingHorizontal` as well as the trigger, which is exactly what
 * `triggerClearance`'s gap buys.
 */
export const ACTION_PANEL_INSETS = {
	// One step, not two: the panel fills the row it covers, and the row's
	// floor drops from 78 to 70 — build 179's ledger density. (2026-09-14)
	top: SPACE.xs,
	bottom: SPACE.xs,
	left: ACTION_PANEL_CHROME.panelInset[0],
	right: sum([
		ACTION_PANEL_CHROME.panelInset[1],
		...ACTION_PANEL_CHROME.triggerClearance,
	]),
} as const;

export interface ActionPanelGeometry {
	/** The panel's outer width — what `onLayout` measures. */
	panelWidth: number;
	/** One cell's outer width. Must never fall under `TAP_MIN`. */
	cellWidth: number;
	/**
	 * What is left of a cell for its label once the cell's own outline and pad
	 * are spent — the box a one-word label has to fit inside at full size. The
	 * narrowest supported phone (375pt) leaves 39.8pt, which is the number the
	 * tier's `labelRole` is chosen against.
	 */
	cellContentWidth: number;
}

/**
 * What the panel's styles imply at a given window width. Pure, and used for
 * layout nowhere — flex lays the cells out; this is the assertion surface.
 */
export function actionPanelGeometry(windowWidth: number): ActionPanelGeometry {
	const panelWidth =
		windowWidth -
		sum([
			...ACTION_PANEL_CHROME.pageGutter,
			...ACTION_PANEL_CHROME.rowBorder,
			...ACTION_PANEL_CHROME.panelInset,
			...ACTION_PANEL_CHROME.triggerClearance,
		]);
	const inner =
		panelWidth -
		sum([
			...ACTION_PANEL_CHROME.panelBorder,
			...ACTION_PANEL_CHROME.panelPad,
		]);
	const cellWidth =
		(inner - sum(ACTION_PANEL_CHROME.cellGaps)) / ACTION_PANEL_CELLS;
	const cellContentWidth =
		cellWidth -
		sum([...ACTION_PANEL_CHROME.cellBorder, ...ACTION_PANEL_CHROME.cellPad]);
	return { panelWidth, cellWidth, cellContentWidth };
}

/**
 * How far the panel travels on its way in and out — from the trigger's side,
 * fading as it goes. Deliberately SHORTER than the right inset: the panel then
 * never reaches the trigger or the card's edge mid-motion, so nothing needs a
 * clip and nothing is ever cut off. A full-width slide (the first cut) had to
 * be clipped, and the clip is what the eye read as the panel "jiggling".
 * (2026-09-14)
 */
export const ACTION_PANEL_TRAVEL = SPACE.xxl;

/**
 * The row's floor height, stacked from the inside out so the panel's cells can
 * never be taller than the row that contains them. A cell's content is the art
 * box over the label line over the state line, with the two `SPACE.xxs` gaps
 * the cell's stack spends.
 */
export const ACTION_ROW_HEIGHT = {
	/** The row sticker's ink outline, top and bottom. */
	rowBorder: [BORDER.ink, BORDER.ink],
	/** The panel's inset inside it. */
	panelInset: [ACTION_PANEL_INSETS.top, ACTION_PANEL_INSETS.bottom],
	/** The panel's own outline. */
	panelBorder: [BORDER.ink, BORDER.ink],
	/** The panel's inner padding. */
	panelPad: [SPACE.xs, SPACE.xs],
	/** One cell's outline. */
	cellBorder: [BORDER.ink, BORDER.ink],
	/** One cell's inner padding. */
	cellPad: [SPACE.xxs, SPACE.xxs],
	/** The cell's stack: art over label, and the one gap between them. */
	cellContent: [
		ACTION_CELL_TIER.regular.glyph,
		TYPE.label.lineHeight,
		SPACE.xxs,
	],
} as const;

/** `minHeight` for a friend row, so the open panel always fits inside it. */
export const ROW_MIN_H = sum(
	Object.values(ACTION_ROW_HEIGHT).flatMap((part) => [...part])
);
