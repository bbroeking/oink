import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	StyleSheet,
	Animated,
	Pressable,
	View,
	Image,
	Text,
	Easing,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES, HAT_REL } from "../constants/hats";
import { ANIM_SCALE } from "../constants/animScale.generated";
import type { RelSpec } from "../constants/hat_overlay_types";
import { PigAnimation, animDurationMs } from "./ui/SpritePig";

import { PigStage, resolveSlot, type EquippedItem } from "./ui/PigStage";
import { AnchorDebugOverlay, type DebugItem } from "./dev/AnchorDebugOverlay";

// To swap to <RivePig> once you have a Rive build:
//
//   1. Drop the exported pig.riv into assets/rive/
//   2. Rebuild the dev client so the rive-react-native native module
//      gets linked into the binary: `npx expo run:ios` (~10 min)
//   3. Import RivePig here and replace SpritePig in the render below
//
// Until step 2, importing RivePig at module level crashes because the
// native event emitter has no Objective-C side. Don't add the import
// until the dev-client rebuild is in.

interface SwipeElementProps {
	onLuckySwipe: () => void;
	hatId?: string | null;
	restingAnim?: PigAnimation;
	equipped?: EquippedItem | null;
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
	equippedFlag?: EquippedItem | null;
	canTickle?: boolean;
	playSixSeven?: number; // increment to re-trigger
}

const sixSevenSound = require("../assets/sounds/sixseven.m4a");

