// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { memo, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { View, StyleSheet, ScrollView, FlatList, SectionList, Pressable } from "react-native";
import {
	bondBreakdown,
	type EnemyPairRow,
	type PairBondRow
} from "@/utils/pairBonds";
import {
	useLeaderboard,
	LEADERBOARD_MAX_ROWS,
	type LeaderboardEntry,
	type Scope,
	type BoardScope
} from "@/hooks/useLeaderboard";
import { useSeason1Active } from "@/hooks/useSeason1Active";
import {
	Button,
	CardTitle,
	Chip,
	EmptyState,
	Glyph,
	Hand,
	Icon,
	IconText,
	Kicker,
	ListRow,
	ListRowSkeleton,
	PrestigeAvatar,
	ProfileIdentity,
	ScrollEdge,
	SectionHeader,
	SectionTitle,
	SegmentedControl,
	Sticker,
	T,
	Tag,
	Tape,
	useScrollEdge,
	type ScrollEdgeState
} from "./ui";
import { UserSheet } from "./UserSheet";
import { TickleBreakdownSheet } from "./TickleBreakdownSheet";
import { EnemyBreakdownSheet } from "./EnemyBreakdownSheet";
import {
	BORDER,
	CHROME_TYPE_CAP,
	PAGE_PAD,
	RADII,
	SPACE,
	TAB_SAFE,
	TILT,
	UI_COLORS
} from "@/constants/theme";

// The champion poster's decorations: the crown that marks the leader and the
// two marks that ride a score. Drawing geometry, not spacing steps.
// (2026-09-11)
const CROWN_SIZE = 36;
const SCORE_MARK = 14;
const ROW_MARK = 12;
// The poster's pig sits larger when it is wearing Wallow ranks.
const CHAMP_AVATAR = 64;
const CHAMP_AVATAR_PRESTIGE = 84;
const ROW_AVATAR = 32;
const ROW_AVATAR_PRESTIGE = 46;
// The rank stamp's column: one width, so a two-digit rank and a one-digit rank
// start their portraits at the same x. (The score column used to carry a 60pt
// floor too. It bought nothing a right-aligned, non-shrinking number does not
// already have, and it spent 10 to 45pt of the name's width on every short
// score; on a 375pt phone that width is the difference between a whole name
// and "FunnelWal…". 2026-10-04)
const RANK_COL = 28;
// The portrait's column is one width for every row — the Wallow frame's — so a
// pig without a Wallow badge sits centred in the same slot and the name column
// starts at one x down the whole board. (It used to start 14pt further left on
// every unwallowed row: a ragged column. 2026-10-04)
const ROW_AVATAR_SLOT = ROW_AVATAR_PRESTIGE;
// The score's own tap target — the breakdown receipt is a small number, so the
// frame comes back as hitSlop rather than by inflating the column. [C-04]
const SCORE_HIT_SLOP = {
	top: SPACE.md,
	bottom: SPACE.md,
	left: SPACE.md,
	right: SPACE.sm
};

// The Board's fetch/pagination now lives in hooks/useLeaderboard.ts, which owns
// the row types (LeaderboardEntry), the scope union, and the page-size/cap
// constants. BoardScope is re-exported so app/(tabs)/friends.tsx keeps importing
// it from this component.
export type { BoardScope };

/**
 * What the board is showing right now — the scope, with the Pairs scope split
 * into its two rankings. The hub's crown reads it, so the kicker over the title
 * names what is actually being ranked (tickles, bonds or curses) rather than
 * saying "all-time tickles" over a bond board. (2026-10-04)
 */
export type BoardView = "global" | "friends" | "pairs" | "enemies" | "alignment";

function wallowStanding(count?: number | null): string {
	const n = Math.max(0, count ?? 0);
	return `Wallow Rank ${n}`;
}

const DEV_WALLOW_PREVIEW: LeaderboardEntry[] = [
	{
		id: "wallow-preview-5",
		username: "Rosie",
		tickles_earned: 4821,
		active_hat_id: null,
		active_hat: null,
		active_title: { id: "preview-pre", name: "Blazing", placement: "pre" },
		wallow_count: 5
	},
	{
		id: "wallow-preview-2",
		username: "Golden Snout",
		tickles_earned: 3910,
		active_hat_id: null,
		active_hat: null,
		active_title: { id: "preview-post", name: "the Rooted", placement: "post" },
		wallow_count: 2
	},
	{
		id: "wallow-preview-1",
		username: "Kindled Pig",
		tickles_earned: 2875,
		active_hat_id: null,
		active_hat: null,
		active_title: null,
		wallow_count: 1
	},
	{
		id: "wallow-preview-0",
		username: "Unwallowed Pig",
		tickles_earned: 2110,
		active_hat_id: null,
		active_hat: null,
		active_title: null,
		wallow_count: 0
	}
];

