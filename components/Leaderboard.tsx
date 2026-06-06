// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text, Image } from "react-native";
import { HAT_IMAGES } from "@/constants/hats";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { rpc } from "@/utils/rpc";
import { getFriendIds } from "@/utils/friendships";
import { log } from "../utils/log";
import { Icon } from "./ui/Icon";
import { PigAvatar } from "./ui/PigAvatar";
import { Sticker } from "./ui/Sticker";
import { ListRowSkeleton } from "./ui/Skeleton";
import { UserSheet } from "./UserSheet";
import { FONTS, WHIMSY } from "@/constants/theme";

// Page size + hard upper bound for the global leaderboard. 25 lands
// just over a single phone screen so each "Load more" is a deliberate
// reach; 100 is the highest rank that's still meaningful to the
// average player (the long tail past rank 100 is competitive noise).
const LEADERBOARD_PAGE_SIZE = 25;
const LEADERBOARD_MAX_ROWS = 100;

type Scope = "global" | "friends" | "alignment";

interface ActiveTitle {
	id: string;
	name: string;
	placement: "pre" | "post";
}

interface ActiveHat {
	name: string;
}

interface LeaderboardEntry {
	id: string;
	username: string | null;
	discriminator?: string | null;
	tickles_earned: number;
	active_hat_id: string | null;
	// Equipped country flag (World Cup) — rendered as a small chip by the name.
	active_flag_id?: string | null;
	// Name of the equipped hat (joined through the active_hat_id FK).
	// Drives the "wears X" second line on each ranked row. Null when
	// no hat is equipped or when the hats join falls back.
	active_hat: ActiveHat | null;
	active_title: ActiveTitle | null;
	alignment_score?: number | null;
	// Alignment-scope only: which half of the leaderboard this row
	// belongs to (Generous top vs Greedy top) + the within-side rank.
	// alignment_leaderboard RPC returns both; we used to throw them
	// away and renumber every row 1..N, which made Greedy #1 read
	// like "rank 11 overall" — confusing because it ranks across
	// two independent boards.
	align_side?: "generous" | "greedy" | null;
	align_side_rank?: number | null;
}

function formatDisplayName(
	username: string | null,
	title: ActiveTitle | null
): string {
	const name = username ?? "Anonymous";
	if (!title) return name;
	return title.placement === "post"
		? `${name} ${title.name}`
		: `${title.name} ${name}`;
}

// PostgREST returns 1:1 joins either as a single object or as a
// length-1 array depending on the relationship's cardinality
// metadata; normalize so the UI can read .active_title?.name /
// .active_hat?.name directly.
type RawRow = Omit<LeaderboardEntry, "active_title" | "active_hat"> & {
	active_title?: ActiveTitle[] | ActiveTitle | null;
	active_hat?: ActiveHat[] | ActiveHat | null;
};
function normalize(rows: RawRow[] | null): LeaderboardEntry[] {
	return (rows ?? []).map((r) => ({
		...r,
		active_hat: Array.isArray(r.active_hat)
			? (r.active_hat[0] ?? null)
			: (r.active_hat ?? null),
		active_title: Array.isArray(r.active_title)
			? (r.active_title[0] ?? null)
			: (r.active_title ?? null),
	}));
}

