// The feedback nudge — a rare, cozy invitation to whisper an idea to the den.
// A SIBLING of SounderLaunchModal (same paper-sticker fill-the-quiet grammar),
// shown via the popup queue at the LOWEST priority so a real dialog AND the
// Sounder onboarding nudge both beat it. It's Rosie tilting her head and asking,
// never a review-prompt: the primary CTA routes to the same "send an idea to the
// den" whisper dialog the Account settings row opens; the two dismissals are a
// soft "not now" (14-day cooldown) and a quiet "don't ask again" (opt-out).
//
// Gating (rarity, the covenant made concrete) lives in utils/feedbackNudge.ts +
// the arming effect in app/_layout.tsx. This file is presentation only.
import { useEffect, useRef } from "react";
import {
	View,
	Text,
	Image,
	Pressable,
	Modal,
	Animated,
	StyleSheet,
	Dimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Icon } from "./ui/Icon";
import { Button } from "./ui/Button";
import { Sticker } from "./ui/Sticker";
import { WHIMSY, FONTS, RADII, SPACE, TYPE, MODAL_BACKDROP_BG } from "@/constants/theme";

// Rosie mid-surprise reads as a curious head-tilt — the exact "the bog's
// curious…" beat this nudge is going for.
const ROSIE = require("../assets/images/sprites/rosie/surprise_1.png");

const CARD_W = Math.min(340, Dimensions.get("window").width - 48);

interface Props {
	visible: boolean;
	/** Primary CTA — routes to the whisper dialog (Account, auto-opened). */
	onShare: () => void;
	/** Soft dismiss — "not now". Arms the 14-day cooldown. */
	onNotNow: () => void;
	/** Quiet opt-out — "don't ask again". Arms the permanent stamp. */
	onNever: () => void;
}

export function FeedbackNudgeModal({ visible, onShare, onNotNow, onNever }: Props) {
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!visible) return;
		anim.setValue(0);
		Animated.spring(anim, {
			toValue: 1,
			friction: 7,
			tension: 80,
			useNativeDriver: true,
		}).start();
		// A soft "success" beat, not an alert — this is an invitation.
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
	}, [visible, anim]);

	if (!visible) return null;

	const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

	return (
		// A soft dismiss maps to onNotNow — tapping the backdrop is "not now",
		// never the hard opt-out (that takes the explicit tertiary tap).
		<Modal visible transparent animationType="none" onRequestClose={onNotNow}>
			<View style={styles.backdrop}>
				<Pressable style={StyleSheet.absoluteFill} onPress={onNotNow} />
				<Animated.View
					style={[styles.animWrap, { opacity: anim, transform: [{ scale }] }]}
				>
					<Sticker color="paper" rotate={-0.8} radius={RADII.xxl} style={styles.card}>
						<Pressable
							onPress={onNotNow}
							hitSlop={10}
							style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
							accessibilityLabel="Close"
						>
							<Icon name="x" size={18} color={WHIMSY.mute} strokeWidth={2.5} />
						</Pressable>
						{/* Rosie tilting her head, curious — she does the asking. */}
						<View style={styles.heroScene}>
							<Animated.Image
								source={ROSIE}
								style={[
									styles.hero,
									{
										transform: [
											{
												rotate: anim.interpolate({
													inputRange: [0, 1],
													outputRange: ["-8deg", "0deg"],
												}),
											},
										],
									},
								]}
								resizeMode="contain"
							/>
						</View>
						<Text style={styles.title}>the bog's curious…</Text>
						<Text style={styles.body}>
							got an idea for the game, or something that's bugging you? rosie's
							all ears — whisper it and it lands straight in the den.
						</Text>

						<View style={styles.primaryWrap}>
							<Button size="md" variant="primary" full onPress={onShare}>
								share a thought
							</Button>
						</View>
						<Pressable
							onPress={onNotNow}
							hitSlop={8}
							style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
						>
							<Text style={styles.laterText}>not now</Text>
						</Pressable>
						{/* The quiet opt-out — set apart + fainter so it never competes
						    with "not now", but always there for the player who means it. */}
						<Pressable
							onPress={onNever}
							hitSlop={8}
							style={({ pressed }) => [styles.never, pressed && { opacity: 0.6 }]}
						>
							<Text style={styles.neverText}>don't ask again</Text>
						</Pressable>
					</Sticker>
				</Animated.View>
			</View>
		</Modal>
	);
}

const INK = WHIMSY.ink;
const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		alignItems: "center",
		justifyContent: "center",
		padding: SPACE.xl + 4,
	},
	// Mirrors SounderLaunchModal: the animated layer carries ONLY opacity+scale;
	// the inner Sticker draws the paper-craft fill/border/shadow so they stay
	// aligned inside the transform (iOS detaches shadows under a transform).
	animWrap: { width: CARD_W },
	card: {
		width: "100%",
		padding: SPACE.xl - 2,
		alignItems: "center",
	},
	closeBtn: {
		position: "absolute",
		top: 10,
		right: 12,
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
		zIndex: 3,
	},
	heroScene: {
		width: 110,
		height: 92,
		alignItems: "center",
		justifyContent: "center",
		marginBottom: SPACE.sm,
	},
	hero: { width: 88, height: 88 },
	title: {
		...TYPE.pageTitle,
		color: INK,
		textAlign: "center",
		marginBottom: SPACE.sm + 2,
	},
	body: {
		...TYPE.hand,
		fontSize: 16,
		lineHeight: 22,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: SPACE.lg,
	},
	primaryWrap: { alignSelf: "stretch" },
	later: { paddingVertical: SPACE.sm + 2, marginTop: SPACE.xs },
	laterText: { ...TYPE.hand, fontSize: 15, color: WHIMSY.mute },
	never: { paddingVertical: SPACE.xs },
	neverText: {
		...TYPE.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		opacity: 0.7,
		textDecorationLine: "underline",
	},
});
