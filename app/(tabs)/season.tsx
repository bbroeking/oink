import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	View,
	StyleSheet,
	ScrollView,
	SafeAreaView,
	Image,
	Pressable,
	type ViewStyle,
} from "react-native";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { router } from "expo-router";
import {
	IAP_ENABLED,
	presentPaywall,
	OFFERING_IDS,
} from "../../utils/iap";
// The design system's front door — spec §2: `components/ui/index.tsx` is the
// only sanctioned import path for a primitive.
import {
	AdaptiveModalScaffold,
	AlignmentBar,
	Body,
	BodySm,
	Button,
	EmptyState,
	Glyph,
	Hand,
	Icon,
	Kicker,
	Label,
	LoadingBeat,
	Numeral,
	PageHeader,
	PageTitle,
	POPUP_TEARDOWN_MS,
	ProgressTrack,
	SectionHeader,
	SegmentedControl,
	SpotlightOverlay,
	SpotlightProvider,
	Sticker,
	T,
	Tag,
	TickleIcon,
	TierUpBanner,
	usePopupSlot,
	useUnmanagedModalHold,
	type GlyphName,
	type TierUpBannerHandle,
} from "@/components/ui";
import { markCeremonyShown } from "../../utils/ceremonyGate";
import { POPUP_PRIORITIES } from "../../constants/popupPriorities";
import {
	MysteryHatReveal,
	type MysteryBoxRevealPayload,
} from "../../components/MysteryHatReveal";
import { GreatHungerIntroModal } from "../../components/GreatHungerIntroModal";
import {
	SeasonEndModal,
	DEV_PREVIEW_REWARDS,
} from "../../components/SeasonEndModal";
import { useSeasonEnd } from "../../hooks/useSeasonEnd";
import type { BetaReward } from "../../hooks/useSeasonEnd";
import { HungerHero } from "../../components/season1/HungerHero";
import { TickleBreakdownSheet } from "../../components/TickleBreakdownSheet";
import { BountyBoard } from "../../components/BountyBoard";
import { WindowStrip } from "../../components/season1/WindowStrip";
import {
	FeedingAction,
	SounderHomeCard,
} from "../../components/season1/SounderHomeCard";
import { SounderStepCard } from "../../components/season1/SounderStepCard";
import { MoteRewardDialog } from "@/components/season1/MoteRewardDialog";
import { MoteMachineCard } from "../../components/season1/MoteMachineCard";
import { HabitatGiftReveal } from "@/components/habitat/HabitatGiftReveal";
import { HABITAT_CATALOG } from "@/constants/habitat";
import { useHabitatJournal } from "@/hooks/useHabitatJournal";
import { useFeedingCta } from "../../components/mudwar/useFeedingCta";
import { seasonHeroSurface, seasonPrimaryAction } from "@/utils/seasonHero";
import { YourTakeStrip } from "../../components/season1/YourTakeStrip";
import { useSounderPath } from "../../hooks/useSounderPath";
import {
	useJoinSpotlight,
	JOIN_SPOTLIGHT_TARGET_ID,
} from "../../hooks/useJoinSpotlight";
import { RaceSection } from "../../components/season1/RaceSection";
import { DevSeasonStatesSheet } from "../../components/season1/DevSeasonStatesSheet";
import { SeasonGuideModal } from "../../components/season1/SeasonGuideModal";
import {
	SeasonInfoModal,
	type SeasonInfoTopic,
} from "../../components/season1/SeasonInfoModal";
import { useCrew } from "../../hooks/useCrew";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import { AlignmentExplainerModal } from "../../components/AlignmentExplainerModal";
import { alignmentEffects } from "@/utils/alignment";
import { HAT_IMAGES, HIDDEN_CATEGORIES } from "@/constants/hats";
import { resolveRewardArt, rewardItemId, WEARABLE_REWARD_TYPES } from "@/utils/rewardArt";
import { useSeason } from "../../hooks/useSeason";
import * as seasonPass from "@/utils/seasonPass";
import type { PassTrack, TierRow, TierState } from "@/utils/seasonPass";
import {
	BORDER,
	OPACITY,
	PAGE_PAD,
	PRESSED_FLAT,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TAB_SAFE,
	TAP_MIN,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { formatDurationCompact } from "@/utils/duration";
import {
	WALLOW_MAX_POWER_LEVEL,
	WALLOW_REGEN_STEP_PCT,
	wallowProgress,
	wallowWaitReductionLabel,
} from "@/utils/wallow";
import {
	MOTE_MACHINE_VISIBLE,
} from "../../constants/featureFlags";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
	patchDevSeasonOverrides,
	useDevSeasonOverrides,
} from "@/utils/devSeasonOverrides";

const claimSound = require("../../assets/sounds/claim.mp3");

// SeasonRow / RewardValue / TierRow / ClaimRow / SeasonState now live in
// utils/seasonPass (the pure derivation module); NextReward + TierState too.

// ── Drawing geometry ────────────────────────────────────────────────────────
// Spec §1.3: a size that is the DRAWING of a thing (a stone, a node circle, a
// power pip) is not a spacing decision, so it is named here rather than typed
// into a StyleSheet as a bare number. Everything else on this screen comes from
// SPACE / RADII / BORDER / TYPE.
const WALLOW_MARK = 48; // the flame well on the Wallow card
const WALLOW_PIP_W = 9; // one power-rank pip, drawn as a tall capsule
const WALLOW_PIP_H = 18;
const STONE = 42; // the reward chip inside a pass-track node
const STONE_ART = 34; // a golden-truffle image inside that chip
const STONE_IMAGE = 32; // a wearable / item image inside it
const STONE_ICON = 26; // a glyph inside it
const STONE_MARK = 22; // a line icon inside it
const NODE = 52; // the pass-track node circle
const NODE_COL = 64; // the node column — the width of the season's spine
const CORNER_BADGE = 20; // the node's corner state badge …
const BADGE_MARK = 11; // … and the check / lock inside it
const CLUB_CREST = 20; // the Slop Club mark beside a tier cap …
const CREST_MARK = 12; // … and the crest inside it
const BANNER_CREST = 34; // the Slop Club crest on the locked-premium banner …
const CREST_ICON = 18; // … and the crest mark inside it
const HEADER_BTN = 38; // the page crown's reference-sheet doors
const CHIP_BTN = 34; // the pass header's star / crown chips …
const CHIP_MARK = 16; // … and the glyph inside one
const REWARD_WELL = 160; // the claim dialog's art well …
const REWARD_ART = 140; // … and the art inside it
const REWARD_MARK = 64; // the tickle / snout mark when there is no item art
const REWARD_STAR = 56; // the catch-all star for a non-visual reward
const REWARD_CARD_MAX = 360; // the reveal card's width ceiling …
const NOTICE_CARD_MAX = 340; // … and the notice card's
const XP_CARD_MAX = 400; // the XP reference sheet's
// `wallowProgress` yields a fraction, so the XP meter is expressed out of 100 —
// which is also what VoiceOver reads back ("43 of 100").
const XP_METER_MAX = 100;

// A control may look smaller than TAP_MIN, but its touch frame may not: the
// IconButton visual/frame split, applied to the two round sticker chips above.
const HEADER_BTN_HIT = (TAP_MIN - HEADER_BTN) / 2;
const CHIP_BTN_HIT = (TAP_MIN - CHIP_BTN) / 2;

/**
 * The tab's ONE hero. Audit C-26: eleven decision surfaces stack in this
 * scroll, and on a "rewards ready" load six of them wore the sun-yellow
 * full-card highlight at once — so nothing was the one thing. The highlight is
 * the loudest sentence the app can say; exactly one surface may speak it, and
 * WHICH one is derived here, once, never decided per card.
 *
 * Order of precedence: the dig (the thing to do right now) > a claimable
 * reward > joining a Sounder > browsing. Everything that loses falls back to
 * outline-only — it keeps its shape, its tag and its button, it just stops
 * shouting.
 *
 * Wave 4 carries the rule off this file and across the whole scroll: the cards
 * this tab composes (`HungerHero`, `FeedingAction`, `SounderHomeCard`,
 * `SounderStepCard`) each take a `hero` prop and NEVER decide it from their own
 * state. One state → one hero:
 *
 *   dig    → the Feeding card (or the funnel's `first_dig` step card)
 *   claim  → the ClaimAllBar
 *   join   → the Sounder join door (framed by the step card while onboarding)
 *   browse → the Hunger banner — with nothing to do, the season's own story is
 *            the one thing worth looking at
 */
// The type + the derivation live in `utils/seasonHero.ts` so the invariant is
// a unit test, not a reading of four JSX props.

