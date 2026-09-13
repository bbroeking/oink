import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text as RNText, View } from "react-native";

import { ProgressTrack } from "../components/ui/ProgressTrack";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

function track(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root.find(
		(node) =>
			node.type === View && node.props.accessibilityRole === "progressbar",
	);
}

// The fill is the only View *inside* the track; `findAll` includes the receiver,
// so the track itself is filtered out explicitly.
function fills(bar: TestRenderer.ReactTestInstance) {
	return bar.findAll((node) => node !== bar && node.type === View);
}

describe("ProgressTrack meter", () => {
	test("announces itself as a progressbar carrying its value", () => {
		const renderer = render(
			<ProgressTrack value={62} max={100} label="the great hunger" />,
		);

		const bar = track(renderer);
		expect(bar.props.accessibilityValue).toEqual({
			min: 0,
			max: 100,
			now: 62,
		});
		expect(bar.props.accessibilityLabel).toBe("the great hunger");
		act(() => renderer.unmount());
	});

	test("wears the ink capsule outline on paper with a pastel fill", () => {
		const renderer = render(<ProgressTrack value={1} max={4} tone="sun" />);

		const bar = track(renderer);
		const barStyle = StyleSheet.flatten(bar.props.style);
		expect(barStyle.borderRadius).toBe(RADII.pill);
		expect(barStyle.borderWidth).toBe(BORDER.ink);
		expect(barStyle.borderColor).toBe(UI_COLORS.border);
		expect(barStyle.backgroundColor).toBe(UI_COLORS.surface);
		expect(barStyle.height).toBe(SPACE.lg);

		const fill = StyleSheet.flatten(fills(bar)[0].props.style);
		expect(fill.width).toBe("25%");
		expect(fill.backgroundColor).toBe(WHIMSY.sun);
		expect(fill.borderRightWidth).toBe(BORDER.ink);
		act(() => renderer.unmount());
	});

	test("clamps out-of-range values and a zero max", () => {
		const over = render(<ProgressTrack value={7} max={5} />);
		const overBar = track(over);
		expect(overBar.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 5 });
		expect(StyleSheet.flatten(fills(overBar)[0].props.style).width).toBe(
			"100%",
		);
		act(() => over.unmount());

		const under = render(<ProgressTrack value={-3} max={0} />);
		const underBar = track(under);
		expect(underBar.props.accessibilityValue).toEqual({
			min: 0,
			max: 0,
			now: 0,
		});
		expect(fills(underBar)).toHaveLength(0);
		act(() => under.unmount());
	});

	test("uses the short capsule at height sm", () => {
		const renderer = render(<ProgressTrack value={2} max={4} height="sm" />);

		expect(StyleSheet.flatten(track(renderer).props.style).height).toBe(
			SPACE.md,
		);
		act(() => renderer.unmount());
	});

	test("renders a visible caption row only when labelled", () => {
		const bare = render(<ProgressTrack value={2} max={4} />);
		expect(bare.root.findAllByType(RNText)).toHaveLength(0);
		act(() => bare.unmount());

		const labelled = render(
			<ProgressTrack value={2} max={4} label="zoomies" />,
		);
		const texts = labelled.root.findAllByType(RNText);
		expect(texts).toHaveLength(2);
		expect(texts[0].props.children).toBe("zoomies");
		expect(texts[1].props.children).toBe("2/4");
		act(() => labelled.unmount());
	});
});
