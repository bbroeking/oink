import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet, Text as RNText, View } from "react-native";

import { Stat } from "../components/ui/Stat";
import { Glyph } from "../components/ui/Glyph";
import { CHROME_TYPE_CAP, TYPE, UI_COLORS, WHIMSY } from "../constants/theme";

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

	test("the caption states the chrome ceiling, so a word never breaks mid-word (after/107)", () => {
		// "LIFETIME" in the passport's 103pt column broke as "LIFETIM / E" at
		// accessibility-large; at the cap it is ~75pt.
		const renderer = render(<Stat value={453} label="lifetime tickles" />);
		const [numeral, caption] = renderer.root.findAllByType(RNText);
		expect(caption.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		// The numeral keeps spec §1.2's full scale unless the caller asks.
		expect(numeral.props.maxFontSizeMultiplier).toBeUndefined();
		act(() => renderer.unmount());
	});

	test("a fixed-width band caps the numeral too; the caption takes the lower ceiling", () => {
		const capped = render(
			<Stat value="12,345" label="lifetime tickles" maxFontSizeMultiplier={CHROME_TYPE_CAP} />,
		);
		const [numeral, caption] = capped.root.findAllByType(RNText);
		expect(numeral.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		expect(caption.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		act(() => capped.unmount());

		const tighter = render(<Stat value={10} label="active days" maxFontSizeMultiplier={1.1} />);
		expect(tighter.root.findAllByType(RNText)[1].props.maxFontSizeMultiplier).toBe(1.1);
		act(() => tighter.unmount());
	});

	test("sizes an optional glyph to the numeral it sits beside", () => {
		const renderer = render(<Stat value={7} label="truffles" glyph="gem" />);

		expect(renderer.root.findByType(Glyph).props.size).toBe(
			TYPE.numeral.fontSize,
		);
		act(() => renderer.unmount());
	});
});
