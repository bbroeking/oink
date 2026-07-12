// Pure-logic tests for lifetimeTickles(base, current) — the all-time lifetime
// display = archived-seasons base + live-season tickles (migration 20260737).

import { lifetimeTickles } from "../utils/tickles";

describe("lifetimeTickles", () => {
	it("sums the archived base and the live-season count", () => {
		expect(lifetimeTickles(500, 120)).toBe(620);
	});

	it("returns just the live count when there is no archived base yet", () => {
		expect(lifetimeTickles(0, 42)).toBe(42);
	});

	it("returns just the base when the live season is at zero (post-graduation)", () => {
		expect(lifetimeTickles(500, 0)).toBe(500);
	});

	it("treats an absent base as 0 (feature-dark before the migration lands)", () => {
		expect(lifetimeTickles(undefined, 75)).toBe(75);
		expect(lifetimeTickles(null, 75)).toBe(75);
	});

	it("treats an absent current as 0", () => {
		expect(lifetimeTickles(300, undefined)).toBe(300);
		expect(lifetimeTickles(300, null)).toBe(300);
	});

	it("is 0 when both inputs are missing", () => {
		expect(lifetimeTickles(null, null)).toBe(0);
		expect(lifetimeTickles(undefined, undefined)).toBe(0);
	});

	it("ignores NaN / non-finite inputs", () => {
		expect(lifetimeTickles(NaN, 10)).toBe(10);
		expect(lifetimeTickles(10, Infinity)).toBe(10);
	});

	it("clamps negative inputs to 0", () => {
		expect(lifetimeTickles(-5, 10)).toBe(10);
		expect(lifetimeTickles(10, -5)).toBe(10);
	});
});
