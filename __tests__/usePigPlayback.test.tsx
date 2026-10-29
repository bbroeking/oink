import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import type { PigAnimation } from "../components/ui/pigRendererContract";
import { usePigPlayback } from "../components/ui/usePigPlayback";

interface ProbeProps {
	animation?: PigAnimation;
	active?: boolean;
	reduced?: boolean;
	playOnce?: boolean;
	playbackKey?: number;
	frameIdx?: number;
	customFrames?: Partial<Record<PigAnimation, string[]>>;
	onComplete?: () => void;
}

function Probe({
	animation = "idle",
	active = true,
	reduced = false,
	playOnce,
	playbackKey,
	frameIdx,
	customFrames,
	onComplete,
}: ProbeProps) {
	const playback = usePigPlayback({
		animation,
		active,
		reduced,
		tempo: 1,
		playOnce,
		playbackKey,
		frameIdx,
		customFrames,
		onComplete,
	});
	return <Text>{`${playback.frameIdx}:${playback.frames.join(",")}`}</Text>;
}

function value(renderer: TestRenderer.ReactTestRenderer): string {
	return renderer.root.findByType(Text).props.children;
}

async function render(props: ProbeProps = {}) {
	let renderer!: TestRenderer.ReactTestRenderer;
	await act(async () => {
		renderer = TestRenderer.create(<Probe {...props} />);
	});
	return renderer;
}

describe("usePigPlayback", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("visibility pause stops the clock and resume restarts at source frame zero", async () => {
		const renderer = await render();
		await act(async () => jest.advanceTimersByTime(3 * (1000 / 6)));
		expect(value(renderer)).toMatch(/^3:/);
		await act(async () => renderer.update(<Probe active={false} />));
		await act(async () => jest.advanceTimersByTime(2000));
		expect(value(renderer)).toMatch(/^0:/);
		await act(async () => renderer.update(<Probe active />));
		expect(value(renderer)).toMatch(/^0:/);
		await act(async () => jest.advanceTimersByTime(1000 / 6));
		expect(value(renderer)).toMatch(/^1:/);
		act(() => renderer.unmount());
	});

	test("returning from a frozen manual frame starts live playback at zero", async () => {
		const renderer = await render({ frameIdx: 7 });
		expect(value(renderer)).toMatch(/^7:/);
		await act(async () => renderer.update(<Probe />));
		expect(value(renderer)).toMatch(/^0:/);
		act(() => renderer.unmount());
	});

	test("changing custom frames resets the source frame and uses the new set", async () => {
		const first = { idle: ["happy_1", "happy_2", "happy_3", "happy_4"] };
		const second = { idle: ["wave_1", "wave_2"] };
		const renderer = await render({ customFrames: first });
		await act(async () => jest.advanceTimersByTime(2 * (1000 / 2.5)));
		expect(value(renderer)).toBe("2:happy_1,happy_2,happy_3,happy_4");
		await act(async () => renderer.update(<Probe customFrames={second} />));
		expect(value(renderer)).toBe("0:wave_1,wave_2");
		act(() => renderer.unmount());
	});

	test("reduce motion freezes at zero and completes a one-shot once", async () => {
		const onComplete = jest.fn();
		const renderer = await render({ animation: "jump", reduced: true, playOnce: true, onComplete });
		expect(value(renderer)).toMatch(/^0:/);
		expect(onComplete).toHaveBeenCalledTimes(1);
		await act(async () => jest.advanceTimersByTime(2000));
		expect(onComplete).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});

	test("the same reaction key does not restart a completed one-shot", async () => {
		const onComplete = jest.fn();
		const props = { animation: "jump" as const, playOnce: true, playbackKey: 9, onComplete };
		const renderer = await render(props);
		await act(async () => jest.advanceTimersByTime(4 * (1000 / 5)));
		expect(onComplete).toHaveBeenCalledTimes(1);
		const final = value(renderer);
		await act(async () => renderer.update(<Probe {...props} />));
		await act(async () => jest.advanceTimersByTime(1000));
		expect(value(renderer)).toBe(final);
		expect(onComplete).toHaveBeenCalledTimes(1);
		act(() => renderer.unmount());
	});
});
