// Lucky Pig celebration modal — fires when the client rolls a hit on
// the 5% lucky trigger. Auto-plays a fanfare so the user can keep tickling
// after one tap.
//
// The celebration is still a dialog [D-07]: it mounts on
// AdaptiveModalScaffold with a visible close rail, `onRequestClose` wired to
// the same "keep for later" exit the secondary button takes, and a time-boxed
// `equipping` flag so a stalled equip RPC can never trap the player inside the
// confetti. It stays PopupQueue-slotted: `visible` comes from the slot and
// `onDismiss` runs the two-phase release.
//
// PLACEHOLDER ASSETS (swap when finals are ready):
//   - lucky_trumpet.mp3 — currently using existing claim.mp3 chime
//   - lucky_burst.png   — currently drawn as SVG rays + Glyph sparkles
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	Animated,
	Easing,
} from "react-native";
import Svg, { Polygon, Circle, G } from "react-native-svg";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Glyph,
	Kicker,
	PigRenderer,
	RIVE_PIG_SOURCE,
	Sticker,
	T,
} from "./ui";
import {
	BORDER,
	GRADIENT,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	MOTION_DURATION,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";
import type { TitleRow } from "@/constants/title_types";

// ── Lucky burst: 3 stacked animated layers ─────────────────────────
//   1. Sunburst rays (8 triangles) — slow rotation, hue gold
//   2. Pulsing aura ring — opacity + scale breathe
//   3. Sparkles — pop in/out + drift outward in a cycle

const BURST_SIZE = 220;
const BURST_CENTER = BURST_SIZE / 2;
const RAY_COUNT = 8;
// The burst's own palette: the gold ramp's two stops for the rays, its light
// stop for the aura disc. Drawing constants, read from the one gold ramp so a
// third gold can't appear here. [D-18]
const RAY_LIGHT = GRADIENT.gold[0];
const RAY_DEEP = GRADIENT.gold[1];
const AURA_FILL = WHIMSY.slopBand;
const RAY_OPACITY = 0.55;
const SPARKLE_SIZE = 24;
const SPARKLE_HALF = SPARKLE_SIZE / 2;
const SPARKLE_DRIFT = 12;
const PIG_HERO = 140;
const CARD_MAX_W = 360;
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
	const motionPolicy = useMotionPolicy();
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
			if (motionPolicy.reduceMotion) {
				burstScale.setValue(1);
				rayRotation.setValue(0);
				auraPulse.setValue(0.5);
				sparkles.forEach((sparkle) => sparkle.setValue(0.65));
				Animated.timing(fade, {
					toValue: 1,
					duration: MOTION_DURATION.crossfade,
					useNativeDriver: true,
				}).start();
				return;
			}
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
			if (!motionPolicy.allowDecorativeMotion) {
				// Rest pose: the burst holds open, mid-bloom, and stops moving.
				burstScale.setValue(1);
				rayRotation.setValue(0);
				auraPulse.setValue(0.5);
				fade.setValue(1);
				sparkles.forEach((sparkle) => sparkle.setValue(0.65));
				return;
			}
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
					duration: motionPolicy.duration(600),
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				Animated.timing(burstScale, {
					toValue: motionPolicy.reduceMotion ? 1 : 0.85,
					duration: motionPolicy.duration(600),
					easing: Easing.in(Easing.quad),
					useNativeDriver: true,
				}),
				// Sparkles already in-flight should fade where they are.
				...sparkles.map((s) =>
					Animated.timing(s, {
						toValue: 0,
						duration: motionPolicy.duration(400),
						useNativeDriver: true,
					})
				),
			]).start();
		}
	}, [
		phase,
		burstScale,
		rayRotation,
		auraPulse,
		fade,
		sparkles,
		motionPolicy,
	]);

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
					<G opacity={RAY_OPACITY}>
						{rays.map((pts, i) => (
							<Polygon
								key={i}
								points={pts}
								fill={i % 2 === 0 ? RAY_LIGHT : RAY_DEEP}
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
						fill={AURA_FILL}
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
					outputRange: [0, SPARKLE_DRIFT],
				});
				const scale = sparkles[i].interpolate({
					inputRange: [0, 0.4, 1],
					outputRange: [0, 1.1, 0.6],
				});
				return (
					<Animated.View
						key={i}
						style={[
							styles.sparkleDot,
							{
								left: baseX - SPARKLE_HALF,
								top: baseY - SPARKLE_HALF,
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
						<Glyph name="sparkle" size={SPARKLE_SIZE} />
					</Animated.View>
				);
			})}
		</Animated.View>
	);
}

