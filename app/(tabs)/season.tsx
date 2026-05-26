import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	Platform,
	SafeAreaView,
	Alert,
	Text,
	Image,
	Pressable,
	Modal,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { supabase } from "../../utils/supabase";
import {
	initIAP,
	IAP_ENABLED,
	purchaseProductId,
	PRODUCT_IDS,
} from "../../utils/iap";
import { Sticker } from "../../components/ui/Sticker";
import { Icon } from "../../components/ui/Icon";
import { TickleIcon } from "../../components/ui/SnoutCoin";
import { BattlePassSaleModal } from "../../components/BattlePassSaleModal";
import { BountyBoard } from "../../components/BountyBoard";
import {
	TierUpBanner,
	type TierUpBannerHandle,
} from "../../components/ui/TierUpBanner";
import { HAT_IMAGES, HIDDEN_CATEGORIES } from "@/constants/hats";
import { FONTS, KICKER_TEXT, ROW_TILTS, TITLE_RULE, WHIMSY, MODAL_BACKDROP_BG, STICKER_SHADOW } from "@/constants/theme";
import { Button, SectionHeader } from "../../components/ui";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const claimSound = require("../../assets/sounds/claim.mp3");

// Premium battle-pass track is not ready to go live (no fulfillment for
// some reward types, no real IAP flow). Flip to true once both are
// shipped. While false: only the free track is visible, the Unlock
// Premium CTA is hidden, and the upsell modal can't be opened.
const PAID_BATTLE_PASS_ENABLED = false;

interface SeasonRow {
	id: string;
	name: string;
	starts_at: string;
	ends_at: string;
	total_tiers: number;
	xp_per_tier: number;
	premium_price_cents: number;
	premium_plus_price_cents: number;
}

// reward_value shape varies per reward_type — Supabase jsonb.
// Legacy seeds used category-specific keys (bg_id, aura_id, cape_id);
// the 20260514020000 migration normalized those to hat_id but the
// type still accepts the legacy keys for un-migrated rows.
type RewardValue = {
	hat_id?: string;
	bg_id?: string;
	aura_id?: string;
	cape_id?: string;
	count?: number;
	amount?: number;
	title?: string;
} | null;

interface TierRow {
	tier: number;
	track: "free" | "premium";
	reward_type: string;
	reward_value: RewardValue;
	display_label: string;
}

interface ClaimRow {
	tier: number;
	track: "free" | "premium";
}

interface SeasonState {
	active: boolean;
	season?: SeasonRow;
	tiers?: TierRow[];
	xp?: number;
	current_tier?: number;
	premium_unlocked?: boolean;
	claims?: ClaimRow[];
}

function StoneThumb({ reward, locked }: { reward: TierRow; locked: boolean }) {
	const { reward_type: type, reward_value: val } = reward;

	// Any hats-table item (hat/background/aura/cape/scarf/etc.) resolves
	// to an actual image when hat_id is set. The 20260514020000 migration
	// normalized legacy bg_id/aura_id/cape_id keys to hat_id, but fall
	// back to those anyway for forward-compat with un-migrated rows.
	const itemId =
		val?.hat_id ?? val?.bg_id ?? val?.aura_id ?? val?.cape_id ?? null;
	const hatItemTypes = new Set([
		"hat", "background", "aura", "cape", "scarf",
		"mask", "necklace", "glasses", "bow", "held",
	]);

	let inner: React.ReactNode = (
		<Icon name="star" size={20} color={WHIMSY.muteSoft} />
	);
	if (type === "tickles") {
		inner = <TickleIcon size={26} />;
	} else if (hatItemTypes.has(type) && itemId && HAT_IMAGES[itemId]) {
		inner = (
			<Image
				source={HAT_IMAGES[itemId]}
				style={{ width: 32, height: 32 }}
				resizeMode="contain"
			/>
		);
	} else if (type === "title") {
		inner = <Text style={styles.titleGlyph}>"</Text>;
	} else if (type === "boost") {
		inner = <Icon name="flame" size={22} filled color="#F58F4A" strokeWidth={1.5} />;
	} else if (type === "background") {
		inner = <Icon name="globe" size={22} color={WHIMSY.ink} strokeWidth={1.6} />;
	} else if (type === "aura") {
		inner = <Icon name="premium" size={22} color="#C99B23" strokeWidth={1.6} />;
	} else if (type === "cape") {
		inner = <Icon name="star" size={22} color={WHIMSY.ink} strokeWidth={1.6} />;
	} else if (type === "mystery_box" || type === "cap_increase" || type === "pig_skin") {
		inner = <Icon name="star" size={22} filled color="#C99B23" strokeWidth={1.6} />;
	}

	return (
		<View style={[styles.stone, locked && { opacity: 0.55 }]}>{inner}</View>
	);
}

