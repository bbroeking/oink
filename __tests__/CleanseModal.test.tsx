// CleanseModal is pure UI: lists the caller's active curses and,
// on confirm, awaits the onConfirm callback. The cleanse mutation
// lives in useActiveEffects; here we only verify the modal's UX
// branches react correctly to the result.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success" },
}));

import { CleanseModal } from "../components/CleanseModal";
import type { Effect } from "../utils/activeEffects";

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") { out.push(n); return; }
		for (const c of n.children ?? []) walk(c);
	}
	walk(tree);
	return out.join("");
}

// The modal now mounts through AdaptiveModalScaffold, which reads the safe-area
// insets — so the harness supplies a provider with fixed metrics.
const METRICS = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(
			<SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>
		);
	});
	return r;
}

const curse = (kind: string, expires_at: string): Effect => ({
	source: "curse",
	kind,
	expires_at,
	sender_id: null,
	sender_username: null,
});

const oneCurse: Effect[] = [curse("sluggish_snout", "2026-05-21T12:00:00Z")];
const twoCurses: Effect[] = [
	curse("sluggish_snout", "2026-05-21T12:00:00Z"),
	curse("goblin_whisper", "2026-05-21T15:00:00Z"),
];

const okConfirm = () => Promise.resolve({ ok: true, cleared: 1 });

describe("CleanseModal", () => {
	test("singular headline for one curse", async () => {
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={() => {}} onConfirm={okConfirm} />
		);
		expect(textOf(r.root)).toContain("A curse clings to you");
		act(() => r.unmount());
	});

	test("plural headline + count for multiple curses", async () => {
		const r = await renderAct(
			<CleanseModal curses={twoCurses} onDismiss={() => {}} onConfirm={okConfirm} />
		);
		expect(textOf(r.root)).toContain("2 curses cling to you");
		act(() => r.unmount());
	});

	test("lists each curse's display name", async () => {
		const r = await renderAct(
			<CleanseModal curses={twoCurses} onDismiss={() => {}} onConfirm={okConfirm} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Sluggish Snout");
		expect(text).toContain("Goblin Whisper");
		act(() => r.unmount());
	});

	test("confirm invokes onConfirm then onDismiss on success", async () => {
		const onDismiss = jest.fn();
		const onConfirm = jest.fn().mockResolvedValue({ ok: true, cleared: 1 });
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={onDismiss} onConfirm={onConfirm} />
		);
		const btn = r.root.findByProps({ testID: "dialog-confirm" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onConfirm).toHaveBeenCalled();
		expect(onDismiss).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("insufficient snouts result keeps modal open + shows error", async () => {
		const onDismiss = jest.fn();
		const onConfirm = jest.fn().mockResolvedValue({
			ok: false,
			reason: "insufficient_snouts",
		});
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={onDismiss} onConfirm={onConfirm} />
		);
		const btn = r.root.findByProps({ testID: "dialog-confirm" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onDismiss).not.toHaveBeenCalled();
		expect(textOf(r.root)).toContain("Not enough snouts");
		act(() => r.unmount());
	});

	// Audit A-05: a control that spends currency states its cost on its own face
	// AND in its accessibility label, with role + disabled state.
	test("the confirm names the cost and carries role + state", async () => {
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={() => {}} onConfirm={okConfirm} />
		);
		// `findByProps` is shallow, and the shallowest match is the `Button`
		// element; the a11y props live on the Pressable it renders.
		const btn = r.root.findAll(
			(n) => n.props.testID === "dialog-confirm" && !!n.props.accessibilityRole
		)[0];
		expect(btn.props.accessibilityRole).toBe("button");
		expect(btn.props.accessibilityLabel).toContain("5");
		expect(btn.props.accessibilityState).toEqual(
			expect.objectContaining({ disabled: false })
		);
		expect(textOf(r.root)).toContain("Cleanse for 5");
		act(() => r.unmount());
	});

	test("generic failure shows fallback error copy", async () => {
		const onDismiss = jest.fn();
		const onConfirm = jest.fn().mockResolvedValue({ ok: false });
		const r = await renderAct(
			<CleanseModal curses={oneCurse} onDismiss={onDismiss} onConfirm={onConfirm} />
		);
		const btn = r.root.findByProps({ testID: "dialog-confirm" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onDismiss).not.toHaveBeenCalled();
		expect(textOf(r.root)).toContain("Couldn't cleanse");
		act(() => r.unmount());
	});
});