function ChampionPoster({
	champ,
	onPress,
}: {
	champ: LeaderboardEntry;
	onPress: (userId: string) => void;
}) {
	return (
		<Pressable style={styles.champWrap} onPress={() => onPress(champ.id)}>
			<Sticker color="sun" rotate={-1.5} radius={18} border={2.5} style={styles.champ}>
				{/* Rose tape pinning the poster — small decorative pin in
				    the top-left so the champion poster reads as "tacked up"
				    on the leaderboard wall. */}
				<View style={styles.champTape} />
				{/* Lifetime tickles_earned drives the sort, so the #1 slot
				    is the all-time leader — calling them 'today's
				    champion' would imply a daily reset the schema
				    doesn't have. Restored the accurate label. */}
				<Text style={styles.champOver}>★ all-time leader ★</Text>
				<View style={styles.champBody}>
					<View style={styles.champAvatarWrap}>
						<PigAvatar size={64} hatId={champ.active_hat_id} />
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text
							style={styles.champName}
							numberOfLines={1}
							adjustsFontSizeToFit
							minimumFontScale={0.55}
						>
							{formatDisplayName(champ.username, champ.active_title)}
						</Text>
						{/* Second line — tickles count is always present
						    (it's what earned them the leader spot), the
						    "wears X" reads alongside when a hat is
						    equipped. Joined with a middot so the line
						    stays single-row. Earlier version dropped
						    the count when a hat existed, hiding the
						    one number the leaderboard actually
						    competes on. */}
						<Text style={styles.champScore} numberOfLines={1}>
							♥ {champ.tickles_earned.toLocaleString()}
							{champ.active_hat?.name ? `  ·  wears ${champ.active_hat.name}` : ""}
						</Text>
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
	showAlignment = false,
}: {
	player: LeaderboardEntry;
	rank: number;
	isYou: boolean;
	// Marks the last row in the flat sticker — suppresses its bottom
	// dashed border so the divider only appears between rows.
	last?: boolean;
	onPress: (userId: string) => void;
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
				<PigAvatar size={32} hatId={player.active_hat_id} />
				<View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
					<View style={styles.rowNameLine}>
						<Text
							style={styles.rowName}
							numberOfLines={1}
							adjustsFontSizeToFit
							minimumFontScale={0.6}
						>
							{formatDisplayName(player.username, player.active_title)}
							{isYou && <Text style={styles.rowYouTag}> (you)</Text>}
						</Text>
						{player.active_flag_id && HAT_IMAGES[player.active_flag_id] ? (
							<Image
								source={HAT_IMAGES[player.active_flag_id]}
								style={styles.flagChip}
								resizeMode="contain"
							/>
						) : null}
						{player.discriminator && (
							<Text style={styles.rowDisc}>#{player.discriminator}</Text>
						)}
					</View>
					{/* Second line — what the pig is wearing, falling
					    back to the active title when nothing is
					    equipped. PigAvatar already shows the hat as a
					    sprite; the text labels the item so the row
					    reads even at a glance. */}
					{player.active_hat?.name ? (
						<Text style={styles.rowSub} numberOfLines={1}>
							wears {player.active_hat.name}
						</Text>
					) : player.active_title?.name ? (
						<Text style={styles.rowSub} numberOfLines={1}>
							{player.active_title.name}
						</Text>
					) : null}
				</View>
				<View style={styles.rowScoreCol}>
					<Text style={styles.rowScore}>
						{showAlignment
							? score > 0
								? `+${score}`
								: `${score}`
							: player.tickles_earned.toLocaleString()}
					</Text>
					<Text style={styles.rowScoreUnit}>
						{showAlignment ? "align" : "♥"}
					</Text>
				</View>
		</Pressable>
	);
}

