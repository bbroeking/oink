// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { memo, useState, useCallback, useMemo } from "react";
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
	SectionHeader,
	SectionTitle,
	SegmentedControl,
	Sticker,
	T,
	Tag,
	Tape
} from "./ui";
import { UserSheet } from "./UserSheet";
import { TickleBreakdownSheet } from "./TickleBreakdownSheet";
import { EnemyBreakdownSheet } from "./EnemyBreakdownSheet";
import {
	BORDER,
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
// The two fixed columns of a board row: the rank stamp's width and the score
// column's floor, so a 5-digit number never squeezes the name.
const RANK_COL = 28;
const SCORE_COL = 60;
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

function DevWallowPreview() {
	const [champ, ...rows] = DEV_WALLOW_PREVIEW;
	const noop = () => {};
	return (
		<ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
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
	onPress,
	onPressScore
}: {
	champ: LeaderboardEntry;
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
				accessibilityLabel={`${champ.username}, the all-time leader`}
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
						<ProfileIdentity username={champ.username} title={champ.active_title} variant="hero" />
						{/* Second line — tickles count is always present
						    (it's what earned them the leader spot), the
						    "wears X" reads alongside when a hat is
						    equipped. Joined with a middot so the line
						    stays single-row. Earlier version dropped
						    the count when a hat existed, hiding the
						    one number the leaderboard actually
						    competes on. */}
						{/* The tickle count → the breakdown receipt (spec 17). Generous
						    hit-slop, no layout change; the nested Pressable captures the
						    tap so it opens the receipt, not the profile sheet. */}
						<Pressable
							onPress={() => onPressScore(champ.id, champ.tickles_earned)}
							hitSlop={{ top: 6, bottom: 6, left: 6, right: 10 }}
							accessibilityRole="button"
							accessibilityLabel="How this pig earned its tickles"
						>
							<IconText left={<Glyph name="heart" size={SCORE_MARK} />} gap={5}>
								<Hand tone="secondary" numberOfLines={1} style={styles.champScore}>
									{champ.tickles_earned.toLocaleString()}
									{champ.active_hat?.name ? `  ·  wears ${champ.active_hat.name}` : ""}
								</Hand>
							</IconText>
						</Pressable>
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
			accessibilityLabel={`Rank ${rank}, ${player.username}, ${scoreText}`}
			accessibilityHint="Opens this pig's profile"
			leading={
				<View style={styles.rowLead}>
					<T role="numeral" style={styles.rowRank}>
						#{rank}
					</T>
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
// fallback matches the rest of the board.
function pairTitle(row: PairBondRow): string {
	return `${row.name_a ?? "Anonymous"} × ${row.name_b ?? "Anonymous"}`;
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
	isYou
}: {
	row: PairBondRow;
	index?: number;
	isYou?: boolean;
}) {
	return (
		<ListRow
			index={index}
			selected={isYou}
			fill={isYou ? "rose" : undefined}
			accessibilityLabel={`Rank ${row.rank}, ${pairTitle(row)}, ${row.bond} bond`}
			leading={
				<T role="numeral" style={styles.rowRank}>
					#{row.rank}
				</T>
			}
			title={
				<CardTitle numberOfLines={2}>
					{pairTitle(row)}
					{isYou && (
						<T role="hand" tone="accent">
							{" "}
							(you)
						</T>
					)}
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
	onPress
}: {
	row: EnemyPairRow;
	index?: number;
	isYou?: boolean;
	onPress: (enemy: EnemyPairRow) => void;
}) {
	return (
		<ListRow
			index={index}
			selected={isYou}
			fill={isYou ? "sage" : undefined}
			onPress={() => onPress(row)}
			accessibilityLabel={`Open rivalry breakdown for ${enemyTitle(row)}`}
			accessibilityHint="Shows who cursed whom"
			leading={
				<T role="numeral" style={styles.rowRank}>
					#{row.rank}
				</T>
			}
			title={
				<CardTitle>
					{enemyTitle(row)}
					{isYou && (
						<T role="hand" tone="accent">
							{" "}
							(you)
						</T>
					)}
				</CardTitle>
			}
			sub={
				<T role="label" tone="secondary">
					tap to see who cursed whom
				</T>
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

// `initialScope` lets a host open the board on a specific tab (the Sounder
// card's "standings live in the Board" note lands on the Sounders scope).
export function Leaderboard({ initialScope }: { initialScope?: BoardScope }) {
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

	// All server reads + cursor pagination live in the hook (fetches on focus +
	// on refresh()). `fetchLeaderboard` is the refresh alias the retry button and
	// UserSheet's onFriendshipChanged call; `leaderboard` is the ranked list.
	const {
		rows: leaderboard,
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

	return (
		<View style={styles.container}>
			<View style={styles.toggleWrap}>
				<SegmentedControl
					label="Leaderboard scope"
					value={scope}
					onChange={setScope}
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
			{scope === "pairs" && (
				<View style={styles.pairToggleWrap}>
					<SegmentedControl
						label="Pair ranking"
						value={pairView}
						onChange={setPairView}
						options={[
							{ value: "pairs", label: "Pairs", icon: "handshake" },
							{ value: "enemies", label: "Enemies", icon: "ghost" }
						]}
					/>
				</View>
			)}
			{__DEV__ && (
				<Chip
					onPress={() => setShowWallowPreview((shown) => !shown)}
					selected={showWallowPreview}
					tone={showWallowPreview ? "sun" : "paper"}
					glyph="flame"
					style={styles.previewToggle}
					accessibilityHint="Dev-only: renders the board with Wallow ranks"
					label={
						showWallowPreview ? "Showing Wallow ranks" : "Preview Wallow ranks"
					}
				/>
			)}

			{showWallowPreview ? (
				<DevWallowPreview />
			) : loading ? (
				<View style={styles.listContent}>
					{Array.from({ length: 6 }).map((_, i) => (
						<ListRowSkeleton key={i} />
					))}
				</View>
			) : error ? (
				// Fetch failed (both selects threw) — the error state, with the
				// way out on its face, so the Board never renders silently empty.
				<View style={styles.emptyWrap}>
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
						<EmptyState
							glyph="handshake"
							title="no bonds yet"
							sub="trade, bless, and visit a friend to build one."
						/>
					</View>
				) : (
					<FlatList
						style={styles.list}
						contentContainerStyle={styles.listContent}
						data={pairRest}
						keyExtractor={(row) => `${row.user_a}-${row.user_b}`}
						initialNumToRender={10}
						maxToRenderPerBatch={8}
						windowSize={7}
						removeClippedSubviews
						ListHeaderComponent={<PairChampionPoster champ={pairs[0]} />}
						renderItem={({ item: row, index }) => (
							<PairRow row={row} index={index} isYou={row.is_self} />
						)}
						ListFooterComponent={
							youPair ? (
								<View style={styles.pinnedWrap}>
									<Kicker>your strongest pair</Kicker>
									<PairRow row={youPair} isYou />
								</View>
							) : null
						}
					/>
				)
			) : scope === "pairs" && pairView === "enemies" ? (
				enemies.length === 0 ? (
					<View style={styles.emptyWrap}>
						<EmptyState
							glyph="ghost"
							title="no enemies yet"
							sub="swap a curse with a friend to start a rivalry."
						/>
					</View>
				) : (
					<FlatList
						style={styles.list}
						contentContainerStyle={styles.listContent}
						data={enemyRest}
						keyExtractor={(row) => `${row.user_a}-${row.user_b}`}
						initialNumToRender={10}
						maxToRenderPerBatch={8}
						windowSize={7}
						removeClippedSubviews
						ListHeaderComponent={
							<EnemyChampionPoster champ={enemies[0]} onPress={setSelectedEnemy} />
						}
						renderItem={({ item: row, index }) => (
							<EnemyRow
								row={row}
								index={index}
								isYou={row.is_self}
								onPress={setSelectedEnemy}
							/>
						)}
						ListFooterComponent={
							youEnemy ? (
								<View style={styles.pinnedWrap}>
									<Kicker tone="curse">your biggest enemy</Kicker>
									<EnemyRow row={youEnemy} isYou onPress={setSelectedEnemy} />
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
					style={styles.list}
					contentContainerStyle={styles.listContent}
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
					style={styles.list}
					contentContainerStyle={styles.listContent}
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
									★ top {LEADERBOARD_MAX_ROWS} pigs — that's the floor of the leaderboard
								</Hand>
							)}
						</View>
					}
				/>
			)}

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
	toggleWrap: {
		paddingHorizontal: SPACE.card,
		paddingTop: SPACE.xs,
		paddingBottom: SPACE.xxs
	},
	pairToggleWrap: {
		// Match the primary scope track exactly so both outlined controls share
		// one left/right edge; only the number of segments changes.
		paddingHorizontal: SPACE.card,
		paddingTop: SPACE.sm,
		paddingBottom: SPACE.xxs
	},
	previewToggle: { alignSelf: "center", marginTop: SPACE.sm },
	previewNote: {
		marginTop: SPACE.sm,
		marginBottom: SPACE.xxs
	},
	champWrap: {
		paddingHorizontal: SPACE.card,
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
	champScore: { marginTop: SPACE.xxs },
	champPrestige: { marginTop: SPACE.xxs },
	// Pair champion — bond breakdown sub-line + the big bond number, matching
	// the ranked-row score treatment so the number reads as ONE thing.
	pairChampSub: { marginTop: SPACE.xxs },
	// Crown moved off Text-emoji onto <Icon name="crown" /> as part of
	// the no-emoji sweep — no inline style needed; Icon takes size +
	// color directly.
	list: { flex: 1 },
	listContent: {
		paddingHorizontal: SPACE.card,
		paddingTop: SPACE.xs,
		paddingBottom: TAB_SAFE,
		// The board is a stack of scrapbook row stickers now (one `ListRow` per
		// pig), so the rhythm between them is a gap rather than a dashed rule
		// inside one flat card. [D-13, spec §2 row 06] (2026-09-11)
		gap: SPACE.sm
	},
	// The pinned "your strongest pair" / "your biggest enemy" block under the
	// list — its own kicker over one selected row.
	pinnedWrap: { marginTop: SPACE.lg, gap: SPACE.xs },
	// Per-side section header for the alignment scope. The bless/curse identity
	// rides a `Tag` in the right slot instead of re-colouring the title.
	alignSectionHeader: { marginTop: SPACE.md },
	// The rank stamp + portrait ride together at the head of a row.
	rowLead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	rowRank: { minWidth: RANK_COL, textAlign: "center" },
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
		minWidth: SCORE_COL,
		flexShrink: 0
	},
	scoreMark: { marginTop: SPACE.xxs },
	// The list footer — "Load more", or the cap note once the floor is reached.
	footer: { alignItems: "center", gap: SPACE.sm, marginTop: SPACE.lg },
	emptyWrap: { paddingHorizontal: SPACE.card, paddingTop: SPACE.md }
});
