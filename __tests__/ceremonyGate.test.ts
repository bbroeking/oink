// Direct unit tests for the in-memory ceremony gate (utils/ceremonyGate.ts) —
// the flip-day stacking ceiling (SKILL.md 2026-07-11). PopupQueue.test.tsx
// exercises it through a wired ceremony/housekeeping pair; these pin the pure
// module contract on its own (the review flagged it untested in isolation).

import {
	markCeremonyShown,
	ceremonyShownThisSession,
	__resetCeremonyGate,
} from "../utils/ceremonyGate";

beforeEach(() => __resetCeremonyGate());
afterEach(() => __resetCeremonyGate());

describe("ceremonyGate", () => {
	test("starts un-stamped after reset", () => {
		expect(ceremonyShownThisSession()).toBe(false);
	});

	test("markCeremonyShown stamps the session gate", () => {
		markCeremonyShown();
		expect(ceremonyShownThisSession()).toBe(true);
	});

	test("the stamp is idempotent (a second ceremony doesn't unset it)", () => {
		markCeremonyShown();
		markCeremonyShown();
		expect(ceremonyShownThisSession()).toBe(true);
	});

	test("__resetCeremonyGate clears the stamp (session boundary)", () => {
		markCeremonyShown();
		__resetCeremonyGate();
		expect(ceremonyShownThisSession()).toBe(false);
	});
});
