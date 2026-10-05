// The Barn interior polish pass, 2026-10-04 (docs/design/polish-2026-10-04/
// findings-barn.md): decorate mode draws a spot's box only when it means
// something, the centrepiece's control rides the rug's front edge instead of
// Rosie's bandana, a tapped furnishing reports where it stands, the gift
// reveal's title is honest about its source, the item sheet's rarity reads
// the Shop's badge, and a failed Barn read never shows a raw reason code.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";

import { HabitatScene, habitatRect, resolveHabitatCanvas } from "@/components/habitat/HabitatScene";
import { HabitatItemPreviewModal } from "@/components/habitat/HabitatItemPreviewModal";
import { HabitatStarterWelcome } from "@/components/habitat/HabitatStarterWelcome";
import { habitatTroubleCopy } from "@/app/barn-interior";
import {
	HABITAT_CATALOG_BY_ID,
	HABITAT_POSITIONS,
	HABITAT_STARTER_POSITIONS,
} from "@/constants/habitat";
import { RARITY_BADGE, TINT, WHIMSY } from "@/constants/theme";
import type { HabitatPosition, HabitatSnapshot } from "@/utils/habitat";

// barn-interior is a route file; its router imports are stood in here, as
// BarnInterior.test.tsx does.
jest.mock("expo-router", () => ({
	Stack: { Screen: () => null },
	Redirect: () => null,
	router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true, setParams: jest.fn() },
	useLocalSearchParams: () => ({}),
	useFocusEffect: () => {},
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => true }));
// The owner's pig is the Home controller (Barn), which this suite never needs.
jest.mock("@/components/habitat/HabitatOwnerPig", () => ({ HabitatOwnerPig: () => null }));
jest.mock("@/components/habitat/HabitatWorkshopCabinet", () => ({
	HabitatWorkshopCabinet: () => null,
}));
jest.mock("react-native-safe-area-context", () => ({
	SafeAreaProvider: ({ children }: any) => children,
	SafeAreaView: ({ children }: any) => children,
	useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const snapshot = (
	positions: Partial<Record<HabitatPosition, string | null>> = {},
): HabitatSnapshot => ({
	ownerId: "owner",
	revision: 1,
	positions: Object.fromEntries(
		HABITAT_POSITIONS.map((position) => {
			const id =
				positions[position] === undefined ? HABITAT_STARTER_POSITIONS[position] : positions[position];
			return [position, id ? HABITAT_CATALOG_BY_ID[id] : null];
		}),
	) as HabitatSnapshot["positions"],
});

function render(node: React.ReactElement) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(node);
	});
	return renderer;
}

