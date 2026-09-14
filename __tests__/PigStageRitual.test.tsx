// The pig channels of the weekday rituals (2026-09-14).
//
// The load-bearing claim: `flip` and `scale` live on the SAME stage wrapper as
// the breath, so the raster stack and Rive inherit them identically and every
// cosmetic anchor keeps landing where the placement studio put it. If these
// ever drift onto an inner view, Rive and raster stop agreeing and a forced bow
// tie stops anchoring at half size.
//
// The forced-cosmetic rule: a ritual item with no art is skipped and the player
// keeps their own item; an id that HAS art wins the slot. All four ids in
// RITUAL_ITEM_IDS have art as of the 2026-09-14 pass, so the no-art path is
// exercised with an id that is deliberately absent from the table.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StyleSheet } from "react-native";
import { PigStage, forcedRitualItem } from "../components/ui/PigStage";
import { PigAvatar } from "../components/ui/PigAvatar";
import { HAT_IMAGES } from "../constants/hats";
import { RITUAL_FX, RITUAL_ITEM_ART, RITUAL_ITEM_IDS } from "../constants/ritualFx";
import { MotionPolicyProvider } from "@/hooks/useMotionPolicy";
import type { PigFx } from "@/constants/ritualFx";

function render(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	act(() => {
		r = TestRenderer.create(node);
	});
	return r;
}

// The stage wrapper is the render root; its transform is the one the pig, the
// cosmetics and the Rive surface all ride.
function stageTransform(r: TestRenderer.ReactTestRenderer) {
	const json = r.toJSON() as TestRenderer.ReactTestRendererJSON;
	const style = StyleSheet.flatten(json.props.style) as {
		transform?: Record<string, unknown>[];
	};
	return style.transform ?? [];
}

const sourcesIn = (r: TestRenderer.ReactTestRenderer) =>
	r.root
		.findAll((n) => typeof n.type === "string" && n.props?.source !== undefined)
		.map((n) => n.props.source);

describe("PigStage — ritual transforms", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("no ritual leaves the wrapper transform as the breath alone", () => {
		const r = render(<PigStage pigFrozen />);
		const t = stageTransform(r);
		expect(t.some((e) => "rotate" in e)).toBe(false);
		expect(t.some((e) => "scale" in e)).toBe(false);
		act(() => r.unmount());
	});

	test("Topsy-Turvy turns the whole stage over", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.topsy_turvy.pig} />);
		expect(stageTransform(r)).toContainEqual({ rotate: "180deg" });
		act(() => r.unmount());
	});

	test("Pipsqueak scales the whole stage, not the sprite alone", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.pipsqueak.pig} />);
		expect(stageTransform(r)).toContainEqual({ scale: 0.5 });
		act(() => r.unmount());
	});

	test("flip and scale ride the same wrapper together", () => {
		const r = render(
			<PigStage pigFrozen ritual={{ flip: true, scale: 0.5 }} />,
		);
		const t = stageTransform(r);
		expect(t).toContainEqual({ rotate: "180deg" });
		expect(t).toContainEqual({ scale: 0.5 });
		// ...and the breath is still on there with them.
		expect(t.some((e) => "scaleY" in e)).toBe(true);
		expect(t.some((e) => "translateY" in e)).toBe(true);
		act(() => r.unmount());
	});

	test("a ritual tint rides skinTintOverride, and an explicit override wins", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.bacon_bits.pig} />);
		const renderer = r.root.findAll(
			(n) => typeof n.type !== "string" && "skinTintOverride" in (n.props ?? {}),
		)[0];
		expect(renderer.props.skinTintOverride).toBe(RITUAL_FX.bacon_bits.pig!.tint);
		act(() => r.unmount());

		const r2 = render(
			<PigStage
				pigFrozen
				skinTintOverride="#123456"
				ritual={RITUAL_FX.bacon_bits.pig}
			/>,
		);
		const renderer2 = r2.root.findAll(
			(n) => typeof n.type !== "string" && "skinTintOverride" in (n.props ?? {}),
		)[0];
		expect(renderer2.props.skinTintOverride).toBe("#123456");
		act(() => r2.unmount());
	});
});

