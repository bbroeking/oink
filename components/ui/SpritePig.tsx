import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { PIG_SKIN_WASH } from "@/utils/pigSkin";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import type { PigId } from "@/utils/pigs";
import {
	PIG_ANIMATION_SPECS,
	pigAnimationDurationMs,
	type PigAnimation,
} from "./pigRendererContract";

export type { PigAnimation } from "./pigRendererContract";

// One full play/cycle of an animation, in ms. Callers (SwipeElement) hold a
// reaction this long so it plays through completely before reverting to rest,
// instead of being cut off mid-cycle by a flat timer.
export function animDurationMs(animation: PigAnimation): number {
	return pigAnimationDurationMs(animation);
}

interface Props {
	animation: PigAnimation;
	// Character identity. Rosie is the default for every existing caller.
	// Every identity has a complete, baked animation pack.
	pigId?: PigId;
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
	// Prototype-only escape hatch for isolated internal previews. Production
	// pigs never read or apply the retired global gold-wash setting.
	skinTintOverride?: string | null;
}

export function SpritePig({
	animation,
	pigId = "rosie",
	size = 300,
	style,
	onComplete,
	onFrame,
	customFrames,
	frameIdx,
	skinTintOverride,
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
		const baseCfg = PIG_ANIMATION_SPECS[animation] ?? PIG_ANIMATION_SPECS.idle;
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
	// The retired gold-Rosie experiment survives only as an explicit preview
	// override. No persisted setting can alter production character art.
	const prototypeSkinTint = skinTintOverride ?? null;
	const frames = PIG_FRAMES[pigId] ?? PIG_FRAMES.rosie;
	// The old optional gold-wash prototype only applies to Rosie. Recruitable
	// pigs already have authored coats and must never be flattened by a tint.
	const skinTint = pigId === "rosie" ? prototypeSkinTint : null;
	return (
		<View style={[{ width: size, height: size }, style]}>
			{activeFrames.map((f, i) => (
				<Image
					key={i}
					source={frames[f] ?? PIG_FRAMES.rosie[f]}
					style={[styles.fill, { opacity: i === safeIdx ? 1 : 0 }]}
					resizeMode="contain"
					fadeDuration={0}
				/>
			))}
			{skinTint && (
				<View style={styles.fill} pointerEvents="none">
					<Image
						source={
							frames[activeFrames[safeIdx]] ??
							PIG_FRAMES.rosie[activeFrames[safeIdx]]
						}
						style={[styles.fill, { tintColor: skinTint, opacity: PIG_SKIN_WASH }]}
						resizeMode="contain"
						fadeDuration={0}
					/>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});
