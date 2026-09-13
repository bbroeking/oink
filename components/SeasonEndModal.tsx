// The season-end reveal — a 3-beat storybook recap thanking the beta's
// Founding Herd: the season settles → what you earned → the Hungerer stirs
// (the Season-1 teaser). Follows the full-screen season-moment pattern
// (GreatHungerIntroModal / JudgementDayModal): per-beat scene crossfade,
// sticker story card, dots, one advancing Button.
//
// Wave-4 conformance pass: the raw Modal is now `AdaptiveModalScaffold` — the
// ceremony keeps its art, and `DialogCloseRow` replaces the unlabelled "Skip"
// chip that was the only exit from a full-screen moment (C-20, C-14). The
// ceremony ground is `WHIMSY.stage`, the one sanctioned dark surface, instead of
// a bare `WHIMSY.ink` (C-23); the beat line and the gift numeral speak through
// text roles (C-19); the story card and the reward cards are `Sticker`s.
//
// Shown by app/(tabs)/season.tsx when useSeasonEnd() says the moment is
// live (season1_finale flag — legacy key name for the season-0 finale —
// + an unseen my_beta_reward grant). Copy per tier comes from
// utils/betaRewards (mirrors the server announcement).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Animated as RNAnimated,
	Easing,
	View,
	StyleSheet,
	ImageBackground,
	Image,
	type ImageSourcePropType,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
	AdaptiveModalScaffold,
	Button,
	DialogCloseRow,
	Glyph,
	KickerPill,
	SectionTitle,
	SnoutCoin,
	Sticker,
	T,
} from "./ui";
import { HAT_IMAGES } from "@/constants/hats";
import {
	BORDER,
	RADII,
	RARITY_BG_SOLID,
	SPACE,
	TINT,
	UI_COLORS,
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
import {
	MOTION_DURATION,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";

// Rosie herself (her real sprite frame) — NOT the legacy soft-shaded
// assets/images/pig.png, which reads as a different pig entirely.
const PIG = require("../assets/images/sprites/rosie/idle_1.png");
// The Season-1 teaser silhouette: the REAL Great Hungerer render (alpha
// cutout), tinted to ink so only his looming shape reads at the fences — the
// "something stirs" beat swaps to this instead of a Rosie-shaped stand-in.
const HUNGER = require("../assets/images/hunger/great_hungerer_hero.png");

// Dev-preview stand-ins so the __DEV__ chip can show the full flow without a
// server grant. One per tier so every reward tier (chip count + copy) is
// testable on-device.
export const DEV_PREVIEW_REWARDS: BetaReward[] = (
	["founding_herd", "trough_table", "bog_royalty", "snoutfather"] as BetaTier[]
).map((tier, i) => ({
	rank: tier === "snoutfather" ? 1 : tier === "founding_herd" ? 42 : i + 2,
	tier,
	titleName: BETA_TIER_TITLE[tier],
	snouts: BETA_TIER_SNOUTS[tier],
}));

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
	const motionPolicy = useMotionPolicy();
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
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={close}
			animationType="fade"
			bare
			maxWidth={CEREMONY_WIDTH}
			frameStyle={styles.frame}
			contentContainerStyle={styles.content}
			scrollViewProps={{ style: styles.scroll }}
			testID="season-end-modal"
		>
			<Animated.View
				key={B.key}
				entering={FadeIn.duration(
					motionPolicy.duration(500, MOTION_DURATION.crossfade)
				)}
				exiting={FadeOut.duration(
					motionPolicy.duration(220, MOTION_DURATION.crossfade)
				)}
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

			{/* Text never sits directly on artwork — the veil is the token surface
			    under the story card. [A-18] */}
			<View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil]} />

			{/* A season moment must never trap: DialogCloseRow is the labelled exit
			    the unlabelled "Skip" chip used to be, riding over the scene at the
			    same top-right anchor. [C-14, C-20] */}
			<DialogCloseRow
				onPress={close}
				label="Skip the season recap"
				style={styles.closeRow}
			/>

			<View style={styles.cardWrap}>
				<Animated.View
					key={`c-${B.key}`}
					entering={
						motionPolicy.reduceMotion
							? FadeIn.duration(MOTION_DURATION.crossfade)
							: FadeIn.duration(420).delay(120)
					}
				>
					<Sticker
						color="paper"
						rotate={0}
						radius={RADII.xxl}
						border={BORDER.heavy}
						style={styles.card}
					>
						<KickerPill tone="accent" style={styles.kicker}>
							{B.kicker}
						</KickerPill>
						<SectionTitle>{B.line}</SectionTitle>

						{B.rewards && (
							<BetaGiftReveal key={reward.tier} reward={reward} opened={opened} />
						)}
					</Sticker>
				</Animated.View>

				<View
					style={styles.dots}
					accessibilityRole="progressbar"
					accessibilityLabel="Season recap"
					accessibilityValue={{ min: 1, max: beats.length, now: beat + 1 }}
				>
					{beats.map((_, i) => (
						<View key={i} style={[styles.dot, i === beat && styles.dotActive]} />
					))}
				</View>

				<Button
					size="lg"
					variant="primary"
					full
					onPress={onCta}
					accessibilityLabel={ctaLabel}
					accessibilityHint={
						onEarned && !opened
							? "Unwraps your founder's gift"
							: isLast
								? "Closes the season recap"
								: "Goes to the next beat of the recap"
					}
				>
					{ctaLabel}
				</Button>
			</View>
		</AdaptiveModalScaffold>
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
	const motionPolicy = useMotionPolicy();

	// Idle "tap me" wobble while the gift is still wrapped.
	useEffect(() => {
		if (opened || !motionPolicy.allowDecorativeMotion) {
			wobble.setValue(0);
			return;
		}
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
	}, [opened, wobble, motionPolicy.allowDecorativeMotion]);

	// Burst open: chips pop in staggered, each with a haptic; snouts count up.
	useEffect(() => {
		if (!opened) return;
		const timers: ReturnType<typeof setTimeout>[] = [];
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		if (motionPolicy.reduceMotion) {
			chips.forEach((chip, index) => {
				chipAnims[index].setValue(1);
				if (chip.kind === "snouts" && typeof chip.amount === "number") {
					snout.setValue(chip.amount);
					setSnoutShown(chip.amount);
				}
			});
			return;
		}
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
	}, [opened, motionPolicy.reduceMotion]);

	if (!opened) {
		const rotate = wobble.interpolate({
			inputRange: [-1, 1],
			outputRange: ["-7deg", "7deg"],
		});
		return (
			<View style={styles.giftWrap}>
				<RNAnimated.View style={{ transform: [{ rotate }] }}>
					<Glyph name="gift" size={GIFT_ART} />
				</RNAnimated.View>
				<T role="hand" align="center">
					A little something, just for you — for being here first.
				</T>
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
					<RewardCard chip={chip} snoutShown={snoutShown} />
				</RNAnimated.View>
			))}
		</View>
	);
}

