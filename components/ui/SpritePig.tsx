import React from "react";
import { Image, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { PIG_SKIN_WASH } from "@/utils/pigSkin";
import { PIG_FRAMES_EXTRA } from "@/constants/pigFramesExtra";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import type { PigId } from "@/utils/pigs";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePigActive } from "@/hooks/usePigActive";
import { usePigRestTempo } from "./PigRestingPose";
import {
	isPigRestAnimation,
	type PigAnimation,
} from "./pigRendererContract";
import { usePigPlayback } from "./usePigPlayback";
import { costumeSkinSource } from "@/utils/costumeFit";

export type { PigAnimation } from "./pigRendererContract";

interface Props {
	animation: PigAnimation;
	active?: boolean;
	reduceMotion?: boolean;
	playOnce?: boolean;
	playbackKey?: number;
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
	// A worn full costume's skin (utils/costumeFit.ts): every frame is drawn
	// from the skin, pose for pose on the same canvas, in place of the pig's
	// own; a family the skin lacks resolves inside the skin, never to the bare
	// pig. Null/absent draws the pig as always.
	costumeSkin?: Readonly<Record<string, number>> | null;
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
	costumeSkin,
	active = true,
	reduceMotion,
	playOnce = false,
	playbackKey,
}: Props) {
	const policy = useMotionPolicy();
	const visible = usePigActive(active);
	// The surface's rest tempo scales the rest loops only; a reaction or a
	// mood plays at its authored speed wherever it plays.
	const restTempo = usePigRestTempo();
	const tempo = isPigRestAnimation(animation) ? restTempo : 1;
	const reduced = reduceMotion ?? policy.reduceMotion;
	const { frames: activeFrames, frameIdx: idx } = usePigPlayback({
		animation,
		active: visible,
		reduced,
		tempo,
		playOnce,
		playbackKey,
		customFrames,
		frameIdx,
		onComplete,
		onFrame,
	});

	// Flip-book: every frame of the current animation is mounted at once and we
	// just toggle which one is visible (opacity 1 vs 0). No Image `source` swaps
	// during the loop → no decode/flash; never two poses on screen → no ghost.
	// fadeDuration={0} disables Android's default image fade-in.
	const safeIdx = Math.min(idx, activeFrames.length - 1);
	// The retired gold-Rosie experiment survives only as an explicit preview
	// override. No persisted setting can alter production character art.
	const prototypeSkinTint = skinTintOverride ?? null;
	const frames = { ...(PIG_FRAMES[pigId] ?? PIG_FRAMES.rosie), ...PIG_FRAMES_EXTRA[pigId] };
	const sourceOf = (name: string) =>
		costumeSkin ? costumeSkinSource(costumeSkin, name) : (frames[name] ?? PIG_FRAMES.rosie[name]);
	// The old optional gold-wash prototype only applies to Rosie. Recruitable
	// pigs already have authored coats and must never be flattened by a tint.
	const skinTint = pigId === "rosie" ? prototypeSkinTint : null;
	return (
		<View style={[{ width: size, height: size }, style]}>
			{activeFrames.map((f, i) => (
				<Image
					key={i}
					source={sourceOf(f)}
					style={[styles.fill, { opacity: i === safeIdx ? 1 : 0 }]}
					resizeMode="contain"
					fadeDuration={0}
				/>
			))}
			{skinTint && (
				<View style={styles.fill} pointerEvents="none">
					<Image
						source={sourceOf(activeFrames[safeIdx])}
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