describe("PigStage — ritual followers, particles and glow", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	const hosts = (r: TestRenderer.ReactTestRenderer, testID: string) =>
		r.root.findAllByProps({ testID }).filter((n) => typeof n.type === "string");

	test("Cloud Nine parks a cloud under the pig", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.cloud_nine.pig} />);
		expect(hosts(r, "pig-fx-cloud-under")).toHaveLength(1);
		act(() => r.unmount());
	});

	test("Little Raincloud drizzles a handful of drops", () => {
		const r = render(
			<PigStage pigFrozen ritual={RITUAL_FX.little_raincloud.pig} />,
		);
		expect(hosts(r, "pig-fx-raincloud")).toHaveLength(1);
		const drops = hosts(r, "pig-fx-raindrop").length;
		expect(drops).toBeGreaterThanOrEqual(3);
		expect(drops).toBeLessThanOrEqual(5);
		act(() => r.unmount());
	});

	test("Bubble Bath rises a handful of bubbles, pinned to the pig's box", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.bubble_bath.pig} />);
		const bubbles = hosts(r, "pig-fx-bubble").length;
		expect(bubbles).toBeGreaterThanOrEqual(6);
		expect(bubbles).toBeLessThanOrEqual(10);
		act(() => r.unmount());
	});

	test("Golden Hour puts a halo behind the pig — the shared glow primitive", () => {
		const r = render(<PigStage pigFrozen ritual={RITUAL_FX.golden_hour.pig} />);
		const glow = hosts(r, "pig-fx-glow")[0];
		const style = StyleSheet.flatten(glow.props.style);
		expect(style.backgroundColor).toBe(RITUAL_FX.golden_hour.pig!.glow);
		expect(style.zIndex).toBe(1); // behind the pig (5)
		act(() => r.unmount());
	});

	test("nothing ritual is drawn when no ritual is passed", () => {
		const r = render(<PigStage pigFrozen />);
		for (const id of [
			"pig-fx-cloud-under",
			"pig-fx-raincloud",
			"pig-fx-bubbles",
			"pig-fx-glow",
			"pig-fx-hic",
		]) {
			expect(hosts(r, id)).toHaveLength(0);
		}
		act(() => r.unmount());
	});
});

describe("PigStage — Hiccups", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	const hic = (r: TestRenderer.ReactTestRenderer) =>
		r.root.findAllByProps({ testID: "pig-fx-hic" }).filter((n) => typeof n.type === "string");

	test("the hic bubble pops on the hop and clears itself", () => {
		const r = render(<PigStage ritual={RITUAL_FX.hiccups.pig} />);
		expect(hic(r)).toHaveLength(0);
		act(() => jest.advanceTimersByTime(4100));
		expect(hic(r)).toHaveLength(1);
		act(() => jest.advanceTimersByTime(1000));
		expect(hic(r)).toHaveLength(0);
		act(() => r.unmount());
	});

	test("Reduce Motion holds the pig still — no hop, but the bubble stays up", () => {
		// The ritual must stay identifiable without motion, so the "hic!"
		// bubble is persistent rather than absent (plan §Reduce Motion).
		const r = render(
			<MotionPolicyProvider reduceMotion>
				<PigStage ritual={RITUAL_FX.hiccups.pig} />
			</MotionPolicyProvider>,
		);
		expect(hic(r)).toHaveLength(1);
		act(() => jest.advanceTimersByTime(20000));
		expect(hic(r)).toHaveLength(1);
		act(() => r.unmount());
	});
});

