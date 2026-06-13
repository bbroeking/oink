// Unit tests for the pure Mud-Fight helpers. The scoring/clamp values
// MUST match supabase/migrations/20260647000000_mud_fights.sql and
// constants/mudFights.ts — if you change a constant, change it there too.

// utils/mudWars imports the rpc → supabase chain (AsyncStorage native
// module), which the jest renderer can't load. Stub it the same way
// rpc.test.ts / activeEffects.test.ts do — these tests only touch the
// pure helpers, so the RPC surface is never called.
jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import {
	perCapita,
	ropePosition,
	formatCountdown,
	remainingToday,
} from "../utils/mudWars";
import { DAILY_ALLOTMENT } from "../constants/mudFights";

describe("perCapita", () => {
	test("total over active members, rounded to 1dp", () => {
		expect(perCapita(20, 2)).toBe(10);
		expect(perCapita(7, 2)).toBe(3.5);
		expect(perCapita(10, 3)).toBe(3.3);
	});
	test("zero or null active members → 0 (no divide-by-zero)", () => {
		expect(perCapita(5, 0)).toBe(0);
		expect(perCapita(5, null)).toBe(0);
		expect(perCapita(0, 0)).toBe(0);
	});
});

describe("ropePosition", () => {
	test("even → centered", () => {
		expect(ropePosition(10, 10)).toBe(0.5);
		expect(ropePosition(0, 0)).toBe(0.5);
	});
	test("one-sided → clamps to the edge", () => {
		expect(ropePosition(10, 0)).toBe(1);
		expect(ropePosition(0, 10)).toBe(0);
	});
	test("proportional in between", () => {
		expect(ropePosition(3, 1)).toBe(0.75);
		expect(ropePosition(1, 3)).toBe(0.25);
	});
});

describe("remainingToday", () => {
	test("counts down from the daily allotment", () => {
		expect(remainingToday(0)).toBe(DAILY_ALLOTMENT);
		expect(remainingToday(DAILY_ALLOTMENT)).toBe(0);
	});
	test("never negative even past the cap", () => {
		expect(remainingToday(DAILY_ALLOTMENT + 5)).toBe(0);
	});
});

describe("formatCountdown", () => {
	test("null / past → blank / ended", () => {
		expect(formatCountdown(null)).toBe("");
		expect(formatCountdown(new Date(Date.now() - 1000).toISOString())).toBe("ended");
	});
	test("minutes, hours, days", () => {
		const inMins = (m: number) => new Date(Date.now() + m * 60000 + 5000).toISOString();
		expect(formatCountdown(inMins(30))).toBe("30m");
		expect(formatCountdown(inMins(90))).toBe("1h 30m");
		expect(formatCountdown(inMins(60))).toBe("1h");
		expect(formatCountdown(inMins(60 * 24 * 2 + 60 * 3))).toBe("2d 3h");
	});
});
