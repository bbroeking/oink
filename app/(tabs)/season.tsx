import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	Platform,
	SafeAreaView,
	Text,
	Image,
	Pressable,
	Modal,
} from "react-native";
import Svg, { Path as SvgPath } from "react-native-svg";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import {
	IAP_ENABLED,
	presentPaywall,
	OFFERING_IDS,
} from "../../utils/iap";
import { Sticker } from "../../components/ui/Sticker";
import { EmptyState, LoadingBeat } from "../../components/ui/EmptyState";
import { usePopupSlot, POPUP_TEARDOWN_MS } from "../../components/ui/PopupQueue";
import { markCeremonyShown } from "../../utils/ceremonyGate";
import { Icon } from "../../components/ui/Icon";
import {
	MysteryHatReveal,
	type MysteryBoxRevealPayload,
} from "../../components/MysteryHatReveal";
import { Glyph, type GlyphName } from "../../components/ui/Glyph";
import { TickleIcon } from "../../components/ui/SnoutCoin";
import { GreatHungerIntroModal } from "../../components/GreatHungerIntroModal";
import {
	SeasonEndModal,
	DEV_PREVIEW_REWARDS,
} from "../../components/SeasonEndModal";
import { useSeasonEnd } from "../../hooks/useSeasonEnd";
import type { BetaReward } from "../../hooks/useSeasonEnd";
import { HungerHero } from "../../components/season1/HungerHero";
import { TickleBreakdownSheet } from "../../components/TickleBreakdownSheet";
import { WindowStrip } from "../../components/season1/WindowStrip";
import { SounderHomeCard } from "../../components/season1/SounderHomeCard";
import { SounderStepCard } from "../../components/season1/SounderStepCard";
import { useFeedingCta } from "../../components/mudwar/useFeedingCta";
import { YourTakeStrip, type NextReward } from "../../components/season1/YourTakeStrip";
import { useSounderPath } from "../../hooks/useSounderPath";
import {
	SpotlightProvider,
	SpotlightOverlay,
} from "../../components/ui/Spotlight";
import {
	useJoinSpotlight,
	JOIN_SPOTLIGHT_TARGET_ID,
} from "../../hooks/useJoinSpotlight";
import { RaceSection } from "../../components/season1/RaceSection";
import { SeasonGuideModal } from "../../components/season1/SeasonGuideModal";
import {
	SeasonInfoModal,
	type SeasonInfoTopic,
} from "../../components/season1/SeasonInfoModal";
import { useCrew } from "../../hooks/useCrew";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFeatureFlag } from "../../hooks/useFeatureFlags";
import { AlignmentBar } from "../../components/ui/AlignmentBar";
import { AlignmentExplainerModal } from "../../components/AlignmentExplainerModal";
import { alignmentEffects } from "@/utils/alignment";
import {
	TierUpBanner,
	type TierUpBannerHandle,
} from "../../components/ui/TierUpBanner";
import { HAT_IMAGES, HIDDEN_CATEGORIES } from "@/constants/hats";
import { COLORS, FONTS, KICKER_TEXT, TITLE_RULE, WHIMSY, MODAL_BACKDROP_BG, STICKER_SHADOW, SHADOW_SM, PAGE_PAD, TAB_SAFE, RADII, SPACE, TYPE } from "@/constants/theme";
import { daysUntilJudgement } from "@/utils/season";
import { Button, SectionHeader } from "../../components/ui";
import { PURCHASES_LIVE } from "../../constants/featureFlags";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";

const claimSound = require("../../assets/sounds/claim.mp3");

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
		inner = <Icon name="flame" size={22} filled color={WHIMSY.flame} strokeWidth={1.5} />;
	} else if (type === "background") {
		// Reachable only by a legacy background/aura/cape row that carries NO
		// resolvable art (no hat_id + no HAT_IMAGES entry) — the hatItemTypes
		// branch above wins whenever art exists. Kept as the art-less fallback
		// glyph for those un-migrated rows, not shadowed dead code.
		inner = <Icon name="globe" size={22} color={WHIMSY.ink} strokeWidth={1.6} />;
	} else if (type === "aura") {
		inner = <Icon name="premium" size={22} color={WHIMSY.bless} strokeWidth={1.6} />;
	} else if (type === "cape") {
		inner = <Icon name="star" size={22} color={WHIMSY.ink} strokeWidth={1.6} />;
	} else if (type === "mystery_box" || type === "cap_increase" || type === "pig_skin") {
		inner = <Icon name="star" size={22} filled color={WHIMSY.bless} strokeWidth={1.6} />;
	}

	return (
		<View style={[styles.stone, locked && { opacity: 0.55 }]}>{inner}</View>
	);
}

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
			? WHIMSY.sage // soft sage tint distinct from the row's regular paper
			: WHIMSY.paper;

	const nodeBg = isReady ? WHIMSY.sun : isClaimed ? WHIMSY.sage : WHIMSY.paper;

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
							<View
								style={vlStyles.clubCrest}
								accessibilityLabel="also has a Slop Club reward"
							>
								<Icon name="premium" size={12} color={WHIMSY.ink} filled />
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
					<View style={vlStyles.claimBtnWrap}>
						<Button size="sm" variant="dark" full onPress={onClaim}>
							Claim reward ✦
						</Button>
					</View>
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
	track,
	premiumUnlocked,
}: {
	totalTiers: number;
	currentTier: number;
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>;
	claimedSet: Set<string>;
	onClaim: (tier: number, track: "free" | "premium") => void;
	track: "free" | "premium";
	premiumUnlocked: boolean;
}) {
	// Premium track under glass — every row locked, no claim, no VIP
	// pill (the whole track is premium). Otherwise the normal per-tier
	// stats (free track, or an unlocked premium track).
	const premiumLocked = track === "premium" && !premiumUnlocked;
	const stats = premiumLocked
		? { claimed: 0, ready: 0, locked: totalTiers }
		: tierStatsFor(totalTiers, currentTier, claimedSet);

	const stateFor = (t: number): TierState =>
		premiumLocked
			? "locked"
			: claimedSet.has(`${t}:${track}`)
				? "claimed"
				: t <= currentTier
					? "ready"
					: "locked";

	// Peak-end: don't end every session scrolling a 20-row lock wall. Always show
	// the context around where the player is (current ±2), EVERY ready-to-claim
	// tier wherever it sits, and the NEXT reward above current even if it's far
	// off (so there's always a "here's what's next" beat). Collapse the long
	// locked tail behind an expandable row. Expansion is remembered for the
	// session (the tab stays mounted).
	const [expanded, setExpanded] = useState(false);

	const tiers = Array.from({ length: totalTiers }, (_, i) => i + 1);

	// The next reward above the current tier — the lowest locked tier that
	// actually carries a reward on this track.
	const nextRewardTier = tiers.find(
		(t) => t > currentTier && !!tiersByNumber[t]?.[track]
	);

	const alwaysShown = (t: number): boolean =>
		Math.abs(t - currentTier) <= 2 || // current ±2 context
		stateFor(t) === "ready" || // every claimable tier
		t === nextRewardTier; // the next milestone above current

	const visibleTiers = expanded ? tiers : tiers.filter(alwaysShown);
	const hiddenCount = totalTiers - visibleTiers.length;

	return (
		<View>
			<StatsPills stats={stats} />
			<View style={{ marginTop: 8 }}>
				{visibleTiers.map((t, i) => {
					const reward = tiersByNumber[t]?.[track];
					// The club-crest mark only makes sense on the free track — it marks
					// a free row that ALSO carries a premium (Slop Club) reward.
					const hasVipReward =
						track === "free" && !!tiersByNumber[t]?.premium;
					return (
						<VLTierRow
							key={t}
							tier={t}
							state={stateFor(t)}
							reward={reward}
							premium={hasVipReward}
							isFirst={i === 0}
							isLast={i === visibleTiers.length - 1}
							onClaim={() => onClaim(t, track)}
						/>
					);
				})}
			</View>
			{!expanded && hiddenCount > 0 && (
				<Pressable
					onPress={() => setExpanded(true)}
					hitSlop={6}
					accessibilityRole="button"
					accessibilityLabel={`Show ${hiddenCount} more tiers`}
					style={({ pressed }) => [
						collapseStyles.row,
						pressed && { opacity: 0.6 },
					]}
				>
					<Text style={collapseStyles.text}>
						…and {hiddenCount} more {hiddenCount === 1 ? "tier" : "tiers"} ›
					</Text>
				</Pressable>
			)}
		</View>
	);
}

