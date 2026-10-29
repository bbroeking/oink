import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
	PIG_ANIMATION_SPECS,
	PIG_REST_FPS,
	type PigAnimation,
} from "./pigRendererContract";

export interface PigPlaybackOptions {
	animation: PigAnimation;
	active: boolean;
	reduced: boolean;
	tempo: number;
	playOnce?: boolean;
	playbackKey?: number;
	customFrames?: Partial<Record<PigAnimation, string[]>>;
	frameIdx?: number;
	onComplete?: () => void;
	onFrame?: (idx: number) => void;
}

export interface PigPlayback {
	frames: readonly string[];
	frameIdx: number;
}

/** Owns the source-frame clock shared by a pig drawing and its attachments. */
export function usePigPlayback({
	animation,
	active,
	reduced,
	tempo,
	playOnce = false,
	playbackKey,
	customFrames,
	frameIdx,
	onComplete,
	onFrame,
}: PigPlaybackOptions): PigPlayback {
	const reportComplete = useEffectEvent(() => onComplete?.());
	const reportFrame = useEffectEvent((nextFrame: number) => onFrame?.(nextFrame));

	const overrideFrames = customFrames?.[animation];
	const config = useMemo(() => {
		const base = PIG_ANIMATION_SPECS[animation] ?? PIG_ANIMATION_SPECS.idle;
		return {
			frames: overrideFrames ?? base.frames,
			playback: overrideFrames
				? overrideFrames.map((_, index) => index)
				: base.playback ?? base.frames.map((_, index) => index),
			fps: overrideFrames ? PIG_REST_FPS : base.fps,
			loop: base.loop,
		};
	}, [animation, overrideFrames]);

	const identity = useMemo(
		() => ({ config, playbackKey, active, controlled: frameIdx !== undefined }),
		[active, config, frameIdx, playbackKey],
	);
	const [clock, setClock] = useState({ identity, tick: 0 });
	// A prop transition renders source frame zero immediately. Waiting for an
	// effect would expose the old family's tick for one committed frame.
	const tick = clock.identity === identity ? clock.tick : 0;

	useEffect(() => {
		if (frameIdx !== undefined || !active) return;
		if (reduced) {
			if (playOnce || !config.loop) reportComplete();
			return;
		}
		if (config.playback.length <= 1) return;

		const period = 1000 / (config.fps * tempo);
		let nextTick = 0;
		const handle = setInterval(() => {
			nextTick += 1;
			if (nextTick >= config.playback.length) {
				if (config.loop && !playOnce) nextTick = 0;
				else {
					clearInterval(handle);
					reportComplete();
					return;
				}
			}
			setClock({ identity, tick: nextTick });
		}, period);
		return () => clearInterval(handle);
	}, [active, config, frameIdx, identity, playOnce, reduced, tempo]);

	const displayedFrame =
		frameIdx ??
		(reduced
			? 0
			: config.playback[Math.min(tick, config.playback.length - 1)] ?? 0);

	useEffect(() => {
		reportFrame(displayedFrame);
	}, [displayedFrame]);

	return { frames: config.frames, frameIdx: displayedFrame };
}
