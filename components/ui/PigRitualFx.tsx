// The pig-side ritual primitives that need no art: the followers that tag
// along with Rosie (Cloud Nine's little cloud, Little Raincloud's drizzle), the
// bubbles of Bubble Bath, and the "hic!" bubble Hiccups pops.
//
// All PROCEDURAL — overlapping rounded Views in paper tokens, drawn inside the
// pig stage's 300×300 canvas in fractions of that box, so nothing here waits on
// the phase-3 art pass and nothing here ships a sprite. Reanimated is not used
// for the same reason PigStage and AnimatedCosmetic don't: the repo's animation
// idiom is React Native's core `Animated` with `useNativeDriver`, so these
// loops run off the JS thread beside the breath they ride on.
//
// Every layer is pointerEvents="none" with an explicit zIndex — the stage sits
// under the Barn's tap target and a decoration must never eat a tickle.
//
// Plan: docs/design/2026-09-14-weekday-rituals-plan.md
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import {
	BORDER,
	MOTION,
	OPACITY,
	RADII,
	SPACE,
	WHIMSY,
} from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { Sticker } from "./Sticker";
import { T } from "./Text";

// Z-order inside the pig stage. The pig itself is 5; a cloud UNDER her sits
// below it, a raincloud and her bubbles sit above.
export const PIG_FX_Z = { under: 4, over: 12, bubble: 13 } as const;

// ── Cloud Nine ──────────────────────────────────────────────────────────
// Three overlapping cream puffs on a capsule base, parked under the trotters.
// It does not animate on its own: the stage wrapper carries the float, so the
// cloud rises and settles WITH the pig instead of drifting out from under her.
function CloudUnder({ size }: { size: number }) {
	const w = size * 0.5;
	const h = size * 0.16;
	return (
		<View
			pointerEvents="none"
			testID="pig-fx-cloud-under"
			style={{
				position: "absolute",
				zIndex: PIG_FX_Z.under,
				left: (size - w) / 2,
				top: size * 0.8,
				width: w,
				height: h,
			}}
		>
			<View style={[styles.puff, { left: 0, top: h * 0.34, width: h * 0.8, height: h * 0.8 }]} />
			<View style={[styles.puff, { left: w * 0.22, top: 0, width: h, height: h }]} />
			<View style={[styles.puff, { left: w * 0.56, top: h * 0.2, width: h * 0.92, height: h * 0.92 }]} />
			<View
				style={[
					styles.puff,
					{ left: w * 0.06, top: h * 0.5, width: w * 0.88, height: h * 0.5 },
				]}
			/>
		</View>
	);
}

// ── Little Raincloud ────────────────────────────────────────────────────
// A grey cloud over the pig's head and four drops falling out of it, each on
// its own loop so the drizzle never falls in lockstep.
const RAIN_DROPS = [
	{ x: 0.2, delay: 0, period: 1100 },
	{ x: 0.42, delay: 380, period: 1300 },
	{ x: 0.62, delay: 760, period: 1000 },
	{ x: 0.8, delay: 220, period: 1200 },
];

function Raincloud({ size }: { size: number }) {
	const w = size * 0.46;
	const h = size * 0.15;
	const fall = size * 0.2;
	return (
		<View
			pointerEvents="none"
			testID="pig-fx-raincloud"
			style={{
				position: "absolute",
				zIndex: PIG_FX_Z.over,
				left: (size - w) / 2,
				top: size * 0.02,
				width: w,
				height: h + fall,
			}}
		>
			<View style={[styles.greyPuff, { left: 0, top: h * 0.32, width: h * 0.82, height: h * 0.82 }]} />
			<View style={[styles.greyPuff, { left: w * 0.24, top: 0, width: h, height: h }]} />
			<View style={[styles.greyPuff, { left: w * 0.58, top: h * 0.22, width: h * 0.88, height: h * 0.88 }]} />
			<View
				style={[
					styles.greyPuff,
					{ left: w * 0.06, top: h * 0.48, width: w * 0.88, height: h * 0.5 },
				]}
			/>
			{RAIN_DROPS.map((drop, i) => (
				<Raindrop
					key={i}
					left={w * drop.x}
					top={h * 0.92}
					size={Math.max(SPACE.xs, size * 0.018)}
					fall={fall}
					delay={drop.delay}
					period={drop.period}
				/>
			))}
		</View>
	);
}

