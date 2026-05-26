// Pure helpers for the receiver-side effects layer. The hook
// (useActiveEffects) composes these; tests exercise them directly
// so cast/sort/format regressions surface without a React mount.

import {
	type Effect,
	fetchActiveEffects,
	partitionBySource,
	formatLeft,
} from "../utils/activeEffects";

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const blessing = (kind: string, expires_at: string): Effect => ({
	source: "blessing",
	kind,
	expires_at,
	sender_id: null,
	sender_username: null,
});
const curse = (kind: string, expires_at: string): Effect => ({
	source: "curse",
	kind,
	expires_at,
	sender_id: null,
	sender_username: null,
});

describe("formatLeft", () => {
	const NOW = new Date("2026-05-21T12:00:00Z").getTime();
	let nowSpy: jest.SpyInstance;
	beforeEach(() => {
		nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW);
	});
	afterEach(() => {
		nowSpy.mockRestore();
	});

	test("returns 'expiring' when the timestamp is past", () => {
		expect(formatLeft("2026-05-21T11:00:00Z")).toBe("expiring");
	});

	test("returns 'expiring' at exact equality", () => {
		expect(formatLeft("2026-05-21T12:00:00Z")).toBe("expiring");
	});

	test("renders minutes when under an hour", () => {
		// +5 minutes
		expect(formatLeft("2026-05-21T12:05:00Z")).toBe("5m");
	});

	test("renders hours-only when minute remainder is zero", () => {
		// +2 hours flat
		expect(formatLeft("2026-05-21T14:00:00Z")).toBe("2h");
	});

	test("renders hours + minutes mixed", () => {
		// +2h 14m
		expect(formatLeft("2026-05-21T14:14:00Z")).toBe("2h 14m");
	});

	test("appends ' left' when withSuffix=true", () => {
		expect(formatLeft("2026-05-21T12:05:00Z", true)).toBe("5m left");
		expect(formatLeft("2026-05-21T14:00:00Z", true)).toBe("2h left");
		expect(formatLeft("2026-05-21T14:14:00Z", true)).toBe("2h 14m left");
	});

	test("'expiring' is not suffixed", () => {
		expect(formatLeft("2026-05-21T11:00:00Z", true)).toBe("expiring");
	});
});

describe("partitionBySource", () => {
	test("empty array → empty partitions", () => {
		expect(partitionBySource([])).toEqual({ blessings: [], curses: [] });
	});

	test("splits a mixed list, preserving order within each side", () => {
		const e: Effect[] = [
			blessing("halo_kiss", "2026-05-22T00:00:00Z"),
			curse("sluggish_snout", "2026-05-22T01:00:00Z"),
			blessing("golden_hour", "2026-05-22T02:00:00Z"),
		];
		const { blessings, curses } = partitionBySource(e);
		expect(blessings).toHaveLength(2);
		expect(curses).toHaveLength(1);
		expect(blessings[0].kind).toBe("halo_kiss");
		expect(blessings[1].kind).toBe("golden_hour");
		expect(curses[0].kind).toBe("sluggish_snout");
	});

	test("all blessings → empty curses", () => {
		const e = [blessing("halo_kiss", "2026-05-22T00:00:00Z")];
		expect(partitionBySource(e).curses).toEqual([]);
	});
});

describe("fetchActiveEffects", () => {
	beforeEach(() => {
		mockRpc.mockReset();
	});

	test("returns [] when RPC returns null data", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		expect(await fetchActiveEffects()).toEqual([]);
	});

	test("returns [] when RPC returns empty array", async () => {
		mockRpc.mockResolvedValue({ data: [], error: null });
		expect(await fetchActiveEffects()).toEqual([]);
	});

	test("sorts blessings before curses", async () => {
		mockRpc.mockResolvedValue({
			data: [
				curse("sluggish_snout", "2026-05-22T01:00:00Z"),
				blessing("halo_kiss", "2026-05-22T00:00:00Z"),
				curse("goblin_whisper", "2026-05-22T02:00:00Z"),
				blessing("golden_hour", "2026-05-22T03:00:00Z"),
			],
			error: null,
		});
		const rows = await fetchActiveEffects();
		expect(rows.map((r) => r.source)).toEqual([
			"blessing",
			"blessing",
			"curse",
			"curse",
		]);
	});

	test("calls the right RPC name", async () => {
		mockRpc.mockResolvedValue({ data: [], error: null });
		await fetchActiveEffects();
		// Second arg is undefined now that the call routes through rpc<T>().
		expect(mockRpc).toHaveBeenCalledWith("my_active_effects", undefined);
	});
});
