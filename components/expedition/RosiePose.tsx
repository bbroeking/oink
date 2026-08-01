import React, { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	Image,
	type ImageStyle,
	type StyleProp,
} from "react-native";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

// Rosie rendered from the existing sprite frames. Moods map per the spec:
// walking = walk/idle, at a wall = surprise, defeated wall = happy,
// postcard = happy/tired. `jump` is the full-Zoomies burst-ready pose.
export type RosieMood = "idle" | "walk" | "surprise" | "happy" | "tired" | "jump";

const POSES: Record<RosieMood, number> = {
	idle: require("../../assets/images/sprites/rosie/idle_1.png"),
	walk: require("../../assets/images/sprites/rosie/walk_1.png"),
	surprise: require("../../assets/images/sprites/rosie/surprise_1.png"),
	happy: require("../../assets/images/sprites/rosie/happy_1.png"),
	tired: require("../../assets/images/sprites/rosie/tired_1.png"),
	jump: require("../../assets/images/sprites/rosie/jump_1.png"),
};

// Zoomies as sprite energy: her pose escalates with charge — idle at rest, happy
// once she's building, a full-tilt jump when the burst is ready. (Task 7a.)
export function poseForCharge(zoomies: number, max: number): RosieMood {
	if (zoomies >= max) return "jump";
	if (zoomies >= Math.ceil(max / 2)) return "happy";
	return "idle";
}

export function RosiePose({
	mood = "idle",
	size = 180,
	style,
}: {
	mood?: RosieMood;
	size?: number;
	style?: StyleProp<ImageStyle>;
}) {
	return (
		<Image
			source={POSES[mood]}
			resizeMode="contain"
			style={[{ width: size, height: size }, style]}
		/>
	);
}

// Rosie posed for her Zoomies charge, with a wiggle whose amplitude grows with
// the charge (a feeling, not a number). Gated through the reduced-motion policy:
// with reduce-motion on she simply holds the escalated pose, no wiggle. (Task 7a.)
export function RosieCharged({
	zoomies,
	max,
	size = 130,
	defeated = false,
	mood,
}: {
	zoomies: number;
	max: number;
	size?: number;
	defeated?: boolean;
	mood?: RosieMood;
}) {
	const policy = useMotionPolicy();
	const wig = useRef(new Animated.Value(0)).current;
	const chargeFrac = max > 0 ? Math.min(1, Math.max(0, zoomies) / max) : 0;
	const pose: RosieMood = defeated
		? "happy"
		: mood ?? poseForCharge(zoomies, max);

	useEffect(() => {
		if (!policy.allowDecorativeMotion || chargeFrac <= 0) {
			wig.stopAnimation();
			wig.setValue(0);
			return;
		}
		const beat = Easing.inOut(Easing.quad);
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(wig, { toValue: 1, duration: 200, easing: beat, useNativeDriver: true }),
				Animated.timing(wig, { toValue: -1, duration: 200, easing: beat, useNativeDriver: true }),
				Animated.timing(wig, { toValue: 0, duration: 200, easing: beat, useNativeDriver: true }),
			])
		);
		loop.start();
		return () => {
			loop.stop();
			wig.setValue(0);
		};
	}, [policy.allowDecorativeMotion, chargeFrac, wig]);

	// Amplitude climbs with charge — a gentle sway when stirring, a real shake at
	// full tilt.
	const amp = 1 + chargeFrac * 5;
	const rotate = wig.interpolate({
		inputRange: [-1, 0, 1],
		outputRange: [`-${amp}deg`, "0deg", `${amp}deg`],
	});

	return (
		<Animated.View style={{ transform: [{ rotate }] }}>
			<RosiePose mood={pose} size={size} />
		</Animated.View>
	);
}
