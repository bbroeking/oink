import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated } from "react-native";
import { MOTION_SPRING } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import { SQUASH_MS, SQUASH_SCALE, ROSIE_BOUNCE } from "@/utils/motionRecipes";
import {
	BarnStructure,
	BARN_STRUCTURE_SIZE,
	barnStructurePose,
	type BarnStructureState,
} from "@/components/BarnStructure";

describe("Barn structure pose contract", () => {
	it.each([
		["closed", 0, 0],
		["beckon", 0.3, 1],
		["opening", 1, 1],
		["open", 1, 1],
		["closing", 0, 0],
	] as [BarnStructureState, number, number][])(
		"%s parts the leaves and lights the doorway to its own pose",
		(state, leaf, glow) => {
			expect(barnStructurePose(state, false)).toEqual({
				leaf,
				glow,
				duration: 220,
				travel: 19,
				spring: MOTION_SPRING.settle,
			});
		}
	);

	it.each([
		["closed", 0, 0],
		["beckon", 0.3, 1],
		["opening", 1, 1],
		["open", 1, 1],
		["closing", 0, 0],
	] as [BarnStructureState, number, number][])(
		"%s takes the rest pose under Reduced Motion — crossfade, no travel",
		(state, leaf, glow) => {
			expect(barnStructurePose(state, true)).toEqual({
				leaf,
				glow,
				duration: 150,
				travel: 0,
				// Reduce Motion is the doorway's one un-sprung case: nothing
				// travels, so there is nothing to overshoot, and `duration` runs
				// the crossfade instead.
				spring: null,
			});
		}
	);

	// The sprite box IS the painted body, at the art's own aspect (354 × 333).
	// The ink duplicate hangs 4pt past it — a shadow does not get box.
	test("the sprite box carries the painted body's aspect", () => {
		expect(BARN_STRUCTURE_SIZE).toEqual({ width: 118, height: 111 });
	});
});

describe("Barn structure motion", () => {
	function mount(node: React.ReactElement) {
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(node);
		});
		return tree;
	}
	const barn = (tree: TestRenderer.ReactTestRenderer) =>
		tree.root.find(
			(node) =>
				node.props.accessibilityRole === "button" &&
				typeof node.props.children === "function"
		);

	test("the leaves swing on a spring, not a ramp", () => {
		const spring = jest.spyOn(Animated, "spring");
		const tree = mount(<BarnStructure state="opening" />);
		// One spring — the leaves. The glow is a fade and stays on a timing.
		expect(spring).toHaveBeenCalledTimes(1);
		expect(spring.mock.calls[0][1]).toMatchObject({
			toValue: 1,
			...MOTION_SPRING.settle,
			useNativeDriver: true,
		});
		act(() => tree.unmount());
		spring.mockRestore();
	});

	test("Reduce Motion leaves the doorway un-sprung", () => {
		const spring = jest.spyOn(Animated, "spring");
		const tree = mount(
			<MotionPolicyProvider reduceMotion>
				<BarnStructure state="opening" />
			</MotionPolicyProvider>
		);
		expect(spring).not.toHaveBeenCalled();
		act(() => tree.unmount());
		spring.mockRestore();
	});

	// The barn answers a tap the way Rosie does: `squashAndSpring`, the recipe
	// lifted out of her own press. The assertion is the recipe's numbers, so a
	// barn that quietly grows its own press animation goes red here.
	test("a tap takes Rosie's squash-and-spring", () => {
		const timing = jest.spyOn(Animated, "timing");
		const spring = jest.spyOn(Animated, "spring");
		const tree = mount(<BarnStructure state="closed" onPress={jest.fn()} />);
		timing.mockClear();
		spring.mockClear();
		act(() => barn(tree).props.onPress());
		expect(timing.mock.calls[0][1]).toMatchObject({
			toValue: SQUASH_SCALE,
			duration: SQUASH_MS,
			useNativeDriver: true,
		});
		expect(spring.mock.calls[0][1]).toMatchObject({
			toValue: 1,
			...ROSIE_BOUNCE,
			useNativeDriver: true,
		});
		act(() => tree.unmount());
		timing.mockRestore();
		spring.mockRestore();
	});

	test("a tap under Reduce Motion squashes nothing", () => {
		const timing = jest.spyOn(Animated, "timing");
		const tree = mount(
			<MotionPolicyProvider reduceMotion>
				<BarnStructure state="closed" onPress={jest.fn()} />
			</MotionPolicyProvider>
		);
		timing.mockClear();
		act(() => barn(tree).props.onPress());
		expect(timing).not.toHaveBeenCalled();
		act(() => tree.unmount());
		timing.mockRestore();
	});
});

describe("Barn structure as the exterior entrance", () => {
	function mount(node: React.ReactElement) {
		let tree!: TestRenderer.ReactTestRenderer;
		act(() => {
			tree = TestRenderer.create(node);
		});
		return tree;
	}

	// react-test-renderer 19 cannot resolve `Pressable` by type; the composite
	// is the labelled button whose children are a render callback (the host View
	// it renders carries the same a11y props but already-rendered children).
	const barn = (tree: TestRenderer.ReactTestRenderer) =>
		tree.root.find(
			(node) =>
				node.props.accessibilityRole === "button" &&
				typeof node.props.children === "function"
		);

	test("a closed barn opens on tap", () => {
		const onPress = jest.fn();
		const tree = mount(<BarnStructure state="closed" onPress={onPress} />);
		const pressable = barn(tree);
		expect(pressable.props.accessibilityLabel).toBe("Your Barn");
		expect(pressable.props.accessibilityHint).toBe(
			"Opens the doors to your room and furnishings"
		);
		expect(pressable.props.testID).toBe("barn-structure");
		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => tree.unmount());
	});

	test("a barn mid-swing ignores a second tap", () => {
		const onPress = jest.fn();
		const tree = mount(<BarnStructure state="opening" onPress={onPress} />);
		const pressable = barn(tree);
		act(() => pressable.props.onPress());
		expect(onPress).not.toHaveBeenCalled();
		act(() => tree.unmount());
	});

	test("a locked barn is not a control at all", () => {
		const onPress = jest.fn();
		const tree = mount(
			<BarnStructure state="closed" disabled onPress={onPress} />
		);
		const pressable = barn(tree);
		expect(pressable.props.accessible).toBe(false);
		expect(pressable.props.disabled).toBe(true);
		expect(pressable.props.onPress).toBeUndefined();
		expect(onPress).not.toHaveBeenCalled();
		act(() => tree.unmount());
	});
});