function Raindrop({
	left,
	top,
	size,
	fall,
	delay,
	period,
}: {
	left: number;
	top: number;
	size: number;
	fall: number;
	delay: number;
	period: number;
}) {
	const v = useRef(new Animated.Value(0)).current;
	const { allowDecorativeMotion } = useMotionPolicy();
	useEffect(() => {
		if (!allowDecorativeMotion) {
			// The still frame keeps the drizzle legible: drops hang mid-fall.
			v.setValue(0.45);
			return;
		}
		const loop = Animated.loop(
			Animated.timing(v, {
				toValue: 1,
				duration: period,
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}),
		);
		const id = setTimeout(() => loop.start(), delay);
		return () => {
			clearTimeout(id);
			loop.stop();
			v.stopAnimation();
		};
	}, [v, period, delay, allowDecorativeMotion]);
	return (
		<Animated.View
			pointerEvents="none"
			testID="pig-fx-raindrop"
			style={{
				position: "absolute",
				left,
				top,
				width: size,
				height: size * 1.8,
				borderRadius: RADII.pill,
				backgroundColor: WHIMSY.sky,
				opacity: v.interpolate({
					inputRange: [0, 0.15, 0.8, 1],
					outputRange: [0, 1, 1, 0],
				}),
				transform: [
					{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, fall] }) },
				],
			}}
		/>
	);
}

export function PigFollower({
	kind,
	size,
}: {
	kind: "raincloud" | "cloud_under";
	size: number;
}) {
	return kind === "cloud_under" ? (
		<CloudUnder size={size} />
	) : (
		<Raincloud size={size} />
	);
}

// ── Bubble Bath ─────────────────────────────────────────────────────────
// Eight soap bubbles rising through the pig's art box and popping at the top.
const BUBBLES = [
	{ x: 0.24, size: 0.05, delay: 0, period: 3200 },
	{ x: 0.36, size: 0.036, delay: 540, period: 2700 },
	{ x: 0.48, size: 0.062, delay: 1100, period: 3600 },
	{ x: 0.6, size: 0.042, delay: 300, period: 2900 },
	{ x: 0.7, size: 0.054, delay: 1600, period: 3400 },
	{ x: 0.3, size: 0.03, delay: 2000, period: 2500 },
	{ x: 0.55, size: 0.034, delay: 800, period: 3000 },
	{ x: 0.78, size: 0.046, delay: 2400, period: 3300 },
];

export function PigBubbles({ size }: { size: number }) {
	return (
		<View
			pointerEvents="none"
			testID="pig-fx-bubbles"
			style={[StyleSheet.absoluteFill, { zIndex: PIG_FX_Z.over }]}
		>
			{BUBBLES.map((spec, i) => (
				<Bubble
					key={i}
					left={size * spec.x}
					diameter={size * spec.size}
					rise={size * 0.5}
					bottom={size * 0.22}
					delay={spec.delay}
					period={spec.period}
				/>
			))}
		</View>
	);
}

function Bubble({
	left,
	diameter,
	rise,
	bottom,
	delay,
	period,
}: {
	left: number;
	diameter: number;
	rise: number;
	bottom: number;
	delay: number;
	period: number;
}) {
	const v = useRef(new Animated.Value(0)).current;
	const { allowDecorativeMotion } = useMotionPolicy();
	useEffect(() => {
		if (!allowDecorativeMotion) {
			v.setValue(0.4);
			return;
		}
		const loop = Animated.loop(
			Animated.timing(v, {
				toValue: 1,
				duration: period,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
		);
		const id = setTimeout(() => loop.start(), delay);
		return () => {
			clearTimeout(id);
			loop.stop();
			v.stopAnimation();
		};
	}, [v, period, delay, allowDecorativeMotion]);
	return (
		<Animated.View
			pointerEvents="none"
			testID="pig-fx-bubble"
			style={{
				position: "absolute",
				left,
				bottom,
				width: diameter,
				height: diameter,
				borderRadius: RADII.pill,
				backgroundColor: WHIMSY.sky,
				borderWidth: BORDER.hair,
				borderColor: WHIMSY.paper,
				opacity: v.interpolate({
					inputRange: [0, 0.2, 0.75, 1],
					outputRange: [0, OPACITY.dim, OPACITY.ghost, 0],
				}),
				transform: [
					{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
					{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.08] }) },
				],
			}}
		/>
	);
}

// ── Hiccups ─────────────────────────────────────────────────────────────
// The bubble that pops beside the pig's head on each hop. A tiny Sticker, so
// it is the same paper-and-ink object as every other speech-ish chip in the
// app rather than a bespoke rounded View.
export const HIC_BUBBLE_MS = MOTION.beat - MOTION.tap * 2 + 40; // ~600ms

export function HicBubble({ size }: { size: number }) {
	return (
		<View
			pointerEvents="none"
			testID="pig-fx-hic"
			style={{
				position: "absolute",
				zIndex: PIG_FX_Z.bubble,
				left: size * 0.62,
				top: size * 0.14,
			}}
		>
			<Sticker color="paper" radius={RADII.md} rotate={-6} shadow="sm">
				<View style={styles.hicPad}>
					<T role="hand" tone="primary">
						hic!
					</T>
				</View>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	puff: {
		position: "absolute",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream2,
		borderWidth: BORDER.hair,
		borderColor: WHIMSY.cream,
	},
	greyPuff: {
		position: "absolute",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.muteSoft,
		borderWidth: BORDER.hair,
		borderColor: WHIMSY.mute,
	},
	hicPad: {
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xxs,
	},
});
