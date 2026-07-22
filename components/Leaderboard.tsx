// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text } from "react-native";
import { bondBreakdown, type PairBondRow } from "@/utils/pairBonds";
import {
	useLeaderboard,
	LEADERBOARD_MAX_ROWS,
	type LeaderboardEntry,
	type Scope,
	type BoardScope,
} from "@/hooks/useLeaderboard";
import { useFeatureFlag } from "@/hooks/useFeatureFlags";
import { Icon } from "./ui/Icon";
import { Glyph, IconText } from "./ui/Glyph";
import { PrestigeAvatar } from "./ui/PrestigeAvatar";
import { ProfileIdentity } from "./ui/ProfileIdentity";
import { Sticker, Tape } from "./ui/Sticker";
import { ListRowSkeleton } from "./ui/Skeleton";
import { UserSheet } from "./UserSheet";
import { TickleBreakdownSheet } from "./TickleBreakdownSheet";
import {
	FONTS,
	KICKER_TEXT,
	SHADOW_SM,
	TAB_SAFE,
	TYPE,
	WHIMSY,
} from "@/constants/theme";

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
		wallow_count: 5,
	},
	{
		id: "wallow-preview-2",
		username: "Golden Snout",
		tickles_earned: 3910,
		active_hat_id: null,
		active_hat: null,
		active_title: { id: "preview-post", name: "the Rooted", placement: "post" },
		wallow_count: 2,
	},
	{
		id: "wallow-preview-1",
		username: "Kindled Pig",
		tickles_earned: 2875,
		active_hat_id: null,
		active_hat: null,
		active_title: null,
		wallow_count: 1,
	},
	{
		id: "wallow-preview-0",
		username: "Unwallowed Pig",
		tickles_earned: 2110,
		active_hat_id: null,
		active_hat: null,
		active_title: null,
		wallow_count: 0,
	},
];

function DevWallowPreview() {
	const [champ, ...rows] = DEV_WALLOW_PREVIEW;
	const noop = () => {};
	return (
		<ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
			<Text style={styles.previewNote}>
				Production leaderboard treatment · ranks 0, 1, 2, and 5
			</Text>
			<ChampionPoster champ={champ} onPress={noop} onPressScore={noop} />
			<Sticker
				color="paper"
				rotate={-0.3}
				radius={14}
				style={styles.listSticker}
			>
				{rows.map((player, index) => (
					<ClippingRow
						key={player.id}
						player={player}
						rank={index + 2}
						isYou={false}
						last={index === rows.length - 1}
						onPress={noop}
						onPressScore={noop}
					/>
				))}
			</Sticker>
		</ScrollView>
	);
}

function ChampionPoster({
	champ,
	onPress,
	onPressScore,
}: {
	champ: LeaderboardEntry;
	onPress: (userId: string) => void;
	// Tapping the tickle count opens the breakdown receipt for this pig (spec 17)
	// — a different target than the poster body (which opens the profile sheet).
	onPressScore: (userId: string, total: number) => void;
}) {
	return (
		<Pressable style={styles.champWrap} onPress={() => onPress(champ.id)}>
			<Sticker
				color="sun"
				rotate={-1.5}
				radius={18}
				border={2.5}
				style={styles.champ}
			>
				{/* Rose tape pinning the poster — small decorative pin in
				    the top-left so the champion poster reads as "tacked up"
				    on the leaderboard wall. */}
				<Tape
					color="roseDeep"
					rotate={-12}
					width={48}
					height={12}
					style={styles.champTape}
				/>
				{/* Lifetime tickles_earned drives the sort, so the #1 slot
				    is the all-time leader — calling them 'today's
				    champion' would imply a daily reset the schema
				    doesn't have. Restored the accurate label. */}
				<Text style={styles.champOver}>★ all-time leader ★</Text>
				<View style={styles.champBody}>
					<PrestigeAvatar
						size={(champ.wallow_count ?? 0) > 0 ? 84 : 64}
						hatId={champ.active_hat_id}
						prestigeLevel={champ.wallow_count}
					/>
					<View style={{ flex: 1, minWidth: 0 }}>
						<ProfileIdentity
							username={champ.username}
							title={champ.active_title}
							variant="hero"
						/>
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
							<IconText left={<Glyph name="heart" size={14} />} gap={5}>
								<Text style={styles.champScore} numberOfLines={1}>
									{champ.tickles_earned.toLocaleString()}
									{champ.active_hat?.name
										? `  ·  wears ${champ.active_hat.name}`
										: ""}
								</Text>
							</IconText>
						</Pressable>
						{(champ.wallow_count ?? 0) > 0 && (
							<Text style={styles.champPrestige} numberOfLines={1}>
								{wallowStanding(champ.wallow_count)}
							</Text>
						)}
					</View>
					{/* Crown — the de-facto leader glyph. Replaces the old
					    rotated "1" badge so the role reads instantly. */}
					<Icon name="crown" size={36} color={WHIMSY.ink} />
				</View>
			</Sticker>
		</Pressable>
	);
}

