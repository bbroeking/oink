// Wave-2 primitives: the three PageHeader crowns and the one EffectCard
// drawing. Everything is queried through the ACCESSIBILITY contract — role,
// label, value — rather than by walking to a `Pressable` or a `Text`: that is
// the contract a screen (and a screen reader) actually consumes, and it is the
// one that must not drift when the internals recompose.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { PageHeader } from "@/components/ui/PageHeader";
import {
	EffectCard,
	formatEffectCountdown,
	type EffectCardEffect,
} from "@/components/ui/EffectCard";
import { PAGE_PAD, RULE_WIDTH, SPACE, TAP_MIN, WHIMSY } from "@/constants/theme";

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

// Host elements only. `findAll` also returns the composite that PASSED a prop
// down, so a single rendered button otherwise matches twice — once as <Chip>
// and once as the <Pressable> it becomes.
const host = (n: TestRenderer.ReactTestInstance) => typeof n.type === "string";

function byRole(renderer: TestRenderer.ReactTestRenderer, role: string) {
	return renderer.root.findAll(
		(n) => host(n) && n.props.accessibilityRole === role,
	);
}

function byLabel(renderer: TestRenderer.ReactTestRenderer, label: string) {
	return renderer.root.findAll(
		(n) => host(n) && n.props.accessibilityLabel === label,
	);
}

// The press handler lives on the composite `Pressable`, not on the host view it
// renders, so the tap is fired through the same label the screen reader reads.
function pressableByLabel(
	renderer: TestRenderer.ReactTestRenderer,
	label: string,
) {
	return renderer.root.find(
		(n) =>
			n.props.accessibilityLabel === label &&
			typeof n.props.onPress === "function",
	);
}

function byTestID(renderer: TestRenderer.ReactTestRenderer, testID: string) {
	return renderer.root.find((n) => host(n) && n.props.testID === testID);
}

/** Every string this subtree renders, flattened. */
function texts(node: TestRenderer.ReactTestInstance): string[] {
	return node
		.findAll(() => true)
		.flatMap((n) =>
			React.Children.toArray(n.props.children).filter(
				(c): c is string => typeof c === "string",
			),
		);
}

