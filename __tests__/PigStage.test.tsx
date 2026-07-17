// Guards the shop-preview freeze (spec 01): PigStage must pin the sprite to
// frame 0 when `pigFrozen` (the item stays glued to the rest-pose anchor the
// placement studio tunes against), and must keep breathing otherwise (living
// mood surfaces — Barn/Closet/Visit — where the item rides the moving pig).
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { PigStage } from "../components/ui/PigStage";

// The pig sprite mounts every frame at once, toggling opacity; find the frame
// Image nodes and read which one is visible (same shape as SpritePig.test).
const frameNodes = (r: TestRenderer.ReactTestRenderer) =>
	r.root.findAll(
		(n) =>
			!!n.props &&
			n.props.source !== undefined &&
			n.props.resizeMode !== undefined
	);
const opacityOf = (style: unknown): number | undefined => {
	const arr = Array.isArray(style) ? style : [style];
	for (const s of arr) {
		if (s && typeof s === "object" && "opacity" in (s as object)) {
			return (s as { opacity: number }).opacity;
		}
	}
	return undefined;
};
const visibleSource = (r: TestRenderer.ReactTestRenderer) =>
	[
		...new Set(
			frameNodes(r)
				.filter((n) => opacityOf(n.props.style) === 1)
				.map((n) => n.props.source)
		),
	][0];

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("PigStage — shop-preview freeze", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("pigFrozen pins the sprite to a single frame (no idle loop)", async () => {
		const r = await renderAct(<PigStage pigAnimation="idle" pigFrozen />);
		const pinned = visibleSource(r);
		await act(async () => {
			jest.advanceTimersByTime(2000); // several idle fps periods
		});
		expect(visibleSource(r)).toBe(pinned); // never advanced
		act(() => r.unmount());
	});

	test("without pigFrozen the sprite keeps breathing", async () => {
		const r = await renderAct(<PigStage pigAnimation="idle" />);
		const first = visibleSource(r);
		await act(async () => {
			jest.advanceTimersByTime(1000 / 2.5 + 10); // one idle fps period
		});
		expect(visibleSource(r)).not.toBe(first); // stepped forward
		act(() => r.unmount());
	});
});
