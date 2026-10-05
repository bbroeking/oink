// Tabs VoiceOver can hear on iOS (2026-10-04, after/042 and after/064). React
// Native gives role "tab" no iOS trait, so a tab read as a bare element. On
// iOS a tab is a button with `selected` inside a tab-bar container, the shape
// the hanging-signs tab bar was verified with on device.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { FenceRow } from "@/components/pen/FenceRow";
import { TAB_LIST_ROLE, TAB_ROLE } from "@/components/ui/tabRoles";

// Jest hoists these above the imports: the barrel's pig and Sentry's
// module-level timer stay out of a test about roles.
jest.mock("@sentry/react-native", () => ({
	captureException: jest.fn(),
	captureMessage: jest.fn(),
	addBreadcrumb: jest.fn(),
}));
jest.mock("@/components/ui/PigPortrait", () => ({ PigPortrait: () => null }));
jest.mock("@/components/ui/PrestigeAvatar", () => ({ PrestigeAvatar: () => null }));

describe("tab roles", () => {
	test("iOS: a tab is a button inside a tab-bar container", () => {
		expect(TAB_ROLE).toBe("button");
		expect(TAB_LIST_ROLE).toBe("tabbar");
	});

	test("other platforms keep the ARIA pair", () => {
		jest.isolateModules(() => {
			jest.doMock("react-native", () => ({
				Platform: {
					OS: "android",
					select: (spec: Record<string, unknown>) => spec.android ?? spec.default,
				},
			}));
			// eslint-disable-next-line @typescript-eslint/no-require-imports -- isolated platform
			const roles = require("@/components/ui/tabRoles");
			expect(roles.TAB_ROLE).toBe("tab");
			expect(roles.TAB_LIST_ROLE).toBe("tablist");
		});
	});
});

describe("the Pen's pig picker (FenceRow)", () => {
	const PIGS = [
		{ id: "rosie", name: "Rosie", state: "home" },
		{ id: "copper", name: "Copper", state: "out" },
		{ id: "pepper", name: "Pepper", state: "locked" },
	] as const;

	test("each medallion is a tab VoiceOver can press, inside a tab-bar container", () => {
		const onSelect = jest.fn();
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(
				<FenceRow pigs={[...PIGS]} selected="copper" onSelect={onSelect} />,
			);
		});
		// The list role sits on a plain View holding the medallions, not on the
		// scroller (the verified shape).
		const container = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.testID === "fence-tabs",
		)[0];
		expect(container.props.accessibilityRole).toBe(TAB_LIST_ROLE);
		const scroller = r.root.findAll(
			(n) => typeof n.type === "string" && n.props.testID === "fence-row",
		)[0];
		expect(scroller.props.accessibilityRole).toBeUndefined();

		const tabs = container.findAll(
			(n) => typeof n.type === "string" && n.props.accessibilityRole === TAB_ROLE,
		);
		expect(tabs.map((t) => t.props.testID)).toEqual([
			"fence-rosie",
			"fence-copper",
			"fence-pepper",
		]);
		expect(tabs.map((t) => t.props.accessibilityState.selected)).toEqual([false, true, false]);
		expect(tabs[1].props.accessibilityLabel).toBe("Copper, out looking");
		expect(r.root.findAll((n) => n.props.accessibilityRole === "tab")).toHaveLength(0);

		act(() => {
			r.root.findAll((n) => n.props.testID === "fence-rosie" && typeof n.props.onPress === "function")[0].props.onPress();
		});
		expect(onSelect).toHaveBeenCalledWith("rosie");
		act(() => r.unmount());
	});
});
