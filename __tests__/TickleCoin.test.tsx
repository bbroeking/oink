import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, View } from "react-native";

import { TickleCoin } from "../components/TickleCoin";
import { WHIMSY } from "../constants/theme";

const props = {
	count: 7,
	cap: 10,
	streak: 0,
	nextRegenSeconds: null,
	regenSeconds: 3600,
	fetchedAtMs: 0,
	onPress: jest.fn(),
};

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const rankTag = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.findAll(
		(node) =>
			node.type === View &&
			typeof node.props.accessibilityLabel === "string" &&
			node.props.accessibilityLabel.startsWith("Wallow Rank"),
	);

describe("The Home coin's Wallow rank", () => {
	// The rank mark is part of the counter — a gilt tag behind the count —
	// and never a layer on Rosie (docs/prestige-wallow-spec.md, 2026-09-22).
	test("W0 shows the counter alone", () => {
		const renderer = render(<TickleCoin {...props} />);
		expect(rankTag(renderer)).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("a ranked pig wears a gilt W tag it can speak", () => {
		const renderer = render(<TickleCoin {...props} wallowRank={12} />);
		const [tag] = rankTag(renderer);
		expect(tag).toBeDefined();
		expect(tag.props.accessibilityLabel).toBe("Wallow Rank 12");
		const style = StyleSheet.flatten(tag.props.style);
		expect(style.backgroundColor).toBe(WHIMSY.prestige);
		expect(style.borderColor).toBe(WHIMSY.ink);
		expect(style.position).toBe("absolute");
		// It reads "W12", on one line, tucked under the coin's rim.
		expect(
			tag.findAll(
				(node) =>
					Array.isArray(node.props.children) &&
					node.props.children.join("") === "W12" &&
					node.props.numberOfLines === 1,
			).length,
		).toBeGreaterThan(0);
		act(() => renderer.unmount());
	});
});