// One earned reward, shown as a small sticker card: the art is the hero up top,
// a short label beneath. The showcase row wraps and centers so 2-4 cards read
// as a little display case of what you got — not a bullet list.
function RewardCard({
	chip,
	snoutShown,
}: {
	chip: BetaRewardChip;
	snoutShown: number;
}) {
	return (
		<Sticker
			color="paper"
			rotate={0}
			radius={RADII.md}
			border={BORDER.ink}
			shadow="sm"
			style={styles.rewardCard}
		>
			<View style={styles.cardArt}>
				<RewardArt chip={chip} snoutShown={snoutShown} />
			</View>
			<T role="kicker" align="center" numberOfLines={2}>
				{chip.kind === "snouts" ? "snouts" : chip.label}
			</T>
		</Sticker>
	);
}

function RewardArt({
	chip,
	snoutShown,
}: {
	chip: BetaRewardChip;
	snoutShown: number;
}) {
	if (chip.kind === "snouts") {
		return (
			<View style={styles.snoutArt}>
				<SnoutCoin size={COIN_ART} />
				{/* Numeral BESIDE the coin — overlaid on the pig face it was unreadable. */}
				<T role="sectionTitle">{snoutShown}</T>
			</View>
		);
	}
	if (chip.kind === "cosmetic") {
		const art = chip.hatId ? HAT_IMAGES[chip.hatId] : undefined;
		if (art) {
			return <Image source={art} style={styles.cosmeticArt} resizeMode="contain" />;
		}
		// Art hasn't landed yet — a rarity-tinted plate behind the bow glyph.
		// The graceful fallback, NOT the orphan-cosmetic render bug (20260685).
		return (
			<View
				style={[
					styles.artPlate,
					{
						backgroundColor:
							RARITY_BG_SOLID[chip.rarity ?? "common"] ?? WHIMSY.cream,
					},
				]}
			>
				<Glyph name="bow" size={PLATE_GLYPH} />
			</View>
		);
	}
	// title → the crown on a sun plate.
	return (
		<View style={[styles.artPlate, { backgroundColor: WHIMSY.sun }]}>
			<Glyph name="crown" size={PLATE_CROWN} />
		</View>
	);
}

// Drawing geometry — the fixed boxes this ceremony's art is laid out in, and the
// storybook page's own width. Not spacing steps; named here so no number floats.
const CEREMONY_WIDTH = 560;
const HERO_ART = 180;
const GIFT_ART = 104;
const COIN_ART = 40;
const PLATE = 56;
const PLATE_GLYPH = 34;
const PLATE_CROWN = 38;
const REWARD_CARD = 100;
const REWARD_ART_H = 60;
// The beat dots: a small bead that stretches into a bar on the current beat.
const DOT = 8;
const DOT_ACTIVE_W = 22;

const styles = StyleSheet.create({
	// The ceremony ground — the one sanctioned dark surface. [C-23]
	frame: {
		flex: 1,
		backgroundColor: WHIMSY.stage,
		borderRadius: RADII.xxl,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		overflow: "hidden",
	},
	scroll: { flex: 1 },
	content: { flexGrow: 1, justifyContent: "flex-end" },
	closeRow: {
		position: "absolute",
		top: 0,
		right: 0,
		zIndex: 1,
	},
	scene: { flex: 1, alignItems: "center", justifyContent: "center" },
	hero: { width: HERO_ART, height: HERO_ART },
	// A warm ink wash so the story card's words never sit straight on artwork.
	veil: { backgroundColor: TINT.well },
	cardWrap: {
		paddingHorizontal: SPACE.lg,
		paddingBottom: SPACE.lg,
		gap: SPACE.md,
	},
	card: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { marginBottom: SPACE.xs },
	rewards: {
		marginTop: SPACE.md,
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: SPACE.sm,
	},
	rewardCard: {
		width: REWARD_CARD,
		alignItems: "center",
		gap: SPACE.xs,
		padding: SPACE.sm,
	},
	cardArt: { height: REWARD_ART_H, alignItems: "center", justifyContent: "center" },
	cosmeticArt: { width: PLATE, height: PLATE },
	artPlate: {
		width: PLATE,
		height: PLATE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
	},
	snoutArt: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
	},
	giftWrap: {
		marginTop: SPACE.md,
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
	},
	dots: { flexDirection: "row", justifyContent: "center", gap: SPACE.sm },
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.textOnDark,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	dotActive: { backgroundColor: WHIMSY.sun, width: DOT_ACTIVE_W },
});
