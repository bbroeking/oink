// The Field Guide (spec 16) — covers the page-id whitelist, the pure
// unlock-state derivation (local ∪ server, whitelist-filtered, shelf order),
// the client observe/reveal-queue lifecycle (idempotent, fail-soft, FIFO), the
// config-fed value numbers (sanitizer + propagation + defaults), and — the
// founder-critical one — the feeding-windows value line RECOMPUTING when the
// schedule config shifts. The util lazy-requires AsyncStorage + rpc, mocked at
// the module boundary (same style as feedingConfig.test.ts).

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
	FIELD_GUIDE_PAGE_IDS,
	isFieldGuidePageId,
	deriveUnlockedPages,
	observeFieldGuide,
	peekPendingReveal,
	dequeueReveal,
	subscribeFieldGuideReveals,
	unlockedPages,
	resetFieldGuideForTests,
} from "../utils/fieldGuide";
import {
	DEFAULT_FIELD_GUIDE_NUMBERS,
	sanitizeFieldGuideNumbers,
	applyFieldGuideNumbers,
	fieldGuideNumbers,
	feedingWindowsLine,
	resetFieldGuideNumbersForTests,
} from "../utils/fieldGuideConfig";
import {
	DEFAULT_FEEDING_SCHEDULE,
	applyFeedingSchedule,
	resetFeedingScheduleForTests,
} from "../utils/feedingConfig";
import { EXCHANGE_PRICES } from "../constants/dig";

beforeEach(() => {
	resetFieldGuideForTests();
	resetFieldGuideNumbersForTests();
	resetFeedingScheduleForTests();
	mockRpc.mockReset();
	mockGetItem.mockReset();
	mockSetItem.mockReset();
});

describe("page-id whitelist", () => {
	it("has exactly the 8 v1 pages, Echo deliberately absent", () => {
		expect(FIELD_GUIDE_PAGE_IDS).toHaveLength(8);
		expect(FIELD_GUIDE_PAGE_IDS).not.toContain("echo");
	});

	it("accepts every whitelisted id and rejects junk", () => {
		for (const id of FIELD_GUIDE_PAGE_IDS) expect(isFieldGuidePageId(id)).toBe(true);
		expect(isFieldGuidePageId("echo")).toBe(false);
		expect(isFieldGuidePageId("")).toBe(false);
		expect(isFieldGuidePageId(null)).toBe(false);
		expect(isFieldGuidePageId(42)).toBe(false);
	});
});

describe("deriveUnlockedPages", () => {
	it("unions local + server, drops off-whitelist ids, returns shelf order", () => {
		const out = deriveUnlockedPages(
			["snouts", "truffle", "bogus"],
			["exchange", "snouts", "echo"]
		);
		// shelf order is truffle(0) < snouts(5) < exchange(6)
		expect(out).toEqual(["truffle", "snouts", "exchange"]);
	});

	it("null server (unpushed/offline) leaves the local mirror standing", () => {
		expect(deriveUnlockedPages(["trough"], null)).toEqual(["trough"]);
	});

	it("empty everything is empty", () => {
		expect(deriveUnlockedPages([], null)).toEqual([]);
	});
});

describe("observe + reveal queue", () => {
	it("first observe unlocks, enqueues a reveal, and fires the RPC once", () => {
		observeFieldGuide("truffle");
		expect(unlockedPages()).toEqual(["truffle"]);
		expect(peekPendingReveal()).toBe("truffle");
		expect(mockRpc).toHaveBeenCalledWith("unlock_field_guide_page", {
			p_page: "truffle",
		});
		expect(mockRpc).toHaveBeenCalledTimes(1);
	});

	it("a repeat observe is a no-op — no second RPC, no second enqueue", () => {
		observeFieldGuide("snouts");
		observeFieldGuide("snouts");
		expect(mockRpc).toHaveBeenCalledTimes(1);
		expect(unlockedPages()).toEqual(["snouts"]);
	});

	it("ignores an off-whitelist id entirely", () => {
		observeFieldGuide("echo" as never);
		expect(unlockedPages()).toEqual([]);
		expect(peekPendingReveal()).toBeNull();
		expect(mockRpc).not.toHaveBeenCalled();
	});

	it("presents FIFO — dequeue advances to the next queued page", () => {
		observeFieldGuide("truffle");
		observeFieldGuide("exchange");
		expect(peekPendingReveal()).toBe("truffle");
		dequeueReveal("truffle");
		expect(peekPendingReveal()).toBe("exchange");
		dequeueReveal("exchange");
		expect(peekPendingReveal()).toBeNull();
	});

	it("notifies subscribers on enqueue and dequeue", () => {
		const seen = jest.fn();
		const unsub = subscribeFieldGuideReveals(seen);
		observeFieldGuide("trough");
		dequeueReveal("trough");
		expect(seen).toHaveBeenCalledTimes(2);
		unsub();
	});
});

describe("config-fed value numbers", () => {
	it("the Exchange floor default is the cheapest tier price", () => {
		expect(DEFAULT_FIELD_GUIDE_NUMBERS.exchangeMinPrice).toBe(
			Math.min(...Object.values(EXCHANGE_PRICES))
		);
	});

	it("sanitizer keeps defaults for missing/out-of-bounds fields", () => {
		const out = sanitizeFieldGuideNumbers({
			wrap_ceiling_hours: 24,
			lucky_payout: 0, // rejected → default
			trough_seed_pct: -5, // rejected → default
		});
		expect(out.wrapCeilingHours).toBe(24);
		expect(out.luckyPayout).toBe(DEFAULT_FIELD_GUIDE_NUMBERS.luckyPayout);
		expect(out.troughSeedPct).toBe(DEFAULT_FIELD_GUIDE_NUMBERS.troughSeedPct);
	});

	it("malformed row falls back wholesale", () => {
		expect(sanitizeFieldGuideNumbers(null)).toBe(DEFAULT_FIELD_GUIDE_NUMBERS);
		expect(sanitizeFieldGuideNumbers("nope")).toBe(DEFAULT_FIELD_GUIDE_NUMBERS);
	});

	it("apply propagates a changed set into fieldGuideNumbers()", () => {
		expect(applyFieldGuideNumbers({ ...DEFAULT_FIELD_GUIDE_NUMBERS })).toBe(false);
		const changed = applyFieldGuideNumbers({
			...DEFAULT_FIELD_GUIDE_NUMBERS,
			exchangeMinPrice: 40,
		});
		expect(changed).toBe(true);
		expect(fieldGuideNumbers().exchangeMinPrice).toBe(40);
	});
});

describe("feeding-windows value line recomputes with the schedule", () => {
	it("computes from the compiled default schedule", () => {
		// 8h windows → 3 feedings/day; 4h open head.
		expect(DEFAULT_FEEDING_SCHEDULE.windowSecs).toBe(28800);
		expect(feedingWindowsLine()).toBe(
			"3 feedings a day — each open only its first 4h."
		);
	});

	it("self-updates when the schedule config shifts", () => {
		const before = feedingWindowsLine();
		// Shift to 6h windows with a 3h open head → 4 feedings/day, 3h open.
		applyFeedingSchedule({ windowSecs: 21600, openSecs: 10800, offsetSecs: 0 });
		const after = feedingWindowsLine();
		expect(after).not.toBe(before);
		expect(after).toBe("4 feedings a day — each open only its first 3h.");
	});
});
