import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Button } from "../components/ui/Button";
import {
	BORDER,
	BUTTON_SIZE,
	RADII,
	SPACE,
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

		// The gradient variant's box is its Pressable (the gradient only paints it).
		const box = renderer.root.find(
			(node) => node.props.accessibilityRole === "button",
		);
		const style = StyleSheet.flatten(box.props.style({ pressed: false }));
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

describe("Button gradient box", () => {
	const render = (element: React.ReactElement) => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(element);
		});
		return renderer;
	};
	const boxStyle = (renderer: TestRenderer.ReactTestRenderer) =>
		StyleSheet.flatten(
			renderer.root
				.find((node) => node.props.accessibilityRole === "button")
				.props.style({ pressed: false }),
		);
	const paintStyle = (renderer: TestRenderer.ReactTestRenderer) =>
		StyleSheet.flatten(renderer.root.findByType(LinearGradient).props.style);

	test("the gradient paints the box and never sizes it (after/083)", () => {
		// Under React Native's legacy Yoga stretch errata (on by default) a
		// flex-grown pill filled whatever height its button was measured against,
		// so a button centred in a card grew to the card's whole height.
		const renderer = render(
			<Button style={{ marginTop: SPACE.md }} onPress={() => {}}>
				Open the camera
			</Button>,
		);
		const gradient = renderer.root.findByType(LinearGradient);
		const paint = paintStyle(renderer);
		expect(paint.position).toBe("absolute");
		expect(paint.flex).toBeUndefined();
		expect(paint.flexGrow).toBeUndefined();
		expect(paint.minHeight).toBeUndefined();
		expect(paint.marginTop).toBeUndefined();
		expect(paint.paddingHorizontal).toBeUndefined();
		// It reaches over the outline the box reserves, so it covers the whole box.
		expect([paint.top, paint.right, paint.bottom, paint.left]).toEqual([
			-BORDER.ink,
			-BORDER.ink,
			-BORDER.ink,
			-BORDER.ink,
		]);
		// And it wears the outline, the radius and the sticker shadow.
		expect(paint.borderWidth).toBe(BORDER.ink);
		expect(paint.borderColor).toBe(UI_COLORS.border);
		expect(paint.borderRadius).toBe(BUTTON_SIZE.md.br);
		expect(paint.shadowOffset).toEqual({ width: 2, height: 2 });
		// The label is the box's child, not the paint's.
		expect(gradient.props.children).toBeUndefined();
		act(() => renderer.unmount());
	});

	test("placement, padding and the label row live on the box", () => {
		const renderer = render(
			<Button full style={{ marginTop: SPACE.md, flex: 1, minWidth: 120 }}>
				Wind it
			</Button>,
		);
		const box = boxStyle(renderer);
		expect(box.marginTop).toBe(SPACE.md);
		expect(box.flex).toBe(1);
		expect(box.minWidth).toBe(120);
		expect(box.alignSelf).toBe("stretch");
		expect(box.minHeight).toBe(BUTTON_SIZE.md.minH);
		expect(box.paddingHorizontal).toBe(BUTTON_SIZE.md.px);
		expect(box.paddingVertical).toBe(BUTTON_SIZE.md.py);
		expect(box.flexDirection).toBe("row");
		expect(box.alignItems).toBe("center");
		expect(box.justifyContent).toBe("center");
		// The outline's width is reserved (transparent), so the label sits inside
		// it exactly where it sat inside the old outlined pill.
		expect(box.borderWidth).toBe(BORDER.ink);
		expect(box.borderColor).toBe("transparent");
		// The box itself draws nothing.
		expect(box.borderRadius).toBeUndefined();
		expect(box.backgroundColor).toBeUndefined();
		expect(box.shadowOffset).toBeUndefined();
		act(() => renderer.unmount());
	});

	test("a caller's radius rounds the paint, not the box", () => {
		const renderer = render(
			<Button variant="gold" style={{ borderRadius: RADII.sm }}>
				Claim
			</Button>,
		);
		expect(paintStyle(renderer).borderRadius).toBe(RADII.sm);
		expect(boxStyle(renderer).borderRadius).toBeUndefined();
		act(() => renderer.unmount());
	});
});
