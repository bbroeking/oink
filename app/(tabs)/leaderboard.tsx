import { useState, useCallback } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Platform,
	SafeAreaView,
	Pressable,
	Text,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import { Icon } from "../../components/ui/Icon";
import { PigAvatar } from "../../components/ui/PigAvatar";
import { Sticker } from "../../components/ui/Sticker";
import { ListRowSkeleton } from "../../components/ui/Skeleton";
import { COLORS, FONTS, WHIMSY } from "@/constants/theme";

type Scope = "global" | "friends";

interface LeaderboardEntry {
	id: string;
	username: string | null;
	counter: number;
	tickles_earned: number;
	active_hat_id: string | null;
}

const ROW_TILTS = [-1.2, 0.8, -0.6, 0.5, -0.4, 1, -0.7, 0.6];

function ChampionPoster({ champ }: { champ: LeaderboardEntry }) {
	return (
		<View style={styles.champWrap}>
			<Sticker color="rose" rotate={-1.5} radius={18} border={2.5} style={styles.champ}>
				<Text style={styles.champOver}>★ all-time leader ★</Text>
				<View style={styles.champBody}>
					<View style={styles.champAvatarWrap}>
						<PigAvatar size={64} hatId={champ.active_hat_id} />
					</View>
					<View style={{ flex: 1, minWidth: 0 }}>
						<Text style={styles.champName} numberOfLines={1}>
							{champ.username ?? "Anonymous"}
						</Text>
						<Text style={styles.champScore}>
							{(champ.tickles_earned || champ.counter || 0).toLocaleString()} lifetime tickles
						</Text>
					</View>
					<View style={styles.bigOne}>
						<Text style={styles.bigOneText}>1</Text>
					</View>
				</View>
				<Text style={styles.starsRow}>✦ ✦ ✦</Text>
			</Sticker>
		</View>
	);
}

function ClippingRow({
	player,
	rank,
	isYou,
	tilt,
}: {
	player: LeaderboardEntry;
	rank: number;
	isYou: boolean;
	tilt: number;
}) {
	return (
		<View style={styles.rowWrap}>
			<Sticker
				color={isYou ? "rose" : "paper"}
				rotate={tilt}
				radius={10}
				style={styles.row}
			>
				<Text style={styles.rowRank}>#{rank}</Text>
				<PigAvatar size={32} hatId={player.active_hat_id} />
				<View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
					<Text style={styles.rowName} numberOfLines={1}>
						{player.username ?? "Anonymous"}
						{isYou && <Text style={styles.rowYouTag}> · you</Text>}
					</Text>
					{player.active_hat_id && (
						<Text style={styles.rowHat}>wears {player.active_hat_id}</Text>
					)}
				</View>
				<Text style={styles.rowScore}>
					{(player.tickles_earned || player.counter || 0).toLocaleString()} ♥
				</Text>
			</Sticker>
		</View>
	);
}

export default function LeaderboardScreen() {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [scope, setScope] = useState<Scope>("global");
	const [myId, setMyId] = useState<string | null>(null);

	const fetchLeaderboard = useCallback(async () => {
		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			setMyId(user?.id ?? null);

			if (scope === "friends") {
				const { data: friendIds } = await supabase.rpc("friend_ids");
				const ids = [
					...((friendIds as string[] | null) ?? []),
					...(user ? [user.id] : []),
				];
				if (ids.length === 0) {
					setLeaderboard([]);
					return;
				}
				const { data, error } = await supabase
					.from("profiles")
					.select("id, username, counter, tickles_earned, active_hat_id")
					.in("id", ids)
					.not("username", "is", null)
					.neq("username", "")
					.order("tickles_earned", { ascending: false });
				if (error) throw error;
				setLeaderboard((data as LeaderboardEntry[]) || []);
			} else {
				const { data, error } = await supabase
					.from("profiles")
					.select("id, username, counter, tickles_earned, active_hat_id")
					.not("username", "is", null)
					.neq("username", "")
					.order("tickles_earned", { ascending: false })
					.limit(50);
				if (error) throw error;
				setLeaderboard((data as LeaderboardEntry[]) || []);
			}
		} catch (error) {
			console.error("Error fetching leaderboard:", error);
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
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.header}>
					<Text style={styles.title}>Leaderboard</Text>
					<View style={styles.titleRule} />
					<View style={styles.toggleWrap}>
						<Sticker color="paper" rotate={0} radius={22} style={styles.toggle}>
							{(["global", "friends"] as Scope[]).map((s) => {
								const active = s === scope;
								return (
									<Pressable
										key={s}
										onPress={() => setScope(s)}
										style={[styles.toggleBtn, active && styles.toggleBtnActive]}
									>
										<Icon
											name={s === "global" ? "globe" : "friends"}
											size={14}
											filled={active}
											color={WHIMSY.ink}
											strokeWidth={1.8}
										/>
										<Text
											style={[
												styles.toggleText,
												active && styles.toggleTextActive,
											]}
										>
											{s === "global" ? "Global" : "Friends"}
										</Text>
									</Pressable>
								);
							})}
						</Sticker>
					</View>
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
							? "No friends yet. Add some on the Account tab."
							: "No tickles yet. Be the first!"}
					</Text>
				) : (
					<FlatList
						data={rest}
						ListHeaderComponent={champ ? <ChampionPoster champ={champ} /> : null}
						renderItem={({ item, index }) => (
							<ClippingRow
								player={item}
								rank={index + 2}
								isYou={item.id === myId}
								tilt={ROW_TILTS[index % ROW_TILTS.length]}
							/>
						)}
						keyExtractor={(item) => item.id}
						style={styles.list}
						contentContainerStyle={styles.listContent}
					/>
				)}
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: WHIMSY.cream },
	safeArea: { flex: 1 },
	header: {
		paddingHorizontal: 18,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
	},
	title: {
		fontSize: 32,
		fontFamily: FONTS.whimsy,
		color: WHIMSY.ink,
	},
	titleRule: {
		height: 2,
		width: 110,
		backgroundColor: WHIMSY.ink,
		opacity: 0.3,
		borderRadius: 1,
		marginTop: 4,
	},
	toggleWrap: { marginTop: 14 },
	toggle: {
		flexDirection: "row",
		padding: 4,
		gap: 4,
	},
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
	toggleText: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		color: WHIMSY.mute,
	},
	toggleTextActive: { fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	champWrap: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8 },
	champ: { padding: 16 },
	champOver: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		letterSpacing: 0.5,
		marginBottom: 8,
	},
	champBody: {
		flexDirection: "row",
		alignItems: "center",
		gap: 14,
	},
	champAvatarWrap: {
		borderRadius: 32,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		padding: 2,
	},
	champName: {
		fontFamily: FONTS.whimsy,
		fontSize: 26,
		color: WHIMSY.ink,
	},
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
	rowName: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	rowYouTag: {
		fontFamily: FONTS.hand,
		color: WHIMSY.accent,
	},
	rowHat: {
		fontFamily: FONTS.hand,
		fontSize: 12,
		color: WHIMSY.mute,
		marginTop: 1,
	},
	rowScore: {
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
	},
	empty: {
		textAlign: "center",
		padding: 36,
		color: WHIMSY.mute,
		fontFamily: FONTS.hand,
		fontSize: 15,
	},
});