describe("PageHeader variants", () => {
	test("stack is the default crown: back button, kicker, heading, rule", () => {
		const onBack = jest.fn();
		const renderer = render(
			<PageHeader
				kicker="your closet"
				title="Shop"
				onBack={onBack}
				testID="crown"
			/>,
		);

		const heading = byRole(renderer, "header");
		expect(heading).toHaveLength(1);
		expect(texts(heading[0])).toContain("Shop");

		const back = byLabel(renderer, "Back");
		expect(back).toHaveLength(1);
		expect(back[0].props.accessibilityRole).toBe("button");
		const backStyle = StyleSheet.flatten(back[0].props.style);
		expect(backStyle.minHeight).toBe(TAP_MIN);
		expect(backStyle.minWidth).toBe(TAP_MIN);
		act(() => pressableByLabel(renderer, "Back").props.onPress());
		expect(onBack).toHaveBeenCalledTimes(1);

		// The kicker keeps its ★ and the page-kicker voice.
		expect(texts(renderer.root)).toEqual(
			expect.arrayContaining(["★ ", "your closet"]),
		);

		const wrapStyle = StyleSheet.flatten(byTestID(renderer, "crown").props.style);
		expect(wrapStyle.paddingHorizontal).toBe(PAGE_PAD);
		expect(wrapStyle.paddingTop).toBe(SPACE.sm);
		expect(wrapStyle.paddingBottom).toBe(SPACE.md);

		act(() => renderer.unmount());
	});

	test("tab drops the back affordance and keeps the kicker + heading", () => {
		const renderer = render(
			<PageHeader
				variant="tab"
				kicker="your pig pals"
				title="Friends"
				onBack={jest.fn()}
				testID="crown"
			/>,
		);

		// A tab screen is the root of its stack — no back, even if one is passed.
		expect(byLabel(renderer, "Back")).toHaveLength(0);
		expect(texts(byRole(renderer, "header")[0])).toContain("Friends");

		const wrapStyle = StyleSheet.flatten(byTestID(renderer, "crown").props.style);
		expect(wrapStyle.paddingHorizontal).toBe(PAGE_PAD);
		// iOS is the default test platform: the tab crown matches the header
		// friends.tsx / shop.tsx hand-roll today.
		expect(wrapStyle.paddingTop).toBe(SPACE.sm);
		expect(wrapStyle.paddingBottom).toBe(SPACE.sm);

		act(() => renderer.unmount());
	});

	test("plaque hangs the title in a sun sticker with its hand-voice sub line", () => {
		const renderer = render(
			<PageHeader
				variant="plaque"
				kicker="the dig-off"
				title="The Dig-Off"
				subtitle="sounders, one board"
				onBack={jest.fn()}
			/>,
		);

		const heading = byRole(renderer, "header");
		expect(heading).toHaveLength(1);
		expect(texts(heading[0])).toContain("The Dig-Off");
		expect(texts(renderer.root)).toEqual(
			expect.arrayContaining(["sounders, one board"]),
		);

		// The sign itself: a sun-filled sticker, centred, at the plaque width.
		const plaque = renderer.root.findAll((n) => {
			if (!host(n)) return false;
			const style = StyleSheet.flatten(n.props.style);
			return !!style && style.backgroundColor === WHIMSY.sun;
		});
		expect(plaque.length).toBeGreaterThan(0);
		expect(StyleSheet.flatten(plaque[0].props.style).alignSelf).toBe("center");

		// A plaque wears no title rule — the sign IS the crown.
		expect(byLabel(renderer, "Back")).toHaveLength(1);

		act(() => renderer.unmount());
	});

	test("ruleWidth still reaches the rule, and defaults to RULE_WIDTH", () => {
		const fixed = render(<PageHeader title="Season" />);
		const rules = fixed.root.findAll((n) => {
			if (!host(n)) return false;
			const style = StyleSheet.flatten(n.props.style);
			return !!style && style.width === RULE_WIDTH && style.height !== undefined;
		});
		expect(rules.length).toBeGreaterThan(0);
		act(() => fixed.unmount());

		const wide = render(<PageHeader title="Season" ruleWidth={132} />);
		const widened = wide.root.findAll((n) => {
			if (!host(n)) return false;
			const style = StyleSheet.flatten(n.props.style);
			return !!style && style.width === 132;
		});
		expect(widened.length).toBeGreaterThan(0);
		act(() => wide.unmount());
	});
});

describe("formatEffectCountdown", () => {
	const now = Date.now();

	test("speaks hours and minutes, never seconds", () => {
		expect(formatEffectCountdown(now + 45 * 60_000)).toBe("45m");
		expect(formatEffectCountdown(now + 3 * 3_600_000)).toBe("3h");
		expect(formatEffectCountdown(now + 2 * 3_600_000 + 10 * 60_000)).toBe(
			"2h 10m",
		);
	});

	test("a passed deadline is expiring, not a negative number", () => {
		expect(formatEffectCountdown(now - 60_000)).toBe("expiring");
	});

	test("takes an ISO string as well as epoch ms, and tolerates nothing", () => {
		expect(formatEffectCountdown(new Date(now + 3_600_000).toISOString())).toBe(
			"1h",
		);
		expect(formatEffectCountdown(undefined)).toBe("");
		expect(formatEffectCountdown("not a date")).toBe("");
	});
});

