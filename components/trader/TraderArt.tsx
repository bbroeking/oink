// The Ghost Sheep Trader's art — the still portrait, and the animated sprite.
//
// One Codex ImageGen sticker off Rosie's idle_1 (art A, 2026-09-17: hooded,
// no eyes) is the still (`assets/images/trader/ghost_sheep.png`) — the Field
// Guide, the fan glyph. The sheet uses `TraderSprite`: five small families
// (constants/traderFrames) cycled by a timer — the `_neutral` / lounge-sprite
// precedent, never PigStage; nothing is ever worn by him. `idle` loops;
// `greet` / `take` / `shake` / `leave` play once and settle back to idle
// (`leave` also drifts right and fades — the ghost half of "ghost sheep").
// Under Reduce Motion every family rests on its first frame and `onEnd` still
// fires, so a beat that waits on him never stalls.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { OPACITY, WHIMSY } from "@/constants/theme";
import { TRADER_FRAMES, TRADER_FRAME_MS, TRADER_ONE_SHOT, type TraderAnim } from "@/constants/traderFrames";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";

const PORTRAIT = require("../../assets/images/trader/ghost_sheep.png");

// How far he drifts on the way out, as a fraction of his size.
const LEAVE_DRIFT = 0.35;

export function TraderArt({
	size,
	silhouette = false,
	style,
	testID,
}: {
	size: number;
	silhouette?: boolean;
	style?: StyleProp<ImageStyle>;
	testID?: string;
}) {
	return (
		<Image
			source={PORTRAIT}
			resizeMode="contain"
			accessibilityIgnoresInvertColors
			testID={testID}
			style={[
				{ width: size, height: size },
				silhouette && { tintColor: WHIMSY.ink, opacity: OPACITY.ghost },
				style,
			]}
		/>
	);
}

export interface TraderSpriteProps {
	size: number;
	/** The family to play. A one-shot plays through once and settles to idle;
	 *  set the SAME one-shot again by bumping `cue` to replay it. */
	anim: TraderAnim;
	/** Bump to replay `anim` from its first frame (a second sale, a second refusal). */
	cue?: number;
	/** A one-shot finished (fires under Reduce Motion too). */
	onEnd?: (anim: TraderAnim) => void;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

export function TraderSprite({ size, anim, cue = 0, onEnd, style, testID }: TraderSpriteProps) {
	const motion = useMotionPolicy();
	const [playing, setPlaying] = useState<TraderAnim>(anim);
	const [frame, setFrame] = useState(0);
	const drift = useRef(new Animated.Value(0)).current;
	const onEndRef = useRef(onEnd);
	useEffect(() => {
		onEndRef.current = onEnd;
	}, [onEnd]);

	// A new family (or a re-cue of the same one) starts from its first frame —
	// state adjusted during render, the React-sanctioned way, not in an effect.
	const [seen, setSeen] = useState({ anim, cue });
	if (seen.anim !== anim || seen.cue !== cue) {
		setSeen({ anim, cue });
		setPlaying(anim);
		setFrame(0);
		drift.setValue(0);
	}

	// The frame clock. A one-shot's last frame hands back to idle and reports.
	useEffect(() => {
		const frames = TRADER_FRAMES[playing];
		const oneShot = TRADER_ONE_SHOT.has(playing);
		if (motion.reduceMotion) {
			if (oneShot) {
				const id = setTimeout(() => {
					onEndRef.current?.(playing);
					setPlaying("idle");
				}, MOTION_DURATION.state);
				return () => clearTimeout(id);
			}
			return;
		}
		const id = setTimeout(() => {
			if (frame + 1 < frames.length) {
				setFrame(frame + 1);
				return;
			}
			if (oneShot) {
				onEndRef.current?.(playing);
				setPlaying("idle");
				setFrame(0);
				drift.setValue(0);
			} else {
				setFrame(0);
			}
		}, TRADER_FRAME_MS[playing]);
		return () => clearTimeout(id);
	}, [playing, frame, motion.reduceMotion, drift]);

	// The leave drifts right and fades over the family's whole length.
	useEffect(() => {
		if (playing !== "leave" || motion.reduceMotion) return;
		const total = TRADER_FRAME_MS.leave * TRADER_FRAMES.leave.length;
		Animated.timing(drift, {
			toValue: 1,
			duration: total,
			easing: Easing.in(Easing.quad),
			useNativeDriver: true,
		}).start();
	}, [playing, motion.reduceMotion, drift]);

	const frames = TRADER_FRAMES[playing];
	const source = frames[Math.min(frame, frames.length - 1)];
	return (
		<Animated.View
			style={[
				{
					width: size,
					height: size,
					opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
					transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, size * LEAVE_DRIFT] }) }],
				},
				style,
			]}
			testID={testID}
			accessibilityLabel={`The Ghost Sheep Trader, ${playing}`}
		>
			<Image source={source} resizeMode="contain" accessibilityIgnoresInvertColors style={{ width: size, height: size }} />
		</Animated.View>
	);
}