/**
 * A round paper sticker that opens a reference sheet — the page crown's three
 * doors and the pass header's star / crown chips. One drawing, one press: the
 * `Sticker` sink-into-its-own-shadow, never an opacity fade (the two
 * byte-identical `headerBtnPressed` / `chipPressed` styles this retires were
 * audit C-01 and C-24 in one). The visual stays small; `hitSlop` restores the
 * 44pt frame. [C-01, C-04, C-24]
 */
function StickerDoor({
	label,
	hint,
	onPress,
	tone = "paper",
	style,
	hitSlop,
	children,
}: {
	label: string;
	hint?: string;
	onPress: () => void;
	tone?: "paper" | "sun";
	style: ViewStyle;
	hitSlop: number;
	children: React.ReactNode;
}) {
	return (
		<Sticker
			color={tone}
			rotate={0}
			radius={RADII.pill}
			shadow="sm"
			onPress={onPress}
			hitSlop={hitSlop}
			accessibilityLabel={label}
			accessibilityHint={hint}
			style={style}
		>
			{children}
		</Sticker>
	);
}

function HeaderDoor(props: {
	label: string;
	hint?: string;
	onPress: () => void;
	children: React.ReactNode;
}) {
	return <StickerDoor {...props} style={styles.headerBtn} hitSlop={HEADER_BTN_HIT} />;
}

function ChipDoor(props: {
	label: string;
	hint?: string;
	onPress: () => void;
	children: React.ReactNode;
}) {
	return (
		<StickerDoor {...props} tone="sun" style={styles.recapBtn} hitSlop={CHIP_BTN_HIT} />
	);
}

function WallowCard({
	count,
	ready,
	powerLevel,
	regenPercent,
	nextRegenPercent,
	regenSeconds,
	nextRegenSeconds,
	busy,
	onWallow,
}: {
	count: number;
	ready: boolean;
	powerLevel: number;
	regenPercent: number;
	nextRegenPercent: number;
	regenSeconds: number;
	nextRegenSeconds: number;
	busy: boolean;
	onWallow: () => void;
}) {
	const label = busy
		? "wallowing…"
		: ready
			? count > 0
				? "Raise my Wallow rank"
				: "Wallow"
			: "Fill the last XP to Wallow";
	return (
		<Sticker color="cream" radius={RADII.xl} style={wallowStyles.card}>
			<View style={wallowStyles.topline}>
				<View style={wallowStyles.mark}>
					<Glyph name="flame" size={STONE_ICON} />
				</View>
				<View style={wallowStyles.copy}>
					<Kicker>THE MUD IS WARM</Kicker>
					<T role="sectionTitle">Wallow Rank {count + 1}</T>
					<Hand tone="secondary" style={wallowStyles.body}>
						{powerLevel >= WALLOW_MAX_POWER_LEVEL
							? "Begin another sparse reward path and raise your public rank. Your regeneration is already at full blaze."
							: `Keep everything, begin a new reward path, and get a tickle ${formatDurationCompact(nextRegenSeconds)} apart (${wallowWaitReductionLabel(nextRegenPercent)}).`}
					</Hand>
				</View>
			</View>
			<View style={wallowStyles.rateCompare}>
				<View style={wallowStyles.rateStat}>
					<T role="kickerPill" tone="secondary">NOW · RANK {count}</T>
					<Numeral style={wallowStyles.rateValue}>
						1 tickle / {formatDurationCompact(regenSeconds)}
					</Numeral>
					<Label tone="accent">{wallowWaitReductionLabel(regenPercent)}</Label>
				</View>
				<Glyph name="arrowRight" size={WALLOW_PIP_H} />
				<View style={[wallowStyles.rateStat, wallowStyles.rateStatNext]}>
					<T role="kickerPill" tone="secondary">AFTER · RANK {count + 1}</T>
					<Numeral style={wallowStyles.rateValue}>
						1 tickle / {formatDurationCompact(nextRegenSeconds)}
					</Numeral>
					<Label tone="accent">{wallowWaitReductionLabel(nextRegenPercent)}</Label>
				</View>
			</View>
			<View style={wallowStyles.powerRow}>
				{Array.from({ length: WALLOW_MAX_POWER_LEVEL }, (_, i) => (
					<View key={i} style={[wallowStyles.powerPip, i < powerLevel && wallowStyles.powerPipOn]} />
				))}
				<Label tone="secondary" style={wallowStyles.standing}>
					{powerLevel}/{WALLOW_MAX_POWER_LEVEL} power ranks
				</Label>
			</View>
			<Button
				full
				disabled={!ready || busy}
				onPress={onWallow}
				accessibilityState={{ busy }}
				accessibilityLabel={label}
				accessibilityHint={`Spends this pass and starts Wallow Rank ${count + 1}; every reward you have already claimed stays yours`}
			>
				{label}
			</Button>
		</Sticker>
	);
}

