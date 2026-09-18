// The Ghost Sheep Trader's sprite (components/trader/TraderArt TraderSprite):
//   • a one-shot walks its frames on the family's clock, reports `onEnd`
//     once, and settles to idle
//   • idle loops and never reports
//   • bumping `cue` replays the same one-shot from its first frame
//   • under Reduce Motion a one-shot rests on its first frame and still
//     reports, so a beat waiting on him never stalls
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Image } from "react-native";
import { TraderSprite } from "@/components/trader/TraderArt";
import { TRADER_FRAMES, TRADER_FRAME_MS } from "@/constants/traderFrames";

const mockMotion = { reduceMotion: false };
jest.mock("@/hooks/useMotionPolicy", () => ({
	MOTION_DURATION: { feedback: 120, state: 220, modal: 300, celebration: 450, crossfade: 150 },
	useMotionPolicy: () => ({
		reduceMotion: mockMotion.reduceMotion,
		allowDecorativeMotion: !mockMotion.reduceMotion,
		largeTransition: "crossfade",
		duration: (_standard: number, reduced = 150) => reduced,
	}),
}));

// One frame per act: the next frame's timer is armed by an effect that runs
// when the act commits, so a single long advance would only step once.
function tick(ms: number, n = 1) {
	for (let i = 0; i < n; i++) act(() => jest.advanceTimersByTime(ms));
}

function frameOf(r: TestRenderer.ReactTestRenderer) {
	return r.root.findByType(Image).props.source;
}

describe("TraderSprite", () => {
	let r: TestRenderer.ReactTestRenderer;
	beforeEach(() => {
		jest.useFakeTimers();
		mockMotion.reduceMotion = false;
	});
	afterEach(() => {
		act(() => r?.unmount());
		jest.useRealTimers();
	});

	it("plays a one-shot through, reports once, settles to idle", () => {
		const onEnd = jest.fn();
		act(() => {
			r = TestRenderer.create(<TraderSprite size={120} anim="take" onEnd={onEnd} />);
		});
		expect(frameOf(r)).toBe(TRADER_FRAMES.take[0]);
		tick(TRADER_FRAME_MS.take);
		expect(frameOf(r)).toBe(TRADER_FRAMES.take[1]);
		tick(TRADER_FRAME_MS.take, 2);
		expect(frameOf(r)).toBe(TRADER_FRAMES.take[3]);
		expect(onEnd).not.toHaveBeenCalled();
		tick(TRADER_FRAME_MS.take);
		expect(onEnd).toHaveBeenCalledWith("take");
		expect(onEnd).toHaveBeenCalledTimes(1);
		expect(frameOf(r)).toBe(TRADER_FRAMES.idle[0]);
		tick(TRADER_FRAME_MS.idle, 8);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it("idle loops and never reports", () => {
		const onEnd = jest.fn();
		act(() => {
			r = TestRenderer.create(<TraderSprite size={120} anim="idle" onEnd={onEnd} />);
		});
		tick(TRADER_FRAME_MS.idle, 4);
		expect(frameOf(r)).toBe(TRADER_FRAMES.idle[0]);
		tick(TRADER_FRAME_MS.idle);
		expect(frameOf(r)).toBe(TRADER_FRAMES.idle[1]);
		expect(onEnd).not.toHaveBeenCalled();
	});

	it("a bumped cue replays the same one-shot from its first frame", () => {
		const onEnd = jest.fn();
		act(() => {
			r = TestRenderer.create(<TraderSprite size={120} anim="shake" cue={1} onEnd={onEnd} />);
		});
		tick(TRADER_FRAME_MS.shake, 4);
		expect(onEnd).toHaveBeenCalledTimes(1);
		act(() => {
			r.update(<TraderSprite size={120} anim="shake" cue={2} onEnd={onEnd} />);
		});
		expect(frameOf(r)).toBe(TRADER_FRAMES.shake[0]);
		tick(TRADER_FRAME_MS.shake, 4);
		expect(onEnd).toHaveBeenCalledTimes(2);
	});

	it("under Reduce Motion a one-shot rests on its first frame and still reports", () => {
		mockMotion.reduceMotion = true;
		const onEnd = jest.fn();
		act(() => {
			r = TestRenderer.create(<TraderSprite size={120} anim="leave" onEnd={onEnd} />);
		});
		expect(frameOf(r)).toBe(TRADER_FRAMES.leave[0]);
		act(() => jest.advanceTimersByTime(220));
		expect(onEnd).toHaveBeenCalledWith("leave");
		expect(frameOf(r)).toBe(TRADER_FRAMES.idle[0]);
	});
});
