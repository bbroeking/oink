// Sounder League — the season table, ranked by PRIZE RIBBONS (the crew Elo
// rebased to a trophy scale: start 200, floor 0, K 40→24 by rope margin) via
// sounder_league_standings(), with the SPIRIT board (7-day war activity +
// intra-crew kindness, per snout) as the second tab. W–L is the record
// subline; no fixture ends in a draw.
//
// Headerless on purpose: the Friends hub's Board segment renders this INSIDE
// its own page header (the "standings move into the hub" decision, Your Sounder
// redesign), while app/clan-ladder.tsx is the thin route wrapper that keeps the
// old deep links alive (season-tab placard, mud-war spoils). Either host gives
// this flex:1 and it scrolls itself.
// Spec: docs/sounder-league-spec.md.

import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
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
import { Glyph } from "@/components/ui/Glyph";
import { LoadingBeat } from "@/components/ui/EmptyState";
import { FONTS, PAGE_PAD, RADII, SHADOW_SM, SPACE, TAB_SAFE, TYPE, WHIMSY } from "@/constants/theme";

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

export function SounderLeague() {
	// myCrewId only lights the "you" row — a lightweight read that stays local
	// so this component drops into any host without threading a crewHook down.
	const { crew } = useCrew();
	const myCrewId = crew.crew?.id ?? null;
	const [league, setLeague] = useState<LeagueEntry[] | null>(null);
	const [spirit, setSpirit] = useState<SpiritEntry[] | null>(null);
	// Two boards: the season Table (fixture record — the ranked one) and Spirit
	// (kindest + most active per snout, still celebrated second).
	const [board, setBoard] = useState<"table" | "spirit">("table");
	// Tap a row to expand its roster.
	const [expanded, setExpanded] = useState<string | null>(null);

	const load = useCallback(async () => {
		const [liveLeague, liveSpirit] = await Promise.all([
			fetchLeagueStandings(50),
			fetchSounderStandings(50),
		]);
		// DEV ONLY: pad a sparse board with mock Sounders so the standings design
		// can be judged with real-looking data. Never ships: gated on __DEV__, and
		// live rows always outrank the mocks' insertion.
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
	}, []);
	// Refetch on focus so a transient load failure self-heals (no error sentinel yet).
	useFocusEffect(
		useCallback(() => {
			load();
		}, [load])
	);

	const rows = board === "table" ? league : spirit;

	if (rows === null) {
		return (
			<View style={styles.center}>
				<LoadingBeat glyph="trophy" label="reading the standings" />
			</View>
		);
	}
	if (rows.length === 0) {
		return (
			<View style={styles.center}>
				<Text style={styles.emptyTitle}>No Sounders on the board yet</Text>
				<Text style={styles.emptyBody}>
					Every term the league hands your Sounder a rival. Answer the fixture —
					sling mud, dig truffles — and the table remembers.
				</Text>
			</View>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.content}>
			{/* Board switch — compact glyph chips, deliberately quieter than the
			    host's scope toggle so they read as a filter on this list, not a
			    second nav bar. "Ribbons" is the ranked thing itself (the old
			    "Table" label was league jargon nobody parses). */}
			<View style={styles.boardTabs}>
				{(
					[
						{ key: "table", label: "Ribbons", glyph: "trophy" },
						{ key: "spirit", label: "Spirit", glyph: "heart" },
					] as const
				).map((b) => (
					<Pressable
						key={b.key}
						onPress={() => setBoard(b.key)}
						accessibilityRole="button"
						accessibilityState={{ selected: board === b.key }}
						style={[styles.boardTab, board === b.key && styles.boardTabActive]}
					>
						<Glyph name={b.glyph} size={14} />
						<Text style={styles.boardTabText}>{b.label}</Text>
					</Pressable>
				))}
			</View>
			<Text style={styles.lead}>
				{board === "table"
					? "Ranked by Prize Ribbons — beat a stronger Sounder, win more ribbons. Each term the league pairs you with a rival, and no scuffle ends in a draw."
					: "Ranked by Spirit — this week's scuffle effort plus the kindness crewmates show each other, counted per snout."}
			</Text>
			{board === "table"
				? (league ?? []).map((r, i) => (
						<LeagueRow
							key={r.crew_id}
							rank={i + 1}
							mine={r.crew_id === myCrewId}
							name={r.name}
							meta={`${r.wins}–${r.losses} · ${r.played} ${r.played === 1 ? "fixture" : "fixtures"} · mud ${r.diff > 0 ? "+" : ""}${r.diff}${r.provisional ? " · new banner" : ""}`}
							score={r.ribbons}
							scoreLabel="ribbons"
							members={r.members}
							open={expanded === r.crew_id}
							onToggle={() => setExpanded(expanded === r.crew_id ? null : r.crew_id)}
						/>
					))
				: (spirit ?? []).map((r, i) => (
						<LeagueRow
							key={r.crew_id}
							rank={i + 1}
							mine={r.crew_id === myCrewId}
							name={r.name}
							meta={`${r.kindness} kind · ${r.activity} fierce · ${r.memberCount} ${r.memberCount === 1 ? "snout" : "snouts"}`}
							score={r.spirit}
							scoreLabel="spirit"
							members={r.members}
							open={expanded === r.crew_id}
							onToggle={() => setExpanded(expanded === r.crew_id ? null : r.crew_id)}
						/>
					))}
		</ScrollView>
	);
}