function ClippingRow({
	player,
	rank,
	isYou,
	last,
	onPress,
	onPressScore,
	showAlignment = false,
}: {
	player: LeaderboardEntry;
	rank: number;
	isYou: boolean;
	// Marks the last row in the flat sticker — suppresses its bottom
	// dashed border so the divider only appears between rows.
	last?: boolean;
	onPress: (userId: string) => void;
	// Tapping the tickle count opens the breakdown receipt (spec 17). Absent in
	// the alignment scope (the number there is the align score, not tickles).
	onPressScore?: (userId: string, total: number) => void;
	showAlignment?: boolean;
}) {
	const score = player.alignment_score ?? 0;
	return (
		<Pressable
			onPress={() => onPress(player.id)}
			style={[
				styles.row,
				isYou && styles.rowYouHighlight,
				!last && styles.rowDivider,
			]}
		>
			<Text style={styles.rowRank}>#{rank}</Text>
			<PrestigeAvatar
				size={(player.wallow_count ?? 0) > 0 ? 46 : 32}
				hatId={player.active_hat_id}
				prestigeLevel={player.wallow_count}
			/>
			<View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
				<ProfileIdentity
					username={player.username}
					title={player.active_title}
					discriminator={player.discriminator}
					suffix={isYou ? "(you)" : null}
				/>
				{/* Second line — what the pig is wearing, falling
					    back to the active title when nothing is
					    equipped. PigAvatar already shows the hat as a
					    sprite; the text labels the item so the row
					    reads even at a glance. */}
				{(player.wallow_count ?? 0) > 0 ? (
					<Text style={styles.rowSub} numberOfLines={1}>
						{wallowStanding(player.wallow_count)}
					</Text>
				) : player.active_hat?.name ? (
					<Text style={styles.rowSub} numberOfLines={1}>
						wears {player.active_hat.name}
					</Text>
				) : null}
			</View>
			{/* Score column. In the tickles scopes the count is a nested
				    Pressable → the breakdown receipt (spec 17): generous hit-slop,
				    no layout change, and it captures the tap so it opens the receipt
				    rather than the row's profile sheet. Alignment scope stays a
				    plain View (its number is the align score, not tickles). */}
			{!showAlignment && onPressScore ? (
				<Pressable
					style={styles.rowScoreCol}
					onPress={() => onPressScore(player.id, player.tickles_earned)}
					hitSlop={{ top: 10, bottom: 10, left: 12, right: 8 }}
					accessibilityRole="button"
					accessibilityLabel="How this pig earned its tickles"
				>
					<Text style={styles.rowScore} numberOfLines={1}>
						{player.tickles_earned.toLocaleString()}
					</Text>
					<Glyph name="heart" size={12} style={{ marginTop: 2 }} />
				</Pressable>
			) : (
				<View style={styles.rowScoreCol}>
					{/* numberOfLines=1 so 5-digit scores (e.g. "100,000")
						    stay on one line instead of wrapping the column. */}
					<Text style={styles.rowScore} numberOfLines={1}>
						{showAlignment
							? score > 0
								? `+${score}`
								: `${score}`
							: player.tickles_earned.toLocaleString()}
					</Text>
					{showAlignment ? (
						<Text style={styles.rowScoreUnit}>align</Text>
					) : (
						<Glyph name="heart" size={12} style={{ marginTop: 2 }} />
					)}
				</View>
			)}
		</Pressable>
	);
}

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
				rotate={-1.5}
				radius={18}
				border={2.5}
				style={styles.champ}
			>
				<Tape
					color="roseDeep"
					rotate={-12}
					width={48}
					height={12}
					style={styles.champTape}
				/>
				<Text style={styles.champOver}>★ the strongest pair in the bog ★</Text>
				<View style={styles.champBody}>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text
							style={styles.champName}
							numberOfLines={1}
							adjustsFontSizeToFit
							minimumFontScale={0.55}
						>
							{pairTitle(champ)}
						</Text>
						{/* Breakdown sub-line — the three bond acts that add up to the
						    total, dropping any zero component. */}
						<Text style={styles.pairChampSub} numberOfLines={1}>
							{bondBreakdown(champ)}
						</Text>
					</View>
					{/* Total bond, right-aligned — ONE number, the sum. */}
					<View style={styles.rowScoreCol}>
						<Text style={styles.champBond} numberOfLines={1}>
							{champ.bond.toLocaleString()}
						</Text>
						<Text style={styles.rowScoreUnit}>bond</Text>
					</View>
				</View>
			</Sticker>
		</View>
	);
}

