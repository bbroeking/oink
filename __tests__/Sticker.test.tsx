import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { Sticker } from "../components/ui/Sticker";
import {
	DISABLED,
	PRESSED_FLAT,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
} from "../constants/theme";

// react-test-renderer 19 cannot resolve `Pressable`/`View` by type, so the
// suite queries the way the rest of this repo does: by the a11y contract for
// the interactive root, and through the rendered JSON for the plain one.
const button = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.find(
		(node) =>
			node.props.accessibilityRole === "button" &&
			typeof node.props.style === "function",
	);

const rootStyle = (renderer: TestRenderer.ReactTestRenderer) =>
	StyleSheet.flatten(
		(renderer.toJSON() as TestRenderer.ReactTestRendererJSON).props.style,
	);

describe("Sticker press + slots", () => {
	test("stays a plain View when nothing can be pressed", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker>
					<Text>Inert</Text>
				</Sticker>,
			);
		});

		expect(
			renderer.root.findAll(
				(node) => node.props.accessibilityRole === "button",
			),
		).toHaveLength(0);
		expect(renderer.toJSON()).not.toBeNull();
		act(() => renderer.unmount());
	});

	test("becomes a labelled button with onPress and shoves into its own shadow", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker
					onPress={onPress}
					accessibilityLabel="Open the barn"
					accessibilityHint="Shows today's visitors"
					testID="barn-sticker"
				>
					<Text>Barn</Text>
				</Sticker>,
			);
		});

		const pressable = button(renderer);
		expect(pressable.props.accessibilityRole).toBe("button");
		expect(pressable.props.accessibilityLabel).toBe("Open the barn");
		expect(pressable.props.accessibilityHint).toBe("Shows today's visitors");
		expect(pressable.props.accessibilityState).toEqual({ disabled: false });

		const resting = StyleSheet.flatten(
			pressable.props.style({ pressed: false }),
		);
		expect(resting.shadowOffset).toEqual(STICKER_SHADOW.shadowOffset);

		const pressed = StyleSheet.flatten(
			pressable.props.style({ pressed: true }),
		);
		// The shadow collapses and the surface moves into it, WITHOUT losing the
		// hand-drawn tilt.
		expect(pressed.shadowOffset).toEqual({ width: 0, height: 0 });
		expect(pressed.transform).toEqual([
			{ rotate: "-0.6deg" },
			{ translateX: SPACE.xxs },
			{ translateY: SPACE.xxs },
		]);

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("a flat sticker presses by opacity, never by translation", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker shadow="none" onPress={() => {}} accessibilityLabel="Flat">
					<Text>Flat</Text>
				</Sticker>,
			);
		});

		const pressed = StyleSheet.flatten(
			button(renderer).props.style({ pressed: true }),
		);
		expect(pressed.opacity).toBe(PRESSED_FLAT.opacity);
		expect(pressed.transform).toEqual([{ rotate: "-0.6deg" }]);
		act(() => renderer.unmount());
	});

	test("disabled keeps full chrome over a muted fill and never dims", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker onPress={() => {}} accessibilityLabel="Resting" disabled>
					<Text>Resting</Text>
				</Sticker>,
			);
		});

		const pressable = button(renderer);
		const style = StyleSheet.flatten(pressable.props.style({ pressed: false }));
		expect(style.backgroundColor).toBe(DISABLED.backgroundColor);
		expect(style.borderColor).toBe(DISABLED.borderColor);
		expect(style.borderWidth).toBe(DISABLED.borderWidth);
		expect(style.opacity).toBeUndefined();
		expect(pressable.props.accessibilityState).toEqual({ disabled: true });
		act(() => renderer.unmount());
	});

	test("draws the title/right/footer slots and pads only when asked", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker pad title="Your sounder" right={<Text>3rd</Text>}>
					<Text>body</Text>
				</Sticker>,
			);
		});

		const labels = renderer.root
			.findAllByType(Text)
			.map((node) => node.props.children);
		expect(labels).toContain("Your sounder");
		expect(labels).toContain("3rd");

		expect(rootStyle(renderer).padding).toBe(SPACE.card);
		act(() => renderer.unmount());
	});

	test("does not pad by default, so the 58 self-padding callers are untouched", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Sticker>
					<Text>body</Text>
				</Sticker>,
			);
		});

		const style = rootStyle(renderer);
		expect(style.padding).toBeUndefined();
		expect(style.borderColor).toBe(UI_COLORS.border);
		act(() => renderer.unmount());
	});
});
