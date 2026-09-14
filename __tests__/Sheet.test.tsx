import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Modal, ScrollView, StyleSheet, Text } from "react-native";
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

	// A short window (an SE, or any phone at a large text size) is where the
	// panel's 85% cap and its content actually disagree. The chain from the cap
	// down to the scroller has to be able to shrink, or the cap becomes a clip
	// and the last row of the body — Report · Block on a friend's profile — is
	// laid out below the panel's floor, off the bottom of the screen.
	describe("on a short window", () => {
		const SHORT = { width: 320, height: 568, scale: 2, fontScale: 1 };
		let dimensions: jest.SpyInstance;

		beforeEach(() => {
			dimensions = jest
				.spyOn(Dimensions, "get")
				.mockReturnValue(SHORT as ReturnType<typeof Dimensions.get>);
		});
		afterEach(() => dimensions.mockRestore());

		function openSheet(footer?: React.ReactNode) {
			let renderer!: TestRenderer.ReactTestRenderer;
			act(() => {
				renderer = TestRenderer.create(
					inSafeArea(
						<Sheet open onClose={() => {}} title="Profile" footer={footer}>
							{Array.from({ length: 40 }, (_, i) => (
								<Text key={i}>a long body</Text>
							))}
						</Sheet>,
					),
				);
			});
			return renderer;
		}

		test("every link from the height cap down to the scroller may shrink", () => {
			const renderer = openSheet();
			const scroll = renderer.root.findByType(ScrollView);
			const cap = SHORT.height * 0.85;

			// Walk UP from the scroller to the sheet's own bottom-anchored
			// wrapper, collecting every styled node on the way. Exactly one of
			// them carries the height cap; every OTHER link — the tap-swallowing
			// Pressable, the keyboard lift, the scroller itself — has to be able
			// to fall below its content height, or the cap becomes a clip.
			const chain: TestRenderer.ReactTestInstance[] = [scroll];
			let node = scroll.parent;
			while (node) {
				const style = StyleSheet.flatten(node.props.style);
				// SlideUpSheet's panel wrapper: absolute, pinned to the bottom.
				if (style?.position === "absolute") break;
				if (style) chain.push(node);
				node = node.parent;
			}
			const styles = chain.map((link) => StyleSheet.flatten(link.props.style)!);
			// The cap is on the chain, and it is the panel's own 85%.
			expect(styles.some((style) => style.maxHeight === cap)).toBe(true);
			const links = styles.filter((style) => style.maxHeight !== cap);
			// The scroller, the tap-swallowing Pressable, the keyboard lift.
			expect(links.length).toBeGreaterThanOrEqual(3);
			for (const style of links) {
				expect(style.flexShrink).toBe(1);
				expect(style.minHeight).toBe(0);
			}
			act(() => renderer.unmount());
		});

		test("there is one scroller, it bounces, and its last row clears the indicator", () => {
			const renderer = openSheet();
			expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
			const scroll = renderer.root.findByType(ScrollView);
			// Reaching the end has feel; `bounces={false}` read as a dead stop.
			expect(scroll.props.bounces).not.toBe(false);
			// Footer-less: the home-indicator pad travels with the last row
			// instead of sitting under it as a fixed band.
			expect(
				StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom,
			).toBe(SPACE.xl + metrics.insets.bottom);
			act(() => renderer.unmount());
		});

		test("with a pinned footer the safety stays under the footer", () => {
			const renderer = openSheet(<Text>pinned footer</Text>);
			const scroll = renderer.root.findByType(ScrollView);
			expect(
				StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom,
			).toBe(SPACE.sm);
			const panelStyle = renderer.root
				.findAll((node) => !!StyleSheet.flatten(node.props.style)?.borderTopLeftRadius)
				.map((node) => StyleSheet.flatten(node.props.style))
				.find((style) => style?.borderTopLeftRadius === RADII.xl)!;
			expect(panelStyle.paddingBottom).toBe(SPACE.xl + metrics.insets.bottom);
			act(() => renderer.unmount());
		});
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
