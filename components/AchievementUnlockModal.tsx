// Achievement reveal flow.
//
// Stage 1 (banner): a small slide-down banner on Barn announces a new
// unlock. User can dismiss or tap.
// Stage 2 (modal): tap → this modal opens. Top half shows the
// achievement (icon, name, description). Bottom half hidden behind a
// "View reward" CTA. Tap → rewards animate into view, one chip at a
// time. Final tap dismisses + marks viewed.
//
// Drives off `mark_achievement_viewed` to clear the unviewed state.
import React, { useEffect, useRef, useState } from "react";
import {
	Modal,
	View,
	Text,
	StyleSheet,
	Animated,
	Pressable,
	Easing,
	Image,
} from "react-native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { Sticker } from "./ui/Sticker";
import { SnoutCoin } from "./ui/SnoutCoin";
import { achievementIcon } from "../constants/emojiArt";
import { HAT_IMAGES } from "@/constants/hats";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

export interface UnlockedAchievement {
	id: string;
	name: string;
	description: string | null;
	icon: string | null;
	reward_title_id: string | null;
	reward_item_id: string | null;
	reward_snouts: number;
	level: number;
	is_top_tier: boolean;
}

interface Props {
	achievement: UnlockedAchievement | null;
	onDismiss: () => void;
}

export function AchievementUnlockModal({ achievement, onDismiss }: Props) {
	const [revealed, setRevealed] = useState(false);
	const cardScale = useRef(new Animated.Value(0)).current;
	const cardOpacity = useRef(new Animated.Value(0)).current;
	const rewardOpacity = useRef(new Animated.Value(0)).current;
	const rewardSlide = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!achievement) {
			cardScale.setValue(0);
			cardOpacity.setValue(0);
			rewardOpacity.setValue(0);
			rewardSlide.setValue(0);
			setRevealed(false);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.parallel([
			Animated.spring(cardScale, {
				toValue: 1,
				tension: 70,
				friction: 6,
				useNativeDriver: true,
			}),
			Animated.timing(cardOpacity, {
				toValue: 1,
				duration: 220,
				useNativeDriver: true,
			}),
		]).start();
	}, [achievement, cardScale, cardOpacity, rewardOpacity, rewardSlide]);

	const handleReveal = () => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		setRevealed(true);
		Animated.parallel([
			Animated.timing(rewardOpacity, {
				toValue: 1,
				duration: 450,
				easing: Easing.out(Easing.quad),
				useNativeDriver: true,
			}),
			Animated.spring(rewardSlide, {
				toValue: 1,
				tension: 60,
				friction: 7,
				useNativeDriver: true,
			}),
		]).start();
	};

	const handleClose = async () => {
		if (achievement) {
			try {
				await rpc("mark_achievement_viewed", {
					target_id: achievement.id,
				});
			} catch {}
		}
		onDismiss();
	};

	if (!achievement) return null;

	const itemImage = achievement.reward_item_id
		? HAT_IMAGES[achievement.reward_item_id]
		: null;

	const rewardTranslateY = rewardSlide.interpolate({
		inputRange: [0, 1],
		outputRange: [20, 0],
	});

	const levelTag = achievement.is_top_tier && achievement.level > 0
		? ` · L${achievement.level + 1}`
		: "";

	return (
		<Modal
			visible
			transparent
			animationType="fade"
			onRequestClose={handleClose}
		>
			<View style={styles.backdrop}>
				<Animated.View
					style={[
						styles.card,
						{ opacity: cardOpacity, transform: [{ scale: cardScale }] },
					]}
				>
					<Sticker color="sun" rotate={-1.4} radius={20} style={styles.sticker}>
						<Text style={styles.kicker}>★ achievement unlocked ★</Text>

						<View style={styles.iconBubble}>
							<Image
								source={achievementIcon(achievement.id)}
								style={styles.iconImg}
							/>
						</View>

						<Text style={styles.name}>
							{achievement.name}{levelTag}
						</Text>
						{!!achievement.description && (
							<Text style={styles.desc}>{achievement.description}</Text>
						)}

						{!revealed ? (
							<Pressable
								onPress={handleReveal}
								style={({ pressed }) => [
									styles.revealBtn,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.revealBtnText}>View reward</Text>
							</Pressable>
						) : (
							<Animated.View
								style={[
									styles.rewardWrap,
									{
										opacity: rewardOpacity,
										transform: [{ translateY: rewardTranslateY }],
									},
								]}
							>
								<Text style={styles.rewardLabel}>your reward</Text>
								<View style={styles.rewardChips}>
									{itemImage && (
										<View style={styles.rewardChipBig}>
											<Image source={itemImage} style={styles.rewardImg} resizeMode="contain" />
											<Text style={styles.rewardChipText}>
												{achievement.reward_item_id}
											</Text>
										</View>
									)}
									{!!achievement.reward_title_id && (
										<View style={styles.rewardChipBig}>
											<Text style={styles.titleGlyph}>"</Text>
											<Text style={styles.rewardChipText}>
												{achievement.name}
											</Text>
										</View>
									)}
									{achievement.reward_snouts > 0 && (
										<View style={styles.rewardChipBig}>
											<SnoutCoin size={22} />
											<Text style={styles.rewardChipText}>
												+{achievement.reward_snouts}
											</Text>
										</View>
									)}
								</View>
								<Pressable
									onPress={handleClose}
									style={({ pressed }) => [
										styles.dismissBtn,
										pressed && { opacity: 0.7 },
									]}
								>
									<Text style={styles.dismissBtnText}>Got it</Text>
								</Pressable>
							</Animated.View>
						)}
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
	card: { width: "100%", maxWidth: 360 },
	sticker: {
		paddingHorizontal: 22,
		paddingVertical: 22,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	kicker: { ...KICKER_TEXT, marginBottom: 12 },
	iconBubble: {
		width: 80,
		height: 80,
		borderRadius: 40,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		marginBottom: 12,
	},
	iconImg: { width: 52, height: 52, resizeMode: "contain" },
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	desc: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.ink,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 18,
		lineHeight: 20,
	},
	revealBtn: {
		paddingHorizontal: 28,
		paddingVertical: 12,
		borderRadius: 14,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	revealBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 18,
		color: WHIMSY.ink,
		letterSpacing: 0.4,
	},
	rewardWrap: { alignItems: "center", width: "100%" },
	rewardLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 1.5,
		textTransform: "uppercase",
		marginBottom: 10,
	},
	rewardChips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		justifyContent: "center",
		marginBottom: 16,
	},
	rewardChipBig: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		backgroundColor: WHIMSY.paper,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	rewardImg: { width: 32, height: 32 },
	titleGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
	},
	rewardChipText: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	dismissBtn: {
		paddingHorizontal: 22,
		paddingVertical: 10,
		borderRadius: 12,
		backgroundColor: WHIMSY.ink,
	},
	dismissBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.paper,
	},
});