function DevWallowPreview({ edge }: { edge: ScrollEdgeState }) {
	const [champ, ...rows] = DEV_WALLOW_PREVIEW;
	const noop = () => {};
	return (
		<ScrollView
			style={styles.list}
			contentContainerStyle={styles.listContent}
			onScroll={edge.onScroll}
			scrollEventThrottle={edge.scrollEventThrottle}
		>
			<Hand tone="secondary" align="center" style={styles.previewNote}>
				Production leaderboard treatment · ranks 0, 1, 2, and 5
			</Hand>
			<ChampionPoster champ={champ} onPress={noop} onPressScore={noop} />
			{rows.map((player, index) => (
				<ClippingRow
					key={player.id}
					player={player}
					rank={index + 2}
					index={index}
					isYou={false}
					onPress={noop}
					onPressScore={noop}
				/>
			))}
		</ScrollView>
	);
}

function ChampionPoster({
	champ,
	isYou = false,
	onPress,
	onPressScore
}: {
	champ: LeaderboardEntry;
	// The caller leads the board — the poster says so the way every row does.
	isYou?: boolean;
	onPress: (userId: string) => void;
	// Tapping the tickle count opens the breakdown receipt for this pig (spec 17)
	// — a different target than the poster body (which opens the profile sheet).
	onPressScore: (userId: string, total: number) => void;
}) {
	return (
		<View style={styles.champWrap}>
			<Sticker
				color="sun"
				rotate={TILT.dialog}
				radius={RADII.xl}
				border={BORDER.heavy}
				onPress={() => onPress(champ.id)}
				accessibilityLabel={`${champ.username}${isYou ? ", you" : ""}, the all-time leader`}
				accessibilityHint="Opens this pig's profile"
				style={styles.champ}
			>
				{/* Rose tape pinning the poster — small decorative pin in
				    the top-left so the champion poster reads as "tacked up"
				    on the leaderboard wall. */}
				<Tape color="roseDeep" rotate={-12} width={48} height={12} style={styles.champTape} />
				{/* Lifetime tickles_earned drives the sort, so the #1 slot
				    is the all-time leader — calling them 'today's
				    champion' would imply a daily reset the schema
				    doesn't have. Restored the accurate label. */}
				<T role="kicker" tone="accent" style={styles.champOver}>
					★ all-time leader ★
				</T>
				<View style={styles.champBody}>
					<PrestigeAvatar
						size={
							(champ.wallow_count ?? 0) > 0
								? CHAMP_AVATAR_PRESTIGE
								: CHAMP_AVATAR
						}
						hatId={champ.active_hat_id}
						prestigeLevel={champ.wallow_count}
					/>
					<View style={styles.champIdentity}>
						<ProfileIdentity
							username={champ.username}
							title={champ.active_title}
							suffix={isYou ? "(you)" : null}
							variant="hero"
						/>
						{/* The tickle count — the one number the board competes on,
						    always present — is the door to the breakdown receipt
						    (spec 17): generous hit-slop, no layout change, and the
						    nested Pressable captures the tap so it opens the receipt,
						    not the profile sheet. */}
						<Pressable
							onPress={() => onPressScore(champ.id, champ.tickles_earned)}
							hitSlop={{ top: 6, bottom: 6, left: 6, right: 10 }}
							accessibilityRole="button"
							accessibilityLabel="How this pig earned its tickles"
							style={styles.champScoreDoor}
						>
							<IconText left={<Glyph name="heart" size={SCORE_MARK} />} gap={5}>
								<Hand tone="secondary" numberOfLines={1} style={styles.champScore}>
									{champ.tickles_earned.toLocaleString()}
								</Hand>
							</IconText>
						</Pressable>
						{/* What they wear rides its own line and wraps: an item's
						    name never ends in "…" (it read "wears Whipped Swirl…"
						    when it shared the count's single line). 2026-10-04 */}
						{champ.active_hat?.name ? (
							<Hand tone="secondary" style={styles.champWears}>
								wears {champ.active_hat.name}
							</Hand>
						) : null}
						{(champ.wallow_count ?? 0) > 0 && (
							<T
								role="label"
								tone="accent"
								numberOfLines={1}
								style={styles.champPrestige}
							>
								{wallowStanding(champ.wallow_count)}
							</T>
						)}
					</View>
					{/* Crown — the de-facto leader glyph. Replaces the old
					    rotated "1" badge so the role reads instantly. */}
					<Icon name="crown" size={CROWN_SIZE} color={UI_COLORS.textPrimary} />
				</View>
			</Sticker>
		</View>
	);
}

