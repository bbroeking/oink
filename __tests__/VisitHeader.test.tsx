import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { VisitHeader } from "@/components/visit/VisitHeader";
import { VISIT_TYPE_CAP } from "@/components/visit/chrome";
import { TAP_MIN } from "@/constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("VisitHeader", () => {
	test("writes the host's name once, as one text node", () => {
		const tree = render(
			<VisitHeader hostName="Maple" onLeave={jest.fn()} />,
		);
		expect(tree.root.findAllByProps({ children: "Maple's Barn" }).length)
			.toBeGreaterThan(0);
		// The removed "VISITING" kicker never comes back: the plaque is the star
		// plus the name, and nothing else.
		expect(tree.root.findAll((n) => n.props.children === "VISITING")).toEqual(
			[],
		);
	});

	test("caps Dynamic Type so the fixed-height row cannot clip", () => {
		const tree = render(
			<VisitHeader hostName="Maple" onLeave={jest.fn()} />,
		);
		const title = tree.root.find(
			(n) => n.props.children === "Maple's Barn" && !!n.props.numberOfLines,
		);
		expect(title.props.maxFontSizeMultiplier).toBe(1.3);
		expect(title.props.numberOfLines).toBe(1);
	});

	test("the Leave pill's own label takes the same ceiling", () => {
		// It clipped to "× Lea" at accessibility-medium: the plaque was capped,
		// the button beside it was not. (2026-09-12 device pass.)
		const tree = render(<VisitHeader hostName="Maple" onLeave={jest.fn()} />);
		const labels = tree.root.findAll(
			(n) => typeof n.type === "string" && n.props.children === "Leave",
		);
		expect(labels).toHaveLength(1);
		expect(labels[0].props.maxFontSizeMultiplier).toBe(VISIT_TYPE_CAP);
	});

	test("the plaque is the only thing in the row that gives", () => {
		// The Leave pill rendered "× Leav": a Button label is shrinkable by
		// design, so in a space-between row the way out was what yielded. The
		// plaque shrinks (and truncates, which it is built to do); the pill does
		// not. `minWidth: 0` is what lets the plaque give at all — a flex item is
		// otherwise floored at its content width. (2026-09-12 device re-check.)
		const tree = render(<VisitHeader hostName="Maple" onLeave={jest.fn()} />);
		const boxes = tree.root.findAll(
			(n) => typeof n.type === "string" && String(n.type) !== "Text",
		);
		const shrinking = boxes.filter(
			(n) => StyleSheet.flatten(n.props.style)?.flexShrink === 1,
		);
		// Exactly one box in the row gives, and it is the one that truncates.
		expect(shrinking).toHaveLength(1);
		expect(StyleSheet.flatten(shrinking[0].props.style).minWidth).toBe(0);

		const fixed = boxes.filter(
			(n) => StyleSheet.flatten(n.props.style)?.flexShrink === 0,
		);
		expect(fixed).toHaveLength(1);
	});

	test("Leave is a labelled primitive button in a TAP_MIN row", () => {
		const onLeave = jest.fn();
		const tree = render(
			<VisitHeader hostName="Maple" onLeave={onLeave} />,
		);
		const leave = tree.root.find(
			(n) => n.props.accessibilityLabel === "Leave Maple's barn",
		);
		expect(leave.props.accessibilityHint).toBe(
			"Ends this visit and heads back to your Barn",
		);
		act(() => leave.props.onPress());
		expect(onLeave).toHaveBeenCalledTimes(1);

		const row = tree.root.findAll(
			(n) =>
				typeof n.type === "string" &&
				StyleSheet.flatten(n.props.style)?.height === TAP_MIN,
		);
		expect(row.length).toBeGreaterThan(0);
	});
});
