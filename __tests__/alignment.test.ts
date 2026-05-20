// First unit-test in the project. Establishes the jest pattern other
// tests will follow:
//   - colocated in __tests__/ (default jest-expo discovery)
//   - file name <module>.test.ts
//   - import from ../utils/<module>
//
// The thresholds tested here MUST match
// supabase/migrations/20260521000000_alignment.sql exactly. If you
// change the constants here, change the SQL CASE statement too.

import {
	alignmentLabel,
	alignmentDisplay,
	alignmentEmblem,
	alignmentColorKey,
	ALIGNMENT_ANGEL_THRESHOLD,
	ALIGNMENT_GOBLIN_THRESHOLD,
} from "../utils/alignment";

describe("alignmentLabel", () => {
	test("zero is neutral", () => {
		expect(alignmentLabel(0)).toBe("neutral");
	});

	test("exact angel threshold (+34) is angel", () => {
		expect(alignmentLabel(ALIGNMENT_ANGEL_THRESHOLD)).toBe("angel");
		expect(alignmentLabel(34)).toBe("angel");
	});

	test("one below angel threshold (+33) is neutral", () => {
		expect(alignmentLabel(33)).toBe("neutral");
	});

	test("exact goblin threshold (-34) is goblin", () => {
		expect(alignmentLabel(ALIGNMENT_GOBLIN_THRESHOLD)).toBe("goblin");
		expect(alignmentLabel(-34)).toBe("goblin");
	});

	test("one above goblin threshold (-33) is neutral", () => {
		expect(alignmentLabel(-33)).toBe("neutral");
	});

	test("max positive (+100) is angel", () => {
		expect(alignmentLabel(100)).toBe("angel");
	});

	test("max negative (-100) is goblin", () => {
		expect(alignmentLabel(-100)).toBe("goblin");
	});

	test("scores well past clamp range still classify correctly", () => {
		// SQL clamps, but if a bug ever lets an out-of-range score
		// reach the client we want classification to still produce
		// the intuitive answer rather than fall through to neutral.
		expect(alignmentLabel(9999)).toBe("angel");
		expect(alignmentLabel(-9999)).toBe("goblin");
	});
});

describe("alignmentDisplay", () => {
	test("each label maps to a friendly noun", () => {
		expect(alignmentDisplay("angel")).toBe("Generous");
		expect(alignmentDisplay("goblin")).toBe("Greedy");
		expect(alignmentDisplay("neutral")).toBe("Pilgrim");
	});
});

describe("alignmentEmblem", () => {
	test("each label maps to a single-glyph emoji", () => {
		expect(alignmentEmblem("angel")).toBe("😇");
		expect(alignmentEmblem("goblin")).toBe("👹");
		expect(alignmentEmblem("neutral")).toBe("⚖️");
	});
});

describe("alignmentColorKey", () => {
	test("each label maps to a theme color key", () => {
		expect(alignmentColorKey("angel")).toBe("sun");
		expect(alignmentColorKey("goblin")).toBe("moss");
		expect(alignmentColorKey("neutral")).toBe("paper");
	});
});

describe("integration: label drives display + emblem consistently", () => {
	const cases = [
		{ score: 50, display: "Generous", emblem: "😇" },
		{ score: 0, display: "Pilgrim", emblem: "⚖️" },
		{ score: -50, display: "Greedy", emblem: "👹" },
	];
	test.each(cases)(
		"score $score → $display ($emblem)",
		({ score, display, emblem }) => {
			const label = alignmentLabel(score);
			expect(alignmentDisplay(label)).toBe(display);
			expect(alignmentEmblem(label)).toBe(emblem);
		}
	);
});
