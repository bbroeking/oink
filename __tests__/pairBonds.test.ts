// Pair bonds module — covers the bondBreakdown formatter (singular/plural +
// zero-drop) and confirms each typed wrapper calls the right RPC with the right
// param shape. Same testing style as friendships.test.ts: mock supabase at the
// boundary, exercise the pure module.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn() },
}));

import { bondBreakdown, pairLeaderboard, pairBondWith } from "../utils/pairBonds";

describe("bondBreakdown", () => {
	it("pluralizes each component and joins with a middot", () => {
		expect(bondBreakdown({ trades: 12, blessings: 8, visits: 5 })).toBe(
			"12 trades · 8 blessings · 5 visits"
		);
	});

	it("uses singular for a count of 1", () => {
		expect(bondBreakdown({ trades: 1, blessings: 1, visits: 1 })).toBe(
			"1 trade · 1 blessing · 1 visit"
		);
	});

	it("drops zero-count components entirely", () => {
		expect(bondBreakdown({ trades: 3, blessings: 0, visits: 0 })).toBe(
			"3 trades"
		);
		expect(bondBreakdown({ trades: 0, blessings: 2, visits: 1 })).toBe(
			"2 blessings · 1 visit"
		);
	});

	it("returns an empty string when every component is zero", () => {
		expect(bondBreakdown({ trades: 0, blessings: 0, visits: 0 })).toBe("");
	});
});

describe("typed wrappers", () => {
	beforeEach(() => mockRpc.mockReset());

	it("pairLeaderboard passes p_limit and defaults to 25", async () => {
		mockRpc.mockResolvedValue({ data: { ok: true, pairs: [], you: null }, error: null });
		await pairLeaderboard();
		expect(mockRpc).toHaveBeenCalledWith("pair_leaderboard", { p_limit: 25 });
		await pairLeaderboard(10);
		expect(mockRpc).toHaveBeenLastCalledWith("pair_leaderboard", { p_limit: 10 });
	});

	it("pairBondWith passes p_other", async () => {
		mockRpc.mockResolvedValue({
			data: { ok: true, trades: 0, blessings: 0, visits: 0, bond: 0 },
			error: null,
		});
		await pairBondWith("friend-uuid");
		expect(mockRpc).toHaveBeenCalledWith("pair_bond_with", { p_other: "friend-uuid" });
	});
});