function TierStone({
	reward,
	state,
	premium,
	isFinale,
	onClaim,
}: {
	reward: TierRow | undefined;
	state: "claim" | "claimed" | "locked";
	premium?: boolean;
	isFinale?: boolean;
	onClaim?: () => void;
}) {
	if (!reward) return <View style={{ flex: 1 }} />;
	const isLocked = state === "locked";
	const isClaim = state === "claim";
	const isClaimed = state === "claimed";

	const color = isFinale ? "sun" : premium ? "lilac" : "paper";

	return (
		<Sticker
			color={color}
			rotate={0}
			radius={14}
			border={isLocked ? 1.5 : 2}
			style={[styles.stoneCell, isLocked && { opacity: 0.85 }]}
		>
			<View style={styles.stoneTop}>
				<StoneThumb reward={reward} locked={isLocked} />
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.stoneLabel} numberOfLines={2}>
						{reward.display_label}
					</Text>
					{premium && !isFinale && (
						<View style={styles.stonePremRow}>
							{isLocked ? (
								<Icon name="lock" size={11} color={WHIMSY.mute} filled />
							) : (
								<Text style={styles.stonePremStar}>★</Text>
							)}
							<Text style={styles.stonePrem}>premium</Text>
						</View>
					)}
					{isFinale && <Text style={styles.stoneFinale}>FINALE</Text>}
				</View>
			</View>
			{isClaim && (
				<Pressable onPress={onClaim} style={styles.claimBtn}>
					<Text style={styles.claimBtnText}>Claim</Text>
				</Pressable>
			)}
			{isClaimed && (
				<View style={styles.claimedRow}>
					<Icon name="check" size={11} color={WHIMSY.ink} strokeWidth={2.5} />
					<Text style={styles.claimedText}>claimed</Text>
				</View>
			)}
			{isLocked && !isFinale && (
				<View style={styles.lockedRow}>
					<View style={styles.lockedDashed} />
					<Text style={styles.lockedText}>locked</Text>
				</View>
			)}
		</Sticker>
	);
}

// ── Snaking pass track ────────────────────────────────────────────
// Tiers alternate left/right; an absolute SVG path with a dashed
// stroke connects the stones. From the redesign.

const SNAKE_STEP_Y = 88;
const SNAKE_X_L = 56;
const SNAKE_X_R = 280;
const SNAKE_WIDTH = 340;

function buildSnakePath(n: number): string {
	// Cubic spline zigzag: each segment curves from one column to the
	// other; control points sit at the vertical midpoint of the segment.
	let d = `M ${SNAKE_X_L} ${36}`;
	for (let i = 1; i < n; i++) {
		const xPrev = i % 2 === 1 ? SNAKE_X_L : SNAKE_X_R;
		const xNext = i % 2 === 1 ? SNAKE_X_R : SNAKE_X_L;
		const yPrev = (i - 1) * SNAKE_STEP_Y + 36;
		const yNext = i * SNAKE_STEP_Y + 36;
		const cy = (yPrev + yNext) / 2;
		d += ` C ${xPrev} ${cy}, ${xNext} ${cy}, ${xNext} ${yNext}`;
	}
	return d;
}

function SnakingPassTrack({
	totalTiers,
	currentTier,
	tiersByNumber,
	claimedSet,
	onClaim,
}: {
	totalTiers: number;
	currentTier: number;
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>;
	claimedSet: Set<string>;
	onClaim: (tier: number, track: "free" | "premium") => void;
}) {
	const trackHeight = totalTiers * SNAKE_STEP_Y + 24;
	return (
		<View style={{ height: trackHeight, width: SNAKE_WIDTH, alignSelf: "center" }}>
			{/* Dashed snake path behind the stones */}
			<Svg
				width={SNAKE_WIDTH}
				height={trackHeight}
				style={StyleSheet.absoluteFill}
			>
				<SvgPath
					d={buildSnakePath(totalTiers)}
					stroke={WHIMSY.ink}
					strokeWidth={3}
					strokeDasharray="4 6"
					fill="none"
					opacity={0.35}
				/>
			</Svg>

			{Array.from({ length: totalTiers }, (_, i) => i + 1).map((t, i) => {
				const free = tiersByNumber[t]?.free;
				const hasVipReward = !!tiersByNumber[t]?.premium;
				const isFinale = t === totalTiers;
				const reached = t <= currentTier;
				const freeState: "claim" | "claimed" | "locked" = claimedSet.has(
					`${t}:free`
				)
					? "claimed"
					: reached
						? "claim"
						: "locked";
				const sideLeft = i % 2 === 0;
				const y = i * SNAKE_STEP_Y + 36 - SNAKE_STEP_Y / 2 + 4;
				return (
					<SnakeStone
						key={t}
						tier={t}
						reward={free}
						state={freeState}
						isFinale={isFinale}
						vip={hasVipReward}
						sideLeft={sideLeft}
						top={y}
						onClaim={() => onClaim(t, "free")}
					/>
				);
			})}
		</View>
	);
}

