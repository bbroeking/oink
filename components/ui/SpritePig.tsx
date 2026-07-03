import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

const FRAMES: Record<string, number> = {
	idle_1: require("../../assets/images/sprites/rosie/idle_1.png"),
	idle_2: require("../../assets/images/sprites/rosie/idle_2.png"),
	idle_3: require("../../assets/images/sprites/rosie/idle_3.png"),
	idle_4: require("../../assets/images/sprites/rosie/idle_4.png"),
	sad_1: require("../../assets/images/sprites/rosie/sad_1.png"),
	sad_2: require("../../assets/images/sprites/rosie/sad_2.png"),
	sad_3: require("../../assets/images/sprites/rosie/sad_3.png"),
	sad_4: require("../../assets/images/sprites/rosie/sad_4.png"),
	walk_1: require("../../assets/images/sprites/rosie/walk_1.png"),
	walk_2: require("../../assets/images/sprites/rosie/walk_2.png"),
	walk_3: require("../../assets/images/sprites/rosie/walk_3.png"),
	walk_4: require("../../assets/images/sprites/rosie/walk_4.png"),
	jump_1: require("../../assets/images/sprites/rosie/jump_1.png"),
	jump_2: require("../../assets/images/sprites/rosie/jump_2.png"),
	jump_3: require("../../assets/images/sprites/rosie/jump_3.png"),
	jump_4: require("../../assets/images/sprites/rosie/jump_4.png"),
	surprise_1: require("../../assets/images/sprites/rosie/surprise_1.png"),
	surprise_2: require("../../assets/images/sprites/rosie/surprise_2.png"),
	surprise_3: require("../../assets/images/sprites/rosie/surprise_3.png"),
	surprise_4: require("../../assets/images/sprites/rosie/surprise_4.png"),
	happy_1: require("../../assets/images/sprites/rosie/happy_1.png"),
	happy_2: require("../../assets/images/sprites/rosie/happy_2.png"),
	happy_3: require("../../assets/images/sprites/rosie/happy_3.png"),
	happy_4: require("../../assets/images/sprites/rosie/happy_4.png"),
	tired_1: require("../../assets/images/sprites/rosie/tired_1.png"),
	tired_2: require("../../assets/images/sprites/rosie/tired_2.png"),
	tired_3: require("../../assets/images/sprites/rosie/tired_3.png"),
	tired_4: require("../../assets/images/sprites/rosie/tired_4.png"),
	wave_1: require("../../assets/images/sprites/rosie/wave_1.png"),
	wave_2: require("../../assets/images/sprites/rosie/wave_2.png"),
	wave_3: require("../../assets/images/sprites/rosie/wave_3.png"),
	wave_4: require("../../assets/images/sprites/rosie/wave_4.png"),
};

export type PigAnimation =
	| "idle"
	| "walk"
	| "jump"
	| "bounce"
	| "happy"
	| "sad"
	| "tired"
	| "surprise"
	| "wave";

interface AnimationConfig {
	frames: string[];
	fps: number;
	loop: boolean;
}

const ANIMATIONS: Record<PigAnimation, AnimationConfig> = {
	idle: { frames: ["idle_1", "idle_2", "idle_3", "idle_4"], fps: 2.5, loop: true },
	walk: { frames: ["walk_1", "walk_2", "walk_3", "walk_4"], fps: 4, loop: true },
	jump: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 6, loop: false },
	// Looping version of the jump frames, slower — for ambient bouncy idle.
	bounce: { frames: ["jump_1", "jump_2", "jump_3", "jump_4"], fps: 3, loop: true },
	happy: { frames: ["happy_1", "happy_2", "happy_3", "happy_4"], fps: 4, loop: true },
	sad: { frames: ["sad_1", "sad_2", "sad_3", "sad_4"], fps: 3, loop: true },
	// Drowsy/sleepy — the slowest loop, for the barn-visit tired-out.
	tired: { frames: ["tired_1", "tired_2", "tired_3", "tired_4"], fps: 2, loop: true },
	surprise: {
		frames: ["surprise_1", "surprise_2", "surprise_3", "surprise_4"],
		fps: 6,
		loop: false,
	},
	wave: { frames: ["wave_1", "wave_2", "wave_3", "wave_4"], fps: 4, loop: true },
};