function StoneThumb({ reward, locked }: { reward: TierRow; locked: boolean }) {
	// Shape resolution lives in utils/rewardArt (the single owner); StoneThumb
	// maps each kind to its own stone-sized glyph/art.
	const art = resolveRewardArt(reward);

	let inner: React.ReactNode;
	switch (art.kind) {
		case "tickles":
			inner = <TickleIcon size={STONE_ICON} />;
			break;
		case "snouts":
			inner = <Glyph name="pigface" size={STONE_ICON} />;
			break;
		case "goldenTruffle":
			inner = (
				<Image source={art.source} style={styles.stoneArt} resizeMode="contain" />
			);
			break;
		case "image":
			inner = (
				<Image source={art.source} style={styles.stoneImage} resizeMode="contain" />
			);
			break;
		case "title":
			// The title reward's quote mark — sanctioned typography, set in the
			// display voice rather than drawn as art.
			inner = <T role="pageTitle">&quot;</T>;
			break;
		case "boost":
			inner = <Icon name="flame" size={STONE_MARK} filled color={WHIMSY.flame} strokeWidth={1.5} />;
			break;
		case "legacyBackground":
			inner = <Icon name="globe" size={STONE_MARK} color={WHIMSY.ink} strokeWidth={1.6} />;
			break;
		case "legacyAura":
			inner = <Icon name="premium" size={STONE_MARK} color={UI_COLORS.warningText} strokeWidth={1.6} />;
			break;
		case "legacyCape":
			inner = <Icon name="star" size={STONE_MARK} color={WHIMSY.ink} strokeWidth={1.6} />;
			break;
		case "special":
			inner = <Icon name="star" size={STONE_MARK} filled color={UI_COLORS.warningText} strokeWidth={1.6} />;
			break;
		default:
			inner = <Icon name="star" size={STONE_MARK} color={UI_COLORS.uiMuted} />;
			break;
	}

	// The locked stone's ART recedes — the CONTROL's locked state is the node's
	// dashed outline and its lock badge (the C-07 ruling: mute the fill, never
	// dissolve the outline). This is a picture inside that outline, not a
	// disabled control, so the token ladder's `dim` step is the right reach.
	return (
		<View style={[styles.stone, locked && styles.stoneLocked]}>{inner}</View>
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
// TierState + tierStatsFor now live in utils/seasonPass.

function StatsPills({
	stats,
}: {
	stats: { claimed: number; ready: number; locked: number };
}) {
	// Read-only counters, so they are `Tag`s — the capsule that announces as
	// text instead of pretending to be a button. [C-02]
	return (
		<View style={vlStyles.statsRow}>
			<Tag
				tone="sage"
				label={`${stats.claimed} CLAIMED`}
				accessibilityLabel={`${stats.claimed} claimed`}
			/>
			<Tag
				tone="sun"
				label={`${stats.ready} READY`}
				accessibilityLabel={`${stats.ready} ready to claim`}
			/>
			<Tag
				tone="paper"
				label={`${stats.locked} LOCKED`}
				accessibilityLabel={`${stats.locked} still locked`}
			/>
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
	tierLabel = "TIER",
	isFirst,
	isLast,
	onClaim,
}: {
	tier: number;
	state: TierState;
	reward: TierRow | undefined;
	premium?: boolean;
	tierLabel?: string;
	isFirst: boolean;
	isLast: boolean;
	onClaim: () => void;
}) {
	if (!reward) return null;
	const isClaimed = state === "claimed";
	const isReady = state === "ready";
	const isLocked = state === "locked";

	// Card fill — sage when claimed, paper otherwise. The READY row used to wear
	// the full sun highlight; under the one-hero rule (C-26) the sun belongs to
	// the tab's single primary action, so a ready row now says "ready" with a
	// heavy ink outline, its READY tag and its Claim button, and stops
	// competing with the claim bar above it.
	const cardColor = isClaimed ? "sage" : "paper";
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
					{/* Corner state badge. C-02: every badge glyph is dark ink on a
					    PALE fill — paper-on-pastel was never a legible pair. */}
					{isClaimed && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeClaimed]}>
							<Icon
								name="check"
								size={BADGE_MARK}
								color={UI_COLORS.successText}
								strokeWidth={3}
							/>
						</View>
					)}
					{isReady && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeReady]}>
							<T role="kickerPill" tone="danger" style={vlStyles.cornerBadgeText}>
								!
							</T>
						</View>
					)}
					{isLocked && (
						<View style={[vlStyles.cornerBadge, vlStyles.cornerBadgeLocked]}>
							<Icon name="lock" size={BADGE_MARK} color={WHIMSY.ink} filled />
						</View>
					)}
				</View>
				{!isLast && <View style={vlStyles.connectorBottom} />}
			</View>

			{/* Column 2 — card. */}
			<Sticker
				color={cardColor}
				rotate={0}
				radius={RADII.lg}
				border={isReady ? BORDER.heavy : BORDER.ink}
				shadow={isLocked ? "none" : "sticker"}
				style={[vlStyles.card, isLocked && vlStyles.cardLocked]}
			>
				<View style={vlStyles.cardHeader}>
					<View style={vlStyles.cardHeaderLeft}>
						<T role="kickerPill" tone="secondary" style={vlStyles.tierCap}>
							{tierLabel} {tier}
						</T>
						{premium && (
							<View
								style={vlStyles.clubCrest}
								accessibilityLabel="also has a Slop Club reward"
							>
								<Icon name="premium" size={CREST_MARK} color={WHIMSY.ink} filled />
							</View>
						)}
					</View>
					{isClaimed ? (
						<Tag tone="sage" icon="check" label="CLAIMED" />
					) : isReady ? (
						<Tag tone="roseDeep" label="READY" />
					) : (
						<Tag tone="muted" icon="lock" label="LOCKED" />
					)}
				</View>
				<Numeral
					tone={isClaimed || isLocked ? "secondary" : "primary"}
					style={[vlStyles.rewardLabel, isClaimed && vlStyles.rewardLabelClaimed]}
					numberOfLines={2}
				>
					{reward.display_label}
				</Numeral>
				{isReady && (
					<View style={vlStyles.claimBtnWrap}>
						<Button
							size="sm"
							variant="dark"
							full
							onPress={onClaim}
							accessibilityLabel={`Claim ${reward.display_label}`}
							accessibilityHint={`Adds ${reward.display_label} to your account`}
						>
							Claim reward ✦
						</Button>
					</View>
				)}
			</Sticker>
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
	sparse = false,
	tierLabel = "TIER",
}: {
	totalTiers: number;
	currentTier: number;
	tiersByNumber: Record<number, { free?: TierRow; premium?: TierRow }>;
	claimedSet: Set<string>;
	onClaim: (tier: number, track: PassTrack) => void;
	track: PassTrack;
	premiumUnlocked: boolean;
	sparse?: boolean;
	tierLabel?: string;
}) {
	// Premium track under glass — every row locked, no claim, no VIP
	// pill (the whole track is premium). Otherwise the normal per-tier
	// stats (free track, or an unlocked premium track).
	const premiumLocked = track === "premium" && !premiumUnlocked;
	const rewardTiers = Array.from({ length: totalTiers }, (_, i) => i + 1)
		.filter((t) => !!tiersByNumber[t]?.[track]);
	const stats = premiumLocked
		? { claimed: 0, ready: 0, locked: rewardTiers.length }
		: seasonPass.tierStatsFor(rewardTiers, currentTier, claimedSet, track);

	const stateFor = (t: number): TierState =>
		premiumLocked
			? "locked"
			: claimedSet.has(`${t}:${track}`)
				? "claimed"
				: t <= currentTier
					? "ready"
					: "locked";

	// Peak-end: show a five-tier context around the player (rebalanced at either
	// end), every ready tier, and the next reward. The forward tail expands in
	// place and is remembered until this track remounts.
	const [expanded, setExpanded] = useState(false);

	const tiers = rewardTiers;
	const window = seasonPass.tierWindow(
		tiers,
		totalTiers,
		currentTier,
		(t) => stateFor(t) === "ready"
	);
	const visibleTiers = sparse
		? tiers
		: expanded
			? [...window.collapsedTiers, ...window.forwardTiers]
			: window.collapsedTiers;
	const forwardCount = sparse ? 0 : window.forwardTiers.length;

	return (
		<View>
			<StatsPills stats={stats} />
			<View style={vlStyles.list}>
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
							tierLabel={tierLabel}
							isFirst={i === 0}
							isLast={i === visibleTiers.length - 1}
							onClaim={() => onClaim(t, track)}
						/>
					);
				})}
			</View>
			{forwardCount > 0 && (
				<Button
					variant="link"
					size="sm"
					style={collapseStyles.row}
					onPress={() => setExpanded((value) => !value)}
					accessibilityLabel={
						expanded ? "Show fewer tiers" : `Show ${forwardCount} more tiers`
					}
					accessibilityState={{ expanded }}
				>
					{expanded
						? "‹ show fewer tiers"
						: `…and ${forwardCount} more ${forwardCount === 1 ? "tier" : "tiers"} ›`}
				</Button>
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
	},
});

// Locked-premium call-to-action banner. Sits above the list when the player is
// browsing the premium track without membership. States the truth — the premium
// track is a Slop Club perk (not a separate pass) — and its CTA opens the same
// Slop Club paywall the shop + Account use. Slop Club gold identity, matching
// the members band elsewhere.
function PremiumLockedBanner({ onUnlock }: { onUnlock: () => void }) {
	return (
		<Sticker color={WHIMSY.slopBand} radius={RADII.xl} style={passBannerStyles.wrap}>
			<View style={passBannerStyles.crest}>
				<Icon name="premium" size={CREST_ICON} color={WHIMSY.ink} filled />
			</View>
			<View style={passBannerStyles.textCol}>
				<Numeral>A Slop Club perk</Numeral>
				<Hand style={passBannerStyles.body}>
					The premium track comes with Slop Club — join to claim every reward on it.
				</Hand>
			</View>
			<Button
				size="xs"
				variant="dark"
				onPress={onUnlock}
				accessibilityLabel="Join the Slop Club"
				accessibilityHint="Opens the Slop Club subscription — it unlocks every premium tier"
			>
				Join ›
			</Button>
		</Sticker>
	);
}

// The ready-claim shortcut — a sticker bar above the pass track whenever ANY
// tier is ready to claim (the founder's note: a ready reward announced only at
// the page bottom is a ready reward nobody sees). One ready tier names its
// reward ("25 tickles is ready — claim ›"); two or more sweep in one tap. The
// row itself is the affordance (no separate CTA), and it sinks into its own
// hard shadow when pressed — the `Sticker` press, not a fade.
//
// `hero` is the one-hero rule (C-26): the bar wears the sun-yellow highlight
// only when claiming IS the tab's primary action. When the dig is open, the
// bar keeps its shape and its words on paper and lets the dig be the loud one.
function ClaimAllBar({
	count,
	label,
	busy,
	hero,
	onPress,
}: {
	count: number;
	/** The single ready tier's display label (count === 1 only) — names the reward. */
	label?: string;
	busy: boolean;
	hero: boolean;
	onPress: () => void;
}) {
	const single = count === 1;
	return (
		<Sticker
			color={hero ? "sun" : "paper"}
			rotate={0}
			radius={RADII.lg}
			border={hero ? BORDER.ink : BORDER.heavy}
			shadow="sm"
			onPress={() => {
				if (!busy) onPress();
			}}
			accessibilityRole="button"
			accessibilityLabel={
				single
					? `Claim ${label ?? "your ready reward"}`
					: `Claim all ${count} ready rewards`
			}
			accessibilityHint={
				single
					? "Adds it to your account"
					: "Claims every ready tier on this track in one go"
			}
			accessibilityState={{ busy }}
			style={claimAllStyles.bar}
		>
			<Glyph name="gift" size={CREST_ICON} />
			<Numeral style={claimAllStyles.text}>
				{single ? `${label ?? "a reward"} is ready` : `${count} rewards ready`}
			</Numeral>
			<Hand tone="accent" style={claimAllStyles.cta}>
				{busy ? "claiming…" : single ? "claim ›" : "claim all ›"}
			</Hand>
		</Sticker>
	);
}

const claimAllStyles = StyleSheet.create({
	bar: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.sm,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	text: { flex: 1 },
	cta: { textDecorationLine: "underline" },
});

