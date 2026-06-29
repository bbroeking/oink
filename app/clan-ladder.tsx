// Clan Ladder (Phase 1c) — the "list of clans with relative strength." Reads the
// seasonal crew_ratings via crew_leaderboard(). Dark-launched behind
// MUD_FIGHTS_VISIBLE like the rest of Mud Wars; reached from the Mud Fight header.

import { useCallback, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { useFocusEffect } from "@react-navigation/native";
import {
	View,
	Text,
	StyleSheet,
	SafeAreaView,
	Pressable,
	ScrollView,
	ActivityIndicator,
} from "react-native";
import { Stack, router, Redirect } from "expo-router";
import { MUD_FIGHTS_VISIBLE } from "@/constants/featureFlags";
import { fetchCrewLeaderboard, LadderEntry } from "@/utils/mudWars";
import { useCrew } from "@/hooks/useCrew";
import { FONTS, WHIMSY } from "@/constants/theme";

export default function ClanLadderScreen() {
	const { crew } = useCrew();
	const myCrewId = crew.crew?.id ?? null;
	const [rows, setRows] = useState<LadderEntry[] | null>(null);

	const load = useCallback(async () => {
		if (!MUD_FIGHTS_VISIBLE) return; // don't fetch when the feature is hidden
		setRows(await fetchCrewLeaderboard(50));
	}, []);
	// Refetch on focus so a transient load failure self-heals (no error sentinel yet).
	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	if (!MUD_FIGHTS_VISIBLE) return <Redirect href="/(tabs)" />;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="ranked sounders"
						title="Clan Ladder"
						onBack={() => router.back()}
					/>

					{rows === null ? (
						<View style={styles.center}>
							<ActivityIndicator color={WHIMSY.accent} />
						</View>
					) : rows.length === 0 ? (
						<View style={styles.center}>
							<Text style={styles.emptyTitle}>No ranked Sounders yet</Text>
							<Text style={styles.emptyBody}>
								Finish a ranked Mud Fight to put your Sounder on the board.
							</Text>
						</View>
					) : (
						<ScrollView contentContainerStyle={styles.content}>
							<Text style={styles.lead}>
								Sounders ranked by what they win. Beat a stronger clan to climb faster.
							</Text>
							{rows.map((r, i) => {
								const mine = r.crew_id === myCrewId;
								return (
									<View key={r.crew_id} style={[styles.row, mine && styles.rowMine]}>
										<Text style={[styles.rank, i < 3 && styles.rankTop]}>{i + 1}</Text>
										<View style={styles.mid}>
											<Text style={styles.name} numberOfLines={1}>
												{r.name}
												{mine ? " · you" : ""}
											</Text>
											<Text style={styles.sub}>
												{r.wars_played} {r.wars_played === 1 ? "war" : "wars"} · {r.memberCount}{" "}
												{r.memberCount === 1 ? "member" : "members"}
												{r.provisional ? " · provisional" : ""}
											</Text>
										</View>
										<Text style={styles.rating}>{r.rating}</Text>
									</View>
								);
							})}
						</ScrollView>
					)}
				</SafeAreaView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 8 },
	content: { padding: 18, paddingBottom: 60 },
	lead: {
		fontFamily: FONTS.body,
		fontSize: 14,
		color: WHIMSY.mute,
		marginBottom: 14,
		textAlign: "center",
	},
	emptyTitle: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink, textAlign: "center" },
	emptyBody: { fontFamily: FONTS.body, fontSize: 14, color: WHIMSY.mute, textAlign: "center", marginTop: 4 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 8,
	},
	rowMine: { backgroundColor: WHIMSY.sun, borderWidth: 2.5 },
	rank: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.mute, width: 26, textAlign: "center" },
	rankTop: { color: WHIMSY.accent },
	mid: { flex: 1 },
	name: { fontFamily: FONTS.body, fontSize: 15, color: WHIMSY.ink },
	sub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },
	rating: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
});
