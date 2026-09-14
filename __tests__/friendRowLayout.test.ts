// The friend row's width tiers, and the geometry of the actions panel.
//
// The row's actions live in ONE anchored panel the "…" trigger opens — five
// cells sliding over the name column — so a narrow phone does not get a
// different GRID, it gets a tighter type tier. Two tiers, one boundary, and the
// state line is the thing that yields.
//
// The second half of this file is the overflow proof. Flex lays the cells out;
// `actionPanelGeometry` is the same sum written down, so the numbers the styles
// imply can be asserted rather than eyeballed on a screenshot.

import fs from "node:fs";
import path from "node:path";

import {
	ACTION_CELL_TIER,
	ACTION_PANEL_CELLS,
	ACTION_PANEL_CHROME,
	ACTION_PANEL_INSETS,
	ACTION_ROW_HEIGHT,
	PHONE_NARROW_MAX,
	PHONE_WIDE_MIN,
	ROW_MIN_H,
	actionCellTier,
	actionPanelGeometry,
	actionPanelSlideFrom,
	rowDensity,
} from "@/constants/layoutBreakpoints";
import { SPACE, TAP_MIN, TYPE } from "@/constants/theme";

const sum = (parts: readonly number[]) => parts.reduce((a, b) => a + b, 0);

describe("friend-row width tiers", () => {
	test.each([
		[320, "narrow"], // iPhone SE (1st gen)
		[375, "narrow"], // SE 2/3, 13 mini
		[389, "narrow"], // the last narrow point
		[390, "regular"], // iPhone 14 / 15 / 16
		[393, "regular"],
		[430, "regular"], // Pro Max — same tier, the panel never changes shape
		[744, "regular"], // iPad mini in a phone-shaped layout
	])("%ipt is the %s tier", (width, density) => {
		expect(rowDensity(width)).toBe(density);
	});

	test("the boundary is exclusive on the narrow side", () => {
		expect(rowDensity(PHONE_NARROW_MAX - 1)).toBe("narrow");
		expect(rowDensity(PHONE_NARROW_MAX)).toBe("regular");
		expect(PHONE_WIDE_MIN).toBeGreaterThan(PHONE_NARROW_MAX);
	});

	test("narrow shrinks the glyph and the label role, never the label", () => {
		const narrow = actionCellTier(375);
		expect(narrow).toEqual(ACTION_CELL_TIER.narrow);
		expect(narrow.labelRole).toBe("kickerPillSm");
		expect(narrow.glyph).toBe(18);
		// The state copy still reaches a screen reader through the cell's hint.
		expect(narrow.sub).toBe(false);
	});

	test("regular carries the label role and the 20pt glyph", () => {
		const regular = actionCellTier(393);
		expect(regular).toEqual(ACTION_CELL_TIER.regular);
		expect(regular.labelRole).toBe("label");
		expect(regular.glyph).toBe(20);
		// No tier draws the state line: it is what made the row 98pt tall.
		expect(regular.sub).toBe(false);
	});

	test("the tier only ever gets bigger as the window does", () => {
		let last = 0;
		for (let width = 280; width <= 900; width += 1) {
			const glyph = actionCellTier(width).glyph;
			expect(glyph).toBeGreaterThanOrEqual(last);
			last = glyph;
		}
	});
});

