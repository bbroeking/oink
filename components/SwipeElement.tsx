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
import {
	HAT_IMAGES,
	HAT_OVERLAYS,
	CATEGORY_OVERLAYS,
	DEFAULT_HAT_OVERLAY,
	Z_BEHIND_PIG,
	frameDelta,
	PigAnimationKey,
	HatOverlay,
} from "../constants/hats";
import { ITEM_PREBAKED, isPrebaked } from "../constants/prebaked";
import { SpritePig, PigAnimation } from "./ui/SpritePig";

// Dev tool: the /align screen writes per-item position + size + behind
// overrides into AsyncStorage. We mirror that into the live render so
// hand-tuning shows up in the actual app without a manual paste-to-source
// cycle. Reads on focus so navigating align → home picks up the changes
// immediately. Gated on __DEV__ — the override path is a no-op in
// release builds.
// Versioned to track global re-spotting passes — see align.tsx for the
// authoritative migration. Home may launch before /align is ever
// opened, so we replicate the same fallback chain here:
//   v3 = current      (post -6/-6 global shift)
//   v2 = pre v3 shift (post 360 → 300 canvas-shrink)
//   v1 = legacy       (360px canvas)
const ALIGN_OVERRIDES_KEY = "align_overrides_v3";
const ALIGN_OVERRIDES_KEY_V2 = "align_overrides_v2";
const ALIGN_OVERRIDES_KEY_V1 = "align_overrides_v1";

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

interface EquippedItem {
	id: string;
	category?: string | null;
	emoji?: string | null;
}

// Renders a single equipped item — the same JSX is used both BEHIND and
// IN FRONT of the pig, so it lives in one place. The `zIndex` decides
// stacking against the pig sprite when it's a sibling node.
function ItemOverlay({
	overlay,
	imageSrc,
	emoji,
	zIndex = 5,
}: {
	overlay: HatOverlay;
	imageSrc: number | null;
	emoji: string | null;
	zIndex?: number;
}) {
	return (
		<View style={[styles.overlayBox, overlay, { zIndex }]}>
			{imageSrc ? (
				<Image
					source={imageSrc}
					style={styles.fillImage}
					resizeMode="contain"
				/>
			) : emoji ? (
				<Text
					style={[
						styles.emojiPlaceholder,
						{
							fontSize:
								Math.min(overlay.width, overlay.height) * 0.7,
						},
					]}
				>
					{emoji}
				</Text>
			) : null}
		</View>
	);
}

interface SwipeElementProps {
	onLuckySwipe: () => void;
	hatId?: string | null;
	equipped?: EquippedItem | null;
	canTickle?: boolean;
	playSixSeven?: number; // increment to re-trigger
}

const sixSevenSound = require("../assets/sounds/sixseven.m4a");

