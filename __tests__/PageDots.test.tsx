import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";

import { PageDots } from "../components/ui/PageDots";
import { RADII, SPACE, UI_COLORS, WHIMSY } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const row = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.find((n) => n.props.accessibilityRole === "progressbar");

describe("PageDots", () => {
	test("announces its position instead of being silent squares", () => {
		const renderer = render(<PageDots count={3} index={1} />);

		expect(row(renderer).props.accessibilityLabel).toBe("2 of 3");
		expect(row(renderer).props.accessibilityValue).toEqual({
			min: 1,
			max: 3,
			now: 2,
		});
		act(() => renderer.unmount());
	});

	test("a label names the pager before the position", () => {
		const renderer = render(
			<PageDots count={3} index={0} label="Introduction page" />,
		);

		expect(row(renderer).props.accessibilityLabel).toBe(
			"Introduction page, 1 of 3",
		);
		act(() => renderer.unmount());
	});

	test("draws one dot per page, on tokens, gapped by SPACE.xs", () => {
		const renderer = render(<PageDots count={4} index={0} />);

		const dots = renderer.root.findAllByType(View).slice(1);
		expect(dots).toHaveLength(4);
		expect(StyleSheet.flatten(row(renderer).props.style).gap).toBe(SPACE.xs);

		const rest = StyleSheet.flatten(dots[1].props.style);
		expect(rest.width).toBe(SPACE.sm);
		expect(rest.height).toBe(SPACE.sm);
		expect(rest.borderRadius).toBe(RADII.pill);
		expect(rest.backgroundColor).toBe(UI_COLORS.uiMuted);
		act(() => renderer.unmount());
	});

	test("the current page is ink and longer — never colour alone", () => {
		const renderer = render(<PageDots count={3} index={2} />);

		const dots = renderer.root.findAllByType(View).slice(1);
		const active = StyleSheet.flatten(dots[2].props.style);
		expect(active.backgroundColor).toBe(WHIMSY.ink);
		expect(active.width).toBeGreaterThan(SPACE.sm);
		act(() => renderer.unmount());
	});

	test("clamps an out-of-range index rather than announcing '0 of 3'", () => {
		const renderer = render(<PageDots count={3} index={-1} />);

		expect(row(renderer).props.accessibilityLabel).toBe("1 of 3");
		act(() => renderer.unmount());
	});
});
