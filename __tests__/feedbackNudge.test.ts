// The feedback nudge gate — covers the PURE shouldShowFeedbackNudge AND-gate
// (the covenant made concrete: rare, earned, respectful) and the fail-soft
// AsyncStorage stamp readers. Same module-boundary stubbing style as
// sounderPath.test.ts: the module side-imports AsyncStorage's native shim, so
// mock it out and drive the readers through it.

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
jest.mock("@react-native-async-storage/async-storage", () => ({
	__esModule: true,
	default: {
		getItem: (...a: unknown[]) => mockGetItem(...a),
		setItem: (...a: unknown[]) => mockSetItem(...a),
	},
}));

import {
	shouldShowFeedbackNudge,
	readFeedbackNudgeStamps,
	stampFeedbackNudgeShown,
	stampFeedbackNudgeOff,
	stampFeedbackEverSent,
	feedbackNudgeLastKey,
	feedbackNudgeOffKey,
	feedbackEverSentKey,
	FEEDBACK_NUDGE_COOLDOWN_MS,
	FEEDBACK_EVER_SENT_COOLDOWN_MS,
	FEEDBACK_NUDGE_MIN_ACTIVE_DAYS,
	type FeedbackNudgeSignals,
} from "../utils/feedbackNudge";

const NOW = 1_700_000_000_000;

// A player who SHOULD see the nudge: real history, no stamps, not opted off.
const base = (over: Partial<FeedbackNudgeSignals> = {}): FeedbackNudgeSignals => ({
	activeDays: FEEDBACK_NUDGE_MIN_ACTIVE_DAYS,
	lastStampMs: null,
	everSentMs: null,
	optedOff: false,
	nowMs: NOW,
	...over,
});

describe("shouldShowFeedbackNudge", () => {
	test("shows for a player with real history and a clean slate", () => {
		expect(shouldShowFeedbackNudge(base())).toBe(true);
	});

	// Gate 1 — earned, not immediate.
	test("never prompts a brand-new player (0 active days)", () => {
		expect(shouldShowFeedbackNudge(base({ activeDays: 0 }))).toBe(false);
	});

	test("stays quiet just below the active-days threshold", () => {
		expect(
			shouldShowFeedbackNudge(base({ activeDays: FEEDBACK_NUDGE_MIN_ACTIVE_DAYS - 1 }))
		).toBe(false);
	});

	test("shows at exactly the active-days threshold", () => {
		expect(
			shouldShowFeedbackNudge(base({ activeDays: FEEDBACK_NUDGE_MIN_ACTIVE_DAYS }))
		).toBe(true);
	});

	// Gate 5 — hard opt-out wins over everything.
	test("never prompts once the player opted off — even with real history", () => {
		expect(shouldShowFeedbackNudge(base({ optedOff: true, activeDays: 999 }))).toBe(
			false
		);
	});

	// Gate 3 — the 14-day cross-session cooldown.
	test("stays quiet inside the 14-day cooldown", () => {
		const lastStampMs = NOW - (FEEDBACK_NUDGE_COOLDOWN_MS - 60_000);
		expect(shouldShowFeedbackNudge(base({ lastStampMs }))).toBe(false);
	});

	test("re-arms once the 14-day cooldown has elapsed", () => {
		const lastStampMs = NOW - (FEEDBACK_NUDGE_COOLDOWN_MS + 60_000);
		expect(shouldShowFeedbackNudge(base({ lastStampMs }))).toBe(true);
	});

	// Gate 4 — respect a whisper: back off hard for 60 days after any submission.
	test("backs off hard right after the player has ever whispered", () => {
		const everSentMs = NOW - (FEEDBACK_EVER_SENT_COOLDOWN_MS - 60_000);
		expect(shouldShowFeedbackNudge(base({ everSentMs }))).toBe(false);
	});

	test("the ever-sent back-off is longer than the base cooldown", () => {
		// A whisper 20 days ago is past the 14-day base cooldown but still inside
		// the 60-day respect window — must stay quiet.
		const twentyDays = 20 * 24 * 60 * 60 * 1000;
		expect(
			shouldShowFeedbackNudge(base({ everSentMs: NOW - twentyDays }))
		).toBe(false);
		expect(FEEDBACK_EVER_SENT_COOLDOWN_MS).toBeGreaterThan(
			FEEDBACK_NUDGE_COOLDOWN_MS
		);
	});

	test("re-arms once the 60-day ever-sent window has elapsed", () => {
		const everSentMs = NOW - (FEEDBACK_EVER_SENT_COOLDOWN_MS + 60_000);
		expect(shouldShowFeedbackNudge(base({ everSentMs }))).toBe(true);
	});
});