describe("Decorate mode (008)", () => {
	const furnished = snapshot({
		wall: "rosies_pencil_sketch",
		floor_centerpiece: "patchwork_rug",
		floor_left: "sunflower_crock",
	});

	test("a furnished spot draws no dashed box; an empty one wears the waiting grammar", () => {
		const renderer = render(
			<HabitatScene snapshot={furnished} editing onSelectPosition={jest.fn()} />,
		);
		const box = (position: HabitatPosition) =>
			StyleSheet.flatten(renderer.root.findByProps({ testID: `habitat-spot-${position}` }).props.style);
		// Furnished: the furniture and its pencil, no outline over the room.
		for (const position of ["wall", "floor_centerpiece", "floor_left"] as const) {
			expect(box(position).borderStyle).toBeUndefined();
			expect(box(position).borderWidth).toBeUndefined();
		}
		// Empty: dashed, on the theme's paper veil (no hand-typed rgba).
		for (const position of ["ceiling", "floor_right", "surface"] as const) {
			expect(box(position).borderStyle).toBe("dashed");
			expect(box(position).backgroundColor).toBe(TINT.paperVeil);
		}
		act(() => renderer.unmount());
	});

	test("the selected spot draws a whole sun outline, furnished or not", () => {
		const renderer = render(
			<HabitatScene snapshot={furnished} editing selectedPosition="wall" onSelectPosition={jest.fn()} />,
		);
		const wall = StyleSheet.flatten(renderer.root.findByProps({ testID: "habitat-spot-wall" }).props.style);
		expect(wall.borderColor).toBe(WHIMSY.sun);
		expect(wall.borderStyle).toBe("solid");
		expect(wall.borderWidth).toBeGreaterThan(0);
		expect(wall.backgroundColor).toBe(TINT.sunVeil);
		act(() => renderer.unmount());
	});

	test("the centrepiece's control rides the rug's front edge, not Rosie's bandana", () => {
		const renderer = render(
			<HabitatScene snapshot={furnished} editing onSelectPosition={jest.fn()} />,
		);
		// The scene measures nothing in a test render, so it draws on the
		// authored 390 x 844 canvas.
		const canvas = resolveHabitatCanvas({ width: 390, height: 844 });
		const control = (position: HabitatPosition) =>
			StyleSheet.flatten(
				renderer.root.findByProps({ testID: `habitat-position-${position}` }).props.style({ pressed: false }),
			);
		const rug = habitatRect("floor_centerpiece", canvas);
		expect(control("floor_centerpiece").top).toBeCloseTo(rug.top + rug.height - 22);
		// Every other spot keeps its control at its centre.
		const wall = habitatRect("wall", canvas);
		expect(control("wall").top).toBeCloseTo(wall.top + wall.height / 2 - 22);
		act(() => renderer.unmount());
	});

	test("a tapped furnishing reports the spot it stands in", () => {
		const onInspect = jest.fn();
		const renderer = render(<HabitatScene snapshot={furnished} onInspect={onInspect} />);
		act(() => renderer.root.findByProps({ testID: "habitat-position-floor_left" }).props.onPress());
		expect(onInspect).toHaveBeenCalledWith(HABITAT_CATALOG_BY_ID.sunflower_crock, "floor_left");
		act(() => renderer.unmount());
	});
});

describe("The Barn item sheet's rarity", () => {
	test("reads the Shop's validated badge pair, in sentence case", () => {
		const item = { ...HABITAT_CATALOG_BY_ID.sunflower_crock, rarity: "uncommon" as const };
		const renderer = render(
			<HabitatItemPreviewModal
				item={item}
				owned={false}
				balance={0}
				busy={false}
				onClose={jest.fn()}
				onBuy={jest.fn()}
			/>,
		);
		const tag = renderer.root.find(
			(node) => node.props.accessibilityRole === "text" && node.props.accessibilityLabel === "Uncommon",
		);
		expect(StyleSheet.flatten(tag.props.style).backgroundColor).toBe(RARITY_BADGE.uncommon.bg);
		expect(renderer.root.findAll((node) => node.props.children === "UNCOMMON")).toHaveLength(0);
		act(() => renderer.unmount());
	});
});

describe("The starter welcome", () => {
	test("\"Start decorating\" opens Decorate when the host can", () => {
		const onDismiss = jest.fn();
		const onStart = jest.fn();
		const renderer = render(<HabitatStarterWelcome visible onDismiss={onDismiss} onStart={onStart} />);
		const action = renderer.root.findAll(
			(node) => node.props.accessibilityLabel === "Start decorating your Barn",
		)[0];
		expect(action.props.accessibilityHint).toBe("Closes this welcome and opens Decorate");
		act(() => action.props.onPress());
		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onDismiss).not.toHaveBeenCalled();
		act(() => renderer.unmount());
	});
});

describe("Barn trouble copy", () => {
	test("a reason code chooses the sentence and never becomes it", () => {
		for (const reason of [
			"network",
			"no_data",
			"invalid_response",
			"unknown",
			"not_found",
			"storage",
			"pending_command",
			"not_authenticated",
			"account_changed",
			"item_not_owned",
			null,
		]) {
			const copy = habitatTroubleCopy(reason);
			expect(copy).not.toMatch(/_/);
			expect(copy).not.toMatch(/error/i);
			if (reason) expect(copy).not.toContain(reason.replaceAll("_", " "));
			expect(copy).not.toMatch(/—/);
		}
	});
});