describe("the actions panel cannot overflow", () => {
	test("five cells still clear the tap floor on the narrowest phone", () => {
		// 375pt is the narrowest supported iPhone (SE 2/3, 13 mini).
		expect(actionPanelGeometry(375).cellWidth).toBeGreaterThanOrEqual(TAP_MIN);
		// 393pt is the 14/15/16 body, and 430 the Pro Max.
		expect(actionPanelGeometry(393).cellWidth).toBeGreaterThanOrEqual(TAP_MIN);
		expect(actionPanelGeometry(430).cellWidth).toBeGreaterThanOrEqual(TAP_MIN);
	});

	test("a cell only ever gets wider as the window does", () => {
		let lastCell = 0;
		let lastPanel = 0;
		for (let width = 320; width <= 900; width += 1) {
			const { panelWidth, cellWidth } = actionPanelGeometry(width);
			expect(cellWidth).toBeGreaterThanOrEqual(lastCell);
			expect(panelWidth).toBeGreaterThanOrEqual(lastPanel);
			lastCell = cellWidth;
			lastPanel = panelWidth;
		}
	});

	test("the panel width is the window less every edge outside a cell", () => {
		const outside = sum([
			...ACTION_PANEL_CHROME.pageGutter,
			...ACTION_PANEL_CHROME.rowBorder,
			...ACTION_PANEL_CHROME.panelInset,
			...ACTION_PANEL_CHROME.triggerClearance,
		]);
		expect(actionPanelGeometry(393).panelWidth).toBe(393 - outside);
		// Five cells plus four gaps fill the panel's inside exactly.
		const { panelWidth, cellWidth } = actionPanelGeometry(393);
		const inside = sum([
			...ACTION_PANEL_CHROME.panelBorder,
			...ACTION_PANEL_CHROME.panelPad,
		]);
		expect(
			cellWidth * ACTION_PANEL_CELLS + sum(ACTION_PANEL_CHROME.cellGaps)
		).toBeCloseTo(panelWidth - inside, 5);
	});

	test("the insets the styles spend are the insets the sum assumes", () => {
		expect(ACTION_PANEL_INSETS.left + ACTION_PANEL_INSETS.right).toBe(
			sum([
				...ACTION_PANEL_CHROME.panelInset,
				...ACTION_PANEL_CHROME.triggerClearance,
			])
		);
		// The right inset has to clear the 44pt trigger, or the panel would
		// slide over the control that opened it.
		expect(ACTION_PANEL_INSETS.right).toBeGreaterThan(TAP_MIN);
		expect(ACTION_PANEL_INSETS.top).toBe(ACTION_PANEL_CHROME.panelInset[0]);
		expect(ACTION_PANEL_INSETS.bottom).toBe(ACTION_PANEL_CHROME.panelInset[1]);
	});

	test("the slide starts fully off the row, plus a step", () => {
		expect(actionPanelSlideFrom(200)).toBeGreaterThan(200);
		expect(actionPanelSlideFrom(200)).toBe(200 + SPACE.sm);
	});

	test("the row's floor fits the tallest cell the panel can hold", () => {
		const parts = Object.values(ACTION_ROW_HEIGHT).flatMap((p) => [...p]);
		expect(ROW_MIN_H).toBeGreaterThanOrEqual(sum(parts));
		// The cell's stack is art over label — no state line on either tier, so
		// the floor stays near build 179's ledger row rather than a card's.
		expect(ACTION_ROW_HEIGHT.cellContent).toContain(
			ACTION_CELL_TIER.regular.glyph
		);
		expect(ACTION_ROW_HEIGHT.cellContent).toContain(TYPE.label.lineHeight);
		expect(ACTION_ROW_HEIGHT.cellContent).not.toContain(TYPE.kicker.lineHeight);
		expect(ROW_MIN_H).toBeLessThanOrEqual(80);
	});

	test("the row and the panel read their geometry from this module", () => {
		const source = fs.readFileSync(
			path.join(process.cwd(), "components/Friends.tsx"),
			"utf8"
		);
		// The panel's absolute insets, and the row's floor, are the exported
		// derivations — not a second set of numbers that can drift from them.
		const layer = source.slice(source.indexOf("\tactionPanelLayer: {"));
		const layerBody = layer.slice(0, layer.indexOf("},"));
		for (const edge of ["top", "bottom", "left", "right"]) {
			expect(layerBody).toContain(`${edge}: ACTION_PANEL_INSETS.${edge}`);
		}
		expect(source).toContain("friendRow: { minHeight: ROW_MIN_H }");
		// And the panel clips, so a cell can never paint past the outline.
		const panel = source.slice(source.indexOf("\tactionPanel: {"));
		expect(panel.slice(0, panel.indexOf("},"))).toContain(
			'overflow: "hidden"'
		);
	});
});