describe("PigStage — forced ritual cosmetics", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("every id a recipe forces has art registered", () => {
		for (const id of Object.values(RITUAL_ITEM_IDS)) {
			expect(RITUAL_ITEM_ART[id]).toBeDefined();
		}
		// ...and no recipe forces an id outside that set.
		const forced = Object.values(RITUAL_FX)
			.flatMap((fx) => Object.values(fx.pig?.forced ?? {}))
			.filter(Boolean);
		expect(forced.length).toBeGreaterThan(0);
		for (const id of forced) expect(RITUAL_ITEM_ART[id]).toBeDefined();
	});

	test("a forced id with no art is skipped, never a broken sticker", () => {
		const orphan: PigFx = { forced: { bow: "ritual_not_drawn_yet" } };
		expect(forcedRitualItem(orphan, "bow", "bow")).toBeNull();

		const r = render(
			<PigStage
				pigFrozen
				equippedBow={{ id: "pink_bow", category: "bow", emoji: null }}
				ritual={orphan}
			/>,
		);
		// The player's own bow is still the one on the pig.
		expect(sourcesIn(r)).toContain(HAT_IMAGES.pink_bow);
		act(() => r.unmount());
	});

	test("a forced id WITH art wins the slot over the player's own item", () => {
		const art = RITUAL_ITEM_ART[RITUAL_ITEM_IDS.bowTie];
		expect(forcedRitualItem(RITUAL_FX.sunday_best.pig, "bow", "bow")).toEqual({
			id: RITUAL_ITEM_IDS.bowTie,
			category: "bow",
			emoji: null,
			imageSrc: art,
		});

		const r = render(
			<PigStage
				pigFrozen
				equippedBow={{ id: "pink_bow", category: "bow", emoji: null }}
				ritual={RITUAL_FX.sunday_best.pig}
			/>,
		);
		const sources = sourcesIn(r);
		expect(sources).toContain(art);
		expect(sources).not.toContain(HAT_IMAGES.pink_bow);
		act(() => r.unmount());
	});

	test("the forced bow does not disturb the player's hat — it sits over it", () => {
		const r = render(
			<PigStage
				pigFrozen
				equipped={{ id: "cowboy", category: "hat", emoji: null }}
				ritual={RITUAL_FX.sunday_best.pig}
			/>,
		);
		const sources = sourcesIn(r);
		expect(sources).toContain(HAT_IMAGES.cowboy); // the hat survives
		// ...and the bow tie arrives alongside it.
		expect(sources).toContain(RITUAL_ITEM_ART[RITUAL_ITEM_IDS.bowTie]);
		act(() => r.unmount());
	});

	test("Old-Timey's monocle takes the glasses slot from the player's own", () => {
		const r = render(
			<PigStage
				pigFrozen
				equippedGlasses={{ id: "nerd_glasses", category: "glasses", emoji: null }}
				ritual={RITUAL_FX.old_timey.pig}
			/>,
		);
		const sources = sourcesIn(r);
		expect(sources).toContain(RITUAL_ITEM_ART[RITUAL_ITEM_IDS.monocle]);
		expect(sources).not.toContain(HAT_IMAGES.nerd_glasses);
		act(() => r.unmount());
	});

	test("Butterfly Crown takes the hat slot; Bacon Bits takes the mask slot", () => {
		const r = render(
			<PigStage
				pigFrozen
				equipped={{ id: "cowboy", category: "hat", emoji: null }}
				ritual={RITUAL_FX.butterfly_crown.pig}
			/>,
		);
		expect(sourcesIn(r)).toContain(RITUAL_ITEM_ART[RITUAL_ITEM_IDS.butterfly]);
		expect(sourcesIn(r)).not.toContain(HAT_IMAGES.cowboy);
		act(() => r.unmount());

		const r2 = render(<PigStage pigFrozen ritual={RITUAL_FX.bacon_bits.pig} />);
		expect(sourcesIn(r2)).toContain(RITUAL_ITEM_ART[RITUAL_ITEM_IDS.baconMask]);
		act(() => r2.unmount());
	});
});

describe("PigAvatar — static channels only", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	const loud: PigFx = {
		flip: true,
		scale: 0.5,
		tint: "#ff0000",
		float: { amp: 6, period: 2400 },
		hop: { every: 4000, height: 8 },
		glow: "#ffff00",
		follower: "cloud_under",
		particles: "bubbles",
	};

	test("a list row keeps skin/tint/flip/scale and drops every loop", () => {
		const r = render(
			<PigAvatar size={48} hatId="cowboy" bowId="pink_bow" ritual={loud} />,
		);
		const stage = r.root.findByType(PigStage);
		expect(stage.props.ritual).toEqual({
			flip: true,
			scale: 0.5,
			tint: "#ff0000",
		});
		act(() => r.unmount());
	});

	test("no follower, bubbles, glow or hic bubble is ever drawn in a row", () => {
		const r = render(
			<PigAvatar size={48} hatId="cowboy" bowId="pink_bow" ritual={loud} />,
		);
		act(() => jest.advanceTimersByTime(10000));
		for (const id of [
			"pig-fx-cloud-under",
			"pig-fx-bubble",
			"pig-fx-glow",
			"pig-fx-hic",
		]) {
			expect(
				r.root.findAllByProps({ testID: id }).filter((n) => typeof n.type === "string"),
			).toHaveLength(0);
		}
		act(() => r.unmount());
	});

	test("a ritual of only loop channels leaves the avatar untouched", () => {
		const r = render(
			<PigAvatar
				size={48}
				hatId="cowboy"
				bowId="pink_bow"
				ritual={{ float: { amp: 6, period: 2400 }, follower: "cloud_under" }}
			/>,
		);
		expect(r.root.findByType(PigStage).props.ritual).toBeUndefined();
		act(() => r.unmount());
	});
});
