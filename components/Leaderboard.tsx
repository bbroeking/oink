// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
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

interface LeaderboardEntry {
	id: string;
	username: string | null;
	discriminator?: string | null;
	tickles_earned: number;
	active_hat_id: string | null;
	active_title: ActiveTitle | null;
	alignment_score?: number | null;
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

type RawRow = Omit<LeaderboardEntry, "active_title"> & {
	active_title?: ActiveTitle[] | ActiveTitle | null;
};
function normalize(rows: RawRow[] | null): LeaderboardEntry[] {
	return (rows ?? []).map((r) => ({
		...r,
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
				<Text style={styles.champOver}>★ today's champion ★</Text>
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
						<Text style={styles.champScore}>
							{champ.active_title?.name ? `${champ.active_title.name} · ` : ""}
							♥ {champ.tickles_earned.toLocaleString()}
						</Text>
					</View>
					{/* Crown — the de-facto leader glyph. Replaces the old
					    rotated "1" badge so the role reads instantly. */}
					<Text style={styles.crownGlyph}>👑</Text>
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
						{player.discriminator && (
							<Text style={styles.rowDisc}>#{player.discriminator}</Text>
						)}
					</View>
					{player.active_title?.name && (
						<Text style={styles.rowTitle} numberOfLines={1}>
							{player.active_title.name}
						</Text>
					)}
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
			const SELECT_WITH_TITLES =
				"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement)";
			const SELECT_BASIC =
				"id, username, discriminator, tickles_earned, active_hat_id, alignment_score";
			const run = async (select: string) =>
				supabase
					.from("profiles")
					.select(select)
					.not("username", "is", null)
					.neq("username", "")
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
				const { data: rows } = await supabase.rpc("alignment_leaderboard", {
					per_side: 25,
				});
				const mapped: LeaderboardEntry[] = (
					(rows as
						| {
								user_id: string;
								username: string | null;
								active_hat_id: string | null;
								alignment_score: number;
						  }[]
						| null) ?? []
				).map((r) => ({
					id: r.user_id,
					username: r.username,
					tickles_earned: 0,
					active_hat_id: r.active_hat_id,
					active_title: null,
					alignment_score: r.alignment_score,
				}));
				setLeaderboard(mapped);
				return;
			}

			if (scope === "friends") {
				// Bounded by the 100-friend cap — fetch once, no pagination.
				const { data: friends } = await supabase.rpc("friend_ids");
				const friendIds = [
					...((friends as string[] | null) ?? []),
					...(user ? [user.id] : []),
				];
				if (friendIds.length === 0) {
					setLeaderboard([]);
					return;
				}
				const SELECT_BASIC =
					"id, username, discriminator, tickles_earned, active_hat_id, alignment_score";
				const SELECT_WITH_TITLES =
					"id, username, discriminator, tickles_earned, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement)";
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

			supabase.rpc("mark_all_pass_events_seen").then(() => {});
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
				// Alignment leaderboard — no champion poster (rank 1 in
				// alignment isn't a "today's champion" moment). Single
				// flat sticker holds every row with dashed dividers.
				<ScrollView
					style={styles.list}
					contentContainerStyle={styles.listContent}
				>
					<Sticker
						color="paper"
						rotate={-0.3}
						radius={14}
						style={styles.listSticker}
					>
						{leaderboard.map((item, index) => (
							<ClippingRow
								key={item.id}
								player={item}
								rank={index + 1}
								isYou={item.id === myId}
								last={index === leaderboard.length - 1}
								onPress={setSelectedUserId}
								showAlignment
							/>
						))}
					</Sticker>
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
	// Crown glyph at the right of the champion poster — replaces the
	// old rotated "1" badge so the role reads instantly.
	crownGlyph: {
		fontSize: 36,
	},
	list: { flex: 1 },
	listContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 110 },
	// Single sticker wrapping every ranked row — replaces per-row
	// tilted stickers so the leaderboard reads as one cohesive card.
	listSticker: {
		marginTop: 12,
		paddingHorizontal: 0,
		paddingVertical: 4,
	},
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
	rowDisc: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		color: WHIMSY.mute,
	},
	rowYouTag: { fontFamily: FONTS.hand, color: WHIMSY.accent },
	rowTitle: {
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
