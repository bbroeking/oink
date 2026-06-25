// Guards the cross-dissolve transition system (#1 of the animation pass):
// the idle loop and every idle<->reaction swap blend via a two-layer fade
// instead of hard-cutting a pose. We spy on Animated.timing and resolve it
// synchronously so no fade timer escapes act() — then assert the fade is
// TRIGGERED on a real animation change, skipped during manual stepping (the
// align tool), and not fired on first mount.
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Animated } from "react-native";
import { SpritePig } from "../components/ui/SpritePig";

// Distinct frame sources currently on screen (one per logical layer). RN's
// <Image> shows up as multiple instances in the renderer tree, so we dedupe by
// source value rather than counting nodes.
const frameSources = (r: TestRenderer.ReactTestRenderer) => {
	const srcs = new Set<unknown>();
	r.root
		.findAll(
			(n) =>
				!!n.props &&
				n.props.source !== undefined &&
				n.props.resizeMode !== undefined
		)
		.forEach((n) => srcs.add(n.props.source));
	return srcs;
};

async function renderAct(node: React.ReactElement) {
	let r!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		r = TestRenderer.create(node);
	});
	return r;
}

describe("SpritePig — cross-dissolve transitions", () => {
	let timingSpy: jest.SpyInstance;
	beforeEach(() => {
		// Fake timers so the frame-stepping setInterval can't fire as a real
		// timer outside act(); the spy resolves the fade synchronously so no
		// Animated timer survives act() either.
		jest.useFakeTimers();
		timingSpy = jest
			.spyOn(Animated, "timing")
			.mockImplementation((value: any, config: any) => ({
				start: (cb?: (r: { finished: boolean }) => void) => {
					value.setValue(config.toValue);
					cb?.({ finished: true });
				},
				stop: jest.fn(),
				reset: jest.fn(),
			}) as any);
	});
	afterEach(() => {
		timingSpy.mockRestore();
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("first mount shows one frame and starts no cross-fade", async () => {
		const r = await renderAct(<SpritePig animation="idle" />);
		expect(frameSources(r).size).toBe(1);
		expect(timingSpy).not.toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("switching animations triggers a cross-fade", async () => {
		const r = await renderAct(<SpritePig animation="idle" />);
		timingSpy.mockClear();
		await act(async () => {
			r.update(<SpritePig animation="surprise" />);
		});
		expect(timingSpy).toHaveBeenCalled();
		act(() => r.unmount());
	});

	test("manual frame stepping (align tool) never cross-fades", async () => {
		const r = await renderAct(<SpritePig animation="idle" frameIdx={0} />);
		timingSpy.mockClear();
		await act(async () => {
			r.update(<SpritePig animation="surprise" frameIdx={0} />);
		});
		expect(timingSpy).not.toHaveBeenCalled();
		expect(frameSources(r).size).toBe(1);
		act(() => r.unmount());
	});
});
