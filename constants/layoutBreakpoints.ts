// Phone width tiers — the one place a layout is allowed to ask "how wide is
// this phone?".
//
// The friend row's quick-option tray is an OVERLAY: it slides in over the name
// column and never changes the row's height, so a narrow phone does not get a
// different grid, it gets a tighter *type* tier. Two tiers, named here so the
// row's styles and `__tests__/friendRowLayout.test.ts` read the same numbers.
//
// `utils/adaptiveLayout.ts` does not exist — `__tests__/adaptiveLayout.test.ts`
// is a source-scan guardrail (every geometry reads `useWindowDimensions`), not
// a module. This file is the module that guardrail implies. (2026-09-12)

/**
 * Below this the row is "narrow" — iPhone SE / mini / 13 mini territory, where
 * a 12pt `label` under a 20pt glyph in a quarter-width cell starts truncating.
 */
export const PHONE_NARROW_MAX = 390;

/** The wide tier starts here (Plus / Pro Max). Kept for callers that want it. */
export const PHONE_WIDE_MIN = 430;

export type RowDensity = "narrow" | "regular";

/** Which type tier this window width gets. */
export function rowDensity(width: number): RowDensity {
	return width < PHONE_NARROW_MAX ? "narrow" : "regular";
}

export interface TrayCellTier {
	/** The `TYPE` role the cell's label speaks in. */
	labelRole: "kickerPillSm" | "label";
	/** Art size for the cell's glyph — a drawing box, not a spacing step. */
	glyph: number;
	/**
	 * Whether the cell has room for its one-word state line under the label.
	 * Narrow cells carry that copy in the accessibility hint only — at 10pt
	 * with the kicker's 1.6 tracking, a sixth letter does not fit a 44pt cell.
	 */
	sub: boolean;
}

export const TRAY_CELL_TIER: Record<RowDensity, TrayCellTier> = {
	narrow: { labelRole: "kickerPillSm", glyph: 18, sub: false },
	regular: { labelRole: "label", glyph: 20, sub: true },
};

/** The friend-row tray's cell type tier for a given window width. */
export function trayCellTier(width: number): TrayCellTier {
	return TRAY_CELL_TIER[rowDensity(width)];
}
