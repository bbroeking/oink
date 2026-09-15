import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastHost, showToast } from "../components/ui/Toast";
import {
	PurchaseToastHost,
	showAppToast,
	showPurchaseToast,
} from "../components/PurchaseToast";
import { AVATAR_SIZE, MOTION, SPACE, STATUS_SAFE, TAP_MIN, WHIMSY } from "../constants/theme";
import { VISIT_TOAST_LINE } from "../components/visit/chrome";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

function mount(node: React.ReactNode) {
	let renderer!: TestRenderer.ReactTestRenderer;
	act(() => {
		renderer = TestRenderer.create(
			<SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>,
		);
	});
	return renderer;
}

function texts(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root
		.findAll((node) => typeof node.props.children === "string")
		.map((node) => node.props.children as string);
}

describe("Toast", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("is a polite live region that announces its title", () => {
		const renderer = mount(<ToastHost />);
		act(() => showToast({ tone: "success", title: "Bought the cap", text: "it's in your closet" }));

		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"Bought the cap",
		);
		const live = renderer.root.findAll(
			(node) => node.props.accessibilityLiveRegion === "polite",
		)[0];
		expect(live).toBeDefined();
		expect(live.props.accessibilityLabel).toBe(
			"Bought the cap. it's in your closet",
		);
		expect(texts(renderer)).toEqual(
			expect.arrayContaining(["Bought the cap", "it's in your closet"]),
		);
		act(() => renderer.unmount());
	});

	test("each tone gets its own tint and its own icon", () => {
		const renderer = mount(<ToastHost />);
		const fillOf = () => {
			const card = renderer.root
				.findAll((node) => {
					const style = StyleSheet.flatten(node.props.style);
					return style?.flexDirection === "row" && !!style?.backgroundColor;
				})
				.map((node) => StyleSheet.flatten(node.props.style).backgroundColor);
			return card[0];
		};

		act(() => showToast({ tone: "success", title: "yes" }));
		expect(fillOf()).toBe(WHIMSY.sage);
		act(() => showToast({ tone: "fail", title: "no" }));
		expect(fillOf()).toBe(WHIMSY.rose);
		act(() => showToast({ tone: "info", title: "psst" }));
		expect(fillOf()).toBe(WHIMSY.sky);
		act(() => renderer.unmount());
	});

	test("dwells for MOTION.toast, then clears itself", () => {
		const renderer = mount(<ToastHost />);
		const cards = () =>
			renderer.root.findAll(
				(node) => node.props.accessibilityLiveRegion === "polite",
			);
		act(() => showToast({ tone: "info", title: "psst" }));
		expect(cards().length).toBeGreaterThan(0);
		act(() => {
			jest.advanceTimersByTime(MOTION.toast + MOTION.fade * 2);
		});
		expect(cards()).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("Reduce Motion drops the drop-in translate", () => {
		const renderer = mount(
			<MotionPolicyProvider reduceMotion>
				<ToastHost />
			</MotionPolicyProvider>,
		);
		act(() => showToast({ tone: "success", title: "quietly" }));
		const live = renderer.root.findAll(
			(node) => node.props.accessibilityLiveRegion === "polite",
		)[0];
		const transform = StyleSheet.flatten(live.props.style)
			.transform as { translateY: { __getValue: () => number } }[];
		expect(transform[0].translateY.__getValue()).toBe(0);
		act(() => renderer.unmount());
	});

	test("no host mounted means the call is a quiet no-op", () => {
		expect(() => showToast({ tone: "fail", title: "nobody home" })).not.toThrow();
	});
});

describe("PurchaseToast compat", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("maps the legacy `type` onto `tone` and re-exports the host", () => {
		expect(PurchaseToastHost).toBe(ToastHost);
		expect(showPurchaseToast).toBe(showAppToast);
		const renderer = mount(<PurchaseToastHost />);
		act(() =>
			showAppToast({ type: "fail", title: "Not enough snouts", text: "come back after a dig" }),
		);
		expect(texts(renderer)).toEqual(
			expect.arrayContaining(["Not enough snouts", "come back after a dig"]),
		);
		act(() => renderer.unmount());
	});
});

describe("Toast hosts stack", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});
	const cards = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAll((node) => node.props.accessibilityLiveRegion === "polite");

	test("the last host mounted takes the call alone; unmounting hands back by identity", () => {
		// Root, then a sheet's host, then a visit's host over the sheet.
		const root = mount(<ToastHost />);
		const sheet = mount(<ToastHost />);
		const visit = mount(<ToastHost />);
		act(() => showToast({ tone: "info", title: "in the visit" }));
		// (a card shows as more than one node — composite + host — so count
		// presence, not nodes.)
		expect(cards(visit).length).toBeGreaterThan(0);
		expect(cards(sheet)).toHaveLength(0);
		expect(cards(root)).toHaveLength(0);
		// The sheet closes UNDER the visit — out of order. The visit must keep
		// the calls (splice by identity, never pop).
		act(() => sheet.unmount());
		act(() => showToast({ tone: "info", title: "still the visit" }));
		expect(cards(visit).length).toBeGreaterThan(0);
		expect(cards(root)).toHaveLength(0);
		// The visit closes: the root is live again.
		act(() => visit.unmount());
		act(() => showToast({ tone: "info", title: "back at root" }));
		expect(cards(root).length).toBeGreaterThan(0);
		act(() => root.unmount());
		expect(() => showToast({ tone: "info", title: "nobody" })).not.toThrow();
	});
});

describe("Toast top line", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});
	const wrapTop = (r: TestRenderer.ReactTestRenderer) => {
		const wrap = r.root.findAll(
			(n) => StyleSheet.flatten(n.props.style)?.position === "absolute" && n.props.pointerEvents === "box-none",
		)[0];
		return StyleSheet.flatten(wrap.props.style).top;
	};

	test("sits just under the safe area by default, or on the line a scene passes", () => {
		const root = mount(<ToastHost />);
		act(() => showToast({ tone: "info", title: "root" }));
		expect(wrapTop(root)).toBe(metrics.insets.top + SPACE.sm);
		act(() => root.unmount());
		// The visit passes its own line: under its chrome, clear of the tallies.
		const visit = mount(<ToastHost top={VISIT_TOAST_LINE} />);
		act(() => showToast({ tone: "info", title: "visit" }));
		expect(wrapTop(visit)).toBe(VISIT_TOAST_LINE);
		expect(VISIT_TOAST_LINE).toBe(STATUS_SAFE + TAP_MIN + SPACE.sm + AVATAR_SIZE[0] + SPACE.sm);
		act(() => visit.unmount());
	});
});
