// AlignmentSchismModal renders correct copy for each side, formats
// the score with a leading + for positive values, and fires both
// the mark_schism_seen RPC and onDismiss when the button is pressed.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

// Mock supabase client BEFORE importing the component so its top-level
// import resolves to the stub. We only care that rpc is called with
// the right args + that the resolved value flows through.
const mockRpc = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
jest.mock("../utils/supabase", () => ({
	supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock("expo-haptics", () => ({
	notificationAsync: jest.fn().mockResolvedValue(undefined),
	NotificationFeedbackType: { Success: "success" },
}));

import { AlignmentSchismModal } from "../components/AlignmentSchismModal";

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(node: TestRenderer.ReactTestInstance | string) {
		if (typeof node === "string") { out.push(node); return; }
		for (const c of node.children ?? []) walk(c as any);
	}
	walk(tree);
	return out.join("");
}

// Helper: render under act() so the Animated.parallel that fires
// on mount completes inside the act batch (otherwise we get spurious
// act-warnings from late spring callbacks).
async function renderAct(node: React.ReactElement): Promise<TestRenderer.ReactTestRenderer> {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("AlignmentSchismModal", () => {
	let renderer: TestRenderer.ReactTestRenderer | null = null;

	beforeEach(() => {
		mockRpc.mockClear();
	});
	afterEach(() => {
		// Unmount so Animated timers tied to the instance don't fire
		// after the test boundary (would cause "jest environment torn
		// down" warnings).
		if (renderer) {
			act(() => { renderer!.unmount(); });
			renderer = null;
		}
	});

	test("angel side shows Generous headline + signed positive score", async () => {
		renderer = await renderAct(
			<AlignmentSchismModal side="angel" score={28} onDismiss={() => {}} />
		);
		const text = textOf(renderer.root);
		expect(text).toContain("becoming Generous");
		expect(text).toContain("+28");
		expect(renderer.root.findAllByProps({ name: "halo" }).length).toBeGreaterThan(0);
	});

	test("goblin side shows Greedy headline + negative score (no leading +)", async () => {
		renderer = await renderAct(
			<AlignmentSchismModal side="goblin" score={-28} onDismiss={() => {}} />
		);
		const text = textOf(renderer.root);
		expect(text).toContain("becoming Greedy");
		expect(text).toContain("-28");
		expect(renderer.root.findAllByProps({ name: "horns" }).length).toBeGreaterThan(0);
	});

	test("dismiss button calls mark_schism_seen with the side + onDismiss", async () => {
		const onDismiss = jest.fn();
		renderer = await renderAct(
			<AlignmentSchismModal side="angel" score={30} onDismiss={onDismiss} />
		);
		const btn = renderer.root.findByProps({ testID: "schism-dismiss" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("mark_schism_seen", { side: "angel" });
		expect(onDismiss).toHaveBeenCalled();
	});

	test("dismiss still fires onDismiss even if rpc throws", async () => {
		mockRpc.mockRejectedValueOnce(new Error("network down"));
		const onDismiss = jest.fn();
		renderer = await renderAct(
			<AlignmentSchismModal side="goblin" score={-30} onDismiss={onDismiss} />
		);
		const btn = renderer.root.findByProps({ testID: "schism-dismiss" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(onDismiss).toHaveBeenCalled();
	});
});
