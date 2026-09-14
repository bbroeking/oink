// useRitualCaster — the one caster behind the friend-row doors, the Inbox's
// bless-back and the sheet's RitualPicker. Pins the RPC names + args, the
// outcome vocabulary, the optimistic allowance, and the per-target memory of
// what a cast came back as.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
const mockHaptics = jest.fn().mockResolvedValue(undefined);
jest.mock("expo-haptics", () => ({
	notificationAsync: (...args: unknown[]) => mockHaptics(...args),
	NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));
jest.mock("@/hooks/useFeatureFlags", () => ({ useFeatureFlag: () => false }));

import { useRitualCaster, type UseRitualCaster } from "../hooks/useRitualCaster";
import { dailyRitual } from "../utils/rituals";

// The hook's value reaches the test as a prop on a render-nothing holder —
// a component may not write to the world outside it, and a prop is the one
// channel react-test-renderer can read back after every act().
const Holder = (_props: { value: UseRitualCaster }) => null;
function Probe() {
	return <Holder value={useRitualCaster()} />;
}

let tree: TestRenderer.ReactTestRenderer;
const caster = (): UseRitualCaster => tree.root.findByType(Holder).props.value;

async function mountProbe() {
	await act(async () => {
		tree = TestRenderer.create(<Probe />);
	});
	return tree;
}

// The full allowance the RPC reports for a fresh day.
const STATUS = {
	ok: true,
	bless_used: 0,
	bless_cap: 3,
	curse_used: 1,
	curse_cap: 3,
};

// `ritual_status` answers with the allowance; every other RPC answers with
// whatever the test queued for the cast.
function serve(castReply: Record<string, unknown>) {
	mockRpc.mockImplementation(async (name: string) => ({
		data: name === "ritual_status" ? STATUS : castReply,
		error: null,
	}));
}

describe("useRitualCaster", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockHaptics.mockClear();
		serve({ ok: true });
	});

	test("reads the allowance once and reports it for both modes", async () => {
		const r = await mountProbe();
		expect(mockRpc).toHaveBeenCalledWith("ritual_status", undefined);
		expect(caster().usage("bless")).toEqual({ used: 0, cap: 3, remaining: 3 });
		expect(caster().usage("curse")).toEqual({ used: 1, cap: 3, remaining: 2 });
		act(() => r.unmount());
	});

	test("today() is the day's ritual for each mode", async () => {
		const r = await mountProbe();
		expect(caster().today("bless").name).toBe(dailyRitual("bless").name);
		expect(caster().today("curse").name).toBe(dailyRitual("curse").name);
		act(() => r.unmount());
	});

	test("a blessing casts send_blessing, spends one, and remembers the target", async () => {
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("bless", "u-42", "alice");
		});
		expect(mockRpc).toHaveBeenCalledWith("send_blessing", {
			target_user_id: "u-42",
		});
		expect(outcome).toEqual({
			kind: "sent",
			text: `${dailyRitual("bless").name} sent to alice`,
		});
		expect(mockHaptics).toHaveBeenCalledWith("success");
		expect(caster().usage("bless")).toEqual({ used: 1, cap: 3, remaining: 2 });
		expect(caster().outcomeFor("bless", "u-42")).toEqual(outcome);
		// The memory is per target AND per mode — nobody else is marked.
		expect(caster().outcomeFor("bless", "u-7")).toBeUndefined();
		expect(caster().outcomeFor("curse", "u-42")).toBeUndefined();
		act(() => r.unmount());
	});

	test("a curse casts send_curse on the warning haptic", async () => {
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("curse", "u-7", "bob");
		});
		expect(mockRpc).toHaveBeenCalledWith("send_curse", { target_user_id: "u-7" });
		expect(outcome).toEqual({ kind: "sent", text: "bob has been cursed" });
		expect(mockHaptics).toHaveBeenCalledWith("warning");
		expect(caster().usage("curse")).toEqual({ used: 2, cap: 3, remaining: 1 });
		act(() => r.unmount());
	});

	test("already_blessed_today is `done`, and does not spend an allowance", async () => {
		serve({ ok: false, reason: "already_blessed_today" });
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("bless", "u-42", "alice");
		});
		expect(outcome).toEqual({ kind: "done" });
		expect(caster().outcomeFor("bless", "u-42")).toEqual({ kind: "done" });
		expect(caster().usage("bless")?.remaining).toBe(3);
		act(() => r.unmount());
	});

	test("already_cursed_today is `done` on the curse side", async () => {
		serve({ ok: false, reason: "already_cursed_today" });
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("curse", "u-7", "bob");
		});
		expect(outcome).toEqual({ kind: "done" });
		act(() => r.unmount());
	});

	test("daily_cap is `capped` and spends the whole mode", async () => {
		serve({ ok: false, reason: "daily_cap" });
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("bless", "u-42", "alice");
		});
		expect(outcome).toEqual({ kind: "capped" });
		expect(caster().usage("bless")).toEqual({ used: 3, cap: 3, remaining: 0 });
		// The other mode is untouched — the caps are separate.
		expect(caster().usage("curse")?.remaining).toBe(2);
		act(() => r.unmount());
	});

	test("an unexpected refusal carries its reason text", async () => {
		serve({ ok: false, reason: "not_friends" });
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("bless", "u-42", "alice");
		});
		expect(outcome).toEqual({
			kind: "error",
			text: "Only friends can be reached.",
		});
		expect(mockHaptics).not.toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("refresh() re-reads the allowance", async () => {
		const r = await mountProbe();
		mockRpc.mockImplementation(async () => ({
			data: { ...STATUS, bless_used: 3 },
			error: null,
		}));
		await act(async () => {
			await caster().refresh();
		});
		expect(caster().usage("bless")).toEqual({ used: 3, cap: 3, remaining: 0 });
		act(() => r.unmount());
	});

	test("a failed status read leaves the allowance unknown", async () => {
		mockRpc.mockResolvedValue({ data: { ok: false, reason: "network" }, error: null });
		const r = await mountProbe();
		expect(caster().usage("bless")).toBeNull();
		expect(caster().usage("curse")).toBeNull();
		act(() => r.unmount());
	});
});