function SnakeStone({
	tier,
	reward,
	state,
	isFinale,
	vip,
	sideLeft,
	top,
	onClaim,
}: {
	tier: number;
	reward: TierRow | undefined;
	state: "claim" | "claimed" | "locked";
	isFinale: boolean;
	// True when this tier also has a premium-track reward attached
	// (the SeasonState exposes both free and premium tier rewards
	// per tier number). Adds a "★ VIP" lilac-deep accent next to the
	// Tier label so members know there's extra to claim here.
	vip?: boolean;
	sideLeft: boolean;
	top: number;
	onClaim: () => void;
}) {
	const isClaimable = state === "claim";
	const isClaimed = state === "claimed";
	const isLocked = state === "locked";

	const bg = isFinale
		? WHIMSY.lilacDeep
		: isClaimable
			? WHIMSY.sun
			: isClaimed
				? WHIMSY.sage
				: WHIMSY.paper;

	const stoneSize = isFinale ? 72 : 60;
	const stoneX = sideLeft
		? SNAKE_X_L - stoneSize / 2
		: SNAKE_X_R - stoneSize / 2;

	return (
		<View style={{ position: "absolute", top, left: 0, right: 0, height: SNAKE_STEP_Y }}>
			{/* Stone — fixed position on the snake's column */}
			<View
				style={[
					snakeStyles.stone,
					{
						left: stoneX,
						top: SNAKE_STEP_Y / 2 - stoneSize / 2,
						width: stoneSize,
						height: stoneSize,
						backgroundColor: bg,
						opacity: isLocked ? 0.85 : 1,
					},
				]}
			>
				{isFinale ? (
					<Icon name="crown" size={28} color={WHIMSY.paper} />
				) : (
					<Text style={snakeStyles.stoneNum}>{tier}</Text>
				)}

				{/* Claimable: rose-deep ! pill at top-right corner so the
				    stone reads as actionable at a glance. */}
				{isClaimable && (
					<View style={snakeStyles.badgeClaimable}>
						<Text style={snakeStyles.badgeClaimableText}>!</Text>
					</View>
				)}
				{/* Locked: paper lock pill at bottom-right (Icon replaces
				    the prior 🔒 glyph as part of the no-emoji sweep). */}
				{isLocked && (
					<View style={snakeStyles.badgeLocked}>
						<Icon name="lock" size={11} color={WHIMSY.ink} filled />
					</View>
				)}
			</View>

			{/* Reward label + claim button — on the opposite side */}
			<View
				style={[
					snakeStyles.label,
					sideLeft
						? { left: SNAKE_X_L + stoneSize / 2 + 12, right: 8 }
						: { right: SNAKE_X_L + stoneSize / 2 + 12, left: 8 },
				]}
			>
				<Text
					style={[
						snakeStyles.tierCap,
						{ textAlign: sideLeft ? "left" : "right" },
					]}
				>
					Tier {tier}
					{vip && !isFinale && (
						<Text style={snakeStyles.tierVipMarker}> ★ VIP</Text>
					)}
					{isFinale ? "  FINALE" : ""}
				</Text>
				<Text
					style={[
						snakeStyles.rewardName,
						{ textAlign: sideLeft ? "left" : "right" },
						isLocked && { color: WHIMSY.mute },
					]}
					numberOfLines={2}
				>
					{reward?.display_label ?? "—"}
				</Text>
				{isClaimable && (
					<View
						style={{
							alignItems: sideLeft ? "flex-start" : "flex-end",
							marginTop: 4,
						}}
					>
						<Pressable onPress={onClaim} style={snakeStyles.claimBtn}>
							<Text style={snakeStyles.claimBtnText}>Claim ✦</Text>
						</Pressable>
					</View>
				)}
				{isClaimed && (
					<Text
						style={[
							snakeStyles.claimed,
							{ textAlign: sideLeft ? "left" : "right" },
						]}
					>
						✓ claimed
					</Text>
				)}
			</View>
		</View>
	);
}

const snakeStyles = StyleSheet.create({
	stone: {
		position: "absolute",
		borderRadius: 999,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
	},
	stoneNum: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
	},
	label: { position: "absolute", top: 16 },
	tierCap: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		letterSpacing: 0.8,
		textTransform: "uppercase",
	},
	// Inline "★ VIP" accent next to the tier number when a premium-
	// track reward exists for the tier. Lilac-deep so it reads as
	// member-only without overpowering the Tier label.
	tierVipMarker: {
		color: WHIMSY.lilacDeep,
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 0.8,
	},
	rewardName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		marginTop: 2,
	},
	claimBtn: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 5,
	},
	claimBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	claimed: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: "#5a8338",
		marginTop: 2,
	},
	// "!" pill on claimable stones — top-right corner, rose-deep so it
	// reads as actionable urgency.
	badgeClaimable: {
		position: "absolute",
		top: -6,
		right: -6,
		width: 22,
		height: 22,
		borderRadius: 11,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	badgeClaimableText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		lineHeight: 14,
	},
	// "🔒" pill on locked stones — bottom-right corner, paper bg so it
	// reads as inert.
	badgeLocked: {
		position: "absolute",
		bottom: -2,
		right: -2,
		width: 20,
		height: 20,
		borderRadius: 10,
		backgroundColor: WHIMSY.paper,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
});

