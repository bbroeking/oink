// The server-tuned config-cell primitive (utils/configCell) — the shared
// lifecycle behind feedingConfig / fieldGuideConfig. Covers the contract every
// cell inherits: boots on the frozen fallback, a rejecting sanitizer keeps the
// current value, apply() change-detection, the opt-in debounce floor, the opt-in
// AsyncStorage cache (hydrate reads + refresh persists the RAW row), and the
// test-seam reset. The cell lazy-requires AsyncStorage + the rpc chain, so both
// are mocked at the module boundary here (same style as feedingConfig.test.ts).

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

import { createConfigCell } from "../utils/configCell";

interface Val {
	n: number;
}

const FALLBACK: Val = Object.freeze({ n: 1 });

// Sanitizer in the feedingConfig style: REJECTS (null) an out-of-bounds row, so
// a bad row keeps the current value.
function sanitizeStrict(raw: unknown): Val | null {
	if (raw == null || typeof raw !== "object") return null;
	const n = (raw as Record<string, unknown>).n;
	if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
	return { n: Math.floor(n) };
}

// A fully-featured cell (cache + debounce) — the feedingConfig shape.
function makeCachedCell() {
	return createConfigCell<Val>({
		key: "test_key",
		fallback: FALLBACK,
		sanitize: sanitizeStrict,
		cacheKey: "test_cache_v1",
		minRefreshMs: 5000,
	});
}

beforeEach(() => {
	mockGetItem.mockReset();
	mockSetItem.mockReset();
	mockRpc.mockReset();
});

describe("fallback — the cell boots on the frozen compiled default", () => {
	test("read() === the fallback until something overrides", () => {
		const cell = makeCachedCell();
		expect(cell.read()).toEqual({ n: 1 });
	});
});

describe("apply — change detection drives the changed signal", () => {
	test("a moved value applies and reports true", () => {
		const cell = makeCachedCell();
		expect(cell.apply({ n: 9 })).toBe(true);
		expect(cell.read()).toEqual({ n: 9 });
	});

	test("re-applying identical values reports no change", () => {
		const cell = makeCachedCell();
		expect(cell.apply({ n: 1 })).toBe(false);
		expect(cell.apply({ n: 7 })).toBe(true);
		expect(cell.apply({ n: 7 })).toBe(false);
	});
});

describe("refresh — the server fetch through app_setting", () => {
	test("applies + caches a changed row and reports the change", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue({ n: 42 });
		await expect(cell.refresh()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalledWith("app_setting", { p_key: "test_key" });
		expect(cell.read()).toEqual({ n: 42 });
		// Persists the RAW row (server shape), not the sanitized value.
		expect(mockSetItem).toHaveBeenCalledWith(
			"test_cache_v1",
			JSON.stringify({ n: 42 })
		);
	});

	test("null (rpc missing / no row) keeps the current value, no change", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue(null);
		await expect(cell.refresh()).resolves.toBe(false);
		expect(cell.read()).toEqual({ n: 1 });
	});

	test("a sanitizer REJECT keeps the current value, no change", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue({ n: -5 }); // rejected by sanitizeStrict
		await expect(cell.refresh()).resolves.toBe(false);
		expect(cell.read()).toEqual({ n: 1 });
		expect(mockSetItem).not.toHaveBeenCalled(); // nothing accepted → nothing cached
	});

	test("debounced: a second fetch inside the floor is a no-op", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue({ n: 3 });
		await cell.refresh();
		mockRpc.mockClear();
		await expect(cell.refresh()).resolves.toBe(false);
		expect(mockRpc).not.toHaveBeenCalled();
	});
});

describe("hydrate — the opt-in AsyncStorage cache", () => {
	test("a cached row applies at hydrate", async () => {
		const cell = makeCachedCell();
		mockGetItem.mockResolvedValue(JSON.stringify({ n: 12 }));
		await cell.hydrate();
		expect(cell.read()).toEqual({ n: 12 });
	});

	test("missing / corrupt / rejected cache keeps the fallback", async () => {
		const cell = makeCachedCell();
		mockGetItem.mockResolvedValue(null);
		await cell.hydrate();
		expect(cell.read()).toEqual({ n: 1 });

		mockGetItem.mockResolvedValue("{not json");
		await cell.hydrate();
		expect(cell.read()).toEqual({ n: 1 });

		mockGetItem.mockResolvedValue(JSON.stringify({ n: 0 }));
		await cell.hydrate();
		expect(cell.read()).toEqual({ n: 1 });
	});
});

describe("cache-less / debounce-less cell — the fieldGuideConfig shape", () => {
	test("hydrate is a no-op and refresh never debounces or caches", async () => {
		const cell = createConfigCell<Val>({
			key: "plain_key",
			fallback: FALLBACK,
			// A never-null sanitizer (fieldGuide style): missing field → fallback.
			sanitize: (raw) => {
				const n = (raw as Record<string, unknown>)?.n;
				return { n: typeof n === "number" && n > 0 ? Math.floor(n) : 1 };
			},
		});
		mockGetItem.mockResolvedValue(JSON.stringify({ n: 99 }));
		await cell.hydrate();
		expect(cell.read()).toEqual({ n: 1 }); // no cacheKey → hydrate ignored
		expect(mockGetItem).not.toHaveBeenCalled();

		mockRpc.mockResolvedValue({ n: 8 });
		await expect(cell.refresh()).resolves.toBe(true);
		await cell.refresh(); // immediately again — NOT debounced
		expect(mockRpc).toHaveBeenCalledTimes(2);
		expect(mockSetItem).not.toHaveBeenCalled(); // no cacheKey → nothing persisted
	});
});

describe("ensureFresh — staleness-aware read-or-refresh", () => {
	test("returns the current value now and kicks a background refresh", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue({ n: 55 });
		expect(cell.ensureFresh()).toEqual({ n: 1 }); // current value, synchronously
		await Promise.resolve(); // let the fire-and-forget refresh settle
		expect(mockRpc).toHaveBeenCalledWith("app_setting", { p_key: "test_key" });
	});
});

describe("resetForTests — the seam back to a clean cell", () => {
	test("restores the fallback and clears the debounce", async () => {
		const cell = makeCachedCell();
		mockRpc.mockResolvedValue({ n: 4 });
		await cell.refresh();
		expect(cell.read()).toEqual({ n: 4 });

		cell.resetForTests();
		expect(cell.read()).toEqual({ n: 1 });

		// Debounce cleared: a refresh right after reset hits the network again.
		mockRpc.mockClear();
		mockRpc.mockResolvedValue({ n: 6 });
		await expect(cell.refresh()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalled();
	});
});
