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
	alignmentIcon,
	alignmentColorKey,
	ALIGNMENT_ANGEL_THRESHOLD,
	ALIGNMENT_GOBLIN_THRESHOLD,
} from "../utils/alignment";

describe("alignmentLabel", () => {
	test("zero is neutral", () => {
		expect(alignmentLabel(0)).toBe("neutral");
	});

	test("exact angel threshold (+25) is angel", () => {
		expect(alignmentLabel(ALIGNMENT_ANGEL_THRESHOLD)).toBe("angel");
		expect(alignmentLabel(25)).toBe("angel");
	});

	test("one below angel threshold (+24) is neutral", () => {
		expect(alignmentLabel(24)).toBe("neutral");
	});

	test("exact goblin threshold (-25) is goblin", () => {
		expect(alignmentLabel(ALIGNMENT_GOBLIN_THRESHOLD)).toBe("goblin");
		expect(alignmentLabel(-25)).toBe("goblin");
	});

	test("one above goblin threshold (-24) is neutral", () => {
		expect(alignmentLabel(-24)).toBe("neutral");
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

describe("alignmentIcon", () => {
	test("each label maps to its Icon name", () => {
		expect(alignmentIcon("angel")).toBe("halo");
		expect(alignmentIcon("goblin")).toBe("horns");
		expect(alignmentIcon("neutral")).toBe("scales");
	});
});

describe("alignmentColorKey", () => {
	test("each label maps to a theme color key", () => {
		expect(alignmentColorKey("angel")).toBe("sun");
		expect(alignmentColorKey("goblin")).toBe("moss");
		expect(alignmentColorKey("neutral")).toBe("paper");
	});
});

describe("integration: label drives display + icon consistently", () => {
	const cases = [
		{ score: 50, display: "Generous", icon: "halo" },
		{ score: 0, display: "Pilgrim", icon: "scales" },
		{ score: -50, display: "Greedy", icon: "horns" },
	];
	test.each(cases)(
		"score $score → $display ($icon)",
		({ score, display, icon }) => {
			const label = alignmentLabel(score);
			expect(alignmentDisplay(label)).toBe(display);
			expect(alignmentIcon(label)).toBe(icon);
		}
	);
});