const vlStyles = StyleSheet.create({
	// Stats tag row above the list. Display-only counters per the
	// resolved decision; no tap-to-filter behavior.
	statsRow: {
		flexDirection: "row",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},

	// The tier rows themselves, under the stats tags.
	list: { marginTop: SPACE.sm },

	// Row layout — node column + card column side-by-side.
	row: {
		flexDirection: "row",
		alignItems: "stretch",
	},

	// Node column — fixed width so the spine reads as a clean line
	// down the screen. Connector halves fill above + below the node.
	nodeCol: {
		width: NODE_COL,
		alignItems: "center",
	},
	connectorTop: {
		width: 0,
		height: SPACE.md,
		borderLeftWidth: BORDER.thin,
		borderLeftColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	connectorBottom: {
		flex: 1,
		width: 0,
		borderLeftWidth: BORDER.thin,
		borderLeftColor: UI_COLORS.uiMuted,
		borderStyle: "dashed",
	},
	node: {
		width: NODE,
		height: NODE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.heavy,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	// Locked keeps its shape and mutes its fill — it never dissolves [C-07].
	// The shadow is zeroed, not swapped for a softer tier: a resting node is
	// simply not lifted off the paper (spec §1.3 — two shadow tiers, or none).
	nodeLocked: {
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
		shadowOpacity: 0,
		elevation: 0,
	},
	cornerBadge: {
		position: "absolute",
		top: -SPACE.xs,
		right: -SPACE.xs,
		width: CORNER_BADGE,
		height: CORNER_BADGE,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
	},
	// Audit C-02: the paper check on the saturated success fill measured 2.0:1.
	// Both state badges now run the semantic PALE surface + DARK ink pair, which
	// is the only pairing that clears AA at 11px.
	cornerBadgeClaimed: { backgroundColor: UI_COLORS.successSurface },
	cornerBadgeReady: { backgroundColor: WHIMSY.rose },
	cornerBadgeLocked: { backgroundColor: WHIMSY.paper },
	cornerBadgeText: { letterSpacing: 0 },

	// Card column.
	card: {
		flex: 1,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
		marginVertical: SPACE.xs,
	},
	cardLocked: {
		borderStyle: "dashed",
		borderColor: UI_COLORS.uiMuted,
	},
	cardHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	cardHeaderLeft: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		flexShrink: 1,
	},
	tierCap: { flexShrink: 1 },
	// Slop Club crest — a small gold-chip mark on free rows that ALSO carry a
	// premium-track reward. Reads as "there's a Slop Club reward here too", never
	// as "VIP-only" (the row's free reward is claimable by anyone). Slop Club gold
	// + ink border, matching the shop's members identity.
	clubCrest: {
		width: CLUB_CREST,
		height: CLUB_CREST,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.slopGold,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
	},
	rewardLabel: { marginTop: SPACE.xxs },
	rewardLabelClaimed: { textDecorationLine: "line-through" },
	// Ready-state inline Claim CTA — the shared dark Button primitive (ink pill,
	// full width); this wrap just owns the top gap.
	claimBtnWrap: {
		marginTop: SPACE.sm,
	},
});

// The Free / Premium track toggle is `SegmentedControl` — the shared primitive
// that already announces `radiogroup` and guarantees 44pt targets. (The comment
// that used to sit here claimed no such primitive existed; it did, and that
// claim is how a fourth hand-rolled segment gets written. [C-05])
const passTabStyles = StyleSheet.create({
	row: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
});

// Locked-premium "join the Slop Club" banner — the Slop Club gold identity.
const passBannerStyles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.md,
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.md,
		marginTop: SPACE.sm,
		marginBottom: SPACE.xs,
	},
	// The Slop Club crest — gold chip + ink border, matching the members ribbon.
	crest: {
		width: BANNER_CREST,
		height: BANNER_CREST,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.slopGold,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		...SHADOW_SM,
	},
	textCol: {
		flex: 1,
		minWidth: 0,
	},
	body: {
		marginTop: SPACE.xxs,
	},
});

