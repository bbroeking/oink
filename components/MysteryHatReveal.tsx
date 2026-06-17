// Mystery Hat Box reveal — the big two-beat unboxing staged after a
// claim_tier_reward response that carries a mystery-box grant
// (granted_hat_id, or fallback_snouts when the player owned every
// eligible hat). Beat 1: the closed box wobbles, begging to be tapped.
// Beat 2: the hat pops in over a rarity-tinted hero with a rarity
// stripe + "wear it in the Closet" copy.
//
// Queue-slotted (id 'mysteryHat', priority 48 — after achievements/
// release notes, before the lucky-pig chain) and visible-driven per the
// PopupQueue contract: the native Modal stays mounted, `visible` comes
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
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Glyph } from "./ui/Glyph";
import { SnoutCoin } from "./ui/SnoutCoin";
import { Sticker } from "./ui/Sticker";
import {
	usePopupSlot,
	POPUP_TEARDOWN_MS,
} from "./ui/PopupQueue";
import { HAT_IMAGES, RARITY_COLORS } from "@/constants/hats";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RARITY_BG_SOLID,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

const revealSound = require("../assets/sounds/claim.mp3");

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
	const slot = usePopupSlot("mysteryHat", reveal != null, 48);
	// 'box' = closed-box beat, waiting for the tap; 'open' = hat shown.
	const [phase, setPhase] = useState<"box" | "open">("box");
	const chime = useAudioPlayer(revealSound);
	const wobble = useRef(new Animated.Value(0)).current;
	const hatPop = useRef(new Animated.Value(0)).current;
	const wobbleLoop = useRef<Animated.CompositeAnimation | null>(null);
	const teardown = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Reset to the closed box whenever the modal isn't presented so a
	// re-present (queue churn) replays the full unboxing.
	useEffect(() => {
		if (slot.visible) {
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
			wobbleLoop.current?.stop();
			wobbleLoop.current = null;
			wobble.setValue(0);
			hatPop.setValue(0);
			setPhase("box");
		}
	}, [slot.visible, wobble, hatPop]);

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
		Animated.spring(hatPop, {
			toValue: 1,
			tension: 80,
			friction: 6,
			useNativeDriver: true,
		}).start();
	};

	// Two-phase dismiss per the PopupQueue contract: hide now, clear the
	// backing state (the parent's reveal payload) a beat later.
	const handleDone = () => {
		slot.release();
		teardown.current = setTimeout(onDone, POPUP_TEARDOWN_MS);
	};

	const rarity = reveal?.granted_hat_rarity ?? "common";
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
		<Modal
			visible={slot.visible}
			transparent
			animationType="fade"
			onRequestClose={phase === "open" ? handleDone : handleOpen}
		>
			<View style={styles.backdrop}>
				<Sticker color="lilac" rotate={-1.8} radius={20} style={styles.card}>
					<Text style={styles.kicker}>★ mystery hat box ★</Text>

					{phase === "box" ? (
						<>
							<Pressable onPress={handleOpen} style={styles.boxTap} hitSlop={12}>
								<Animated.View style={{ transform: [{ rotate: boxRotate }] }}>
									<Glyph name="gift" size={120} />
								</Animated.View>
							</Pressable>
							<Text style={styles.title}>Something's rattling…</Text>
							<Text style={styles.subtitle}>Tap the box to open it.</Text>
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
									<SnoutCoin size={96} />
								) : hatImage ? (
									<Image
										source={hatImage}
										style={styles.heroImage}
										resizeMode="contain"
									/>
								) : (
									<Text style={styles.heroEmoji}>✦</Text>
								)}
							</Animated.View>

							{isFallback ? (
								<>
									<Text style={styles.title}>
										+{reveal?.fallback_snouts ?? 150} snouts!
									</Text>
									<Text style={styles.subtitle}>
										You already own every hat the box could hold — it
										spilled snouts instead.
									</Text>
								</>
							) : (
								<>
									<Text style={styles.title}>
										{reveal?.granted_hat_name ?? "A mystery hat"}
									</Text>
									{/* Rarity stripe — the catalog's rarity color. */}
									<View
										style={[
											styles.rarityStripe,
											{
												backgroundColor:
													RARITY_COLORS[rarity] ?? RARITY_COLORS.common,
											},
										]}
									>
										<Text style={styles.rarityText}>{rarity}</Text>
									</View>
									<Text style={styles.subtitle}>
										It's yours — wear it in the Closet.
									</Text>
								</>
							)}

							<Pressable
								onPress={handleDone}
								style={({ pressed }) => [
									styles.doneBtn,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.doneText}>Oink!</Text>
							</Pressable>
						</>
					)}
				</Sticker>
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
		paddingHorizontal: 24,
		paddingVertical: 24,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 8,
	},
	boxTap: {
		width: 160,
		height: 160,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 6,
	},
	hero: {
		width: 160,
		height: 160,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 6,
	},
	heroImage: {
		width: 120,
		height: 120,
	},
	heroEmoji: {
		fontSize: 72,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 6,
	},
	rarityStripe: {
		marginTop: 8,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 3,
	},
	rarityText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.paper,
	},
	subtitle: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
		lineHeight: 22,
		marginTop: 8,
		marginBottom: 4,
	},
	doneBtn: {
		marginTop: 12,
		paddingHorizontal: 28,
		paddingVertical: 11,
		borderRadius: 14,
		backgroundColor: WHIMSY.ink,
	},
	doneText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.paper,
		letterSpacing: 0.4,
	},
});
