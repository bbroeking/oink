// The Barn (Home) polish pass, 2026-10-04 (docs/design/polish-2026-10-04/
// findings-barn.md). Each test pins one finding: the Barn button's "+" is a
// button VoiceOver can reach, every fan row is one labelled button, the mound
// has a whole touch frame and its tag stands above it, the earned stamp is
// spoken as one sentence and never flashes a "0", and every word on the coin
// states the chrome type ceiling.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, View } from "react-native";

import { BarnButton, type BarnFanOption } from "../components/BarnButton";
import { FindTile } from "../components/satchel/FindTile";
import { BuriedMound } from "../components/BuriedMound";
import { EarnedStamp } from "../components/EarnedStamp";
import { TickleCoin } from "../components/TickleCoin";
import { CHROME_TYPE_CAP, TAP_MIN } from "../constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

const OPTIONS: BarnFanOption[] = [
	{
		key: "barn",
		title: "Barn",
		label: "barn",
		mark: "door",
		onPress: jest.fn(),
		accessibilityLabel: "Your Barn",
		accessibilityHint: "Opens the doors to your room and furnishings",
	},
	{
		key: "dig",
		title: "Dig",
		label: "dig",
		mark: "shovel",
		onPress: jest.fn(),
		accessibilityLabel: "Truffle Patch",
		disabled: true,
		disabledLine: "the patch opens in 1h 7m",
	},
	{
		key: "satchel",
		title: "Satchel",
		sub: "6 finds",
		label: "satchel",
		mark: "bag",
		onPress: jest.fn(),
		accessibilityLabel: "Your Satchel",
	},
];

/** Is `node` inside a host element that is itself an accessible button? */
function insideAButton(node: TestRenderer.ReactTestInstance) {
	let parent = node.parent;
	while (parent) {
		if (parent.props.accessibilityRole === "button" && parent !== node) return true;
		parent = parent.parent;
	}
	return false;
}

