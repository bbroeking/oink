import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text as RNText, View } from "react-native";

import { Stat } from "../components/ui/Stat";
import { Glyph } from "../components/ui/Glyph";
import { TYPE, UI_COLORS, WHIMSY } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("Stat progression readout", () => {
	test("reads value and label as one accessible string", () => {
		const renderer = render(<Stat value={1250} label="snouts" />);

		const wrap = renderer.root.find(
			(node) =>
				node.type === View && node.props.accessibilityRole === "text",
		);
		expect(wrap.props.accessibilityLabel).toBe("1250 snouts");
		expect(wrap.props.accessible).toBe(true);
		act(() => renderer.unmount());
	});

	test("uses the large numeral role at size lg", () => {
		const renderer = render(<Stat value="1,250" label="snouts" size="lg" />);

		const numeral = StyleSheet.flatten(
			renderer.root.findAllByType(RNText)[0].props.style,
		);
		expect(numeral.fontSize).toBe(TYPE.numeralLg.fontSize);
		expect(numeral.fontFamily).toBe(TYPE.numeralLg.fontFamily);
		expect(numeral.color).toBe(UI_COLORS.textPrimary);
		act(() => renderer.unmount());
	});

	test("burns the streak in flame and a blessing in gold", () => {
		const flame = render(<Stat value={12} label="day streak" tone="flame" />);
		expect(
			StyleSheet.flatten(flame.root.findAllByType(RNText)[0].props.style).color,
		).toBe(WHIMSY.flame);
		act(() => flame.unmount());

		const gold = render(<Stat value={3} label="blessings" tone="gold" />);
		expect(
			StyleSheet.flatten(gold.root.findAllByType(RNText)[0].props.style).color,
		).toBe(WHIMSY.bless);
		act(() => gold.unmount());
	});

	test("writes the caption in the small tracked pill role", () => {
		const renderer = render(<Stat value={18} label="finds" />);

		const label = StyleSheet.flatten(
			renderer.root.findAllByType(RNText)[1].props.style,
		);
		expect(label.fontSize).toBe(TYPE.kickerPillSm.fontSize);
		expect(label.textTransform).toBe("uppercase");
		expect(label.color).toBe(UI_COLORS.textSecondary);
		act(() => renderer.unmount());
	});

	test("sizes an optional glyph to the numeral it sits beside", () => {
		const renderer = render(<Stat value={7} label="truffles" glyph="gem" />);

		expect(renderer.root.findByType(Glyph).props.size).toBe(
			TYPE.numeral.fontSize,
		);
		act(() => renderer.unmount());
	});
});
