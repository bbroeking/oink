// Onboarding (first-week checklist) module — covers the pure
// allOnboardingDone() helper and confirms each typed wrapper calls the right RPC
// and degrades safely (empty array / empty claim) on a null/errored response.
// Same testing style as referrals.test.ts / friendships.test.ts.

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("../utils/log", () => ({
	log: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import {
	getOnboardingProgress,
	claimOnboarding,
	allOnboardingDone,
	getStorybookSeenServer,
	markStorybookSeenServer,
	needsStorybook,
	type OnboardingMilestone,
} from "../utils/onboarding";

const milestone = (over: Partial<OnboardingMilestone> = {}): OnboardingMilestone => ({
	id: "first_tickle",
	name: "First tickle",
	description: "Give Rosie her first tickle.",
	icon: "👆",
	reward_snouts: 25,
	display_order: 10,
	done: false,
	claimed: false,
	...over,
});

beforeEach(() => mockRpc.mockReset());

describe("allOnboardingDone", () => {
	test("false for an empty list (nothing loaded yet)", () => {
		expect(allOnboardingDone([])).toBe(false);
	});

	test("true only when every milestone is claimed", () => {
		expect(allOnboardingDone([milestone({ claimed: true }), milestone({ id: "dress", claimed: true })])).toBe(true);
	});

	test("false when any milestone is unclaimed", () => {
		expect(allOnboardingDone([milestone({ claimed: true }), milestone({ id: "dress", claimed: false })])).toBe(false);
	});

	test("done-but-unclaimed still counts as not-all-done", () => {
		expect(allOnboardingDone([milestone({ done: true, claimed: false })])).toBe(false);
	});
});

describe("getOnboardingProgress", () => {
	test("calls the onboarding_progress RPC and returns its rows", async () => {
		const rows = [milestone({ claimed: true }), milestone({ id: "friend", done: true })];
		mockRpc.mockResolvedValue({ data: rows, error: null });
		await expect(getOnboardingProgress()).resolves.toEqual(rows);
		expect(mockRpc).toHaveBeenCalledWith("onboarding_progress", undefined);
	});

	test("returns [] when the RPC yields null (errored / no rows)", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		await expect(getOnboardingProgress()).resolves.toEqual([]);
	});
});

describe("claimOnboarding", () => {
	test("calls the claim_onboarding RPC and returns its result", async () => {
		const result = {
			ok: true,
			claimed: [{ id: "first_tickle", name: "First tickle", icon: "👆", reward_snouts: 25 }],
			snouts_granted: 25,
		};
		mockRpc.mockResolvedValue({ data: result, error: null });
		await expect(claimOnboarding()).resolves.toEqual(result);
		expect(mockRpc).toHaveBeenCalledWith("claim_onboarding", undefined);
	});

	test("returns an empty, not-ok result when the RPC yields null", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		await expect(claimOnboarding()).resolves.toEqual({ ok: false, claimed: [], snouts_granted: 0 });
	});
});

// ── Storybook-seen server mirror (reinstall flow, issue #11) ─────────────────

describe("getStorybookSeenServer", () => {
	test("true only when the RPC returns true", async () => {
		mockRpc.mockResolvedValue({ data: true, error: null });
		await expect(getStorybookSeenServer()).resolves.toBe(true);
		expect(mockRpc).toHaveBeenCalledWith("get_storybook_seen", undefined);
	});

	test("false when the RPC returns false", async () => {
		mockRpc.mockResolvedValue({ data: false, error: null });
		await expect(getStorybookSeenServer()).resolves.toBe(false);
	});

	test("false (fail-soft) when the RPC errors / is unpushed (null)", async () => {
		mockRpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "missing" } });
		await expect(getStorybookSeenServer()).resolves.toBe(false);
	});
});

describe("markStorybookSeenServer", () => {
	test("calls the mark_storybook_seen RPC", async () => {
		mockRpc.mockResolvedValue({ data: null, error: null });
		await markStorybookSeenServer();
		expect(mockRpc).toHaveBeenCalledWith("mark_storybook_seen", undefined);
	});

	test("resolves (fail-soft) even when the RPC errors", async () => {
		mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
		await expect(markStorybookSeenServer()).resolves.toBeUndefined();
	});
});

describe("needsStorybook — gate decision matrix (local × server × session)", () => {
	// Local flag ALWAYS wins: a current veteran (or offline boot) never replays.
	test("local seen → never run, regardless of server / session", () => {
		expect(needsStorybook({ localSeen: true, serverSeen: false, hasSession: false })).toBe(false);
		expect(needsStorybook({ localSeen: true, serverSeen: false, hasSession: true })).toBe(false);
		expect(needsStorybook({ localSeen: true, serverSeen: true, hasSession: true })).toBe(false);
	});

	// No local flag, no session yet: can't consult the server → keep armed.
	test("no local flag + no session → run (can't yet confirm a veteran)", () => {
		expect(needsStorybook({ localSeen: false, serverSeen: false, hasSession: false })).toBe(true);
		expect(needsStorybook({ localSeen: false, serverSeen: true, hasSession: false })).toBe(true);
	});

	// No local flag but signed in: the server mirror decides.
	test("no local flag + session + server seen → skip (reinstalling veteran)", () => {
		expect(needsStorybook({ localSeen: false, serverSeen: true, hasSession: true })).toBe(false);
	});

	test("no local flag + session + server unseen → run (true fresh install)", () => {
		expect(needsStorybook({ localSeen: false, serverSeen: false, hasSession: true })).toBe(true);
	});
});
