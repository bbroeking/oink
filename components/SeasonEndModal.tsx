// The season-end reveal — a 3-beat storybook recap thanking the beta's
// Founding Herd: the season settles → what you earned → the Hungerer stirs
// (the Season-1 teaser). Follows the full-screen season-moment pattern
// (GreatHungerIntroModal / JudgementDayModal): fade Modal, per-beat scene
// crossfade, sticker story card, dots, one advancing Button.
//
// Shown by app/(tabs)/season.tsx when useSeasonEnd() says the moment is
// live (season1_finale flag — legacy key name for the season-0 finale —
// + an unseen my_beta_reward grant). Copy per tier comes from
// utils/betaRewards (mirrors the server announcement).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Animated as RNAnimated,
	Easing,
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
import { Glyph } from "./ui/Glyph";
import { SnoutCoin } from "./ui/SnoutCoin";
import { HAT_IMAGES } from "@/constants/hats";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	RADII,
	RARITY_BG_SOLID,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";
import {
	BETA_TIER_LINE,
	BETA_TIER_SNOUTS,
	BETA_TIER_TITLE,
	betaRewardChips,
	type BetaRewardChip,
	type BetaTier,
} from "@/utils/betaRewards";
import type { BetaReward } from "@/hooks/useSeasonEnd";

const PIG = require("../assets/images/pig.png");
// The Season-1 teaser silhouette: the REAL Great Hungerer render (alpha
// cutout), tinted to ink so only his looming shape reads at the fences — the
// "something stirs" beat swaps to this instead of a Rosie-shaped stand-in.
const HUNGER = require("../assets/images/hunger/great_hungerer_hero.png");

// Dev-preview stand-ins so the __DEV__ chip can show the full flow without a
// server grant. One per tier so every reward tier (chip count + copy) is
// testable on-device; DEV_PREVIEW_REWARD keeps the old top-3 default.
export const DEV_PREVIEW_REWARDS: BetaReward[] = (
	["founding_herd", "trough_table", "bog_royalty", "snoutfather"] as BetaTier[]
).map((tier, i) => ({
	rank: tier === "snoutfather" ? 1 : tier === "founding_herd" ? 42 : i + 2,
	tier,
	titleName: BETA_TIER_TITLE[tier],
	snouts: BETA_TIER_SNOUTS[tier],
}));

export const DEV_PREVIEW_REWARD: BetaReward =
	DEV_PREVIEW_REWARDS.find((r) => r.tier === "bog_royalty") ?? DEV_PREVIEW_REWARDS[0];

type Beat = {
	key: string;
	bg: ImageSourcePropType;
	kicker: string;
	line: string;
	hero?: ImageSourcePropType; // per-beat character; defaults to Rosie (PIG)
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
			line: "Rest well — something enormous is snuffling at the fences. Season 1 is coming.",
			hero: HUNGER,
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
	// The founder's gift is a two-stage moment on the "earned" beat: the
	// wrapped box waits, the primary button opens it (chips burst in), and only
	// then does the button advance the story. `opened` gates that flip.
	const [opened, setOpened] = useState(false);
	const beats = useMemo(() => beatsFor(reward.tier), [reward.tier]);
	const B = beats[beat];
	const isLast = beat === beats.length - 1;
	const onEarned = !!B.rewards;

	const advance = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		if (isLast) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			setBeat(0);
			setOpened(false);
			onDone();
		} else {
			setBeat((b) => b + 1);
		}
	}, [isLast, onDone]);

	// The earned beat's button first OPENS the gift (does not advance); every
	// other press advances the story.
	const onCta = useCallback(() => {
		if (onEarned && !opened) {
			Haptics.selectionAsync().catch(() => {});
			setOpened(true);
			return;
		}
		advance();
	}, [onEarned, opened, advance]);

	const ctaLabel =
		onEarned && !opened ? "Open your founder's gift" : B.cta ?? "Next";

	const close = useCallback(() => {
		setBeat(0);
		setOpened(false);
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
							source={B.hero ?? PIG}
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
							<BetaGiftReveal key={reward.tier} reward={reward} opened={opened} />
						)}
					</Animated.View>

					<View style={styles.dots}>
						{beats.map((_, i) => (
							<View key={i} style={[styles.dot, i === beat && styles.dotActive]} />
						))}
					</View>

					<Button size="lg" variant="primary" full onPress={onCta}>
						{ctaLabel}
					</Button>
				</View>
			</View>
		</Modal>
	);
}

