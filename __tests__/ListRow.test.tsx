import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Dimensions, StyleSheet, Text, View, type ScaledSize } from "react-native";

import { ListRow, NavRow } from "../components/ui/ListRow";
import { Skeleton } from "../components/ui/Skeleton";
import { Icon } from "../components/ui/Icon";
import {
	BORDER,
	RADII,
	ROW_TILTS,
	SPACE,
	TAP_MIN,
	UI_COLORS,
} from "../constants/theme";

// react-test-renderer 19 cannot resolve `Pressable` by type; query the row by
// the a11y contract it promises instead, as the rest of this repo does.
const button = (renderer: TestRenderer.ReactTestRenderer) =>
	renderer.root.find(
		(node) =>
			node.props.accessibilityRole === "button" &&
			typeof node.props.style === "function",
	);

const rootStyle = (renderer: TestRenderer.ReactTestRenderer) =>
	StyleSheet.flatten(button(renderer).props.style({ pressed: false }));

describe("ListRow", () => {
	test("takes its turn from ROW_TILTS and labels itself from the title", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Maple" sub="streak 12" index={1} onPress={onPress} />,
			);
		});

		const pressable = button(renderer);
		expect(pressable.props.accessibilityLabel).toBe("Maple");

		const style = rootStyle(renderer);
		expect(style.transform).toEqual([{ rotate: `${ROW_TILTS[1]}deg` }]);
		expect(style.borderRadius).toBe(RADII.md);
		expect(style.paddingVertical).toBe(SPACE.sm);
		expect(style.paddingHorizontal).toBe(SPACE.md);
		expect(style.gap).toBe(SPACE.md);

		const labels = renderer.root
			.findAllByType(Text)
			.map((node) => node.props.children);
		expect(labels).toContain("Maple");
		expect(labels).toContain("streak 12");

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("selected pins the row straight and wears the heavy border", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="You" index={3} selected onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.borderWidth).toBe(BORDER.heavy);
		expect(style.transform).toEqual([{ rotate: "0deg" }]);
		act(() => renderer.unmount());
	});

	test("muted is the 'trotted on' row: muted fill, secondary ink, no dimming", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Clover" sub="trotted on" muted onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.backgroundColor).toBe(UI_COLORS.surfaceStrong);
		expect(style.opacity).toBeUndefined();

		const title = renderer.root
			.findAllByType(Text)
			.find((node) => node.props.children === "Clover");
		expect(StyleSheet.flatten(title?.props.style).color).toBe(
			UI_COLORS.textSecondary,
		);
		act(() => renderer.unmount());
	});

	test("loading defers to the shared row skeleton", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(<ListRow title="Maple" loading />);
		});

		expect(renderer.root.findAllByType(Skeleton).length).toBeGreaterThan(0);
		expect(
			renderer.root.findAll(
				(node) => node.props.accessibilityRole === "button",
			),
		).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("tilt={false} straightens the row without selecting it", () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<ListRow title="Flat" index={2} tilt={false} onPress={() => {}} />,
			);
		});

		const style = rootStyle(renderer);
		expect(style.transform).toEqual([{ rotate: "0deg" }]);
		expect(style.borderWidth).toBe(BORDER.ink);
		act(() => renderer.unmount());
	});
});

describe("NavRow", () => {
	test("draws an icon bubble, the badge and a chevron, and announces the label", () => {
		const onPress = jest.fn();
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(
				<NavRow
					icon="bell"
					label="Notifications"
					sub="3 unread"
					badge={<Text>3</Text>}
					onPress={onPress}
				/>,
			);
		});

		const pressable = button(renderer);
		// The name is everything the row says: label, sub line, badge.
		// (2026-10-04, Me ask M-03)
		expect(pressable.props.accessibilityLabel).toBe("Notifications, 3 unread, 3");

		const icons = renderer.root
			.findAllByType(Icon)
			.map((node) => node.props.name);
		expect(icons).toContain("bell");
		expect(icons).toContain("chevronRight");

		act(() => pressable.props.onPress());
		expect(onPress).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});
});

