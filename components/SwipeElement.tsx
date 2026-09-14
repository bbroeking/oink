import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	StyleSheet,
	Animated,
	Pressable,
	View,
	Easing,
} from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { ANIM_SCALE } from "../constants/animScale.generated";
import type { RelSpec } from "../constants/hat_overlay_types";
import type { PigAnimation, PigMood, PigReaction, PigReactionKind } from "./ui/pigRendererContract";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { PigFx } from "@/constants/ritualFx";
import { ART_SIZE, FONTS, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { squashAndSpring } from "@/utils/motionRecipes";

import { PigStage, type EquippedItem } from "./ui/PigStage";
import { pigDefinition, type PigId } from "@/utils/pigs";

// PigStage owns renderer choice, appearance fallback, and reaction playback.
// This surface owns taps, haptics, sound, and the special 6–7 celebration.

interface SwipeElementProps {
	onLuckySwipe: () => void;
	active?: boolean;
	pigId?: PigId;
	restingAnim?: PigAnimation;
	equipped?: EquippedItem | null;
	equippedBow?: EquippedItem | null;
	equippedGlasses?: EquippedItem | null;
	equippedMask?: EquippedItem | null;
	equippedNeck?: EquippedItem | null;
	// Multi-slot equipment. `equipped` is the "main" slot (hat / scarf /
	// mask / etc.) and is rendered IN FRONT of the pig. Aura and
	// background each have their own slot and render BEHIND the pig:
	// background deepest, then aura, then pig, then equipped on top.
	// equippedHeld is a separate slot anchored to the right hand so a
	// held item can co-exist with a hat / glasses / etc.
	equippedAura?: EquippedItem | null;
	equippedBackground?: EquippedItem | null;
	equippedHeld?: EquippedItem | null;
	canTickle?: boolean;
	playSixSeven?: number; // increment to re-trigger
	prestigeLevel?: number;
	// The merged ritual pig channels (weekday rituals, 2026-09-14) — flip,
	// scale, float, hop, skin, forced cosmetics, follower, particles. Passed
	// straight through to PigStage, which owns every one of them so the
	// raster and Rive renderers inherit them alike.
	ritual?: PigFx;
}

const sixSevenSound = require("../assets/sounds/sixseven.m4a");

// The 6–7 celebration digits are ART, not type: 90pt is the size the Barn's
// best beat was tuned at, and TYPE's largest role (`hero`, 44) is half of it —
// so this is a named drawing constant with its reason attached rather than a
// bare literal or a role bent out of shape. The digits' resting offsets are the
// same kind of geometry. [E19] (2026-09-11)
const SIX_SEVEN_DIGIT_SIZE = 90;
const SIX_SEVEN_BOTTOM = 100;
const SIX_SEVEN_INSET = 40;

export default function SwipeElement({
	onLuckySwipe,
	active = true,
	pigId = "rosie",
	restingAnim = "idle",
	equipped,
	equippedBow,
	equippedGlasses,
	equippedMask,
	equippedNeck,
	equippedAura,
	equippedBackground,
	equippedHeld,
	canTickle = true,
	playSixSeven,
	prestigeLevel = 0,
	ritual,
}: SwipeElementProps) {
	const sixSevenPlayer = useAudioPlayer(sixSevenSound);
	const scale = useRef(new Animated.Value(1)).current;
	const rotate = useRef(new Animated.Value(0)).current; // -1..1 -> -15..15deg
	const sixOpacity = useRef(new Animated.Value(0)).current;
	const sixY = useRef(new Animated.Value(0)).current;
	const sevenOpacity = useRef(new Animated.Value(0)).current;
	const sevenY = useRef(new Animated.Value(0)).current;
	const motion = useMotionPolicy();
	const [riveActive, setRiveActive] = useState(false);
	const [reaction, setReaction] = useState<PigReaction | null>(null);
	const [sixSevenActive, setSixSevenActive] = useState(false);
	const reactionSequence = useRef(0);
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	const activeReactionRef = useRef<PigReactionKind | "sixseven" | null>(null);
	const restingMood: PigMood = restingAnim === "happy" || restingAnim === "sad" || restingAnim === "tired" ? restingAnim : "content";
	const pigAnim = sixSevenActive ? "happy" : reaction?.kind ?? restingAnim;
	const goToRest = () => {
		activeReactionRef.current = null;
		setSixSevenActive(false);
		setReaction(null);
	};
	// Mirror the placement studio's live rel-placement overrides (dev-only).
	const [relOverrides, setRelOverrides] = useState<
		Record<string, RelSpec>
	>({});
	useFocusEffect(
		useCallback(() => {
			if (!__DEV__) return;
			(async () => {
				try {
					const rel = await AsyncStorage.getItem("item_anchor_rel_v1");
					if (rel) setRelOverrides(JSON.parse(rel) as Record<string, RelSpec>);
				} catch {}
			})();
		}, [])
	);

	// Weighted reaction pool — jump is the default vibe, others are "spice".
	// 3/6 = 50% jump, 1/6 each of happy/surprise/wave.
	const REACTIONS: PigReactionKind[] = [
		"jump",
		"jump",
		"jump",
		"happy",
		"surprise",
		"wave",
	];

	// Sequence identity makes even consecutive identical taps interrupt immediately.
	const fireReaction = () => {
		if (canTickle) {
			const kind = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
			activeReactionRef.current = kind;
			setSixSevenActive(false);
			rotate.stopAnimation();
			rotate.setValue(0);
			setReaction({ id: ++reactionSequence.current, kind });
		}
		onLuckySwipe();
	};

	const handlePress = () => {
		// Always give tactile press feedback + the squish, even when the tap is
		// going to be queued behind an in-progress reaction.
		Haptics.impactAsync(
			canTickle
				? Haptics.ImpactFeedbackStyle.Light
				: Haptics.ImpactFeedbackStyle.Soft
		).catch(() => {});
		// Rosie's press now lives in `squashAndSpring` — the recipe every other
		// press in the app is matched to, policy and all. Reduce Motion is
		// handled inside it (rest pose), so the only gate left here is the one
		// this surface owns: Rive drives its own press.
		if (!riveActive) squashAndSpring(scale, motion).start();

		// A tickle ALWAYS interrupts: cut whatever Rosie is doing and kick off a
		// fresh reaction. (The old path QUEUED the tap and replayed it once the
		// current reaction ended — those back-to-back replays were the other half
		// of the "flashing".)
		fireReaction();
	};

	// 6-7 bounce sequence triggered by playSixSeven counter changing.
	//
	// Race-safety with the random-reaction system:
	// 6-7 registers as activeReactionRef="sixseven" (so the mood effect won't yank
	// it) and clears any in-flight reaction's revert timer. A tickle mid-6-7 cuts
	// it like any reaction; the 6-7's own revert is guarded on the ref still being
	// "sixseven", so it no-ops if a tickle already took over.
	useEffect(() => {
		if (!playSixSeven) return;
		const tilt = (val: number, dur = 200) =>
			Animated.timing(rotate, {
				toValue: val,
				duration: dur,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			});
		const popText = (
			op: Animated.Value,
			y: Animated.Value
		) =>
			Animated.parallel([
				Animated.sequence([
					Animated.timing(op, { toValue: 1, duration: 120, useNativeDriver: true }),
					Animated.delay(420),
					Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: true }),
				]),
				Animated.timing(y, {
					toValue: -90,
					duration: 760,
					easing: Easing.out(Easing.quad),
					useNativeDriver: true,
				}),
			]);

		// Reset
		sixOpacity.setValue(0);
		sevenOpacity.setValue(0);
		sixY.setValue(0);
		sevenY.setValue(0);
		// The 6-7 is a special celebration reaction — register it so the mood
		// effect won't yank it and so a tickle can cut it like any other.
		activeReactionRef.current = "sixseven";
		setReaction(null);
		setSixSevenActive(true);

		try {
			sixSevenPlayer.seekTo(0);
			sixSevenPlayer.play();
		} catch {}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);

		if (motion.reduceMotion) { goToRest(); return; }
		const celebration = Animated.sequence([
			// "6" — tilt left + 6 text
			Animated.parallel([tilt(-1), popText(sixOpacity, sixY)]),
			tilt(1),
			// "7" — tilt right + 7 text
			Animated.parallel([tilt(-1, 180), popText(sevenOpacity, sevenY)]),
			tilt(1, 180),
			tilt(0, 200),
		]);
		celebration.start(() => {
			// Revert only if the 6-7 is still the active reaction (a tickle may
			// have already cut it to a new one).
			if (activeReactionRef.current === "sixseven") goToRest();
		});

		// Safety reset — if the .start() callback never fires (component
		// unmount mid-animation, state interrupted by another setPigAnim
		// upstream, native driver hiccup), pigAnim could stay at "happy"
		// forever and `handlePress` would silently block every future tap
		// (the `reacting` check above filters anything not idle/sad). A
		// TestFlight report after build 70 had exactly this symptom — "ran
		// fast then closed out, now I can't tickle." 3s is the full 6-7
		// sequence (~2.1s) + a buffer; if pigAnim is STILL "happy" by then,
		// force it back to idle/sad regardless of canTickle's current value.
		const safetyTimer = setTimeout(() => {
			if (activeReactionRef.current === "sixseven") goToRest();
		}, 3000);
		return () => { clearTimeout(safetyTimer); celebration.stop(); };
	}, [playSixSeven, motion.reduceMotion]);

	// resolveSlot lives in PigStage now — the single source of truth shared with
	// the preview modal — so this surface no longer resolves slots at all. The
	// four re-resolutions that used to live here fed an in-card
	// `AnchorDebugOverlay` that was retired with the old item-anchor tools;
	// placement now belongs to tools/placement_studio.py. (2026-09-11)
	const mainEquipped: EquippedItem | null = equipped ?? null;

	const rotateDeg = rotate.interpolate({
		inputRange: [-1, 1],
		outputRange: ["-15deg", "15deg"],
	});
	const pigName = pigDefinition(pigId).name;

	return (
		<View style={styles.container}>
			<Pressable
				onPress={handlePress}
				accessibilityRole="button"
				accessibilityLabel={`Tickle ${pigName}`}
				accessibilityHint={
					canTickle
						? `Makes ${pigName} react and earns a heart.`
						: "Your tickle bank is empty. Activating explains when the next tickle is ready."
				}
				accessibilityState={{ disabled: false }}
			>
				<Animated.View
					style={[
						styles.card,
						{
							transform: [
								// surprise + wave read better when the pig is a touch
								// larger — surprise is a face-camera "!" reaction and
								// wave puts the pig on its hind legs, both benefit
								// from a small upscale. Multiplied into the
								// press-scale animation so the tap squish still plays.
								{
									scale: Animated.multiply(
										scale,
										motion.reduceMotion || riveActive ? 1 : ANIM_SCALE[pigAnim] ?? 1
									),
								},
								{ rotate: motion.reduceMotion || riveActive ? "0deg" : rotateDeg },
							],
						},
					]}
				>
					<PigStage
						active={active}
						pigId={pigId}
						pigAnimation={sixSevenActive ? "bounce" : "idle"}
						onRendererChange={(kind) => setRiveActive(kind === "rive")}
						pigMood={restingMood}
						pigReaction={reaction}
						pigFrameIdx={pigFrameIdx}
						onPigFrame={setPigFrameIdx}
						onPigComplete={() => {
							if (activeReactionRef.current !== "sixseven") goToRest();
						}}
						equipped={mainEquipped}
						equippedBow={equippedBow}
						equippedGlasses={equippedGlasses}
						equippedMask={equippedMask}
						equippedNeck={equippedNeck}
						equippedAura={equippedAura}
						equippedHeld={equippedHeld}
						relOverrides={relOverrides}
						prestigeLevel={prestigeLevel}
						ritual={ritual}
					/>
				</Animated.View>
			</Pressable>

			<Animated.Text
				style={[
					styles.bigDigit,
					{ left: SIX_SEVEN_INSET, opacity: sixOpacity, transform: [{ translateY: sixY }], pointerEvents: "none" },
				]}
			>
				6
			</Animated.Text>
			<Animated.Text
				style={[
					styles.bigDigit,
					{ right: SIX_SEVEN_INSET, opacity: sevenOpacity, transform: [{ translateY: sevenY }], pointerEvents: "none" },
				]}
			>
				7
			</Animated.Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xl,
	},
	// The pig's stage. Deliberately unclipped — overlay items (hats, glasses)
	// anchor to body parts and may extend past the card edge during big motions
	// like jump; clipping lopped off ear-tips and wide hats.
	card: {
		width: ART_SIZE.stage,
		height: ART_SIZE.stage,
		borderRadius: RADII.lg,
		backgroundColor: "transparent",
	},
	// Caprasimo at 90 reads heavier and more hand-made than the system Black it
	// replaced, and the celebration now uses the palette it lives in. [E19]
	bigDigit: {
		position: "absolute",
		bottom: SIX_SEVEN_BOTTOM,
		fontFamily: FONTS.whimsy,
		fontSize: SIX_SEVEN_DIGIT_SIZE,
		color: WHIMSY.paper,
		textShadowColor: WHIMSY.roseDeep,
		textShadowOffset: { width: 0, height: SPACE.xs },
		textShadowRadius: 0,
	},
});