describe("EffectCard", () => {
	const blessing: EffectCardEffect = {
		kind: "bless",
		name: "Warm Tea",
		from: "Rosie",
		expiresAt: Date.now() + 3 * 3_600_000,
	};
	const curse: EffectCardEffect = {
		kind: "curse",
		name: "Mud Slip",
		from: "Bogle",
		expiresAt: Date.now() + 45 * 60_000,
	};
	const SPOKEN_BLESSING = "Warm Tea, blessing, from Rosie, 3h left";

	test("every size announces the same sentence", () => {
		for (const size of ["chip", "row", "detail"] as const) {
			const renderer = render(
				<EffectCard effect={blessing} size={size} onPress={jest.fn()} />,
			);
			expect(byLabel(renderer, SPOKEN_BLESSING).length).toBeGreaterThan(0);
			act(() => renderer.unmount());
		}
	});

	test("chip is a capsule carrying the kind glyph and the name", () => {
		const onPress = jest.fn();
		const renderer = render(
			<EffectCard effect={blessing} size="chip" onPress={onPress} />,
		);

		const capsule = byLabel(renderer, SPOKEN_BLESSING)[0];
		expect(capsule.props.accessibilityRole).toBe("button");
		expect(texts(capsule)).toContain("Warm Tea");
		act(() => pressableByLabel(renderer, SPOKEN_BLESSING).props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);

		act(() => renderer.unmount());
	});

	test("chip without onPress announces as text, not as a fake button", () => {
		const renderer = render(<EffectCard effect={curse} size="chip" />);
		const capsule = renderer.root.findAll(
			(n) =>
				host(n) &&
				typeof n.props.accessibilityLabel === "string" &&
				!!n.props.style,
		);
		expect(
			capsule.some((n) => n.props.accessibilityRole === "text"),
		).toBe(true);
		expect(capsule.some((n) => n.props.accessibilityRole === "button")).toBe(
			false,
		);
		act(() => renderer.unmount());
	});

	test("row writes the countdown in the kind's own ink", () => {
		const blessRenderer = render(<EffectCard effect={blessing} size="row" />);
		const blessInk = blessRenderer.root
			.findAll((n) => host(n) && texts(n).includes("3h"))
			.map((n) => StyleSheet.flatten(n.props.style)?.color)
			.filter(Boolean);
		expect(blessInk).toContain(WHIMSY.bless);
		act(() => blessRenderer.unmount());

		const curseRenderer = render(<EffectCard effect={curse} size="row" />);
		const curseInk = curseRenderer.root
			.findAll((n) => host(n) && texts(n).includes("45m"))
			.map((n) => StyleSheet.flatten(n.props.style)?.color)
			.filter(Boolean);
		expect(curseInk).toContain(WHIMSY.curseGreen);
		act(() => curseRenderer.unmount());
	});

	test("row states who it came from and how long is left", () => {
		const renderer = render(<EffectCard effect={curse} size="row" />);
		const all = texts(renderer.root);
		expect(all).toContain("Mud Slip");
		expect(all).toContain("from Bogle · 45m");
		act(() => renderer.unmount());
	});

	test("detail draws a progressbar of the time left when a duration is known", () => {
		const renderer = render(
			<EffectCard effect={blessing} size="detail" durationMs={6 * 3_600_000} />,
		);

		const bars = byRole(renderer, "progressbar");
		expect(bars).toHaveLength(1);
		// Minutes, not milliseconds — "180 of 360" is a duration a player can
		// picture; a millisecond count is not.
		expect(bars[0].props.accessibilityValue).toEqual({
			min: 0,
			max: 360,
			now: 180,
		});
		act(() => renderer.unmount());
	});

	test("detail omits the track when the caller cannot say how long it ran", () => {
		const renderer = render(<EffectCard effect={blessing} size="detail" />);
		expect(byRole(renderer, "progressbar")).toHaveLength(0);
		expect(texts(renderer.root)).toContain("Warm Tea");
		act(() => renderer.unmount());
	});

	test("an effect with no sender still reads, with no dangling separator", () => {
		const renderer = render(
			<EffectCard
				effect={{ kind: "curse", name: "Zoomies", expiresAt: Date.now() + 60_000 }}
				size="row"
			/>,
		);
		const all = texts(renderer.root);
		expect(all).toContain("1m");
		expect(all.some((t) => t.includes("·"))).toBe(false);
		act(() => renderer.unmount());
	});
});