const ClippingRow = memo(function ClippingRow({
	player,
	rank,
	index = 0,
	isYou,
	onPress,
	onPressScore,
	showAlignment = false
}: {
	player: LeaderboardEntry;
	rank: number;
	// Position in the list, so each row takes its own turn from ROW_TILTS.
	index?: number;
	isYou: boolean;
	onPress: (userId: string) => void;
	// Tapping the tickle count opens the breakdown receipt (spec 17). Absent in
	// the alignment scope (the number there is the align score, not tickles).
	onPressScore?: (userId: string, total: number) => void;
	showAlignment?: boolean;
}) {
	const score = player.alignment_score ?? 0;
	const scoreText = showAlignment
		? score > 0
			? `+${score}`
			: `${score}`
		: player.tickles_earned.toLocaleString();
	return (
		<ListRow
			index={index}
			selected={isYou}
			onPress={() => onPress(player.id)}
			accessibilityLabel={`Rank ${rank}, ${player.username}${isYou ? ", you" : ""}, ${scoreText}`}
			accessibilityHint="Opens this pig's profile"
			leading={
				<View style={styles.rowLead}>
					<T role="numeral" style={styles.rowRank}>
						#{rank}
					</T>
					<View style={styles.rowAvatarSlot}>
						<PrestigeAvatar
							size={
								(player.wallow_count ?? 0) > 0
									? ROW_AVATAR_PRESTIGE
									: ROW_AVATAR
							}
							hatId={player.active_hat_id}
							prestigeLevel={player.wallow_count}
						/>
					</View>
				</View>
			}
			title={
				<ProfileIdentity
					username={player.username}
					title={player.active_title}
					discriminator={player.discriminator}
					suffix={isYou ? "(you)" : null}
				/>
			}
			// Second line — what the pig is wearing, falling back to the active
			// title when nothing is equipped. PigAvatar already shows the hat as
			// a sprite; the text labels the item so the row reads at a glance.
			sub={
				<View style={styles.rowSub}>
					{(player.wallow_count ?? 0) > 0 ? (
						<T role="label" tone="secondary" numberOfLines={1} style={styles.rowSubItem}>
							{wallowStanding(player.wallow_count)}
						</T>
					) : player.active_hat?.name ? (
						<T role="label" tone="secondary" numberOfLines={1} style={styles.rowSubItem}>
							wears {player.active_hat.name}
						</T>
					) : null}
					{/* The Satchel's Contend slice: finds handed to friends' pigs.
					    A count beside the tickles, never a payout. Absent at zero
					    and on a server without the bag. */}
					{!showAlignment && (player.swaps ?? player.deliveries ?? 0) > 0 ? (
						<View
							style={styles.rowSwaps}
							accessibilityLabel={`${player.swaps ?? player.deliveries} swapped`}
						>
							<Glyph name="digBag" size={ROW_MARK} />
							<T role="label" tone="secondary" numberOfLines={1}>
								{(player.swaps ?? player.deliveries) === 1
									? "1 swapped"
									: `${player.swaps ?? player.deliveries} swapped`}
							</T>
						</View>
					) : null}
				</View>
			}
			// Score column. In the tickles scopes the count is a nested Pressable
			// → the breakdown receipt (spec 17): generous hit-slop, no layout
			// change, and it captures the tap so it opens the receipt rather than
			// the row's profile sheet. Alignment scope stays a plain View (its
			// number is the align score, not tickles).
			trailing={
				!showAlignment && onPressScore ? (
					<Pressable
						style={styles.rowScoreCol}
						onPress={() => onPressScore(player.id, player.tickles_earned)}
						hitSlop={SCORE_HIT_SLOP}
						accessibilityRole="button"
						accessibilityLabel="How this pig earned its tickles"
					>
						<T role="numeral" numberOfLines={1}>
							{scoreText}
						</T>
						<Glyph name="heart" size={ROW_MARK} style={styles.scoreMark} />
					</Pressable>
				) : (
					<View style={styles.rowScoreCol}>
						{/* numberOfLines=1 so 5-digit scores (e.g. "100,000")
						    stay on one line instead of wrapping the column. */}
						<T role="numeral" numberOfLines={1}>
							{scoreText}
						</T>
						{showAlignment ? (
							<T role="label" tone="secondary">
								align
							</T>
						) : (
							<Glyph name="heart" size={ROW_MARK} style={styles.scoreMark} />
						)}
					</View>
				)
			}
		/>
	);
});

// "{nameA} × {nameB}" — the pair's two pigs joined by a small cross. Anonymous
// fallback matches the rest of the board. (The spoken label and the receipt's
// title; the row draws `PairNames`, which can mark the caller.)
function pairTitle(row: PairBondRow): string {
	return `${row.name_a ?? "Anonymous"} × ${row.name_b ?? "Anonymous"}`;
}

// The pair's two names inside a title, with "(you)" riding the caller's OWN
// name. It used to follow the whole pair, so "DemoPig × FunnelWalker (you)"
// pinned the caller's word on the other pig. (2026-10-04)
function PairNames({
	row,
	joiner,
	myId
}: {
	row: { user_a: string; user_b: string; name_a: string | null; name_b: string | null };
	joiner: string;
	myId: string | null;
}) {
	const you = (
		<T role="hand" tone="accent">
			{" "}
			(you)
		</T>
	);
	return (
		<>
			{row.name_a ?? "Anonymous"}
			{myId !== null && row.user_a === myId ? you : null}
			{joiner}
			{row.name_b ?? "Anonymous"}
			{myId !== null && row.user_b === myId ? you : null}
		</>
	);
}

