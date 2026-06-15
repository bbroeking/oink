// JudgementDayModal renders the right headline per bracket, shows
// the earned title + snouts, and fires mark_finale_seen + onDismiss
// on the Onward button.

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

import { JudgementDayModal, type FinaleResult } from "../components/JudgementDayModal";

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") { out.push(n); return; }
		for (const c of n.children ?? []) walk(c);
	}
	walk(tree);
	return out.join("");
}

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => { r = TestRenderer.create(node); });
	return r;
}

const base: FinaleResult = {
	season_key: "season_1",
	final_score: 88,
	side: "generous",
	side_rank: 1,
	bracket: "top3",
	title_id: "halo_bearer_2026",
	title_name: "Halo Bearer 2026",
	snouts: 500,
};

describe("JudgementDayModal", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: { ok: true }, error: null });
	});

	// Redesigned headlines drop the leading "A" and trailing "!" per
	// the design's full-screen verdict treatment ("Halo Bearer" /
	// "Goblin King"). The AlignmentEmblem icons were replaced with a
	// single ⚖ glyph + light rays, so the kind: assertions are gone.
	test("top3 generous → Halo Bearer headline", async () => {
		const r = await renderAct(
			<JudgementDayModal result={base} onDismiss={() => {}} />
		);
		expect(textOf(r.root)).toContain("Halo Bearer");
		act(() => r.unmount());
	});

	test("top3 greedy → Goblin King headline", async () => {
		const greedy: FinaleResult = {
			...base,
			side: "greedy",
			final_score: -91,
			title_id: "goblin_king_2026",
			title_name: "Goblin King 2026",
		};
		const r = await renderAct(
			<JudgementDayModal result={greedy} onDismiss={() => {}} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Goblin King");
		expect(text).toContain("-91");
		act(() => r.unmount());
	});

	test("neutral bracket → Calm in the Storm, no rank line", async () => {
		const neutral: FinaleResult = {
			season_key: "season_1",
			final_score: 0,
			side: "neutral",
			side_rank: null,
			bracket: "neutral",
			title_id: "calm_in_the_storm",
			title_name: "Calm in the Storm",
			snouts: 100,
		};
		const r = await renderAct(
			<JudgementDayModal result={neutral} onDismiss={() => {}} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Calm in the Storm");
		expect(text).not.toContain("most generous");
		act(() => r.unmount());
	});

	test("shows the earned title + snout reward", async () => {
		const r = await renderAct(
			<JudgementDayModal result={base} onDismiss={() => {}} />
		);
		const text = textOf(r.root);
		expect(text).toContain("Halo Bearer 2026");
		expect(text).toContain("+500 snouts");
		act(() => r.unmount());
	});

	test("Onward calls mark_finale_seen with season_key + onDismiss", async () => {
		const onDismiss = jest.fn();
		const r = await renderAct(
			<JudgementDayModal result={base} onDismiss={onDismiss} />
		);
		const btn = r.root.findByProps({ testID: "finale-dismiss" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("mark_finale_seen", {
			target_season_key: "season_1",
		});
		expect(onDismiss).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("participant bracket shows the generous-soul headline", async () => {
		const participant: FinaleResult = {
			...base,
			bracket: "participant",
			side_rank: 42,
			title_id: "schism_survivor",
			title_name: "Schism Survivor",
			snouts: 100,
		};
		const r = await renderAct(
			<JudgementDayModal result={participant} onDismiss={() => {}} />
		);
		expect(textOf(r.root)).toContain("Generous Soul");
		act(() => r.unmount());
	});
});
