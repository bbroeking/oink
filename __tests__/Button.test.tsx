import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../components/ui/Button";

describe("Button accessibility contract", () => {
	test("exposes native button semantics and disabled state", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button variant="ghost" disabled>
					Resting
				</Button>,
			);
		});

		const pressable = renderer.root.findByType(Pressable);
		expect(pressable.props.accessibilityRole).toBe("button");
		expect(pressable.props.accessibilityState).toEqual({ disabled: true });
		act(() => renderer.unmount());
	});

	test("keeps the small visual variant at least 44 points tall", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Button size="sm">Dig now</Button>);
		});

		const gradient = renderer.root.findByType(LinearGradient);
		const style = StyleSheet.flatten(gradient.props.style);
		expect(style.minHeight).toBeGreaterThanOrEqual(44);
		expect(style.height).toBeUndefined();
		act(() => renderer.unmount());
	});

	test("wraps Dynamic Type labels instead of shrinking them below the type floor", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button size="sm">A longer translated action label</Button>,
			);
		});

		const label = renderer.root.findByType(Text);
		expect(label.props.numberOfLines).toBeUndefined();
		expect(label.props.adjustsFontSizeToFit).toBeUndefined();
		expect(label.props.minimumFontScale).toBeUndefined();
		act(() => renderer.unmount());
	});
});
