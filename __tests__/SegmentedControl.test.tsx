import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { SegmentedControl } from "../components/ui/SegmentedControl";

const OPTIONS = [
	{ value: "outside" as const, label: "Outside" },
	{ value: "inside" as const, label: "Inside" },
];

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const control = (
	props: Partial<React.ComponentProps<typeof SegmentedControl>> = {},
) =>
	render(
		<SegmentedControl
			label="Where in the barn"
			options={OPTIONS}
			value="outside"
			onChange={jest.fn()}
			{...props}
		/>,
	);

describe("SegmentedControl Dynamic Type", () => {
	test("forwards a ceiling to every segment, and defaults to none", () => {
		// The default is NO cap — a filter control in a scroll grows with the
		// text and takes its two lines.
		for (const label of control().root.findAllByType(Text))
			expect(label.props.maxFontSizeMultiplier).toBe(undefined);

		// A control that FLOATS over a fixed stage (the visit's Outside/Inside
		// toggle) has nowhere to grow, so it asks for the chrome cap and every
		// segment takes it.
		const capped = control({ maxFontSizeMultiplier: 1.3 }).root.findAllByType(
			Text,
		);
		expect(capped).toHaveLength(2);
		for (const label of capped)
			expect(label.props.maxFontSizeMultiplier).toBe(1.3);
	});

	test("a segment grows to its label rather than squeezing the word inside it", () => {
		// The bug, twice: at an uncapped text size "Outside" / "Inside" clipped to
		// "O" / "I", and with the cap they ellipsized to "Out…" / "In…". Both come
		// from `flex: 1` — React Native's shorthand sets flexBasis **0**, so a
		// segment measured as zero-width and a content-sized track (the visit's
		// floating toggle) collapsed to its `minWidth` and squeezed the labels.
		// The segment now measures at its label; the label itself never gives.
		// (2026-09-12 visit device pass.)
		const tree = control({
			maxFontSizeMultiplier: 1.3,
			options: [
				{ value: "outside" as const, label: "Outside in the yard" },
				{ value: "inside" as const, label: "Inside the barn" },
			],
			value: "outside",
		});

		for (const label of tree.root.findAllByType(Text)) {
			const style = StyleSheet.flatten(label.props.style);
			// Nothing pins the label to a width, and it cannot be shrunk below the
			// word it is showing.
			expect(style.width).toBeUndefined();
			expect(style.maxWidth).toBeUndefined();
			expect(style.flexShrink).toBe(0);
			expect(label.props.numberOfLines).toBe(2);
			expect(label.props.maxFontSizeMultiplier).toBe(1.3);
		}

		const segments = tree.root.findAll(
			(n) =>
				n.props.accessibilityRole === "radio" &&
				typeof n.props.style === "function",
		);
		expect(segments).toHaveLength(2);
		for (const segment of segments) {
			const style = StyleSheet.flatten(
				segment.props.style({ pressed: false }),
			);
			// The segment measures at its content and grows into any leftover —
			// it is never based at zero, and never a fixed width.
			expect(style.flexBasis).toBe("auto");
			expect(style.flexGrow).toBe(1);
			expect(style.flex).toBeUndefined();
			expect(style.width).toBeUndefined();
		}
	});
});