describe("readFeedbackNudgeStamps", () => {
	beforeEach(() => {
		mockGetItem.mockReset();
	});

	test("parses present stamps by their per-user keys", async () => {
		mockGetItem.mockImplementation((key: string) => {
			if (key === feedbackNudgeLastKey("u1")) return Promise.resolve("111");
			if (key === feedbackEverSentKey("u1")) return Promise.resolve("222");
			if (key === feedbackNudgeOffKey("u1")) return Promise.resolve("1");
			return Promise.resolve(null);
		});
		const s = await readFeedbackNudgeStamps("u1");
		expect(s).toEqual({ lastStampMs: 111, everSentMs: 222, optedOff: true });
	});

	test("absent stamps read as null / false", async () => {
		mockGetItem.mockResolvedValue(null);
		const s = await readFeedbackNudgeStamps("u1");
		expect(s).toEqual({ lastStampMs: null, everSentMs: null, optedOff: false });
	});

	test("garbage timestamps read as null (fail-soft parse)", async () => {
		mockGetItem.mockImplementation((key: string) =>
			Promise.resolve(key === feedbackNudgeLastKey("u1") ? "not-a-number" : null)
		);
		const s = await readFeedbackNudgeStamps("u1");
		expect(s.lastStampMs).toBeNull();
	});

	test("a total storage failure resolves to a quiet-safe opted-off read", async () => {
		mockGetItem.mockRejectedValue(new Error("storage exploded"));
		const s = await readFeedbackNudgeStamps("u1");
		// optedOff:true → the gate stays quiet rather than firing blind.
		expect(s.optedOff).toBe(true);
		expect(shouldShowFeedbackNudge(base({ optedOff: s.optedOff }))).toBe(false);
	});
});

describe("stamp writers", () => {
	beforeEach(() => {
		mockSetItem.mockReset();
		mockSetItem.mockResolvedValue(undefined);
	});

	test("stampFeedbackNudgeShown writes a timestamp under the per-user last key", async () => {
		await stampFeedbackNudgeShown("u1");
		expect(mockSetItem).toHaveBeenCalledWith(
			feedbackNudgeLastKey("u1"),
			expect.any(String)
		);
		expect(Number(mockSetItem.mock.calls[0][1])).toBeGreaterThan(0);
	});

	test("stampFeedbackNudgeOff writes the opt-out flag", async () => {
		await stampFeedbackNudgeOff("u1");
		expect(mockSetItem).toHaveBeenCalledWith(feedbackNudgeOffKey("u1"), "1");
	});

	test("stampFeedbackEverSent writes a timestamp under the ever-sent key", async () => {
		await stampFeedbackEverSent("u1");
		expect(mockSetItem).toHaveBeenCalledWith(
			feedbackEverSentKey("u1"),
			expect.any(String)
		);
	});

	test("a write failure is swallowed (fail-soft — never crashes)", async () => {
		mockSetItem.mockRejectedValue(new Error("disk full"));
		await expect(stampFeedbackNudgeShown("u1")).resolves.toBeUndefined();
		await expect(stampFeedbackNudgeOff("u1")).resolves.toBeUndefined();
		await expect(stampFeedbackEverSent("u1")).resolves.toBeUndefined();
	});
});
