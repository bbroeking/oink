import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PigStage, resolveSlot, type EquippedItem } from "../components/ui/PigStage";
import { HAT_IMAGES } from "../constants/hats";
import { PIG_FRAMES_EXTRA } from "../constants/pigFramesExtra";
import { PIG_FRAMES } from "../constants/pigFrames.generated";

function overlayStyle(renderer: TestRenderer.ReactTestRenderer, itemId = "cowboy") {
	const image = renderer.root.findAll(
		(node) => node.props?.source === HAT_IMAGES[itemId],
	)[0];
	const box = image.parent;
	const styles = Array.isArray(box?.props.style)
		? box.props.style
		: [box?.props.style];
	const positioned = styles.find(
		(style: unknown) =>
			style !== null &&
			typeof style === "object" &&
			"left" in (style as object),
	) as { left: number; bottom: number; width: number; height: number } | undefined;
	if (!positioned) throw new Error(`${itemId} overlay position was not rendered`);
	return positioned;
}

const opacityOf = (style: unknown): number | undefined => {
	const styles = Array.isArray(style) ? style : [style];
	return styles.find(
		(value) => value && typeof value === "object" && "opacity" in value,
	)?.opacity;
};

function visibleSpriteSource(renderer: TestRenderer.ReactTestRenderer) {
	return renderer.root.findAll(
		(node) => node.props?.resizeMode === "contain" && opacityOf(node.props.style) === 1,
	)[0]?.props.source;
}

describe("pig attachment playback", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("an equipped PigStage owns one frame for both sprite and attachment", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<PigStage
					pigAnimation="idle"
					renderer="raster"
					equipped={{ id: "cowboy", category: "hat", emoji: null }}
				/>,
			);
		});
		const restLeft = overlayStyle(renderer).left;

		await act(async () => {
			jest.advanceTimersByTime(6 * (1000 / 6));
		});

		expect(overlayStyle(renderer).left).not.toBe(restLeft);
		act(() => renderer.unmount());
	});

	test("every wearable slot resolves from the exact displayed source frame", async () => {
		const slots: [string, string, EquippedItem][] = [
			["equipped", "cowboy", { id: "cowboy", category: "hat", emoji: null }],
			["equippedBow", "pink_bow", { id: "pink_bow", category: "bow", emoji: null }],
			["equippedGlasses", "pixel_glasses", { id: "pixel_glasses", category: "glasses", emoji: null }],
			["equippedMask", "carnival_mask", { id: "carnival_mask", category: "mask", emoji: null }],
			["equippedNeck", "beta_founder_ribbon", { id: "beta_founder_ribbon", category: "necklace", emoji: null }],
			["equippedAura", "gold_aura", { id: "gold_aura", category: "aura", emoji: null }],
			["equippedHeld", "magic_wand", { id: "magic_wand", category: "held", emoji: null }],
		];
		const props = Object.fromEntries(slots.map(([prop, , slot]) => [prop, slot]));
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<PigStage pigAnimation="idle" renderer="raster" {...props} />,
			);
		});
		await act(async () => {
			jest.advanceTimersByTime(6 * (1000 / 6));
		});

		const pigFrames = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };
		expect(visibleSpriteSource(renderer)).toBe(pigFrames.idle_7);
		for (const [, itemId, slot] of slots) {
			const expected = resolveSlot(slot, "idle", 6)?.overlay;
			const actual = overlayStyle(renderer, itemId);
			expect(actual.left).toBeCloseTo(expected?.left ?? NaN, 5);
			expect(actual.bottom).toBeCloseTo(expected?.bottom ?? NaN, 5);
		}
		act(() => renderer.unmount());
	});

	test("loop wrap and animation transition keep drawing and attachment atomic", async () => {
		let renderer!: TestRenderer.ReactTestRenderer;
		await act(async () => {
			renderer = TestRenderer.create(
				<PigStage
					pigAnimation="idle"
					renderer="raster"
					equipped={{ id: "cowboy", category: "hat", emoji: null }}
				/>,
			);
		});
		const frameZero = overlayStyle(renderer);
		await act(async () => {
			jest.advanceTimersByTime(12 * (1000 / 6));
		});
		expect(overlayStyle(renderer).left).toBeCloseTo(frameZero.left, 5);

		await act(async () => {
			renderer.update(
				<PigStage
					pigAnimation="wave"
					renderer="raster"
					equipped={{ id: "cowboy", category: "hat", emoji: null }}
				/>,
			);
		});
		const pigFrames = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };
		expect(visibleSpriteSource(renderer)).toBe(pigFrames.wave_1);
		const waveZero = resolveSlot(
			{ id: "cowboy", category: "hat", emoji: null },
			"wave",
			0,
		)?.overlay;
		expect(overlayStyle(renderer).left).toBeCloseTo(waveZero?.left ?? NaN, 5);
		expect(overlayStyle(renderer).bottom).toBeCloseTo(waveZero?.bottom ?? NaN, 5);
		act(() => renderer.unmount());
	});
});