// Champion pair — the strongest bond in the bog gets the poster treatment,
// mirroring ChampionPoster's sun sticker + rose tape so #1 reads instantly.
function PairChampionPoster({ champ }: { champ: PairBondRow }) {
	return (
		<View style={styles.champWrap}>
			<Sticker
				color="sun"
				rotate={TILT.dialog}
				radius={RADII.xl}
				border={BORDER.heavy}
				style={styles.champ}
			>
				<Tape color="roseDeep" rotate={-12} width={48} height={12} style={styles.champTape} />
				<T role="kicker" tone="accent" style={styles.champOver}>
					★ the strongest pair in the bog ★
				</T>
				<View style={styles.champBody}>
					<View style={styles.champIdentity}>
						<SectionTitle numberOfLines={2}>{pairTitle(champ)}</SectionTitle>
						{/* Breakdown sub-line — the three bond acts that add up to the
						    total, dropping any zero component. */}
						<Hand tone="secondary" numberOfLines={1} style={styles.pairChampSub}>
							{bondBreakdown(champ)}
						</Hand>
					</View>
					{/* Total bond, right-aligned — ONE number, the sum. */}
					<View style={styles.rowScoreCol}>
						<T role="sectionTitle" numberOfLines={1}>
							{champ.bond.toLocaleString()}
						</T>
						<T role="label" tone="secondary">
							bond
						</T>
					</View>
				</View>
			</Sticker>
		</View>
	);
}

// One ranked pair row. isYou → the caller is in the pair; the row lights rose
// (matching the self-highlight grammar used for the you-row elsewhere).
const PairRow = memo(function PairRow({
	row,
	index = 0,
	isYou,
	myId
}: {
	row: PairBondRow;
	index?: number;
	isYou?: boolean;
	myId: string | null;
}) {
	return (
		<ListRow
			index={index}
			selected={isYou}
			fill={isYou ? "rose" : undefined}
			accessibilityLabel={`Rank ${row.rank}, ${pairTitle(row)}${isYou ? ", your pair" : ""}, ${row.bond} bond`}
			leading={
				<T role="numeral" style={styles.rowRank}>
					#{row.rank}
				</T>
			}
			title={
				<CardTitle numberOfLines={2}>
					<PairNames row={row} joiner=" × " myId={myId} />
				</CardTitle>
			}
			sub={
				<T role="label" tone="secondary" numberOfLines={1}>
					{bondBreakdown(row)}
				</T>
			}
			trailing={
				<View style={styles.rowScoreCol}>
					<T role="numeral" numberOfLines={1}>
						{row.bond.toLocaleString()}
					</T>
					<T role="label" tone="secondary">
						bond
					</T>
				</View>
			}
		/>
	);
});

function enemyTitle(row: EnemyPairRow): string {
	return `${row.name_a ?? "Anonymous"} vs ${row.name_b ?? "Anonymous"}`;
}

function EnemyChampionPoster({
	champ,
	onPress
}: {
	champ: EnemyPairRow;
	onPress: (enemy: EnemyPairRow) => void;
}) {
	return (
		<View style={styles.champWrap}>
			<Sticker
				color="sage"
				rotate={-TILT.dialog}
				radius={RADII.xl}
				border={BORDER.heavy}
				onPress={() => onPress(champ)}
				accessibilityLabel={`Open rivalry breakdown for ${enemyTitle(champ)}`}
				accessibilityHint="Shows who cursed whom"
				style={styles.champ}
			>
				<Tape color="lilac" rotate={10} width={48} height={12} style={styles.champTape} />
				<T role="kicker" tone="curse" style={styles.champOver}>
					★ the biggest enemies in the bog ★
				</T>
				<View style={styles.champBody}>
					<View style={styles.champIdentity}>
						<SectionTitle>{enemyTitle(champ)}</SectionTitle>
						{/* Said once, here: every rivalry on the board opens the same
						    receipt. The rows below carry it as their hint, not as a
						    line repeated twenty-five times (a fact stated twice on one
						    screen is stated once, 2026-09-18). */}
						<Hand tone="secondary" style={styles.pairChampSub}>
							tap to see who cursed whom
						</Hand>
					</View>
					<View style={styles.rowScoreCol}>
						<T role="sectionTitle">{champ.curses.toLocaleString()}</T>
						<T role="label" tone="secondary">
							curses
						</T>
					</View>
				</View>
			</Sticker>
		</View>
	);
}

