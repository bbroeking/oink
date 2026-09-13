// The pre-shell gate chain's accessibility contract (wave 3 · area E).
//
// SupaAuth → UsernameSetup → ReferralCodeEntry → Onboarding is the only path a
// brand-new player can take, and every control on it was hand-rolled before the
// design-system pass: unlabelled Pressables, a dot row that announced nothing,
// and a Save button that dissolved its outline at opacity 0.5 when disabled.
// These lock what the rebuild bought — they are cheap, and the chain is
// unreachable for anyone who already has an account, so nobody notices a
// regression here until a new player does. [E16, E24]
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { Onboarding } from "../components/Onboarding";
import { ReferralCodeEntry } from "../components/ReferralCodeEntry";
import UsernameSetup from "../components/UsernameSetup";

jest.mock("@react-native-async-storage/async-storage", () => ({
	getItem: jest.fn().mockResolvedValue(null),
	setItem: jest.fn().mockResolvedValue(undefined),
	removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-clipboard", () => ({
	getStringAsync: jest.fn().mockResolvedValue(""),
}));
jest.mock("../utils/onboarding", () => ({
	markStorybookSeenServer: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../utils/supabase", () => ({ supabase: {} }));
// The storybook's hero is a Rive/sprite pig; the renderer pulls native
// playback we don't need to assert on here.
jest.mock("../components/ui/PigRenderer", () => ({
	PigRenderer: () => null,
	shouldUseRiveRenderer: () => false,
}));

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

/**
 * Every tappable in the tree, whatever primitive drew it. A Pressable shows up
 * twice (the composite and the host view it renders), so keep the first sighting
 * of each label — that one carries the props the call site actually passed.
 */
interface Tappable {
	accessibilityLabel?: string;
	accessibilityHint?: string;
	accessibilityState: { disabled?: boolean };
	style?: unknown;
	onPress: () => void;
}

function tappables(r: TestRenderer.ReactTestRenderer): Tappable[] {
	const seen = new Map<string, Tappable>();
	for (const node of r.root.findAll(
		(n) =>
			n.props?.accessibilityRole === "button" &&
			typeof n.props?.onPress === "function",
		{ deep: true },
	)) {
		const label = String(node.props.accessibilityLabel);
		if (!seen.has(label)) seen.set(label, node.props as Tappable);
	}
	return [...seen.values()];
}

describe("the storybook announces where you are", () => {
	test("the dot row is a progressbar that says which page of three", async () => {
		const r = await renderAct(<Onboarding onDone={jest.fn()} />);
		const dots = r.root.findByProps({ accessibilityRole: "progressbar" });
		expect(dots.props.accessibilityValue).toEqual({ min: 1, max: 3, now: 1 });
		expect(dots.props.accessibilityLabel).toBeTruthy();
		act(() => r.unmount());
	});

	test("both storybook controls carry a label and a hint", async () => {
		const r = await renderAct(<Onboarding onDone={jest.fn()} />);
		const labels = tappables(r).map((p) => p.accessibilityLabel);
		expect(labels).toEqual(
			expect.arrayContaining(["Skip introduction", "Next introduction page"]),
		);
		for (const p of tappables(r)) {
			expect(p.accessibilityHint).toBeTruthy();
		}
		act(() => r.unmount());
	});

	test("Skip marks the storybook seen and advances", async () => {
		const onDone = jest.fn();
		const r = await renderAct(<Onboarding onDone={onDone} />);
		const skip = tappables(r).find(
			(p) => p.accessibilityLabel === "Skip introduction",
		);
		await act(async () => skip!.onPress());
		expect(onDone).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});
});

describe("a disabled primary CTA keeps its shape", () => {
	test("Save starts disabled-but-announced, never an opacity crush", async () => {
		const r = await renderAct(
			<UsernameSetup userId="u1" onSaved={jest.fn()} />,
		);
		const save = tappables(r).find((p) =>
			String(p.accessibilityLabel).startsWith("Save"),
		);
		expect(save).toBeDefined();
		expect(save!.accessibilityState.disabled).toBe(true);
		// The 2026-07-07 ruling: mute the fill, never dissolve the outline.
		const resolved =
			typeof save!.style === "function"
				? (save!.style as (s: { pressed: boolean }) => unknown)({
						pressed: false,
					})
				: save!.style;
		const flat = Object.assign({}, ...[resolved].flat(Infinity).filter(Boolean));
		expect(flat.opacity).toBeUndefined();
		expect(flat.borderWidth).toBeGreaterThan(0);
		act(() => r.unmount());
	});

	test("Apply starts disabled until a well-formed code is typed", async () => {
		const r = await renderAct(<ReferralCodeEntry onDone={jest.fn()} />);
		const apply = tappables(r).find((p) =>
			String(p.accessibilityLabel).startsWith("Apply invite code"),
		);
		expect(apply!.accessibilityState.disabled).toBe(true);
		expect(apply!.accessibilityHint).toBeTruthy();
		act(() => r.unmount());
	});

	test("Skip on the code step stays reachable and explains itself", async () => {
		const onDone = jest.fn();
		const r = await renderAct(<ReferralCodeEntry onDone={onDone} />);
		const skip = tappables(r).find(
			(p) => p.accessibilityLabel === "Skip the invite code",
		);
		expect(skip!.accessibilityState.disabled).toBe(false);
		await act(async () => skip!.onPress());
		expect(onDone).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});
});
