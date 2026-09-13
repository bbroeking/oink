// The friend row's width tiers.
//
// The quick-option tray is an overlay pinned to the row's content box, so a
// narrow phone does not get a different GRID — it gets a tighter type tier. Two
// tiers, one boundary, and the state line is the thing that yields.

import {
	PHONE_NARROW_MAX,
	PHONE_WIDE_MIN,
	TRAY_CELL_TIER,
	rowDensity,
	trayCellTier,
} from "@/constants/layoutBreakpoints";

describe("friend-row width tiers", () => {
	test.each([
		[320, "narrow"], // iPhone SE (1st gen)
		[375, "narrow"], // SE 2/3, 13 mini
		[389, "narrow"], // the last narrow point
		[390, "regular"], // iPhone 14 / 15 / 16
		[393, "regular"],
		[430, "regular"], // Pro Max — same tier, the rail never changes
		[744, "regular"], // iPad mini in a phone-shaped layout
	])("%ipt is the %s tier", (width, density) => {
		expect(rowDensity(width)).toBe(density);
	});

	test("the boundary is exclusive on the narrow side", () => {
		expect(rowDensity(PHONE_NARROW_MAX - 1)).toBe("narrow");
		expect(rowDensity(PHONE_NARROW_MAX)).toBe("regular");
		expect(PHONE_WIDE_MIN).toBeGreaterThan(PHONE_NARROW_MAX);
	});

	test("narrow drops the state line and the glyph, never the label", () => {
		const narrow = trayCellTier(375);
		expect(narrow).toEqual(TRAY_CELL_TIER.narrow);
		expect(narrow.labelRole).toBe("kickerPillSm");
		expect(narrow.glyph).toBe(18);
		// The state copy still reaches a screen reader through the cell's hint.
		expect(narrow.sub).toBe(false);
	});

	test("regular carries the full cell", () => {
		const regular = trayCellTier(393);
		expect(regular).toEqual(TRAY_CELL_TIER.regular);
		expect(regular.labelRole).toBe("label");
		expect(regular.glyph).toBe(20);
		expect(regular.sub).toBe(true);
	});

	test("the tier only ever gets bigger as the window does", () => {
		let last = 0;
		for (let width = 280; width <= 900; width += 1) {
			const glyph = trayCellTier(width).glyph;
			expect(glyph).toBeGreaterThanOrEqual(last);
			last = glyph;
		}
	});
});
