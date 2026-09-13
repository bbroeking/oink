import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { Chip, Ribbon, Tag } from "../components/ui/Chip";
import { SnoutCoin } from "../components/ui/SnoutCoin";
import {
	BORDER,
	DISABLED,
	DISABLED_TEXT,
	OPACITY,
	RADII,
	SHADOW_SM,
	TAP_MIN,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "../constants/theme";

// react-test-renderer 19 cannot resolve `Pressable`/`View` by type; query by
// the a11y contract, and read the read-only capsules off the rendered JSON.
const button = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.find(
		(node) =>
			node.props.accessibilityRole === "button" &&
			typeof node.props.style === "function",
	);

const chipStyle = (
	renderer: TestRenderer.ReactTestRenderer,
	pressed = false,
) => StyleSheet.flatten(button(renderer).props.style({ pressed }));

const rootJson = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.toJSON() as TestRenderer.ReactTestRendererJSON;

describe("Chip", () => {
	test("is a labelled button whose small capsule still reaches 44pt", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Friends" onPress={onPress} testID="scope-friends" />,
			);
		});

		const pressable = button(renderer);
		expect(pressable.props.accessibilityLabel).toBe("Friends");
		expect(pressable.props.accessibilityState).toEqual({
			selected: false,
			disabled: false,
		});

		const style = chipStyle(renderer);
		const slop = pressable.props.hitSlop;
		expect(style.minHeight + slop.top + slop.bottom).toBeGreaterThanOrEqual(
			TAP_MIN,
		);
		expect(style.borderRadius).toBe(RADII.pill);
		expect(style.borderWidth).toBe(BORDER.thin);
		expect(style.shadowOffset).toEqual(SHADOW_SM.shadowOffset);

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("selected is the heavy border, never a color change alone", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Sage" tone="sage" selected onPress={() => {}} />,
			);
		});

		const style = chipStyle(renderer);
		expect(style.borderWidth).toBe(BORDER.heavy);
		expect(style.backgroundColor).toBe(WHIMSY.sage);
		expect(button(renderer).props.accessibilityState.selected).toBe(true);
		act(() => renderer.unmount());
	});

	test("disabled keeps the shape, drops the lift, and never crushes opacity", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Gated" disabled onPress={() => {}} />,
			);
		});

		const style = chipStyle(renderer);
		expect(style.backgroundColor).toBe(DISABLED.backgroundColor);
		expect(style.borderWidth).toBe(DISABLED.borderWidth);
		expect(style.shadowOffset).toBeUndefined();
		expect(style.opacity).toBeUndefined();

		const label = renderer.root.findByType(Text);
		expect(StyleSheet.flatten(label.props.style).color).toBe(
			DISABLED_TEXT.color,
		);
		act(() => renderer.unmount());
	});

	test("presses flat", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Chip label="Tap" onPress={() => {}} />);
		});

		expect(chipStyle(renderer, true).opacity).toBe(OPACITY.pressed);
		act(() => renderer.unmount());
	});

	test("a sub line rides under the label and joins the spoken name", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Truffle Hunter" sub="before name" onPress={() => {}} />,
			);
		});

		const lines = renderer.root.findAllByType(Text);
		expect(lines.map((l) => l.props.children)).toEqual([
			"Truffle Hunter",
			"before name",
		]);
		expect(button(renderer).props.accessibilityLabel).toBe(
			"Truffle Hunter, before name",
		);
		act(() => renderer.unmount());
	});

	test("a badge hangs off the corner and never swallows the tap", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip
					label="Ready"
					badge={<Text>3</Text>}
					onPress={onPress}
					accessibilityLabel="Ready, 3 ready"
				/>,
			);
		});

		const slot = renderer.root.find(
			(node) => node.props.pointerEvents === "none",
		);
		expect(StyleSheet.flatten(slot.props.style).position).toBe("absolute");
		// The count is said by the chip's own label — a badge is never the only
		// place a number is spoken.
		expect(button(renderer).props.accessibilityLabel).toBe("Ready, 3 ready");
		act(() => button(renderer).props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("announces as a radio inside a radiogroup", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Pilgrim" role="radio" selected onPress={() => {}} />,
			);
		});

		const radio = renderer.root.find(
			(node) => node.props.accessibilityRole === "radio",
		);
		expect(radio.props.accessibilityState.selected).toBe(true);
		act(() => renderer.unmount());
	});

	test("bark is the one tone whose ink flips", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Dark" tone="bark" onPress={() => {}} />,
			);
		});

		const label = renderer.root.findByType(Text);
		expect(StyleSheet.flatten(label.props.style).color).toBe(
			UI_COLORS.textOnDark,
		);
		act(() => renderer.unmount());
	});

	test("forwards a Dynamic Type ceiling, and defaults to none", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Chip label="Mine" onPress={() => {}} />);
		});
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			undefined,
		);
		act(() => renderer.unmount());

		act(() => {
			renderer = TestRenderer.create(
				<Chip label="Mine" onPress={() => {}} maxFontSizeMultiplier={1.3} />,
			);
		});
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			1.3,
		);
		act(() => renderer.unmount());
	});
});

describe("Tag", () => {
	test("reads as text, not as a button, and can carry the coin", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Tag label="250" tone="sun" coin />);
		});

		expect(
			renderer.root.findAll(
				(node) => node.props.accessibilityRole === "button",
			),
		).toHaveLength(0);
		const view = rootJson(renderer);
		expect(view.props.accessibilityLabel).toBe("250");
		expect(StyleSheet.flatten(view.props.style).borderRadius).toBe(RADII.pill);
		expect(renderer.root.findAllByType(SnoutCoin)).toHaveLength(1);
		act(() => renderer.unmount());
	});

	test("forwards a Dynamic Type ceiling, and defaults to none", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Tag label="2 of 3 visits left" />);
		});
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			undefined,
		);
		act(() => renderer.unmount());

		act(() => {
			renderer = TestRenderer.create(
				<Tag label="2 of 3 visits left" maxFontSizeMultiplier={1.3} />,
			);
		});
		expect(renderer.root.findByType(Text).props.maxFontSizeMultiplier).toBe(
			1.3,
		);
		act(() => renderer.unmount());
	});

	test("a capsule's words can give, so a width ceiling wraps rather than clips", () => {
		// React Native defaults flexShrink to 0: without this the label measured
		// at its full content width and pushed the capsule off the row's right
		// edge instead of wrapping. (2026-09-12 visit device pass.)
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Tag label="2 of 3 visits left" />);
		});
		expect(
			StyleSheet.flatten(renderer.root.findByType(Text).props.style)
				.flexShrink,
		).toBe(1);
		act(() => renderer.unmount());
	});
});

describe("Ribbon", () => {
	test("crosses the corner: absolute, rotated, tone fill, tracked kicker", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<Ribbon label="MEMBERS" />);
		});

		const banner = rootJson(renderer);
		const style = StyleSheet.flatten(banner.props.style);
		expect(banner.props.accessibilityLabel).toBe("MEMBERS");
		expect(style.position).toBe("absolute");
		expect(style.transform).toEqual([{ rotate: "35deg" }]);
		expect(style.backgroundColor).toBe(WHIMSY.slopGold);
		expect(style.borderTopWidth).toBe(BORDER.thin);
		expect(style.borderBottomWidth).toBe(BORDER.thin);

		const label = StyleSheet.flatten(
			renderer.root.findByType(Text).props.style,
		);
		expect(label.fontSize).toBe(TYPE.kickerPillSm.fontSize);
		expect(label.letterSpacing).toBe(TYPE.kickerPillSm.letterSpacing);
		act(() => renderer.unmount());
	});
});