// ── Vertical-list pass track ─────────────────────────────────────
// Straight column of (node + card) rows. Replaces the snaking
// track. Each tier has three possible visual states:
//
//   claimed  →  sage circle + ✓ corner badge, sage card tint,
//               strikethrough reward text, "CLAIMED" tag
//   ready    →  sun circle + ! rose corner badge, full sun-yellow
//               card highlight, inline "Claim reward ✦" button,
//               "READY" tag
//   locked   →  paper circle + dashed outline + 🔒 corner badge,
//               card with dashed border + muted text, "LOCKED" tag
//
// A dashed vertical connector runs between consecutive nodes;
// stops above the first row and below the last so the line reads
// as the spine of the season.

type TierState = "claimed" | "ready" | "locked";

function tierStatsFor(
	totalTiers: number,
	currentTier: number,
	claimedSet: Set<string>
): { claimed: number; ready: number; locked: number } {
	let claimed = 0,
		ready = 0,
		locked = 0;
	for (let t = 1; t <= totalTiers; t++) {
		if (claimedSet.has(`${t}:free`)) claimed++;
		else if (t <= currentTier) ready++;
		else locked++;
	}
	return { claimed, ready, locked };
}

function StatsPills({
	stats,
}: {
	stats: { claimed: number; ready: number; locked: number };
}) {
	return (
		<View style={vlStyles.statsRow}>
			<View style={[vlStyles.statPill, vlStyles.statPillClaimed]}>
				<Text style={vlStyles.statPillNum}>{stats.claimed}</Text>
				<Text style={vlStyles.statPillLabel}>CLAIMED</Text>
			</View>
			<View style={[vlStyles.statPill, vlStyles.statPillReady]}>
				<Text style={vlStyles.statPillNum}>{stats.ready}</Text>
				<Text style={vlStyles.statPillLabel}>READY</Text>
			</View>
			<View style={[vlStyles.statPill, vlStyles.statPillLocked]}>
				<Text style={vlStyles.statPillNum}>{stats.locked}</Text>
				<Text style={vlStyles.statPillLabel}>LOCKED</Text>
			</View>
		</View>
	);
}

// One node + card row. The node anchors the column visually and
// carries the tier state via its background + corner badge; the
// card on the right carries the reward content + action.
function VLTierRow({
	tier,
	state,
	reward,
	premium,
	isFirst,
	isLast,
	onClaim,
}: {
	tier: number;
	state: TierState;
	reward: TierRow | undefined;
	premium?: boolean;
	isFirst: boolean;
	isLast: boolean;
	onClaim: () => void;
}) {
	if (!reward) return null;
	const isClaimed = state === "claimed";
	const isReady = state === "ready";
	const isLocked = state === "locked";

	// Card background — sun when ready (the full-card highlight),
	// sage when claimed, paper for locked. The locked card also gets
	// a dashed border via vlStyles.cardLocked.
	const cardBg = isReady
		? WHIMSY.sun
		: isClaimed
			? "#cfe2c6" // soft sage tint distinct from the row's regular paper
			: WHIMSY.paper;

	const nodeBg = isReady ? WHIMSY.sun : isClaimed ? "#cfe2c6" : WHIMSY.paper;

	return (
		<View style={vlStyles.row}>
			{/* Column 1 — node + connector segment. The connector is
			    rendered as TWO halves so it can stop at the boundary
			    instead of running through the node circle. */}
			<View style={vlStyles.nodeCol}>
				{!isFirst && <View style={vlStyles.connectorTop} />}
				<View
					style={[
						vlStyles.node,
						{ backgroundColor: nodeBg },
						isLocked && vlStyles.nodeLocked,
					]}
				>
					<StoneThumb reward={reward} locked={isLocked} />
					{/* Corner state badge */}
					{isClaimed && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeClaimed]}>
							<Icon name="check" size={11} color={WHIMSY.paper} strokeWidth={3} />
						</View>
					)}
					{isReady && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeReady]}>
							<Text style={vlStyles.cornerBadgeText}>!</Text>
						</View>
					)}
					{isLocked && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeLocked]}>
							<Icon name="lock" size={10} color={WHIMSY.ink} filled />
						</View>
					)}
				</View>
				{!isLast && <View style={vlStyles.connectorBottom} />}
			</View>

			{/* Column 2 — card. */}
			<View
				style={[
					vlStyles.card,
					{ backgroundColor: cardBg },
					isLocked && vlStyles.cardLocked,
					isReady && vlStyles.cardReady,
				]}
			>
				<View style={vlStyles.cardHeader}>
					<View style={vlStyles.cardHeaderLeft}>
						<Text style={vlStyles.tierCap}>TIER {tier}</Text>
						{premium && (
							<View style={vlStyles.vipPill}>
								<Text style={vlStyles.vipPillStar}>★</Text>
								<Text style={vlStyles.vipPillText}>VIP</Text>
							</View>
						)}
					</View>
					<View
						style={[
							vlStyles.stateTag,
							isClaimed && vlStyles.stateTagClaimed,
							isReady && vlStyles.stateTagReady,
							isLocked && vlStyles.stateTagLocked,
						]}
					>
						{isClaimed && (
							<Icon name="check" size={10} color={WHIMSY.ink} strokeWidth={3} />
						)}
						{isLocked && (
							<Icon name="lock" size={9} color={WHIMSY.mute} filled />
						)}
						<Text
							style={[
								vlStyles.stateTagText,
								isLocked && { color: WHIMSY.mute },
							]}
						>
							{isClaimed ? "CLAIMED" : isReady ? "READY" : "LOCKED"}
						</Text>
					</View>
				</View>
				<Text
					style={[
						vlStyles.rewardLabel,
						isClaimed && vlStyles.rewardLabelClaimed,
						isLocked && { color: WHIMSY.mute },
					]}
					numberOfLines={2}
				>
					{reward.display_label}
				</Text>
				{isReady && (
					<Pressable
						onPress={onClaim}
						style={({ pressed }) => [
							vlStyles.claimBtn,
							pressed && { opacity: 0.85 },
						]}
					>
						<Text style={vlStyles.claimBtnText}>Claim reward ✦</Text>
					</Pressable>
				)}
			</View>
		</View>
	);
}

