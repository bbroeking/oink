// The season-end reveal — a 3-beat storybook recap thanking the beta's
// Founding Herd: the season settles → what you earned → the Hungerer stirs
// (the Season-2 teaser). Follows the full-screen season-moment pattern
// (GreatHungerIntroModal / JudgementDayModal): fade Modal, per-beat scene
// crossfade, sticker story card, dots, one advancing Button.
//
// Shown by app/(tabs)/season.tsx when useSeasonEnd() says the moment is
// live (season1_finale flag + an unseen my_beta_reward grant). Copy per
// tier comes from utils/betaRewards (mirrors the server announcement).

import { useCallback, useMemo, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	ImageBackground,
	Image,
	type ImageSourcePropType,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Button } from "./ui";
import { Glyph, type GlyphName } from "./ui/Glyph";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import { BETA_TIER_LINE, type BetaTier } from "@/utils/betaRewards";
import type { BetaReward } from "@/hooks/useSeasonEnd";

const PIG = require("../assets/images/pig.png");

// Dev-preview stand-in so the __DEV__ chip can show the full flow without a
// server grant (mirrors a top-3 outcome).
export const DEV_PREVIEW_REWARD: BetaReward = {
	rank: 2,
	tier: "bog_royalty",
	titleName: "Bog Royalty",
	snouts: 750,
};

type Beat = {
	key: string;
	bg: ImageSourcePropType;
	kicker: string;
	line: string;
	heroTint?: string;
	heroScale: number;
	cta?: string;
	rewards?: boolean; // beat 2 renders the earned-chips strip
};

function beatsFor(tier: BetaTier): Beat[] {
	return [
		{
			key: "settled",
			bg: require("../assets/images/backgrounds/golden_mire_bg.png"),
			kicker: "the season settles",
			line: "The first season is done. Before the gates open to the world — a word for the pigs who were here first.",
			heroScale: 1,
		},
		{
			key: "earned",
			bg: require("../assets/images/backgrounds/festival_night_bg.png"),
			kicker: "the founding herd",
			line: BETA_TIER_LINE[tier],
			heroScale: 1.05,
			rewards: true,
		},
		{
			key: "stirs",
			bg: require("../assets/images/backgrounds/bog_dusk_bg.png"),
			kicker: "something stirs",
			line: "Rest well — something enormous is snuffling at the fences. Season 2 is coming.",
			heroTint: WHIMSY.ink,
			heroScale: 1.9,
			cta: "See you in the bog",
		},
	];
}

export function SeasonEndModal({
	visible,
	reward,
	onDone,
}: {
	visible: boolean;
	reward: BetaReward;
	onDone: () => void;
}) {
	const [beat, setBeat] = useState(0);
	const beats = useMemo(() => beatsFor(reward.tier), [reward.tier]);
	const B = beats[beat];
	const isLast = beat === beats.length - 1;

	const advance = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		if (isLast) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			setBeat(0);
			onDone();
		} else {
			setBeat((b) => b + 1);
		}
	}, [isLast, onDone]);

	const close = useCallback(() => {
		setBeat(0);
		onDone();
	}, [onDone]);

	return (
		<Modal visible={visible} animationType="fade" transparent onRequestClose={close}>
			<View style={styles.root}>
				<Animated.View
					key={B.key}
					entering={FadeIn.duration(500)}
					exiting={FadeOut.duration(220)}
					style={StyleSheet.absoluteFill}
				>
					<ImageBackground source={B.bg} style={styles.scene} resizeMode="cover">
						<Image
							source={PIG}
							resizeMode="contain"
							style={[
								styles.hero,
								{ transform: [{ scale: B.heroScale }] },
								B.heroTint ? { tintColor: B.heroTint } : null,
							]}
						/>
					</ImageBackground>
				</Animated.View>

				<View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil]} />

				{/* A season moment must never trap. */}
				<Pressable onPress={close} style={styles.skip} hitSlop={12}>
					<Text style={styles.skipText}>Skip</Text>
				</Pressable>

				<View style={styles.cardWrap}>
					<Animated.View
						key={`c-${B.key}`}
						entering={FadeIn.duration(420).delay(120)}
						style={styles.card}
					>
						<Text style={styles.kicker}>{"★ "}{B.kicker}</Text>
						<Text style={styles.line}>{B.line}</Text>

						{B.rewards && (
							<View style={styles.rewards}>
								{reward.titleName && (
									<RewardChip glyph="crown" label={`Title: ${reward.titleName}`} />
								)}
								<RewardChip glyph="crown" label="Title: Founding Herd" />
								<RewardChip glyph="bow" label="Founder's Mud Ribbon" />
								<RewardChip glyph="gem" label={`${reward.snouts} snouts`} />
							</View>
						)}
					</Animated.View>

					<View style={styles.dots}>
						{beats.map((_, i) => (
							<View key={i} style={[styles.dot, i === beat && styles.dotActive]} />
						))}
					</View>

					<Button size="lg" variant="primary" full onPress={advance}>
						{B.cta ?? "Next"}
					</Button>
				</View>
			</View>
		</Modal>
	);
}

function RewardChip({ glyph, label }: { glyph: GlyphName; label: string }) {
	return (
		<View style={styles.chip}>
			<Glyph name={glyph} size={16} />
			<Text style={styles.chipText} numberOfLines={1}>
				{label}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: WHIMSY.ink },
	scene: { flex: 1, alignItems: "center", justifyContent: "center" },
	hero: { width: 180, height: 180 },
	veil: { backgroundColor: MODAL_BACKDROP_BG, opacity: 0.25 },
	skip: {
		position: "absolute",
		top: 52,
		right: 20,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "rgba(255,250,240,0.85)",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	skipText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	cardWrap: {
		position: "absolute",
		left: SPACE.lg,
		right: SPACE.lg,
		bottom: 44,
		gap: SPACE.md,
	},
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		...STICKER_SHADOW,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.accent,
		marginBottom: SPACE.xs,
	},
	line: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		lineHeight: 28,
		color: WHIMSY.ink,
	},
	rewards: { marginTop: SPACE.md, gap: SPACE.sm },
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		alignSelf: "flex-start",
		backgroundColor: WHIMSY.cream,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md,
		paddingVertical: 6,
	},
	chipText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	dots: { flexDirection: "row", justifyContent: "center", gap: 7 },
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "rgba(255,250,240,0.55)",
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	dotActive: { backgroundColor: WHIMSY.sun, width: 22 },
});
