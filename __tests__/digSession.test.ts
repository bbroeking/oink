// The dig-session reducer, exercised as plain data — no renderHook, no timers,
// no network. Each `describe` replays a founder-reported PRODUCTION incident the
// hook's transition logic was rewritten to make unrepresentable. If any of these
// regress, the bug is back.

jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import {
	digSessionReducer,
	initialDigSessionState,
	isDugThisWindow,
	dugMirrorKey,
	shouldReconcile,
	RECONCILE_MIN_MS,
	type DigSessionState,
} from "../utils/digSession";
import { windowIndex, windowEndsAtMs } from "../utils/rooting";
import type { RootingSession } from "../hooks/useRooting";

function makeSession(overrides: Partial<RootingSession> = {}): RootingSession {
	return {
		seed: 12345,
		windowIndex: 100,
		windowEndsAtMs: 0,
		practice: false,
		coop: false,
		blessed: false,
		crewDug: [],
		uniqueId: null,
		carry: null,
		...overrides,
	};
}

const base = 1_750_000_000_000; // a fixed "now" inside some window

describe("open/submit lifecycle transitions", () => {
	test("opened: a real server success sets the session + clears the crewless flag", () => {
		const s = makeSession();
		const next = digSessionReducer(
			{ ...initialDigSessionState, noCrew: true },
			{ type: "opened", session: s, clearNoCrew: true }
		);
		expect(next.session).toBe(s);
		expect(next.noCrew).toBe(false);
		expect(next.dugWindow).toBeNull();
	});

	test("opened with alreadyDug adopts the SESSION's server window index", () => {
		const s = makeSession({ windowIndex: 4242 });
		const next = digSessionReducer(initialDigSessionState, {
			type: "opened",
			session: s,
			alreadyDug: true,
			clearNoCrew: true,
		});
		expect(next.dugWindow).toBe(4242);
	});

	test("open_no_crew raises the crewless flag; opened without clearNoCrew leaves it", () => {
		const crewless = digSessionReducer(initialDigSessionState, { type: "open_no_crew" });
		expect(crewless.noCrew).toBe(true);
		// A PRACTICE/dev open (no clearNoCrew) must not silently un-set it — a
		// crewless player practicing is still crewless.
		const practice = digSessionReducer(crewless, {
			type: "opened",
			session: makeSession({ practice: true }),
		});
		expect(practice.noCrew).toBe(true);
		expect(practice.session?.practice).toBe(true);
	});

	test("open_already_rooted marks the passed (current) window dug", () => {
		const next = digSessionReducer(initialDigSessionState, {
			type: "open_already_rooted",
			window: 777,
		});
		expect(next.dugWindow).toBe(777);
	});

	test("cleared nulls the session but keeps the dug flag", () => {
		const opened = digSessionReducer(initialDigSessionState, {
			type: "opened",
			session: makeSession(),
			alreadyDug: true,
			clearNoCrew: true,
		});
		const cleared = digSessionReducer(opened, { type: "cleared" });
		expect(cleared.session).toBeNull();
		expect(cleared.dugWindow).toBe(opened.dugWindow); // still dug this feeding
	});
});

// ── Incident: the dug flag "still dug two hours later" ───────────────────────
// A boolean set at dig time had nothing to un-set it when the 8h window rolled.
// The flag is now the WINDOW the dig landed in, so it expires by construction.
describe("incident — dug-flag expiry across window rollover", () => {
	const win = windowIndex(base);
	const dug = digSessionReducer(
		{ ...initialDigSessionState, session: makeSession({ windowIndex: win }) },
		{ type: "submit_landed", practice: false }
	);

	test("a real submit records the session's window", () => {
		expect(dug.dugWindow).toBe(win);
	});

	test("still dug anywhere inside the same window", () => {
		expect(isDugThisWindow(dug, base)).toBe(true);
		expect(isDugThisWindow(dug, windowEndsAtMs(win) - 1)).toBe(true);
	});

	test("EXPIRES the instant the window rolls over — no un-set event needed", () => {
		expect(isDugThisWindow(dug, windowEndsAtMs(win))).toBe(false);
	});
});