function VerticalListPassTrack({
	totalTiers,
	currentTier,
	tiersByNumber,
	claimedSet,
	onClaim,
}: {
	totalTiers: number;
	currentTier: number;
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>;
	claimedSet: Set<string>;
	onClaim: (tier: number, track: "free" | "premium") => void;
}) {
	const stats = tierStatsFor(totalTiers, currentTier, claimedSet);
	const tiers = Array.from({ length: totalTiers }, (_, i) => i + 1);
	return (
		<View>
			<StatsPills stats={stats} />
			<View style={{ marginTop: 8 }}>
				{tiers.map((t, i) => {
					const free = tiersByNumber[t]?.free;
					const hasVipReward = !!tiersByNumber[t]?.premium;
					const state: TierState = claimedSet.has(`${t}:free`)
						? "claimed"
						: t <= currentTier
							? "ready"
							: "locked";
					return (
						<VLTierRow
							key={t}
							tier={t}
							state={state}
							reward={free}
							premium={hasVipReward}
							isFirst={i === 0}
							isLast={i === tiers.length - 1}
							onClaim={() => onClaim(t, "free")}
						/>
					);
				})}
			</View>
		</View>
	);
}

const vlStyles = StyleSheet.create({
	// Stats pill row above the list. Display-only counters per the
	// resolved decision; no tap-to-filter behavior.
	statsRow: {
		flexDirection: "row",
		gap: 8,
		marginTop: 6,
		marginBottom: 4,
	},
	statPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	statPillClaimed: { backgroundColor: "#cfe2c6" },
	statPillReady: { backgroundColor: WHIMSY.sun },
	statPillLocked: { backgroundColor: WHIMSY.paper },
	statPillNum: {
		fontFamily: FONTS.whimsy,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	statPillLabel: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1,
		color: WHIMSY.ink,
	},

	// Row layout — node column + card column side-by-side.
	row: {
		flexDirection: "row",
		alignItems: "stretch",
	},

	// Node column — fixed width so the spine reads as a clean line
	// down the screen. Connector halves fill above + below the node.
	nodeCol: {
		width: 64,
		alignItems: "center",
	},
	connectorTop: {
		width: 0,
		height: 12,
		borderLeftWidth: 1.5,
		borderLeftColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	connectorBottom: {
		flex: 1,
		width: 0,
		borderLeftWidth: 1.5,
		borderLeftColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	node: {
		width: 52,
		height: 52,
		borderRadius: 26,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	nodeLocked: {
		borderStyle: "dashed",
		borderColor: WHIMSY.muteSoft,
		shadowOpacity: 0,
		elevation: 0,
	},
	cornerBadge: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	cornerBadgeClaimed: { backgroundColor: "#5a8338" },
	cornerBadgeReady: { backgroundColor: WHIMSY.roseDeep },
	cornerBadgeLocked: { backgroundColor: WHIMSY.paper },
	cornerBadgeText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		lineHeight: 13,
	},

	// Card column.
	card: {
		flex: 1,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 14,
		paddingVertical: 12,
		marginVertical: 6,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	cardReady: {
		shadowOffset: { width: 3, height: 3 },
		shadowOpacity: 1,
	},
	cardLocked: {
		borderStyle: "dashed",
		borderColor: WHIMSY.muteSoft,
		shadowOpacity: 0,
		elevation: 0,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 4,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: 6,
		flexShrink: 1,
	},
	tierCap: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.4,
		color: WHIMSY.mute,
	},
	// Inline VIP pill — lilac with star, marks tiers that ALSO have
	// a premium-track reward attached.
	vipPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
		backgroundColor: WHIMSY.lilacDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 8,
		paddingVertical: 1,
	},
	vipPillStar: {
		color: WHIMSY.paper,
		fontFamily: FONTS.whimsy,
		fontSize: 10,
	},
	vipPillText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 0.8,
	},
	// Right-side state tag (CLAIMED / READY / LOCKED).
	stateTag: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 10,
		paddingVertical: 3,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	stateTagClaimed: { backgroundColor: "#cfe2c6" },
	stateTagReady: { backgroundColor: WHIMSY.roseDeep },
	stateTagLocked: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.muteSoft,
	},
	stateTagText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 0.8,
		color: WHIMSY.ink,
	},
	rewardLabel: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		marginTop: 2,
	},
	rewardLabelClaimed: {
		textDecorationLine: "line-through",
		color: WHIMSY.mute,
	},
	// Ready-state inline Claim CTA — black pill with white text,
	// matches the design's full-width button inside the highlight.
	claimBtn: {
		marginTop: 10,
		backgroundColor: WHIMSY.ink,
		borderRadius: 999,
		paddingVertical: 10,
		alignItems: "center",
	},
	claimBtnText: {
		color: WHIMSY.paper,
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		letterSpacing: 0.4,
	},
});

