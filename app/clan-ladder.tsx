// Sounder League — the season table, ranked by PRIZE RIBBONS (the crew Elo
// rebased to a trophy scale: start 200, floor 0, K 40→24 by rope margin)
// via sounder_league_standings(), with the SPIRIT board (7-day war activity +
// intra-crew kindness, per snout) as the second tab. W–L is the record
// subline; no fixture ends in a draw. Dark-launched behind the `mud_wars`
// server flag like the rest of Mud Wars; reached from the Mud Fight header
// and the SounderCard's standings link.
// Spec: docs/sounder-league-spec.md.

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
import { useFeatureFlagState } from "@/hooks/useFeatureFlags";
import {
	fetchLeagueStandings,
	fetchSounderStandings,
	leagueSort,
	spiritSort,
	padWithMocks,
	LeagueEntry,
	SpiritEntry,
} from "@/utils/mudWars";
import { useCrew } from "@/hooks/useCrew";
import { Icon } from "@/components/ui/Icon";
import { FONTS, WHIMSY } from "@/constants/theme";

// ── DEV mock Sounders — design bodies for a sparse beta board ────────────────
const MOCK_SOUNDERS: SpiritEntry[] = [
	{
		crew_id: "mock-1", name: "The Mud Maulers", memberCount: 4,
		kindness: 42, activity: 88, spirit: 33, rating: 1261, wars: 9,
		members: [
			{ username: "Rosie", role: "leader" },
			{ username: "Pip", role: "member" },
			{ username: "Moo", role: "member" },
			{ username: "Clover", role: "member" },
		],
	},
	{
		crew_id: "mock-2", name: "Trough Loyalists", memberCount: 4,
		kindness: 51, activity: 40, spirit: 23, rating: 1187, wars: 6,
		members: [
			{ username: "Jen", role: "leader" },
			{ username: "Waddles", role: "member" },
			{ username: "Snoot", role: "member" },
			{ username: "Pudding", role: "member" },
		],
	},
	{
		crew_id: "mock-3", name: "Bog Standard", memberCount: 3,
		kindness: 18, activity: 45, spirit: 21, rating: 1224, wars: 7,
		members: [
			{ username: "Hamlet", role: "leader" },
			{ username: "Porkchop", role: "member" },
			{ username: "Truffle", role: "member" },
		],
	},
	{
		crew_id: "mock-4", name: "The Gilded Snouts", memberCount: 2,
		kindness: 24, activity: 12, spirit: 18, rating: null, wars: 0,
		members: [
			{ username: "Duchess", role: "leader" },
			{ username: "Petunia", role: "member" },
		],
	},
	{
		crew_id: "mock-5", name: "Famished Five", memberCount: 4,
		kindness: 9, activity: 51, spirit: 15, rating: 1096, wars: 11,
		members: [
			{ username: "Grunt", role: "leader" },
			{ username: "Squeal", role: "member" },
			{ username: "Wallow", role: "member" },
			{ username: "Mucky", role: "member" },
		],
	},
];

// League-shaped twins of the mock crews (same names/rosters, table records).
const MOCK_LEAGUE: LeagueEntry[] = MOCK_SOUNDERS.map((s, i) => ({
	crew_id: s.crew_id,
	name: s.name,
	memberCount: s.memberCount,
	ribbons: [286, 241, 219, 200, 164][i],
	provisional: [false, false, false, true, false][i],
	played: [4, 4, 3, 2, 4][i],
	wins: [4, 3, 2, 0, 1][i],
	losses: [0, 1, 1, 2, 3][i],
	diff: [21, 9, 4, -8, -14][i],
	members: s.members,
}));

