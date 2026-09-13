import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, Text, View, type ScaledSize } from "react-native";

import { Button } from "@/components/ui/Button";
import { Chip, Tag } from "@/components/ui/Chip";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { T } from "@/components/ui/Text";

const initialWindow = { ...Dimensions.get("window") };
const initialScreen = { ...Dimensions.get("screen") };
const defaultWindow = { ...initialWindow, fontScale: 1 };

function setDimensions(window: ScaledSize) {
	act(() => {
		Dimensions.set({ window, screen: initialScreen });
	});
}

function nativeText(
	tree: TestRenderer.ReactTestRenderer,
	children: React.ReactNode,
) {
	return tree.root.find(
		(node) => node.type === Text && node.props.children === children,
	);
}

beforeEach(() => {
	setDimensions(defaultWindow);
});

afterEach(() => {
	setDimensions(initialWindow);
});

describe("Dynamic Type text measurement refresh", () => {
	test.each([
		{
			name: "Button",
			render: (onPress: () => void) => (
				<Button
					variant="ghost"
					onPress={onPress}
					accessibilityLabel="Leave"
					maxFontSizeMultiplier={1.3}
				>
					Leave
				</Button>
			),
			label: "Leave",
			parentLabel: "Leave",
		},
		{
			name: "Chip",
			render: (onPress: () => void) => (
				<Chip
					label="Outside"
					onPress={onPress}
					accessibilityLabel="Outside"
					maxFontSizeMultiplier={1.3}
				/>
			),
			label: "Outside",
			parentLabel: "Outside",
		},
	])(
		"remounts the $name label after fontScale changes without remounting its control",
		({ render, label, parentLabel }) => {
			const onPress = jest.fn();
			let tree!: TestRenderer.ReactTestRenderer;
			act(() => {
				tree = TestRenderer.create(render(onPress));
			});

			const findControl = () =>
				tree.root.find(
					(node) =>
						node.props.accessibilityLabel === parentLabel &&
						node.props.accessibilityRole === "button",
				);
			const controlBefore = findControl();
			const labelBefore = nativeText(tree, label);

			setDimensions({ ...defaultWindow, fontScale: 2 });

			const controlAfter = findControl();
			const labelAfter = nativeText(tree, label);
			expect(labelAfter).not.toBe(labelBefore);
			expect(controlAfter).toBe(controlBefore);
			expect(controlAfter.props.onPress).toBe(onPress);

			setDimensions(defaultWindow);
			expect(nativeText(tree, label)).not.toBe(labelAfter);
			expect(findControl()).toBe(controlBefore);

			act(() => controlAfter.props.onPress());
			expect(onPress).toHaveBeenCalledTimes(1);
			act(() => tree.unmount());
		},
	);

	test("remounts Tag text after fontScale changes without remounting the capsule", () => {
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(
				<Tag
					label="3 of 3 visits left"
					accessibilityLabel="Visits remaining"
					maxFontSizeMultiplier={1.3}
				/>,
			);
		});

		const capsuleBefore = tree.root.findByProps({
			accessibilityLabel: "Visits remaining",
		});
		const labelBefore = nativeText(tree, "3 of 3 visits left");

		setDimensions({ ...defaultWindow, fontScale: 2 });

		const labelAfter = nativeText(tree, "3 of 3 visits left");
		expect(labelAfter).not.toBe(labelBefore);
		expect(
			tree.root.findByProps({ accessibilityLabel: "Visits remaining" }),
		).toBe(capsuleBefore);

		setDimensions(defaultWindow);
		expect(nativeText(tree, "3 of 3 visits left")).not.toBe(labelAfter);
		expect(
			tree.root.findByProps({ accessibilityLabel: "Visits remaining" }),
		).toBe(capsuleBefore);
		act(() => tree.unmount());
	});

	test("remounts SegmentedControl labels while preserving radio state and handlers", () => {
		const onChange = jest.fn();
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(
				<SegmentedControl
					label="Where in the barn"
					value="outside"
					onChange={onChange}
					maxFontSizeMultiplier={1.3}
					options={[
						{ value: "outside", label: "Outside" },
						{ value: "inside", label: "Inside" },
					]}
				/>,
			);
		});

		const outsideBefore = tree.root.find(
			(node) =>
				node.props.accessibilityRole === "radio" &&
				node.props.accessibilityLabel === "Outside",
		);
		const labelBefore = nativeText(tree, "Outside");

		setDimensions({ ...defaultWindow, fontScale: 2 });

		const outsideAfter = tree.root.find(
			(node) =>
				node.props.accessibilityRole === "radio" &&
				node.props.accessibilityLabel === "Outside",
		);
		const labelAfter = nativeText(tree, "Outside");
		expect(labelAfter).not.toBe(labelBefore);
		expect(outsideAfter).toBe(outsideBefore);
		expect(outsideAfter.props.accessibilityState).toEqual({ selected: true });

		setDimensions(defaultWindow);
		expect(nativeText(tree, "Outside")).not.toBe(labelAfter);
		expect(
			tree.root.find(
				(node) =>
					node.props.accessibilityRole === "radio" &&
					node.props.accessibilityLabel === "Outside",
			),
		).toBe(outsideBefore);

		act(() => outsideAfter.props.onPress());
		expect(onChange).toHaveBeenCalledWith("outside");
		act(() => tree.unmount());
	});

	test("T remounts its native text and retains nested content and accessibility props", () => {
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(
				<View testID="frame">
					<T
						role="cardTitle"
						accessibilityLabel="Barn greeting"
						maxFontSizeMultiplier={1.3}
					>
						Hello <Text>pig</Text>
					</T>
				</View>,
			);
		});

		const frameBefore = tree.root.findByProps({ testID: "frame" });
		const textBefore = tree.root.find(
			(node) => node.type === Text && node.props.accessibilityLabel === "Barn greeting",
		);

		setDimensions({ ...defaultWindow, fontScale: 2 });

		const textAfter = tree.root.find(
			(node) => node.type === Text && node.props.accessibilityLabel === "Barn greeting",
		);
		expect(textAfter).not.toBe(textBefore);
		expect(tree.root.findByProps({ testID: "frame" })).toBe(frameBefore);
		expect(textAfter.props.accessibilityLabel).toBe("Barn greeting");
		expect(
			textAfter.find(
				(node) => node.type === Text && node.props.children === "pig",
			).props.children,
		).toBe("pig");

		setDimensions(defaultWindow);
		expect(
			tree.root.find(
				(node) =>
					node.type === Text &&
					node.props.accessibilityLabel === "Barn greeting",
			),
		).not.toBe(textAfter);
		expect(tree.root.findByProps({ testID: "frame" })).toBe(frameBefore);
		act(() => tree.unmount());
	});

	test("does not remount text for a size-only Dimensions event", () => {
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(<Button variant="ghost">Leave</Button>);
		});
		const labelBefore = nativeText(tree, "Leave");

		setDimensions({
			...defaultWindow,
			width: defaultWindow.width - 1,
		});

		expect(nativeText(tree, "Leave")).toBe(labelBefore);
		act(() => tree.unmount());
	});
});