// Placeholder fanfare — replace with a proper trumpet stinger.
const fanfareSound = require("../assets/sounds/claim.mp3");

// A stalled equip_title never holds the celebration hostage: past this the
// controls come back whether or not the RPC answered. [D-07]
const EQUIP_TIMEOUT_MS = 6000;

interface Props {
	visible: boolean;
	windowSize: number;       // e.g. 10 — the number of tickles this lucky window covers
	doublePercent: number;    // e.g. 30 — the % chance each tickle in the window doubles
	unlockedTitle: TitleRow | null;
	onEquipTitle: (id: string) => Promise<void>;
	onDismiss: () => void;
}

export function LuckyPigModal({
	visible,
	windowSize,
	doublePercent,
	unlockedTitle,
	onEquipTitle,
	onDismiss,
}: Props) {
	const trumpet = useAudioPlayer(fanfareSound);
	const cardScale = useRef(new Animated.Value(0)).current;
	const pigDrop = useRef(new Animated.Value(0)).current;   // 0 = dropped above frame, 1 = settled
	const cardOpacity = useRef(new Animated.Value(0)).current; // outro fade
	const [phase, setPhase] = useState<"idle" | "enter" | "sustain" | "outro">("idle");
	const [equipping, setEquipping] = useState(false);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
	const motionPolicy = useMotionPolicy();

	// Phased timeline:
	//   t=0    beat 1 — burst pops, pig drops in, fanfare, haptic   (~400ms)
	//   t=400  beat 2 — sustain loops run (rays / aura / sparkles)  — stays here until user taps "View reward"
	//   on tap beat 3 — outro: shrink + fade                        (~600ms)
	//   then   dismiss callback fires → Barn closes the single reward surface
	useEffect(() => {
		if (!visible) {
			cardScale.setValue(0);
			pigDrop.setValue(0);
			cardOpacity.setValue(0);
			setPhase("idle");
			setEquipping(false);
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
		if (motionPolicy.reduceMotion) {
			cardScale.setValue(1);
			pigDrop.setValue(1);
			Animated.timing(cardOpacity, {
				toValue: 1,
				duration: MOTION_DURATION.crossfade,
				useNativeDriver: true,
			}).start();
		} else {
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
		}

		// Hand off to sustain after beat 1 — no auto-outro/dismiss; the
		// user explicitly closes the reward via its primary action.
		timers.current.push(
			setTimeout(
				() => setPhase("sustain"),
				motionPolicy.duration(400, MOTION_DURATION.crossfade)
			)
		);
		return () => {
			timers.current.forEach(clearTimeout);
			timers.current = [];
		};
	}, [visible, cardScale, cardOpacity, pigDrop, trumpet, motionPolicy]);

	// The primary action optionally equips the inline title, runs the outro,
	// then calls onDismiss.
	// onDismiss is fired by a timeout that runs in lockstep with the
	// outro (NOT the animation callback) — animation callbacks are
	// unreliable when a component unmounts mid-animation, which caused
	// the dismiss to silently no-op in early testing.
	const handleViewReward = async (equipTitle = false) => {
		if (equipping) return;
		if (equipTitle && unlockedTitle) {
			setEquipping(true);
			// Time-boxed: a hung RPC releases the controls rather than
			// trapping the player in the celebration. [D-07]
			await Promise.race([
				onEquipTitle(unlockedTitle.id),
				new Promise<void>((resolve) =>
					setTimeout(resolve, EQUIP_TIMEOUT_MS)
				),
			]);
			setEquipping(false);
		}
		setPhase("outro");
		Animated.parallel([
			Animated.timing(cardScale, {
				toValue: motionPolicy.reduceMotion ? 1 : 0.88,
				duration: motionPolicy.duration(600),
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.timing(cardOpacity, {
				toValue: 0,
				duration: motionPolicy.duration(600),
				easing: Easing.in(Easing.quad),
				useNativeDriver: true,
			}),
		]).start();
		timers.current.push(setTimeout(onDismiss, motionPolicy.duration(600)));
	};

	// The escape hatch — the close rail, the hardware back and the "keep for
	// later" link all leave the same way: no equip, outro, dismiss. [D-07]
	const handleClose = () => {
		void handleViewReward(false);
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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={handleClose}
			bare
			maxWidth={CARD_MAX_W}
			contentContainerStyle={styles.content}
		>
			<Animated.View
				style={[
					styles.card,
					{ opacity: cardOpacity, transform: [{ scale: cardScale }] },
				]}
			>
				<Sticker color="sun" rotate={-2.5} radius={RADII.xxl} style={styles.sticker}>
					<DialogCloseRow
						label="Close the lucky pig"
						onPress={handleClose}
						style={styles.closeRow}
					/>
					<Kicker>lucky pig! ★</Kicker>
					<View style={styles.heroWrap}>
						{/* Animated burst: phased enter → sustain → outro
						    timeline driven by `phase`. */}
						<LuckyBurst size={BURST_SIZE} phase={phase} />
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
							<PigRenderer animation="idle" mood="happy" reaction={{ id: 1, kind: "jump" }} size={PIG_HERO} active={visible} renderer="rive" riveSource={RIVE_PIG_SOURCE} rolloutEnabled />
						</Animated.View>
					</View>
					<T role="pageTitle" align="center" style={styles.title}>
						You got the lucky pig!
					</T>
					<T role="handLg" align="center" style={styles.subtitle}>
						Your next {windowSize} tickles have a {doublePercent}% chance
						to be doubled.
					</T>
					{unlockedTitle && (
						<View style={styles.titleReward}>
							<T role="kickerPillSm" tone="secondary">bonus title</T>
							<T role="sectionTitle" style={styles.titleRewardName}>
								{unlockedTitle.name}
							</T>
							<T role="hand" tone="secondary">
								{unlockedTitle.placement === "pre"
									? "before your name"
									: "after your name"}
							</T>
						</View>
					)}
					<Button
						variant="dark"
						size="md"
						loading={equipping}
						onPress={() => handleViewReward(!!unlockedTitle)}
						style={styles.primary}
						accessibilityLabel={
							unlockedTitle
								? `Equip the title ${unlockedTitle.name}`
								: "Keep tickling"
						}
						accessibilityHint={
							unlockedTitle
								? "Wears the new title and closes the celebration"
								: "Closes the celebration"
						}
					>
						{unlockedTitle ? "Equip title" : "Keep tickling"}
					</Button>
					{unlockedTitle && (
						<Button
							variant="handLink"
							size="sm"
							disabled={equipping}
							onPress={handleClose}
							accessibilityLabel="Keep the title for later"
							accessibilityHint="Closes without wearing it; the title stays in Me"
						>
							Keep for later
						</Button>
					)}
				</Sticker>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

const styles = StyleSheet.create({
	content: {
		justifyContent: "center",
	},
	card: {
		width: "100%",
	},
	sticker: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
	},
	closeRow: {
		marginTop: -SPACE.lg,
		marginRight: -SPACE.lg,
		marginBottom: -SPACE.sm,
	},
	heroWrap: {
		width: BURST_SIZE,
		height: BURST_SIZE,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xs,
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
		width: SPARKLE_SIZE,
		height: SPARKLE_SIZE,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		marginTop: SPACE.xs,
		marginBottom: SPACE.xs,
	},
	subtitle: {
		marginBottom: SPACE.sm,
	},
	titleReward: {
		width: "100%",
		alignItems: "center",
		paddingVertical: SPACE.sm,
		marginBottom: SPACE.xs,
		borderTopWidth: BORDER.hair,
		borderBottomWidth: BORDER.hair,
		borderColor: UI_COLORS.uiMuted,
	},
	titleRewardName: {
		marginTop: SPACE.xxs,
	},
	primary: {
		marginTop: SPACE.xs,
	},
});