// The founder's-gift unboxing. Reuses MysteryHatReveal's animation vocabulary
// — an idle wobble on the wrapped box, a spring "burst" on open, then chips
// popping in one-by-one with per-chip selection haptics and a counter tick on
// the snouts chip. Legacy RN Animated (not reanimated) to match that file.
function BetaGiftReveal({
	reward,
	opened,
}: {
	reward: BetaReward;
	opened: boolean;
}) {
	const chips = useMemo(() => betaRewardChips(reward), [reward]);
	const wobble = useRef(new RNAnimated.Value(0)).current;
	const chipAnims = useRef(chips.map(() => new RNAnimated.Value(0))).current;
	const snout = useRef(new RNAnimated.Value(0)).current;
	const [snoutShown, setSnoutShown] = useState(0);

	// Idle "tap me" wobble while the gift is still wrapped.
	useEffect(() => {
		if (opened) return;
		const loop = RNAnimated.loop(
			RNAnimated.sequence([
				RNAnimated.timing(wobble, {
					toValue: 1,
					duration: 220,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				RNAnimated.timing(wobble, {
					toValue: -1,
					duration: 440,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				RNAnimated.timing(wobble, {
					toValue: 0,
					duration: 220,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: true,
				}),
				RNAnimated.delay(600),
			])
		);
		loop.start();
		return () => loop.stop();
	}, [opened, wobble]);

	// Burst open: chips pop in staggered, each with a haptic; snouts count up.
	useEffect(() => {
		if (!opened) return;
		const timers: ReturnType<typeof setTimeout>[] = [];
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		chips.forEach((chip, i) => {
			timers.push(
				setTimeout(() => {
					Haptics.selectionAsync().catch(() => {});
					RNAnimated.spring(chipAnims[i], {
						toValue: 1,
						tension: 90,
						friction: 7,
						useNativeDriver: true,
					}).start();
					if (chip.kind === "snouts" && typeof chip.amount === "number") {
						snout.setValue(0);
						const id = snout.addListener(({ value }) =>
							setSnoutShown(Math.round(value))
						);
						RNAnimated.timing(snout, {
							toValue: chip.amount,
							duration: 900,
							easing: Easing.out(Easing.cubic),
							useNativeDriver: false,
						}).start(() => {
							snout.removeListener(id);
							setSnoutShown(chip.amount ?? 0);
						});
					}
				}, 260 + i * 240)
			);
		});
		return () => timers.forEach(clearTimeout);
		// chipAnims/snout are stable refs; chips is stable per reward.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [opened]);

	if (!opened) {
		const rotate = wobble.interpolate({
			inputRange: [-1, 1],
			outputRange: ["-7deg", "7deg"],
		});
		return (
			<View style={styles.giftWrap}>
				<RNAnimated.View style={{ transform: [{ rotate }] }}>
					<Glyph name="gift" size={104} />
				</RNAnimated.View>
				<Text style={styles.giftPrompt}>
					A little something, just for you — for being here first.
				</Text>
			</View>
		);
	}

	return (
		<View style={styles.rewards}>
			{chips.map((chip, i) => (
				<RNAnimated.View
					key={`${chip.kind}-${i}`}
					style={{
						opacity: chipAnims[i],
						transform: [
							{
								scale: chipAnims[i].interpolate({
									inputRange: [0, 1],
									outputRange: [0.6, 1],
								}),
							},
						],
					}}
				>
					<RewardChip chip={chip} snoutShown={snoutShown} />
				</RNAnimated.View>
			))}
		</View>
	);
}

function RewardChip({
	chip,
	snoutShown,
}: {
	chip: BetaRewardChip;
	snoutShown: number;
}) {
	return (
		<View style={styles.chip}>
			<ChipIcon chip={chip} />
			<Text style={styles.chipText} numberOfLines={1}>
				{chip.kind === "snouts" ? `${snoutShown} snouts` : chip.label}
			</Text>
		</View>
	);
}

function ChipIcon({ chip }: { chip: BetaRewardChip }) {
	if (chip.kind === "snouts") return <SnoutCoin size={18} />;
	if (chip.kind === "cosmetic") {
		const art = chip.hatId ? HAT_IMAGES[chip.hatId] : undefined;
		if (art) {
			return (
				<View style={styles.cosmeticThumb}>
					<Image source={art} style={styles.cosmeticImg} resizeMode="contain" />
				</View>
			);
		}
		// Art hasn't landed yet — a rarity-tinted swatch behind the bow glyph.
		// The graceful fallback, NOT the orphan-cosmetic render bug (20260685).
		return (
			<View
				style={[
					styles.cosmeticThumb,
					{
						backgroundColor:
							RARITY_BG_SOLID[chip.rarity ?? "common"] ?? WHIMSY.cream,
					},
				]}
			>
				<Glyph name="bow" size={14} />
			</View>
		);
	}
	return <Glyph name={chip.glyph} size={16} />;
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
	giftWrap: {
		marginTop: SPACE.md,
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
	},
	giftPrompt: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	cosmeticThumb: {
		width: 24,
		height: 24,
		borderRadius: RADII.sm,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	cosmeticImg: { width: 20, height: 20 },
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
