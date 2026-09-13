// Mystery Hat Box reveal — the big two-beat unboxing staged after a
// claim_tier_reward response that carries a mystery-box grant
// (granted_hat_id, or fallback_snouts when the player owned every
// eligible hat). Beat 1: the closed box wobbles, begging to be tapped.
// Beat 2: the hat pops in over a rarity-tinted hero with a rarity
// tag + "wear it in the Closet" copy.
//
// Queue-slotted (id 'mysteryHat', priority 48 — after achievements/
// release notes, before the lucky-pig chain) and visible-driven per the
// PopupQueue contract: the scaffold's Modal stays mounted, `visible` comes
// from the slot, and dismiss is two-phase — release() hides the modal,
// the backing state clears a POPUP_TEARDOWN_MS beat later via onDone.
//
// PLACEHOLDER ASSET (matches LuckyPigModal): the reveal stinger reuses
// the claim.mp3 chime until a proper box-creak is authored.
import { useEffect, useRef, useState } from "react";
import {
	Animated,
	Easing,
	Image,
	Pressable,
	StyleSheet,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
	AdaptiveModalScaffold,
	Button,
	Glyph,
	Kicker,
	SnoutCoin,
	Sticker,
	T,
	Tag,
	usePopupSlot,
	POPUP_TEARDOWN_MS,
} from "./ui";
import { HAT_IMAGES } from "@/constants/hats";
import { POPUP_PRIORITIES } from "@/constants/popupPriorities";
import {
	ART_SIZE,
	BORDER,
	RARITY_BADGE,
	RARITY_BG_SOLID,
	RADII,
	SPACE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	MOTION_DURATION,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

const revealSound = require("../assets/sounds/claim.mp3");

// Drawing geometry for the ceremony. The hero is the stage the reward lands
// on; the box is the tappable lid before it opens. Sizes, not spacing steps.
const CARD_MAX_W = 360;
const HERO = 160;
const BOX_GLYPH = 120;

// The additive payload claim_tier_reward returns for mystery_box claims
// (20260631 migration). Exactly one of granted_hat_id / fallback_snouts
// is present.
export interface MysteryBoxRevealPayload {
	granted_hat_id?: string;
	granted_hat_name?: string;
	granted_hat_emoji?: string | null;
	granted_hat_rarity?: string;
	fallback_snouts?: number;
}

export function MysteryHatReveal({
	reveal,
	onDone,
}: {
	reveal: MysteryBoxRevealPayload | null;
	onDone: () => void;
}) {
	const slot = usePopupSlot(
		"mysteryHat",
		reveal != null,
		POPUP_PRIORITIES.mysteryHat
	);
	// 'box' = closed-box beat, waiting for the tap; 'open' = hat shown.
	const [phase, setPhase] = useState<"box" | "open">("box");
	const chime = useAudioPlayer(revealSound);
	const wobble = useRef(new Animated.Value(0)).current;
	const hatPop = useRef(new Animated.Value(0)).current;
	const wobbleLoop = useRef<Animated.CompositeAnimation | null>(null);
	const teardown = useRef<ReturnType<typeof setTimeout> | null>(null);
	const motionPolicy = useMotionPolicy();

	// Reset to the closed box whenever the modal isn't presented so a
	// re-present (queue churn) replays the full unboxing.
	useEffect(() => {
		if (slot.visible && motionPolicy.allowDecorativeMotion) {
			wobbleLoop.current = Animated.loop(
				Animated.sequence([
					Animated.timing(wobble, {
						toValue: 1,
						duration: 220,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.timing(wobble, {
						toValue: -1,
						duration: 440,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.timing(wobble, {
						toValue: 0,
						duration: 220,
						easing: Easing.inOut(Easing.quad),
						useNativeDriver: true,
					}),
					Animated.delay(600),
				])
			);
			wobbleLoop.current.start();
		} else {
			// Rest pose: the box sits square on the paper, the hat unpopped.
			wobbleLoop.current?.stop();
			wobbleLoop.current = null;
			wobble.setValue(0);
			hatPop.setValue(0);
			setPhase("box");
		}
	}, [slot.visible, wobble, hatPop, motionPolicy.allowDecorativeMotion]);

	useEffect(
		() => () => {
			if (teardown.current) clearTimeout(teardown.current);
		},
		[]
	);

	const handleOpen = () => {
		if (phase !== "box") return;
		setPhase("open");
		wobbleLoop.current?.stop();
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		try {
			chime.seekTo(0);
			chime.play();
		} catch {}
		const revealAnimation = motionPolicy.reduceMotion
			? Animated.timing(hatPop, {
					toValue: 1,
					duration: MOTION_DURATION.crossfade,
					useNativeDriver: true,
				})
			: Animated.spring(hatPop, {
					toValue: 1,
					tension: 80,
					friction: 6,
					useNativeDriver: true,
				});
		revealAnimation.start();
	};

	// Two-phase dismiss per the PopupQueue contract: hide now, clear the
	// backing state (the parent's reveal payload) a beat later.
	const handleDone = () => {
		slot.release();
		teardown.current = setTimeout(onDone, POPUP_TEARDOWN_MS);
	};

	const rarity = reveal?.granted_hat_rarity ?? "common";
	const badge = RARITY_BADGE[rarity] ?? RARITY_BADGE.common;
	const isFallback = !reveal?.granted_hat_id;
	const hatImage = reveal?.granted_hat_id
		? HAT_IMAGES[reveal.granted_hat_id]
		: undefined;

	const boxRotate = wobble.interpolate({
		inputRange: [-1, 1],
		outputRange: ["-7deg", "7deg"],
	});
	const hatScale = hatPop.interpolate({
		inputRange: [0, 1],
		outputRange: [0.4, 1],
	});

	return (
		<AdaptiveModalScaffold
			visible={slot.visible}
			onRequestClose={phase === "open" ? handleDone : handleOpen}
			bare
			maxWidth={CARD_MAX_W}
			contentContainerStyle={styles.content}
		>
			<Sticker color="lilac" rotate={-1.8} radius={RADII.xxl} style={styles.card}>
				<Kicker>mystery hat box ★</Kicker>

				{phase === "box" ? (
					<>
						<Pressable
							onPress={handleOpen}
							style={styles.boxTap}
							hitSlop={SPACE.md}
							accessibilityRole="button"
							accessibilityLabel="Open the mystery hat box"
							accessibilityHint="Reveals what the box was holding"
						>
							<Animated.View style={{ transform: [{ rotate: boxRotate }] }}>
								<Glyph name="gift" size={BOX_GLYPH} />
							</Animated.View>
						</Pressable>
						<T role="pageTitle" align="center" style={styles.title}>
							Something's rattling…
						</T>
						<T role="handLg" align="center" style={styles.subtitle}>
							Tap the box to open it.
						</T>
					</>
				) : (
					<>
						<Animated.View
							style={[
								styles.hero,
								{
									backgroundColor: isFallback
										? WHIMSY.paper
										: RARITY_BG_SOLID[rarity] ?? WHIMSY.paper,
									transform: [{ scale: hatScale }],
								},
							]}
						>
							{isFallback ? (
								<SnoutCoin size={COIN} />
							) : hatImage ? (
								<Image
									source={hatImage}
									style={styles.heroImage}
									resizeMode="contain"
								/>
							) : (
								<Glyph name="sparkle" size={ART_SIZE.portrait} />
							)}
						</Animated.View>

						{isFallback ? (
							<>
								<T role="pageTitle" align="center" style={styles.title}>
									+{reveal?.fallback_snouts ?? FALLBACK_SNOUTS} snouts!
								</T>
								<T role="handLg" align="center" style={styles.subtitle}>
									You already own every hat the box could hold — it
									spilled snouts instead.
								</T>
							</>
						) : (
							<>
								<T role="pageTitle" align="center" style={styles.title}>
									{reveal?.granted_hat_name ?? "A mystery hat"}
								</T>
								{/* Rarity tag — the paired fill + ink from RARITY_BADGE,
								    the one map whose contrast is validated [D-02]. */}
								<Tag
									label={rarity.toUpperCase()}
									ink={badge.ink}
									accessibilityLabel={`${rarity} rarity`}
									style={[styles.rarityTag, { backgroundColor: badge.bg }]}
								/>
								<T role="handLg" align="center" style={styles.subtitle}>
									It's yours — wear it in the Closet.
								</T>
							</>
						)}

						<Button
							variant="dark"
							size="md"
							onPress={handleDone}
							style={styles.done}
							accessibilityLabel="Oink"
							accessibilityHint="Closes the reveal"
						>
							Oink!
						</Button>
					</>
				)}
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

// The server's default spill when every eligible hat is already owned.
const FALLBACK_SNOUTS = 150;
// The coin that stands in for the hat on a fallback reveal.
const COIN = 96;

const styles = StyleSheet.create({
	content: {
		justifyContent: "center",
	},
	card: {
		width: "100%",
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
	},
	boxTap: {
		width: HERO,
		height: HERO,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xs,
	},
	hero: {
		width: HERO,
		height: HERO,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xs,
	},
	heroImage: {
		width: ART_SIZE.portrait,
		height: ART_SIZE.portrait,
	},
	title: {
		marginTop: SPACE.xs,
	},
	rarityTag: {
		marginTop: SPACE.sm,
	},
	subtitle: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	done: {
		marginTop: SPACE.md,
	},
});