describe("The Barn button (B-01, B-02)", () => {
	test("the \"+\" is its own button, never nested inside the face", () => {
		const renderer = render(
			<BarnButton options={OPTIONS} armedKey="barn" onArm={jest.fn()} />,
		);
		const more = renderer.root.findByProps({ testID: "barn-button-more" });
		expect(more.props.accessibilityRole).toBe("button");
		expect(more.props.accessibilityLabel).toBe("More actions");
		// iOS exposes one accessible element and hides what is inside it: a
		// "+" nested in the face was a button VoiceOver could never reach.
		expect(insideAButton(more)).toBe(false);
		// The 26pt disc keeps a 44pt touch frame.
		const slop = more.props.hitSlop as number;
		expect(26 + slop * 2).toBeGreaterThanOrEqual(TAP_MIN);
		act(() => renderer.unmount());
	});

	test("every fan row is one labelled button that says what it draws", () => {
		const renderer = render(
			<BarnButton options={OPTIONS} armedKey="barn" onArm={jest.fn()} />,
		);
		act(() => renderer.root.findByProps({ testID: "barn-button-more" }).props.onPress());
		const row = (key: string) => renderer.root.findByProps({ testID: `barn-fan-${key}` });
		for (const key of ["barn", "dig", "satchel"]) {
			expect(row(key).props.accessible).toBe(true);
			expect(row(key).props.accessibilityRole).toBe("button");
		}
		expect(row("barn").props.accessibilityLabel).toBe("Barn");
		expect(row("satchel").props.accessibilityLabel).toBe("Satchel, 6 finds");
		expect(row("dig").props.accessibilityLabel).toBe("Dig, the patch opens in 1h 7m");
		expect(row("dig").props.accessibilityState).toEqual(
			expect.objectContaining({ disabled: true }),
		);
		// The armed one leads and says so.
		expect(row("barn").props.accessibilityState).toEqual(
			expect.objectContaining({ selected: true }),
		);
		// Chrome on the scene: the rows state their type ceiling.
		const rowText = row("satchel").findAllByType(Text);
		expect(rowText.length).toBeGreaterThan(0);
		for (const text of rowText) expect(text.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		// While the fan is open the face is the close, and the "+" is gone.
		expect(renderer.root.findAllByProps({ testID: "barn-button-more" })).toHaveLength(0);
		act(() => renderer.unmount());
	});
});

describe("The buried mound (B-07, B-08)", () => {
	test("the mound keeps a 44pt touch frame without growing", () => {
		const renderer = render(<BuriedMound remaining={50} onPress={jest.fn()} />);
		const mound = renderer.root.find(
			(node) =>
				node.props.accessibilityLabel === "Your buried truffle" &&
				node.props.accessibilityRole === "button" &&
				node.props.hitSlop !== undefined,
		);
		const slop = mound.props.hitSlop as { top: number; bottom: number };
		expect(24 + slop.top + slop.bottom).toBeGreaterThanOrEqual(TAP_MIN);
		act(() => renderer.unmount());
	});

	test("a tap unfolds the tag ABOVE the mound, and the tag opens the sheet", () => {
		const onPress = jest.fn();
		const renderer = render(<BuriedMound remaining={50} onPress={onPress} />);
		const mound = () =>
			renderer.root.find(
				(node) =>
					node.props.accessibilityLabel === "Your buried truffle" &&
					typeof node.props.onPress === "function",
			);
		act(() => mound().props.onPress());
		const tag = renderer.root.find(
			(node) =>
				node.props.accessibilityLabel === "50 snouts buried" &&
				typeof node.props.onPress === "function",
		);
		// The tag stands over the mound in the spot's column — first in the
		// tree, so it rises above the mound rather than sitting on Rosie.
		const spot = renderer.root.findAllByType(View)[0];
		const order = spot.children.map((child) =>
			typeof child === "string" ? child : child.findAll((node) => node === tag).length > 0 ? "tag" : "other",
		);
		expect(order[0]).toBe("tag");
		for (const text of tag.findAllByType(Text)) {
			expect(text.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		}
		act(() => tag.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});
});

describe("The earned stamp (B-03, B-05, B-09)", () => {
	test("is spoken as one sentence, not two fragments", () => {
		const renderer = render(<EarnedStamp total={452} />);
		const stamp = renderer.root.find(
			(node) => node.props.accessible === true && node.props.accessibilityRole === "text",
		);
		expect(stamp.props.accessibilityLabel).toBe("452 tickles earned");
		for (const text of stamp.findAllByType(Text)) {
			expect(text.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		}
		act(() => renderer.unmount());
	});

	test("reads a placeholder, never a 0, while the bank is still loading", () => {
		const renderer = render(<EarnedStamp total={0} loaded={false} />);
		const stamp = renderer.root.find(
			(node) => node.props.accessible === true && node.props.accessibilityRole === "text",
		);
		expect(stamp.props.accessibilityLabel).toBe("Tickles earned, still loading");
		const words = renderer.root
			.findAllByType(Text)
			.map((node) => node.props.children)
			.flat()
			.filter((part) => typeof part === "string");
		expect(words).toContain("·");
		expect(words).not.toContain("0");
		act(() => renderer.unmount());
	});
});

describe("The coin (B-04)", () => {
	test("every word on the coin states the chrome type ceiling", () => {
		const renderer = render(
			<TickleCoin
				count={7}
				cap={25}
				streak={3}
				nextRegenSeconds={120}
				regenSeconds={3600}
				fetchedAtMs={Date.now()}
				onPress={jest.fn()}
				onShareStreak={jest.fn()}
				ribbon="Lucky pig · 3 left"
				wallowRank={4}
			/>,
		);
		const texts = renderer.root.findAllByType(Text);
		// The numeral, the cap line, the rank tag, the streak, the clock, the ribbon.
		expect(texts.length).toBeGreaterThanOrEqual(6);
		for (const text of texts) expect(text.props.maxFontSizeMultiplier).toBe(CHROME_TYPE_CAP);
		act(() => renderer.unmount());
	});
});

describe("The Satchel's bag tile", () => {
	test("offers hold-to-toss as a named action a screen reader can perform", () => {
		const onAction = jest.fn();
		const renderer = render(
			<FindTile
				id="river_pebble"
				onLongPress={jest.fn()}
				accessibilityRole="button"
				accessibilityLabel="river pebble"
				accessibilityActions={[{ name: "toss", label: "Toss" }]}
				onAccessibilityAction={onAction}
			/>,
		);
		const tile = renderer.root.find(
			(node) =>
				node.props.accessibilityLabel === "river pebble" &&
				Array.isArray(node.props.accessibilityActions),
		);
		expect(tile.props.accessibilityActions).toEqual([{ name: "toss", label: "Toss" }]);
		act(() => tile.props.onAccessibilityAction({ nativeEvent: { actionName: "toss" } }));
		expect(onAction).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});
});
