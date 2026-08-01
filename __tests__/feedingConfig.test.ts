// The server-authoritative feeding schedule (utils/feedingConfig) — covers
// default parity with the compiled constants, override propagation into the
// utils/rooting window functions, the sanitizer's clamp rejections, cache
// hydration, and the fail-soft fetch. The module lazy-requires AsyncStorage +
// the rpc chain, so both are mocked at the module boundary here (same style as
// sounderPath.test.ts / crewState.test.ts).

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: (...a: unknown[]) => mockGetItem(...a),
		setItem: (...a: unknown[]) => mockSetItem(...a),
	},
}));
const mockRpc = jest.fn();
jest.mock("../utils/rpc", () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));

import {
	DEFAULT_FEEDING_SCHEDULE,
	applyFeedingSchedule,
	feedingSchedule,
	hydrateFeedingScheduleCache,
	refreshFeedingSchedule,
	resetFeedingScheduleForTests,
	sanitizeFeedingSchedule,
} from "../utils/feedingConfig";
import { patchPhaseOpen, windowEndsAtMs, windowIndex } from "../utils/rooting";
import {
	PATCH_OPEN_SECS,
	ROOTING_WINDOW_OFFSET_SECS,
	ROOTING_WINDOW_SECS,
} from "../constants/dig";

// The server row shape for a valid candidate schedule.
const row = (over: Record<string, unknown> = {}) => ({
	window_secs: 3600,
	open_secs: 1800,
	offset_secs: 600,
	...over,
});

beforeEach(() => {
	mockGetItem.mockReset();
	mockSetItem.mockReset();
	mockRpc.mockReset();
	resetFeedingScheduleForTests();
});

afterEach(() => resetFeedingScheduleForTests());

describe("default parity — the module boots on the compiled constants", () => {
	test("feedingSchedule() === the constants until something overrides", () => {
		expect(feedingSchedule()).toEqual({
			mode: "uniform",
			windowSecs: ROOTING_WINDOW_SECS,
			openSecs: PATCH_OPEN_SECS,
			offsetSecs: ROOTING_WINDOW_OFFSET_SECS,
		});
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);
	});
});

describe("legacy uniform schedule compatibility", () => {
	test("an explicit legacy schedule still drives the pure helpers", () => {
		// 1h windows, 30m open, 10m offset — tiny geometry, easy wall math.
		const changed = applyFeedingSchedule({
			windowSecs: 3600,
			openSecs: 1800,
			offsetSecs: 600,
		});
		expect(changed).toBe(true);

		const anchor = 600 * 1000; // first boundary of the new schedule
		const sched = feedingSchedule();
		expect(windowIndex(anchor, sched)).toBe(0);
		expect(windowIndex(anchor + 3600 * 1000, sched)).toBe(1);
		expect(windowEndsAtMs(0, sched)).toBe(anchor + 3600 * 1000);
		expect(patchPhaseOpen(anchor, sched)).toBe(true);
		expect(patchPhaseOpen(anchor + 1800 * 1000, sched)).toBe(false);
	});

	test("re-applying identical values reports no change", () => {
		expect(applyFeedingSchedule({ ...DEFAULT_FEEDING_SCHEDULE })).toBe(false);
	});

	test("an explicit sched param wins over the module (the test seam)", () => {
		const sched = { windowSecs: 100, openSecs: 50, offsetSecs: 0 };
		expect(windowIndex(100 * 1000, sched)).toBe(1);
		expect(patchPhaseOpen(49 * 1000, sched)).toBe(true);
		expect(patchPhaseOpen(50 * 1000, sched)).toBe(false);
	});
});

describe("sanitizeFeedingSchedule — the clamp that guards the clocks", () => {
	test("a valid server row parses", () => {
		expect(sanitizeFeedingSchedule(row())).toEqual({
			mode: "uniform",
			windowSecs: 3600,
			openSecs: 1800,
			offsetSecs: 600,
		});
	});

	test.each([
		["null", null],
		["non-object", "28800"],
		["zero window", row({ window_secs: 0 })],
		["negative window", row({ window_secs: -28800 })],
		["zero open", row({ open_secs: 0 })],
		["open beyond window", row({ open_secs: 3601 })],
		["negative offset", row({ offset_secs: -1 })],
		["offset at window (must be < window)", row({ offset_secs: 3600 })],
		["string fields", row({ window_secs: "28800" })],
		["missing field", { window_secs: 28800, open_secs: 14400 }],
	])("rejects %s", (_name, raw) => {
		expect(sanitizeFeedingSchedule(raw)).toBeNull();
	});

	test("open === window is allowed (an always-open patch is a valid dial)", () => {
		expect(sanitizeFeedingSchedule(row({ open_secs: 3600 }))).not.toBeNull();
	});

	test("accepts the server-owned commuter activation shape", () => {
		expect(sanitizeFeedingSchedule({ mode: "commuter_eastern" })).toMatchObject({
			mode: "commuter_eastern",
		});
	});
});

describe("cache hydration — a relaunch keeps the rolled-out clock", () => {
	test("a cached server row applies at hydrate", async () => {
		mockGetItem.mockResolvedValue(JSON.stringify(row()));
		await hydrateFeedingScheduleCache();
		expect(feedingSchedule().windowSecs).toBe(3600);
		expect(feedingSchedule().offsetSecs).toBe(600);
	});

	test("missing / corrupt / out-of-bounds cache keeps the defaults", async () => {
		mockGetItem.mockResolvedValue(null);
		await hydrateFeedingScheduleCache();
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);

		mockGetItem.mockResolvedValue("{not json");
		await hydrateFeedingScheduleCache();
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);

		mockGetItem.mockResolvedValue(JSON.stringify(row({ window_secs: 0 })));
		await hydrateFeedingScheduleCache();
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);
	});
});

describe("refreshFeedingSchedule — the server fetch", () => {
	test("applies + caches a changed server row and reports the change", async () => {
		mockRpc.mockResolvedValue(row());
		await expect(refreshFeedingSchedule()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalledWith("app_setting", {
			p_key: "feeding_schedule",
		});
		expect(feedingSchedule().windowSecs).toBe(3600);
		expect(mockSetItem).toHaveBeenCalled(); // persisted for the next launch
	});

	test("null (rpc missing / no row) keeps the current schedule, no change", async () => {
		mockRpc.mockResolvedValue(null);
		await expect(refreshFeedingSchedule()).resolves.toBe(false);
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);
	});

	test("a bad server row is rejected, defaults stand", async () => {
		mockRpc.mockResolvedValue(row({ open_secs: 999999 }));
		await expect(refreshFeedingSchedule()).resolves.toBe(false);
		expect(feedingSchedule()).toEqual(DEFAULT_FEEDING_SCHEDULE);
	});

	test("debounced: a second fetch inside the floor is a no-op", async () => {
		mockRpc.mockResolvedValue(row());
		await refreshFeedingSchedule();
		mockRpc.mockClear();
		await expect(refreshFeedingSchedule()).resolves.toBe(false);
		expect(mockRpc).not.toHaveBeenCalled();
	});
});