// ── Incident: a PRACTICE dig locked out the first REAL dig ───────────────────
// A fresh player who practiced then founded a Sounder in the SAME window saw the
// crewed card mistake the practice for a real dig and lock their first real dig.
// The reducer is now the single gate; it refuses to record a practice submit.
describe("incident — practice submit must not block the real dig", () => {
	const win = windowIndex(base);
	const practiceState: DigSessionState = {
		...initialDigSessionState,
		session: makeSession({ windowIndex: win, practice: true }),
	};

	test("a practice submit records NOTHING (dug flag stays clear)", () => {
		const after = digSessionReducer(practiceState, {
			type: "submit_landed",
			practice: true,
		});
		expect(after.dugWindow).toBeNull();
		expect(isDugThisWindow(after, base)).toBe(false);
		// The reducer returns the SAME state reference so React bails the render out.
		expect(after).toBe(practiceState);
	});

	test("the SAME window's first real dig then locks normally (was blocked before)", () => {
		// Practice first (no lock), then a real open + submit in the same window.
		const afterPractice = digSessionReducer(practiceState, {
			type: "submit_landed",
			practice: true,
		});
		const realOpen = digSessionReducer(afterPractice, {
			type: "opened",
			session: makeSession({ windowIndex: win, practice: false }),
			clearNoCrew: true,
		});
		const realDug = digSessionReducer(realOpen, {
			type: "submit_landed",
			practice: false,
		});
		expect(realDug.dugWindow).toBe(win);
		expect(isDugThisWindow(realDug, base)).toBe(true);
	});

	test("submit_landed is inert with no open session", () => {
		const after = digSessionReducer(initialDigSessionState, {
			type: "submit_landed",
			practice: false,
		});
		expect(after.dugWindow).toBeNull();
	});
});

// ── Incident: a shared-device account switch inherited another player's flag ──
// The old un-namespaced `rooting_done_${win}` key leaked the demo account's dug
// flag into a fresh signup and locked its first dig. The mirror key is per-user.
describe("incident — per-user cold-start mirror key isolation", () => {
	const uidA = "user-aaaa";
	const uidB = "user-bbbb";

	test("two accounts never share a key for the same window", () => {
		expect(dugMirrorKey(uidA, 100)).not.toBe(dugMirrorKey(uidB, 100));
	});

	test("the key namespaces the window AND the uid", () => {
		expect(dugMirrorKey(uidA, 100)).toBe("rooting_done_100:user-aaaa");
		// Distinct window OR distinct uid → distinct key.
		expect(dugMirrorKey(uidA, 101)).not.toBe(dugMirrorKey(uidA, 100));
	});
});

// ── Incident: rapid fg/bg flips spammed feeding_state; stale flags outlived truth ─
// The reconcile is debounced (one RPC per 5s), and the server's truth for ITS
// window index reconciles the local flag.
describe("incident — reconcile debounce + server-truth decision", () => {
	test("shouldReconcile gates on the 5s debounce floor", () => {
		const last = base;
		expect(shouldReconcile(last, last)).toBe(false); // same instant
		expect(shouldReconcile(last, last + RECONCILE_MIN_MS - 1)).toBe(false);
		expect(shouldReconcile(last, last + RECONCILE_MIN_MS)).toBe(true);
		expect(shouldReconcile(last, last + RECONCILE_MIN_MS + 5000)).toBe(true);
	});

	test("reconciled dug → adopt the server's window", () => {
		const next = digSessionReducer(initialDigSessionState, {
			type: "reconciled",
			dug: true,
			window: 555,
		});
		expect(next.dugWindow).toBe(555);
	});

	test("reconciled not-dug retires a MATCHING stale local claim", () => {
		const stale: DigSessionState = { ...initialDigSessionState, dugWindow: 555 };
		const next = digSessionReducer(stale, { type: "reconciled", dug: false, window: 555 });
		expect(next.dugWindow).toBeNull();
	});

	test("reconciled not-dug leaves a claim for a DIFFERENT window alone", () => {
		const other: DigSessionState = { ...initialDigSessionState, dugWindow: 900 };
		const next = digSessionReducer(other, { type: "reconciled", dug: false, window: 555 });
		expect(next.dugWindow).toBe(900);
	});

	test("mirror_hydrated adopts the cold-start window", () => {
		const next = digSessionReducer(initialDigSessionState, {
			type: "mirror_hydrated",
			window: 321,
		});
		expect(next.dugWindow).toBe(321);
	});
});
