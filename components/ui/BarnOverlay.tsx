// Subtle full-screen decoration layered over the Barn. Pure RN Views
// (no image assets) so it stays cheap + tweakable. Two axes:
//
//   alignment  angel  → warm tint
//              goblin → gold coin piles + green tint
//              neutral→ nothing
//   scene      the merged ritual `SceneFx` — a wash, dusk, film grain, and
//              ambient fireflies (weekday rituals, 2026-09-14)
//
// The two axes are independent — you can be a neutral pig whose Barn is
// currently briny green. Blessings stay visible in the effect strip without
// recoloring the whole page.
//
// EVERY layer here is pointerEvents="none" and the root carries an explicit
// zIndex. A full-screen absolute layer on the new architecture that forgets
// either eats every tap in the Barn (the build-99 dead-Barn footgun).
import React, { useEffect, useRef } from "react";
import {
	Animated,
	Easing,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import type { AlignmentLabel } from "@/utils/alignment";
import { fxWash, hasSceneFx, type SceneFx } from "@/constants/ritualFx";
import { OPACITY, RADII, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";

interface Props {
	alignment: AlignmentLabel;
	/** @deprecated The boolean curse miasma is retired — a curse now draws the
	 *  scene its recipe asks for (`scene`). Still accepted as a NO-OP so a call
	 *  site that has not migrated keeps compiling. Remove once none remain. */
	cursed?: boolean;
	// The merged ritual scene (weekday rituals, 2026-09-14). Pickle Brine,
	// Golden Hour, Firefly Night and Old-Timey all land here.
	scene?: SceneFx;
}

// Layer order inside the overlay, back → front.
const SCENE_Z = { wash: 1, dusk: 2, grain: 3, particles: 4 } as const;

// Film grain (Old-Timey). A fixed scatter of tiny ink specks in percent
// coordinates, so one table tiles any screen and there is no image asset and no
// per-frame work. 36 Views, drawn once, never animated.
const GRAIN_SPECKS: { x: number; y: number; s: number; o: number }[] = [
	{ x: 4, y: 7, s: 2, o: 0.1 }, { x: 17, y: 3, s: 3, o: 0.07 },
	{ x: 29, y: 11, s: 2, o: 0.12 }, { x: 43, y: 5, s: 2, o: 0.08 },
	{ x: 58, y: 9, s: 3, o: 0.1 }, { x: 71, y: 2, s: 2, o: 0.06 },
	{ x: 86, y: 13, s: 2, o: 0.11 }, { x: 95, y: 6, s: 3, o: 0.08 },
	{ x: 9, y: 22, s: 3, o: 0.09 }, { x: 22, y: 27, s: 2, o: 0.12 },
	{ x: 37, y: 19, s: 2, o: 0.07 }, { x: 51, y: 25, s: 3, o: 0.1 },
	{ x: 64, y: 21, s: 2, o: 0.08 }, { x: 78, y: 29, s: 2, o: 0.11 },
	{ x: 91, y: 24, s: 3, o: 0.07 }, { x: 2, y: 38, s: 2, o: 0.1 },
	{ x: 15, y: 44, s: 3, o: 0.08 }, { x: 33, y: 41, s: 2, o: 0.12 },
	{ x: 47, y: 47, s: 2, o: 0.07 }, { x: 61, y: 39, s: 3, o: 0.09 },
	{ x: 74, y: 45, s: 2, o: 0.11 }, { x: 88, y: 42, s: 2, o: 0.08 },
	{ x: 6, y: 58, s: 3, o: 0.1 }, { x: 20, y: 63, s: 2, o: 0.07 },
	{ x: 35, y: 56, s: 2, o: 0.12 }, { x: 49, y: 61, s: 3, o: 0.08 },
	{ x: 67, y: 59, s: 2, o: 0.1 }, { x: 82, y: 65, s: 2, o: 0.09 },
	{ x: 96, y: 57, s: 3, o: 0.07 }, { x: 11, y: 77, s: 2, o: 0.11 },
	{ x: 26, y: 83, s: 3, o: 0.08 }, { x: 41, y: 74, s: 2, o: 0.1 },
	{ x: 55, y: 88, s: 2, o: 0.07 }, { x: 70, y: 79, s: 3, o: 0.12 },
	{ x: 84, y: 92, s: 2, o: 0.09 }, { x: 93, y: 84, s: 2, o: 0.08 },
];

// Fireflies (Firefly Night). Ten warm motes wandering the dark Barn. Each
// drifts on its own ping-pong loop with its own period + phase so the field
// never pulses in unison. Under Reduce Motion they hold one still frame.
const FIREFLIES: {
	x: number;
	y: number;
	size: number;
	dx: number;
	dy: number;
	period: number;
	delay: number;
}[] = [
	{ x: 12, y: 26, size: 5, dx: 16, dy: -12, period: 5200, delay: 0 },
	{ x: 27, y: 62, size: 4, dx: -14, dy: -18, period: 6400, delay: 700 },
	{ x: 41, y: 18, size: 6, dx: 12, dy: 16, period: 4800, delay: 1500 },
	{ x: 54, y: 71, size: 4, dx: 18, dy: -10, period: 7100, delay: 300 },
	{ x: 66, y: 34, size: 5, dx: -16, dy: 14, period: 5600, delay: 1900 },
	{ x: 78, y: 58, size: 4, dx: 10, dy: -16, period: 6800, delay: 1100 },
	{ x: 88, y: 22, size: 5, dx: -12, dy: 18, period: 5000, delay: 2300 },
	{ x: 19, y: 84, size: 4, dx: 14, dy: -14, period: 7400, delay: 1700 },
	{ x: 48, y: 46, size: 6, dx: -18, dy: -12, period: 5900, delay: 900 },
	{ x: 72, y: 88, size: 4, dx: 12, dy: 12, period: 6200, delay: 2600 },
];

export function BarnOverlay({ alignment, cursed: _cursed, scene }: Props) {
	const sceneOn = hasSceneFx(scene);
	if (alignment === "neutral" && !sceneOn) return null;

	return (
		<View style={styles.fill} pointerEvents="none">
			{alignment === "angel" && (
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
					testID="barn-overlay-angel"
				>
					<View style={[styles.tint, styles.angelTint]} />
				</View>
			)}

			{alignment === "goblin" && (
				<View
					style={StyleSheet.absoluteFill}
					pointerEvents="none"
					testID="barn-overlay-goblin"
				>
					<View style={[styles.tint, styles.goblinTint]} />
					<CoinPile style={{ bottom: 12, left: -10 }} />
					<CoinPile style={{ bottom: 8, right: -14 }} mirrored />
				</View>
			)}

			{sceneOn && <RitualScene scene={scene!} />}
		</View>
	);
}

// The ritual scene, back → front: wash, dusk, grain, particles.
function RitualScene({ scene }: { scene: SceneFx }) {
	return (
		<>
			{scene.tint !== undefined && (
				<View
					pointerEvents="none"
					testID="barn-scene-wash"
					style={[
						styles.tint,
						{
							zIndex: SCENE_Z.wash,
							backgroundColor: fxWash(scene.tint, scene.alpha ?? 0.24),
						},
					]}
				/>
			)}
			{scene.dusk && (
				// Evening on top of the wash: the same ink, a second time, so the
				// Barn reads as after-dark rather than merely tinted.
				<View
					pointerEvents="none"
					testID="barn-scene-dusk"
					style={[
						styles.tint,
						{ zIndex: SCENE_Z.dusk, backgroundColor: fxWash(WHIMSY.ink, 0.22) },
					]}
				/>
			)}
			{scene.grain && <SceneGrain />}
			{scene.particles === "fireflies" && <SceneFireflies />}
		</>
	);
}

function SceneGrain() {
	return (
		<View
			pointerEvents="none"
			testID="barn-scene-grain"
			style={[styles.tint, { zIndex: SCENE_Z.grain }]}
		>
			{GRAIN_SPECKS.map((speck, i) => (
				<View
					key={i}
					pointerEvents="none"
					style={{
						position: "absolute",
						left: `${speck.x}%`,
						top: `${speck.y}%`,
						width: speck.s,
						height: speck.s,
						borderRadius: RADII.pill,
						backgroundColor: WHIMSY.ink,
						opacity: speck.o,
					}}
				/>
			))}
		</View>
	);
}

function SceneFireflies() {
	return (
		<View
			pointerEvents="none"
			testID="barn-scene-fireflies"
			style={[styles.tint, { zIndex: SCENE_Z.particles }]}
		>
			{FIREFLIES.map((spec, i) => (
				<Firefly key={i} spec={spec} />
			))}
		</View>
	);
}

function Firefly({ spec }: { spec: (typeof FIREFLIES)[number] }) {
	const v = useRef(new Animated.Value(0)).current;
	const motionPolicy = useMotionPolicy();
	useEffect(() => {
		if (!motionPolicy.allowDecorativeMotion) {
			// One still frame, mid-drift: a Reduce Motion Barn shows a scattered
			// field of lit motes, not ten dots snapped to one corner.
			v.setValue(0.5);
			return;
		}
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(v, {
					toValue: 1,
					duration: spec.period / 2,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
				Animated.timing(v, {
					toValue: 0,
					duration: spec.period / 2,
					easing: Easing.inOut(Easing.ease),
					useNativeDriver: true,
				}),
			]),
		);
		const id = setTimeout(() => loop.start(), spec.delay);
		return () => {
			clearTimeout(id);
			loop.stop();
			v.stopAnimation();
		};
	}, [v, spec.period, spec.delay, motionPolicy.allowDecorativeMotion]);

	return (
		<Animated.View
			pointerEvents="none"
			testID="barn-scene-firefly"
			style={{
				position: "absolute",
				left: `${spec.x}%`,
				top: `${spec.y}%`,
				width: spec.size,
				height: spec.size,
				borderRadius: RADII.pill,
				backgroundColor: WHIMSY.sun,
				shadowColor: WHIMSY.sun,
				shadowOpacity: OPACITY.muted,
				shadowRadius: spec.size,
				shadowOffset: { width: 0, height: 0 },
				opacity: v.interpolate({
					inputRange: [0, 0.5, 1],
					outputRange: [OPACITY.ghost, 1, OPACITY.ghost],
				}),
				transform: [
					{
						translateX: v.interpolate({
							inputRange: [0, 1],
							outputRange: [0, spec.dx],
						}),
					},
					{
						translateY: v.interpolate({
							inputRange: [0, 1],
							outputRange: [0, spec.dy],
						}),
					},
				],
			}}
		/>
	);
}

function CoinPile({
	style,
	mirrored = false,
}: {
	style: StyleProp<ViewStyle>;
	mirrored?: boolean;
}) {
	return (
		<View
			style={[
				styles.coinWrap,
				style,
				mirrored && { transform: [{ scaleX: -1 }] },
			]}
		>
			<View style={[styles.coin, { bottom: 0, left: 0 }]} />
			<View style={[styles.coin, { bottom: 0, left: 26 }]} />
			<View style={[styles.coin, { bottom: 0, left: 52 }]} />
			<View style={[styles.coin, { bottom: 18, left: 13 }]} />
			<View style={[styles.coin, { bottom: 18, left: 39 }]} />
			<View style={[styles.coin, { bottom: 36, left: 26 }]} />
		</View>
	);
}

const styles = StyleSheet.create({
	fill: { ...StyleSheet.absoluteFill, zIndex: 1 },
	tint: { ...StyleSheet.absoluteFill },
	// Sanctioned scene-wash exception: these alignment washes are bespoke
	// low-opacity gold/green tints tuned to sit over the painted Barn, NOT
	// WHIMSY surface hues — they don't map to a palette token, so they stay as
	// raw rgba on purpose (not token leak). The RITUAL washes above do map to
	// tokens, and derive their rgba from one via `fxWash`.
	angelTint: { backgroundColor: "rgba(249,209,76,0.07)" },
	goblinTint: { backgroundColor: "rgba(123,162,102,0.10)" },
	coinWrap: { position: "absolute", width: 90, height: 60, opacity: 0.4 },
	coin: {
		position: "absolute",
		width: 30,
		height: 30,
		borderRadius: 15,
		backgroundColor: WHIMSY.goblin,
		borderWidth: 2,
		borderColor: "rgba(59,42,30,0.3)",
	},
});