// The server owns the rotation; the local weekday table is the fallback while
// `ritual_status` is dark. Both index the same Monday-first arrays, so this is
// belt-and-braces — but the toast must name what was actually CAST, which is
// the 00:00-UTC-boundary case the plan calls out.
describe("useRitualCaster — the server's kinds win", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockHaptics.mockClear();
	});

	function serveKinds(
		status: Record<string, unknown>,
		castReply: Record<string, unknown> = { ok: true }
	) {
		mockRpc.mockImplementation(async (name: string) => ({
			data: name === "ritual_status" ? { ...STATUS, ...status } : castReply,
			error: null,
		}));
	}

	test("today() prefers bless_kind / curse_kind over the local table", async () => {
		// Deliberately NOT the same weekday pair, so the preference is visible.
		serveKinds({ bless_kind: "firefly_night", curse_kind: "topsy_turvy" });
		const r = await mountProbe();
		expect(caster().today("bless").kind).toBe("firefly_night");
		expect(caster().today("bless").name).toBe("Firefly Night");
		expect(caster().today("curse").kind).toBe("topsy_turvy");
		act(() => r.unmount());
	});

	test("a kind this build has never heard of falls back to the local table", async () => {
		serveKinds({ bless_kind: "season_three_thing", curse_kind: undefined });
		const r = await mountProbe();
		expect(caster().today("bless").name).toBe(dailyRitual("bless").name);
		expect(caster().today("curse").name).toBe(dailyRitual("curse").name);
		act(() => r.unmount());
	});

	test("the toast names the kind the CAST returned, not the local guess", async () => {
		// The door was armed on Thursday's blessing; the cast crossed 00:00 UTC
		// and the server sent Friday's. The line says Golden Hour.
		serveKinds(
			{ bless_kind: "confetti_snout" },
			{ ok: true, kind: "golden_hour" }
		);
		const r = await mountProbe();
		let outcome;
		await act(async () => {
			outcome = await caster().cast("bless", "u-42", "alice");
		});
		expect(outcome).toEqual({ kind: "sent", text: "Golden Hour sent to alice" });
		act(() => r.unmount());
	});
});
