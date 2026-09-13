import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image, StyleSheet, Text as RNText, View } from "react-native";

import { Avatar } from "../components/ui/Avatar";
import { Glyph } from "../components/ui/Glyph";
import {
	AVATAR_GLYPH_FRAC,
	AVATAR_SIZE,
	BORDER,
	RADII,
	UI_COLORS,
	WHIMSY,
} from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

function frame(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root.find(
		(node) => node.type === View && node.props.accessibilityRole === "image",
	);
}

describe("Avatar frame", () => {
	test("is an ink-outlined pastel disc at the default tokenized size", () => {
		const renderer = render(<Avatar label="Rosie" />);

		const style = StyleSheet.flatten(frame(renderer).props.style);
		expect(style.width).toBe(AVATAR_SIZE[1]);
		expect(style.height).toBe(AVATAR_SIZE[1]);
		expect(style.borderRadius).toBe(RADII.pill);
		expect(style.borderWidth).toBe(BORDER.ink);
		expect(style.borderColor).toBe(UI_COLORS.border);
		expect(style.backgroundColor).toBe(WHIMSY.rose);
		expect(style.overflow).toBe("hidden");
		act(() => renderer.unmount());
	});

	test("announces itself as a labelled image", () => {
		const renderer = render(<Avatar label="Pepper the pig" />);

		const node = frame(renderer);
		expect(node.props.accessible).toBe(true);
		expect(node.props.accessibilityRole).toBe("image");
		expect(node.props.accessibilityLabel).toBe("Pepper the pig");
		act(() => renderer.unmount());
	});

	test("takes its fill from WHIMSY and its size from AVATAR_SIZE", () => {
		const renderer = render(
			<Avatar label="Bandit" size={AVATAR_SIZE[2]} fill="sky" />,
		);

		const style = StyleSheet.flatten(frame(renderer).props.style);
		expect(style.width).toBe(AVATAR_SIZE[2]);
		expect(style.backgroundColor).toBe(WHIMSY.sky);
		act(() => renderer.unmount());
	});

	test("prefers a source image, then a glyph, then children", () => {
		const withSource = render(
			<Avatar label="Rosie" source={{ uri: "https://example.test/r.png" }} glyph="pigface" />,
		);
		expect(withSource.root.findAllByType(Image)).toHaveLength(1);
		expect(withSource.root.findAllByType(Glyph)).toHaveLength(0);
		act(() => withSource.unmount());

		const withGlyph = render(
			<Avatar label="Inbox" size={AVATAR_SIZE[0]} glyph="bell">
				<RNText>ignored</RNText>
			</Avatar>,
		);
		expect(withGlyph.root.findByType(Glyph).props.size).toBe(
			Math.round(AVATAR_SIZE[0] * AVATAR_GLYPH_FRAC),
		);
		expect(withGlyph.root.findAllByType(RNText)).toHaveLength(0);
		act(() => withGlyph.unmount());

		const withChildren = render(
			<Avatar label="Initials">
				<RNText>BB</RNText>
			</Avatar>,
		);
		expect(withChildren.root.findByType(RNText).props.children).toBe("BB");
		act(() => withChildren.unmount());
	});
});
