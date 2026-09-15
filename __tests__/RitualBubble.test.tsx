// RitualBubble — the cast moment. One host at root, one bubble at a time,
// the announcement always fires, the wrapper never eats a tap, and Reduce
// Motion turns the rise into a cross-fade.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { AccessibilityInfo, Animated, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RitualBubbleHost, showRitualBubble } from "../components/ui/RitualBubble";
import { MOTION } from "../constants/theme";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";
import { BLESSING_META, CURSE_META } from "../utils/rituals";

const metrics = {
	frame: { x: 0, y: 0, width: 320, height: 568 },
	insets: { top: 20, left: 0, right: 0, bottom: 16 },
};

const CLOUD_NINE = { kind: "cloud_nine" as const, ...BLESSING_META.cloud_nine };
const RAINCLOUD = { kind: "little_raincloud" as const, ...CURSE_META.little_raincloud };

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
	const out: string[] = [];
	function walk(n: TestRenderer.ReactTestInstance | string) {
		if (typeof n === "string") {
			out.push(n);
			return;
		}
		for (const c of n.children ?? []) walk(c);
	}
	walk(renderer.root);
	return out.join("");
}

// The HOST node only — react-test-renderer also lists the composite that
// forwarded the testID, which would count every bubble twice.
function host(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root.findAll(
		(n) => n.props.testID === "ritual-bubble-host" && (n.type as unknown) === "View",
	);
}
// Under the RN jest mock a native-driver timing completes on its first frame
// and only `Animated.delay` keeps real time, so a bubble's run ends at the pop
// delay (88% of its travel) plus a frame. The assertions below bracket that:
// "still up well inside the travel, gone once the travel has passed".
const FRAME = 100;

function bless(targetName = "Bandit") {
	showRitualBubble({
		mode: "bless",
		ritual: CLOUD_NINE,
		targetName,
		announcement: `Cloud Nine sent to ${targetName}`,
	});
}

