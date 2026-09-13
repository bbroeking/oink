import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../components/ui/Button";
import {
	BUTTON_SIZE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
} from "../constants/theme";

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

		const pressable = renderer.root.find(
			(node) => node.props.accessibilityRole === "button",
		);
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

	test("takes a Dynamic Type ceiling only when the caller asks for one", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Button size="sm">Leave</Button>);
		});
		// The default is NO cap: spec §1.2 scales every role to 200%.
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			undefined,
		);
		act(() => renderer.unmount());

		act(() => {
			renderer = TestRenderer.create(
				<Button size="sm" maxFontSizeMultiplier={1.3}>
					Leave
				</Button>,
			);
		});
		// Fixed-height chrome (the visit header row, the visit action bar) asks
		// for the cap, and the primitive hands it straight to the label.
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			1.3,
		);
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

describe("Button wave-2 variants", () => {
	const flatStyle = (
		renderer: TestRenderer.ReactTestRenderer,
		pressed = false,
	) =>
		StyleSheet.flatten(
			renderer.root
				.find((node) => node.props.accessibilityRole === "button")
				.props.style({ pressed }),
		);

	test("link is underlined ink with no box, inside a full 44pt frame", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button variant="link" onPress={() => {}}>
					how it works
				</Button>,
			);
		});

		const style = flatStyle(renderer);
		expect(style.minHeight).toBe(TAP_MIN);
		expect(style.backgroundColor).toBe("transparent");
		expect(style.borderWidth).toBe(0);

		const label = StyleSheet.flatten(
			renderer.root.findByType(Text).props.style,
		);
		expect(label.textDecorationLine).toBe("underline");
		expect(label.color).toBe(UI_COLORS.textPrimary);
		act(() => renderer.unmount());
	});

	test("destructive is the danger pair behind the signature ink outline", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button variant="destructive" onPress={() => {}}>
					Leave the sounder
				</Button>,
			);
		});

		const style = flatStyle(renderer);
		expect(style.backgroundColor).toBe(UI_COLORS.dangerSurface);
		expect(style.borderColor).toBe(UI_COLORS.border);
		expect(style.shadowOffset).toEqual({ width: 2, height: 2 });
		expect(
			StyleSheet.flatten(renderer.root.findByType(Text).props.style).color,
		).toBe(UI_COLORS.dangerText);
		act(() => renderer.unmount());
	});

	test("size xs keeps a small visual inside a 44pt hit frame", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button variant="ghost" size="xs" onPress={() => {}}>
					undo
				</Button>,
			);
		});

		const button = renderer.root.find(
			(node) => node.props.accessibilityRole === "button",
		);
		const style = StyleSheet.flatten(button.props.style({ pressed: false }));
		expect(style.minHeight).toBe(BUTTON_SIZE.xs.minH);
		expect(style.minHeight).toBeLessThan(TAP_MIN);
		const slop = button.props.hitSlop;
		expect(style.minHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(
			TAP_MIN,
		);
		act(() => renderer.unmount());
	});

	test("loading disables, swaps the label to the hand, and announces busy", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Button loading onPress={() => {}}>
					Buy for 250
				</Button>,
			);
		});

		const button = renderer.root.find(
			(node) => node.props.accessibilityRole === "button",
		);
		expect(button.props.accessibilityState).toEqual({
			disabled: true,
			busy: true,
		});
		expect(button.props.disabled).toBe(true);

		const label = renderer.root.findByType(Text);
		expect(label.props.children).toBe("\u2605 working \u2605");
		expect(StyleSheet.flatten(label.props.style).fontFamily).toBe(
			TYPE.hand.fontFamily,
		);
		// No gradient while in flight: a loading button wears the resting look.
		expect(renderer.root.findAllByType(LinearGradient)).toHaveLength(0);
		act(() => renderer.unmount());
	});
});
