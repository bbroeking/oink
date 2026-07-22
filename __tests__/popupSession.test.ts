// Direct unit tests for the in-memory session latches in utils/popupSession.ts.
// PopupQueue.test.tsx exercises them through the queue; these pin the pure
// module contract on its own (the review flagged it untested in isolation).
//
// NOTE: the quiet-fill EXCLUSION (sounderLaunch / feedbackNudge don't count as
// "a popup presented") now lives at the arbiter (PopupQueue.write consults
// QUIET_FILL_SLOT_IDS), so markPopupPresented here is an UNCONDITIONAL latch —
// that split is asserted below so it can't silently regress.

import {
	markPopupPresented,
	anyPopupPresentedThisSession,
	sounderNudgeFiredThisSession,
	markSounderNudgeFired,
	feedbackNudgeFiredThisSession,
	markFeedbackNudgeFired,
	__resetPopupSession,
} from "../utils/popupSession";

beforeEach(() => __resetPopupSession());
afterEach(() => __resetPopupSession());

describe("popupSession latches", () => {
	test("starts clean after reset", () => {
		expect(anyPopupPresentedThisSession()).toBe(false);
		expect(sounderNudgeFiredThisSession()).toBe(false);
		expect(feedbackNudgeFiredThisSession()).toBe(false);
	});

	test("markPopupPresented latches the presented-this-session signal", () => {
		expect(anyPopupPresentedThisSession()).toBe(false);
		markPopupPresented("schism");
		expect(anyPopupPresentedThisSession()).toBe(true);
	});

	test("markPopupPresented is unconditional — the arbiter, not this module, filters quiet-fill ids", () => {
		// Guards the moved exclusion: if the id-filter ever creeps back in here it
		// would double-filter (or diverge from the registry). This latch trusts the
		// caller, so even a quiet-fill id passed directly latches.
		markPopupPresented("sounderLaunch");
		expect(anyPopupPresentedThisSession()).toBe(true);
	});

	test("sounder nudge fire-once latch", () => {
		expect(sounderNudgeFiredThisSession()).toBe(false);
		markSounderNudgeFired();
		expect(sounderNudgeFiredThisSession()).toBe(true);
	});

	test("feedback nudge fire-once latch is independent of the sounder latch", () => {
		markFeedbackNudgeFired();
		expect(feedbackNudgeFiredThisSession()).toBe(true);
		expect(sounderNudgeFiredThisSession()).toBe(false);
	});

	test("__resetPopupSession clears every latch (session boundary)", () => {
		markPopupPresented("finale");
		markSounderNudgeFired();
		markFeedbackNudgeFired();
		__resetPopupSession();
		expect(anyPopupPresentedThisSession()).toBe(false);
		expect(sounderNudgeFiredThisSession()).toBe(false);
		expect(feedbackNudgeFiredThisSession()).toBe(false);
	});
});
