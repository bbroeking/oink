// CleanseModal lists the caller's active curses and, on confirm,
// calls cleanse_curses then fires onCleansed + onDismiss. On an
// insufficient-snouts result it shows the error and stays open.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

const mockRpc = jest.fn();
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success" },
}));

import { CleanseModal, type ActiveCurse } from "../components/CleanseModal";

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

const oneCurse: ActiveCurse[] = [
	{ kind: "sluggish_snout", expires_at: "2026-05-21T12:00:00Z" },
];
const twoCurses: ActiveCurse[] = [
	{ kind: "sluggish_snout", expires_at: "2026-05-21T12:00:00Z" },
	{ kind: "goblin_whisper", expires_at: "2026-05-21T15:00:00Z" },
];

describe("CleanseModal", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: { ok: true, cleared: 1 }, error: null });
	});

	test("singular headline for one curse", async () => {
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={() => {}} />
		);
		expect(textOf(r.root)).toContain("A curse clings to you");
		act(() => r.unmount());
	});

	test("plural headline + count for multiple curses", async () => {
		const r = await renderAct(
			<CleanseModal curses={twoCurses} onDismiss={() => {}} />
		);
		expect(textOf(r.root)).toContain("2 curses cling to you");
		act(() => r.unmount());
	});

	test("lists each curse's display name", async () => {
		const r = await renderAct(
			<CleanseModal curses={twoCurses} onDismiss={() => {}} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Sluggish Snout");
		expect(text).toContain("Goblin Whisper");
		act(() => r.unmount());
	});

	test("confirm calls cleanse_curses then onCleansed + onDismiss", async () => {
		const onDismiss = jest.fn();
		const onCleansed = jest.fn();
		const r = await renderAct(
			<CleanseModal
				curses={oneCurse}
				onDismiss={onDismiss}
				onCleansed={onCleansed}
			/>
		);
		const btn = r.root.findByProps({ testID: "cleanse-confirm" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("cleanse_curses");
		expect(onCleansed).toHaveBeenCalled();
		expect(onDismiss).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("insufficient snouts keeps modal open + shows error", async () => {
		mockRpc.mockResolvedValue({
			data: { ok: false, reason: "insufficient_snouts" },
			error: null,
		});
		const onDismiss = jest.fn();
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={onDismiss} />
		);
		const btn = r.root.findByProps({ testID: "cleanse-confirm" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onDismiss).not.toHaveBeenCalled();
		expect(textOf(r.root)).toContain("Not enough snouts");
		act(() => r.unmount());
	});
});