// One ranked pair row. isYou → the caller is in the pair; the row lights rose
// (matching the self-highlight grammar used for the you-row elsewhere).
function PairRow({
	row,
	last,
	isYou,
}: {
	row: PairBondRow;
	last?: boolean;
	isYou?: boolean;
}) {
	return (
		<View
			style={[
				styles.row,
				isYou && styles.pairRowYou,
				!last && styles.rowDivider,
			]}
		>
			<Text style={styles.rowRank}>#{row.rank}</Text>
			<View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
				<Text
					style={styles.rowName}
					numberOfLines={1}
					adjustsFontSizeToFit
					minimumFontScale={0.6}
				>
					{pairTitle(row)}
					{isYou && <Text style={styles.rowYouTag}> (you)</Text>}
				</Text>
				<Text style={styles.rowSub} numberOfLines={1}>
					{bondBreakdown(row)}
				</Text>
			</View>
			<View style={styles.rowScoreCol}>
				<Text style={styles.rowScore} numberOfLines={1}>
					{row.bond.toLocaleString()}
				</Text>
				<Text style={styles.rowScoreUnit}>bond</Text>
			</View>
		</View>
	);
}

// `initialScope` lets a host open the board on a specific tab (the Sounder
// card's "standings live in the Board" note lands on the Sounders scope).
export function Leaderboard({ initialScope }: { initialScope?: BoardScope }) {
	const [showWallowPreview, setShowWallowPreview] = useState(false);
	const [scope, setScope] = useState<Scope>(initialScope ?? "global");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// The tickle breakdown receipt (spec 17) — which pig's ledger is open + its
	// already-known total (the fail-soft display when the RPC is dark).
	const [breakdownUser, setBreakdownUser] = useState<{
		id: string;
		total: number;
	} | null>(null);
	const openBreakdown = useCallback(
		(userId: string, total: number) => setBreakdownUser({ id: userId, total }),
		[],
	);
	// Alignment isn't a thing in Season 1 — the greedy/generous board
	// retires with Judgement Day, so its scope tab hides once s1 is live.
	const s1 = useFeatureFlag("world_boss") || __DEV__;
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
		myId,
		loading,
		loadingMore,
		hasMore,
		error,
		refresh: fetchLeaderboard,
		loadMore,
	} = useLeaderboard(scope);

	const champ = leaderboard[0];
	const rest = leaderboard.slice(1);

	return (
		<View style={styles.container}>
			<View style={styles.toggleWrap}>
				<Sticker color="paper" rotate={0} radius={22} style={styles.toggle}>
					{scopes.map((s) => {
						const active = s === scope;
						return (
							<Pressable
								key={s}
								onPress={() => setScope(s)}
								style={[styles.toggleBtn, active && styles.toggleBtnActive]}
							>
								<Icon
									name={
										s === "global"
											? "globe"
											: s === "friends"
												? "friends"
												: s === "pairs"
													? "handshake"
													: "star"
									}
									size={14}
									filled={active}
									color={WHIMSY.ink}
									strokeWidth={1.8}
								/>
								<Text
									style={[styles.toggleText, active && styles.toggleTextActive]}
								>
									{s === "global"
										? "Global"
										: s === "friends"
											? "Friends"
											: s === "pairs"
												? "Pairs"
												: "Alignment"}
								</Text>
							</Pressable>
						);
					})}
				</Sticker>
			</View>
			{__DEV__ && (
				<Pressable
					onPress={() => setShowWallowPreview((shown) => !shown)}
					style={({ pressed }) => [
						styles.previewToggle,
						showWallowPreview && styles.previewToggleOn,
						pressed && { opacity: 0.75 },
					]}
					accessibilityRole="button"
					accessibilityState={{ selected: showWallowPreview }}
				>
					<Glyph name="flame" size={16} />
					<Text style={styles.previewToggleText}>
						{showWallowPreview
							? "Showing Wallow ranks"
							: "Preview Wallow ranks"}
					</Text>
				</Pressable>
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
				// Fetch failed (both selects threw) — a cozy card with a
				// hand-link retry, so the Board never renders silently empty.
				<View style={styles.emptyWrap}>
					<Sticker
						color="paper"
						rotate={-0.5}
						radius={12}
						style={styles.emptyCard}
					>
						<Text style={styles.emptyText}>
							the Board is being shy — give it another nudge.
						</Text>
						<Pressable
							onPress={fetchLeaderboard}
							hitSlop={8}
							style={styles.retryLink}
						>
							<Text style={styles.retryText}>try again ›</Text>
						</Pressable>
					</Sticker>
				</View>
			) : scope === "pairs" ? (
				// Strongest pairs — the bond between two specific pigs, ranked.
				// Champion pair poster on top, then a flat sticker of ranked
				// rows, then the caller's own best pair pinned below when it
				// falls outside the top slice.
				pairs.length === 0 ? (
					<View style={styles.emptyWrap}>
						<Sticker
							color="paper"
							rotate={-0.5}
							radius={12}
							style={styles.emptyCard}
						>
							<Text style={styles.emptyText}>
								no bonds yet. trade, bless, and visit a friend to build one.
							</Text>
						</Sticker>
					</View>
				) : (
					<ScrollView
						style={styles.list}
						contentContainerStyle={styles.listContent}
					>
						<PairChampionPoster champ={pairs[0]} />
						{pairs.length > 1 && (
							<Sticker
								color="paper"
								rotate={-0.3}
								radius={14}
								style={styles.listSticker}
							>
								{pairs.slice(1).map((row, i, arr) => (
									<PairRow
										key={`${row.user_a}-${row.user_b}`}
										row={row}
										isYou={row.is_self}
										last={i === arr.length - 1}
									/>
								))}
							</Sticker>
						)}
						{/* The caller's own best pair, pinned below when it sits
						    outside the returned top slice — so you always see
						    where your strongest bond lands. */}
						{youPair && (
							<>
								<Text style={styles.youPairLabel}>★ your strongest pair</Text>
								<Sticker
									color="rose"
									rotate={0.4}
									radius={14}
									style={styles.listSticker}
								>
									<PairRow row={youPair} isYou last />
								</Sticker>
							</>
						)}
					</ScrollView>
				)
			) : leaderboard.length === 0 ? (
				// Empty state on a paper Sticker so it matches the Friends
				// segment's empty card instead of reading as bare text.
				<View style={styles.emptyWrap}>
					<Sticker
						color="paper"
						rotate={-0.5}
						radius={12}
						style={styles.emptyCard}
					>
						<Text style={styles.emptyText}>
							{scope === "friends"
								? "No friends yet. Add some on the Friends segment."
								: scope === "alignment"
									? "No one has taken a side yet. Trade to tip the scales."
									: "No tickles yet. Be the first!"}
						</Text>
					</Sticker>
				</View>
			) : scope === "alignment" ? (
				// Alignment leaderboard — TWO independent boards
				// (Generous top + Greedy top), each with its own
				// 1..N rank from the alignment_leaderboard RPC. We
				// used to render them as one flat 1..2N list which
				// made the most-greedy player look like "rank N+1
				// overall" — confusing because the two sides aren't
				// comparable, they're competing extremes.
				<ScrollView
					style={styles.list}
					contentContainerStyle={styles.listContent}
				>
					{(() => {
						const generous = leaderboard.filter(
							(r) => r.align_side === "generous",
						);
						const greedy = leaderboard.filter((r) => r.align_side === "greedy");
						return (
							<>
								{generous.length > 0 && (
									<>
										<View style={styles.alignSectionHeader}>
											<Text
												style={[
													styles.alignSectionText,
													styles.alignSectionGenerous,
												]}
											>
												GENEROUS · top {generous.length}
											</Text>
										</View>
										<Sticker
											color="paper"
											rotate={-0.3}
											radius={14}
											style={styles.listSticker}
										>
											{generous.map((item, i) => (
												<ClippingRow
													key={item.id}
													player={item}
													rank={item.align_side_rank ?? i + 1}
													isYou={item.id === myId}
													last={i === generous.length - 1}
													onPress={setSelectedUserId}
													showAlignment
												/>
											))}
										</Sticker>
									</>
								)}
								{greedy.length > 0 && (
									<>
										<View
											style={[styles.alignSectionHeader, { marginTop: 16 }]}
										>
											<Text
												style={[
													styles.alignSectionText,
													styles.alignSectionGreedy,
												]}
											>
												GREEDY · top {greedy.length}
											</Text>
										</View>
										<Sticker
											color="paper"
											rotate={0.4}
											radius={14}
											style={styles.listSticker}
										>
											{greedy.map((item, i) => (
												<ClippingRow
													key={item.id}
													player={item}
													rank={item.align_side_rank ?? i + 1}
													isYou={item.id === myId}
													last={i === greedy.length - 1}
													onPress={setSelectedUserId}
													showAlignment
												/>
											))}
										</Sticker>
									</>
								)}
							</>
						);
					})()}
				</ScrollView>
			) : (
				// Global / friends leaderboard — champion poster on top,
				// then a single flat sticker with the ranked rows. The
				// Load more pill paginates the global scope; friends
				// scope is naturally bounded by the 100-friend cap.
				<ScrollView
					style={styles.list}
					contentContainerStyle={styles.listContent}
				>
					{champ ? (
						<ChampionPoster
							champ={champ}
							onPress={setSelectedUserId}
							onPressScore={openBreakdown}
						/>
					) : null}
					{rest.length > 0 && (
						<Sticker
							color="paper"
							rotate={-0.3}
							radius={14}
							style={styles.listSticker}
						>
							{rest.map((item, index) => (
								<ClippingRow
									key={item.id}
									player={item}
									rank={index + 2}
									isYou={item.id === myId}
									last={index === rest.length - 1}
									onPress={setSelectedUserId}
									onPressScore={openBreakdown}
								/>
							))}
						</Sticker>
					)}
					{scope === "global" && hasMore && (
						<Pressable
							onPress={loadMore}
							disabled={loadingMore}
							style={({ pressed }) => [
								styles.loadMoreBtn,
								(pressed || loadingMore) && { opacity: 0.7 },
							]}
						>
							<Text style={styles.loadMoreBtnText}>
								{loadingMore ? "Loading…" : "Load more"}
							</Text>
						</Pressable>
					)}
					{scope === "global" &&
						!hasMore &&
						leaderboard.length >= LEADERBOARD_MAX_ROWS && (
							<Text style={styles.capNote}>
								★ top {LEADERBOARD_MAX_ROWS} pigs — that's the floor of the
								leaderboard
							</Text>
						)}
				</ScrollView>
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
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	toggleWrap: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 2 },
	toggle: { flexDirection: "row", padding: 4, gap: 4 },
	toggleBtn: {
		flex: 1,
		paddingVertical: 8,
		borderRadius: 18,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
	},
	toggleBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	toggleText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	toggleTextActive: { fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	previewToggle: {
		alignSelf: "center",
		flexDirection: "row",
		alignItems: "center",
		gap: 7,
		marginTop: 8,
		paddingHorizontal: 12,
		paddingVertical: 7,
		borderRadius: 18,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
	},
	previewToggleOn: { backgroundColor: WHIMSY.sun },
	previewToggleText: { ...TYPE.label, color: WHIMSY.ink },
	previewNote: {
		...TYPE.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 8,
		marginBottom: 2,
	},
	champWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
	// Poster padding aligned to the ranked-row horizontal padding (14) so
	// the champion card and the rows below share one left edge.
	champ: { paddingVertical: 16, paddingHorizontal: 14 },
	// Tape decoration tucked into the corner of the champion poster —
	// rotated rose strip matching the design's `Tape color="rose"`.
	champTape: {
		position: "absolute",
		top: -6,
		left: 14,
	},
	champOver: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	champBody: { flexDirection: "row", alignItems: "center", gap: 14 },
	champName: { ...TYPE.sectionTitle, color: WHIMSY.ink },
	champScore: {
		...TYPE.hand,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	champPrestige: {
		...TYPE.label,
		color: WHIMSY.accent,
		marginTop: 3,
	},
	// Pair champion — bond breakdown sub-line + the big bond number, matching
	// the ranked-row score treatment so the number reads as ONE thing.
	pairChampSub: { ...TYPE.hand, color: WHIMSY.mute, marginTop: 2 },
	champBond: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
	// Crown moved off Text-emoji onto <Icon name="crown" /> as part of
	// the no-emoji sweep — no inline style needed; Icon takes size +
	// color directly.
	list: { flex: 1 },
	listContent: {
		paddingHorizontal: 14,
		paddingTop: 4,
		paddingBottom: TAB_SAFE,
	},
	// Single sticker wrapping every ranked row — replaces per-row
	// tilted stickers so the leaderboard reads as one cohesive card.
	listSticker: {
		marginTop: 12,
		paddingHorizontal: 0,
		paddingVertical: 4,
	},
	// Per-side section header for the alignment scope. Generous gets
	// a gold-ish tint, Greedy gets the sage-green miasma — matches
	// the bless/curse color identity used elsewhere.
	alignSectionHeader: {
		marginTop: 12,
		marginBottom: 4,
		paddingHorizontal: 4,
	},
	// In-card section header — unified on KICKER_TEXT (13px hand) per the
	// UI audit so it matches the in-card kicker treatment elsewhere; the
	// per-side gold/green color is overridden below.
	alignSectionText: {
		...KICKER_TEXT,
	},
	alignSectionGenerous: { color: WHIMSY.bless }, // Barn blessing countdown (shared token)
	alignSectionGreedy: { color: WHIMSY.curseGreen }, // Barn curse countdown (shared token)
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 14,
		gap: 12,
	},
	rowYouHighlight: {
		backgroundColor: WHIMSY.cream,
	},
	// A pair row the caller is in — rose wash matching the you-row self-highlight
	// grammar used elsewhere (referral card, pinned you-pair sticker).
	pairRowYou: {
		backgroundColor: WHIMSY.rose,
	},
	// Kicker over the pinned "your strongest pair" sticker.
	youPairLabel: {
		...KICKER_TEXT,
		marginTop: 16,
		marginBottom: 2,
		paddingHorizontal: 4,
		color: WHIMSY.accent,
	},
	rowDivider: {
		borderBottomWidth: 1.5,
		borderBottomColor: WHIMSY.muteSoft,
		borderStyle: "dashed",
	},
	rowRank: {
		width: 28,
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	// Name + discriminator on a baseline-aligned line.
	rowNameLine: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 6,
	},
	rowName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		flexShrink: 1,
	},
	rowDisc: {
		...TYPE.label,
		color: WHIMSY.mute,
	},
	rowYouTag: { fontFamily: FONTS.hand, color: WHIMSY.accent },
	// Second-line under the name — "wears <hat>", falls back to
	// the active title when no hat is equipped.
	rowSub: {
		...TYPE.label,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Score column — number above tiny ♥ suffix, right-aligned. Sizes to
	// its content (flexShrink 0) so a 5-digit score keeps its own column
	// and the name (flex:1) yields width instead of the number wrapping.
	rowScoreCol: {
		alignItems: "flex-end",
		minWidth: 60,
		flexShrink: 0,
	},
	rowScore: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	rowScoreUnit: {
		...TYPE.label,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// "Load more" pill at the bottom of the global leaderboard.
	// Reads as a deliberate action button rather than infinite-scroll
	// magic — each tap pulls one more page of 25.
	loadMoreBtn: {
		alignSelf: "center",
		marginTop: 16,
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	loadMoreBtnText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	capNote: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: 14,
	},
	// Empty state — paper Sticker card matching the Friends segment's
	// empty card. Replaces the old bare centered Text.
	emptyWrap: { paddingHorizontal: 14, paddingTop: 12 },
	emptyCard: {
		paddingHorizontal: 16,
		paddingVertical: 16,
	},
	emptyText: {
		fontFamily: FONTS.hand,
		fontSize: 15,
		color: WHIMSY.mute,
		textAlign: "center",
		lineHeight: 21,
	},
	// Hand-link retry under the error copy — accent + underline, matching
	// the "leave it for now ›" hand-link grammar used elsewhere.
	retryLink: { alignSelf: "center", marginTop: 10, paddingHorizontal: 4 },
	retryText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
});
