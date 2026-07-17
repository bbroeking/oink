// Tickle breakdown module (spec 17) — covers the pure receipt-row mapper
// (lane→row order + labels, zero-row omission, negative/residual clamping) and
// confirms the fail-soft wrapper calls tickle_breakdown with the right param.
// Same style as pairBonds.test.ts: mock supabase at the boundary.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn(), warn: jest.fn() },
}));

import {
	tickleBreakdownRows,
	fetchTickleBreakdown,
	type TickleBreakdown,
} from "../utils/tickleBreakdown";

// A fully-loaded receipt (mirrors the harness fixture's numbers).
const full: TickleBreakdown = {
	total: 207,
	boundary: "2026-07-12T00:00:00Z",
	home_taps: 9,
	visit_taps: 2,
	dig_finds: 15,
	pass_tiers: 150,
	trades: 16,
	lucky: 15,
};

describe("tickleBreakdownRows", () => {
	it("maps every non-zero lane to a row in receipt order with whimsy labels", () => {
		const rows = tickleBreakdownRows(full);
		expect(rows.map((r) => r.lane)).toEqual([
			"home_taps",
			"visit_taps",
			"dig_finds",
			"pass_tiers",
			"trades",
			"lucky",
		]);
		expect(rows.map((r) => r.label)).toEqual([
			"tickled at home",
			"out visiting friends",
			"truffle digs",
			"season pass",
			"trades repaid",
			"lucky numbers",
		]);
		expect(rows.map((r) => r.value)).toEqual([9, 2, 15, 150, 16, 15]);
	});

	it("omits zero-value lanes (no 'truffle digs · 0' noise)", () => {
		const rows = tickleBreakdownRows({
			...full,
			dig_finds: 0,
			trades: 0,
			lucky: 0,
		});
		expect(rows.map((r) => r.lane)).toEqual([
			"home_taps",
			"visit_taps",
			"pass_tiers",
		]);
	});

	it("returns no rows when every lane is zero (a fresh pig)", () => {
		expect(
			tickleBreakdownRows({
				total: 0,
				boundary: null,
				home_taps: 0,
				visit_taps: 0,
				dig_finds: 0,
				pass_tiers: 0,
				trades: 0,
				lucky: 0,
			})
		).toEqual([]);
	});

	it("clamps a negative lane (defensive residual floor) to nothing", () => {
		// The server floors home_taps at 0, but the client mirrors that defensively:
		// a negative value never renders a row.
		const rows = tickleBreakdownRows({ ...full, home_taps: -5 });
		expect(rows.find((r) => r.lane === "home_taps")).toBeUndefined();
		expect(rows[0].lane).toBe("visit_taps");
	});

	it("truncates fractional lane values to whole tickles", () => {
		const rows = tickleBreakdownRows({ ...full, visit_taps: 2.9 });
		expect(rows.find((r) => r.lane === "visit_taps")?.value).toBe(2);
	});
});

describe("fetchTickleBreakdown", () => {
	beforeEach(() => mockRpc.mockReset());

	it("calls tickle_breakdown with the p_user param", async () => {
		mockRpc.mockResolvedValue({ data: full, error: null });
		const out = await fetchTickleBreakdown("pig-1");
		expect(mockRpc).toHaveBeenCalledWith("tickle_breakdown", { p_user: "pig-1" });
		expect(out).toEqual(full);
	});

	it("returns null (fail-soft) when the RPC errors — the dark-server path", async () => {
		mockRpc.mockResolvedValue({
			data: null,
			error: { code: "PGRST202", message: "Could not find the function" },
		});
		expect(await fetchTickleBreakdown("pig-1")).toBeNull();
	});
});