const collapseStyles = StyleSheet.create({
	// The "…and N more tiers ›" expander that hides the long locked tail.
	row: {
		alignSelf: "center",
		marginTop: SPACE.xs,
		marginBottom: SPACE.xs,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.lg,
	},
	text: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
		textAlign: "center",
	},
});

// 2-segment Free / Premium toggle above the pass list. Both segments
// are always tappable — viewing a locked premium track is the point.
// Active segment: sun fill + ink outline + whimsy font; inactive: paper.
function PassTrackTabs({
	track,
	onChange,
	premiumUnlocked,
}: {
	track: "free" | "premium";
	onChange: (t: "free" | "premium") => void;
	premiumUnlocked: boolean;
}) {
	const segments: { key: "free" | "premium"; label: string }[] = [
		{ key: "free", label: "Free" },
		{ key: "premium", label: "Premium" },
	];
	return (
		<View style={passTabStyles.row}>
			{segments.map((seg) => {
				const active = track === seg.key;
				const showLock = seg.key === "premium" && !premiumUnlocked;
				return (
					<Pressable
						key={seg.key}
						onPress={() => onChange(seg.key)}
						style={({ pressed }) => [
							passTabStyles.seg,
							active ? passTabStyles.segActive : passTabStyles.segInactive,
							pressed && !active && { opacity: 0.7 },
						]}
						accessibilityRole="button"
						accessibilityState={{ selected: active }}
						accessibilityLabel={`${seg.label} pass track`}
					>
						{showLock && (
							<Icon name="lock" size={11} color={WHIMSY.ink} filled />
						)}
						<Text style={passTabStyles.segText}>{seg.label}</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

// Locked-premium call-to-action banner. Sits above the list when the player is
// browsing the premium track without membership. States the truth — the premium
// track is a Slop Club perk (not a separate pass) — and its CTA opens the same
// Slop Club paywall the shop + Account use. Slop Club gold identity, matching
// the members band elsewhere.
function PremiumLockedBanner({ onUnlock }: { onUnlock: () => void }) {
	return (
		<Sticker color="paper" rotate={-0.6} radius={RADII.xl} style={passBannerStyles.wrap}>
			<View style={passBannerStyles.crest}>
				<Icon name="premium" size={18} color={WHIMSY.ink} filled />
			</View>
			<View style={passBannerStyles.textCol}>
				<Text style={passBannerStyles.title}>A Slop Club perk</Text>
				<Text style={passBannerStyles.body}>
					The premium track comes with Slop Club — join to claim every reward on it.
				</Text>
			</View>
			<Pressable
				onPress={PURCHASES_LIVE ? onUnlock : undefined}
				disabled={!PURCHASES_LIVE}
				style={({ pressed }) => [
					passBannerStyles.btn,
					pressed && PURCHASES_LIVE && { opacity: 0.85 },
					!PURCHASES_LIVE && { opacity: 0.75 },
				]}
				accessibilityRole="button"
				accessibilityLabel={
					PURCHASES_LIVE ? "Join the Slop Club" : "Slop Club coming soon"
				}
			>
				<Text style={passBannerStyles.btnText}>
					{PURCHASES_LIVE ? "Join ›" : "Soon…"}
				</Text>
			</Pressable>
		</Sticker>
	);
}

// The ready-claim shortcut — a sun-yellow sticker bar above the pass track
// whenever ANY tier is ready to claim (the founder's note: a ready reward
// announced only at the page bottom is a ready reward nobody sees). One ready
// tier names its reward ("25 tickles is ready — claim ›"); two or more sweep
// in one tap. The row itself is the affordance (no separate CTA), sinking into
// its hard shadow when pressed.
function ClaimAllBar({
	count,
	label,
	busy,
	onPress,
}: {
	count: number;
	/** The single ready tier's display label (count === 1 only) — names the reward. */
	label?: string;
	busy: boolean;
	onPress: () => void;
}) {
	const single = count === 1;
	return (
		<Pressable
			onPress={busy ? undefined : onPress}
			disabled={busy}
			accessibilityRole="button"
			accessibilityLabel={
				single
					? `Claim ${label ?? "your ready reward"}`
					: `Claim all ${count} ready rewards`
			}
			style={({ pressed }) => [
				claimAllStyles.bar,
				pressed && !busy && claimAllStyles.barPressed,
				busy && { opacity: 0.7 },
			]}
		>
			<Glyph name="gift" size={18} />
			<Text style={claimAllStyles.text}>
				{single ? `${label ?? "a reward"} is ready` : `${count} rewards ready`}
			</Text>
			<Text style={claimAllStyles.cta}>
				{busy ? "claiming…" : single ? "claim ›" : "claim all ›"}
			</Text>
		</Pressable>
	);
}

const claimAllStyles = StyleSheet.create({
	bar: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md + 2,
		paddingVertical: SPACE.sm + 2,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
		...SHADOW_SM,
	},
	barPressed: {
		transform: [{ translateX: 2 }, { translateY: 2 }],
		shadowOpacity: 0,
		elevation: 0,
	},
	text: {
		flex: 1,
		...TYPE.numeral,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	cta: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
});

const vlStyles = StyleSheet.create({
	// Stats pill row above the list. Display-only counters per the
	// resolved decision; no tap-to-filter behavior.
	statsRow: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.xs + 2,
		marginBottom: SPACE.xs,
	},
	statPill: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs + 2,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	statPillClaimed: { backgroundColor: WHIMSY.sage },
	statPillReady: { backgroundColor: WHIMSY.sun },
	statPillLocked: { backgroundColor: WHIMSY.paper },
	statPillNum: {
		...TYPE.numeral,
		fontSize: 14,
		color: WHIMSY.ink,
	},
	statPillLabel: {
		...TYPE.kickerPill,
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
		height: SPACE.md,
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
		borderRadius: RADII.pill,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
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
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
	},
	// The claimed check rides a saturated success-green FILL (not the darker
	// success TEXT token) so the paper check reads with contrast.
	cornerBadgeClaimed: { backgroundColor: COLORS.success },
	cornerBadgeReady: { backgroundColor: WHIMSY.roseDeep },
	cornerBadgeLocked: { backgroundColor: WHIMSY.paper },
	cornerBadgeText: {
		color: WHIMSY.paper,
		...TYPE.kickerPill,
		letterSpacing: 0,
		lineHeight: 13,
	},

	// Card column.
	card: {
		flex: 1,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.md + 2,
		paddingVertical: SPACE.md,
		marginVertical: SPACE.xs + 2,
		...STICKER_SHADOW,
	},
	cardReady: {
		...STICKER_SHADOW,
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
		marginBottom: SPACE.xs,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs + 2,
		flexShrink: 1,
	},
	tierCap: {
		...TYPE.kickerPill,
		letterSpacing: 1.4,
		color: WHIMSY.mute,
	},
	// Slop Club crest — a small gold-chip mark on free rows that ALSO carry a
	// premium-track reward. Reads as "there's a Slop Club reward here too", never
	// as "VIP-only" (the row's free reward is claimable by anyone). Slop Club gold
	// + ink border, matching the shop's members identity.
	clubCrest: {
		width: 20,
		height: 20,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.slopGold,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
	},
	// Right-side state tag (CLAIMED / READY / LOCKED).
	stateTag: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		paddingHorizontal: SPACE.sm + 2,
		paddingVertical: 3,
		borderRadius: RADII.pill,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	stateTagClaimed: { backgroundColor: WHIMSY.sage },
	stateTagReady: { backgroundColor: WHIMSY.roseDeep },
	stateTagLocked: {
		backgroundColor: "transparent",
		borderColor: WHIMSY.muteSoft,
	},
	stateTagText: {
		...TYPE.kickerPill,
		letterSpacing: 0.8,
		color: WHIMSY.ink,
	},
	rewardLabel: {
		...TYPE.numeral,
		color: WHIMSY.ink,
		marginTop: 2,
	},
	rewardLabelClaimed: {
		textDecorationLine: "line-through",
		color: WHIMSY.mute,
	},
	// Ready-state inline Claim CTA — the shared dark Button primitive (ink pill,
	// full width) inside the highlight; this wrap just owns the top gap.
	claimBtnWrap: {
		marginTop: SPACE.sm + 2,
	},
});

// Free / Premium track toggle. Mirrors the app's pill/segment look
// (ink outline, whimsy font) — there's no shared segment primitive.
const passTabStyles = StyleSheet.create({
	row: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	seg: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 5,
		paddingVertical: SPACE.sm,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	segActive: { backgroundColor: WHIMSY.sun },
	segInactive: { backgroundColor: WHIMSY.paper },
	segText: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
});

// Locked-premium "join the Slop Club" banner — the Slop Club gold identity.
const passBannerStyles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.md,
		paddingHorizontal: SPACE.md + 2,
		paddingVertical: SPACE.md,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
		backgroundColor: WHIMSY.slopBand,
	},
	// The Slop Club crest — gold chip + ink border, matching the members ribbon.
	crest: {
		width: 34,
		height: 34,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.slopGold,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	textCol: {
		flex: 1,
		minWidth: 0,
	},
	title: {
		...TYPE.numeral,
		color: WHIMSY.ink,
	},
	body: {
		...TYPE.bodySm,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		marginTop: 2,
	},
	btn: {
		backgroundColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: SPACE.lg + 2,
		paddingVertical: SPACE.sm + 1,
	},
	btnText: {
		color: WHIMSY.paper,
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		letterSpacing: 0.4,
	},
});

export default function SeasonScreen() {
	const [state, setState] = useState<SeasonState | null>(null);
	const [busy, setBusy] = useState(false);
	// Season-1 mode — the world_boss server flag (seeded by the held
	// 20260704200000 migration) with the __DEV__ escape hatch so the local
	// test account lives in the new season before the flag flips for anyone
	// else. Season-0 rendering is fully preserved on the else-branch.
	const worldBoss = useFeatureFlag("world_boss");
	const s1 = worldBoss || __DEV__;
	// The Great Hunger intro — the tale cinematic. Auto-opens on this account's
	// FIRST visit to the Season-1 tab (AsyncStorage stamp, per-user) and
	// re-opens any time from the hero's "Hear the tale again" chip.
	const [introOpen, setIntroOpen] = useState(false);
	const [uid, setUid] = useState<string | null>(null);
	// Sounder state drives the walkthrough stepper (join → dig).
	const crewHook = useCrew(s1);
	// The onboarding funnel step — DERIVED from server/client state (never stored),
	// so the "do this now" slot always shows the right next move and retires itself
	// at DONE. Re-reads on focus; we also refresh() it after a dig / crew change.
	const sounderPath = useSounderPath(s1);
	// The "join a Sounder" coach-mark gate — lights once, on the `join` step, when
	// the master flag is on (SPOTLIGHT_ENABLED, __DEV__ for now so it ships dark).
	// The step card nests the SpotlightTarget around just its join door; we only
	// pass `joinSpotlight.show` down as the active gate.
	const joinSpotlight = useJoinSpotlight(sounderPath.step);
	// Bumped after every real dig submit — the patch modal never blurs this
	// screen, so the meter / herd presence / milestones need an explicit tick
	// to leave their pre-dig numbers behind (stale-cards bug, 2026-07-07).
	const [digTick, setDigTick] = useState(0);
	const handleDug = useCallback(() => {
		setDigTick((t) => t + 1);
		crewHook.refresh?.().catch?.(() => {});
		// A real dig may have crossed FIRST_DIG → DONE; re-derive the step so the
		// onboarding card retires this frame instead of on the next focus.
		sounderPath.refresh();
	}, [crewHook.refresh, sounderPath.refresh]);
	// The tab's ONE feeding CTA — every dig surface (the HungerHero banner, the
	// SounderHomeCard play row, the onboarding step card) reads THIS instance, and
	// its modal renders exactly once below the cards. Two independent hooks each
	// held their own dugThisWindow, so digging via one left the other's button
	// lying until window rollover (the stale-dig-button class, fixed twice on
	// 2026-07-12) — one instance makes disagreement impossible.
	const feedingCta = useFeedingCta(handleDug);
	// Leaving your Sounder now lives in the season-guide dialog's footer.
	const handleLeave = useCallback(() => {
		crewHook.leave().catch(() => {});
	}, [crewHook.leave]);
	// Season-end reveal — the beta Founding Herd recap. Live path: season1_finale
	// flag (legacy key name — it means the SEASON-0 finale; the key shipped in
	// build 103 and never changes) + an unseen my_beta_reward grant (held
	// 20260704400000). Dev preview chip mirrors the intro's escape hatch.
	const seasonEnd = useSeasonEnd();
	// Route the AUTO season-end recap through the global popup queue so it never
	// co-presents with another native Modal (sounder nudge, finale verdict, etc.)
	// — iOS renders two native Modals stacked/clipped. Priority 25 sits just after
	// the finale verdict (20) and before the sounder nudge (35): verdict → recap →
	// nudge. Manual re-open (recapOpen) and the __DEV__ preview bypass the queue.
	const seasonEndSlot = usePopupSlot("seasonEnd", seasonEnd.show, 25);
	// When the recap PRESENTS (auto path), latch the session ceremony gate so the
	// achievements carousel + release notes hold for next login — flip-day
	// stacking ceiling (SKILL.md 2026-07-11). Only the queued auto-reveal counts
	// as the ceremony; the manual header-icon re-open (recapOpen) does not.
	useEffect(() => {
		if (seasonEndSlot.visible) markCeremonyShown();
	}, [seasonEndSlot.visible]);
	// Persistent re-entry into the season-end recap. The auto-reveal only
	// plays once (seen-stamp), so this lets a player look back at their
	// Founding Herd rewards any time via the season-pass header icon.
	const [recapOpen, setRecapOpen] = useState(false);
	// __DEV__-only founder-gift preview: cycles the four tiers so the full
	// reveal (chip count + copy per tier) is testable without a server grant.
	// Always null in production — never touches the live season1_finale gate.
	const [devReward, setDevReward] = useState<BetaReward | null>(null);
	const [devTierIdx, setDevTierIdx] = useState(0);
	// Which pass track the player is browsing — free by default. Only
	// surfaces tabs when the season actually has premium rewards.
	const [passTrack, setPassTrack] = useState<"free" | "premium">("free");
	// The season's reference sheets (story / earnables) — opened from the two
	// header icon buttons; the tab's scroll stays the playable path.
	const [infoTopic, setInfoTopic] = useState<SeasonInfoTopic | null>(null);
	// "How to earn XP" — the pass header's star button.
	const [xpHelpOpen, setXpHelpOpen] = useState(false);
	// Alignment placard moved here from the Me tab — the player's
	// greedy↔generous score + its blessing/curse/regen modifiers.
	const [alignmentScore, setAlignmentScore] = useState(0);
	const [alignmentExplainerOpen, setAlignmentExplainerOpen] = useState(false);
	// This season's tickles reclaimed — the caller's own profiles.tickles_earned,
	// read alongside alignment_score (same profile select, no extra round-trip).
	// null until the profile lands so the YOUR TAKE tickle cell shows a quiet dash.
	const [ticklesEarned, setTicklesEarned] = useState<number | null>(null);
	// Controlled-open for the compressed HungerHero — the YOUR TAKE tickle cell
	// opens the SAME hero sheet (the emotional home for "tickles reclaimed")
	// instead of minting a second one.
	const [heroOpen, setHeroOpen] = useState(false);
	// The tickle breakdown receipt (spec 17) — your own count decomposed. Opened
	// from the YOUR TAKE tickle cell; the hero stays reachable from the banner.
	const [breakdownOpen, setBreakdownOpen] = useState(false);
	// Reward dialog: set after a successful claim_tier_reward RPC so the
	// user gets a beat to read what they got and (for wearables) jump
	// straight to the wardrobe to equip it.
	const [claimedReward, setClaimedReward] = useState<TierRow | null>(null);
	// A claim couldn't go through (locked / already claimed / offline) — shown as
	// an in-world paper notice instead of a native Alert punching iOS chrome
	// through the storybook world.
	const [claimNotice, setClaimNotice] = useState<{ title: string; body: string } | null>(null);
	// Mystery-box claims carry their grant in the RPC response
	// (granted_hat_id or fallback_snouts) — staged into the queue-slotted
	// unboxing reveal instead of the generic claimed-reward dialog.
	const [mysteryReveal, setMysteryReveal] =
		useState<MysteryBoxRevealPayload | null>(null);
	// Claim-all summary — set after a sequential "claim all" run so the player
	// gets ONE in-world beat listing everything that landed, instead of N stacked
	// claimed-reward dialogs. Reuses the ClaimNoticeDialog paper card.
	const [claimAllSummary, setClaimAllSummary] =
		useState<{ title: string; body: string } | null>(null);
	// If a claim-all sweep pulled a mystery box, its reveal waits here until the
	// summary beat is dismissed — two native Modals must never co-present (the iOS
	// stacked-modal footgun), so the unboxing follows the summary, never beside it.
	const pendingMysteryRef = useRef<MysteryBoxRevealPayload | null>(null);

	// Tier-up celebration: fires the banner + fanfare whenever
	// season_state's current_tier increases between loads. Initial
	// mount records the starting tier without firing (don't celebrate
	// just because the user opened the tab at tier 7).
	const tierBannerRef = useRef<TierUpBannerHandle>(null);
	const lastSeenTier = useRef<number | null>(null);
	// Scroll-to-pass for the YOUR TAKE strip's pass cell — the ScrollView + the
	// measured y of the pass section header.
	const scrollRef = useRef<ScrollView>(null);
	const passSectionY = useRef(0);
	const claimPlayer = useAudioPlayer(claimSound);

	const load = useCallback(async () => {
		const data = await rpc<SeasonState>("season_state");
		if (data) setState(data);
		// Alignment placard reads the player's score directly off the
		// profile (season_state doesn't carry it). getSession is cached,
		// so this adds no network round-trip beyond the profile select.
		const { data: sess } = await supabase.auth.getSession();
		const uid = sess.session?.user?.id;
		setUid(uid ?? null);
		if (uid) {
			const { data: prof } = await supabase
				.from("profiles")
				.select("alignment_score, tickles_earned")
				.eq("id", uid)
				.single();
			const p = prof as { alignment_score?: number; tickles_earned?: number } | null;
			setAlignmentScore(p?.alignment_score ?? 0);
			setTicklesEarned(p?.tickles_earned ?? 0);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	// Unlock the premium battle-pass track via Slop Club membership. The
	// premium pass is a Slop Club perk, not a separate consumable — so we
	// present the Slop Club subscription paywall (same offering
	// components/Account.tsx uses). On purchase, is_vip flips server-side
	// via the RevenueCat webhook; re-running load() re-reads season_state,
	// which then reports premium_unlocked: true.
	const handleUnlockPremium = useCallback(async () => {
		const result = await presentPaywall(OFFERING_IDS.slopClub);
		if (result.ok) {
			await load();
		}
	}, [load]);

	// Season guide — "how the season works" + the Hunger level ladder.
	// NO auto-open: the first session already carries the tale video and the
	// step card teaches by doing — a guide popped onto a tab the player hasn't
	// seen yet was the third modal in a row (critique run 2, P1). It lives
	// behind "how it works ›" only. GUIDE_EVERY_VISIT is a dev-only loop for
	// exercising the flow and can never ship on (gated behind __DEV__).
	const GUIDE_EVERY_VISIT = __DEV__ && false;
	const [guideOpen, setGuideOpen] = useState(false);
	useFocusEffect(
		useCallback(() => {
			if (!s1 || !GUIDE_EVERY_VISIT) return;
			setGuideOpen(true);
		}, [s1])
	);
	const dismissGuide = useCallback(() => {
		setGuideOpen(false);
	}, []);

	// The FIRST-VIEW auto-present of the tale now lives at ROOT (app/_layout.tsx)
	// so it tells itself on the MAIN page at login, queue-slotted (pri 27) behind
	// the season-end recap. This tab keeps ONLY the manual "Hear the tale again"
	// replay chip (setIntroOpen(true)) — a plain Modal, no queue, no stamp.
	const dismissIntro = useCallback(() => {
		setIntroOpen(false);
	}, []);

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

	// YOUR TAKE — the next unclaimed reward for the strip's pass cell. Picks the
	// lowest tier whose reward on the SHOWN track is still unclaimed; the shown
	// track is premium only for members, so a non-premium player is never shown
	// a reward they can't claim (falls back to the free next). READY when the
	// tier is already reached (0 XP away); otherwise XP-away = the cumulative XP
	// to reach that tier minus what's earned.
	const nextReward = useMemo<NextReward | null>(() => {
		if (!state?.active || !state.season) return null;
		const total = state.season.total_tiers;
		const xpPer = state.season.xp_per_tier || 1;
		const xp = state.xp ?? 0;
		const curTier = state.current_tier ?? 1;
		const track: "free" | "premium" = state.premium_unlocked ? "premium" : "free";
		for (let t = 1; t <= total; t++) {
			const reward = tiersByNumber[t]?.[track] ?? tiersByNumber[t]?.free;
			if (!reward) continue;
			// A tier's premium reward is gated for non-members — skip it so the
			// strip never advertises something un-claimable, and fall to free.
			const shown =
				track === "premium" && tiersByNumber[t]?.premium
					? tiersByNumber[t].premium!
					: tiersByNumber[t]?.free ?? reward;
			if (claimedSet.has(`${t}:${shown.track}`)) continue;
			const ready = t <= curTier;
			const xpAway = ready ? 0 : Math.max(0, (t - 1) * xpPer - xp);
			return {
				reward_type: shown.reward_type,
				reward_value: shown.reward_value,
				display_label: shown.display_label,
				ready,
				xpAway,
			};
		}
		return null;
	}, [state?.active, state?.season, state?.xp, state?.current_tier, state?.premium_unlocked, tiersByNumber, claimedSet]);

	// One claim RPC round-trip. Returns the raw response (or null on transport
	// failure) so both the single-claim path (which shows dialogs) and the
	// claim-all path (which accumulates a summary) can share the same call —
	// neither re-implements the RPC shape.
	type ClaimResp =
		| ({ ok: boolean; reason?: string; current_tier?: number } & MysteryBoxRevealPayload)
		| null;
	const claimOne = async (
		tier: number,
		track: "free" | "premium"
	): Promise<ClaimResp> =>
		rpc<{ ok: boolean; reason?: string; current_tier?: number } & MysteryBoxRevealPayload>(
			"claim_tier_reward",
			{ target_tier: tier, target_track: track }
		);

	// Success flourish shared by single + claim-all — chime + haptic.
	const claimFlourish = () => {
		try {
			claimPlayer.seekTo(0);
			claimPlayer.play();
		} catch {}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
	};

	const handleClaim = async (tier: number, track: "free" | "premium") => {
		if (busy) return;
		setBusy(true);
		const r = await claimOne(tier, track);
		setBusy(false);
		if (!r) {
			setClaimNotice({ title: "Couldn't claim", body: "Give it another tap in a moment." });
			return;
		}
		if (!r.ok) {
			// In-world notice, not a system Alert — and a per-reason title so
			// "already claimed" doesn't wear a wrong "Locked" hat.
			const reason = r.reason ?? "";
			const bodyMap: Record<string, string> = {
				tier_locked: `Reach tier ${tier} first — you're at ${r.current_tier}.`,
				premium_locked: "Join the Slop Club to claim the premium track.",
				already_claimed: "You've already claimed this one.",
				no_active_season: "No season is running right now.",
				no_reward: "There's nothing to claim here.",
			};
			const titleMap: Record<string, string> = {
				tier_locked: "Not yet",
				premium_locked: "A Slop Club perk",
				already_claimed: "Already yours",
				no_active_season: "No season",
				no_reward: "Nothing here",
			};
			setClaimNotice({
				title: titleMap[reason] ?? "Couldn't claim",
				body: bodyMap[reason] ?? "Give it another tap in a moment.",
			});
			return;
		}
		// Claim succeeded — magical chime + light haptic confirmation.
		// Tier-up celebration (if the claim actually crossed a tier
		// boundary) fires separately from the useEffect that watches
		// current_tier after load().
		claimFlourish();
		// Mystery-box claims stage the big unboxing reveal (the response
		// names the granted hat / snout fallback); everything else gets
		// the generic reward dialog so the user sees what they got + can
		// jump to the wardrobe to equip wearables.
		if (r.granted_hat_id || r.fallback_snouts) {
			setMysteryReveal(r);
		} else {
			const claimedRow = tiersByNumber[tier]?.[track];
			if (claimedRow) setClaimedReward(claimedRow);
		}
		load();
	};

	// The tiers that are READY to claim on the shown track — reached (t ≤ current)
	// and not yet claimed and carrying a reward. The same predicate the track uses
	// per-row, lifted so the "claim all ›" affordance can appear when ≥2 wait.
	const shownTrack: "free" | "premium" = useMemo(() => {
		const hasPremium = (state?.tiers ?? []).some((r) => r.track === "premium");
		return hasPremium ? passTrack : "free";
	}, [state?.tiers, passTrack]);
	const readyTiers = useMemo(() => {
		const cur = state?.current_tier ?? 1;
		const total = state?.season?.total_tiers ?? 0;
		// Premium track under glass for non-members — nothing is claimable there.
		if (shownTrack === "premium" && !state?.premium_unlocked) return [];
		const out: number[] = [];
		for (let t = 1; t <= total; t++) {
			if (t > cur) continue;
			if (claimedSet.has(`${t}:${shownTrack}`)) continue;
			if (!tiersByNumber[t]?.[shownTrack]) continue;
			out.push(t);
		}
		return out;
	}, [state?.current_tier, state?.season?.total_tiers, state?.premium_unlocked, shownTrack, claimedSet, tiersByNumber]);

	// Claim every READY tier on the shown track in one tap. Claims sequentially
	// (the RPC is per-tier), respects the single busy guard, and ends on ONE
	// summary beat — "N rewards claimed — X tickles + the Reed Hat" — instead of
	// N stacked dialogs. Mystery-box tiers still fall through to their own reveal
	// (they carry a per-claim grant that deserves its unboxing), but their name is
	// folded into the tally too.
	const handleClaimAll = async () => {
		if (busy) return;
		const targets = [...readyTiers];
		if (targets.length === 0) return;
		setBusy(true);
		let tickles = 0;
		const items: string[] = [];
		let lastMystery: MysteryBoxRevealPayload | null = null;
		let failed = 0;
		for (const t of targets) {
			const row = tiersByNumber[t]?.[shownTrack];
			const r = await claimOne(t, shownTrack);
			if (!r || !r.ok) {
				failed++;
				continue;
			}
			if (r.granted_hat_id || r.fallback_snouts) {
				lastMystery = r;
			}
			if (row) {
				if (row.reward_type === "tickles") {
					tickles += row.reward_value?.amount ?? row.reward_value?.count ?? 0;
				} else {
					items.push(row.display_label);
				}
			}
		}
		setBusy(false);
		claimFlourish();
		await load();
		// Fold the tally into one line. Tickles read as a single "X tickles" clause;
		// each named item is listed (capped so the beat stays a glance).
		const claimedCount = targets.length - failed;
		const parts: string[] = [];
		if (tickles > 0) parts.push(`${tickles.toLocaleString("en-US")} tickles`);
		const NAMED_CAP = 3;
		if (items.length > 0) {
			const shown = items.slice(0, NAMED_CAP).join(", ");
			parts.push(items.length > NAMED_CAP ? `${shown}, and more` : shown);
		}
		const body =
			parts.length > 0
				? `${parts.join(" + ")}${failed > 0 ? ` (${failed} couldn't be claimed)` : ""}`
				: "everything that was ready is yours.";
		// Stage the mystery reveal (if any) to follow the summary's dismissal, not
		// co-present with it.
		pendingMysteryRef.current = lastMystery;
		setClaimAllSummary({
			title:
				claimedCount === 1
					? "1 reward claimed"
					: `${claimedCount} rewards claimed`,
			body,
		});
	};

	// NOTE: the standalone paid Season-Pass purchase path (handleBuySeasonPass +
	// BattlePassSaleModal) was removed here — it was unreachable (PAID_BATTLE_PASS_
	// ENABLED is false and nothing ever opened the sale modal), and the premium
	// track now unlocks via Slop Club membership (handleUnlockPremium). The
	// BattlePassSaleModal component file is kept, marked dormant, pending the
	// paid-pass decision.

	if (!state) {
		return (
			<View style={[styles.container, styles.center]}>
				<LoadingBeat label="reading the season" />
			</View>
		);
	}
	if (!state.active) {
		return (
			<View style={[styles.container, styles.center]}>
				<EmptyState
					glyph="cloud"
					title="No season running"
					sub="A new season will roll in soon."
				/>
			</View>
		);
	}

	const season = state.season!;
	const tier = state.current_tier ?? 1;
	const premium = state.premium_unlocked ?? false;
	// Show the Free/Premium tabs only when the season actually seeds
	// premium rewards; otherwise the free list stands alone (today's UI).
	const hasPremiumTrack = (state.tiers ?? []).some((r) => r.track === "premium");

	// YOUR TAKE strip → pass cell. READY? scroll to the pass so the claim button
	// is on screen (the strip is a glance, the claim lives on the track). Not
	// ready? same scroll, so the player sees where the XP is headed. One motion
	// either way — the section's claim state does the rest.
	const openPassSection = () => {
		scrollRef.current?.scrollTo({ y: passSectionY.current, animated: true });
	};

	return (
		<SpotlightProvider>
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					{/* Season 1 wears the Hungerer's name; Season 0 keeps its framing.
					    (The old dev intro-preview chip is gone — the real retrigger
					    lives on the hero as "Hear the tale again".) */}
					<View style={styles.headerRow}>
						<View style={{ flex: 1, minWidth: 0 }}>
							<Text style={styles.kicker}>
								{s1 ? "★ season 1 — the great hunger" : `★ ${season.name.toLowerCase()}`}
							</Text>
							{/* One line beside the icon row — shrink before wrapping
							    (a two-line title under three buttons read as clutter). */}
							<Text
								style={styles.title}
								numberOfLines={1}
								adjustsFontSizeToFit
								minimumFontScale={0.7}
							>
								{s1 ? "The Great Hunger" : "Goblins vs Angels"}
							</Text>
							<View style={styles.titleRule} />
						</View>
						{/* Reference sheets — the tale cinematic (scene), the season
						    story (scroll), and the earnables shelf (gift). Their
						    sections left the scroll for these modals. */}
						{s1 && (
							<View style={styles.headerBtns}>
								<Pressable
									onPress={() => setIntroOpen(true)}
									hitSlop={8}
									accessibilityRole="button"
									accessibilityLabel="Hear the tale again"
									style={({ pressed }) => [
										styles.headerBtn,
										pressed && styles.headerBtnPressed,
									]}
								>
									<Glyph name="scene" size={18} />
								</Pressable>
								<Pressable
									onPress={() => setInfoTopic("story")}
									hitSlop={8}
									accessibilityRole="button"
									accessibilityLabel="The season's story"
									style={({ pressed }) => [
										styles.headerBtn,
										pressed && styles.headerBtnPressed,
									]}
								>
									<Icon name="scroll" size={18} color={WHIMSY.ink} />
								</Pressable>
								<Pressable
									onPress={() => setInfoTopic("spoils")}
									hitSlop={8}
									accessibilityRole="button"
									accessibilityLabel="What you can earn"
									style={({ pressed }) => [
										styles.headerBtn,
										pressed && styles.headerBtnPressed,
									]}
								>
									<Icon name="gift" size={18} color={WHIMSY.ink} />
								</Pressable>
							</View>
						)}
					</View>
					{/* Live entry point is the pass header's recap icon (only shows
					    when a real grant exists). This __DEV__-only chip cycles the
					    four founder tiers so the reveal is previewable without a
					    grant; it never renders in production. */}
					{__DEV__ && (
						<Pressable
							onPress={() => {
								const r = DEV_PREVIEW_REWARDS[devTierIdx % DEV_PREVIEW_REWARDS.length];
								setDevTierIdx((n) => n + 1);
								setDevReward(r);
							}}
							hitSlop={8}
							style={({ pressed }) => [styles.devRewardChip, pressed && { opacity: 0.6 }]}
						>
							<Text style={styles.devRewardChipText}>
								dev · founder gift ({DEV_PREVIEW_REWARDS[devTierIdx % DEV_PREVIEW_REWARDS.length].tier})
							</Text>
						</Pressable>
					)}
						{/* Season 0 only — S1's clock is the Hungerer's drain + the
						    feeding cadence, not a doomsday date. */}
						{!s1 && daysUntilJudgement() > 0 && (
							<View style={styles.judgementBanner}>
								<Icon name="scales" size={14} color={WHIMSY.ink} />
								<Text style={styles.judgementText}>
									Judgement Day in {daysUntilJudgement()}{" "}
									{daysUntilJudgement() === 1 ? "day" : "days"}
								</Text>
							</View>
						)}
				</View>

				{/* The standalone XP progress card was dropped per the
				    redesign — tier + total now reads from the
				    "season pass / Tier N/M" SectionHeader inline with
				    the snake track, and the snake stones themselves
				    show progress via their fill state. The Unlock
				    Premium CTA moved into the SectionHeader's right
				    slot below. */}

				<ScrollView ref={scrollRef} contentContainerStyle={styles.tierList}>
					{/* ── Season 1 — reordered from first principles (what is this? →
					    what do I do now? → the pass → the race). The VALUE BANNER
					    (compressed hero + loop line) answers "what is this?"; then the
					    "do this now" slot — the window strip's feeding rhythm above the
					    dig CTA / join door; then the pass section; then the dig-off. The
					    story + earnables shelf live in the header-icon modals, off the
					    scroll. BountyBoard leaves the tab while it's feature-dark. ── */}
					{s1 && (
						<>
							{/* The value banner — the compressed hero. Its full art +
							    hunger ladder open in a sheet on tap. Controlled-open so
							    the YOUR TAKE tickle cell can open this same sheet. */}
							{/* The banner's dig CTA only exists for crewed players — gate on
							    the real crew read here (cta.noCrew is lazy: it only flips
							    after a refused open, so it can't gate the initial render). */}
							<HungerHero
								refreshKey={digTick}
								open={heroOpen}
								onOpenChange={setHeroOpen}
								cta={crewHook.crew.crew ? feedingCta : undefined}
							/>

							{/* The tickle breakdown receipt for yourself (spec 17) — opened
							    from the YOUR TAKE tickle cell. A native Modal; nothing else
							    modal is up on the season tab, so it presents directly. */}
							<TickleBreakdownSheet
								userId={breakdownOpen ? uid : null}
								fallbackTotal={ticklesEarned}
								onClose={() => setBreakdownOpen(false)}
							/>

							<View style={{ marginTop: 8 }}>
								<SectionHeader
									style={{ marginBottom: 0 }}
									kicker="your Sounder"
									title={crewHook.crew.crew?.name ?? "Join a Sounder"}
									right={
										<Pressable
											onPress={() => setGuideOpen(true)}
											hitSlop={8}
											style={({ pressed }) => pressed && { opacity: 0.6 }}
										>
											<Text style={styles.guideLink}>how it works ›</Text>
										</Pressable>
									}
								/>
							</View>
							{/* The feeding rhythm — the 8h open/guarded timeline with a
							    "now" marker, above the dig CTA. Renders for crewed AND
							    crewless: the rhythm sells the loop even before you join.
							    Fed the shared CTA so its caption and every dig button
							    tick the same clock. */}
							<WindowStrip cta={feedingCta} />

							{/* The "do this now" slot. Pre-DONE, the onboarding step card
							    IS the primary (taste → join → first dig); it retires
							    automatically at DONE (and while the step is still
							    resolving), when the normal SounderHomeCard takes over:
							    the join-first door when crewless, else roster +
							    play/cooldown + milestone. The step machine, not a
							    dismissal flag, decides — nobody who finished is nagged,
							    nobody who hasn't is left without a next move. */}
							{sounderPath.step && sounderPath.step !== "done" && sounderPath.step !== "hook" ? (
								// The spotlight target is now nested INSIDE the step card,
								// wrapping just the join door (not the whole card), so the
								// coach-mark hole hugs the join affordance. We only pass the
								// "should show" flag down; the card owns the target wrap.
								<SounderStepCard
									step={sounderPath.step}
									stalled={sounderPath.stalled}
									leaver={sounderPath.leaver}
									joinSpotlightActive={joinSpotlight.show}
									crewHook={crewHook}
									uid={uid}
									cta={feedingCta}
									refreshKey={digTick}
									onAdvance={sounderPath.refresh}
								/>
							) : (
								<SounderHomeCard
									crewHook={crewHook}
									uid={uid}
									cta={feedingCta}
									refreshKey={digTick}
								/>
							)}
							{/* The shared dig modal — mounted ONCE for every trigger above
							    (banner CTA, play row, step card); one session state means
							    it can never double-present. */}
							{feedingCta.modal}

							{/* YOUR TAKE (Q3 — "what do I get?"). The personal value
							    strip: pass tier + next-reward art, the Golden Truffle
							    pouch → Exchange, and this season's tickles reclaimed →
							    the hero. Between the "do this now" slot and the dig-off. */}
							<YourTakeStrip
								nextReward={nextReward}
								nextRewardLoading={false}
								currentTier={tier}
								totalTiers={season.total_tiers}
								ticklesEarned={ticklesEarned}
								onOpenPass={openPassSection}
								onOpenHero={() => setHeroOpen(true)}
								onOpenBreakdown={uid ? () => setBreakdownOpen(true) : undefined}
							/>

							{/* The dig-off — the cumulative season board (headline) + the
							    weekly beat. Feature-dark (renders nothing) until the
							    migration is pushed. Only meaningful once you're in a Sounder. */}
							{crewHook.crew.crew && (
								<RaceSection
									myCrewId={crewHook.crew.crew.id}
									crewSize={crewHook.crew.members.length}
									refreshKey={digTick}
								/>
							)}
						</>
					)}

					{/* Section header for the pass — the list gap (SPACE.sm) owns
					    the seam above; no extra margin so the sections sit tight. */}
					<View
						onLayout={(e) => {
							passSectionY.current = e.nativeEvent.layout.y;
						}}
					>
						<SectionHeader
							kicker="season pass"
							title={`Tier ${tier}/${season.total_tiers}`}
							right={(() => {
								// Show the VIP marker + a CTA whenever the caller isn't a
								// member. When IAP is live it's the real "Unlock"; when IAP
								// is off (TestFlight) it's a disabled "Coming Soon".
								const showVip = !premium;
								// The recap icon only earns its place when there's
								// actually a Founding Herd grant to look back on.
								const showRecap = seasonEnd.reward != null;
								return (
									<>
										{/* How XP is earned — reference sheet, one tap away. */}
										<Pressable
											onPress={() => setXpHelpOpen(true)}
											hitSlop={8}
											style={({ pressed }) => [styles.recapBtn, pressed && styles.chipPressed]}
											accessibilityRole="button"
											accessibilityLabel="How to earn XP"
										>
											<Glyph name="star" size={16} />
										</Pressable>
										{showVip && (
											<>
												{IAP_ENABLED && PURCHASES_LIVE ? (
													<Pressable
														onPress={handleUnlockPremium}
														style={({ pressed }) => [styles.unlockBtn, pressed && styles.chipPressed]}
														accessibilityRole="button"
														accessibilityLabel="Join the Slop Club"
													>
														<Icon name="premium" size={12} color={WHIMSY.ink} filled />
														<Text style={styles.unlockBtnText}>Slop Club</Text>
													</Pressable>
												) : (
													<View
														style={[styles.unlockBtn, styles.comingSoonBtn]}
														accessibilityLabel="Slop Club coming soon"
													>
														<Text style={[styles.unlockBtnText, styles.comingSoonText]}>
															Coming Soon
														</Text>
													</View>
												)}
											</>
										)}
										{showRecap && (
											<Pressable
												onPress={() => setRecapOpen(true)}
												hitSlop={8}
												style={({ pressed }) => [styles.recapBtn, pressed && styles.chipPressed]}
												accessibilityRole="button"
												accessibilityLabel="See your season-end rewards"
											>
												<Glyph name="crown" size={16} />
											</Pressable>
										)}
									</>
								);
							})()}
						/>
					</View>

					{/* Promise-before-ask: the XP chain in one line under the pass
					    header (the full "how to earn XP" modal stays for detail). */}
					<Text style={passProgressStyles.subtitle}>
						earn XP by digging, tickling, and visiting
					</Text>

					{/* XP progress toward the next tier. The pass-track stones
					    only show discrete claim state, so this restores the
					    granular "how close to the next tier" readout. */}
					{(() => {
						const xpPer = season.xp_per_tier || 1;
						const xp = state.xp ?? 0;
						const atMax = tier >= season.total_tiers;
						const into = xp % xpPer;
						const pct = atMax ? 1 : Math.max(0, Math.min(1, into / xpPer));
						return (
							<View style={passProgressStyles.wrap}>
								<View style={passProgressStyles.track}>
									<View
										style={[
											passProgressStyles.fill,
											{ width: `${Math.round(pct * 100)}%` },
										]}
									/>
								</View>
								<Text style={passProgressStyles.label}>
									{atMax
										? "Max tier reached ★"
										: `${into} / ${xpPer} XP to Tier ${tier + 1}`}
								</Text>
							</View>
						);
					})()}

					{/* "How to earn XP" lives in the header-star modal (XPHowToModal). */}

					{/* Vertical-list pass track — straight column of node +
					    card rows with per-state visual treatment (sage
					    claimed / sun-yellow ready / dashed locked) and
					    display-only stats pills above. Replaces the
					    snake; matches the design's bottom-of-screen
					    reference. */}
					{hasPremiumTrack && (
						<PassTrackTabs
							track={passTrack}
							onChange={setPassTrack}
							premiumUnlocked={premium}
						/>
					)}
					{hasPremiumTrack && passTrack === "premium" && !premium && (
						<PremiumLockedBanner onUnlock={handleUnlockPremium} />
					)}
					{/* Ready-claim shortcut — surfaces at the TOP of the track whenever
					    anything is claimable. One ready tier names its reward; two or
					    more sweep in one tap and end on a single summary beat (instead
					    of tap→dialog→dismiss, N times). */}
					{readyTiers.length >= 1 && (
						<ClaimAllBar
							count={readyTiers.length}
							label={
								readyTiers.length === 1
									? tiersByNumber[readyTiers[0]]?.[shownTrack]?.display_label
									: undefined
							}
							busy={busy}
							onPress={handleClaimAll}
						/>
					)}
					<VerticalListPassTrack
						totalTiers={season.total_tiers}
						currentTier={tier}
						tiersByNumber={tiersByNumber}
						claimedSet={claimedSet}
						onClaim={handleClaim}
						track={hasPremiumTrack ? passTrack : "free"}
						premiumUnlocked={premium}
					/>

					{/* Alignment placard — SEASON 0 ONLY. Alignment isn't a thing
					    in Season 1 (the mechanics still hum server-side, but the
					    identity UI retires with Judgement Day). */}
					{!s1 && (
					<>
					<View style={{ marginTop: 8 }}>
						<SectionHeader kicker="standing" title="Alignment" />
					</View>
					<Sticker color="cream" rotate={-0.6} radius={RADII.xl} style={alignmentStoryStyles.wrap}>
						<View style={alignmentStoryStyles.labelRow}>
							<Text style={alignmentStoryStyles.greedy}>Greedy</Text>
							<Text style={alignmentStoryStyles.score}>
								{alignmentScore >= 0 ? "+" : ""}
								{alignmentScore}
							</Text>
							<Text style={alignmentStoryStyles.generous}>Generous</Text>
						</View>
						<AlignmentBar score={alignmentScore} />
						{(() => {
							const fx = alignmentEffects(alignmentScore);
							const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
							return (
								<View style={alignmentStoryStyles.effectsRow}>
									<Text style={alignmentStoryStyles.effect}>
										Regen {sgn(fx.regenPct)}%
									</Text>
									<Text style={alignmentStoryStyles.effect}>
										Blessings {sgn(fx.blessingPct)}%
									</Text>
									<Text style={alignmentStoryStyles.effect}>
										Curses {sgn(fx.cursePct)}%
									</Text>
								</View>
							);
						})()}
						<Text style={alignmentStoryStyles.effectHint}>
							Give freely → your blessings grow stronger. Keep to
							yourself → your curses bite harder.
						</Text>
						<Text style={alignmentStoryStyles.hint}>
							★ blessings push you up. asks for tickles pull you
							down. ★
						</Text>
						<Pressable
							testID="alignment-how-it-works"
							onPress={() => setAlignmentExplainerOpen(true)}
							hitSlop={8}
							style={({ pressed }) => pressed && { opacity: 0.6 }}
						>
							<Text style={alignmentStoryStyles.howLink}>
								how alignment works ›
							</Text>
						</Pressable>
					</Sticker>
					</>
					)}
				</ScrollView>
			</SafeAreaView>

			{alignmentExplainerOpen && (
				<AlignmentExplainerModal
					s1={s1}
					onDismiss={() => setAlignmentExplainerOpen(false)}
				/>
			)}
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

			{/* A claim couldn't go through — an in-world paper notice, not a
			    native Alert. */}
			<ClaimNoticeDialog
				notice={claimNotice}
				onClose={() => setClaimNotice(null)}
			/>

			{/* Claim-all summary — the single beat that lands after a "claim all"
			    sweep, listing everything won. Same paper card as the notice. On
			    dismiss, any mystery box the sweep pulled gets its unboxing — staged
			    to follow, never stack, so two native Modals don't co-present. */}
			<ClaimNoticeDialog
				notice={claimAllSummary}
				onClose={() => {
					setClaimAllSummary(null);
					const pending = pendingMysteryRef.current;
					if (pending) {
						pendingMysteryRef.current = null;
						// Let the summary Modal finish dismissing before the reveal
						// mounts (POPUP_TEARDOWN_MS — the same beat the queue uses).
						setTimeout(() => setMysteryReveal(pending), POPUP_TEARDOWN_MS);
					}
				}}
			/>

			{/* Mystery Hat Box unboxing — queue-slotted, so it serializes
			    with the launch/home popups instead of fighting them. */}
			<MysteryHatReveal
				reveal={mysteryReveal}
				onDone={() => setMysteryReveal(null)}
			/>

			{/* Season 1 intro — the tale cinematic. Auto-plays on the first
			    Season-1 visit (per-user AsyncStorage stamp) and re-opens from
			    the hero's "Hear the tale again" chip. */}
			{s1 && <GreatHungerIntroModal visible={introOpen} onDone={dismissIntro} />}

			{/* The season guide — every visit while testing (GUIDE_EVERY_VISIT);
			    yields to the intro storybook when both want the stage. */}
			{s1 && (
				<SeasonGuideModal
					visible={guideOpen && !introOpen}
					onDismiss={dismissGuide}
					onLeave={crewHook.crew.crew ? handleLeave : undefined}
				/>
			)}

			{/* The "join a Sounder" coach-mark — dims the tab, cuts a bright hole
			    around the join step card, and forces the tap. Only lit once (the
			    seen-stamp), on the `join` step, and only while SPOTLIGHT_ENABLED
			    (__DEV__ for now, so it ships dark). Tapping through the hole OR the
			    "maybe later" skip stamps it seen. */}
			<SpotlightOverlay
				activeId={joinSpotlight.show ? JOIN_SPOTLIGHT_TARGET_ID : null}
				caption="your herd digs deeper — slip into a Sounder ›"
				onTargetPress={joinSpotlight.dismiss}
				onDismiss={joinSpotlight.dismiss}
			/>

			{/* The header-icon reference sheets — story (scroll) / earnables (gift). */}
			<SeasonInfoModal topic={infoTopic} onDismiss={() => setInfoTopic(null)} />

			{/* The pass header's star button — how XP is earned. */}
			<XPHowToModal
				xpPer={season.xp_per_tier || 100}
				visible={xpHelpOpen}
				onDismiss={() => setXpHelpOpen(false)}
			/>

			{/* Season-end reveal — the beta Founding Herd recap. Live when the
			    season1_finale flag is on and the caller has an unseen grant, or
			    re-opened from the pass header's recap icon. */}
			{(seasonEnd.reward || devReward) && (
				<SeasonEndModal
					visible={seasonEndSlot.visible || recapOpen || devReward != null}
					reward={devReward ?? seasonEnd.reward!}
					onDone={() => {
						// Two-phase dismiss, per the PopupQueue contract (see
						// components/ui/PopupQueue.tsx TIMING CONTRACT): release()
						// FIRST so the native modal hides this frame, then clear the
						// backing want (seasonEnd.show, via dismiss()) a
						// POPUP_TEARDOWN_MS beat LATER. Clearing seasonEnd.show in the
						// same commit as release() dropped the slot's `want` while the
						// native dismissal was still in flight — on the season-flip
						// login the hungerIntro (pri 27) then presented into that
						// in-progress teardown and came up invisible, wedging every
						// touch on the tab (the "scroll breaks sometimes after the
						// waiting dialog" report). recapOpen / devReward are the
						// manual + dev bypasses (no queue want to hold), so they can
						// clear on the same beat without a slot to violate.
						seasonEndSlot.release();
						setTimeout(() => {
							setRecapOpen(false);
							setDevReward(null);
							seasonEnd.dismiss();
						}, POPUP_TEARDOWN_MS);
					}}
				/>
			)}
		</View>
		</SpotlightProvider>
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
				<Icon name="star" size={56} filled color={WHIMSY.bless} />
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
				<Sticker color="paper" rotate={-1.2} radius={RADII.xxl} style={rewardStyles.card}>
					<Text style={rewardStyles.kicker}>★ unlocked</Text>
					<View style={rewardStyles.hero}>{preview}</View>
					<Text style={rewardStyles.title}>{display_label}</Text>
					<View style={rewardStyles.actions}>
						{isWearable && (
							<Button size="md" variant="primary" onPress={onShow}>
								Show in closet
							</Button>
						)}
						<Pressable
							onPress={onClose}
							style={({ pressed }) => [rewardStyles.dismissLink, pressed && { opacity: 0.6 }]}
						>
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

// A can't-claim notice — an in-world paper card (locked / already-claimed /
// offline), replacing the native Alert.alert the claim path used to punch through
// the storybook world. One "OK" beat; no destinations.
function ClaimNoticeDialog({
	notice,
	onClose,
}: {
	notice: { title: string; body: string } | null;
	onClose: () => void;
}) {
	if (!notice) return null;
	return (
		<Modal visible transparent animationType="fade" onRequestClose={onClose}>
			<Pressable style={rewardStyles.backdrop} onPress={onClose}>
				<Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 340 }}>
					<Sticker color="paper" rotate={-0.8} radius={RADII.xxl} style={rewardStyles.noticeCard}>
						<Text style={rewardStyles.noticeTitle}>{notice.title}</Text>
						<Text style={rewardStyles.noticeBody}>{notice.body}</Text>
						<Pressable
							onPress={onClose}
							style={({ pressed }) => [rewardStyles.dismissLink, pressed && { opacity: 0.6 }]}
						>
							<Text style={rewardStyles.dismissText}>OK</Text>
						</Pressable>
					</Sticker>
				</Pressable>
			</Pressable>
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
		borderRadius: RADII.pill,
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
	// The can't-claim notice card.
	noticeCard: {
		width: "100%",
		paddingHorizontal: 24,
		paddingVertical: 22,
		alignItems: "center",
		...STICKER_SHADOW,
	},
	noticeTitle: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: 6,
	},
	noticeBody: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		lineHeight: 20,
		color: WHIMSY.mute,
		textAlign: "center",
		marginBottom: 14,
	},
});

const passProgressStyles = StyleSheet.create({
	// The XP-chain subtitle under the pass header (promise-before-ask).
	subtitle: {
		...TYPE.bodySm,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		marginTop: 2,
		marginBottom: SPACE.xs,
		paddingHorizontal: 4,
	},
	// Tight under the section header's rule — the header/bar/label read as one
	// block, not three floating strips.
	wrap: { marginTop: 0, marginBottom: 2, paddingHorizontal: 4 },
	track: {
		height: 12,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	fill: {
		height: "100%",
		backgroundColor: WHIMSY.lilacDeep,
	},
	label: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 3,
	},
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	// Guide-dialog link — lives in the "your sounder" header's right slot.
	guideLink: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	judgementBanner: {
		marginTop: 10,
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		backgroundColor: WHIMSY.lilac,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: 14,
		paddingVertical: 5,
	},
	judgementText: {
		fontFamily: FONTS.whimsy,
		fontSize: 13,
		color: WHIMSY.ink,
		letterSpacing: 0.3,
	},
	safeArea: { flex: 1 },
	center: { alignItems: "center", justifyContent: "center" },
	header: {
		paddingHorizontal: PAGE_PAD,
		// TODO(ui-audit): SafeAreaView inset + 8 (deferred — device QA)
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		paddingBottom: 8,
	},
	headerRow: { flexDirection: "row", alignItems: "flex-start" },
	// The reference-sheet doors — small paper sticker circles by the title.
	headerBtns: { flexDirection: "row", gap: SPACE.sm, marginLeft: SPACE.sm },
	headerBtn: {
		width: 38,
		height: 38,
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	headerBtnPressed: {
		transform: [{ translateX: 2 }, { translateY: 2 }],
		shadowOpacity: 0,
		elevation: 0,
	},
	// Shared pressed state for the small sticker-chip buttons in the pass header
	// (xp star, Slop Club join, recap crown) — sink into the hard shadow.
	chipPressed: {
		transform: [{ translateX: 2 }, { translateY: 2 }],
		shadowOpacity: 0,
		elevation: 0,
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
		width: 64,
		marginTop: 4,
	},
	// Right-slot "Slop Club" join CTA for the season-pass SectionHeader — the
	// Slop Club gold identity (crest icon + label), matching the members band.
	unlockBtn: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		backgroundColor: WHIMSY.slopGold,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: 10,
		paddingVertical: 4,
		...SHADOW_SM,
	},
	unlockBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
	},
	// IAP-off variant of the unlock CTA: muted, shadowless, non-interactive.
	comingSoonBtn: {
		backgroundColor: WHIMSY.cream2,
		shadowOpacity: 0,
		elevation: 0,
	},
	comingSoonText: {
		color: WHIMSY.mute,
	},
	// Persistent season-end recap entry point — a small crown sticker in the
	// season-pass header's right slot. Paper-craft: sun fill, ink border,
	// hard offset shadow.
	recapBtn: {
		width: 34,
		height: 34,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	// __DEV__-only founder-gift preview chip (never ships).
	devRewardChip: {
		alignSelf: "center",
		marginTop: 8,
		backgroundColor: MODAL_BACKDROP_BG,
		borderRadius: RADII.sm,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	devRewardChipText: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.paper },
	tierList: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.lg,
		paddingBottom: TAB_SAFE,
		// sm, not lg: section headers already carry their own bottom margins,
		// so a large container gap double-counted into dead space at every seam.
		gap: SPACE.sm,
	},
	// The two live StoneThumb styles — the reward chip (`stone`) and the title
	// reward's quote glyph. The ~130 lines of legacy snake-track styles that used
	// to trail here (tierRow…lockedText) were dead since the vertical-list track
	// replaced the snaking track; deleted in the 2026-07-13 token sweep.
	stone: {
		width: 42,
		height: 42,
		borderRadius: RADII.md,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	titleGlyph: {
		...TYPE.sectionTitle,
		fontSize: 24,
		color: WHIMSY.ink,
	},
});

// "How to earn XP" — reference sheet in the season's modal chrome (backdrop +
// paper sticker card, matching SeasonGuideModal/SeasonInfoModal), opened from
// the pass header's star button. Values mirror the season-XP grants (home
// tickle +3, visit +5, etc.).
function XPHowToModal({
	xpPer,
	visible,
	onDismiss,
}: {
	xpPer: number;
	visible: boolean;
	onDismiss: () => void;
}) {
	const ROWS: { g: GlyphName; label: string; xp: string }[] = [
		{ g: "pigface", label: "Tickle your pig", xp: "+3" },
		{ g: "barn", label: "Visit a friend's barn", xp: "+5" },
		{ g: "sparkles", label: "Send a blessing", xp: "+5 / day" },
		{ g: "gem", label: "Dig a truffle", xp: "+3 / day" },
		{ g: "gift", label: "Bury a truffle", xp: "+5 / day" },
		{ g: "ogre", label: "Send a curse", xp: "+2 / day" },
	];
	return (
		<Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
			<View style={xpHowTo.backdrop}>
				<Sticker
					color="paper"
					rotate={-0.8}
					radius={RADII.xxl}
					border={3}
					style={[xpHowTo.card, STICKER_SHADOW]}
				>
					<Text style={xpHowTo.kicker}>★ season pass ★</Text>
					<Text style={xpHowTo.headline}>How to earn XP</Text>
					{ROWS.map((r) => (
						<View key={r.label} style={xpHowTo.row}>
							<Glyph name={r.g} size={18} />
							<Text style={xpHowTo.label}>{r.label}</Text>
							<Text style={xpHowTo.xp}>{r.xp}</Text>
						</View>
					))}
					<Text style={xpHowTo.foot}>{xpPer} XP = 1 tier</Text>
					<Button size="md" variant="primary" full onPress={onDismiss}>
						Back to the season
					</Button>
				</Sticker>
			</View>
		</Modal>
	);
}

const xpHowTo = StyleSheet.create({
	backdrop: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: MODAL_BACKDROP_BG,
		padding: 24,
	},
	card: {
		width: "100%",
		maxWidth: 400,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center", marginBottom: 4 },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 24,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.md,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 6,
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
		marginBottom: 5,
	},
	label: { flex: 1, fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	xp: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	foot: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 4,
		marginBottom: SPACE.md,
	},
});

// Alignment placard — moved off the Me tab onto the Season tab, where
// the season's stakes live (S0: the finale verdict; S1: blessing/curse power).
const alignmentStoryStyles = StyleSheet.create({
	wrap: { padding: 16, marginTop: 4 },
	labelRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		marginBottom: 6,
	},
	greedy: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.goblin,
	},
	generous: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.angel,
	},
	score: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },
	hint: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
	},
	effectsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: 8,
		marginTop: 8,
	},
	effect: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		paddingHorizontal: 8,
		paddingVertical: 3,
		overflow: "hidden",
	},
	effectHint: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 7,
		lineHeight: 17,
	},
	howLink: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 12,
		color: WHIMSY.accent,
		textAlign: "center",
		letterSpacing: 0.3,
		marginTop: 10,
	},
});