export default function ClanLadderScreen() {
	const { visible: mudWarsVisible, loaded: flagLoaded } =
		useFeatureFlagState("mud_wars");
	const { crew } = useCrew();
	const myCrewId = crew.crew?.id ?? null;
	const [league, setLeague] = useState<LeagueEntry[] | null>(null);
	const [spirit, setSpirit] = useState<SpiritEntry[] | null>(null);
	// Two boards: the season Table (fixture record — the ranked one) and
	// Spirit (kindest + most active per snout, still celebrated second).
	const [board, setBoard] = useState<"table" | "spirit">("table");
	// Tap a row to expand its roster.
	const [expanded, setExpanded] = useState<string | null>(null);

	const load = useCallback(async () => {
		if (!mudWarsVisible) return; // don't fetch when the season is dark
		const [liveLeague, liveSpirit] = await Promise.all([
			fetchLeagueStandings(50),
			fetchSounderStandings(50),
		]);
		// DEV ONLY: pad a sparse board with mock Sounders so the standings
		// design can be judged with real-looking data. Never ships: gated on
		// __DEV__, and live rows always outrank the mocks' insertion.
		setLeague(
			__DEV__ && liveLeague.length < 4
				? padWithMocks(liveLeague, MOCK_LEAGUE, leagueSort)
				: liveLeague
		);
		setSpirit(
			__DEV__ && liveSpirit.length < 4
				? padWithMocks(liveSpirit, MOCK_SOUNDERS, spiritSort)
				: liveSpirit
		);
	}, [mudWarsVisible]);
	// Refetch on focus so a transient load failure self-heals (no error sentinel yet).
	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	if (!flagLoaded) return null;
	if (!mudWarsVisible) return <Redirect href="/(tabs)" />;

	const rows = board === "table" ? league : spirit;

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="the season table"
						title="Sounder League"
						onBack={() => router.back()}
					/>

					{rows === null ? (
						<View style={styles.center}>
							<ActivityIndicator color={WHIMSY.accent} />
						</View>
					) : rows.length === 0 ? (
						<View style={styles.center}>
							<Text style={styles.emptyTitle}>No Sounders on the board yet</Text>
							<Text style={styles.emptyBody}>
								Every term the league hands your Sounder a rival. Answer the
								fixture — sling mud, dig truffles — and the table remembers.
							</Text>
						</View>
					) : (
						<ScrollView contentContainerStyle={styles.content}>
							{/* Board toggle — the Table is the ranked default. */}
							<View style={styles.boardTabs}>
								{(["table", "spirit"] as const).map((b) => (
									<Pressable
										key={b}
										onPress={() => setBoard(b)}
										style={[styles.boardTab, board === b && styles.boardTabActive]}
									>
										<Text
											style={[
												styles.boardTabText,
												board === b && styles.boardTabTextActive,
											]}
										>
											{b === "table" ? "Table" : "Spirit"}
										</Text>
									</Pressable>
								))}
							</View>
							<Text style={styles.lead}>
								{board === "table"
									? "Ranked by Prize Ribbons — beat a stronger Sounder, win more ribbons. Each term the league pairs you with a rival, and no scuffle ends in a draw."
									: "Ranked by Spirit — this week's scuffle effort plus the kindness crewmates show each other, counted per snout."}
							</Text>
							{board === "table"
								? (league ?? []).map((r, i) => {
										const mine = r.crew_id === myCrewId;
										const open = expanded === r.crew_id;
										return (
											<Pressable
												key={r.crew_id}
												onPress={() => setExpanded(open ? null : r.crew_id)}
												style={[styles.row, mine && styles.rowMine]}
											>
												<View style={styles.rowTop}>
													<Text style={[styles.rank, i < 3 && styles.rankTop]}>{i + 1}</Text>
													<View style={styles.mid}>
														<Text style={styles.name} numberOfLines={1}>
															{r.name}
															{mine ? " · you" : ""}
														</Text>
														<Text style={styles.sub}>
															{`${r.wins}–${r.losses} · ${r.played} ${r.played === 1 ? "fixture" : "fixtures"} · mud ${r.diff > 0 ? "+" : ""}${r.diff}${r.provisional ? " · new banner" : ""}`}
														</Text>
													</View>
													<View style={styles.spiritCol}>
														<Text style={styles.spirit}>{r.ribbons}</Text>
														<Text style={styles.spiritLabel}>ribbons</Text>
													</View>
												</View>
												{open && <Roster members={r.members} />}
											</Pressable>
										);
									})
								: (spirit ?? []).map((r, i) => {
										const mine = r.crew_id === myCrewId;
										const open = expanded === r.crew_id;
										return (
											<Pressable
												key={r.crew_id}
												onPress={() => setExpanded(open ? null : r.crew_id)}
												style={[styles.row, mine && styles.rowMine]}
											>
												<View style={styles.rowTop}>
													<Text style={[styles.rank, i < 3 && styles.rankTop]}>{i + 1}</Text>
													<View style={styles.mid}>
														<Text style={styles.name} numberOfLines={1}>
															{r.name}
															{mine ? " · you" : ""}
														</Text>
														<Text style={styles.sub}>
															{`${r.kindness} kind · ${r.activity} fierce · ${r.memberCount} ${r.memberCount === 1 ? "snout" : "snouts"}`}
														</Text>
													</View>
													<View style={styles.spiritCol}>
														<Text style={styles.spirit}>{r.spirit}</Text>
														<Text style={styles.spiritLabel}>spirit</Text>
													</View>
												</View>
												{open && <Roster members={r.members} />}
											</Pressable>
										);
									})}
						</ScrollView>
					)}
				</SafeAreaView>
			</View>
		</>
	);
}

// Tap-to-expand roster — leader first (payload order).
function Roster({
	members,
}: {
	members: { username: string | null; role: "leader" | "member" }[];
}) {
	return (
		<View style={styles.roster}>
			{members.map((m, j) => (
				<View key={j} style={styles.rosterRow}>
					<Icon
						name={m.role === "leader" ? "crown" : "friends"}
						size={12}
						color={WHIMSY.ink}
					/>
					<Text style={styles.rosterName} numberOfLines={1}>
						{m.username ?? "Pig"}
					</Text>
					{m.role === "leader" && (
						<Text style={styles.rosterLeader}>leader</Text>
					)}
				</View>
			))}
		</View>
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
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 8,
	},
	rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
	boardTabs: {
		flexDirection: "row",
		alignSelf: "center",
		gap: 6,
		marginBottom: 12,
	},
	boardTab: {
		paddingHorizontal: 18,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
	},
	boardTabActive: { backgroundColor: WHIMSY.sun, borderWidth: 2 },
	boardTabText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.mute },
	boardTabTextActive: { color: WHIMSY.ink },
	roster: {
		marginTop: 8,
		paddingTop: 8,
		paddingLeft: 38,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.cream2,
		gap: 5,
	},
	rosterRow: { flexDirection: "row", alignItems: "center", gap: 7 },
	rosterName: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: WHIMSY.ink },
	rosterLeader: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 10,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.accent,
	},
	rowMine: { backgroundColor: WHIMSY.sun, borderWidth: 2.5 },
	rank: { fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.mute, width: 26, textAlign: "center" },
	rankTop: { color: WHIMSY.accent },
	mid: { flex: 1 },
	name: { fontFamily: FONTS.body, fontSize: 15, color: WHIMSY.ink },
	sub: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.mute, marginTop: 1 },
	spiritCol: { alignItems: "center", minWidth: 44 },
	spirit: { fontFamily: FONTS.whimsy, fontSize: 20, color: WHIMSY.ink },
	spiritLabel: {
		fontFamily: FONTS.hand,
		fontSize: 10,
		color: WHIMSY.mute,
		marginTop: -2,
	},
});