// One sticker row — rank numeral · name/meta · score/label — tap to expand the
// roster. The mock's "you" row wears sun; every other row is paper. Top-3 ranks
// glow accent, but the you-row rank always stays mute (per the mock).
function LeagueRow({
	rank,
	mine,
	name,
	meta,
	score,
	scoreLabel,
	members,
	open,
	onToggle,
}: {
	rank: number;
	mine: boolean;
	name: string;
	meta: string;
	score: number;
	scoreLabel: string;
	members: { username: string | null; role: "leader" | "member" }[];
	open: boolean;
	onToggle: () => void;
}) {
	const rankTop = !mine && rank <= 3;
	return (
		<Pressable onPress={onToggle} style={[styles.row, mine && styles.rowMine]}>
			<View style={styles.rowTop}>
				<Text style={[styles.rank, rankTop && styles.rankTop]}>{rank}</Text>
				<View style={styles.mid}>
					<Text style={styles.name} numberOfLines={1}>
						{name}
						{mine ? " · you" : ""}
					</Text>
					<Text style={styles.meta} numberOfLines={1}>
						{meta}
					</Text>
				</View>
				<View style={styles.scoreCol}>
					<Text style={styles.score}>{score}</Text>
					<Text style={styles.scoreLabel}>{scoreLabel}</Text>
				</View>
			</View>
			{open && <Roster members={members} />}
		</Pressable>
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
					{m.role === "leader" && <Text style={styles.rosterLeader}>leader</Text>}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: SPACE.sm },
	content: { padding: PAGE_PAD, paddingBottom: TAB_SAFE },
	// Board chips — glyph + label, a size down from the host's scope toggle
	// (filter weight, not nav weight). 2px border, no shadow on the idle chip.
	boardTabs: { flexDirection: "row", gap: SPACE.sm, marginBottom: SPACE.md },
	boardTab: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs + 1,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.muteSoft,
		backgroundColor: WHIMSY.paper,
		paddingHorizontal: SPACE.md + 2,
		paddingVertical: SPACE.xs + 2,
	},
	boardTabActive: {
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	boardTabText: { ...TYPE.bodySm, fontFamily: FONTS.display, color: WHIMSY.ink },
	lead: { ...TYPE.bodySm, color: WHIMSY.mute, marginBottom: SPACE.md },
	emptyTitle: { ...TYPE.sectionTitle, color: WHIMSY.ink, textAlign: "center" },
	emptyBody: { ...TYPE.body, fontSize: 14, color: WHIMSY.mute, textAlign: "center", marginTop: SPACE.xs },
	// Sticker row — 2.5 ink border, the SHADOW_SM tier (the two-tier rule keeps us
	// off a bespoke 3px shadow; visually indistinguishable at row scale).
	row: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md + 2,
		marginBottom: SPACE.md + 2,
		...SHADOW_SM,
	},
	rowMine: { backgroundColor: WHIMSY.sun },
	rowTop: { flexDirection: "row", alignItems: "center", gap: SPACE.md + 2 },
	// Design-locked sizes from the Your Sounder mock (no exact TYPE role): rank
	// whimsy 22, name display 17, meta 12.5, score whimsy 24, label 10.5.
	rank: { ...TYPE.sectionTitle, color: WHIMSY.mute, width: 20, textAlign: "center" },
	rankTop: { color: WHIMSY.accent },
	mid: { flex: 1, minWidth: 0 },
	name: { ...TYPE.body, fontFamily: FONTS.display, fontSize: 17, lineHeight: 22, color: WHIMSY.ink },
	meta: { ...TYPE.bodySm, fontSize: 12.5, color: WHIMSY.mute, marginTop: 1 },
	scoreCol: { alignItems: "flex-end", minWidth: 44 },
	score: { fontFamily: FONTS.whimsy, fontSize: 24, lineHeight: 26, color: WHIMSY.ink },
	scoreLabel: {
		...TYPE.label,
		fontSize: 10.5,
		letterSpacing: 1,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginTop: 2,
	},
	roster: {
		marginTop: SPACE.sm,
		paddingTop: SPACE.sm,
		paddingLeft: 38,
		borderTopWidth: 1.5,
		borderTopColor: WHIMSY.cream2,
		gap: 5,
	},
	rosterRow: { flexDirection: "row", alignItems: "center", gap: 7 },
	rosterName: { flex: 1, ...TYPE.bodySm, color: WHIMSY.ink },
	rosterLeader: {
		...TYPE.label,
		fontSize: 10,
		letterSpacing: 1.2,
		textTransform: "uppercase",
		color: WHIMSY.accent,
	},
});
