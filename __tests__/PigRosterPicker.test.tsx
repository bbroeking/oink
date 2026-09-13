// The pig roster sheet after the wave-3 conformance pass: the roster load is a
// LoadingBeat (never an ActivityIndicator), an empty roster is an ERROR rather
// than an empty shelf, and the one permanent choice still asks before it fires.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("@/components/ui/PigPortrait", () => ({ PigPortrait: () => null }));
jest.mock("expo-haptics", () => ({
	selectionAsync: jest.fn(async () => {}),
	notificationAsync: jest.fn(async () => {}),
	NotificationFeedbackType: { Success: "success" },
}));

import { PigRosterPicker } from "@/components/PigRosterPicker";
import { DEFAULT_PIG_ROSTER, type PigRoster } from "@/utils/pigRoster";

const METRICS = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function textOf(tree: TestRenderer.ReactTestInstance): string {
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") {
			out.push(n);
			return;
		}
		for (const c of n.children ?? []) walk(c);
	}
	walk(tree);
	return out.join("");
}

function render(
	overrides: Partial<React.ComponentProps<typeof PigRosterPicker>> = {}
) {
	const props = {
		roster: DEFAULT_PIG_ROSTER,
		loading: false,
		busyPigId: null,
		openSignal: "open",
		onRecruit: jest.fn(async () => ({ ok: true as const, pig_id: "copper" as const })),
		onActivate: jest.fn(async () => ({ ok: true as const, pig_id: "copper" as const })),
		...overrides,
	} as React.ComponentProps<typeof PigRosterPicker>;
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(
			<SafeAreaProvider initialMetrics={METRICS}>
				<PigRosterPicker {...props} />
			</SafeAreaProvider>
		);
	});
	return { r, props };
}

describe("PigRosterPicker", () => {
	it("shows the loading beat, not a spinner, while the roster is in flight", () => {
		const { r } = render({ loading: true });
		expect(textOf(r.root)).toContain("rounding up the pigs");
		expect(r.root.findAllByProps({ testID: "pig-roster-action-rosie" })).toHaveLength(0);
		act(() => r.unmount());
	});

	it("treats an empty roster as an error, never as an empty shelf", () => {
		const empty: PigRoster = { ...DEFAULT_PIG_ROSTER, pigs: [] };
		const { r } = render({ roster: empty });
		expect(textOf(r.root)).toContain("Couldn't round up your pigs");
		act(() => r.unmount());
	});

	// Wave 4: a failed read used to arrive as DEFAULT_PIG_ROSTER — a full shelf
	// with Rosie owned — so the error state was unreachable and the player had
	// nothing to press. `error` renders it, and its action calls `refresh`.
	it("renders the error state with a retry when the read never came back", () => {
		const onRetry = jest.fn();
		const { r } = render({ error: true, onRetry });
		expect(textOf(r.root)).toContain("Couldn't round up your pigs");
		expect(r.root.findAllByProps({ testID: "pig-roster-action-rosie" })).toHaveLength(0);

		const retry = r.root.findAll(
			(node) =>
				node.props?.accessibilityLabel === "Try again" &&
				typeof node.props?.onPress === "function",
		)[0];
		act(() => retry.props.onPress());
		expect(onRetry).toHaveBeenCalledTimes(1);
		act(() => r.unmount());
	});

	it("asks before making the permanent companion choice", async () => {
		const roster: PigRoster = {
			...DEFAULT_PIG_ROSTER,
			isMember: true,
			pigs: DEFAULT_PIG_ROSTER.pigs.map((pig) =>
				pig.id === "copper" ? { ...pig, recruitable: true } : pig
			),
		};
		const { r, props } = render({ roster });

		await act(async () => {
			r.root.findByProps({ testID: "pig-roster-action-copper" }).props.onPress();
		});
		expect(props.onRecruit).not.toHaveBeenCalled();
		expect(textOf(r.root)).toContain("as Rosie’s friend?");

		await act(async () => {
			r.root.findByProps({ testID: "dialog-confirm" }).props.onPress();
		});
		expect(props.onRecruit).toHaveBeenCalledWith("copper");
		act(() => r.unmount());
	});
});
