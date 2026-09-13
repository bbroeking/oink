import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, TextInput } from "react-native";

import { TextField } from "../components/ui/TextField";
import { BORDER, TAP_MIN, UI_COLORS } from "../constants/theme";

function mount(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

function input(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root.findByType(TextInput);
}

function well(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root
		.findAll((node) => {
			const style = StyleSheet.flatten(node.props.style);
			return style?.minHeight === TAP_MIN + 4;
		})
		.map((node) => StyleSheet.flatten(node.props.style))[0];
}

describe("TextField", () => {
	test("names itself, styles its placeholder from a role, and clears the tap floor", () => {
		const renderer = mount(
			<TextField
				label="username"
				value="rosie_the_brave"
				onChangeText={() => {}}
				placeholder="pick a name"
				helper="letters, numbers and _ only"
			/>,
		);

		const field = input(renderer);
		expect(field.props.accessibilityLabel).toBe("username");
		expect(field.props.placeholderTextColor).toBe(UI_COLORS.textPlaceholder);
		expect(field.props.accessibilityHint).toBe("letters, numbers and _ only");
		expect(well(renderer).borderWidth).toBe(BORDER.ink);
		expect(well(renderer).backgroundColor).toBe(UI_COLORS.surface);
		act(() => renderer.unmount());
	});

	test("focus thickens the well and paints the focus ring", () => {
		const renderer = mount(
			<TextField label="code" value="" onChangeText={() => {}} />,
		);
		act(() => input(renderer).props.onFocus({}));
		expect(well(renderer).borderWidth).toBe(BORDER.heavy);
		expect(well(renderer).borderColor).toBe(UI_COLORS.focus);
		act(() => input(renderer).props.onBlur({}));
		expect(well(renderer).borderWidth).toBe(BORDER.ink);
		act(() => renderer.unmount());
	});

	test("error is written, not only painted", () => {
		const renderer = mount(
			<TextField
				label="username"
				value="!!"
				onChangeText={() => {}}
				state="error"
				errorText="that one's taken"
			/>,
		);
		const style = well(renderer);
		expect(style.backgroundColor).toBe(UI_COLORS.dangerSurface);
		expect(style.borderColor).toBe(UI_COLORS.dangerText);
		expect(input(renderer).props.accessibilityHint).toBe(
			"Needs fixing. that one's taken",
		);
		// `.at(-1)` is the host Text the Hand role finally renders — the only node
		// carrying the resolved style array.
		const message = renderer.root
			.findAll((node) => node.props.children === "that one's taken")
			.at(-1)!;
		expect(StyleSheet.flatten(message.props.style).color).toBe(
			UI_COLORS.dangerText,
		);
		act(() => renderer.unmount());
	});

	test("valid adds the check mark in the success ink", () => {
		const renderer = mount(
			<TextField
				label="username"
				value="rosie"
				onChangeText={() => {}}
				state="valid"
			/>,
		);
		const check = renderer.root.findAll(
			(node) => node.props.name === "check" && node.props.color,
		)[0];
		expect(check.props.color).toBe(UI_COLORS.successText);
		act(() => renderer.unmount());
	});

	test("forwards the typing contract and the passthrough input props", () => {
		const onChangeText = jest.fn();
		const renderer = mount(
			<TextField
				label="code"
				value=""
				onChangeText={onChangeText}
				secure
				autoCapitalize="none"
				keyboardType="number-pad"
				maxLength={6}
				testID="code-field"
			/>,
		);
		const field = input(renderer);
		expect(field.props.secureTextEntry).toBe(true);
		expect(field.props.autoCapitalize).toBe("none");
		expect(field.props.keyboardType).toBe("number-pad");
		expect(field.props.maxLength).toBe(6);
		expect(field.props.testID).toBe("code-field");
		act(() => field.props.onChangeText("ABC"));
		expect(onChangeText).toHaveBeenCalledWith("ABC");
		act(() => renderer.unmount());
	});
});
