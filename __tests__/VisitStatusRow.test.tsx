import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated, StyleSheet, View } from "react-native";

import {
	VisitStatusRow,
	STATUS_TAG_H,
} from "@/components/visit/VisitStatusRow";
import { VISIT_TYPE_CAP } from "@/components/visit/chrome";
import { AVATAR_SIZE, PAGE_PAD, SPACE } from "@/constants/theme";

const value = new Animated.Value(0);
const tickStyle = {
	opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
	transform: [
		{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [4, -16] }) },
	],
};

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const row = (
	props: Partial<React.ComponentProps<typeof VisitStatusRow>> = {},
) =>
	render(
		<VisitStatusRow
			youHearts={1}
			hostHearts={11}
			visitsLeft={3}
			visitBudget={3}
			hostName="Maple"
			youAvatar={<View testID="you-avatar" />}
			hostAvatar={<View testID="host-avatar" />}
			tickStyle={tickStyle}
			{...props}
		/>,
	);

describe("VisitStatusRow", () => {
	test("speaks one vocabulary — visits, never barns and never a round", () => {
		expect(
			row().root.findAll((n) => n.props.children === "3 of 3 visits left")
				.length,
		).toBeGreaterThan(0);
		expect(
			row({ visitsLeft: 0 }).root.findAll(
				(n) => n.props.children === "0 visits left",
			).length,
		).toBeGreaterThan(0);
	});

	test("each tally wears its pig instead of a name kicker", () => {
		const tree = row();
		expect(
			tree.root.findAll(
				(n) => typeof n.type === "string" && n.props.testID === "you-avatar",
			),
		).toHaveLength(1);
		expect(
			tree.root.findAll(
				(n) => typeof n.type === "string" && n.props.testID === "host-avatar",
			),
		).toHaveLength(1);
		// The scoreboard's YOU / <NAME> kickers are gone; the name survives only
		// as a screen-reader label.
		expect(tree.root.findAll((n) => n.props.children === "YOU")).toEqual([]);
		expect(tree.root.findAll((n) => n.props.children === "MAPLE")).toEqual([]);
		expect(
			tree.root.findAll(
				(n) => n.props.accessibilityLabel === "Maple's hearts, 11",
			).length,
		).toBeGreaterThan(0);
	});

	test("the capsules wrap and the avatar sets the row's height", () => {
		const tree = row();
		const wrapping = tree.root.findAll(
			(n) =>
				typeof n.type === "string" &&
				StyleSheet.flatten(n.props.style)?.flexWrap === "wrap",
		);
		expect(wrapping.length).toBe(1);
		const rowStyle = StyleSheet.flatten(wrapping[0].props.style);
		expect(rowStyle.gap).toBe(SPACE.sm);
		// `flexWrap` needs a DEFINITE width to find a line to break on: left to
		// size itself the row measured at its content and ran off the screen edge
		// instead of wrapping. (2026-09-12 device re-check.)
		expect(rowStyle.width).toBe("100%");
		expect(rowStyle.alignSelf).toBe("stretch");
		expect(STATUS_TAG_H).toBe(AVATAR_SIZE[0]);
	});

	test("no capsule may be wider than the row, so the third wraps instead of overflowing", () => {
		// The device pass found "2 of 3 visits left" running off the right edge:
		// a Tag measures at its content width (React Native defaults flexShrink
		// to 0), so nothing stopped it growing past the row. Every capsule — and
		// the tally wrapper that carries the "+1 ♥" float — now carries a
		// maxWidth ceiling, and the label inside Tag can shrink into it.
		const tree = row();
		const capsules = tree.root.findAll(
			(n) =>
				typeof n.type === "string" &&
				StyleSheet.flatten(n.props.style)?.borderRadius !== undefined &&
				StyleSheet.flatten(n.props.style)?.flexDirection === "row",
		);
		expect(capsules).toHaveLength(3);
		const floatWrappers = tree.root.findAll(
			(n) =>
				typeof n.type === "string" &&
				StyleSheet.flatten(n.props.style)?.position === "relative",
		);
		expect(floatWrappers).toHaveLength(2);
		for (const wrapper of floatWrappers)
			expect(StyleSheet.flatten(wrapper.props.style).maxWidth).toBe("100%");
		for (const capsule of capsules) {
			const style = StyleSheet.flatten(capsule.props.style);
			expect(style.maxWidth).toBe("100%");
			expect(style.width).toBeUndefined();
			// A fixed `flexShrink: 0` on the root would defeat the ceiling.
			expect(style.flexShrink).not.toBe(0);
		}
	});

	test("the whole row takes the visit chrome's Dynamic Type ceiling", () => {
		const tree = row();
		const texts = tree.root.findAll(
			(n) => typeof n.type === "string" && typeof n.props.children === "string",
		);
		expect(texts.length).toBeGreaterThan(0);
		for (const text of texts)
			expect(text.props.maxFontSizeMultiplier).toBe(VISIT_TYPE_CAP);
	});

	test("at 1.3x on a 375pt phone the three capsules need two lines", () => {
		// The widths the wrap has to survive, measured at the cap: each tally is
		// ~100pt (32pt avatar + a 14pt heart + a 3-4 digit numeral + the capsule's
		// pads), and the visit counter is ~150pt. The row's content width is the
		// screen less PAGE_PAD on both sides.
		const content = 375 - PAGE_PAD * 2;
		const tally = 100;
		const counter = 150;
		// Two tallies and one gap fit on line one…
		expect(tally + SPACE.sm + tally).toBeLessThanOrEqual(content);
		// …and the counter does not follow them, so it takes line two…
		expect(tally + SPACE.sm + tally + SPACE.sm + counter).toBeGreaterThan(
			content,
		);
		// …where it fits whole rather than running off the edge.
		expect(counter).toBeLessThanOrEqual(content);
	});

	test("the +1 float rides the tally that gained the heart", () => {
		const tree = row();
		const floats = tree.root.findAll(
			(n) => typeof n.type === "string" && n.props.children === "+1",
		);
		expect(floats).toHaveLength(2);
	});
});