export default function SeasonScreen() {
	// Season state, the derived pass math, and the claim/wallow actions over the
	// existing RPCs all live in useSeason. This screen keeps the rendering, the
	// dialog copy + summary-text building, the sounds/haptics, and the tier-up
	// celebration; it calls load() (the hook's refresh) at the original beats.
	const {
		state,
		loadError,
		busy,
		uid,
		alignmentScore,
		ticklesEarned,
		refresh: load,
		prestigeMode,
		claimedSet,
		tiersByNumber,
		wallowClaimedSet,
		wallowTiersByNumber,
		nextReward,
		claim,
		claimAll,
		wallow,
	} = useSeason();
	const habitatJournal = useHabitatJournal(uid);
	const isFocused = useIsFocused();
	const [wallowGiftAccount, setWallowGiftAccount] = useState<string | null>(null);
	useEffect(() => {
		if (wallowGiftAccount && wallowGiftAccount !== uid) setWallowGiftAccount(null);
	}, [uid, wallowGiftAccount]);
	// Season 1 vs the preserved Season-0 rendering on the else-branch.
	const s1 = useSeason1Active();
	// The Great Hunger intro — the tale cinematic. Auto-opens on this account's
	// FIRST visit to the Season-1 tab (AsyncStorage stamp, per-user) and
	// re-opens any time from the hero's "Hear the tale again" chip.
	const [introOpen, setIntroOpen] = useState(false);
	// Sounder state drives the walkthrough stepper (join → dig).
	const crewHook = useCrew(s1);
	// The onboarding funnel step — DERIVED from server/client state (never stored),
	// so the "do this now" slot always shows the right next move and retires itself
	// at DONE. Re-reads on focus; we also refresh() it after a dig / crew change.
	const sounderPath = useSounderPath(s1);
	const devSeason = useDevSeasonOverrides();
	const [devSeasonSheetOpen, setDevSeasonSheetOpen] = useState(false);
	const visibleSounderStep =
		__DEV__ && devSeason.step ? devSeason.step : sounderPath.step;
	// The "join a Sounder" coach-mark gate — lights once, on the `join` step.
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
	const feedingCta = useFeedingCta(handleDug, ticklesEarned);
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
	// — iOS renders two native Modals stacked/clipped. Priority (seasonEnd, 25 —
	// see constants/popupPriorities.ts) sits just after the finale verdict (20) and
	// ahead of the quiet-fill nudges: verdict → recap → nudge. Manual re-open
	// (recapOpen) and the __DEV__ preview bypass the queue.
	const seasonEndSlot = usePopupSlot(
		"seasonEnd",
		seasonEnd.show,
		POPUP_PRIORITIES.seasonEnd
	);
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
	const [passTrack, setPassTrack] = useState<PassTrack>("free");
	// The season's reference sheets (story / earnables) — opened from the two
	// header icon buttons; the tab's scroll stays the playable path.
	const [infoTopic, setInfoTopic] = useState<SeasonInfoTopic | null>(null);
	// "How to earn XP" — the pass header's star button.
	const [xpHelpOpen, setXpHelpOpen] = useState(false);
	// Alignment placard moved here from the Me tab — the player's greedy↔generous
	// score + its blessing/curse/regen modifiers. alignmentScore + ticklesEarned
	// (this season's reclaimed count) ride the season fetch in useSeason.
	const [alignmentExplainerOpen, setAlignmentExplainerOpen] = useState(false);
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
	const [claimedMotes, setClaimedMotes] = useState<number | null>(null);
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

	// The season tab's direct-tap native Modals live outside the popup queue, so
	// hold the queue while any is open — a foreground poll (schism/finale/
	// achievements on AppState "active") must not present a queued popup over one
	// (the #50152 wedge, issue #4). This covers the inline claim dialogs + the
	// XP-help sheet, the Great Hunger intro's REPLAY path (introOpen — the launch
	// path is queue-slotted in app/_layout.tsx and must NOT be held here), and the
	// season-end recap's manual/dev bypass (recapOpen / devReward — the slot path,
	// seasonEndSlot.visible, is excluded so we never drain our own presenting
	// slot). The self-holding sheets (guide/info/explainer/hero, TickleBreakdown,
	// mystery reveal) manage their own hold or slot and are intentionally omitted.
	useUnmanagedModalHold(
		introOpen ||
			recapOpen ||
			devReward != null ||
			claimedReward != null ||
			claimNotice != null ||
			claimAllSummary != null ||
			xpHelpOpen
	);

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

	// The season_state fetch + the profile read + focus refresh now live in
	// useSeason (load === its refresh).

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

	// claimedSet / tiersByNumber / wallowClaimedSet / wallowTiersByNumber /
	// prestigeMode / nextReward are derived in useSeason (memoized calls into
	// utils/seasonPass) and destructured above. The claim RPC round-trip lives in
	// the hook too (claim / claimAll).

	// Success flourish shared by single + claim-all — chime + haptic. Stays in the
	// screen: the audio player + haptics are view concerns.
	const claimFlourish = () => {
		try {
			claimPlayer.seekTo(0);
			claimPlayer.play();
		} catch {}
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
	};

	const handleWallow = async () => {
		const r = await wallow();
		if (!r) return;
		if (!r.ok) {
			const body =
				r.reason === "claim_rewards_first"
					? "Claim the rewards waiting on your pass first — they come with you."
					: r.reason === "not_ready"
						? "The mud needs a little more XP before you can Wallow."
						: "The Wallow didn't settle. Give it another tap in a moment.";
			setClaimNotice({ title: "Not quite yet", body });
			return;
		}
		claimFlourish();
		setClaimAllSummary({
			title: `Wallow Rank ${r.wallow_count}`,
			body: `Your aura burns brighter. Tickle ${wallowWaitReductionLabel(r.regen_percent)} — one every ${formatDurationCompact(r.regen_seconds)} at your current effects.`,
		});
		await load();
		await habitatJournal.refresh();
		if (uid) setWallowGiftAccount(uid);
	};

	const handleClaim = async (tier: number, track: PassTrack) => {
		const r = await claim(tier, track);
		if (!r) return;
		if (!r.ok) {
			// In-world notice, not a system Alert — and a per-reason title so
			// "already claimed" doesn't wear a wrong "Locked" hat. A transport miss
			// arrives as reason "network" (not in the maps) → the same "Couldn't
			// claim / give it another tap" fallback the raw-null path always showed.
			const reason = r.reason;
			if (reason === "pass_changed") await load();
			const bodyMap: Record<string, string> = {
				pass_changed: "Your pass moved to a new lap or season. Review its rewards and claim again.",
				tier_locked: `Reach tier ${tier} first — you're at ${r.current_tier}.`,
				premium_locked: "Join the Slop Club to claim the premium track.",
				already_claimed: "You've already claimed this one.",
				no_active_season: "No season is running right now.",
				no_reward: "There's nothing to claim here.",
				truffle_cap: "Your Golden Truffle pouch is full. Spend one at the Exchange, then come back.",
			};
			const titleMap: Record<string, string> = {
				pass_changed: "Your pass has moved on",
				tier_locked: "Not yet",
				premium_locked: "A Slop Club perk",
				already_claimed: "Already yours",
				no_active_season: "No season",
				no_reward: "Nothing here",
				truffle_cap: "Pouch full",
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
		if (r.reward_type === "motes" && r.motes_granted !== undefined) {
			setClaimedMotes(r.motes_granted);
		} else if (r.granted_hat_id || r.fallback_snouts) {
			setMysteryReveal(r);
		} else {
			const claimedRow = (prestigeMode ? wallowTiersByNumber : tiersByNumber)[tier]?.[track];
			if (claimedRow) setClaimedReward(claimedRow);
		}
		load();
	};

	// The shown track + the tiers READY to claim on it. Both depend on passTrack
	// (which tab the player is browsing — view state), so they stay in the screen,
	// composed from useSeason's state + the pure seasonPass selectors. readyTiers
	// powers the "claim all ›" affordance and the sweep.
	const shownTrack: PassTrack = useMemo(
		() => seasonPass.shownTrack(state, passTrack, prestigeMode),
		[state, passTrack, prestigeMode]
	);
	const readyTiers = useMemo(
		() =>
			seasonPass.readyTiers(state, {
				prestige: prestigeMode,
				shownTrack,
				tiersByNumber,
				claimedSet,
				wallowTiersByNumber,
				wallowClaimedSet,
			}),
		[state, prestigeMode, shownTrack, tiersByNumber, claimedSet, wallowTiersByNumber, wallowClaimedSet]
	);

	// Claim every READY tier on the shown track in one tap. Claims sequentially
	// (the RPC is per-tier), respects the single busy guard, and ends on ONE
	// summary beat — "N rewards claimed — X tickles + the Reed Hat" — instead of
	// N stacked dialogs. Mystery-box tiers still fall through to their own reveal
	// (they carry a per-claim grant that deserves its unboxing), but their name is
	// folded into the tally too.
	const handleClaimAll = async () => {
		const tally = await claimAll(readyTiers, shownTrack);
		if (!tally) return;
		if (tally.reason) {
			await load();
			setClaimNotice({
				title: tally.reason === "pass_changed" ? "Your pass has moved on" : "Couldn't claim",
				body: "Review your current rewards and try again.",
			});
			return;
		}
		claimFlourish();
		await load();
		// Fold the tally into one line. Tickles read as a single "X tickles" clause;
		// each named item is listed (capped so the beat stays a glance).
		const { claimedCount, failed, tickles, motes, items, lastMystery } = tally;
		// A sweep containing only Motes gets the same direct machine handoff as
		// an individual Mote claim. Mixed hauls retain the full reward summary.
		if (motes > 0 && items.length === 1 && tickles === 0 && !lastMystery && failed === 0) {
			setClaimedMotes(motes);
			return;
		}
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

	// The premium track unlocks via Slop Club membership (handleUnlockPremium);
	// there is no standalone paid-pass purchase path.

	if (!state) {
		return (
			<View style={[styles.container, styles.center]}>
				{loadError ? (
					<EmptyState
						kind="error"
						title="Couldn't reach the season"
						sub="The bog is slow right now — give it another go."
						action={
							<Button
								variant="ghost"
								onPress={() => void load()}
								accessibilityLabel="Try loading the season again"
								accessibilityHint="Re-reads the season from the server"
							>
								try again
							</Button>
						}
					/>
				) : (
					<LoadingBeat label="reading the season" />
				)}
			</View>
		);
	}
	const season = state.active ? state.season : undefined;
	if (!season) {
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

	const tier = state.current_tier ?? 1;
	const premium = state.premium_unlocked ?? false;
	// Show the Free/Premium tabs only when the season actually seeds
	// premium rewards; otherwise the free list stands alone (today's UI).
	const hasPremiumTrack = (state.tiers ?? []).some((r) => r.track === "premium");
	const activeTiersByNumber = prestigeMode ? wallowTiersByNumber : tiersByNumber;
	const activeClaimedSet = prestigeMode ? wallowClaimedSet : claimedSet;

	// YOUR TAKE strip → pass cell. READY? scroll to the pass so the claim button
	// is on screen (the strip is a glance, the claim lives on the track). Not
	// ready? same scroll, so the player sees where the XP is headed. One motion
	// either way — the section's claim state does the rest.
	const openPassSection = () => {
		scrollRef.current?.scrollTo({ y: passSectionY.current, animated: true });
	};

	// The one-hero derivation (see the block comment above). Every surface this
	// tab draws asks THIS, not its own state, before it reaches for the sun.
	const digAvailable =
		!feedingCta.noCrew && feedingCta.phaseOpen && !feedingCta.dugThisWindow;
	const primaryAction = seasonPrimaryAction({
		digAvailable,
		readyTierCount: readyTiers.length,
		inCrew: !!crewHook.crew.crew,
	});

	// …and the ONE surface it hands the sun to. Exactly one of these is true in
	// every state; the cards take it as a prop and never ask their own state.
	const heroSurface = seasonHeroSurface(primaryAction);
	const feedingIsHero = heroSurface === "feeding";
	const claimIsHero = heroSurface === "claim";
	const sounderIsHero = heroSurface === "sounder";
	// The onboarding step card stands in for whichever surface it is currently
	// drawing: the dig CTA on `first_dig`, the join door on taste / join.
	const stepCardIsHero =
		visibleSounderStep === "first_dig" ? feedingIsHero : sounderIsHero;

	return (
		<SpotlightProvider>
		<View style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				{/* Season 1 wears the Hungerer's name; Season 0 keeps its framing.
				    (The old dev intro-preview chip is gone — the real retrigger
				    lives on the hero as "Hear the tale again".) The crown is
				    `PageHeader variant="tab"` — the kicker + title rulings live in
				    that component's header comment. [C-10] */}
				<PageHeader
					variant="tab"
					kicker={s1 ? "season 1 — the great hunger" : season.name.toLowerCase()}
					title={s1 ? "The Great Hunger" : "Goblins vs Angels"}
					/* Reference sheets — the tale cinematic (scene), the season
					   story (scroll), and the earnables shelf (gift). Their
					   sections left the scroll for these modals. */
					right={
						s1 ? (
							<>
								<HeaderDoor
									label="Hear the tale again"
									hint="Replays the Great Hunger tale"
									onPress={() => setIntroOpen(true)}
								>
									<Glyph name="scene" size={CREST_ICON} />
								</HeaderDoor>
								<HeaderDoor
									label="The season's story"
									onPress={() => setInfoTopic("story")}
								>
									<Icon name="scroll" size={CREST_ICON} color={WHIMSY.ink} />
								</HeaderDoor>
								<HeaderDoor
									label="What you can earn"
									onPress={() => setInfoTopic("spoils")}
								>
									<Icon name="gift" size={CREST_ICON} color={WHIMSY.ink} />
								</HeaderDoor>
							</>
						) : undefined
					}
					below={
						__DEV__ ? (
						<>
							{/* Live entry point is the pass header's recap icon (only shows
							    when a real grant exists). This __DEV__-only chip cycles the
							    four founder tiers so the reveal is previewable without a
							    grant; it never renders in production. */}
							{__DEV__ && (
								<View style={styles.devChipRow}>
									<Pressable
										onPress={() => {
											const r = DEV_PREVIEW_REWARDS[devTierIdx % DEV_PREVIEW_REWARDS.length];
											setDevTierIdx((n) => n + 1);
											setDevReward(r);
										}}
										hitSlop={SPACE.sm}
										accessibilityRole="button"
										accessibilityLabel="Dev: preview the founder gift"
										style={({ pressed }) => [styles.devRewardChip, pressed && PRESSED_FLAT]}
									>
										<T role="hand" tone="onDark" style={styles.devRewardChipText}>
											dev · founder gift ({DEV_PREVIEW_REWARDS[devTierIdx % DEV_PREVIEW_REWARDS.length].tier})
										</T>
									</Pressable>
									<Pressable
										onPress={() => setDevSeasonSheetOpen(true)}
										hitSlop={SPACE.sm}
										accessibilityRole="button"
										accessibilityLabel="Dev: season states"
										style={({ pressed }) => [styles.devRewardChip, pressed && PRESSED_FLAT]}
									>
										<T role="hand" tone="onDark" style={styles.devRewardChipText}>
											dev · season states
										</T>
									</Pressable>
								</View>
							)}
						</>
						) : undefined
					}
				/>

				{/* The standalone XP progress card was dropped per the
				    redesign — tier + total now reads from the
				    "season pass / Tier N/M" SectionHeader inline with
				    the snake track, and the snake stones themselves
				    show progress via their fill state. The Unlock
				    Premium CTA moved into the SectionHeader's right
				    slot below. */}

				<ScrollView ref={scrollRef} contentContainerStyle={styles.tierList}>
					{/* ── Season 1: the Hunger overview answers "what is this?", then
					    the Feeding action answers "what do I do now?" before schedule,
					    Sounder context, rewards, bounties, pass, and standings. ── */}
					{s1 && (
						<>
							{/* The value banner — the compressed hero. Its full art +
							    hunger ladder open in a sheet on tap. Controlled-open so
							    the YOUR TAKE tickle cell can open this same sheet. */}
							{/* The Hunger overview is context, not another action surface. */}
							<HungerHero
								refreshKey={digTick}
								open={heroOpen}
								onOpenChange={setHeroOpen}
								stageIndexOverride={devSeason.hungerStage}
								hero={heroSurface === "hunger"}
							/>

							{/* The tickle breakdown receipt for yourself (spec 17) — opened
							    from the YOUR TAKE tickle cell. A native Modal; nothing else
							    modal is up on the season tab, so it presents directly. */}
							<TickleBreakdownSheet
								userId={breakdownOpen ? uid : null}
								fallbackTotal={ticklesEarned}
								onClose={() => setBreakdownOpen(false)}
							/>

							{/* Returning players see one authoritative Feeding action before
							    schedule, herd context, rewards, or standings. */}
							{(!visibleSounderStep ||
								visibleSounderStep === "done" ||
								visibleSounderStep === "hook") &&
								crewHook.crew.crew && (
									<FeedingAction cta={feedingCta} prominent hero={feedingIsHero} />
								)}

							{MOTE_MACHINE_VISIBLE && <MoteMachineCard balance={state.motes} />}

							{/* The schedule explains the action after the action itself. */}
							<WindowStrip cta={feedingCta} />

							<View style={styles.sectionGap}>
								<SectionHeader
									style={styles.sectionHeaderTight}
									kicker="your Sounder"
									title={crewHook.crew.crew?.name ?? "Join a Sounder"}
									right={
										<Button
											variant="link"
											size="sm"
											style={styles.headerLink}
											onPress={() => setGuideOpen(true)}
											accessibilityLabel="How the season works"
											accessibilityHint="Opens the season guide"
										>
											how it works ›
										</Button>
									}
								/>
							</View>
							{/* Pre-DONE, the onboarding step card remains the primary
							    taste → join → first-dig path. */}
							{visibleSounderStep && visibleSounderStep !== "done" && visibleSounderStep !== "hook" ? (
								// The spotlight target is now nested INSIDE the step card,
								// wrapping just the join door (not the whole card), so the
								// coach-mark hole hugs the join affordance. We only pass the
								// "should show" flag down; the card owns the target wrap.
								<SounderStepCard
									step={visibleSounderStep}
									stalled={sounderPath.stalled}
									leaver={sounderPath.leaver}
									joinSpotlightActive={joinSpotlight.show}
									crewHook={crewHook}
									uid={uid}
									cta={feedingCta}
									refreshKey={digTick}
									onAdvance={sounderPath.refresh}
									hero={stepCardIsHero}
								/>
							) : (
								<SounderHomeCard
									crewHook={crewHook}
									uid={uid}
									cta={feedingCta}
									refreshKey={digTick}
									showFeedingAction={false}
									hero={sounderIsHero}
								/>
							)}
							{/* One shared modal for the promoted action and first-dig step. */}
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
									devCeremony={devSeason.ceremony}
									onDismissDevCeremony={() =>
										patchDevSeasonOverrides({ ceremony: undefined })
									}
								/>
							)}
						</>
					)}

					{/* Weekly bounty board — fetches my_weekly_bounties on focus
					    and renders one card per active bounty. Self-gates: renders
					    nothing when the player has no active bounties this week, so
					    it's safe above the pass for every season. The Season tab's
					    hanging-sign badge (bounty_ready_count in _layout) points here
					    when a bounty is claimable. */}
					<BountyBoard />

					{/* Section header for the pass — the list gap (SPACE.sm) owns
					    the seam above; no extra margin so the sections sit tight. */}
					<View
						onLayout={(e) => {
							passSectionY.current = e.nativeEvent.layout.y;
						}}
					>
						<SectionHeader
							kicker={prestigeMode ? "prestige path" : "season pass"}
							title={prestigeMode
								? `Wallow Rank ${state.wallow_count ?? 0} · Tier ${tier}/${season.total_tiers}`
								: `Tier ${tier}/${season.total_tiers}`}
							right={(() => {
								// Show the VIP marker + a CTA whenever the caller isn't a
								// member. When IAP is live it's the real "Unlock"; when IAP
								// is off (TestFlight) it's a disabled "Coming Soon".
								const showVip = !premium && !prestigeMode;
								// The recap icon only earns its place when there's
								// actually a Founding Herd grant to look back on.
								const showRecap = seasonEnd.reward != null;
								return (
									<>
										{/* How XP is earned — reference sheet, one tap away. */}
										<ChipDoor
											label="How to earn XP"
											hint="Opens the XP reference sheet"
											onPress={() => setXpHelpOpen(true)}
										>
											<Glyph name="star" size={CHIP_MARK} />
										</ChipDoor>
										{showVip &&
											(IAP_ENABLED ? (
												<Button
													size="xs"
													variant="gold"
													onPress={handleUnlockPremium}
													icon={
														<Icon
															name="premium"
															size={CREST_MARK}
															color={WHIMSY.goldInk}
															filled
														/>
													}
													accessibilityLabel="Join the Slop Club"
													accessibilityHint="Opens the Slop Club subscription — it unlocks the premium track"
												>
													Slop Club
												</Button>
											) : (
												// A button asleep, not a dissolved one. [C-07]
												<Button
													size="xs"
													variant="locked"
													disabled
													accessibilityLabel="Slop Club coming soon"
												>
													Coming Soon
												</Button>
											))}
										{showRecap && (
											<ChipDoor
												label="See your season-end rewards"
												onPress={() => setRecapOpen(true)}
											>
												<Glyph name="crown" size={CHIP_MARK} />
											</ChipDoor>
										)}
									</>
								);
							})()}
						/>
					</View>

					{/* Promise-before-ask: the XP chain in one line under the pass
					    header (the full "how to earn XP" modal stays for detail). */}
					<Hand tone="secondary" style={passProgressStyles.subtitle}>
						{prestigeMode
							? `Rank ${state.wallow_count ?? 0} · ${wallowWaitReductionLabel(state.wallow_regen_percent ?? 0)} · 1 tickle / ${formatDurationCompact(state.wallow_regen_seconds ?? 3600)} · ${state.wallow_tiers?.length ?? 0} rewards`
							: "earn XP by burying, digging, tickling, and visiting"}
					</Hand>

					{/* XP progress toward the next tier. The pass-track stones
					    only show discrete claim state, so this restores the
					    granular "how close to the next tier" readout. */}
					{(() => {
						const xpPer = season.xp_per_tier || 1;
						const xp = state.xp ?? 0;
						const progress = wallowProgress({
							xp,
							xpPerTier: xpPer,
							currentTier: tier,
							totalTiers: season.total_tiers,
							canWallow: state.can_wallow,
							prestigeMode,
						});
						// `ProgressTrack` is the one meter — it carries the
						// `progressbar` role and its `accessibilityValue`, which the
						// hand-rolled bar never did. The hand-written label stays
						// centred beneath it; `wallowProgress` only yields a fraction,
						// so the meter is expressed out of 100.
						return (
							<View style={passProgressStyles.wrap}>
								<ProgressTrack
									value={Math.round(progress.fraction * XP_METER_MAX)}
									max={XP_METER_MAX}
									tone="lilac"
									height="sm"
									accessibilityLabel="Pass XP"
								/>
								<Hand tone="secondary" align="center" style={passProgressStyles.label}>
									{progress.label}
								</Hand>
							</View>
						);
					})()}

					{/* Prestige converts the activity routes that already award pass XP
					    (burying, social digs, Golden Truffle Patch digs) into permanent,
					    visibly escalating regeneration power. */}
					{state.can_wallow !== undefined && tier >= season.total_tiers && (
						<WallowCard
							count={state.wallow_count ?? 0}
							ready={state.can_wallow ?? false}
							powerLevel={state.wallow_power_level ?? 0}
							regenPercent={state.wallow_regen_percent ?? 0}
							nextRegenPercent={state.wallow_next_regen_percent ?? WALLOW_REGEN_STEP_PCT}
							regenSeconds={state.wallow_regen_seconds ?? 3600}
							nextRegenSeconds={state.wallow_next_regen_seconds ?? 2700}
							busy={busy}
							onWallow={handleWallow}
						/>
					)}

					{/* "How to earn XP" lives in the header-star modal (XPHowToModal). */}

					{/* Vertical-list pass track — straight column of node +
					    card rows with per-state visual treatment (sage
					    claimed / heavy-outlined ready / dashed locked) and
					    display-only stats tags above. Replaces the
					    snake; matches the design's bottom-of-screen
					    reference. */}
					{hasPremiumTrack && !prestigeMode && (
						// Both segments stay tappable — browsing a locked premium track
						// is the point — so the lock is a mark on the segment, not a
						// `disabled` state. [C-05]
						<SegmentedControl
							label="Pass track"
							value={passTrack}
							onChange={setPassTrack}
							style={passTabStyles.row}
							options={[
								{ value: "free", label: "Free", accessibilityLabel: "Free pass track" },
								{
									value: "premium",
									label: "Premium",
									icon: premium ? undefined : "lock",
									accessibilityLabel: premium
										? "Premium pass track"
										: "Premium pass track, locked behind Slop Club",
								},
							]}
						/>
					)}
					{hasPremiumTrack && !prestigeMode && passTrack === "premium" && !premium && (
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
									? activeTiersByNumber[readyTiers[0]]?.[shownTrack]?.display_label
									: undefined
							}
							busy={busy}
							hero={claimIsHero}
							onPress={handleClaimAll}
						/>
					)}
					<VerticalListPassTrack
						key={`${season.id}:${prestigeMode ? `wallow:${state.season_wallow_count ?? 0}` : shownTrack}`}
						totalTiers={season.total_tiers}
						currentTier={tier}
						tiersByNumber={activeTiersByNumber}
						claimedSet={activeClaimedSet}
						onClaim={handleClaim}
						track={prestigeMode ? "free" : hasPremiumTrack ? passTrack : "free"}
						premiumUnlocked={premium}
						sparse={prestigeMode}
						tierLabel={prestigeMode ? "WALLOW TIER" : "TIER"}
					/>

					{/* Alignment placard — SEASON 0 ONLY. Alignment isn't a thing
					    in Season 1 (the mechanics still hum server-side, but the
					    identity UI retires with Judgement Day). */}
					{!s1 && (
					<>
					<View style={styles.sectionGap}>
						<SectionHeader kicker="standing" title="Alignment" />
					</View>
					<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={alignmentStoryStyles.wrap}>
						<View style={alignmentStoryStyles.labelRow}>
							<T role="kickerPill" style={alignmentStoryStyles.greedy}>Greedy</T>
							<Numeral>
								{alignmentScore >= 0 ? "+" : ""}
								{alignmentScore}
							</Numeral>
							<T role="kickerPill" style={alignmentStoryStyles.generous}>Generous</T>
						</View>
						<AlignmentBar score={alignmentScore} />
						{(() => {
							const fx = alignmentEffects(alignmentScore);
							const sgn = (n: number) => (n > 0 ? `+${n}` : `${n}`);
							return (
								<View style={alignmentStoryStyles.effectsRow}>
									<Tag tone="paper" label={`Regen ${sgn(fx.regenPct)}%`} />
									<Tag tone="paper" label={`Blessings ${sgn(fx.blessingPct)}%`} />
									<Tag tone="paper" label={`Curses ${sgn(fx.cursePct)}%`} />
								</View>
							);
						})()}
						<Hand tone="secondary" align="center" style={alignmentStoryStyles.effectHint}>
							Give freely → your blessings grow stronger. Keep to
							yourself → your curses bite harder.
						</Hand>
						<Hand tone="secondary" align="center" style={alignmentStoryStyles.hint}>
							★ blessings push you up. asks for tickles pull you
							down. ★
						</Hand>
						<Button
							testID="alignment-how-it-works"
							variant="link"
							size="sm"
							style={alignmentStoryStyles.howLink}
							onPress={() => setAlignmentExplainerOpen(true)}
							accessibilityLabel="How alignment works"
							accessibilityHint="Opens the alignment explainer"
						>
							how alignment works ›
						</Button>
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

			{claimedMotes !== null && <MoteRewardDialog amount={claimedMotes} onClose={() => setClaimedMotes(null)} />}

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

				{isFocused && wallowGiftAccount === uid && claimAllSummary === null && habitatJournal.supported ? (
					<HabitatGiftReveal
						key={`wallow-gift:${uid}`}
						accountId={uid}
						catalog={HABITAT_CATALOG}
						onPreview={(item) => {
							router.push({ pathname: "/barn-interior", params: { purchasedItemId: item.id } });
						}}
						onDone={() => setWallowGiftAccount(null)}
					/>
				) : null}

			{/* The "join a Sounder" coach-mark — dims the tab, cuts a bright hole
			    around the join step card, and forces the tap. Only lit once (the
			    seen-stamp), on the `join` step. Tapping through the hole OR the
			    "maybe later" skip stamps it seen. */}
			<SpotlightOverlay
				activeId={joinSpotlight.show ? JOIN_SPOTLIGHT_TARGET_ID : null}
				caption="join a Sounder — dig after a crewmate for up to 5 more rubs ›"
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
			<DevSeasonStatesSheet
				visible={devSeasonSheetOpen}
				overrides={devSeason}
				onClose={() => setDevSeasonSheetOpen(false)}
			/>
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
	const itemId = rewardItemId(val);
	// Wearables route to the wardrobe; tickle/title/boost/etc. show a
	// close-only dialog since there's nothing to equip. The id-coalesce +
	// wearable set are the shared rewardArt primitives; the preview below keeps
	// its own hero-sized rendering.
	const isWearable =
		WEARABLE_REWARD_TYPES.has(type) && !!itemId && !HIDDEN_CATEGORIES.has(type);

	const preview =
		itemId && HAT_IMAGES[itemId] ? (
			<Image
				source={HAT_IMAGES[itemId]}
				style={rewardStyles.heroImage}
				resizeMode="contain"
			/>
		) : type === "tickles" ? (
			<View style={rewardStyles.heroFallback}>
				<TickleIcon size={REWARD_MARK} />
			</View>
		) : type === "golden_truffle" && HAT_IMAGES.golden_truffle ? (
			<Image source={HAT_IMAGES.golden_truffle} style={rewardStyles.heroImage} resizeMode="contain" />
		) : type === "snouts" ? (
			<View style={rewardStyles.heroFallback}>
				<Glyph name="pigface" size={REWARD_MARK} />
			</View>
		) : (
			<View style={rewardStyles.heroFallback}>
				<Icon name="star" size={REWARD_STAR} filled color={UI_COLORS.warningText} />
			</View>
		);

	return (
		<AdaptiveModalScaffold
			visible
			onRequestClose={onClose}
			animationType="fade"
			bare
			maxWidth={REWARD_CARD_MAX}
			testID="claim-reward-dialog"
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				style={[rewardStyles.card, STICKER_SHADOW]}
			>
				<Kicker align="center" style={rewardStyles.kicker}>unlocked</Kicker>
				<View style={rewardStyles.hero}>{preview}</View>
				<PageTitle align="center" accessibilityRole="header" style={rewardStyles.title}>
					{display_label}
				</PageTitle>
				<View style={rewardStyles.actions}>
					{isWearable && (
						<Button
							size="md"
							variant="primary"
							onPress={onShow}
							accessibilityLabel={`Show ${display_label} in your closet`}
							accessibilityHint="Opens the closet so you can wear it"
						>
							Show in closet
						</Button>
					)}
					<Button
						variant="link"
						size="sm"
						onPress={onClose}
						accessibilityLabel={isWearable ? "Not now" : "OK"}
						accessibilityHint="Closes this dialog"
					>
						{isWearable ? "Not now" : "OK"}
					</Button>
				</View>
			</Sticker>
		</AdaptiveModalScaffold>
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
		<AdaptiveModalScaffold
			visible
			onRequestClose={onClose}
			animationType="fade"
			bare
			maxWidth={NOTICE_CARD_MAX}
			testID="claim-notice-dialog"
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				style={[rewardStyles.noticeCard, STICKER_SHADOW]}
			>
				<T role="sectionTitle" align="center" accessibilityRole="header">
					{notice.title}
				</T>
				<Body tone="secondary" align="center" style={rewardStyles.noticeBody}>
					{notice.body}
				</Body>
				<Button
					variant="link"
					size="sm"
					onPress={onClose}
					accessibilityLabel="OK"
					accessibilityHint="Closes this notice"
				>
					OK
				</Button>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const rewardStyles = StyleSheet.create({
	card: {
		width: "100%",
		padding: SPACE.xl,
		alignItems: "center",
	},
	kicker: {
		marginBottom: SPACE.sm,
	},
	hero: {
		width: REWARD_WELL,
		height: REWARD_WELL,
		alignItems: "center",
		justifyContent: "center",
		marginVertical: SPACE.xs,
	},
	heroImage: {
		width: REWARD_ART,
		height: REWARD_ART,
	},
	heroFallback: {
		width: REWARD_ART,
		height: REWARD_ART,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.paper,
	},
	title: {
		marginBottom: SPACE.lg,
	},
	actions: {
		alignItems: "center",
		gap: SPACE.sm,
		width: "100%",
	},
	// The can't-claim notice card.
	noticeCard: {
		width: "100%",
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.xl,
		alignItems: "center",
	},
	noticeBody: {
		marginTop: SPACE.xs,
		marginBottom: SPACE.card,
	},
});

const passProgressStyles = StyleSheet.create({
	// The XP-chain subtitle under the pass header (promise-before-ask).
	subtitle: {
		marginTop: SPACE.xxs,
		marginBottom: SPACE.xs,
		paddingHorizontal: SPACE.xs,
	},
	// Tight under the section header's rule — the header/bar/label read as one
	// block, not three floating strips.
	wrap: { marginBottom: SPACE.xxs, paddingHorizontal: SPACE.xs },
	label: { marginTop: SPACE.xxs },
});

const wallowStyles = StyleSheet.create({
	card: {
		padding: SPACE.card,
		marginTop: SPACE.md,
		marginBottom: SPACE.sm,
		gap: SPACE.md,
	},
	topline: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.md,
	},
	mark: {
		width: WALLOW_MARK,
		height: WALLOW_MARK,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	copy: { flex: 1, minWidth: 0 },
	body: { marginTop: SPACE.xs },
	rateCompare: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	rateStat: {
		flex: 1,
		minWidth: 0,
		padding: SPACE.sm,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.paper,
	},
	rateStatNext: { backgroundColor: WHIMSY.sun },
	rateValue: { marginTop: SPACE.xxs },
	powerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xs,
	},
	powerPip: {
		width: WALLOW_PIP_W,
		height: WALLOW_PIP_H,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
	},
	powerPipOn: { backgroundColor: WHIMSY.sun },
	standing: {
		marginLeft: SPACE.xs,
	},
});

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	// A `Button variant="link"` in a header's right slot keeps its full 44pt
	// frame; this only stops its own padding from pushing the title row apart.
	headerLink: { paddingHorizontal: 0, paddingVertical: 0 },
	safeArea: { flex: 1 },
	center: { alignItems: "center", justifyContent: "center" },
	// Section seams inside the scroll — the container gap carries the rest.
	sectionGap: { marginTop: SPACE.sm },
	sectionHeaderTight: { marginBottom: 0 },
	// The reference-sheet doors — small paper sticker circles by the title.
	// PageHeader's right slot lays them out and spaces them; this is only the
	// circle each one draws.
	headerBtn: {
		width: HEADER_BTN,
		height: HEADER_BTN,
		alignItems: "center",
		justifyContent: "center",
	},
	// Persistent season-end recap entry point — a small crown sticker in the
	// season-pass header's right slot. Paper-craft: sun fill, ink border,
	// hard offset shadow.
	recapBtn: {
		width: CHIP_BTN,
		height: CHIP_BTN,
		alignItems: "center",
		justifyContent: "center",
	},
	// __DEV__-only founder-gift preview chip (never ships).
	devChipRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: SPACE.xs,
	},
	devRewardChip: {
		alignSelf: "center",
		marginTop: SPACE.sm,
		backgroundColor: UI_COLORS.textPrimary,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs,
	},
	devRewardChipText: { textAlign: "center" },
	tierList: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.lg,
		paddingBottom: TAB_SAFE,
		// sm, not lg: section headers already carry their own bottom margins,
		// so a large container gap double-counted into dead space at every seam.
		gap: SPACE.sm,
	},
	// The StoneThumb well — the reward chip inside a pass-track node.
	stone: {
		width: STONE,
		height: STONE,
		borderRadius: RADII.md,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream,
		alignItems: "center",
		justifyContent: "center",
	},
	// The ART recedes inside a locked node; the node's dashed outline is what
	// actually carries the locked state. [C-07]
	stoneLocked: { opacity: OPACITY.dim },
	stoneArt: { width: STONE_ART, height: STONE_ART },
	stoneImage: { width: STONE_IMAGE, height: STONE_IMAGE },
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
		{ g: "barn", label: "Tickle at a friend's barn", xp: "+2 / tap" },
		{ g: "gem", label: "Dig the Truffle Patch", xp: "+20 / feeding" },
		{ g: "sparkles", label: "Dig a friend's buried pot", xp: "+3 / day" },
		{ g: "gift", label: "Bury snouts for visitors", xp: "+1 / 10 snouts" },
		{ g: "bless", label: "Send a blessing", xp: "+5 / day" },
		{ g: "curse", label: "Send a curse", xp: "+2 / day" },
	];
	return (
		<AdaptiveModalScaffold
			visible={visible}
			onRequestClose={onDismiss}
			animationType="fade"
			bare
			maxWidth={XP_CARD_MAX}
			testID="xp-how-to"
		>
			<Sticker
				color="paper"
				rotate={TILT.dialog}
				radius={RADII.xxl}
				border={BORDER.heavy}
				style={[xpHowTo.card, STICKER_SHADOW]}
			>
				<Kicker align="center" style={xpHowTo.kicker}>season pass ★</Kicker>
				<T role="pageTitle" align="center" accessibilityRole="header" style={xpHowTo.headline}>
					How to earn XP
				</T>
				{ROWS.map((r) => (
					<View key={r.label} style={xpHowTo.row}>
						<Glyph name={r.g} size={CREST_ICON} />
						<BodySm style={xpHowTo.label}>{r.label}</BodySm>
						<Numeral>{r.xp}</Numeral>
					</View>
				))}
				<Hand tone="secondary" align="center" style={xpHowTo.foot}>
					{xpPer} XP = 1 tier · your Wallow card shows the exact shorter tickle interval
				</Hand>
				<Button
					size="md"
					variant="primary"
					full
					onPress={onDismiss}
					accessibilityLabel="Back to the season"
					accessibilityHint="Closes this reference sheet"
				>
					Back to the season
				</Button>
			</Sticker>
		</AdaptiveModalScaffold>
	);
}

const xpHowTo = StyleSheet.create({
	card: {
		width: "100%",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
	},
	kicker: { marginBottom: SPACE.xs },
	headline: { marginBottom: SPACE.md },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
		marginBottom: SPACE.xs,
	},
	label: { flex: 1 },
	foot: {
		marginTop: SPACE.xs,
		marginBottom: SPACE.md,
	},
});

// Alignment placard — moved off the Me tab onto the Season tab, where
// the season's stakes live (S0: the finale verdict; S1: blessing/curse power).
const alignmentStoryStyles = StyleSheet.create({
	wrap: { padding: SPACE.lg, marginTop: SPACE.xs },
	labelRow: {
		flexDirection: "row",
		alignItems: "baseline",
		justifyContent: "space-between",
		marginBottom: SPACE.sm,
	},
	// The two alignment tints are identity, not decoration — the one place the
	// goblin / angel hues belong is on the alignment scale's own ends.
	greedy: { color: WHIMSY.goblin },
	generous: { color: WHIMSY.angel },
	hint: { marginTop: SPACE.sm },
	effectsRow: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: SPACE.sm,
		marginTop: SPACE.sm,
	},
	effectHint: { marginTop: SPACE.sm },
	howLink: { alignSelf: "center", marginTop: SPACE.sm },
});
