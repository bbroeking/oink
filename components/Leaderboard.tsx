// Leaderboard — the "Board" segment of the Friends hub. The hub owns
// the outer chrome (SafeAreaView + tab title), so this component is
// just the scope toggle + the ranked list + UserSheet.
import { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Pressable, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";
import { Icon } from "./ui/Icon";
import { PigAvatar } from "./ui/PigAvatar";
import { Sticker } from "./ui/Sticker";
import { ListRowSkeleton } from "./ui/Skeleton";
import { UserSheet } from "./UserSheet";
import { AlignmentBadge } from "./ui/AlignmentBadge";
import { FONTS, ROW_TILTS, WHIMSY } from "@/constants/theme";

type Scope = "global" | "friends" | "alignment";

interface ActiveTitle {
	id: string;
	name: string;
	placement: "pre" | "post";
}

interface LeaderboardEntry {
	id: string;
	username: string | null;
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
			<Sticker color="rose" rotate={-1.5} radius={18} border={2.5} style={styles.champ}>
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
						<Text style={styles.champScore}>
							{champ.tickles_earned.toLocaleString()} lifetime tickles
						</Text>
						<View style={{ marginTop: 6 }}>
							<AlignmentBadge score={champ.alignment_score ?? 0} size="sm" />
						</View>
					</View>
					<View style={styles.bigOne}>
						<Text style={styles.bigOneText}>1</Text>
					</View>
				</View>
				<Text style={styles.starsRow}>✦ ✦ ✦</Text>
			</Sticker>
		</Pressable>
	);
}

function ClippingRow({
	player,
	rank,
	isYou,
	tilt,
	onPress,
	showAlignment = false,
}: {
	player: LeaderboardEntry;
	rank: number;
	isYou: boolean;
	tilt: number;
	onPress: (userId: string) => void;
	showAlignment?: boolean;
}) {
	const score = player.alignment_score ?? 0;
	return (
		<Pressable style={styles.rowWrap} onPress={() => onPress(player.id)}>
			<Sticker
				color={isYou ? "rose" : "paper"}
				rotate={tilt}
				radius={10}
				style={styles.row}
			>
				<Text style={styles.rowRank}>#{rank}</Text>
				<PigAvatar size={32} hatId={player.active_hat_id} />
				<View style={{ marginLeft: 4 }}>
					<AlignmentBadge score={player.alignment_score ?? 0} size="sm" compact />
				</View>
				<View style={{ flex: 1, minWidth: 0, marginLeft: 6 }}>
					<Text
						style={styles.rowName}
						numberOfLines={1}
						adjustsFontSizeToFit
						minimumFontScale={0.6}
					>
						{formatDisplayName(player.username, player.active_title)}
						{isYou && <Text style={styles.rowYouTag}> · you</Text>}
					</Text>
					{player.active_hat_id && (
						<Text style={styles.rowHat}>wears {player.active_hat_id}</Text>
					)}
				</View>
				<Text style={styles.rowScore}>
					{showAlignment
						? score > 0
							? `+${score}`
							: `${score}`
						: `${player.tickles_earned.toLocaleString()} ♥`}
				</Text>
			</Sticker>
		</Pressable>
	);
}

export function Leaderboard() {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [scope, setScope] = useState<Scope>("global");
	const [myId, setMyId] = useState<string | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const fetchLeaderboard = useCallback(async () => {
		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setMyId(user?.id ?? null);

			const SELECT_WITH_TITLES =
				"id, username, tickles_earned, active_hat_id, alignment_score, active_title:titles!profiles_active_title_id_fkey(id, name, placement)";
			const SELECT_BASIC =
				"id, username, tickles_earned, active_hat_id, alignment_score";

			const runQuery = async (select: string, friendIds?: string[]) => {
				let q = supabase
					.from("profiles")
					.select(select)
					.not("username", "is", null)
					.neq("username", "")
					.order("tickles_earned", { ascending: false });
				if (friendIds) q = q.in("id", friendIds);
				else q = q.limit(50);
				return q;
			};

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

			let friendIds: string[] | undefined;
			if (scope === "friends") {
				const { data: friends } = await supabase.rpc("friend_ids");
				friendIds = [
					...((friends as string[] | null) ?? []),
					...(user ? [user.id] : []),
				];
				if (friendIds.length === 0) {
					setLeaderboard([]);
					return;
				}
			}

			let result = await runQuery(SELECT_WITH_TITLES, friendIds);
			if (result.error) {
				log.error("Leaderboard titles join failed, retrying without:", result.error);
				result = await runQuery(SELECT_BASIC, friendIds);
				if (result.error) throw result.error;
			}
			setLeaderboard(normalize(result.data as unknown as RawRow[] | null));

			supabase.rpc("mark_all_pass_events_seen").then(() => {});
		} catch (error) {
			log.error("Error fetching leaderboard:", error);
		} finally {
			setLoading(false);
		}
	}, [scope]);

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
				<FlatList
					data={leaderboard}
					renderItem={({ item, index }) => (
						<ClippingRow
							player={item}
							rank={index + 1}
							isYou={item.id === myId}
							tilt={ROW_TILTS[index % ROW_TILTS.length]}
							onPress={setSelectedUserId}
							showAlignment
						/>
					)}
					keyExtractor={(item) => item.id}
					style={styles.list}
					contentContainerStyle={styles.listContent}
				/>
			) : (
				<FlatList
					data={rest}
					ListHeaderComponent={
						champ ? (
							<ChampionPoster champ={champ} onPress={setSelectedUserId} />
						) : null
					}
					renderItem={({ item, index }) => (
						<ClippingRow
							player={item}
							rank={index + 2}
							isYou={item.id === myId}
							tilt={ROW_TILTS[index % ROW_TILTS.length]}
							onPress={setSelectedUserId}
						/>
					)}
					keyExtractor={(item) => item.id}
					style={styles.list}
					contentContainerStyle={styles.listContent}
				/>
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
	bigOne: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		transform: [{ rotate: "8deg" }],
	},
	bigOneText: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		color: WHIMSY.ink,
		lineHeight: 24,
	},
	starsRow: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.muteSoft,
		marginTop: 8,
	},
	list: { flex: 1 },
	listContent: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 110 },
	rowWrap: { marginVertical: 4 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 10,
		paddingHorizontal: 12,
		gap: 8,
	},
	rowRank: {
		width: 28,
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	rowName: { fontFamily: FONTS.whimsy, fontSize: 14, color: WHIMSY.ink },
	rowYouTag: { fontFamily: FONTS.hand, color: WHIMSY.accent },
	rowHat: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	rowScore: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	empty: {
		textAlign: "center",
		padding: 36,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
});
