import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import {
	VisitActionBar,
	visitAction,
} from "@/components/visit/VisitActionBar";
import { VISIT_TYPE_CAP } from "@/components/visit/chrome";

jest.mock("react-native-safe-area-context", () => ({
	useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock("@/hooks/useMotionPolicy", () => {
	const actual = jest.requireActual("@/hooks/useMotionPolicy");
	return {
		...actual,
		useMotionPolicy: () => ({
			reduceMotion: true,
			allowDecorativeMotion: false,
			largeTransition: "crossfade" as const,
			duration: (_standard: number, reduced = 150) => reduced,
		}),
	};
});

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("visitAction", () => {
	test("offers nothing while the visit is still going", () => {
		expect(visitAction({ tired: false })).toBeNull();
	});

	test("offers the way out once the pigs are tickled out", () => {
		expect(visitAction({ tired: true })?.label).toBe("Head home");
	});
});

describe("VisitActionBar", () => {
	const bar = (
		props: Partial<React.ComponentProps<typeof VisitActionBar>> = {},
	) =>
		render(<VisitActionBar tired={false} onHeadHome={jest.fn()} {...props} />);

	test("the pill is Head home once the visit is spent", () => {
		const onHeadHome = jest.fn();
		const tree = bar({ tired: true, onHeadHome });
		const pill = tree.root.find(
			(n) => n.props.testID === "visit-head-home" && !!n.props.onPress,
		);
		act(() => pill.props.onPress());
		expect(onHeadHome).toHaveBeenCalledTimes(1);
	});

	test("the pill's label takes the visit chrome's Dynamic Type ceiling", () => {
		const labels = bar({ tired: true }).root.findAll(
			(n) => typeof n.type === "string" && n.props.children === "Head home",
		);
		expect(labels).toHaveLength(1);
		expect(labels[0].props.maxFontSizeMultiplier).toBe(VISIT_TYPE_CAP);
	});

	test("the arrival nap card owns the only exit, so the bar hides", () => {
		const tree = bar({ tired: true, hidden: true });
		expect(
			tree.root.findAll((n) => n.props.testID === "visit-head-home"),
		).toEqual([]);
	});

	test("keeps its slot when it has nothing to say, so the scene never jumps", () => {
		const tree = bar();
		expect(
			tree.root.findAll((n) => n.props.testID === "visit-head-home"),
		).toEqual([]);
		// The reserved slot is still mounted and simply not tappable.
		expect(
			tree.root.findAll((n) => n.props.pointerEvents === "none").length,
		).toBeGreaterThan(0);
	});
});
