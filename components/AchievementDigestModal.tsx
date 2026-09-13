// One launch interruption for every achievement earned while away.
// Full descriptions and collection history remain on the Achievements page;
// this digest acknowledges the batch and marks every row viewed together.
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { rpc } from "@/utils/rpc";
import { achievementIcon } from "@/constants/emojiArt";
import { BORDER, RADII, SPACE, UI_COLORS } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Kicker,
	Sticker,
	T,
} from "./ui";

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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={dismiss}
			bare
			maxWidth={DIGEST_MAX_W}
			contentContainerStyle={styles.content}
		>
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
					<Kicker>achievements</Kicker>
					<T role="pageTitle" align="center">
						{achievements.length === 1
							? "A new badge is yours"
							: `${achievements.length} new badges are yours`}
					</T>
					<T role="hand" tone="secondary" align="center" style={styles.body}>
						Everything is already saved. Here’s what landed.
					</T>
					<View style={styles.list}>
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
										<T role="cardTitleSm">
											{achievement.name}
											{level}
										</T>
										{reward && (
											<T role="hand" tone="secondary">
												{reward}
											</T>
										)}
									</View>
								</View>
							);
						})}
					</View>
					<Button
						variant="dark"
						size="md"
						onPress={dismiss}
						style={styles.doneButton}
						accessibilityLabel="Got it"
						accessibilityHint="Closes the digest and marks every badge seen"
					>
						Got it
					</Button>
				</Sticker>
			</Animated.View>
		</AdaptiveModalScaffold>
	);
}

// The dialog's frame width — a measured card, not a spacing step.
const DIGEST_MAX_W = 360;
// The per-row badge art: bigger than a row glyph, smaller than detail art.
const ROW_ICON = 34;

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
	},
	closeRow: {
		marginTop: -SPACE.md,
		marginRight: -SPACE.md,
		marginBottom: -SPACE.xs,
	},
	body: {
		marginTop: SPACE.xs,
	},
	list: {
		width: "100%",
		marginTop: SPACE.card,
		gap: SPACE.xxs,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
		borderBottomWidth: BORDER.hair,
		borderBottomColor: UI_COLORS.uiMuted,
	},
	icon: {
		width: ROW_ICON,
		height: ROW_ICON,
		resizeMode: "contain",
	},
	rowCopy: {
		flex: 1,
		minWidth: 0,
	},
	doneButton: {
		alignSelf: "center",
		marginTop: SPACE.lg,
	},
});
