// Lucky Pig celebration modal — fires when the client rolls a hit on
// the 5% lucky trigger. Auto-plays a fanfare + auto-dismisses after a
// few seconds so the user can keep tickling without an extra tap.
//
// PLACEHOLDER ASSETS (swap when finals are ready):
//   - lucky_trumpet.mp3 — currently using existing claim.mp3 chime
//   - lucky_burst.png   — currently using sparkle emoji + idle pig sprite
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Animated,
	Pressable,
	Easing,
} from "react-native";
import Svg, { Polygon, Circle, G } from "react-native-svg";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { SpritePig } from "./ui/SpritePig";
import { Sticker } from "./ui/Sticker";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
	RADII,
} from "@/constants/theme";

// ── Lucky burst: 3 stacked animated layers ─────────────────────────
//   1. Sunburst rays (8 triangles) — slow rotation, hue gold
//   2. Pulsing aura ring — opacity + scale breathe
//   3. Sparkles — pop in/out + drift outward in a cycle

const BURST_SIZE = 220;
const BURST_CENTER = BURST_SIZE / 2;
const RAY_COUNT = 8;
const SPARKLE_POSITIONS = [
	// (angleDeg, radius) — placed around the pig, varied
	{ angle: 20,  r: 78, delay: 0    },
	{ angle: 75,  r: 95, delay: 200  },
	{ angle: 130, r: 70, delay: 400  },
	{ angle: 175, r: 100, delay: 100 },
	{ angle: 220, r: 80, delay: 350  },
	{ angle: 275, r: 92, delay: 500  },
	{ angle: 320, r: 75, delay: 150  },
];