describe("ListRow's split row (the action slot)", () => {
	// Is any ANCESTOR of this node an accessibility element? An element hides
	// everything inside it from VoiceOver, so a control under one is unreachable.
	const insideAnElement = (node: TestRenderer.ReactTestInstance) => {
		for (let p = node.parent; p; p = p.parent) {
			if (p.props.accessible === true) return true;
		}
		return false;
	};
	const byId = (renderer: TestRenderer.ReactTestRenderer, id: string) =>
		renderer.root.findAll((n) => n.props.testID === id)[0];
	const mount = (element: React.ReactElement) => {
		let renderer!: TestRenderer.ReactTestRenderer;
		act(() => {
			renderer = TestRenderer.create(element);
		});
		return renderer;
	};

	test("the action is its own element, and so is a panel in `after` (the friend row's Actions)", () => {
		const renderer = mount(
			<ListRow
				title="alice"
				onPress={() => {}}
				testID="row"
				action={<View testID="trigger" accessible accessibilityRole="button" accessibilityLabel="Actions for alice" />}
				after={<View testID="panel" accessibilityRole="menu" accessibilityLabel="Actions for alice" />}
			/>,
		);
		expect(insideAnElement(byId(renderer, "trigger"))).toBe(false);
		expect(insideAnElement(byId(renderer, "panel"))).toBe(false);
		// The identity is still one button, named by the title.
		const identity = renderer.root.findAll(
			(n) => n.props.testID === "row" && n.props.accessibilityRole === "button",
		)[0];
		expect(identity.props.accessibilityLabel).toBe("alice");
		act(() => renderer.unmount());
	});

	test("paint and focus order: identity, overlay, action, rail, after; and the slide is clipped", () => {
		const renderer = mount(
			<ListRow
				title="alice"
				onPress={() => {}}
				testID="row"
				overlay={<View testID="overlay" />}
				action={<View testID="trigger" />}
				trailing={<View testID="rail" />}
				after={<View testID="panel" />}
			/>,
		);
		const order = renderer.root
			.findAll((n) => typeof n.props.testID === "string")
			.map((n) => n.props.testID as string)
			.filter((id, i, all) => all.indexOf(id) === i);
		expect(order).toEqual(["row", "overlay", "trigger", "rail", "panel"]);
		// The row clips, so a sliding layer is cut at the card edge.
		const card = renderer.root.findAll(
			(n) => n.type === View && StyleSheet.flatten(n.props.style)?.overflow === "hidden",
		);
		expect(card.length).toBeGreaterThan(0);
		act(() => renderer.unmount());
	});

	test("the identity's hit frame reaches into the card's pad, and fills the row's height", () => {
		const renderer = mount(
			<ListRow title="alice" onPress={() => {}} testID="row" action={<View />} />,
		);
		const identity = renderer.root.findAll(
			(n) => n.props.testID === "row" && typeof n.props.style === "function",
		)[0];
		expect(identity.props.hitSlop).toEqual({
			top: SPACE.sm,
			bottom: SPACE.sm,
			left: SPACE.md,
			right: 0,
		});
		const style = StyleSheet.flatten(identity.props.style({ pressed: false }));
		expect(style.alignSelf).toBe("stretch");
		expect(style.minHeight).toBe(TAP_MIN);
		act(() => renderer.unmount());

		// A flat row has no side pad to reach into.
		const flat = mount(
			<ListRow title="alice" flat onPress={() => {}} testID="row" action={<View />} />,
		);
		const flatIdentity = flat.root.findAll(
			(n) => n.props.testID === "row" && typeof n.props.style === "function",
		)[0];
		expect(flatIdentity.props.hitSlop.left).toBe(0);
		act(() => flat.unmount());
	});

	test("custom actions reach the row's button in every drawing", () => {
		const actions = [{ name: "sendPig", label: "Send a pig to look for a river pebble" }];
		const onAction = jest.fn();
		for (const extra of [{}, { action: <View /> }, { footer: <View /> }]) {
			const renderer = mount(
				<ListRow
					title="alice"
					onPress={() => {}}
					accessibilityActions={actions}
					onAccessibilityAction={onAction}
					{...extra}
				/>,
			);
			const row = renderer.root.findAll(
				(n) => n.props.accessibilityRole === "button" && n.props.accessibilityActions,
			)[0];
			expect(row.props.accessibilityActions).toEqual(actions);
			row.props.onAccessibilityAction({ nativeEvent: { actionName: "sendPig" } });
			act(() => renderer.unmount());
		}
		expect(onAction).toHaveBeenCalledTimes(3);
	});

	test("past the chrome ceiling the action moves under the identity; a row with a panel keeps its line", () => {
		const window = Dimensions.get("window");
		const screen = Dimensions.get("screen");
		const atScale = (fontScale: number) =>
			act(() => Dimensions.set({ window: { ...window, fontScale } as ScaledSize, screen }));
		const parentStyle = (renderer: TestRenderer.ReactTestRenderer, id: string) =>
			StyleSheet.flatten(byId(renderer, id).parent?.props.style);
		atScale(1.94);
		try {
			// The Share pill's row (Me, "Invite new pigs") at accessibility-large.
			const stacked = mount(
				<ListRow
					title="Invite new pigs"
					sub="DEMOP-3KX2 · 0/3 · Messenger Hat"
					onPress={() => {}}
					testID="row"
					action={<View testID="share" />}
					trailing={<View testID="rail" />}
				/>,
			);
			// The action sits on its own line at its own width...
			expect(parentStyle(stacked, "share")?.alignSelf).toBe("flex-start");
			// ...under one line holding the identity and its chevron.
			let line = byId(stacked, "rail").parent;
			while (line && StyleSheet.flatten(line.props.style)?.flexDirection !== "row") line = line.parent;
			expect(line).toBeTruthy();
			expect(line?.findAll((n) => n.props.testID === "row").length).toBeGreaterThan(0);
			expect(line?.findAll((n) => n.props.testID === "share").length).toBe(0);
			const card = stacked.root.findAll(
				(n) => n.type === View && StyleSheet.flatten(n.props.style)?.flexDirection === "column",
			);
			expect(card.length).toBeGreaterThan(0);
			// The action is still its own element, and focus still meets the
			// identity first (the rail is out of the tree).
			expect(insideAnElement(byId(stacked, "share"))).toBe(false);
			act(() => stacked.unmount());

			// The friend row lays its slide-over panel against one line: it keeps it.
			const panelRow = mount(
				<ListRow
					title="alice"
					onPress={() => {}}
					testID="row"
					action={<View testID="trigger" />}
					after={<View testID="panel" />}
				/>,
			);
			expect(parentStyle(panelRow, "trigger")?.alignSelf).toBeUndefined();
			act(() => panelRow.unmount());
			// At the default size (1.0; jest's own window says 2) it is one line.
			atScale(1);
			const inline = mount(
				<ListRow title="Invite new pigs" onPress={() => {}} testID="row" action={<View testID="share" />} />,
			);
			expect(parentStyle(inline, "share")?.alignSelf).toBeUndefined();
			act(() => inline.unmount());
		} finally {
			atScale(window.fontScale);
		}
	});
});
