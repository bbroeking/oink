import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text as RNText } from "react-native";

import { T, Kicker, KickerPill, BodySm } from "../components/ui/Text";
import { TYPE, UI_COLORS, WHIMSY } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("Text role primitive", () => {
	test("composes a TYPE role with a semantic tone instead of a bare fontSize", () => {
		const renderer = render(
			<T role="sectionTitle" tone="secondary">
				Your sounder
			</T>,
		);

		const style = StyleSheet.flatten(
			renderer.root.findByType(RNText).props.style,
		);
		expect(style.fontFamily).toBe(TYPE.sectionTitle.fontFamily);
		expect(style.fontSize).toBe(TYPE.sectionTitle.fontSize);
		expect(style.lineHeight).toBe(TYPE.sectionTitle.lineHeight);
		expect(style.color).toBe(UI_COLORS.textSecondary);
		act(() => renderer.unmount());
	});

	test("maps every tone to a theme ink and lets style win last", () => {
		const renderer = render(
			<T tone="onDarkMute" align="center" style={{ marginTop: TYPE.body.fontSize }}>
				on bark
			</T>,
		);

		const style = StyleSheet.flatten(
			renderer.root.findByType(RNText).props.style,
		);
		expect(style.color).toBe(WHIMSY.barkMute);
		expect(style.textAlign).toBe("center");
		expect(style.marginTop).toBe(TYPE.body.fontSize);
		act(() => renderer.unmount());
	});

	test("forwards accessibility props and never shrinks Dynamic Type", () => {
		const renderer = render(
			<BodySm
				accessibilityRole="header"
				accessibilityLabel="Season two"
				testID="season-label"
				numberOfLines={2}
			>
				Season 2
			</BodySm>,
		);

		const text = renderer.root.findByType(RNText);
		expect(text.props.accessibilityRole).toBe("header");
		expect(text.props.accessibilityLabel).toBe("Season two");
		expect(text.props.testID).toBe("season-label");
		expect(text.props.numberOfLines).toBe(2);
		expect(text.props.allowFontScaling).toBeUndefined();
		expect(text.props.adjustsFontSizeToFit).toBeUndefined();
		act(() => renderer.unmount());
	});

	test("Kicker owns the star prefix and can drop it", () => {
		const starred = render(<Kicker>welcome</Kicker>);
		expect(starred.root.findByType(RNText).props.children).toEqual([
			"★ ",
			"welcome",
		]);
		const style = StyleSheet.flatten(
			starred.root.findByType(RNText).props.style,
		);
		expect(style.color).toBe(UI_COLORS.action);
		expect(style.fontFamily).toBe(TYPE.kicker.fontFamily);
		act(() => starred.unmount());

		const bare = render(<Kicker star={false}>welcome</Kicker>);
		expect(bare.root.findByType(RNText).props.children).toEqual([
			null,
			"welcome",
		]);
		act(() => bare.unmount());
	});

	test("KickerPill speaks the tracked uppercase role in mute ink", () => {
		const renderer = render(<KickerPill>the shop</KickerPill>);

		const style = StyleSheet.flatten(
			renderer.root.findByType(RNText).props.style,
		);
		expect(style.textTransform).toBe("uppercase");
		expect(style.letterSpacing).toBe(TYPE.kickerPill.letterSpacing);
		expect(style.color).toBe(UI_COLORS.textSecondary);
		act(() => renderer.unmount());
	});
});