const EnemyRow = memo(function EnemyRow({
	row,
	index = 0,
	isYou,
	myId,
	onPress
}: {
	row: EnemyPairRow;
	index?: number;
	isYou?: boolean;
	myId: string | null;
	onPress: (enemy: EnemyPairRow) => void;
}) {
	return (
		<ListRow
			index={index}
			selected={isYou}
			fill={isYou ? "sage" : undefined}
			onPress={() => onPress(row)}
			accessibilityLabel={`Open rivalry breakdown for ${enemyTitle(row)}${isYou ? ", your rivalry" : ""}`}
			accessibilityHint="Shows who cursed whom"
			leading={
				<T role="numeral" style={styles.rowRank}>
					#{row.rank}
				</T>
			}
			title={
				<CardTitle>
					<PairNames row={row} joiner=" vs " myId={myId} />
				</CardTitle>
			}
			trailing={
				<View style={styles.rowScoreCol}>
					<T role="numeral">{row.curses.toLocaleString()}</T>
					<T role="label" tone="secondary">
						curses
					</T>
				</View>
			}
		/>
	);
});

// The board's lists swap under one set of sticky controls (the scope track and,
// in dev, the preview chip). The scroll edge under those controls belongs to
// whichever list is showing, so it lives in a body the board keys by its view:
// a switch starts the edge at rest instead of carrying the last list's state.
// The rule is laid over the body's top edge, after the list so it paints above
// it, and takes no room. (2026-10-04)
function BoardBody({ children }: { children: (edge: ScrollEdgeState) => ReactNode }) {
	const edge = useScrollEdge();
	return (
		<View style={styles.list}>
			{children(edge)}
			<ScrollEdge visible={edge.edgeVisible} overlay="top" />
		</View>
	);
}

