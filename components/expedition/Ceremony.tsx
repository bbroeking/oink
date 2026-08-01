import React, { useEffect, useRef } from "react";
import {
	Animated,
	StyleSheet,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { RADII } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Sticker, Tape } from "@/components/ui/Sticker";

// The shared ceremony entrance — extracted from PostcardModal so the postcard,
// the chapter-clear card, and the boss-victory beat all spring up the same way
// (Fix 5). A single spring drives opacity + a rise + a settle, routed through the
// reduced-motion policy (instant when motion is off). Returns an animated style
// for an Animated.View.
export function useSpringEntrance() {
	const policy = useMotionPolicy();
	const enter = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (policy.reduceMotion) {
			enter.setValue(1);
			return;
		}
		enter.setValue(0);
		Animated.spring(enter, {
			toValue: 1,
			tension: 70,
			friction: 9,
			useNativeDriver: true,
		}).start();
	}, [policy.reduceMotion, enter]);

	return {
		opacity: enter,
		transform: [
			{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
			{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
		],
	};
}

// A sticker that springs up on mount, pinned with a strip of tape — the reusable
// wrapper for the chapter-clear card and the boss-victory beat.
export function CeremonyCard({
	children,
	color = "paper",
	rotate = -1,
	radius = RADII.md,
	style,
}: {
	children: React.ReactNode;
	color?: string;
	rotate?: number;
	radius?: number;
	style?: StyleProp<ViewStyle>;
}) {
	const enter = useSpringEntrance();
	return (
		<Animated.View style={enter}>
			<Sticker color={color} rotate={rotate} radius={radius} style={style}>
				{children}
			</Sticker>
			{/* Pinned to the journal with a strip of tape. */}
			<Tape color="sun" rotate={-8} width={64} style={styles.tape} />
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	tape: {
		position: "absolute",
		top: -7,
		left: "50%",
		marginLeft: -32,
	},
});
