// Guards the flip-book frame system (the animation-pass refactor): every frame
// of the current animation is mounted at once and visibility is toggled via
// opacity (exactly one frame opaque). No cross-dissolve, no per-frame Image
// `source` swap — that constant two-pose overlap was the flicker.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SpritePig } from "../components/ui/SpritePig";
import { PIG_FRAMES_EXTRA } from "../constants/pigFramesExtra";
import { PIG_FRAMES } from "../constants/pigFrames.generated";
import { PIG_IDS } from "../utils/pigs";

// RN's <Image> shows up as multiple host nodes per element, so dedupe by source.
const frameNodes = (r: TestRenderer.ReactTestRenderer) =>
	r.root.findAll(
		(n) =>
			!!n.props &&
			n.props.source !== undefined &&
			n.props.resizeMode !== undefined
	);
const distinctSources = (r: TestRenderer.ReactTestRenderer) =>
	new Set(frameNodes(r).map((n) => n.props.source));
const opacityOf = (style: unknown): number | undefined => {
	const arr = Array.isArray(style) ? style : [style];
	for (const s of arr) {
		if (s && typeof s === "object" && "opacity" in (s as object)) {
			return (s as { opacity: number }).opacity;
		}
	}
	return undefined;
};
const visibleSources = (r: TestRenderer.ReactTestRenderer) =>
	new Set(
		frameNodes(r)
			.filter((n) => opacityOf(n.props.style) === 1)
			.map((n) => n.props.source)
	);
const visibleSource = (r: TestRenderer.ReactTestRenderer) =>
	[...visibleSources(r)][0];

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("SpritePig — flip-book frames", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("mounts every frame of the animation, exactly one visible", async () => {
		const r = await renderAct(<SpritePig animation="idle" />);
		expect(distinctSources(r).size).toBe(12); // all 12 idle frames pre-mounted
		expect(visibleSources(r).size).toBe(1); // exactly one frame shown
		act(() => r.unmount());
	});

	test.each(PIG_IDS)("%s idle plays all twelve sheet frames and reports the displayed anchor frame", async (pigId) => {
		const onFrame = jest.fn();
		const r = await renderAct(<SpritePig animation="idle" pigId={pigId} onFrame={onFrame} />);
		const frames = { ...PIG_FRAMES[pigId], ...PIG_FRAMES_EXTRA[pigId] };
		expect(visibleSource(r)).toBe(frames.idle_1);
		expect(onFrame).toHaveBeenLastCalledWith(0);
		for (const frame of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0]) {
			await act(async () => { jest.advanceTimersByTime(1000 / 6); });
			expect(visibleSources(r).size).toBe(1);
			expect(visibleSource(r)).toBe(frames[`idle_${frame + 1}`]);
			expect(onFrame).toHaveBeenLastCalledWith(frame);
		}
		act(() => r.unmount());
	});

	test("a surface's rest tempo slows the idle loop but not a reaction", async () => {
		const { PigRestTempoProvider } = require("../components/ui/PigRestingPose");
		const onFrame = jest.fn();
		const r = await renderAct(
			<PigRestTempoProvider tempo={0.5}>
				<SpritePig animation="idle" pigId="rosie" onFrame={onFrame} />
			</PigRestTempoProvider>
		);
		// Half tempo: a 6 fps loop ticks every 333 ms, so one idle period is not enough.
		await act(async () => { jest.advanceTimersByTime(1000 / 6 + 1); });
		expect(onFrame).toHaveBeenLastCalledWith(0);
		await act(async () => { jest.advanceTimersByTime(1000 / 6 + 1); });
		expect(onFrame).toHaveBeenLastCalledWith(1);
		// A reaction ignores the tempo: jump at 5 fps still ticks every 200 ms.
		await act(async () => { r.update(
			<PigRestTempoProvider tempo={0.5}>
				<SpritePig animation="jump" pigId="rosie" onFrame={onFrame} />
			</PigRestTempoProvider>
		); });
		await act(async () => { jest.advanceTimersByTime(1000 / 5 + 1); });
		expect(onFrame).toHaveBeenLastCalledWith(1);
		act(() => r.unmount());
	});

	test("pre-baked appearances keep their complete authored idle sequence", async () => {
		const r = await renderAct(<SpritePig animation="idle" customFrames={{ idle: ["happy_1", "happy_2", "happy_3", "happy_4"] }} />);
		expect(visibleSource(r)).toBe(PIG_FRAMES.rosie.happy_1);
		await act(async () => { jest.advanceTimersByTime(400); });
		expect(visibleSource(r)).toBe(PIG_FRAMES.rosie.happy_2);
		act(() => r.unmount());
	});

	test("switching animations swaps the whole mounted frame set", async () => {
		const r = await renderAct(<SpritePig animation="idle" />);
		const idleSrcs = distinctSources(r);
		await act(async () => {
			r.update(<SpritePig animation="surprise" />);
		});
		expect(distinctSources(r).size).toBe(4);
		expect([...distinctSources(r)].some((s) => idleSrcs.has(s))).toBe(false);
		act(() => r.unmount());
	});

	test("manual frame stepping (align tool) pins the visible frame", async () => {
		const r = await renderAct(<SpritePig animation="idle" frameIdx={0} />);
		const pinned = visibleSource(r);
		expect(pinned).toBe(PIG_FRAMES.rosie.idle_1);
		await act(async () => {
			jest.advanceTimersByTime(2000); // no loop runs under frameIdx
		});
		expect(visibleSource(r)).toBe(pinned);
		act(() => r.unmount());
	});
});
