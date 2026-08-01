// Animated cosmetic renderer — turns a static sticker PNG into a living,
// "eye-popping" item using the per-item recipe from constants/cosmeticFx.ts.
// Members-only Slop Club cosmetics route through here; everything else keeps
// rendering as a plain <Image>, so there's zero cost for ordinary items.
//
// Layered back→front inside a square box of `size`:
//   1. glow   — a soft pulsing rarity-coloured halo behind the art
//   2. art     — the sticker itself, gently floating (bob)
//   3. shimmer — a white-tinted copy of the art blooming on a slow cycle
//                (a "catches the light" gleam)
//   4. sparkles — star sprites pinned to the art (jewels/peaks), twinkling
//
// Uses React Native's core Animated API (the repo idiom — see
// AnimatedBackground / SpritePig) with useNativeDriver everywhere, so the
// loops run off the JS thread and stay smooth under load. A truly directional
// glint sweep (masked to the sticker's alpha) needs @react-native-masked-view;
// until that native dep ships we approximate the gleam with the shimmer bloom.
import React, { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	StyleSheet,
	View,
	type ImageResizeMode,
	type ImageSourcePropType,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import type { CosmeticFx, SparkleSpec } from "@/constants/cosmeticFx";
import {
	startDecorativeLoop,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

const SPARKLE_SRC = require("../../assets/images/tickle-particles/sparkle.png");

// A seamless ping-pong loop 0→1→0 on a fresh Animated.Value. Returns the
// value plus a stop fn; callers wire the value into interpolations.
function usePingPong(period: number, easing = Easing.inOut(Easing.ease)) {
	const v = useRef(new Animated.Value(0)).current;
	const motionPolicy = useMotionPolicy();
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(v, {
					toValue: 1,
					duration: period / 2,
					easing,
					useNativeDriver: true,
				}),
				Animated.timing(v, {
					toValue: 0,
					duration: period / 2,
					easing,
					useNativeDriver: true,
				}),
			])
		);
		return startDecorativeLoop({
			policy: motionPolicy,
			animation: loop,
			rest: () => {
				v.stopAnimation();
				v.setValue(0);
			},
		});
	}, [v, period, easing, motionPolicy]);
	return v;
}

// One twinkling sparkle. Own Animated.Value so each can stagger via `delay`.
function Sparkle({ spec, box }: { spec: SparkleSpec; box: number }) {
	const v = useRef(new Animated.Value(0)).current;
	const size = ((spec.size ?? 14) * box) / 100;
	const motionPolicy = useMotionPolicy();
	useEffect(() => {
		if (!motionPolicy.allowDecorativeMotion) {
			v.setValue(0);
			return;
		}
		// twinkle: pop up, fade out, rest, repeat — offset by `delay`.
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(v, {
					toValue: 1,
					duration: 420,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(v, {
					toValue: 0,
					duration: 560,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.delay(900),
			])
		);
		const id = setTimeout(() => loop.start(), spec.delay ?? 0);
		return () => {
			clearTimeout(id);
			loop.stop();
			v.stopAnimation();
		};
	}, [motionPolicy.allowDecorativeMotion, v, spec.delay]);
	return (
		<Animated.Image
			source={SPARKLE_SRC}
			style={{
				position: "absolute",
				width: size,
				height: size,
				left: spec.x * box - size / 2,
				top: spec.y * box - size / 2,
				opacity: v,
				transform: [
					{
						scale: v.interpolate({
							inputRange: [0, 1],
							outputRange: [0.4, 1],
						}),
					},
					{
						rotate: v.interpolate({
							inputRange: [0, 1],
							outputRange: ["0deg", "35deg"],
						}),
					},
				],
			}}
		/>
	);
}

export interface AnimatedCosmeticProps {
	source: ImageSourcePropType;
	fx: CosmeticFx;
	size: number;
	resizeMode?: ImageResizeMode;
	style?: StyleProp<ViewStyle>;
}

export function AnimatedCosmetic({
	source,
	fx,
	size,
	resizeMode = "contain",
	style,
}: AnimatedCosmeticProps) {
	const floatAmp = ((fx.float?.amp ?? 0) * size) / 100;
	const floatV = usePingPong(fx.float?.period ?? 2600);
	const glowV = usePingPong(fx.glow?.period ?? 2800);

	// Shimmer: long rest, then a brief white bloom. Own value (not ping-pong)
	// so the hold dominates and the gleam reads as an occasional catch-light.
	const shimmerV = useRef(new Animated.Value(0)).current;
	const shimmerPeriod = fx.shimmer?.period ?? 3400;
	const motionPolicy = useMotionPolicy();
	useEffect(() => {
		if (!fx.shimmer || !motionPolicy.allowDecorativeMotion) {
			shimmerV.setValue(0);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.delay(shimmerPeriod * 0.62),
				Animated.timing(shimmerV, {
					toValue: 1,
					duration: shimmerPeriod * 0.13,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(shimmerV, {
					toValue: 0,
					duration: shimmerPeriod * 0.25,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
			])
		);
		loop.start();
		return () => {
			loop.stop();
			shimmerV.stopAnimation();
		};
	}, [
		shimmerV,
		shimmerPeriod,
		fx.shimmer,
		motionPolicy.allowDecorativeMotion,
	]);

	const translateY = floatV.interpolate({
		inputRange: [0, 1],
		outputRange: [floatAmp, -floatAmp],
	});

	return (
		<View
			pointerEvents="none"
			style={[{ width: size, height: size }, styles.box, style]}
		>
			{/* 1. glow halo */}
			{fx.glow && (
				<Animated.View
					style={{
						position: "absolute",
						width: size * 0.9,
						height: size * 0.9,
						left: size * 0.05,
						top: size * 0.08,
						borderRadius: size,
						backgroundColor: fx.glow.color ?? "#F5C44A",
						opacity: glowV.interpolate({
							inputRange: [0, 1],
							outputRange: [0.16, 0.4],
						}),
						transform: [
							{
								scale: glowV.interpolate({
									inputRange: [0, 1],
									outputRange: [0.86, 1.12],
								}),
							},
						],
					}}
				/>
			)}

			{/* sticker group (floats together so sparkles stay pinned to the art) */}
			<Animated.View
				style={[styles.fill, { transform: [{ translateY }] }]}
			>
				{/* 2. base art */}
				<Animated.Image
					source={source}
					resizeMode={resizeMode}
					style={styles.fill}
				/>
				{/* 3. shimmer bloom — white-tinted copy of the art */}
				{fx.shimmer && (
					<Animated.Image
						source={source}
						resizeMode={resizeMode}
						style={[
							styles.fill,
							{
								tintColor: "#FFFFFF",
								opacity: shimmerV.interpolate({
									inputRange: [0, 1],
									outputRange: [0, fx.shimmer.strength ?? 0.42],
								}),
							},
						]}
					/>
				)}
				{/* 4. sparkles */}
				{fx.sparkles?.map((spec, i) => (
					<Sparkle key={i} spec={spec} box={size} />
				))}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	box: { alignItems: "center", justifyContent: "center" },
	fill: { position: "absolute", width: "100%", height: "100%" },
});
