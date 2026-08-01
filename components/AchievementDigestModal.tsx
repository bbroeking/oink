// One launch interruption for every achievement earned while away.
// Full descriptions and collection history remain on the Achievements page;
// this digest acknowledges the batch and marks every row viewed together.
import React, { useEffect, useRef } from "react";
import {
	Animated,
	Image,
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { achievementIcon } from "@/constants/emojiArt";
import {
	FONTS,
	KICKER_TEXT,
	MODAL_BACKDROP_BG,
	RADII,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { DialogCloseRow } from "./ui/DialogCloseRow";
import { Sticker } from "./ui/Sticker";

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

export function achievementRewardSummary(
	achievement: UnlockedAchievement
): string | null {
	const rewards: string[] = [];
	if (achievement.reward_snouts > 0) {
		rewards.push(`${achievement.reward_snouts} snouts`);
	}
	if (achievement.reward_item_id) rewards.push("closet item");
	if (achievement.reward_title_id) rewards.push("title");
	return rewards.length > 0 ? rewards.join(" · ") : null;
}

export function AchievementDigestModal({
	achievements,
	visible,
	onDismiss,
}: {
	achievements: UnlockedAchievement[];
	visible: boolean;
	onDismiss: () => void;
}) {
	const opacity = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.96)).current;
	const dismissing = useRef(false);
	const motionPolicy = useMotionPolicy();

	useEffect(() => {
		if (!visible) {
			dismissing.current = false;
			opacity.setValue(0);
			scale.setValue(0.96);
			return;
		}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		Animated.parallel([
			Animated.timing(opacity, {
				toValue: 1,
				duration: motionPolicy.duration(220, MOTION_DURATION.crossfade),
				useNativeDriver: true,
			}),
			Animated.timing(scale, {
				toValue: 1,
				duration: motionPolicy.duration(220, MOTION_DURATION.crossfade),
				useNativeDriver: true,
			}),
		]).start();
	}, [visible, opacity, scale, motionPolicy]);

	const dismiss = () => {
		if (dismissing.current) return;
		dismissing.current = true;
		onDismiss();
		void Promise.all(
			achievements.map((achievement) =>
				rpc("mark_achievement_viewed", {
					target_id: achievement.id,
				}).catch(() => null)
			)
		);
	};

	if (achievements.length === 0) return null;

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={dismiss}
		>
			<View style={styles.backdrop}>
				<Animated.View
					style={[styles.card, { opacity, transform: [{ scale }] }]}
				>
					<Sticker
						color="sun"
						rotate={-1}
						radius={RADII.xxl}
						style={styles.sticker}
					>
						<DialogCloseRow
							label="Close achievement digest"
							onPress={dismiss}
							style={styles.closeRow}
						/>
						<Text style={styles.kicker}>★ achievements</Text>
						<Text style={styles.title}>
							{achievements.length === 1
								? "A new badge is yours"
								: `${achievements.length} new badges are yours`}
						</Text>
						<Text style={styles.body}>
							Everything is already saved. Here’s what landed.
						</Text>
						<ScrollView
							style={styles.list}
							contentContainerStyle={styles.listContent}
							showsVerticalScrollIndicator={false}
						>
							{achievements.map((achievement) => {
								const reward = achievementRewardSummary(achievement);
								const level =
									achievement.is_top_tier && achievement.level > 0
										? ` · L${achievement.level + 1}`
										: "";
								return (
									<View key={achievement.id} style={styles.row}>
										<Image
											source={achievementIcon(achievement.id)}
											style={styles.icon}
										/>
										<View style={styles.rowCopy}>
											<Text style={styles.name}>
												{achievement.name}
												{level}
											</Text>
											{reward && (
												<Text style={styles.reward}>
													{reward}
												</Text>
											)}
										</View>
									</View>
								);
							})}
						</ScrollView>
						<Pressable
							onPress={dismiss}
							style={({ pressed }) => [
								styles.doneButton,
								pressed && { opacity: 0.75 },
							]}
						>
							<Text style={styles.doneText}>Got it</Text>
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
		paddingHorizontal: 20,
		paddingVertical: 20,
		...STICKER_SHADOW,
	},
	closeRow: {
		marginTop: -12,
		marginRight: -12,
		marginBottom: -4,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 25,
		lineHeight: 30,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	body: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		lineHeight: 20,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 4,
	},
	list: {
		width: "100%",
		maxHeight: 238,
		marginTop: 14,
	},
	listContent: {
		gap: 2,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 9,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: WHIMSY.muteSoft,
	},
	icon: {
		width: 34,
		height: 34,
		resizeMode: "contain",
	},
	rowCopy: {
		flex: 1,
		minWidth: 0,
	},
	name: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	reward: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	doneButton: {
		alignSelf: "center",
		marginTop: 16,
		paddingHorizontal: 24,
		paddingVertical: 11,
		borderRadius: 14,
		backgroundColor: WHIMSY.ink,
	},
	doneText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.paper,
	},
});