// `initialScope` lets a host open the board on a specific tab (the Sounder
// card's "standings live in the Board" note lands on the Sounders scope).
// `onViewChange` tells the host what is being ranked, for its crown's kicker.
export function Leaderboard({
	initialScope,
	onViewChange
}: {
	initialScope?: BoardScope;
	onViewChange?: (view: BoardView) => void;
}) {
	const [showWallowPreview, setShowWallowPreview] = useState(false);
	const [scope, setScope] = useState<Scope>(initialScope ?? "global");
	const [pairView, setPairView] = useState<"pairs" | "enemies">("pairs");
	const [selectedEnemy, setSelectedEnemy] = useState<EnemyPairRow | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// The tickle breakdown receipt (spec 17) — which pig's ledger is open + its
	// already-known total (the fail-soft display when the RPC is dark).
	const [breakdownUser, setBreakdownUser] = useState<{
		id: string;
		total: number;
	} | null>(null);
	const openBreakdown = useCallback(
		(userId: string, total: number) => setBreakdownUser({ id: userId, total }),
		[]
	);
	// Alignment isn't a thing in Season 1 — the greedy/generous board
	// retires with Judgement Day, so its scope tab hides once s1 is live.
	const s1 = useSeason1Active();
	// S1 swaps the alignment board for the strongest-pairs board — the bond
	// between two specific pigs, made visible and ranked.
	const scopes: Scope[] = s1
		? ["global", "friends", "pairs"]
		: ["global", "friends", "alignment"];

	const view: BoardView = scope === "pairs" ? pairView : scope;
	useEffect(() => {
		onViewChange?.(view);
	}, [onViewChange, view]);

	// All server reads + cursor pagination live in the hook (fetches on focus +
	// on refresh()). `fetchLeaderboard` is the refresh alias the retry button and
	// UserSheet's onFriendshipChanged call; `leaderboard` is the ranked list.
	const {
		rows: leaderboard,
		you,
		pairs,
		youPair,
		enemies,
		youEnemy,
		myId,
		loading,
		loadingMore,
		hasMore,
		error,
		refresh: fetchLeaderboard,
		loadMore
	} = useLeaderboard(scope);

	const champ = leaderboard[0];
	const rest = useMemo(() => leaderboard.slice(1), [leaderboard]);
	const pairRest = useMemo(() => pairs.slice(1), [pairs]);
	const enemyRest = useMemo(() => enemies.slice(1), [enemies]);
	// The caller's own standing, pinned under the global board — only while it
	// is NOT already on screen (a Load more that reaches them drops the pin).
	const youPinned =
		scope === "global" && you && !leaderboard.some((row) => row.id === you.entry.id)
			? you
			: null;
	const alignmentSections = useMemo(
		() =>
			[
				{
					key: "generous",
					title: "GENEROUS",
					// The bless side wears sun, the curse side sage — the same
					// two-sided identity the Barn's effect cards use.
					tone: "sun" as const,
					data: leaderboard.filter((row) => row.align_side === "generous")
				},
				{
					key: "greedy",
					title: "GREEDY",
					tone: "sage" as const,
					data: leaderboard.filter((row) => row.align_side === "greedy")
				}
			].filter((section) => section.data.length > 0),
		[leaderboard]
	);

	// The Pairs scope's two rankings. The switch rides at the HEAD of whichever
	// list is showing rather than pinning under the scope control: two stacked
	// sticky tracks (plus the dev chip) took the top ~40% of the screen before a
	// single pair. Its first option is "Bonds", the unit those rows count, so
	// "Pairs" is no longer both the scope and one of its views. (2026-10-04)
	const pairToggle =
		scope === "pairs" ? (
			<SegmentedControl
				label="Pair ranking"
				value={pairView}
				onChange={setPairView}
				maxFontSizeMultiplier={CHROME_TYPE_CAP}
				options={[
					{ value: "pairs", label: "Bonds", icon: "handshake" },
					{ value: "enemies", label: "Enemies", icon: "ghost" }
				]}
			/>
		) : null;

	return (
		<View style={styles.container}>
			<View style={styles.toggleWrap}>
				<SegmentedControl
					label="Leaderboard scope"
					value={scope}
					onChange={setScope}
					// Fixed chrome over the list: it states its ceiling rather than
					// growing into the board.
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
					options={scopes.map((item) => ({
						value: item,
						label:
							item === "global"
								? "Global"
								: item === "friends"
									? "Friends"
								: item === "pairs"
									? "Pairs"
									: "Alignment",
						icon:
							item === "global"
								? "globe"
								: item === "friends"
									? "friends"
									: item === "pairs"
										? "handshake"
										: "star"
					}))}
				/>
			</View>
			{__DEV__ && (
				<Chip
					onPress={() => setShowWallowPreview((shown) => !shown)}
					selected={showWallowPreview}
					tone={showWallowPreview ? "sun" : "paper"}
					glyph="flame"
					maxFontSizeMultiplier={CHROME_TYPE_CAP}
					style={styles.previewToggle}
					accessibilityHint="Dev-only: renders the board with Wallow ranks"
					label={
						showWallowPreview ? "Showing Wallow ranks" : "Preview Wallow ranks"
					}
				/>
			)}

			<BoardBody key={showWallowPreview ? "dev-preview" : view}>
				{(edge) =>
					showWallowPreview ? (
						<DevWallowPreview edge={edge} />
					) : loading ? (
						<View style={styles.listContent}>
							{pairToggle}
							{Array.from({ length: 6 }).map((_, i) => (
								<ListRowSkeleton key={i} />
							))}
						</View>
					) : error ? (
						// Fetch failed (both selects threw) — the error state, with the
						// way out on its face, so the Board never renders silently empty.
						<View style={styles.emptyWrap}>
							{pairToggle}
							<EmptyState
								kind="error"
								title="the Board is being shy"
								sub="give it another nudge."
								action={
									<Button
										variant="handLink"
										size="sm"
										onPress={fetchLeaderboard}
										accessibilityLabel="Try loading the Board again"
									>
										try again ›
									</Button>
								}
							/>
						</View>
					) : scope === "pairs" && pairView === "pairs" ? (
						// Strongest pairs — the bond between two specific pigs, ranked.
						// Champion pair poster on top, then a flat sticker of ranked
						// rows, then the caller's own best pair pinned below when it
						// falls outside the top slice.
						pairs.length === 0 ? (
							<View style={styles.emptyWrap}>
								{pairToggle}
								<EmptyState
									glyph="handshake"
									title="no bonds yet"
									sub="trade, bless, and visit a friend to build one."
								/>
							</View>
						) : (
							<FlatList
								// One list per ranking: sharing an element slot with the
								// Enemies list let the native scroll view (and its offset)
								// carry across, so Enemies opened at its bottom.
								key="pairs"
								style={styles.list}
								contentContainerStyle={styles.listContent}
								onScroll={edge.onScroll}
								scrollEventThrottle={edge.scrollEventThrottle}
								data={pairRest}
								keyExtractor={(row) => `${row.user_a}-${row.user_b}`}
								initialNumToRender={10}
								maxToRenderPerBatch={8}
								windowSize={7}
								removeClippedSubviews
								ListHeaderComponent={
									<>
										{pairToggle}
										<PairChampionPoster champ={pairs[0]} />
									</>
								}
								renderItem={({ item: row, index }) => (
									<PairRow row={row} index={index} isYou={row.is_self} myId={myId} />
								)}
								ListFooterComponent={
									youPair ? (
										<View style={styles.pinnedWrap}>
											<Kicker>your strongest pair</Kicker>
											<PairRow row={youPair} isYou myId={myId} />
										</View>
									) : null
								}
							/>
						)
					) : scope === "pairs" && pairView === "enemies" ? (
						enemies.length === 0 ? (
							<View style={styles.emptyWrap}>
								{pairToggle}
								<EmptyState
									glyph="ghost"
									title="no enemies yet"
									sub="swap a curse with a friend to start a rivalry."
								/>
							</View>
						) : (
							<FlatList
								key="enemies"
								style={styles.list}
								contentContainerStyle={styles.listContent}
								onScroll={edge.onScroll}
								scrollEventThrottle={edge.scrollEventThrottle}
								data={enemyRest}
								keyExtractor={(row) => `${row.user_a}-${row.user_b}`}
								initialNumToRender={10}
								maxToRenderPerBatch={8}
								windowSize={7}
								removeClippedSubviews
								ListHeaderComponent={
									<>
										{pairToggle}
										<EnemyChampionPoster champ={enemies[0]} onPress={setSelectedEnemy} />
									</>
								}
								renderItem={({ item: row, index }) => (
									<EnemyRow
										row={row}
										index={index}
										isYou={row.is_self}
										myId={myId}
										onPress={setSelectedEnemy}
									/>
								)}
								ListFooterComponent={
									youEnemy ? (
										<View style={styles.pinnedWrap}>
											<Kicker tone="curse">your biggest enemy</Kicker>
											<EnemyRow row={youEnemy} isYou myId={myId} onPress={setSelectedEnemy} />
										</View>
									) : null
								}
							/>
						)
					) : leaderboard.length === 0 ? (
						// The one empty treatment, so the Board matches the Friends
						// segment instead of reading as bare text.
						<View style={styles.emptyWrap}>
							<EmptyState
								glyph={scope === "friends" ? "friends" : "heart"}
								title={
									scope === "friends"
										? "No friends yet"
										: scope === "alignment"
											? "No one has taken a side yet"
											: "No tickles yet"
								}
								sub={
									scope === "friends"
										? "Add some on the Friends segment."
										: scope === "alignment"
											? "Trade to tip the scales."
											: "Be the first!"
								}
							/>
						</View>
					) : scope === "alignment" ? (
						// Alignment leaderboard — TWO independent boards
						// (Generous top + Greedy top), each with its own
						// 1..N rank from the alignment_leaderboard RPC. We
						// used to render them as one flat 1..2N list which
						// made the most-greedy player look like "rank N+1
						// overall" — confusing because the two sides aren't
						// comparable, they're competing extremes.
						<SectionList
							key="alignment"
							style={styles.list}
							contentContainerStyle={styles.listContent}
							onScroll={edge.onScroll}
							scrollEventThrottle={edge.scrollEventThrottle}
							sections={alignmentSections}
							keyExtractor={(item) => item.id}
							initialNumToRender={12}
							maxToRenderPerBatch={8}
							windowSize={7}
							removeClippedSubviews
							renderSectionHeader={({ section }) => (
								<SectionHeader
									title={section.title}
									right={
										<Tag
											label={`top ${section.data.length}`}
											tone={section.tone}
										/>
									}
									style={styles.alignSectionHeader}
								/>
							)}
							renderItem={({ item, index }) => (
								<ClippingRow
									player={item}
									rank={item.align_side_rank ?? index + 1}
									index={index}
									isYou={item.id === myId}
									onPress={setSelectedUserId}
									showAlignment
								/>
							)}
						/>
					) : (
						// Global / friends leaderboard — champion poster on top,
						// then a single flat sticker with the ranked rows. The
						// Load more pill paginates the global scope; friends
						// scope is naturally bounded by the 100-friend cap.
						<FlatList
							// Keyed by scope so Global and Friends never share a scroll
							// view (and a scrolled offset) across the switch.
							key={scope}
							style={styles.list}
							contentContainerStyle={styles.listContent}
							onScroll={edge.onScroll}
							scrollEventThrottle={edge.scrollEventThrottle}
							data={rest}
							keyExtractor={(item) => item.id}
							initialNumToRender={12}
							maxToRenderPerBatch={8}
							windowSize={7}
							removeClippedSubviews
							ListHeaderComponent={
								champ ? (
									<ChampionPoster
										champ={champ}
										isYou={champ.id === myId}
										onPress={setSelectedUserId}
										onPressScore={openBreakdown}
									/>
								) : null
							}
							renderItem={({ item, index }) => (
								<ClippingRow
									player={item}
									rank={index + 2}
									index={index}
									isYou={item.id === myId}
									onPress={setSelectedUserId}
									onPressScore={openBreakdown}
								/>
							)}
							ListFooterComponent={
								<View style={styles.footer}>
									{scope === "global" && hasMore && (
										<Button
											variant="ghost"
											size="sm"
											onPress={loadMore}
											loading={loadingMore}
											accessibilityLabel="Load more pigs"
											accessibilityHint="Pulls the next page of the leaderboard"
										>
											Load more
										</Button>
									)}
									{scope === "global" && !hasMore && leaderboard.length >= LEADERBOARD_MAX_ROWS && (
										<Hand tone="secondary" align="center">
											★ top {LEADERBOARD_MAX_ROWS} pigs · that's the floor of the leaderboard
										</Hand>
									)}
									{/* Where the caller stands when that is past the rows on
									    screen — the same pinned block the Pairs board keeps,
									    so "where am I?" is answered on every ranking. */}
									{youPinned ? (
										<View style={[styles.pinnedWrap, styles.pinnedStretch]}>
											<Kicker>your rank</Kicker>
											<ClippingRow
												player={youPinned.entry}
												rank={youPinned.rank}
												isYou
												onPress={setSelectedUserId}
												onPressScore={openBreakdown}
											/>
										</View>
									) : null}
								</View>
							}
						/>
					)
				}
			</BoardBody>

			<UserSheet
				targetUserId={selectedUserId}
				onDismiss={() => setSelectedUserId(null)}
				onFriendshipChanged={fetchLeaderboard}
			/>

			<TickleBreakdownSheet
				userId={breakdownUser?.id ?? null}
				fallbackTotal={breakdownUser?.total ?? null}
				onClose={() => setBreakdownUser(null)}
			/>

			<EnemyBreakdownSheet
				enemy={selectedEnemy}
				onClose={() => setSelectedEnemy(null)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	// PAGE_PAD, the hub's one edge: the nav, the crown, the Friends segment and
	// the Inbox all sit on it, and this scope track at SPACE.card jogged 4pt on
	// every switch into Rankings (the B-14 jog the Inbox already fixed).
	// (2026-10-04)
	toggleWrap: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.xs,
		paddingBottom: SPACE.xxs
	},
	previewToggle: { alignSelf: "center", marginTop: SPACE.sm },
	previewNote: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xxs
	},
	// The posters sit on the rows' own edge. This wrap used to add SPACE.card
	// INSIDE the list's padding, so the poster stood 14pt inset from the rows
	// it heads — while its own comment said the two shared one left edge.
	champWrap: {
		paddingTop: SPACE.md,
		paddingBottom: SPACE.sm
	},
	// Poster padding aligned to the ranked-row horizontal padding so the
	// champion card and the rows below share one left edge.
	champ: { paddingVertical: SPACE.lg, paddingHorizontal: SPACE.card },
	// Tape decoration tucked into the corner of the champion poster —
	// rotated rose strip matching the design's `Tape color="rose"`.
	champTape: {
		position: "absolute",
		top: -SPACE.sm,
		left: SPACE.card
	},
	champOver: { marginBottom: SPACE.sm },
	champBody: { flexDirection: "row", alignItems: "center", gap: SPACE.card },
	champIdentity: { flex: 1, minWidth: 0 },
	// The count is its own door, as wide as what it says.
	champScoreDoor: { alignSelf: "flex-start", marginTop: SPACE.xxs },
	champScore: { flexShrink: 1 },
	champWears: { marginTop: SPACE.xxs },
	champPrestige: { marginTop: SPACE.xxs },
	// Pair champion — bond breakdown sub-line + the big bond number, matching
	// the ranked-row score treatment so the number reads as ONE thing.
	pairChampSub: { marginTop: SPACE.xxs },
	// Crown moved off Text-emoji onto <Icon name="crown" /> as part of
	// the no-emoji sweep — no inline style needed; Icon takes size +
	// color directly.
	list: { flex: 1 },
	listContent: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.xs,
		paddingBottom: TAB_SAFE,
		// The board is a stack of scrapbook row stickers now (one `ListRow` per
		// pig), so the rhythm between them is a gap rather than a dashed rule
		// inside one flat card. [D-13, spec §2 row 06] (2026-09-11)
		gap: SPACE.sm
	},
	// The pinned "your strongest pair" / "your biggest enemy" / "your rank"
	// block under the list — its own kicker over one selected row.
	pinnedWrap: { marginTop: SPACE.lg, gap: SPACE.xs },
	// Inside the global footer (a centred column for "Load more"), the pinned
	// block still takes the board's full width.
	pinnedStretch: { alignSelf: "stretch" },
	// Per-side section header for the alignment scope. The bless/curse identity
	// rides a `Tag` in the right slot instead of re-colouring the title.
	alignSectionHeader: { marginTop: SPACE.md },
	// The rank stamp + portrait ride together at the head of a row.
	rowLead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	rowRank: { minWidth: RANK_COL, textAlign: "center" },
	rowAvatarSlot: { width: ROW_AVATAR_SLOT, alignItems: "center" },
	// Score column — number above a tiny ♥ suffix, right-aligned. Sizes to its
	// content so a 5-digit score keeps its own column and the name yields width
	// instead of the number wrapping.
	// The row's second line: the wears/standing text and the swaps count,
	// dotted apart by the gap, free to wrap.
	rowSub: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.sm },
	rowSubItem: { flexShrink: 1 },
	rowSwaps: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	rowScoreCol: {
		alignItems: "flex-end",
		flexShrink: 0
	},
	scoreMark: { marginTop: SPACE.xxs },
	// The list footer — "Load more", or the cap note once the floor is reached.
	footer: { alignItems: "center", gap: SPACE.sm, marginTop: SPACE.lg },
	emptyWrap: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.md, gap: SPACE.md }
});
