import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { Rarity } from "@/constants/hats";

interface Props {
	rarity?: Rarity;
	children: React.ReactNode;
	style?: StyleProp<ViewStyle>;
}

// Wraps a card thumb area with animated rarity decoration.
// - common / uncommon / rare: no animation, just children
// - epic: pulsing purple aura
// - legendary: diagonal shimmer sweep
export function RarityFx({ rarity = "common", children, style }: Props) {
	const pulse = useRef(new Animated.Value(0)).current;
	const shimmer = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (rarity === "epic") {
			Animated.loop(
				Animated.sequence([
					Animated.timing(pulse, {
						toValue: 1,
						duration: 1200,
						useNativeDriver: true,
					}),
					Animated.timing(pulse, {
						toValue: 0,
						duration: 1200,
						useNativeDriver: true,
					}),
				])
			).start();
		} else if (rarity === "legendary") {
			Animated.loop(
				Animated.sequence([
					Animated.timing(shimmer, {
						toValue: 1,
						duration: 1800,
						useNativeDriver: true,
					}),
					Animated.delay(1400),
				])
			).start();
		}
	}, [rarity, pulse, shimmer]);

	return (
		<View style={[styles.wrap, style]}>
			{rarity === "epic" && (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.epicAura,
						{
							opacity: pulse.interpolate({
								inputRange: [0, 1],
								outputRange: [0.2, 0.65],
							}),
							transform: [
								{
									scale: pulse.interpolate({
										inputRange: [0, 1],
										outputRange: [1, 1.06],
									}),
								},
							],
						},
					]}
				/>
			)}
			{children}
			{rarity === "legendary" && (
				<Animated.View
					pointerEvents="none"
					style={[
						styles.shimmerStrip,
						{
							transform: [
								{
									translateX: shimmer.interpolate({
										inputRange: [0, 1],
										outputRange: [-200, 200],
									}),
								},
								{ rotate: "20deg" },
							],
						},
					]}
				>
					<LinearGradient
						colors={[
							"rgba(255,255,255,0)",
							"rgba(255,255,255,0.55)",
							"rgba(255,255,255,0)",
						]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: "relative",
		overflow: "hidden",
	},
	epicAura: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "#9078FF",
		opacity: 0.3,
		zIndex: 0,
	},
	shimmerStrip: {
		position: "absolute",
		top: -50,
		left: 0,
		width: 60,
		height: 250,
		zIndex: 5,
	},
});
