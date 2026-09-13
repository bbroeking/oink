import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../components/ui/EmptyState";
import {
	SpotlightOverlay,
	SpotlightProvider,
	SpotlightTarget,
} from "../components/ui/Spotlight";
import { WHIMSY } from "../constants/theme";

// Reanimated 4 needs the worklets native module, which the renderer-only test
// env doesn't ship. Spotlight only uses it for the decorative halo breathe and
// the caption wiggle, so a plain-View stand-in keeps the tree shape intact
// without pulling the runtime in.
jest.mock("react-native-reanimated", () => {
	const React = require("react");
	const { View } = require("react-native");
	const shared = (value: number) => ({ value });
	const passthrough = (v: unknown) => v;
	const Animated = {
		View: React.forwardRef((props: object, ref: unknown) =>
			React.createElement(View, { ...props, ref }),
		),
		createAnimatedComponent: (Component: unknown) => Component,
	};
	return {
		__esModule: true,
		default: Animated,
		Easing: { inOut: passthrough, quad: passthrough, linear: passthrough },
		useSharedValue: shared,
		useAnimatedProps: (fn: () => object) => fn(),
		useAnimatedStyle: (fn: () => object) => fn(),
		withRepeat: passthrough,
		withSequence: passthrough,
		withTiming: passthrough,
	};
});

function mount(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

function fills(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root
		.findAll((node) => !!StyleSheet.flatten(node.props.style)?.backgroundColor)
		.map((node) => StyleSheet.flatten(node.props.style).backgroundColor);
}

describe("EmptyState", () => {
	test("kind=error swaps the paper for rose and supplies its own title", () => {
		const renderer = mount(<EmptyState kind="error" sub="try again in a bit" />);
		expect(fills(renderer)).toContain(WHIMSY.rose);
		expect(
			renderer.root.findAll(
				(node) => node.props.children === "Couldn't load that",
			),
		).not.toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("an error can carry a retry action under the sub line", () => {
		const renderer = mount(
			<EmptyState kind="error" action={<Text>retry</Text>} />,
		);
		expect(
			renderer.root.findAll((node) => node.props.children === "retry"),
		).not.toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("kind=empty stays on paper and keeps its contextual glyph", () => {
		const renderer = mount(
			<EmptyState glyph="zzz" title="The shop is asleep" sub="come back tomorrow" />,
		);
		expect(fills(renderer)).toContain(WHIMSY.paper);
		expect(fills(renderer)).not.toContain(WHIMSY.rose);
		act(() => renderer.unmount());
	});
});

describe("SpotlightOverlay", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
		// measureInWindow is a native call; hand the registry a stable rect so the
		// overlay has a hole to cut. (react-test-renderer never calls the real one.)
		jest
			.spyOn(
				View.prototype as unknown as {
					measureInWindow: (cb: (...n: number[]) => void) => void;
				},
				"measureInWindow",
			)
			.mockImplementation((cb) => cb(40, 80, 120, 44));
	});
	afterEach(() => jest.restoreAllMocks());

	// SpotlightTarget measures on the NEXT frame (measureInWindow is only
	// accurate after the commit), and rAF is a timer in this environment.
	const flushMeasure = async () => {
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20));
		});
	};

	test("announces the caption and seals the screen when it lights up", async () => {
		const onDismiss = jest.fn();
		const renderer = mount(
			<SpotlightProvider>
				<SpotlightTarget id="join">
					<Text>join a Sounder</Text>
				</SpotlightTarget>
				<SpotlightOverlay
					activeId="join"
					caption="join a Sounder — dig after a crewmate ›"
					onDismiss={onDismiss}
				/>
			</SpotlightProvider>,
		);
		await flushMeasure();

		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"join a Sounder — dig after a crewmate ›",
		);
		expect(
			renderer.root.findAll(
				(node) => node.props.accessibilityViewIsModal === true,
			),
		).not.toHaveLength(0);

		// The escape hatch is required and named.
		const skip = renderer.root.findAll(
			(node) => node.props.accessibilityLabel === "Maybe later",
		)[0];
		expect(skip.props.accessibilityRole).toBe("button");
		expect(skip.props.accessibilityHint).toBe("Dismisses this tip");
		act(() => skip.props.onPress());
		expect(onDismiss).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("stays dark until a target has actually measured", async () => {
		const renderer = mount(
			<SpotlightProvider>
				<SpotlightOverlay
					activeId="join"
					caption="nothing to point at yet"
					onDismiss={() => {}}
				/>
			</SpotlightProvider>,
		);
		await flushMeasure();
		expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
		expect(renderer.toJSON()).toBeNull();
		act(() => renderer.unmount());
	});
});
