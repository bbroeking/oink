// RitualPicker shows today's ritual for the given mode, fires the
// correct RPC (send_blessing / send_curse) on cast, and surfaces
// success + failure-reason copy.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success", Warning: "warning" },
}));

import { RitualPicker } from "../components/RitualPicker";
import { dailyRitual } from "../utils/rituals";

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") { out.push(n); return; }
		for (const c of n.children ?? []) walk(c as any);
	}
	walk(tree);
	return out.join("");
}

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => { r = TestRenderer.create(node); });
	return r;
}

describe("RitualPicker", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
	});

	test("bless mode shows today's blessing name", async () => {
		const r = await renderAct(
			<RitualPicker mode="bless" targetUserId="u1" targetName="alice" />
		);
		const text = textOf(r.root);
		expect(text).toContain(dailyRitual("bless").name);
		expect(text).toContain("Bless alice");
		act(() => r.unmount());
	});

	test("curse mode shows today's curse name", async () => {
		const r = await renderAct(
			<RitualPicker mode="curse" targetUserId="u1" targetName="bob" />
		);
		const text = textOf(r.root);
		expect(text).toContain(dailyRitual("curse").name);
		expect(text).toContain("Curse bob");
		act(() => r.unmount());
	});

	test("cast in bless mode calls send_blessing with target id", async () => {
		const r = await renderAct(
			<RitualPicker mode="bless" targetUserId="u-42" targetName="alice" />
		);
		const btn = r.root.findByProps({ testID: "ritual-cast" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("send_blessing", {
			target_user_id: "u-42",
		});
		act(() => r.unmount());
	});

	test("cast in curse mode calls send_curse", async () => {
		const r = await renderAct(
			<RitualPicker mode="curse" targetUserId="u-7" targetName="bob" />
		);
		const btn = r.root.findByProps({ testID: "ritual-cast" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("send_curse", {
			target_user_id: "u-7",
		});
		act(() => r.unmount());
	});

	test("daily_cap reason surfaces the 3-casts message", async () => {
		mockRpc.mockResolvedValue({ data: { ok: false, reason: "daily_cap" }, error: null });
		const r = await renderAct(
			<RitualPicker mode="bless" targetUserId="u1" targetName="alice" />
		);
		const btn = r.root.findByProps({ testID: "ritual-cast" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(textOf(r.root)).toContain("all 3 casts");
		act(() => r.unmount());
	});

	test("onCast fires after a successful cast", async () => {
		const onCast = jest.fn();
		const r = await renderAct(
			<RitualPicker mode="bless" targetUserId="u1" targetName="alice" onCast={onCast} />
		);
		const btn = r.root.findByProps({ testID: "ritual-cast" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onCast).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("onCast does NOT fire when the cast fails", async () => {
		mockRpc.mockResolvedValue({ data: { ok: false, reason: "not_friends" }, error: null });
		const onCast = jest.fn();
		const r = await renderAct(
			<RitualPicker mode="curse" targetUserId="u1" targetName="bob" onCast={onCast} />
		);
		const btn = r.root.findByProps({ testID: "ritual-cast" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onCast).not.toHaveBeenCalled();
		act(() => r.unmount());
	});
});
