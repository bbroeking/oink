// YOUR TAKE — the personal value strip (sounder-onboarding-plan Part 2, block 3).
// One compact horizontal Sticker row between the "do this now" slot and the
// dig-off, answering Q3 ("what do I get?"). Three glance-cells, each tappable
// where it has a destination:
//
//   1. PASS — a small tier ring + the NEXT unclaimed reward as ART + its name
//      ("next: {reward} · {n} XP away", or "ready to claim" when it's already
//      earned). Taps → the pass section (scroll) or the claim, via onOpenPass.
//   2. POUCH — the Golden Truffle count + "spend at the Exchange ›". Taps open
//      the same TruffleExchangeSheet SounderCard opens, off its own useTruffles.
//   3. TICKLES — this season's tickles reclaimed ("{n} tickles reclaimed",
//      matching the hero's language). Taps open the hero sheet (onOpenHero).
//
// Degrades quietly: while a value is still loading it shows a muted "—" dash,
// never a spinner. The reward-art resolution mirrors season.tsx's StoneThumb
// exactly (hat_id → HAT_IMAGES, tickles → TickleIcon, else a star), so the
// strip's "next reward" picture can never drift from the pass-track stones.

import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Sticker } from "../ui/Sticker";
import { Icon } from "../ui/Icon";
import { TickleIcon } from "../ui/SnoutCoin";
import { HAT_IMAGES } from "@/constants/hats";
import { FONTS, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";
import { useTruffles } from "@/hooks/useTruffles";
import { TruffleExchangeSheet } from "../mudwar/TruffleExchangeSheet";

// The shape season.tsx passes down for the next-reward preview. Mirrors the
// TierRow fields StoneThumb reads — kept structural so the strip needn't import
// season.tsx's private TierRow type.
export interface NextReward {
	reward_type: string;
	reward_value: {
		hat_id?: string;
		bg_id?: string;
		aura_id?: string;
		cape_id?: string;
	} | null;
	display_label: string;
	/** true when the tier is already reached — the reward is claimable now. */
	ready: boolean;
	/** XP still to earn before the reward unlocks (0 when ready). */
	xpAway: number;
}

// Reward-art resolver — the SAME rules as season.tsx's StoneThumb, so the
// strip's preview art matches the pass-track stones exactly. Wearables resolve
// to their HAT_IMAGES sprite; tickles to the coin; everything else to a star.
const HAT_ITEM_TYPES = new Set([
	"hat", "background", "aura", "cape", "scarf",
	"mask", "necklace", "glasses", "bow", "held",
]);

function RewardArt({ reward, size }: { reward: NextReward; size: number }) {
	const { reward_type: type, reward_value: val } = reward;
	const itemId = val?.hat_id ?? val?.bg_id ?? val?.aura_id ?? val?.cape_id ?? null;

	if (type === "tickles") return <TickleIcon size={size} />;
	if (HAT_ITEM_TYPES.has(type) && itemId && HAT_IMAGES[itemId]) {
		return (
			<Image
				source={HAT_IMAGES[itemId]}
				style={{ width: size, height: size }}
				resizeMode="contain"
			/>
		);
	}
	return <Icon name="star" size={Math.round(size * 0.7)} filled color={WHIMSY.bless} strokeWidth={1.6} />;
}

export function YourTakeStrip({
	nextReward,
	nextRewardLoading,
	currentTier,
	totalTiers,
	ticklesEarned,
	onOpenPass,
	onOpenHero,
	onOpenBreakdown,
}: {
	/** The next unclaimed FREE-track (or claimable) reward, or null once every tier is claimed. */
	nextReward: NextReward | null;
	/** true until season_state has loaded — show quiet dashes, not a spinner. */
	nextRewardLoading: boolean;
	currentTier: number;
	totalTiers: number;
	/** This season's tickles reclaimed (the caller's own profiles.tickles_earned), or null while loading. */
	ticklesEarned: number | null;
	/** Reveal / scroll to the pass section (READY → jump to the claim). */
	onOpenPass: () => void;
	/** Open the Great Hunger hero sheet — the tickle count's emotional home. */
	onOpenHero: () => void;
	/** Open the tickle breakdown receipt for yourself (spec 17). When provided,
	    the TICKLES cell opens the receipt; the hero stays reachable from the
	    Hunger banner. Omitted → the cell falls back to the hero (unchanged). */
	onOpenBreakdown?: () => void;
}) {
	// The pouch reads its own balance off the Exchange rotation, exactly like
	// SounderCard — one cheap STABLE read, feature-dark to a 0 pouch until the
	// Exchange migration lands (useTruffles' graceful fallback).
	const truffles = useTruffles();
	const [exchangeOpen, setExchangeOpen] = useState(false);

	const DASH = <Text style={styles.dash}>—</Text>;

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ your take</Text>
			<Sticker color="paper" rotate={-0.4} radius={RADII.lg} style={styles.row}>
				{/* 1 — PASS: tier ring + next-reward art + name / XP-away. */}
				<Pressable
					onPress={onOpenPass}
					style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
					accessibilityRole="button"
					accessibilityLabel="Your season pass — jump to the next reward"
				>
					<View style={styles.passHead}>
						<View style={styles.tierRing}>
							<Text style={styles.tierRingNum}>{currentTier}</Text>
						</View>
						{nextRewardLoading ? (
							<View style={styles.rewardThumb}>{DASH}</View>
						) : nextReward ? (
							<View style={styles.rewardThumb}>
								<RewardArt reward={nextReward} size={26} />
							</View>
						) : (
							<View style={styles.rewardThumb}>
								<Icon name="crown" size={20} color={WHIMSY.bless} filled />
							</View>
						)}
					</View>
					<Text style={styles.cellCap}>tier {currentTier}/{totalTiers}</Text>
					{nextRewardLoading ? (
						<Text style={styles.cellSub} numberOfLines={2}>
							reading your pass
						</Text>
					) : nextReward ? (
						<Text style={styles.cellSub} numberOfLines={2}>
							{nextReward.ready
								? `claim ${nextReward.display_label} ›`
								: `next: ${nextReward.display_label} · ${nextReward.xpAway} XP away`}
						</Text>
					) : (
						<Text style={styles.cellSub} numberOfLines={2}>
							every reward claimed ★
						</Text>
					)}
				</Pressable>

				<View style={styles.divider} />

				{/* 2 — POUCH: Golden Truffle count → the Exchange. */}
				<Pressable
					onPress={() => setExchangeOpen(true)}
					style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
					accessibilityRole="button"
					accessibilityLabel="Your Golden Truffles — spend at the Exchange"
				>
					<View style={styles.pouchHead}>
						{/* The truffle's own art — never the Slop Club crest; the
						    free-earned currency must not wear the paywall's icon. */}
						<Image
							source={HAT_IMAGES.golden_truffle}
							style={styles.pouchArt}
							resizeMode="contain"
						/>
						<Text style={styles.pouchNum}>
							{truffles.available ? truffles.balance : DASH}
						</Text>
					</View>
					<Text style={styles.cellCap}>golden truffles</Text>
					<Text style={styles.cellSub} numberOfLines={2}>
						spend at the Exchange ›
					</Text>
				</Pressable>

				<View style={styles.divider} />

				{/* 3 — TICKLES: this season's reclaimed count → the breakdown receipt
				    (spec 17), or the hero sheet when no receipt handler is wired. */}
				<Pressable
					onPress={onOpenBreakdown ?? onOpenHero}
					style={({ pressed }) => [styles.cell, pressed && { opacity: 0.6 }]}
					accessibilityRole="button"
					accessibilityLabel={
						onOpenBreakdown
							? "How you earned your tickles this season"
							: "Your tickles reclaimed this season"
					}
				>
					<View style={styles.tickleHead}>
						<TickleIcon size={24} />
						<Text style={styles.pouchNum}>
							{ticklesEarned == null ? DASH : ticklesEarned.toLocaleString("en-US")}
						</Text>
					</View>
					<Text style={styles.cellCap}>this season</Text>
					<Text style={styles.cellSub} numberOfLines={2}>
						tickles reclaimed ›
					</Text>
				</Pressable>
			</Sticker>

			<TruffleExchangeSheet
				open={exchangeOpen}
				onClose={() => setExchangeOpen(false)}
				truffles={truffles}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: SPACE.sm },
	kicker: {
		...TYPE.kicker,
		color: WHIMSY.accent,
		marginBottom: SPACE.xs,
		paddingHorizontal: 4,
	},
	row: {
		flexDirection: "row",
		alignItems: "stretch",
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	cell: {
		flex: 1,
		paddingHorizontal: SPACE.xs,
		gap: 2,
	},
	// A hairline seam between cells — reads as one strip, three panes.
	divider: {
		width: 1.5,
		alignSelf: "stretch",
		marginVertical: 2,
		backgroundColor: WHIMSY.cream2,
	},

	// Cell 1 head — tier ring beside the next-reward thumb.
	passHead: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginBottom: 1 },
	tierRing: {
		width: 30,
		height: 30,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	tierRingNum: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	rewardThumb: {
		width: 30,
		height: 30,
		alignItems: "center",
		justifyContent: "center",
	},

	// Cells 2 + 3 head — icon beside a numeral.
	pouchHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
	pouchArt: { width: 22, height: 22 },
	tickleHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1 },
	pouchNum: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.ink },

	// Shared cap + sub lines.
	cellCap: {
		...TYPE.kicker,
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 0.8,
		textTransform: "uppercase",
		color: WHIMSY.mute,
	},
	cellSub: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
	},
	dash: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.muteSoft },
});
