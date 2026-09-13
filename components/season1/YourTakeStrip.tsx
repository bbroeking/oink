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
import { View, Image, Pressable, StyleSheet } from "react-native";
import {
	CardTitle,
	Glyph,
	Icon,
	Kicker,
	KickerPill,
	Numeral,
	Sticker,
	TickleIcon,
} from "@/components/ui";
import { HAT_IMAGES } from "@/constants/hats";
import { resolveRewardArt } from "@/utils/rewardArt";
import {
	BORDER,
	PRESSED_FLAT,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { useTruffles } from "@/hooks/useTruffles";
import { TruffleExchangeSheet } from "../mudwar/TruffleExchangeSheet";
// The next-reward preview shape lives in utils/seasonPass (the single owner of
// the season-pass types); re-exported so existing importers of NextReward from
// this component keep working.
import type { NextReward } from "@/utils/seasonPass";
export type { NextReward };

// Cell drawing geometry — the tier ring and the reward thumb share one 30pt box
// so the two heads line up, and each currency art sits beside its numeral at
// its own size. Proportions of one strip, not steps on the spacing scale.
const HEAD_BOX = 30;
const COIN_ART = 22;
const TICKLE_ART = 24;
const REWARD_ART = 26;
const CROWN_ART = 20;
const STAR_FRAC = 0.7;

// Reward-art preview — resolution lives in the shared utils/rewardArt resolver,
// so the strip's picture can never drift from the pass-track stones. Wearables
// resolve to their HAT_IMAGES sprite; tickles to the coin; everything else the
// resolver draws with a fancier glyph collapses here to the strip's single star.
function RewardArt({ reward, size }: { reward: NextReward; size: number }) {
	const art = resolveRewardArt(reward);
	switch (art.kind) {
		case "tickles":
			return <TickleIcon size={size} />;
		case "snouts":
			return <Glyph name="pigface" size={size} />;
		case "goldenTruffle":
		case "image":
			return (
				<Image
					source={art.source}
					style={{ width: size, height: size }}
					resizeMode="contain"
				/>
			);
		default:
			return (
				<Icon
					name="star"
					size={Math.round(size * STAR_FRAC)}
					filled
					color={UI_COLORS.warningText}
					strokeWidth={1.6}
				/>
			);
	}
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

	const DASH = <CardTitle tone="secondary">—</CardTitle>;

	return (
		<View style={styles.wrap}>
			<Kicker style={styles.kicker}>your take</Kicker>
			<Sticker color="paper" rotate={TILT.card} radius={RADII.lg} style={styles.row}>
				{/* 1 — PASS: tier ring + next-reward art + name / XP-away. */}
				<Pressable
					onPress={onOpenPass}
					style={({ pressed }) => [styles.cell, pressed && PRESSED_FLAT]}
					accessibilityRole="button"
					accessibilityLabel="Your season pass — jump to the next reward"
					accessibilityHint="Scrolls to the pass track and its next claim"
				>
					<View style={styles.passHead}>
						<View style={styles.tierRing}>
							<Numeral>{currentTier}</Numeral>
						</View>
						{nextRewardLoading ? (
							<View style={styles.rewardThumb}>{DASH}</View>
						) : nextReward ? (
							<View style={styles.rewardThumb}>
								<RewardArt reward={nextReward} size={REWARD_ART} />
							</View>
						) : (
							<View style={styles.rewardThumb}>
								<Icon name="crown" size={CROWN_ART} color={UI_COLORS.warningText} filled />
							</View>
						)}
					</View>
					<KickerPill star={false}>
						tier {currentTier}/{totalTiers}
					</KickerPill>
					{nextRewardLoading ? (
						<Kicker star={false} numberOfLines={2}>
							reading your pass
						</Kicker>
					) : nextReward ? (
						<Kicker star={false} numberOfLines={2}>
							{nextReward.ready
								? `claim ${nextReward.display_label} ›`
								: `next: ${nextReward.display_label} · ${nextReward.xpAway} XP away`}
						</Kicker>
					) : (
						<Kicker star={false} numberOfLines={2}>
							every reward claimed ★
						</Kicker>
					)}
				</Pressable>

				<View style={styles.divider} />

				{/* 2 — POUCH: Golden Truffle count → the Exchange. */}
				<Pressable
					onPress={() => setExchangeOpen(true)}
					style={({ pressed }) => [styles.cell, pressed && PRESSED_FLAT]}
					accessibilityRole="button"
					accessibilityLabel="Your Golden Truffles — spend at the Exchange"
					accessibilityHint="Opens the Golden Truffle Exchange"
				>
					<View style={styles.pouchHead}>
						{/* The truffle's own art — never the Slop Club crest; the
						    free-earned currency must not wear the paywall's icon. */}
						<Image
							source={HAT_IMAGES.golden_truffle}
							style={styles.pouchArt}
							resizeMode="contain"
						/>
						<CardTitle>
							{truffles.available ? truffles.balance : DASH}
						</CardTitle>
					</View>
					<KickerPill star={false}>golden truffles</KickerPill>
					<Kicker star={false} numberOfLines={2}>
						spend at the Exchange ›
					</Kicker>
				</Pressable>

				<View style={styles.divider} />

				{/* 3 — TICKLES: this season's reclaimed count → the breakdown receipt
				    (spec 17), or the hero sheet when no receipt handler is wired. */}
				<Pressable
					onPress={onOpenBreakdown ?? onOpenHero}
					style={({ pressed }) => [styles.cell, pressed && PRESSED_FLAT]}
					accessibilityRole="button"
					accessibilityLabel={
						onOpenBreakdown
							? "How you earned your tickles this season"
							: "Your tickles reclaimed this season"
					}
					accessibilityHint={
						onOpenBreakdown
							? "Opens the receipt for this season's tickles"
							: "Opens the Great Hungerer sheet"
					}
				>
					<View style={styles.tickleHead}>
						<TickleIcon size={TICKLE_ART} />
						<CardTitle>
							{ticklesEarned == null ? DASH : ticklesEarned.toLocaleString("en-US")}
						</CardTitle>
					</View>
					<KickerPill star={false}>this season</KickerPill>
					<Kicker star={false} numberOfLines={2}>
						tickles reclaimed ›
					</Kicker>
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
		marginBottom: SPACE.xs,
		paddingHorizontal: SPACE.xs,
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
		gap: SPACE.xxs,
	},
	// A hairline seam between cells — reads as one strip, three panes.
	divider: {
		width: BORDER.thin,
		alignSelf: "stretch",
		marginVertical: SPACE.xxs,
		backgroundColor: WHIMSY.cream2,
	},

	// Cell 1 head — tier ring beside the next-reward thumb.
	passHead: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	tierRing: {
		width: HEAD_BOX,
		height: HEAD_BOX,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	rewardThumb: {
		width: HEAD_BOX,
		height: HEAD_BOX,
		alignItems: "center",
		justifyContent: "center",
	},

	// Cells 2 + 3 head — art beside a numeral.
	pouchHead: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	pouchArt: { width: COIN_ART, height: COIN_ART },
	tickleHead: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
