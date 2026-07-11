// Pure-logic tests for the herd dig-milestone mapper (utils/dig.milestoneProgress):
// lifetime herd finds → earned/next title + within-band progress. Thresholds
// (150 / 600 / 1800) and titles mirror the server milestone table.

// utils/dig imports the rpc → supabase chain (AsyncStorage native module) via
// fetchFeedingState; stub it the same way the rooting/hungerMeter tests do —
// these tests only touch the pure helper.
jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import { milestoneProgress, MILESTONE_TITLES } from "../utils/dig";
import { MILESTONE_THRESHOLDS } from "../constants/dig";

describe("milestoneProgress", () => {
	it("starts with nothing earned and points at the first title", () => {
		const m = milestoneProgress(0);
		expect(m.earnedTitle).toBeNull();
		expect(m.earnedThreshold).toBeNull();
		expect(m.nextThreshold).toBe(150);
		expect(m.nextTitle).toBe("Root Rustler");
		expect(m.pct).toBe(0);
		expect(m.allDone).toBe(false);
	});

	it("reads within-band progress toward the next milestone", () => {
		// 75/150 to Root Rustler → halfway, from a floor of 0.
		expect(milestoneProgress(75).pct).toBeCloseTo(0.5);
		// Root Rustler earned (floor 150), 300 more toward 600 → half of the band.
		const m = milestoneProgress(150 + (600 - 150) / 2);
		expect(m.earnedTitle).toBe("Root Rustler");
		expect(m.nextTitle).toBe("Truffle Baron");
		expect(m.pct).toBeCloseTo(0.5);
	});

	it("advances exactly at each threshold (inclusive)", () => {
		expect(milestoneProgress(149).earnedThreshold).toBeNull();
		expect(milestoneProgress(150).earnedThreshold).toBe(150);
		expect(milestoneProgress(600).earnedTitle).toBe("Truffle Baron");
		expect(milestoneProgress(1800).earnedTitle).toBe("Hunger's Bane");
	});

	it("caps out at the final milestone (allDone)", () => {
		const m = milestoneProgress(5000);
		expect(m.earnedTitle).toBe("Hunger's Bane");
		expect(m.nextThreshold).toBeNull();
		expect(m.nextTitle).toBeNull();
		expect(m.pct).toBe(1);
		expect(m.allDone).toBe(true);
	});

	it("clamps junk input (negatives / NaN) to zero finds", () => {
		expect(milestoneProgress(-40).lifetimeFinds).toBe(0);
		expect(milestoneProgress(NaN).lifetimeFinds).toBe(0);
	});

	it("has a title for every threshold in the shared constant", () => {
		for (const t of MILESTONE_THRESHOLDS) {
			expect(MILESTONE_TITLES[t].length).toBeGreaterThan(0);
		}
	});
});
