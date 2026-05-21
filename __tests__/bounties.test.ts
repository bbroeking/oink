// Weekly-bounty rotation. The rotation index is (weekNum % 6); each
// week surfaces 3 consecutive bounties from the 6-pool. These tests
// pin the contract that the SQL my_weekly_bounties relies on.

import {
	BOUNTY_POOL,
	BOUNTY_POOL_SIZE,
	ACTIVE_BOUNTIES_PER_WEEK,
	activeBountyIndices,
	activeBountyCodes,
	activeBounties,
} from "../utils/bounties";

describe("BOUNTY_POOL", () => {
	test("has 6 entries with unique codes", () => {
		expect(BOUNTY_POOL_SIZE).toBe(6);
		expect(new Set(BOUNTY_POOL.map((b) => b.code)).size).toBe(6);
	});

	test("every entry has a positive goal + reward", () => {
		for (const b of BOUNTY_POOL) {
			expect(b.goal).toBeGreaterThan(0);
			expect(b.reward_snouts).toBeGreaterThan(0);
		}
	});
});

describe("activeBountyIndices", () => {
	test("returns exactly 3 indices", () => {
		for (let w = 0; w < 60; w++) {
			expect(activeBountyIndices(w)).toHaveLength(ACTIVE_BOUNTIES_PER_WEEK);
		}
	});

	test("the 3 indices are always distinct", () => {
		for (let w = 0; w < 60; w++) {
			expect(new Set(activeBountyIndices(w)).size).toBe(3);
		}
	});

	test("all indices are within the pool range", () => {
		for (let w = 0; w < 60; w++) {
			for (const i of activeBountyIndices(w)) {
				expect(i).toBeGreaterThanOrEqual(0);
				expect(i).toBeLessThan(BOUNTY_POOL_SIZE);
			}
		}
	});

	test("week 0 → [0,1,2]", () => {
		expect(activeBountyIndices(0)).toEqual([0, 1, 2]);
	});

	test("rotation wraps: week 5 → [5,0,1]", () => {
		expect(activeBountyIndices(5)).toEqual([5, 0, 1]);
	});

	test("rotation is periodic with period 6", () => {
		for (let w = 0; w < 30; w++) {
			expect(activeBountyIndices(w)).toEqual(activeBountyIndices(w + 6));
		}
	});

	test("handles ISO week numbers up to 53", () => {
		// 53 % 6 = 5 → [5,0,1]
		expect(activeBountyIndices(53)).toEqual([5, 0, 1]);
	});

	test("negative week numbers are normalized (defensive)", () => {
		// -1 should behave like 5 (mod 6) rather than producing a
		// negative index that would index undefined out of the pool.
		expect(activeBountyIndices(-1)).toEqual(activeBountyIndices(5));
	});

	test("over a 6-week span every bounty appears (full coverage)", () => {
		const seen = new Set<number>();
		for (let w = 0; w < 6; w++) {
			activeBountyIndices(w).forEach((i) => seen.add(i));
		}
		expect(seen.size).toBe(BOUNTY_POOL_SIZE);
	});
});

describe("activeBountyCodes / activeBounties", () => {
	test("codes match the pool entries at the active indices", () => {
		const w = 11;
		const idx = activeBountyIndices(w);
		expect(activeBountyCodes(w)).toEqual(idx.map((i) => BOUNTY_POOL[i].code));
	});

	test("activeBounties returns full defs in rotation order", () => {
		const defs = activeBounties(3);
		expect(defs).toHaveLength(3);
		expect(defs[0].code).toBe(BOUNTY_POOL[3].code);
	});
});