export function Leaderboard() {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [scope, setScope] = useState<Scope>("global");
	const [myId, setMyId] = useState<string | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
	// Paginated load-more state for the global scope. Friends scope is
	// already bounded by the 100-friend cap; alignment is RPC-served
	// with a fixed per_side, so neither needs pagination.
	const [loadingMore, setLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);

	// Fetches `count` rows starting at `from` from profiles, ordered
	// by tickles_earned desc. Falls back to the no-titles select if
	// the active_title join 400s (pre-titles-migration installs).
	const fetchGlobalPage = useCallback(
		async (from: number, count: number): Promise<LeaderboardEntry[]> => {
			// active_hat join lights up the "wears X" second-line on
			// each ranked row. The titles join is independent; if the
			// titles migration isn't deployed, retry without titles
			// but keep the hat join (its migration is much older).
			const SELECT_WITH_TITLES =
				"id, username, discriminator, tickles_earned, active_hat_id, active_flag_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
			const SELECT_BASIC =
				"id, username, discriminator, tickles_earned, active_hat_id, active_flag_id, alignment_score, active_hat:hats!profiles_active_hat_id_fkey(name)";
			// is_test filter only fires on the global scope — friends
			// list intentionally shows any account you've friended,
			// test or not. The 'or' wrap handles legacy rows where
			// the column is missing (pre-20260548 migration), which
			// PostgREST treats as NULL ≠ true → row included.
			const run = async (select: string) =>
				supabase
					.from("profiles")
					.select(select)
					.not("username", "is", null)
					.neq("username", "")
					.or("is_test.is.null,is_test.eq.false")
					// Hidden accounts (demo reviewer, junk usernames) never
					// appear on the global board. Column is NOT NULL DEFAULT
					// false, so eq(false) covers every row.
					.eq("hide_from_leaderboard", false)
					.order("tickles_earned", { ascending: false })
					.range(from, from + count - 1);
			let result = await run(SELECT_WITH_TITLES);
			if (result.error) {
				log.error("Leaderboard titles join failed, retrying without:", result.error);
				result = await run(SELECT_BASIC);
				if (result.error) throw result.error;
			}
			return normalize(result.data as unknown as RawRow[] | null);
		},
		[]
	);

	const fetchLeaderboard = useCallback(async () => {
		setLoading(true);
		setHasMore(false);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setMyId(user?.id ?? null);

			if (scope === "alignment") {
				const rows = await rpc<
					{
						user_id: string;
						username: string | null;
						active_hat_id: string | null;
						active_flag_id: string | null;
						alignment_score: number;
						side: "generous" | "greedy";
						side_rank: number;
					}[]
				>("alignment_leaderboard", {
					per_side: 25,
				});
				const mapped: LeaderboardEntry[] = (rows ?? []).map((r) => ({
					id: r.user_id,
					username: r.username,
					tickles_earned: 0,
					active_hat_id: r.active_hat_id,
					active_flag_id: r.active_flag_id ?? null,
					// alignment_leaderboard RPC doesn't carry the hat
					// name; the "wears X" line falls back to nothing in
					// this scope. Acceptable — the alignment view leads
					// with the score, hats are secondary signal there.
					active_hat: null,
					active_title: null,
					alignment_score: r.alignment_score,
					align_side: r.side,
					align_side_rank: r.side_rank,
				}));
				setLeaderboard(mapped);
				return;
			}

			if (scope === "friends") {
				// Bounded by the 100-friend cap — fetch once, no pagination.
				const friends = await getFriendIds();
				const friendIds = [
					...(friends ?? []),
					...(user ? [user.id] : []),
				];
				if (friendIds.length === 0) {
					setLeaderboard([]);
					return;
				}
				const SELECT_BASIC =
					"id, username, discriminator, tickles_earned, active_hat_id, active_flag_id, alignment_score, active_hat:hats!profiles_active_hat_id_fkey(name)";
				const SELECT_WITH_TITLES =
					"id, username, discriminator, tickles_earned, active_hat_id, active_flag_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement), active_hat:hats!profiles_active_hat_id_fkey(name)";
				// The titles join 400s when the titles migration isn't
				// deployed; retry without it. Untyped intermediate so
				// both selects can land in the same variable.
				const runFriends = async (sel: string) =>
					supabase
						.from("profiles")
						.select(sel)
						.in("id", friendIds)
						.not("username", "is", null)
						.neq("username", "")
						.order("tickles_earned", { ascending: false });
				let result = (await runFriends(SELECT_WITH_TITLES)) as {
					data: unknown;
					error: unknown;
				};
				if (result.error) {
					result = (await runFriends(SELECT_BASIC)) as {
						data: unknown;
						error: unknown;
					};
					if (result.error) throw result.error;
				}
				setLeaderboard(normalize(result.data as RawRow[] | null));
				return;
			}

			// Global scope — paginated. Pull the first page (PAGE_SIZE +
			// 1 so the champion poster doesn't eat a slot from the rest
			// list) and seed hasMore on whether the page came back full.
			const firstPage = await fetchGlobalPage(0, LEADERBOARD_PAGE_SIZE);
			setLeaderboard(firstPage);
			setHasMore(
				firstPage.length === LEADERBOARD_PAGE_SIZE &&
					firstPage.length < LEADERBOARD_MAX_ROWS
			);

			rpc("mark_all_pass_events_seen").then(() => {});
		} catch (error) {
			log.error("Error fetching leaderboard:", error);
		} finally {
			setLoading(false);
		}
	}, [scope, fetchGlobalPage]);

	const loadMore = useCallback(async () => {
		if (loadingMore || !hasMore) return;
		setLoadingMore(true);
		try {
			const from = leaderboard.length;
			const want = Math.min(
				LEADERBOARD_PAGE_SIZE,
				LEADERBOARD_MAX_ROWS - from
			);
			if (want <= 0) {
				setHasMore(false);
				return;
			}
			const next = await fetchGlobalPage(from, want);
			setLeaderboard((prev) => [...prev, ...next]);
			setHasMore(
				next.length === want && from + next.length < LEADERBOARD_MAX_ROWS
			);
		} catch (error) {
			log.error("Error loading more leaderboard rows:", error);
		} finally {
			setLoadingMore(false);
		}
	}, [loadingMore, hasMore, leaderboard.length, fetchGlobalPage]);

	useFocusEffect(
		useCallback(() => {
			fetchLeaderboard();
		}, [fetchLeaderboard])
	);

	const champ = leaderboard[0];
	const rest = leaderboard.slice(1);

	return (
		<View style={styles.container}>
			<View style={styles.toggleWrap}>
				<Sticker color="paper" rotate={0} radius={22} style={styles.toggle}>
					{(["global", "friends", "alignment"] as Scope[]).map((s) => {
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
											: "Alignment"}
								</Text>
							</Pressable>
						);
					})}
				</Sticker>
			</View>

			{loading ? (
				<View style={styles.listContent}>
					{Array.from({ length: 6 }).map((_, i) => (
						<ListRowSkeleton key={i} />
					))}
				</View>
			) : leaderboard.length === 0 ? (
				<Text style={styles.empty}>
					{scope === "friends"
						? "No friends yet. Add some on the Friends segment."
						: scope === "alignment"
							? "No one has taken a side yet. Trade to tip the scales."
							: "No tickles yet. Be the first!"}
				</Text>
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
						const generous = leaderboard.filter((r) => r.align_side === "generous");
						const greedy = leaderboard.filter((r) => r.align_side === "greedy");
						return (
							<>
								{generous.length > 0 && (
									<>
										<View style={styles.alignSectionHeader}>
											<Text style={[styles.alignSectionText, styles.alignSectionGenerous]}>
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
										<View style={[styles.alignSectionHeader, { marginTop: 18 }]}>
											<Text style={[styles.alignSectionText, styles.alignSectionGreedy]}>
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
						<ChampionPoster champ={champ} onPress={setSelectedUserId} />
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
	champWrap: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
	champ: { padding: 16 },
	// Tape decoration tucked into the corner of the champion poster —
	// rotated rose strip matching the design's `Tape color="rose"`.
	champTape: {
		position: "absolute",
		top: -6,
		left: 14,
		width: 48,
		height: 12,
		backgroundColor: WHIMSY.roseDeep,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		transform: [{ rotate: "-12deg" }],
		opacity: 0.92,
	},
	champOver: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	champBody: { flexDirection: "row", alignItems: "center", gap: 14 },
	champAvatarWrap: {
		borderRadius: 32,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		padding: 2,
	},
	champName: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink },
	champScore: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Crown moved off Text-emoji onto <Icon name="crown" /> as part of
	// the no-emoji sweep — no inline style needed; Icon takes size +
	// color directly.
	list: { flex: 1 },
	listContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 110 },
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
	alignSectionText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
	},
	alignSectionGenerous: { color: "#C99B23" }, // matches Barn blessing countdown
	alignSectionGreedy:   { color: "#5E7E49" }, // matches Barn curse countdown
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 14,
		gap: 8,
	},
	rowYouHighlight: {
		backgroundColor: WHIMSY.cream,
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
	rowName: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink, flexShrink: 1 },
	flagChip: { width: 22, height: 16, alignSelf: "center" },
	rowDisc: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
	},
	rowYouTag: { fontFamily: FONTS.hand, color: WHIMSY.accent },
	// Second-line under the name — "wears <hat>", falls back to
	// the active title when no hat is equipped.
	rowSub: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// Score column — number above tiny ♥ suffix, right-aligned.
	rowScoreCol: {
		alignItems: "flex-end",
		minWidth: 60,
	},
	rowScore: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	rowScoreUnit: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		color: WHIMSY.mute,
		marginTop: 2,
	},
	// "Load more" pill at the bottom of the global leaderboard.
	// Reads as a deliberate action button rather than infinite-scroll
	// magic — each tap pulls one more page of 25.
	loadMoreBtn: {
		alignSelf: "center",
		marginTop: 14,
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		shadowColor: WHIMSY.ink,
		shadowOffset: { width: 2, height: 2 },
		shadowOpacity: 1,
		shadowRadius: 0,
		elevation: 2,
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
	empty: {
		textAlign: "center",
		padding: 36,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
});
