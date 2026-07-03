// Unit tests for the pure Hungerer-meter stage mappers. The threshold
// SHAPE (5 boundaries → 6 stages) must match hunger_meter() in
// supabase/migrations/20260704200000_hunger_meter.sql — the server owns the
// real boundary values; these mirrors are display-only.

// hooks/useHungerMeter imports the rpc → supabase chain (AsyncStorage native
// module), which the jest renderer can't load. Stub it the same way
// mudWars.test.ts does — these tests only touch the pure helpers.
jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import {
	HUNGER_STAGES,
	HUNGER_STAGE_LINE,
	stageForIndex,
	stageIndexForTotal,
} from "../hooks/useHungerMeter";

// The server's placeholder boundaries (20260704200000) — shape check only.
const THRESHOLDS = [40, 100, 200, 340, 520];

describe("stageForIndex", () => {
	it("maps each index to its stage in order", () => {
		expect(stageForIndex(0)).toBe("gorged");
		expect(stageForIndex(1)).toBe("stuffed");
		expect(stageForIndex(2)).toBe("full");
		expect(stageForIndex(3)).toBe("peckish");
		expect(stageForIndex(4)).toBe("hungry");
		expect(stageForIndex(5)).toBe("famished");
	});

	it("clamps out-of-range and fractional indexes", () => {
		expect(stageForIndex(-3)).toBe("gorged");
		expect(stageForIndex(99)).toBe("famished");
		expect(stageForIndex(2.9)).toBe("full");
	});
});

describe("stageIndexForTotal", () => {
	it("starts gorged at zero", () => {
		expect(stageIndexForTotal(0, THRESHOLDS)).toBe(0);
	});

	it("advances exactly at each boundary (inclusive)", () => {
		expect(stageIndexForTotal(39, THRESHOLDS)).toBe(0);
		expect(stageIndexForTotal(40, THRESHOLDS)).toBe(1);
		expect(stageIndexForTotal(99, THRESHOLDS)).toBe(1);
		expect(stageIndexForTotal(100, THRESHOLDS)).toBe(2);
		expect(stageIndexForTotal(200, THRESHOLDS)).toBe(3);
		expect(stageIndexForTotal(340, THRESHOLDS)).toBe(4);
		expect(stageIndexForTotal(520, THRESHOLDS)).toBe(5);
	});

	it("never exceeds the famished index however big the total", () => {
		expect(stageIndexForTotal(1_000_000, THRESHOLDS)).toBe(5);
	});
});

describe("stage copy", () => {
	it("has a whisper line for every stage (no stage renders blank)", () => {
		for (const s of HUNGER_STAGES) {
			expect(HUNGER_STAGE_LINE[s].length).toBeGreaterThan(0);
		}
	});
});
