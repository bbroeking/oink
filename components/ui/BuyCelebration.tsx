import React, {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { View, StyleSheet, Animated, Text, Easing } from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const kaChingSound = require("../../assets/sounds/ka_ching.mp3");

export interface BuyCelebrationHandle {
	// Trigger the celebration anchored at the given screen coords
	// (typically the tile center for a shop purchase).
	fire: (anchor: { x: number; y: number; tier?: "common" | "premium" }) => void;
}

type Particle = {
	id: number;
	dx: number;
	dy: number;
	rot: number;
	emoji: string;
};

// Lightweight purchase celebration:
// - ka_ching sound + medium haptic
// - 6-8 sparkle/coin emojis radiate outward from anchor, scale+fade
// - "PREMIUM" tier gets a bigger burst with gold-colored emoji + heavy haptic
// Mounted ONCE at the screen root, fired imperatively from any buy
// site via ref.fire({ x, y }).
export const BuyCelebration = forwardRef<BuyCelebrationHandle>(
	function BuyCelebration(_, ref) {
		const player = useAudioPlayer(kaChingSound);
		const [particles, setParticles] = useState<Particle[]>([]);
		const [anchor, setAnchor] = useState<{ x: number; y: number }>({
			x: 0,
			y: 0,
		});
		const animsRef = useRef<Animated.Value[]>([]);
		const idCounter = useRef(0);

		const fire = useCallback(
			(a: { x: number; y: number; tier?: "common" | "premium" }) => {
				const tier = a.tier ?? "common";
				const count = tier === "premium" ? 10 : 7;
				// Decorative confetti glyphs — sanctioned as print-glyph text
				// per the dingbat ruling (2026-07-13): ✦/★ are flourish
				// typography, and ♥ rides here as animated confetti, not the
				// static semantic love-count mark the ruling targets. These
				// animate as Animated.Text; swapping one image glyph in among
				// them would fracture the burst, so the whole palette stays text.
				const palette =
					tier === "premium"
						? ["★", "✦", "♥"]
						: ["✦", "★"];
				const baseAngle = (Math.random() * Math.PI) / 4;
				const newParts: Particle[] = Array.from({ length: count }, (_, i) => {
					const angle = baseAngle + (i / count) * Math.PI * 2;
					const dist = 60 + Math.random() * 40;
					return {
						id: idCounter.current++,
						dx: Math.cos(angle) * dist,
						dy: Math.sin(angle) * dist - 30, // bias up (looks more lively)
						rot: (Math.random() - 0.5) * 90,
						emoji: palette[Math.floor(Math.random() * palette.length)],
					};
				});
				setAnchor({ x: a.x, y: a.y });
				setParticles(newParts);
				animsRef.current = newParts.map(() => new Animated.Value(0));

				try {
					player.seekTo(0);
					player.play();
				} catch {}
				Haptics.notificationAsync(
					tier === "premium"
						? Haptics.NotificationFeedbackType.Success
						: Haptics.NotificationFeedbackType.Success
				).catch(() => {});

				const duration = tier === "premium" ? 1100 : 850;
				Animated.parallel(
					animsRef.current.map((v) =>
						Animated.timing(v, {
							toValue: 1,
							duration,
							easing: Easing.out(Easing.cubic),
							useNativeDriver: true,
						})
					)
				).start(() => {
					setParticles([]);
				});
			},
			[player]
		);

		useImperativeHandle(ref, () => ({ fire }), [fire]);

		if (particles.length === 0) return null;

		return (
			<View pointerEvents="none" style={StyleSheet.absoluteFill}>
				{particles.map((p, i) => {
					const v = animsRef.current[i];
					if (!v) return null;
					const translateX = v.interpolate({
						inputRange: [0, 1],
						outputRange: [0, p.dx],
					});
					const translateY = v.interpolate({
						inputRange: [0, 1],
						outputRange: [0, p.dy],
					});
					const scale = v.interpolate({
						inputRange: [0, 0.2, 0.8, 1],
						outputRange: [0.4, 1.3, 1.0, 0.6],
					});
					const opacity = v.interpolate({
						inputRange: [0, 0.15, 0.85, 1],
						outputRange: [0, 1, 1, 0],
					});
					const rotate = v.interpolate({
						inputRange: [0, 1],
						outputRange: ["0deg", `${p.rot}deg`],
					});
					return (
						<Animated.Text
							key={p.id}
							style={[
								styles.particle,
								{
									left: anchor.x - 14,
									top: anchor.y - 14,
									opacity,
									transform: [
										{ translateX },
										{ translateY },
										{ scale },
										{ rotate },
									],
								},
							]}
						>
							{p.emoji}
						</Animated.Text>
					);
				})}
			</View>
		);
	}
);

const styles = StyleSheet.create({
	particle: {
		position: "absolute",
		fontSize: 28,
		// Without an explicit width/height, animated <Text/> can layout-
		// shift between frames. Anchored to a 28-px box keeps it stable.
		width: 28,
		height: 28,
		textAlign: "center",
	},
});