// One full play/cycle of an animation, in ms. Callers (SwipeElement) hold a
// reaction this long so it plays through completely before reverting to rest,
// instead of being cut off mid-cycle by a flat timer.
export function animDurationMs(animation: PigAnimation): number {
	const cfg = ANIMATIONS[animation] ?? ANIMATIONS.idle;
	return Math.round((cfg.frames.length / cfg.fps) * 1000);
}

interface Props {
	animation: PigAnimation;
	size?: number;
	style?: StyleProp<ViewStyle>;
	onComplete?: () => void;
	onFrame?: (idx: number) => void;
	// Optional per-animation override that swaps in a different frame set.
	// Used by the pre-baked accessory path so equipping a legendary item
	// can replace the default pig frames with bespoke "pig wearing X" art.
	customFrames?: Partial<Record<PigAnimation, string[]>>;
	// When provided, locks the displayed frame to this index and skips the
	// internal interval. Used by the alignment screen's frame stepper so
	// we can pause an animation and inspect anchor placement frame-by-frame.
	frameIdx?: number;
}

export function SpritePig({
	animation,
	size = 300,
	style,
	onComplete,
	onFrame,
	customFrames,
	frameIdx,
}: Props) {
	const [internalIdx, setInternalIdx] = useState(0);
	const idx = frameIdx ?? internalIdx;
	const setIdx = setInternalIdx;
	const completeRef = useRef(onComplete);
	completeRef.current = onComplete;
	const frameRef = useRef(onFrame);
	frameRef.current = onFrame;

	// Resolve which frame set + fps to use. customFrames (from prebaked
	// items) overrides the default ANIMATIONS entry per animation key.
	// Memoized so the interval-driven setIdx → re-render cycle doesn't
	// allocate a new config + frames array every frame tick.
	//
	// Defensive: if `animation` is a string we don't recognize (e.g.,
	// a stale ref to a removed animation like the old "arms_up"), fall
	// back to "idle" instead of crashing. This protects against future
	// drift between SpritePig's ANIMATIONS table and external callers.
	const { frames: activeFrames, fps: activeFps, loop: activeLoop } = useMemo(() => {
		const baseCfg = ANIMATIONS[animation] ?? ANIMATIONS.idle;
		const overrideFrames = customFrames?.[animation];
		return {
			frames: overrideFrames ?? baseCfg.frames,
			fps: baseCfg.fps,
			loop: baseCfg.loop,
		};
	}, [animation, customFrames]);

	useEffect(() => {
		// External frameIdx control bypasses the auto-advance interval —
		// useful for the align screen's manual stepper.
		if (frameIdx !== undefined) return;
		setIdx(0);
		if (activeFrames.length <= 1) return;
		const period = 1000 / activeFps;
		const handle = setInterval(() => {
			setIdx((prev) => {
				const next = prev + 1;
				if (next >= activeFrames.length) {
					if (activeLoop) return 0;
					clearInterval(handle);
					setTimeout(() => completeRef.current?.(), 0);
					return prev;
				}
				return next;
			});
		}, period);
		return () => clearInterval(handle);
	}, [activeFrames, activeFps, activeLoop, frameIdx]);

	// Fire onFrame after commit — never inside the setIdx updater (React forbids
	// side effects in state updaters as of React 18).
	useEffect(() => {
		frameRef.current?.(idx);
	}, [idx]);

	// Flip-book: every frame of the current animation is mounted at once and we
	// just toggle which one is visible (opacity 1 vs 0). No Image `source` swaps
	// during the loop → no decode/flash; never two poses on screen → no ghost.
	// fadeDuration={0} disables Android's default image fade-in.
	const safeIdx = Math.min(idx, activeFrames.length - 1);
	return (
		<View style={[{ width: size, height: size }, style]}>
			{activeFrames.map((f, i) => (
				<Image
					key={i}
					source={FRAMES[f]}
					style={[styles.fill, { opacity: i === safeIdx ? 1 : 0 }]}
					resizeMode="contain"
					fadeDuration={0}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});
