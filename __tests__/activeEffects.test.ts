// Pure helpers for the receiver-side effects layer. The hook
// (useActiveEffects) composes these; tests exercise them directly
// so cast/sort/format regressions surface without a React mount.

import {
	type Effect,
	effectMeta,
	fetchActiveEffects,
	partitionBySource,
	formatLeft,
	toEffectCardEffect,
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
			blessing("cloud_nine", "2026-05-22T00:00:00Z"),
			curse("pickle_brine", "2026-05-22T01:00:00Z"),
			blessing("golden_hour", "2026-05-22T02:00:00Z"),
		];
		const { blessings, curses } = partitionBySource(e);
		expect(blessings).toHaveLength(2);
		expect(curses).toHaveLength(1);
		expect(blessings[0].kind).toBe("cloud_nine");
		expect(blessings[1].kind).toBe("golden_hour");
		expect(curses[0].kind).toBe("pickle_brine");
	});

	test("all blessings → empty curses", () => {
		const e = [blessing("cloud_nine", "2026-05-22T00:00:00Z")];
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
				curse("pickle_brine", "2026-05-22T01:00:00Z"),
				blessing("cloud_nine", "2026-05-22T00:00:00Z"),
				curse("hiccups", "2026-05-22T02:00:00Z"),
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

describe("effectMeta", () => {
	test("names a live blessing off BLESSING_META", () => {
		const { blessed, meta } = effectMeta(
			blessing("golden_hour", "2026-05-22T00:00:00Z")
		);
		expect(blessed).toBe(true);
		expect(meta?.name).toBe("Golden Hour");
		expect(meta?.icon).toBeTruthy();
	});

	test("names a live curse off CURSE_META", () => {
		const { blessed, meta } = effectMeta(
			curse("bacon_bits", "2026-05-22T00:00:00Z")
		);
		expect(blessed).toBe(false);
		expect(meta?.name).toBe("Bacon Bits");
	});

	test("a row cast under a RETIRED kind still has its old name and icon", () => {
		// The twelve-hour overlap after the weekday rotation shipped: the kind
		// is gone from the rotation but the effect is still on the pig.
		const old = effectMeta(blessing("mud_wrap", "2026-05-22T00:00:00Z"));
		expect(old.meta?.name).toBe("Mud Wrap");
		expect(old.meta?.icon).toBeTruthy();

		const oldCurse = effectMeta(curse("phantom_itch", "2026-05-22T00:00:00Z"));
		expect(oldCurse.meta?.name).toBe("Phantom Itch");
	});

	test("a kind from neither table has no meta, and the card falls back", () => {
		const e = blessing("something_new", "2026-05-22T00:00:00Z");
		expect(effectMeta(e).meta).toBeUndefined();
		expect(toEffectCardEffect(e).name).toBe("something_new");
	});

	test("the sender label falls back per source", () => {
		expect(
			effectMeta(blessing("golden_hour", "2026-05-22T00:00:00Z")).senderName
		).toBe("a friend");
		expect(
			effectMeta(curse("bacon_bits", "2026-05-22T00:00:00Z")).senderName
		).toBe("someone");
	});
});
