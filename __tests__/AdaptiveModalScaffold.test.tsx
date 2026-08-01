import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AdaptiveModalScaffold } from "../components/ui/AdaptiveModalScaffold";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function inSafeArea(node: React.ReactNode) {
	return <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
}

describe("AdaptiveModalScaffold", () => {
	test("bounds dense content to the current safe window and always provides scrolling", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(inSafeArea(
				<AdaptiveModalScaffold
					visible
					onRequestClose={() => {}}
					testID="adaptive-frame"
				>
					<Text>Long modal content</Text>
				</AdaptiveModalScaffold>,
			));
		});

		const frame = renderer.root
			.findAll((node) => node.props.testID === "adaptive-frame")
			.at(-1)!;
		const frameStyle = StyleSheet.flatten(frame.props.style);
		expect(typeof frameStyle.width).toBe("number");
		expect(typeof frameStyle.maxHeight).toBe("number");
		expect(frameStyle.maxHeight).toBeGreaterThanOrEqual(240);
		expect(renderer.root.findAllByType(ScrollView)).toHaveLength(1);
		expect(frame.props.accessibilityViewIsModal).toBe(true);
		expect(typeof frame.props.onAccessibilityEscape).toBe("function");
		act(() => renderer.unmount());
	});

	test("provides a named 44-point close target in a non-overlapping layout row", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(inSafeArea(
				<AdaptiveModalScaffold
					visible
					onRequestClose={() => {}}
					showCloseButton
					closeLabel="Close preview"
					contentContainerStyle={{ paddingTop: 0 }}
				>
					<Text>Preview</Text>
				</AdaptiveModalScaffold>,
			));
		});

		const close = renderer.root
			.findAllByType(Pressable)
			.find((node) => node.props.accessibilityLabel === "Close preview");
		expect(close).toBeDefined();
		expect(close?.props.accessibilityRole).toBe("button");
		const closeStyle = StyleSheet.flatten(close?.props.style({ pressed: false }));
		expect(closeStyle.width).toBe(44);
		expect(closeStyle.height).toBe(44);
		expect(closeStyle.position).not.toBe("absolute");

		const scroll = renderer.root.findByType(ScrollView);
		let parent = close?.parent;
		let closeIsInsideScroll = false;
		while (parent) {
			if (parent === scroll) closeIsInsideScroll = true;
			parent = parent.parent;
		}
		expect(closeIsInsideScroll).toBe(false);
		let closeRowMinHeight: number | undefined;
		let ancestor = close?.parent;
		while (ancestor && closeRowMinHeight == null) {
			if (typeof ancestor.props.style !== "function") {
				closeRowMinHeight = StyleSheet.flatten(ancestor.props.style)?.minHeight;
			}
			ancestor = ancestor.parent;
		}
		expect(closeRowMinHeight).toBeGreaterThanOrEqual(44);
		act(() => renderer.unmount());
	});
});
