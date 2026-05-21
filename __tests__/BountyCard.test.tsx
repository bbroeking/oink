// BountyCard renders the three states (in-progress, ready, claimed)
// and, when ready, claims via claim_bounty + fires onClaimed.

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

import { BountyCard, type WeeklyBounty } from "../components/BountyCard";

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

const base: WeeklyBounty = {
	code: "generous_hoof",
	name: "Generous Hoof",
	description: "Fulfill 3 trade requests this week.",
	goal: 3,
	progress: 1,
	reward_snouts: 150,
	claimed: false,
};

describe("BountyCard", () => {
	beforeEach(() => {
		mockRpc.mockReset();
		mockRpc.mockResolvedValue({ data: { ok: true, reward_snouts: 150 }, error: null });
	});

	test("in-progress shows the progress count + 'In progress'", async () => {
		const r = await renderAct(<BountyCard bounty={base} tilt={0} />);
		const text = textOf(r.root);
		expect(text).toContain("1 / 3");
		expect(text).toContain("In progress");
		act(() => r.unmount());
	});

	test("ready (progress >= goal, unclaimed) shows Claim reward", async () => {
		const ready = { ...base, progress: 3 };
		const r = await renderAct(<BountyCard bounty={ready} tilt={0} />);
		expect(textOf(r.root)).toContain("Claim reward");
		act(() => r.unmount());
	});

	test("claimed shows the Claimed tag, no claim button", async () => {
		const claimed = { ...base, progress: 3, claimed: true };
		const r = await renderAct(<BountyCard bounty={claimed} tilt={0} />);
		expect(textOf(r.root)).toContain("Claimed ✓");
		expect(
			r.root.findAllByProps({ testID: "bounty-claim-generous_hoof" })
		).toHaveLength(0);
		act(() => r.unmount());
	});

	test("progress count clamps to goal even if progress overshoots", async () => {
		const over = { ...base, progress: 9 };
		const r = await renderAct(<BountyCard bounty={over} tilt={0} />);
		expect(textOf(r.root)).toContain("3 / 3");
		act(() => r.unmount());
	});

	test("claiming a ready bounty calls claim_bounty + fires onClaimed", async () => {
		const onClaimed = jest.fn();
		const ready = { ...base, progress: 3 };
		const r = await renderAct(
			<BountyCard bounty={ready} tilt={0} onClaimed={onClaimed} />
		);
		const btn = r.root.findByProps({ testID: "bounty-claim-generous_hoof" });
		await act(async () => {
			btn.props.onPress();
			await Promise.resolve();
		});
		expect(mockRpc).toHaveBeenCalledWith("claim_bounty", {
			bounty_code: "generous_hoof",
		});
		expect(onClaimed).toHaveBeenCalled();
		act(() => r.unmount());
	});
});
