import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text } from "react-native";

import { ListRow, NavRow } from "../components/ui/ListRow";
import { Skeleton } from "../components/ui/Skeleton";
import { Icon } from "../components/ui/Icon";
import {
	BORDER,
	RADII,
	ROW_TILTS,
	SPACE,
	UI_COLORS,
} from "../constants/theme";

// react-test-renderer 19 cannot resolve `Pressable` by type; query the row by
// the a11y contract it promises instead, as the rest of this repo does.
const button = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.find(
		(node) =>
			node.props.accessibilityRole === "button" &&
			typeof node.props.style === "function",
	);

const rootStyle = (renderer: TestRenderer.ReactTestRenderer) =>
	StyleSheet.flatten(button(renderer).props.style({ pressed: false }));

describe("ListRow", () => {
	test("takes its turn from ROW_TILTS and labels itself from the title", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Maple" sub="streak 12" index={1} onPress={onPress} />,
			);
		});

		const pressable = button(renderer);
		expect(pressable.props.accessibilityLabel).toBe("Maple");

		const style = rootStyle(renderer);
		expect(style.transform).toEqual([{ rotate: `${ROW_TILTS[1]}deg` }]);
		expect(style.borderRadius).toBe(RADII.md);
		expect(style.paddingVertical).toBe(SPACE.sm);
		expect(style.paddingHorizontal).toBe(SPACE.md);
		expect(style.gap).toBe(SPACE.md);

		const labels = renderer.root
			.findAllByType(Text)
			.map((node) => node.props.children);
		expect(labels).toContain("Maple");
		expect(labels).toContain("streak 12");

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("selected pins the row straight and wears the heavy border", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="You" index={3} selected onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.borderWidth).toBe(BORDER.heavy);
		expect(style.transform).toEqual([{ rotate: "0deg" }]);
		act(() => renderer.unmount());
	});

	test("muted is the 'trotted on' row: muted fill, secondary ink, no dimming", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Clover" sub="trotted on" muted onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.backgroundColor).toBe(UI_COLORS.surfaceStrong);
		expect(style.opacity).toBeUndefined();

		const title = renderer.root
			.findAllByType(Text)
			.find((node) => node.props.children === "Clover");
		expect(StyleSheet.flatten(title?.props.style).color).toBe(
			UI_COLORS.textSecondary,
		);
		act(() => renderer.unmount());
	});

	test("loading defers to the shared row skeleton", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<ListRow title="Maple" loading />);
		});

		expect(renderer.root.findAllByType(Skeleton).length).toBeGreaterThan(0);
		expect(
			renderer.root.findAll(
				(node) => node.props.accessibilityRole === "button",
			),
		).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("tilt={false} straightens the row without selecting it", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Flat" index={2} tilt={false} onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.transform).toEqual([{ rotate: "0deg" }]);
		expect(style.borderWidth).toBe(BORDER.ink);
		act(() => renderer.unmount());
	});
});

describe("NavRow", () => {
	test("draws an icon bubble, the badge and a chevron, and announces the label", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<NavRow
					icon="bell"
					label="Notifications"
					sub="3 unread"
					badge={<Text>3</Text>}
					onPress={onPress}
				/>,
			);
		});

		const pressable = button(renderer);
		expect(pressable.props.accessibilityLabel).toBe("Notifications");

		const icons = renderer.root
			.findAllByType(Icon)
			.map((node) => node.props.name);
		expect(icons).toContain("bell");
		expect(icons).toContain("chevronRight");

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});
});