export default function SeasonScreen() {
	const [state, setState] = useState<SeasonState | null>(null);
	const [busy, setBusy] = useState(false);
	const [saleOpen, setSaleOpen] = useState(false);
	// Reward dialog: set after a successful claim_tier_reward RPC so the
	// user gets a beat to read what they got and (for wearables) jump
	// straight to the wardrobe to equip it.
	const [claimedReward, setClaimedReward] = useState<TierRow | null>(null);

	// Tier-up celebration: fires the banner + fanfare whenever
	// season_state's current_tier increases between loads. Initial
	// mount records the starting tier without firing (don't celebrate
	// just because the user opened the tab at tier 7).
	const tierBannerRef = useRef<TierUpBannerHandle>(null);
	const lastSeenTier = useRef<number | null>(null);
	const claimPlayer = useAudioPlayer(claimSound);

	const load = useCallback(async () => {
		const { data, error } = await supabase.rpc("season_state");
		if (error) return console.error(error);
		setState(data as SeasonState);
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// Detect tier-up between successive season_state loads. Record the
	// first observed tier as a baseline (no celebration on initial open)
	// then fire the banner the next time the tier crosses higher.
	useEffect(() => {
		const t = state?.current_tier;
		if (typeof t !== "number") return;
		if (lastSeenTier.current === null) {
			lastSeenTier.current = t;
			return;
		}
		if (t > lastSeenTier.current) {
			tierBannerRef.current?.fire(t);
		}
		lastSeenTier.current = t;
	}, [state?.current_tier]);

	const claimedSet = useMemo(() => {
		const s = new Set<string>();
		(state?.claims ?? []).forEach((c) => s.add(`${c.tier}:${c.track}`));
		return s;
	}, [state?.claims]);

	const tiersByNumber = useMemo(() => {
		const map: Record<number, { free?: TierRow; premium?: TierRow }> = {};
		(state?.tiers ?? []).forEach((t) => {
			if (!map[t.tier]) map[t.tier] = {};
			map[t.tier][t.track] = t;
		});
		return map;
	}, [state?.tiers]);

	const handleClaim = async (tier: number, track: "free" | "premium") => {
		if (busy) return;
		setBusy(true);
		const { data, error } = await supabase.rpc("claim_tier_reward", {
			target_tier: tier,
			target_track: track,
		});
		setBusy(false);
		if (error) return Alert.alert("Couldn't claim", "Try again.");
		const r = data as {
			ok: boolean;
			reason?: string;
			current_tier?: number;
		};
		if (!r.ok) {
			const map: Record<string, string> = {
				tier_locked: `Reach tier ${tier} first (you're at ${r.current_tier}).`,
				premium_locked: "Unlock the Premium pass to claim.",
				already_claimed: "Already claimed.",
				no_active_season: "No active season.",
				no_reward: "Nothing here.",
			};
			Alert.alert("Locked", map[r.reason ?? ""] ?? "Couldn't claim.");
			return;
		}
		// Claim succeeded — magical chime + light haptic confirmation.
		// Tier-up celebration (if the claim actually crossed a tier
		// boundary) fires separately from the useEffect that watches
		// current_tier after load().
		try {
			claimPlayer.seekTo(0);
			claimPlayer.play();
		} catch {}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
			() => {}
		);
		// Surface a reward dialog so the user sees what they got + can
		// jump to the wardrobe to equip wearables.
		const claimedRow = tiersByNumber[tier]?.[track];
		if (claimedRow) setClaimedReward(claimedRow);
		load();
	};

	const handleBuySeasonPass = async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		try {
			await initIAP(user.id);
		} catch {}

		// The Season Pass is a one-time product — buy it directly (the
		// BattlePassSaleModal is the merchandising), NOT via the
		// subscription paywall. On success, grant_season_pass flips
		// premium_unlocked for the active season.
		const result = await purchaseProductId(PRODUCT_IDS.seasonPass);
		if (result.ok) {
			await supabase.rpc("grant_season_pass");
			load();
			Alert.alert(
				"Season Pass unlocked",
				"The premium reward track is yours for this season."
			);
			return;
		}
		if (result.reason === "cancelled") return;
		if (result.reason === "product_not_found") {
			// The product isn't in a RevenueCat offering yet.
			Alert.alert(
				"Season Pass",
				"Storefront not configured yet. Unlock for free in dev?",
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Unlock (dev)",
						onPress: async () => {
							await supabase.rpc("grant_season_pass");
							load();
						},
					},
				]
			);
			return;
		}
		Alert.alert("Couldn't buy the Season Pass", "Please try again.");
	};

	if (!state) {
		return (
			<View style={[styles.container, styles.center]}>
				<Text style={styles.empty}>Loading...</Text>
			</View>
		);
	}
	if (!state.active) {
		return (
			<View style={[styles.container, styles.center]}>
				<Text style={styles.empty}>No active season.</Text>
			</View>
		);
	}

	const season = state.season!;
	const tier = state.current_tier ?? 1;
	const premium = state.premium_unlocked ?? false;

	return (
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					{/* "Goblins vs Angels" — the redesigned framing for Season 1. */}
					<Text style={styles.kicker}>★ {season.name.toLowerCase()}</Text>
					<Text style={styles.title}>Goblins vs Angels</Text>
					<View style={styles.titleRule} />
				</View>

				{/* The standalone XP progress card was dropped per the
				    redesign — tier + total now reads from the
				    "season pass / Tier N/M" SectionHeader inline with
				    the snake track, and the snake stones themselves
				    show progress via their fill state. The Unlock
				    Premium CTA moved into the SectionHeader's right
				    slot below. */}

				<ScrollView contentContainerStyle={styles.tierList}>
					<BountyBoard />

					{/* Section header for the pass — matches BountyBoard's
					    header above so the two sections sit in the same
					    visual rhythm. */}
					<View style={{ marginTop: 8 }}>
						<SectionHeader
							kicker="season pass"
							title={`Tier ${tier}/${season.total_tiers}`}
							ruleWidth={110}
							right={
								PAID_BATTLE_PASS_ENABLED && IAP_ENABLED && !premium ? (
									<>
										<Text style={styles.vipKicker}>★ VIP</Text>
										<Pressable
											onPress={() => setSaleOpen(true)}
											style={styles.unlockBtn}
										>
											<Text style={styles.unlockBtnText}>Unlock</Text>
										</Pressable>
									</>
								) : undefined
							}
						/>
					</View>

					{/* Vertical-list pass track — straight column of node +
					    card rows with per-state visual treatment (sage
					    claimed / sun-yellow ready / dashed locked) and
					    display-only stats pills above. Replaces the
					    snake; matches the design's bottom-of-screen
					    reference. */}
					<VerticalListPassTrack
						totalTiers={season.total_tiers}
						currentTier={tier}
						tiersByNumber={tiersByNumber}
						claimedSet={claimedSet}
						onClaim={handleClaim}
					/>
				</ScrollView>
			</SafeAreaView>

			<BattlePassSaleModal
				visible={PAID_BATTLE_PASS_ENABLED && saleOpen}
				onClose={() => setSaleOpen(false)}
				onUnlock={async () => {
					setSaleOpen(false);
					await handleBuySeasonPass();
				}}
				priceCents={season.premium_price_cents}
				currentTier={tier}
				totalTiers={season.total_tiers}
				busy={busy}
			/>
			{/* Fires on every cross-tier increase. Mounted at root so the
			    sliding banner overlays the season list. */}
			<TierUpBanner ref={tierBannerRef} />

			<ClaimRewardDialog
				reward={claimedReward}
				onClose={() => setClaimedReward(null)}
				onShow={() => {
					setClaimedReward(null);
					router.push({
						pathname: "/(tabs)/shop",
						params: { view: "wardrobe" },
					});
				}}
			/>
		</View>
	);
}

