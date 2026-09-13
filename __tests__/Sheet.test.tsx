import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Modal, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Sheet } from "../components/ui/Sheet";
import { ActionSheet } from "../components/ui/ActionSheet";
import { MOTION, RADII, SPACE, TAP_MIN } from "../constants/theme";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function inSafeArea(node: React.ReactNode) {
	return <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
}

describe("Sheet", () => {
	test("wears the flush top-corner panel with a safe-area bottom and a scrolling body", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				inSafeArea(
					<Sheet
						open
						onClose={() => {}}
						title="Hoofprints on you"
						subtitle="3 blessings · 1 curse"
						testID="sheet-panel"
						footer={<Text>pinned footer</Text>}
					>
						<Text>body</Text>
					</Sheet>,
				),
			);
		});

		const panel = renderer.root
			.findAll((node) => node.props.testID === "sheet-panel")
			.at(-1)!;
		expect(panel.props.accessibilityViewIsModal).toBe(true);

		// The paper Sticker is the panel's only child: top corners only, and a
		// bottom pad of one loose step plus the home indicator — the Modal sits
		// above the tab bar, so there is nothing else to clear.
		const sticker = panel.findAll(
			(node) =>
				typeof node.type !== "string" ? false : !!node.props.style,
		);
		const panelStyle = sticker
			.map((node) => StyleSheet.flatten(node.props.style))
			.find((style) => style?.borderTopLeftRadius === RADII.xl)!;
		expect(panelStyle.borderTopLeftRadius).toBe(RADII.xl);
		expect(panelStyle.borderTopRightRadius).toBe(RADII.xl);
		expect(panelStyle.borderRadius).toBe(0);
		expect(panelStyle.paddingBottom).toBe(SPACE.xl + metrics.insets.bottom);
		expect(typeof panelStyle.maxHeight).toBe("number");

		expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
		expect(
			renderer.root.findAll((node) => node.props.children === "pinned footer"),
		).not.toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("gives the title row a named 44pt close target", () => {
		const onClose = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				inSafeArea(
					<Sheet open onClose={onClose} title="Pick a place" closeLabel="Close">
						<Text>body</Text>
					</Sheet>,
				),
			);
		});

		const close = renderer.root.findAll(
			(node) =>
				node.props.accessibilityRole === "button" &&
				node.props.accessibilityLabel === "Close" &&
				typeof node.props.style === "function",
		)[0];
		expect(close).toBeDefined();
		const style = StyleSheet.flatten(close.props.style({ pressed: false }));
		expect(style.width).toBe(TAP_MIN);
		expect(style.height).toBe(TAP_MIN);
		act(() => close.props.onPress());
		expect(onClose).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("renders nothing while closed", () => {
		const renderer = TestRenderer.create(
			inSafeArea(
				<Sheet open={false} onClose={() => {}} title="Closed">
					<Text>body</Text>
				</Sheet>,
			),
		);
		expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
		act(() => renderer.unmount());
	});
});

describe("ActionSheet on the Sheet panel", () => {
	test("dismisses first and runs the destination a modal-handoff beat later", () => {
		jest.useFakeTimers();
		const onClose = jest.fn();
		const go = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				inSafeArea(
					<ActionSheet
						open
						onClose={onClose}
						title="Where to?"
						subtitle="pick one"
						items={[{ label: "Mote Machine", onPress: go }]}
					/>,
				),
			);
		});

		const item = renderer.root.findAll(
			(node) =>
				node.props.accessibilityRole === "button" &&
				node.props.accessibilityLabel === "Mote Machine",
		)[0];
		act(() => item.props.onPress());
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(go).not.toHaveBeenCalled();
		act(() => {
			jest.advanceTimersByTime(MOTION.modalHandoff);
		});
		expect(go).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
		jest.useRealTimers();
	});
});