function LuckyBurst({
	size = BURST_SIZE,
	phase,
}: {
	size?: number;
	// 'idle'   = pre-mount, everything collapsed/invisible
	// 'enter'  = beat 1, rays + aura burst out from zero (~400ms)
	// 'sustain' = beat 2, infinite loops run
	// 'outro'  = beat 3, everything fades out
	phase: "idle" | "enter" | "sustain" | "outro";
}) {
	const burstScale = useRef(new Animated.Value(0)).current;  // beat 1 + 3 — overall burst scale
	const rayRotation = useRef(new Animated.Value(0)).current;
	const auraPulse = useRef(new Animated.Value(0)).current;
	const fade = useRef(new Animated.Value(0)).current;        // 0 → invisible, 1 → fully visible
	const sparkles = useMemo(
		() => SPARKLE_POSITIONS.map(() => new Animated.Value(0)),
		[]
	);
	const loopHandles = useRef<Animated.CompositeAnimation[]>([]);

	useEffect(() => {
		if (phase === "idle") {
			burstScale.setValue(0);
			rayRotation.setValue(0);
			auraPulse.setValue(0);
			fade.setValue(0);
			sparkles.forEach((s) => s.setValue(0));
			return;
		}
		if (phase === "enter") {
			// Beat 1: burst scale springs from 0 → 1.18 (overshoot) → 1.0;
			// the underlying spring handles the overshoot naturally.
			Animated.parallel([
				Animated.spring(burstScale, {
					toValue: 1,
					tension: 90,
					friction: 5,
					useNativeDriver: true,
				}),
				Animated.timing(fade, {
					toValue: 1,
					duration: 250,
					useNativeDriver: true,
				}),
			]).start();
			return;
		}
		if (phase === "sustain") {
			// Beat 2: kick off the infinite loops.
			const rayLoop = Animated.loop(
				Animated.timing(rayRotation, {
					toValue: 1,
					duration: 6000,
					easing: Easing.linear,
					useNativeDriver: true,
				})
			);
			const auraLoop = Animated.loop(
				Animated.sequence([
					Animated.timing(auraPulse, {
						toValue: 1,
						duration: 900,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.timing(auraPulse, {
						toValue: 0,
						duration: 900,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: true,
					}),
				])
			);
			const sparkleLoops = SPARKLE_POSITIONS.map((p, i) =>
				Animated.loop(
					Animated.sequence([
						Animated.delay(p.delay),
						Animated.timing(sparkles[i], {
							toValue: 1,
							duration: 700,
							easing: Easing.out(Easing.quad),
							useNativeDriver: true,
						}),
						Animated.timing(sparkles[i], {
							toValue: 0,
							duration: 700,
							easing: Easing.in(Easing.quad),
							useNativeDriver: true,
						}),
					])
				)
			);
			loopHandles.current = [rayLoop, auraLoop, ...sparkleLoops];
			loopHandles.current.forEach((l) => l.start());
			return;
		}
		if (phase === "outro") {
			// Beat 3: stop the loops, fade everything down + shrink the burst.
			loopHandles.current.forEach((l) => l.stop());
			loopHandles.current = [];
			Animated.parallel([
				Animated.timing(fade, {
					toValue: 0,
					duration: 600,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(burstScale, {
					toValue: 0.85,
					duration: 600,
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				// Sparkles already in-flight should fade where they are.
				...sparkles.map((s) =>
					Animated.timing(s, {
						toValue: 0,
						duration: 400,
						useNativeDriver: true,
					})
				),
			]).start();
		}
	}, [phase, burstScale, rayRotation, auraPulse, fade, sparkles]);

	const rayRotateDeg = rayRotation.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});
	const auraScale = auraPulse.interpolate({
		inputRange: [0, 1],
		outputRange: [0.92, 1.12],
	});
	const auraOpacity = auraPulse.interpolate({
		inputRange: [0, 1],
		outputRange: [0.18, 0.42],
	});

	// Pre-compute ray triangles (long thin spokes from center)
	const rays = useMemo(() => {
		const out: string[] = [];
		for (let i = 0; i < RAY_COUNT; i++) {
			const angle = (i * 360) / RAY_COUNT;
			const rad = (angle * Math.PI) / 180;
			const rad2 = ((angle + 22) * Math.PI) / 180;
			const rad3 = ((angle - 22) * Math.PI) / 180;
			const r = BURST_CENTER * 0.95;
			const x1 = BURST_CENTER + Math.cos(rad) * r;
			const y1 = BURST_CENTER + Math.sin(rad) * r;
			const x2 = BURST_CENTER + Math.cos(rad2) * (r * 0.18);
			const y2 = BURST_CENTER + Math.sin(rad2) * (r * 0.18);
			const x3 = BURST_CENTER + Math.cos(rad3) * (r * 0.18);
			const y3 = BURST_CENTER + Math.sin(rad3) * (r * 0.18);
			out.push(
				`${x1},${y1} ${x2},${y2} ${BURST_CENTER},${BURST_CENTER} ${x3},${y3}`
			);
		}
		return out;
	}, []);

	return (
		<Animated.View
			style={[
				styles.burstWrap,
				{
					width: size,
					height: size,
					opacity: fade,
					transform: [{ scale: burstScale }],
				},
			]}
		>
			{/* Rays — slow rotation */}
			<Animated.View
				style={[
					StyleSheet.absoluteFill,
					{ transform: [{ rotate: rayRotateDeg }] },
				]}
			>
				<Svg width={size} height={size}>
					<G opacity={0.55}>
						{rays.map((pts, i) => (
							<Polygon
								key={i}
								points={pts}
								fill={i % 2 === 0 ? "#FFD96B" : "#FFB85A"}
							/>
						))}
					</G>
				</Svg>
			</Animated.View>

			{/* Pulsing aura ring */}
			<Animated.View
				style={[
					StyleSheet.absoluteFill,
					{
						opacity: auraOpacity,
						transform: [{ scale: auraScale }],
					},
				]}
			>
				<Svg width={size} height={size}>
					<Circle
						cx={BURST_CENTER}
						cy={BURST_CENTER}
						r={BURST_CENTER * 0.65}
						fill="#FFE08A"
					/>
				</Svg>
			</Animated.View>

			{/* Sparkles — each pops + drifts outward */}
			{SPARKLE_POSITIONS.map((p, i) => {
				const angleRad = (p.angle * Math.PI) / 180;
				const baseX = BURST_CENTER + Math.cos(angleRad) * p.r;
				const baseY = BURST_CENTER + Math.sin(angleRad) * p.r;
				const drift = sparkles[i].interpolate({
					inputRange: [0, 1],
					outputRange: [0, 12],
				});
				const scale = sparkles[i].interpolate({
					inputRange: [0, 0.4, 1],
					outputRange: [0, 1.1, 0.6],
				});
				return (
					<Animated.Text
						key={i}
						style={[
							styles.sparkleDot,
							{
								left: baseX - 12,
								top: baseY - 12,
								opacity: sparkles[i],
								transform: [
									{
										translateX: Animated.multiply(
											drift,
											Math.cos(angleRad)
										),
									},
									{
										translateY: Animated.multiply(
											drift,
											Math.sin(angleRad)
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
			})}
		</Animated.View>
	);
}

// Placeholder fanfare — replace with a proper trumpet stinger.
const fanfareSound = require("../assets/sounds/claim.mp3");

interface Props {
	visible: boolean;
	windowSize: number;       // e.g. 10 — the number of tickles this lucky window covers
	doublePercent: number;    // e.g. 30 — the % chance each tickle in the window doubles
	onDismiss: () => void;
}

export function LuckyPigModal({
	visible,
	windowSize,
	doublePercent,
	onDismiss,
}: Props) {
	const trumpet = useAudioPlayer(fanfareSound);
	const cardScale = useRef(new Animated.Value(0)).current;
	const pigDrop = useRef(new Animated.Value(0)).current;   // 0 = dropped above frame, 1 = settled
	const cardOpacity = useRef(new Animated.Value(0)).current; // outro fade
	const [phase, setPhase] = useState<"idle" | "enter" | "sustain" | "outro">("idle");
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

	// Phased timeline:
	//   t=0    beat 1 — burst pops, pig drops in, fanfare, haptic   (~400ms)
	//   t=400  beat 2 — sustain loops run (rays / aura / sparkles)  — stays here until user taps "View reward"
	//   on tap beat 3 — outro: shrink + fade                        (~600ms)
	//   then   dismiss callback fires → Barn handles next step (title unlock)
	useEffect(() => {
		if (!visible) {
			cardScale.setValue(0);
			pigDrop.setValue(0);
			cardOpacity.setValue(0);
			setPhase("idle");
			timers.current.forEach(clearTimeout);
			timers.current = [];
			return;
		}

		// Beat 1 kicks off immediately on visible.
		setPhase("enter");
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		try {
			trumpet.seekTo(0);
			trumpet.play();
		} catch {}
		Animated.parallel([
			Animated.spring(cardScale, {
				toValue: 1,
				tension: 80,
				friction: 6,
				useNativeDriver: true,
			}),
			Animated.timing(cardOpacity, {
				toValue: 1,
				duration: 220,
				useNativeDriver: true,
			}),
			// Pig drops in a hair after the card pops so the eye lands
			// on the burst expansion first, then the pig.
			Animated.sequence([
				Animated.delay(120),
				Animated.spring(pigDrop, {
					toValue: 1,
					tension: 70,
					friction: 7,
					useNativeDriver: true,
				}),
			]),
		]).start();

		// Hand off to sustain after beat 1 — no auto-outro/dismiss; the
		// user explicitly drives the next step via the View reward button.
		timers.current.push(setTimeout(() => setPhase("sustain"), 400));
		return () => {
			timers.current.forEach(clearTimeout);
			timers.current = [];
		};
	}, [visible, cardScale, cardOpacity, pigDrop, trumpet]);

	// Tapping "View reward" runs the outro animation, then calls
	// onDismiss so the parent can transition to the title-unlock modal.
	// onDismiss is fired by a timeout that runs in lockstep with the
	// outro (NOT the animation callback) — animation callbacks are
	// unreliable when a component unmounts mid-animation, which caused
	// the dismiss to silently no-op in early testing.
	const handleViewReward = () => {
		setPhase("outro");
		Animated.parallel([
			Animated.timing(cardScale, {
				toValue: 0.88,
				duration: 600,
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.timing(cardOpacity, {
				toValue: 0,
				duration: 600,
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
		timers.current.push(setTimeout(onDismiss, 600));
	};

	const pigTranslateY = pigDrop.interpolate({
		inputRange: [0, 1],
		outputRange: [-40, 0],
	});
	const pigScale = pigDrop.interpolate({
		inputRange: [0, 1],
		outputRange: [0.85, 1],
	});

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={() => {}}
		>
			<View style={styles.backdrop}>
				<Animated.View
					style={[
						styles.card,
						{ opacity: cardOpacity, transform: [{ scale: cardScale }] },
					]}
				>
					<Sticker color="sun" rotate={-2.5} radius={RADII.xxl} style={styles.sticker}>
						<Text style={styles.kicker}>★ lucky pig! ★</Text>
						<View style={styles.heroWrap}>
							{/* Animated burst: phased enter → sustain → outro
							    timeline driven by `phase`. */}
							<LuckyBurst size={220} phase={phase} />
							<Animated.View
								style={[
									styles.pigOverlay,
									{
										transform: [
											{ translateY: pigTranslateY },
											{ scale: pigScale },
										],
									},
								]}
							>
								<SpritePig animation="happy" size={140} />
							</Animated.View>
						</View>
						<Text style={styles.title}>You got the lucky pig!</Text>
						<Text style={styles.subtitle}>
							Your next {windowSize} tickles have a {doublePercent}% chance
							to be doubled.
						</Text>
						<Pressable
							onPress={handleViewReward}
							style={({ pressed }) => [
								styles.viewRewardBtn,
								pressed && { opacity: 0.7 },
							]}
						>
							<Text style={styles.viewRewardText}>View reward</Text>
						</Pressable>
					</Sticker>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 360,
	},
	sticker: {
		paddingHorizontal: 24,
		paddingVertical: 22,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 6,
	},
	heroWrap: {
		width: 220,
		height: 220,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 4,
	},
	burstWrap: {
		alignItems: "center",
		justifyContent: "center",
	},
	pigOverlay: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
	},
	sparkleDot: {
		position: "absolute",
		width: 24,
		height: 24,
		textAlign: "center",
		fontSize: 22,
		color: "#FFB000",
		textShadowColor: "rgba(255, 215, 0, 0.6)",
		textShadowOffset: { width: 0, height: 0 },
		textShadowRadius: 6,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 28,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 6,
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 22,
		marginBottom: 10,
	},
	viewRewardBtn: {
		marginTop: 6,
		paddingHorizontal: 24,
		paddingVertical: 11,
		borderRadius: 14,
		backgroundColor: WHIMSY.ink,
	},
	viewRewardText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.paper,
		letterSpacing: 0.4,
	},
});
