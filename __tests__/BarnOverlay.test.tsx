// BarnOverlay renders the angel variant, the goblin variant, or
// nothing (neutral). Identified by testID on the variant root.

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import fs from "node:fs";
import path from "node:path";
import { StyleSheet, View } from "react-native";
import { BarnOverlay } from "../components/ui/BarnOverlay";
import { RITUAL_FX, fxWash, type SceneFx } from "@/constants/ritualFx";
import { WHIMSY } from "@/constants/theme";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";

// findAllByProps matches the composite AND its host output, so count only the
// rendered host nodes when a test is asserting "how many of these are drawn".
const hostsWithId = (r: TestRenderer.ReactTestRenderer, testID: string) =>
	r.root
		.findAllByProps({ testID })
		.filter((node) => typeof node.type === "string");

const barn = fs.readFileSync(
	path.join(__dirname, "..", "components", "Barn.tsx"),
	"utf8",
);

describe("BarnOverlay", () => {
	test("neutral renders nothing", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="neutral" />);
		expect(r.toJSON()).toBeNull();
	});

	test("angel renders the angel overlay", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		expect(r.root.findByProps({ testID: "barn-overlay-angel" })).toBeTruthy();
		// and NOT the goblin one
		expect(
			r.root.findAllByProps({ testID: "barn-overlay-goblin" })
		).toHaveLength(0);
	});

	test("angel tint does not add white bubble decorations over Home content", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		const whiteBubbles = r.root.findAllByType(View).filter((node) => {
			const style = StyleSheet.flatten(node.props.style);
			return style?.backgroundColor === "#FFFFFF";
		});

		expect(whiteBubbles).toHaveLength(0);
		expect(barn).not.toContain("generousPuff");
	});

	test("goblin renders the goblin overlay", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="goblin" />);
		expect(r.root.findByProps({ testID: "barn-overlay-goblin" })).toBeTruthy();
		expect(
			r.root.findAllByProps({ testID: "barn-overlay-angel" })
		).toHaveLength(0);
	});

	test("overlay never intercepts touches (pointerEvents none)", () => {
		const r = TestRenderer.create(<BarnOverlay alignment="angel" />);
		const root = r.root.findByProps({ testID: "barn-overlay-angel" });
		expect(root.props.pointerEvents).toBe("none");
	});

	test("a blessing does not tint the Barn", () => {
		const r = TestRenderer.create(
			<BarnOverlay alignment="neutral" {...({ blessed: true } as object)} />
		);
		expect(r.toJSON()).toBeNull();
	});

	test("the retired `cursed` boolean is a no-op, not a wash", () => {
		// The miasma is gone — a curse now draws whatever its recipe asks for.
		// The prop stays accepted so an unmigrated call site keeps compiling.
		const r = TestRenderer.create(<BarnOverlay alignment="neutral" cursed />);
		expect(r.toJSON()).toBeNull();
	});
});

// ── The ritual scene (weekday rituals, 2026-09-14) ─────────────────────────
describe("BarnOverlay — ritual scene", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	const render = (scene: SceneFx, reduceMotion = false) => {
		let r!: TestRenderer.ReactTestRenderer;
		act(() => {
			r = TestRenderer.create(
				<MotionPolicyProvider reduceMotion={reduceMotion}>
					<BarnOverlay alignment="neutral" scene={scene} />
				</MotionPolicyProvider>,
			);
		});
		return r;
	};

	test("an empty scene on a neutral pig renders nothing", () => {
		expect(render({}).toJSON()).toBeNull();
	});

	test("Pickle Brine draws one wash at its token and alpha", () => {
		const r = render(RITUAL_FX.pickle_brine.scene!);
		const wash = r.root.findByProps({ testID: "barn-scene-wash" });
		const style = StyleSheet.flatten(wash.props.style);
		expect(style.backgroundColor).toBe(fxWash(WHIMSY.sage, 0.38));
		// and nothing else
		expect(r.root.findAllByProps({ testID: "barn-scene-grain" })).toHaveLength(0);
		expect(
			r.root.findAllByProps({ testID: "barn-scene-fireflies" }),
		).toHaveLength(0);
		act(() => r.unmount());
	});

	test("Old-Timey draws the sepia wash AND the film grain", () => {
		const r = render(RITUAL_FX.old_timey.scene!);
		expect(r.root.findByProps({ testID: "barn-scene-wash" })).toBeTruthy();
		const grain = r.root.findByProps({ testID: "barn-scene-grain" });
		// A cheap grain: specks, not a texture, and not hundreds of them.
		const specks = grain.findAllByType(View).length - 1;
		expect(specks).toBeGreaterThan(8);
		expect(specks).toBeLessThanOrEqual(48);
		act(() => r.unmount());
	});

	test("Firefly Night dims to dusk and wanders a handful of motes", () => {
		const r = render(RITUAL_FX.firefly_night.scene!);
		expect(r.root.findByProps({ testID: "barn-scene-dusk" })).toBeTruthy();
		const motes = hostsWithId(r, "barn-scene-firefly");
		expect(motes.length).toBeGreaterThanOrEqual(8);
		expect(motes.length).toBeLessThanOrEqual(12);
		act(() => r.unmount());
	});

	test("Reduce Motion still shows the fireflies — one still frame", () => {
		const r = render(RITUAL_FX.firefly_night.scene!, true);
		expect(hostsWithId(r, "barn-scene-firefly").length).toBeGreaterThanOrEqual(8);
		// No loop was scheduled, so time passing changes nothing.
		act(() => jest.advanceTimersByTime(10000));
		expect(hostsWithId(r, "barn-scene-firefly").length).toBeGreaterThanOrEqual(8);
		act(() => r.unmount());
	});

	test("every scene layer is pointerEvents=none — a wash never eats a tickle", () => {
		const r = render({
			tint: WHIMSY.ink,
			alpha: 0.3,
			dusk: true,
			grain: true,
			particles: "fireflies",
		});
		const json = r.toJSON() as TestRenderer.ReactTestRendererJSON;
		const walk = (node: TestRenderer.ReactTestRendererJSON) => {
			expect(node.props.pointerEvents).toBe("none");
			(node.children ?? []).forEach((child) => {
				if (typeof child !== "string") walk(child);
			});
		};
		walk(json);
		// ...and the root keeps its explicit stacking order.
		expect(StyleSheet.flatten(json.props.style).zIndex).toBe(1);
		act(() => r.unmount());
	});

	test("a scene tints the Barn even for a neutral, unaligned pig", () => {
		const r = render(RITUAL_FX.golden_hour.scene!);
		expect(r.root.findByProps({ testID: "barn-scene-wash" })).toBeTruthy();
		expect(r.root.findAllByProps({ testID: "barn-overlay-angel" })).toHaveLength(0);
		act(() => r.unmount());
	});
});
