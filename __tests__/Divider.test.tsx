import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";

import { Divider, TitleRule } from "../components/ui/Divider";
import {
	BORDER,
	RULE_WIDTH,
	SPACE,
	TITLE_RULE,
	WHIMSY,
} from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("Divider and TitleRule", () => {
	test("draws a warm paper hairline, not a cool grey line", () => {
		const renderer = render(<Divider />);

		const style = StyleSheet.flatten(
			renderer.root.findByType(View).props.style,
		);
		expect(style.height).toBe(BORDER.hair);
		expect(style.backgroundColor).toBe(WHIMSY.barkMute);
		expect(style.marginVertical).toBe(SPACE.md);
		act(() => renderer.unmount());
	});

	test("takes its breathing room from a SPACE step", () => {
		const renderer = render(<Divider space="xl" />);

		expect(
			StyleSheet.flatten(renderer.root.findByType(View).props.style)
				.marginVertical,
		).toBe(SPACE.xl);
		act(() => renderer.unmount());
	});

	test("keeps both rules out of the accessibility tree", () => {
		const divider = render(<Divider />);
		const dividerNode = divider.root.findByType(View);
		expect(dividerNode.props.accessible).toBe(false);
		expect(dividerNode.props.importantForAccessibility).toBe(
			"no-hide-descendants",
		);
		act(() => divider.unmount());

		const rule = render(<TitleRule />);
		expect(rule.root.findByType(View).props.accessible).toBe(false);
		act(() => rule.unmount());
	});

	test("TitleRule is the canonical ink underline at RULE_WIDTH", () => {
		const renderer = render(<TitleRule />);

		const style = StyleSheet.flatten(
			renderer.root.findByType(View).props.style,
		);
		expect(style.width).toBe(RULE_WIDTH);
		expect(style.height).toBe(TITLE_RULE.height);
		expect(style.backgroundColor).toBe(TITLE_RULE.backgroundColor);
		expect(style.opacity).toBe(TITLE_RULE.opacity);
		act(() => renderer.unmount());
	});
});