// ───────────────────────────────────────────────────────────────
// Reward dialog shown after a successful claim_tier_reward RPC.
// Shows the item the user just won and (for wearables) offers a
// "Show in wardrobe" button that deep-links to shop?view=wardrobe.
// ───────────────────────────────────────────────────────────────
function ClaimRewardDialog({
	reward,
	onClose,
	onShow,
}: {
	reward: TierRow | null;
	onClose: () => void;
	onShow: () => void;
}) {
	if (!reward) return null;
	const { reward_type: type, reward_value: val, display_label } = reward;
	const itemId =
		val?.hat_id ?? val?.bg_id ?? val?.aura_id ?? val?.cape_id ?? null;
	// Wearables route to the wardrobe; tickle/title/boost/etc. show a
	// close-only dialog since there's nothing to equip.
	const wearableTypes = new Set([
		"hat", "background", "aura", "cape", "scarf",
		"mask", "necklace", "glasses", "bow", "held",
	]);
	const isWearable =
		wearableTypes.has(type) && !!itemId && !HIDDEN_CATEGORIES.has(type);

	const preview =
		itemId && HAT_IMAGES[itemId] ? (
			<Image
				source={HAT_IMAGES[itemId]}
				style={rewardStyles.heroImage}
				resizeMode="contain"
			/>
		) : type === "tickles" ? (
			<View style={rewardStyles.heroFallback}>
				<TickleIcon size={64} />
			</View>
		) : (
			<View style={rewardStyles.heroFallback}>
				<Icon name="star" size={56} filled color="#C99B23" />
			</View>
		);

	return (
		<Modal
			visible
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<View style={rewardStyles.backdrop}>
				<Sticker color="paper" rotate={-1.2} radius={20} style={rewardStyles.card}>
					<Text style={rewardStyles.kicker}>★ unlocked</Text>
					<View style={rewardStyles.hero}>{preview}</View>
					<Text style={rewardStyles.title}>{display_label}</Text>
					<View style={rewardStyles.actions}>
						{isWearable && (
							<Button size="md" variant="primary" onPress={onShow}>
								Show in wardrobe
							</Button>
						)}
						<Pressable onPress={onClose} style={rewardStyles.dismissLink}>
							<Text style={rewardStyles.dismissText}>
								{isWearable ? "Not now" : "OK"}
							</Text>
						</Pressable>
					</View>
				</Sticker>
			</View>
		</Modal>
	);
}