export default function SwipeElement({
	onLuckySwipe,
	hatId,
	equipped,
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
	// Mirror /align screen overrides into live render (dev-only).
	const [alignOverrides, setAlignOverrides] = useState<
		Record<string, HatOverlay>
	>({});
	useFocusEffect(
		useCallback(() => {
			if (!__DEV__) return;
			(async () => {
				try {
					const v3 = await AsyncStorage.getItem(ALIGN_OVERRIDES_KEY);
					if (v3) {
						setAlignOverrides(JSON.parse(v3));
						return;
					}
					const v2 = await AsyncStorage.getItem(ALIGN_OVERRIDES_KEY_V2);
					if (v2) {
						setAlignOverrides(shiftDownLeft6(JSON.parse(v2)));
						return;
					}
					const v1 = await AsyncStorage.getItem(ALIGN_OVERRIDES_KEY_V1);
					if (!v1) return;
					setAlignOverrides(
						shiftDownLeft6(scaleByFiveSixths(JSON.parse(v1)))
					);
				} catch {}
			})();
		}, [])
	);

	useEffect(() => {
		if (!canTickle) setPigAnim("sad");
		else setPigAnim((a) => (a === "sad" ? "idle" : a));
	}, [canTickle]);

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

	const handlePress = () => {
		// Always give tactile press feedback — even if we're going to ignore
		// the tap because of an in-progress reaction.
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

		// Block taps while a reaction or 6-7 sequence is mid-play. The count
		// and the new animation hold until the pig is back in idle/sad.
		const reacting =
			pigAnim !== "idle" && pigAnim !== "sad";
		if (reacting) return;

		if (canTickle) {
			const pick = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
			setPigAnim(pick);
			// Single-frame reactions (happy/surprise/wave) don't auto-complete —
			// hold them briefly then revert. Jump auto-completes via onComplete.
			if (pick !== "jump") {
				setTimeout(() => {
					setPigAnim((cur) =>
						cur === pick ? (canTickle ? "idle" : "sad") : cur
					);
				}, 700);
			}
		}
		onLuckySwipe();
	};

	const handleJumpComplete = () => {
		if (canTickle) setPigAnim("idle");
	};

	// 6-7 bounce sequence triggered by playSixSeven counter changing.
	//
	// Race-safety with the random-reaction system:
	// - When 6-7 fires, we set pigAnim to "arms_up". If a `jump` was mid-flight,
	//   SpritePig's effect cleanup clears the old interval, and the deferred
	//   onComplete is gated on `pigAnim === "jump"` (via the prop swap below)
	//   so handleJumpComplete becomes a no-op.
	// - If 6-7 fires while a happy/surprise/wave is mid-700ms-hold, the
	//   trailing setTimeout uses a functional setState that checks
	//   `cur === pick` and no-ops when arms_up has overridden it.
	// Don't refactor either of these without preserving those guards.
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
		setPigAnim("arms_up");

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
			if (canTickle) setPigAnim("idle");
			else setPigAnim("sad");
		});
	}, [playSixSeven, canTickle]);

	const itemId = equipped?.id ?? hatId ?? null;
	const category = equipped?.category ?? (hatId ? "hat" : null);
	const emoji = equipped?.emoji ?? null;

	// Prebaked items render their bespoke "pig wearing X" frames inside
	// SpritePig and skip the compositional overlay entirely.
	const prebaked = isPrebaked(itemId) ? ITEM_PREBAKED[itemId!] : null;

	const imageSrc = itemId ? HAT_IMAGES[itemId] : null;
	// Precedence: align-screen override (dev only, AsyncStorage) → manual
	// HAT_OVERLAYS entry → category default → DEFAULT_HAT_OVERLAY. Mirrors
	// the chain in app/align.tsx so what you see while tuning matches the
	// live render.
	const baseOverlay = prebaked
		? null
		: (itemId && alignOverrides[itemId]) ||
			(itemId && HAT_OVERLAYS[itemId]) ||
			(category && CATEGORY_OVERLAYS[category]) ||
			(itemId ? DEFAULT_HAT_OVERLAY : null);

	// Per-frame anchor system: each item follows the body part its category
	// is bound to (hat→head, glasses→eyes, held→hand, etc.). The delta is
	// the displacement of that anchor from its rest position; we apply it
	// to the item's existing left/bottom. Backgrounds + auras span the
	// whole card so they don't track an anchor.
	const isFullCanvas = category === "background" || category === "aura";
	const delta = isFullCanvas
		? { dx: 0, dy: 0 }
		: frameDelta(
				pigAnim as PigAnimationKey,
				pigFrameIdx,
				category ?? null,
				baseOverlay?.anchor,
			);
	// dy is in screen-axis (positive = down); RN's `bottom` is anchored
	// to the canvas bottom (positive = up), so we negate to convert.
	const overlay = baseOverlay
		? isFullCanvas
			? baseOverlay
			: {
					...baseOverlay,
					left: baseOverlay.left + delta.dx,
					bottom: baseOverlay.bottom - delta.dy,
				}
		: null;

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
						{ transform: [{ scale }, { rotate: rotateDeg }] },
					]}
				>
					{/* Per-item override (HatOverlay.behind) wins over the
					    category default (Z_BEHIND_PIG). Backgrounds, auras,
					    and capes default to behind via category. */}
					{(() => {
						const isBehind =
							overlay?.behind ??
							(category ? !!Z_BEHIND_PIG[category] : false);
						return (
							<>
								{overlay && isBehind && (
									<ItemOverlay
										overlay={overlay}
										imageSrc={imageSrc}
										emoji={null}
										zIndex={1}
									/>
								)}
								<View style={[styles.cardImage, { zIndex: 2 }]}>
									<SpritePig
										animation={pigAnim}
										size={300}
										onFrame={setPigFrameIdx}
										onComplete={
											pigAnim === "jump" ? handleJumpComplete : undefined
										}
										customFrames={prebaked ?? undefined}
									/>
								</View>
								{overlay && !isBehind && (
									<ItemOverlay
										overlay={overlay}
										imageSrc={imageSrc}
										emoji={emoji}
										zIndex={10}
									/>
								)}
							</>
						);
					})()}
				</Animated.View>
			</Pressable>

			<Animated.Text
				pointerEvents="none"
				style={[
					styles.bigDigit,
					{ left: 40, opacity: sixOpacity, transform: [{ translateY: sixY }] },
				]}
			>
				6
			</Animated.Text>
			<Animated.Text
				pointerEvents="none"
				style={[
					styles.bigDigit,
					{ right: 40, opacity: sevenOpacity, transform: [{ translateY: sevenY }] },
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

// Read-path mirrors of the migration helpers in app/align.tsx. Used
// when the user launches into home before opening /align — we don't
// write back here (align.tsx owns the persisted migration), we just
// render the equivalent values.
function scaleByFiveSixths(
	src: Record<string, HatOverlay>
): Record<string, HatOverlay> {
	const SCALE = 300 / 360;
	return Object.fromEntries(
		Object.entries(src).map(([id, ov]) => [
			id,
			{
				...ov,
				bottom: Math.round((ov.bottom ?? 0) * SCALE),
				left: Math.round((ov.left ?? 0) * SCALE),
				width: Math.round((ov.width ?? 0) * SCALE),
				height: Math.round((ov.height ?? 0) * SCALE),
			},
		])
	);
}

function shiftDownLeft6(
	src: Record<string, HatOverlay>
): Record<string, HatOverlay> {
	return Object.fromEntries(
		Object.entries(src).map(([id, ov]) => [
			id,
			{
				...ov,
				left: Math.max(0, (ov.left ?? 0) - 6),
				bottom: Math.max(0, (ov.bottom ?? 0) - 6),
			},
		])
	);
}