describe("RitualBubble", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
		// RN's jest setup already makes this a jest.fn, and restoreAllMocks hands
		// that same fn back with its call log intact — clear it per test.
		(AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("no host mounted means the call is a quiet no-op", () => {
		expect(() => bless()).not.toThrow();
		expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
	});

	test("shows the ritual's name, its target, and announces the cast", () => {
		const renderer = mount(<RitualBubbleHost />);
		expect(host(renderer)).toHaveLength(0);
		act(() => bless());
		expect(host(renderer)).toHaveLength(1);
		expect(texts(renderer)).toContain("Cloud Nine");
		expect(texts(renderer)).toContain("→ Bandit");
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"Cloud Nine sent to Bandit",
		);
		// The cast's own art, not a generic mark.
		const art = renderer.root.findAll(
			(n) => (n.type as unknown) === "Image" && n.props.source === CLOUD_NINE.icon,
		);
		expect(art).toHaveLength(1);
		act(() => renderer.unmount());
	});

	test("never swallows a tap: the host is pointerEvents none, and hidden from VoiceOver focus", () => {
		const renderer = mount(<RitualBubbleHost />);
		act(() => bless());
		const wrap = host(renderer)[0];
		expect(wrap.props.pointerEvents).toBe("none");
		expect(wrap.props.accessibilityElementsHidden).toBe(true);
		act(() => renderer.unmount());
	});

	test("a second cast replaces the first — never two on screen", () => {
		const renderer = mount(<RitualBubbleHost />);
		act(() => bless("Bandit"));
		act(() => {
			showRitualBubble({
				mode: "curse",
				ritual: RAINCLOUD,
				targetName: "Biscuit",
				announcement: "Biscuit has been cursed",
			});
		});
		expect(host(renderer)).toHaveLength(1);
		expect(texts(renderer)).toContain("Little Raincloud");
		expect(texts(renderer)).toContain("→ Biscuit");
		expect(texts(renderer)).not.toContain("Bandit");
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2);
		act(() => renderer.unmount());
	});

	test("a blessing is gone after MOTION.ritualRise.bless", () => {
		const renderer = mount(<RitualBubbleHost />);
		act(() => bless());
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless / 2);
		});
		expect(host(renderer)).toHaveLength(1);
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless / 2 + FRAME);
		});
		expect(host(renderer)).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("a curse climbs slower: still up after the blessing's travel, gone after its own", () => {
		const renderer = mount(<RitualBubbleHost />);
		act(() => {
			showRitualBubble({
				mode: "curse",
				ritual: RAINCLOUD,
				targetName: "Bandit",
				announcement: "Bandit has been cursed",
			});
		});
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless);
		});
		expect(host(renderer)).toHaveLength(1);
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.curse - MOTION.ritualRise.bless + FRAME);
		});
		expect(host(renderer)).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("a replaced bubble's timer cannot clear its replacement", () => {
		const renderer = mount(<RitualBubbleHost />);
		act(() => bless("Bandit"));
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless / 2);
		});
		act(() => bless("Biscuit"));
		// The first bubble's full travel has elapsed; the second is mid-rise.
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless / 2 + FRAME);
		});
		expect(host(renderer)).toHaveLength(1);
		expect(texts(renderer)).toContain("→ Biscuit");
		act(() => renderer.unmount());
	});

	test("Reduce Motion: no loop, no travel — a cross-fade at mid-screen that still announces", () => {
		const loop = jest.spyOn(Animated, "loop");
		const renderer = mount(
			<MotionPolicyProvider reduceMotion>
				<RitualBubbleHost />
			</MotionPolicyProvider>,
		);
		act(() => bless());
		expect(loop).not.toHaveBeenCalled();
		expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
			"Cloud Nine sent to Bandit",
		);
		// The rise layer is the host's first child; its translateY is a plain
		// number parked at mid-screen, not an animated travel.
		const rise = host(renderer)[0].children[0] as TestRenderer.ReactTestInstance;
		const transform = StyleSheet.flatten(rise.props.style).transform as {
			translateY?: unknown;
		}[];
		expect(typeof transform[0].translateY).toBe("number");
		// Held for a beat, then gone.
		act(() => {
			jest.advanceTimersByTime(MOTION.fade + MOTION.beat + MOTION.fade + FRAME);
		});
		expect(host(renderer)).toHaveLength(0);
		act(() => renderer.unmount());
	});

	test("with motion allowed the sway loop runs and stops with the bubble", () => {
		const loop = jest.spyOn(Animated, "loop");
		const renderer = mount(<RitualBubbleHost />);
		act(() => bless());
		expect(loop).toHaveBeenCalledTimes(1);
		const drift = loop.mock.results[0].value as { stop: jest.Mock };
		const stop = jest.spyOn(drift, "stop");
		act(() => {
			jest.advanceTimersByTime(MOTION.ritualRise.bless + FRAME);
		});
		expect(stop).toHaveBeenCalled();
		act(() => renderer.unmount());
	});
});

describe("RitualBubble hosts", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(
			() => {},
		);
		(AccessibilityInfo.announceForAccessibility as jest.Mock).mockClear();
	});
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	test("the last host mounted takes the calls, and unmounting hands them back", () => {
		// The root host, then a dev preview's own host over it.
		const root = mount(<RitualBubbleHost />);
		const preview = mount(<RitualBubbleHost />);
		act(() => bless("Bandit"));
		expect(host(root)).toHaveLength(0);
		expect(host(preview)).toHaveLength(1);
		act(() => preview.unmount());
		act(() => bless("Biscuit"));
		expect(host(root)).toHaveLength(1);
		expect(texts(root)).toContain("→ Biscuit");
		act(() => root.unmount());
		// Nobody left: a quiet no-op.
		expect(() => bless()).not.toThrow();
	});
});