export default function SwipeElement({
	onLuckySwipe,
	hatId,
	restingAnim = "idle",
	equipped,
	equippedGlasses,
	equippedMask,
	equippedNeck,
	equippedAura,
	equippedBackground,
	equippedHeld,
	equippedFlag,
	canTickle = true,
	playSixSeven,
}: SwipeElementProps) {
	const sixSevenPlayer = useAudioPlayer(sixSevenSound);
	const scale = useRef(new Animated.Value(1)).current;
	const rotate = useRef(new Animated.Value(0)).current; // -1..1 -> -15..15deg
	const sixOpacity = useRef(new Animated.Value(0)).current;
	const sixY = useRef(new Animated.Value(0)).current;
	const sevenOpacity = useRef(new Animated.Value(0)).current;
	const sevenY = useRef(new Animated.Value(0)).current;
	const [pigAnim, setPigAnim] = useState<PigAnimation>("idle");
	const [pigFrameIdx, setPigFrameIdx] = useState(0);
	// Single source of truth for "what's playing": the active reaction (or the
	// 6-7 celebration), or null when Rosie is at her resting/mood pose. A tickle
	// CUTS whatever's playing and starts fresh; nothing else may change pigAnim
	// while a reaction is active. One revert timer, cleared on every cut.
	const activeReactionRef = useRef<PigAnimation | "sixseven" | null>(null);
	const revertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Latest mood pose, read by goToRest without closure staleness.
	const restingRef = useRef(restingAnim);
	restingRef.current = restingAnim;
	const clearRevert = () => {
		if (revertTimer.current) {
			clearTimeout(revertTimer.current);
			revertTimer.current = null;
		}
	};
	// A reaction finished (or was cut) → settle back to the mood pose.
	const goToRest = () => {
		clearRevert();
		activeReactionRef.current = null;
		setPigAnim(restingRef.current);
	};
	useEffect(() => clearRevert, []); // clear the timer on unmount
	// Mirror /item-anchor screen rel-placement overrides (dev-only).
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

	// Resting pose follows mood (happiness) — but NEVER while a reaction or the
	// 6-7 celebration is playing. (The old flash: `happy` doubles as a rest pose,
	// so a happy REACTION got yanked back to idle mid-play. activeReactionRef gates
	// it now.)
	useEffect(() => {
		if (activeReactionRef.current === null) setPigAnim(restingAnim);
	}, [restingAnim]);

	// Weighted reaction pool — jump is the default vibe, others are "spice".
	// 3/6 = 50% jump, 1/6 each of happy/surprise/wave.
	const REACTIONS: PigAnimation[] = [
		"jump",
		"jump",
		"jump",
		"happy",
		"surprise",
		"wave",
	];

	// Play one reaction + run the tickle. Cuts whatever's currently playing (a
	// tap always interrupts), then arms a single revert timer back to rest.
	const fireReaction = () => {
		if (canTickle) {
			const pick = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
			// CUT whatever's playing (clear its revert), then start the new one.
			clearRevert();
			activeReactionRef.current = pick;
			setPigAnim(pick);
			// One revert timer = both the natural exit AND the watchdog. loop:false
			// (jump/surprise) also exit early via onComplete; loop:true (happy/wave)
			// play exactly one full cycle then this fires. +120ms lets the final
			// frame settle before reverting.
			revertTimer.current = setTimeout(goToRest, animDurationMs(pick) + 120);
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
		Animated.sequence([
			Animated.timing(scale, {
				toValue: 0.94,
				duration: 70,
				useNativeDriver: true,
			}),
			Animated.spring(scale, {
				toValue: 1,
				friction: 4,
				useNativeDriver: true,
			}),
		]).start();

		// A tickle ALWAYS interrupts: cut whatever Rosie is doing and kick off a
		// fresh reaction. (The old path QUEUED the tap and replayed it once the
		// current reaction ended — those back-to-back replays were the other half
		// of the "flashing".)
		fireReaction();
	};

	// A loop:false reaction (jump / surprise) finished its single play → settle
	// back to rest. No-op if a tickle already cut to a new reaction: SpritePig
	// clears the old frame interval on the swap, so a cut anim's onComplete never
	// fires, and goToRest is idempotent anyway.
	const handleAnimComplete = () => {
		goToRest();
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
		clearRevert();
		activeReactionRef.current = "sixseven";
		setPigAnim("happy");

		try {
			sixSevenPlayer.seekTo(0);
			sixSevenPlayer.play();
		} catch {}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);

		Animated.sequence([
			// "6" — tilt left + 6 text
			Animated.parallel([tilt(-1), popText(sixOpacity, sixY)]),
			tilt(1),
			// "7" — tilt right + 7 text
			Animated.parallel([tilt(-1, 180), popText(sevenOpacity, sevenY)]),
			tilt(1, 180),
			tilt(0, 200),
		]).start(() => {
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
		return () => clearTimeout(safetyTimer);
	}, [playSixSeven, canTickle]);

	// Back-compat: callers can still pass hatId for the main slot.
	const mainEquipped: EquippedItem | null =
		equipped ??
		(hatId ? { id: hatId, category: "hat", emoji: null } : null);

	// resolveSlot lives in PigStage now (single source of truth shared
	// with the preview modal). SwipeElement still computes the main
	// slot once here because the AnchorDebugOverlay below + the
	// hideAccessory logic need the item id / image, and we want the
	// computation to match what PigStage will render.
	const main = resolveSlot(mainEquipped, pigAnim, pigFrameIdx, relOverrides);

	// Dev-only: feed the in-card anchor/placement overlay (see below).
	// Re-resolve aura + held here just for the debug overlay; PigStage
	// will resolve them again internally for rendering. Cheap (pure
	// function on cached refs) and keeps the debug visualization
	// consistent with what PigStage paints.
	const auraSlot = resolveSlot(equippedAura, pigAnim, pigFrameIdx, relOverrides);
	const heldSlot = resolveSlot(equippedHeld, pigAnim, pigFrameIdx, relOverrides);
	const debugItems: DebugItem[] = __DEV__
		? [main, auraSlot, heldSlot]
				.filter((s) => s && s.overlay)
				.map((s) => ({
					label: s!.itemId,
					category: s!.category,
					overlay: s!.overlay!,
				}))
		: [];

	const rotateDeg = rotate.interpolate({
		inputRange: [-1, 1],
		outputRange: ["-15deg", "15deg"],
	});

	return (
		<View style={styles.container}>
			<Pressable onPress={handlePress}>
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
										ANIM_SCALE[pigAnim] ?? 1
									),
								},
								{ rotate: rotateDeg },
							],
						},
					]}
				>
					<PigStage
						pigAnimation={pigAnim}
						pigFrameIdx={pigFrameIdx}
						onPigFrame={setPigFrameIdx}
						onPigComplete={
							pigAnim === "jump" || pigAnim === "surprise"
							? handleAnimComplete
							: undefined
						}
						equipped={mainEquipped}
						equippedGlasses={equippedGlasses}
						equippedMask={equippedMask}
						equippedNeck={equippedNeck}
						equippedAura={equippedAura}
						equippedHeld={equippedHeld}
						equippedFlag={equippedFlag}
						relOverrides={relOverrides}
					/>
				</Animated.View>
			</Pressable>

			<Animated.Text
				style={[
					styles.bigDigit,
					{ left: 40, opacity: sixOpacity, transform: [{ translateY: sixY }], pointerEvents: "none" },
				]}
			>
				6
			</Animated.Text>
			<Animated.Text
				style={[
					styles.bigDigit,
					{ right: 40, opacity: sevenOpacity, transform: [{ translateY: sevenY }], pointerEvents: "none" },
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
		marginVertical: 20,
	},
	card: {
		width: 300,
		height: 300,
		borderRadius: 15,
		backgroundColor: "transparent",
	},
	cardImage: {
		width: "100%",
		height: "100%",
		borderRadius: 15,
		// Don't clip — overlay items (hats, glasses) anchor to body parts
		// and may extend slightly past the 300×300 card edge during big
		// motions like jump. Clipping here was lopping off ear-tips and
		// the right side of monocle/wide hats.
	},
	cardImageStyle: {
		borderRadius: 15,
	},
	overlayBox: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
	},
	fillImage: {
		width: "100%",
		height: "100%",
	},
	emojiPlaceholder: {
		textAlign: "center",
	},
	bigDigit: {
		position: "absolute",
		bottom: 100,
		fontSize: 90,
		fontWeight: "900",
		color: "#fff",
		textShadowColor: "#D17C92",
		textShadowOffset: { width: 0, height: 4 },
		textShadowRadius: 0,
	},
});