const rewardStyles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: MODAL_BACKDROP_BG,
		alignItems: "center",
		justifyContent: "center",
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
	hero: {
		width: 160,
		height: 160,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: 4,
	},
	heroImage: {
		width: 140,
		height: 140,
	},
	heroFallback: {
		width: 140,
		height: 140,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 999,
		backgroundColor: WHIMSY.paper,
	},
	title: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 16,
	},
	actions: {
		alignItems: "center",
		gap: 8,
		width: "100%",
	},
	dismissLink: {
		paddingVertical: 6,
		paddingHorizontal: 12,
	},
	dismissText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	center: { alignItems: "center", justifyContent: "center" },
	empty: {
		color: WHIMSY.mute,
		padding: 24,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: 8,
	},
	kicker: {
		...KICKER_TEXT,
		marginBottom: 4,
	},
	title: {
		fontSize: 30,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
		lineHeight: 32,
	},
	titleRule: {
		...TITLE_RULE,
		width: 90,
		marginTop: 4,
	},
	// Right-slot decorations for the season-pass SectionHeader.
	vipKicker: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.lilacDeep,
		marginRight: 6,
	},
	unlockBtn: {
		backgroundColor: WHIMSY.lilacDeep,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 4,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
	},
	unlockBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.paper,
	},
	ctas: { flexDirection: "row", gap: 8, marginTop: 12 },
	tierList: {
		padding: 14,
		paddingBottom: 110,
		gap: 14,
	},
	tierRow: {
		flexDirection: "row",
		alignItems: "stretch",
		gap: 8,
	},
	tierRowCurrent: {},
	tierStoneNum: {
		width: 36,
		alignItems: "center",
		justifyContent: "flex-start",
		paddingTop: 8,
	},
	stoneCircle: {
		width: 36,
		height: 36,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	stoneCircleText: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	stoneCell: {
		flex: 1,
		padding: 10,
		minHeight: 96,
	},
	stoneTop: {
		flexDirection: "row",
		gap: 8,
		alignItems: "flex-start",
	},
	stone: {
		width: 42,
		height: 42,
		borderRadius: 10,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	titleGlyph: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
	},
	stoneLabel: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.ink,
		lineHeight: 16,
	},
	// Premium marker on the tier rows — lock icon (locked) or ★
	// (unlocked) sitting inline with the "premium" word. Row layout
	// keeps the icon + text on the same baseline.
	stonePremRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginTop: 3,
	},
	stonePrem: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.lilacDeep,
	},
	stonePremStar: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.lilacDeep,
	},
	stoneFinale: {
		fontFamily: FONTS.whimsy,
		fontSize: 11,
		color: WHIMSY.accent,
		marginTop: 4,
		letterSpacing: 0.4,
	},
	claimBtn: {
		marginTop: 8,
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingVertical: 6,
		alignItems: "center",
	},
	claimBtnText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	claimedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 4,
		marginTop: 6,
	},
	claimedText: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.ink,
	},
	lockedRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		marginTop: 6,
	},
	lockedDashed: {
		flex: 0,
		width: 18,
		height: 0,
		borderTopWidth: 1.5,
		borderColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	lockedText: {
		fontFamily: FONTS.hand,
		fontSize: 11,
		color: WHIMSY.muteSoft,
	},
});
