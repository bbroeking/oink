// Guards the flip-book frame system (the animation-pass refactor): every frame
// of the current animation is mounted at once and visibility is toggled via
// opacity (exactly one frame opaque). No cross-dissolve, no per-frame Image
// `source` swap — that constant two-pose overlap was the flicker.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { SpritePig } from "../components/ui/SpritePig";

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
		expect(distinctSources(r).size).toBe(4); // all 4 idle frames pre-mounted
		expect(visibleSources(r).size).toBe(1); // exactly one frame shown
		act(() => r.unmount());
	});

	test("the frame loop advances which frame is visible (no source swap)", async () => {
		const r = await renderAct(<SpritePig animation="idle" />);
		const first = visibleSource(r);
		await act(async () => {
			jest.advanceTimersByTime(1000 / 2.5 + 10); // one idle fps period
		});
		expect(visibleSource(r)).not.toBe(first); // stepped to the next frame
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
		await act(async () => {
			jest.advanceTimersByTime(2000); // no loop runs under frameIdx
		});
		expect(visibleSource(r)).toBe(pinned);
		act(() => r.unmount());
	});
});
