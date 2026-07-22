// The server-config-fed Field Guide value-line numbers (utils/fieldGuideConfig)
// — the review flagged this cell untested. Covers default parity with the
// compiled fallback, the sanitizer's per-field default-fill (it NEVER nulls,
// unlike feedingConfig), apply() change-detection, and the fail-soft fetch
// through the configCell primitive. This cell is cache-less + un-debounced by
// design, so refresh() fetches every call and never touches AsyncStorage — both
// asserted below. The cell lazy-requires the rpc chain; it's mocked at the
// module boundary here (same style as feedingConfig.test.ts).

const mockRpc = jest.fn();
jest.mock("../utils/rpc", () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }));

import {
	DEFAULT_FIELD_GUIDE_NUMBERS,
	applyFieldGuideNumbers,
	ensureFieldGuideNumbersFresh,
	fieldGuideNumbers,
	refreshFieldGuideNumbers,
	resetFieldGuideNumbersForTests,
	sanitizeFieldGuideNumbers,
} from "../utils/fieldGuideConfig";

// A full server row (snake_case) with every value moved off its default.
const row = (over: Record<string, unknown> = {}) => ({
	wrap_base_hours: 4,
	wrap_ceiling_hours: 16,
	lucky_daily_count: 5,
	lucky_payout: 7,
	exchange_min_price: 30,
	trough_seed_pct: 20,
	...over,
});

const rowExpect = {
	wrapBaseHours: 4,
	wrapCeilingHours: 16,
	luckyDailyCount: 5,
	luckyPayout: 7,
	exchangeMinPrice: 30,
	troughSeedPct: 20,
};

beforeEach(() => {
	mockRpc.mockReset();
	resetFieldGuideNumbersForTests();
});

afterEach(() => resetFieldGuideNumbersForTests());

describe("default parity — the module boots on the compiled fallback", () => {
	test("fieldGuideNumbers() === DEFAULT until something overrides", () => {
		expect(fieldGuideNumbers()).toEqual(DEFAULT_FIELD_GUIDE_NUMBERS);
	});
});

describe("sanitizeFieldGuideNumbers — per-field default-fill, never null", () => {
	test("a full valid row maps every snake_case field", () => {
		expect(sanitizeFieldGuideNumbers(row())).toEqual(rowExpect);
	});

	test("a non-object falls all the way back to the defaults", () => {
		expect(sanitizeFieldGuideNumbers(null)).toEqual(DEFAULT_FIELD_GUIDE_NUMBERS);
		expect(sanitizeFieldGuideNumbers("nope")).toEqual(
			DEFAULT_FIELD_GUIDE_NUMBERS
		);
	});

	test("a partial row keeps the defaults for the missing fields", () => {
		expect(sanitizeFieldGuideNumbers({ lucky_payout: 9 })).toEqual({
			...DEFAULT_FIELD_GUIDE_NUMBERS,
			luckyPayout: 9,
		});
	});

	test.each([
		["zero", 0],
		["negative", -3],
		["string", "8"],
	])("an out-of-bounds field (%s) keeps its default", (_name, bad) => {
		const sane = sanitizeFieldGuideNumbers(row({ wrap_base_hours: bad }));
		expect(sane.wrapBaseHours).toBe(DEFAULT_FIELD_GUIDE_NUMBERS.wrapBaseHours);
		// The other fields still take the row's valid values.
		expect(sane.luckyPayout).toBe(7);
	});
});

describe("applyFieldGuideNumbers — change detection", () => {
	test("a moved set applies and reports true", () => {
		expect(applyFieldGuideNumbers(rowExpect)).toBe(true);
		expect(fieldGuideNumbers()).toEqual(rowExpect);
	});

	test("re-applying identical values reports no change", () => {
		expect(applyFieldGuideNumbers({ ...DEFAULT_FIELD_GUIDE_NUMBERS })).toBe(
			false
		);
	});
});

describe("refreshFieldGuideNumbers — the fail-soft, un-debounced fetch", () => {
	test("applies a changed server row and reports the change", async () => {
		mockRpc.mockResolvedValue(row());
		await expect(refreshFieldGuideNumbers()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalledWith("app_setting", {
			p_key: "field_guide_numbers",
		});
		expect(fieldGuideNumbers()).toEqual(rowExpect);
	});

	test("null (rpc missing / no row) keeps the compiled fallback, no change", async () => {
		mockRpc.mockResolvedValue(null);
		await expect(refreshFieldGuideNumbers()).resolves.toBe(false);
		expect(fieldGuideNumbers()).toEqual(DEFAULT_FIELD_GUIDE_NUMBERS);
	});

	test("a malformed row degrades per-field to the defaults (never blanks a line)", async () => {
		mockRpc.mockResolvedValue(row({ trough_seed_pct: -1 }));
		await refreshFieldGuideNumbers();
		expect(fieldGuideNumbers().troughSeedPct).toBe(
			DEFAULT_FIELD_GUIDE_NUMBERS.troughSeedPct
		);
		expect(fieldGuideNumbers().luckyPayout).toBe(7); // valid fields still land
	});

	test("NOT debounced: consecutive refreshes both hit the RPC", async () => {
		mockRpc.mockResolvedValue(row());
		await refreshFieldGuideNumbers();
		await refreshFieldGuideNumbers();
		expect(mockRpc).toHaveBeenCalledTimes(2);
	});
});

describe("ensureFieldGuideNumbersFresh — the mount/reveal freshen beat", () => {
	test("returns the current numbers now and kicks a background fetch", async () => {
		mockRpc.mockResolvedValue(row());
		expect(ensureFieldGuideNumbersFresh()).toEqual(DEFAULT_FIELD_GUIDE_NUMBERS);
		await Promise.resolve();
		await Promise.resolve();
		expect(mockRpc).toHaveBeenCalledWith("app_setting", {
			p_key: "field_guide_numbers",
		});
	});
});
