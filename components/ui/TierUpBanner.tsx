import React, {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import {
	View,
	Text,
	StyleSheet,
	Animated,
	Easing,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { FONTS, WHIMSY } from "@/constants/theme";
import {
	MOTION_DURATION,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

const tierUpSound = require("../../assets/sounds/tier_up.mp3");

export interface TierUpBannerHandle {
	// Fire the celebration for transition from `fromTier` → `toTier`.
	// Plays the fanfare, strong haptic, slides a banner in from the top
	// for ~2.5s, then auto-dismisses.
	fire: (toTier: number) => void;
}

// Mounted at screen root in the battle pass tab. Slides down from the
// top, shows the new tier number with sparkles, then retracts. Triggered
// from season.tsx's tier-change detection effect.
export const TierUpBanner = forwardRef<TierUpBannerHandle>(
	function TierUpBanner(_, ref) {
		const player = useAudioPlayer(tierUpSound);
		const [tier, setTier] = useState<number | null>(null);
		const slide = useRef(new Animated.Value(0)).current;
		const sparkle = useRef(new Animated.Value(0)).current;
		const reducedOpacity = useRef(new Animated.Value(0)).current;
		const motionPolicy = useMotionPolicy();

		const fire = useCallback(
			(toTier: number) => {
				setTier(toTier);
				slide.setValue(0);
				sparkle.setValue(0);
				reducedOpacity.setValue(0);

				try {
					player.seekTo(0);
					player.play();
				} catch {}
				Haptics.notificationAsync(
					Haptics.NotificationFeedbackType.Success
				).catch(() => {});

				const animation = motionPolicy.reduceMotion
					? Animated.sequence([
							Animated.timing(reducedOpacity, {
								toValue: 1,
								duration: MOTION_DURATION.crossfade,
								useNativeDriver: true,
							}),
							Animated.delay(1500),
							Animated.timing(reducedOpacity, {
								toValue: 0,
								duration: MOTION_DURATION.crossfade,
								useNativeDriver: true,
							}),
						])
					: Animated.sequence([
							// Slide in + sparkle burst in parallel
							Animated.parallel([
								Animated.spring(slide, {
									toValue: 1,
									friction: 7,
									tension: 80,
									useNativeDriver: true,
								}),
								Animated.timing(sparkle, {
									toValue: 1,
									duration: 1400,
									easing: Easing.out(Easing.cubic),
									useNativeDriver: true,
								}),
							]),
							Animated.delay(1500),
							Animated.timing(slide, {
								toValue: 0,
								duration: 400,
								easing: Easing.in(Easing.cubic),
								useNativeDriver: true,
							}),
						]);
				animation.start(() => {
					setTier(null);
				});
			},
			[
				player,
				slide,
				sparkle,
				reducedOpacity,
				motionPolicy.reduceMotion,
			]
		);

		useImperativeHandle(ref, () => ({ fire }), [fire]);

		if (tier === null) return null;

		const translateY = slide.interpolate({
			inputRange: [0, 1],
			outputRange: [-200, 0],
		});
		const bannerOpacity = slide.interpolate({
			inputRange: [0, 0.3, 1],
			outputRange: [0, 1, 1],
		});

		// Six sparkle dots radiating outward + rotating.
		const sparkles = Array.from({ length: 6 }, (_, i) => {
			const angle = (i / 6) * Math.PI * 2;
			const dist = sparkle.interpolate({
				inputRange: [0, 1],
				outputRange: [0, 70],
			});
			const opacity = sparkle.interpolate({
				inputRange: [0, 0.15, 0.85, 1],
				outputRange: [0, 1, 1, 0],
			});
			const scale = sparkle.interpolate({
				inputRange: [0, 0.2, 1],
				outputRange: [0.3, 1.2, 0.4],
			});
			return (
				<Animated.Text
					key={i}
					style={[
						styles.sparkle,
						{
							opacity,
							transform: [
								{
									translateX: Animated.multiply(
										dist,
										new Animated.Value(Math.cos(angle))
									),
								},
								{
									translateY: Animated.multiply(
										dist,
										new Animated.Value(Math.sin(angle))
									),
								},
								{ scale },
							],
						},
					]}
				>
					✦
				</Animated.Text>
			);
		});

		return (
			<View pointerEvents="none" style={styles.absoluteRoot}>
				<Animated.View
					style={[
						styles.banner,
						motionPolicy.reduceMotion
							? { opacity: reducedOpacity }
							: {
									opacity: bannerOpacity,
									transform: [{ translateY }],
								},
					]}
				>
					{motionPolicy.allowDecorativeMotion && (
						<View style={styles.sparkleField}>{sparkles}</View>
					)}
					<Text style={styles.kicker}>SNOUT SEASON</Text>
					<Text style={styles.headline}>Tier {tier} Unlocked!</Text>
					<Text style={styles.sub}>New reward waiting below ↓</Text>
				</Animated.View>
			</View>
		);
	}
);

const styles = StyleSheet.create({
	absoluteRoot: {
		...StyleSheet.absoluteFillObject,
		alignItems: "center",
		justifyContent: "flex-start",
		paddingTop: 80,
	},
	banner: {
		backgroundColor: WHIMSY.lilac,
		borderRadius: 22,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		paddingHorizontal: 30,
		paddingVertical: 18,
		alignItems: "center",
		shadowColor: "#000",
		shadowOpacity: 0.18,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 8 },
		elevation: 12,
		minWidth: 280,
		position: "relative",
		overflow: "visible",
	},
	sparkleField: {
		position: "absolute",
		top: "50%",
		left: "50%",
		width: 0,
		height: 0,
	},
	sparkle: {
		position: "absolute",
		fontSize: 26,
		top: -13,
		left: -13,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 2,
		color: WHIMSY.ink,
		marginBottom: 4,
	},
	headline: {
		fontFamily: FONTS.display,
		fontSize: 26,
		color: WHIMSY.ink,
		marginBottom: 4,
	},
	sub: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
	},
});
