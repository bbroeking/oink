import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Switch, Text } from "react-native";

import { Toggle } from "../components/ui/Toggle";
import { DISABLED_TEXT, UI_COLORS, WHIMSY } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const control = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.findByType(Switch);

const textAt = (renderer: TestRenderer.ReactTestRenderer, i: number) =>
	renderer.root.findAllByType(Text)[i];

describe("Toggle", () => {
	test("announces as a switch with its checked state, not as on/off text", () => {
		const renderer = render(
			<Toggle label="Sound" value onValueChange={() => {}} />,
		);

		const sw = control(renderer);
		expect(sw.props.accessibilityRole).toBe("switch");
		expect(sw.props.accessibilityLabel).toBe("Sound");
		expect(sw.props.accessibilityState).toEqual({
			checked: true,
			disabled: false,
		});
		act(() => renderer.unmount());
	});

	test("flips through onValueChange", () => {
		const onValueChange = jest.fn();
		const renderer = render(
			<Toggle label="Haptics" value={false} onValueChange={onValueChange} />,
		);

		act(() => control(renderer).props.onValueChange(true));
		expect(onValueChange).toHaveBeenCalledWith(true);
		act(() => renderer.unmount());
	});

	test("wears the system's track and thumb, never a stock switch colour", () => {
		const renderer = render(
			<Toggle label="Sound" value onValueChange={() => {}} />,
		);

		const sw = control(renderer);
		expect(sw.props.trackColor).toEqual({
			false: UI_COLORS.surfaceStrong,
			true: WHIMSY.sage,
		});
		expect(sw.props.thumbColor).toBe(UI_COLORS.surface);
		act(() => renderer.unmount());
	});

	test("a hint is both the visible line and the spoken one", () => {
		const renderer = render(
			<Toggle
				label="Sound"
				hint="the cabinet's chimes"
				value
				onValueChange={() => {}}
			/>,
		);

		expect(control(renderer).props.accessibilityHint).toBe(
			"the cabinet's chimes",
		);
		expect(textAt(renderer, 1).props.children).toBe("the cabinet's chimes");
		act(() => renderer.unmount());
	});

	test("disabled mutes the ink and never crushes opacity", () => {
		const renderer = render(
			<Toggle label="Sound" value={false} disabled onValueChange={() => {}} />,
		);

		const label = StyleSheet.flatten(textAt(renderer, 0).props.style);
		expect(label.color).toBe(DISABLED_TEXT.color);
		expect(label.opacity).toBeUndefined();
		expect(control(renderer).props.accessibilityState).toEqual({
			checked: false,
			disabled: true,
		});
		act(() => renderer.unmount());
	});
});
