// The Dig-Off — the full field. The season tab's Dig-Off card shows only the top
// rows; this standalone page shows EVERY Sounder in rank order, revealed 25 at a
// time. Two boards ride the same race_standings() payload (no server change):
//   • the SEASON board (cumulative finds — the headline, default);
//   • THIS WEEK's beat (finds per digging snout, sub-quorum crews grayed at the
//     bottom exactly as the tab treats them).
// My own Sounder highlights IN PLACE (rowMine) whenever its row is in the
// revealed slice; a sticky sun card appears above the list ONLY when it isn't —
// paging hasn't reached my rank, or I'm sub-quorum / find-less. Never both, so
// the pin never duplicates the #1 row (pinNeeded in utils/dig.ts owns the rule).
//
// Route/file is technical (race-standings); all player-facing copy says "Dig-Off"
// / "Sounder" / "snout". Feature-dark (RPC unpushed) → useRace reports null → a
// gentle empty state, never a crash.

import { useCallback, useMemo, useState } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	SafeAreaView,
	FlatList,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { PageHeader } from "../components/ui/PageHeader";
import { Sticker } from "../components/ui/Sticker";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { useRace } from "@/hooks/useRace";
import {
	RaceCrewDetail,
	SeasonStandingsRow,
	StandingsRow,
	allSeasonRows,
	allWeeklyRows,
	fetchRaceCrewDetail,
	perSnoutLabel,
	pinNeeded,
} from "@/utils/dig";
import { SeasonRow, CrewLedger, ordinal, seasonRowKey } from "@/components/season1/RaceSection";
import { FONTS, RADII, SHADOW_SM, SPACE, TYPE, WHIMSY, PAGE_PAD, TAB_SAFE } from "@/constants/theme";

// How many rows each "show 25 more" reveal adds — the field paginates client-side
// off the full arrays race_standings() already returns.
const PAGE_SIZE = 25;

type Board = "season" | "weekly";

export default function RaceStandingsScreen() {
	const { state } = useRace(true);
	// My crew id rides in as a route param from the season tab (the authoritative
	// source); the weekly `mine.crew_id` covers deep-links that arrive without it.
	// Never derived by rank-matching — dense ranks tie, and a tie would highlight
	// a stranger's row.
	const params = useLocalSearchParams<{ crew?: string }>();
	const paramCrewId =
		typeof params.crew === "string" && params.crew ? params.crew : null;
	const [board, setBoard] = useState<Board>("season");
	const [pages, setPages] = useState(1);

	// One crew's ledger open at a time; each crew's detail is fetched once and
	// cached ("dark" when the RPC resolves null pre-push) — same as the tab card.
	const [expandedCrew, setExpandedCrew] = useState<string | null>(null);
	const [detailCache, setDetailCache] = useState<
		Record<string, RaceCrewDetail | "dark">
	>({});
	const toggleCrew = useCallback(
		(crewId: string) => {
			const willExpand = expandedCrew !== crewId;
			setExpandedCrew(willExpand ? crewId : null);
			if (willExpand && detailCache[crewId] === undefined) {
				fetchRaceCrewDetail(crewId).then((d) => {
					if (d) {
						setDetailCache((c) => ({ ...c, [crewId]: d }));
					} else {
						setDetailCache((c) => ({ ...c, [crewId]: "dark" }));
						setExpandedCrew((cur) => (cur === crewId ? null : cur));
					}
				});
			}
		},
		[expandedCrew, detailCache]
	);

	// Flip boards → collapse back to the first page (the header shows the new count).
	const switchBoard = useCallback((next: Board) => {
		setBoard(next);
		setPages(1);
		setExpandedCrew(null);
	}, []);

	if (state === undefined) {
		return (
			<Shell>
				<View style={styles.loadingWrap}>
					<LoadingBeat label="reading the race" />
				</View>
			</Shell>
		);
	}
	if (state === null) {
		return (
			<Shell>
				<EmptyState
					glyph="trophy"
					title="the Dig-Off is quiet"
					sub="the race is still waking up"
				/>
			</Shell>
		);
	}

	return (
		<StandingsBody
			state={state}
			paramCrewId={paramCrewId}
			board={board}
			onSwitchBoard={switchBoard}
			pages={pages}
			onShowMore={() => setPages((p) => p + 1)}
			expandedCrew={expandedCrew}
			detailCache={detailCache}
			onToggleCrew={toggleCrew}
		/>
	);
}

// The page chrome — headerless Stack screen, cream bg, back header, tab-safe pad.
function Shell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<View style={styles.bg}>
				<SafeAreaView style={{ flex: 1 }}>
					<PageHeader
						kicker="the dig-off"
						title="The Dig-Off"
						onBack={() => router.back()}
					/>
					{children}
				</SafeAreaView>
			</View>
		</>
	);
}

// The live body — the toggle, the sticky my-Sounder card, and the paginated list.
function StandingsBody({
	state,
	paramCrewId,
	board,
	onSwitchBoard,
	pages,
	onShowMore,
	expandedCrew,
	detailCache,
	onToggleCrew,
}: {
	state: NonNullable<ReturnType<typeof useRace>["state"]>;
	paramCrewId: string | null;
	board: Board;
	onSwitchBoard: (b: Board) => void;
	pages: number;
	onShowMore: () => void;
	expandedCrew: string | null;
	detailCache: Record<string, RaceCrewDetail | "dark">;
	onToggleCrew: (crewId: string) => void;
}) {
	// My crew id: route param first (authoritative), weekly `mine` as fallback.
	const myCrewId = paramCrewId ?? state.mine?.crew_id ?? null;

	// The full field, flat, sliced to what's revealed so far.
	const allRows = useMemo(
		() =>
			board === "season"
				? allSeasonRows(state.season, myCrewId)
				: allWeeklyRows(state, myCrewId),
		[board, state, myCrewId]
	);
	const total = allRows.length;
	const shown = Math.min(pages * PAGE_SIZE, total);
	const visible = allRows.slice(0, shown);
	const hasMore = shown < total;

	// Pin my Sounder above the list ONLY when my row isn't in the revealed slice —
	// otherwise it duplicates the in-place rowMine highlight (the tab's grammar).
	const showPin = pinNeeded(allRows, shown, myCrewId);

	const renderRow = useCallback(
		({ item }: { item: SeasonStandingsRow | StandingsRow }) => {
			const crewId = "crew_id" in item ? item.crew_id : null;
			const expanded = !!crewId && crewId === expandedCrew;
			const onPress = crewId ? () => onToggleCrew(crewId) : undefined;
			return (
				<View>
					{board === "season" ? (
						<SeasonRow row={item as SeasonStandingsRow} onPress={onPress} />
					) : (
						<WeeklyRow row={item as StandingsRow} onPress={onPress} />
					)}
					{expanded && crewId && <CrewLedger entry={detailCache[crewId]} />}
				</View>
			);
		},
		[board, expandedCrew, detailCache, onToggleCrew]
	);

	return (
		<Shell>
			<View style={styles.toggleWrap}>
				<Sticker color="paper" rotate={0} radius={RADII.xxl} style={styles.toggle}>
					<SegmentPill
						label="season"
						active={board === "season"}
						onPress={() => onSwitchBoard("season")}
					/>
					<SegmentPill
						label="this week"
						active={board === "weekly"}
						onPress={() => onSwitchBoard("weekly")}
					/>
				</Sticker>
			</View>

			{showPin && (
				<MySounderCard state={state} board={board} myCrewId={myCrewId} />
			)}

			<FlatList
				data={visible}
				keyExtractor={(item, i) =>
					"crew_id" in item ? item.crew_id || String(i) : String(i)
				}
				renderItem={renderRow}
				contentContainerStyle={styles.listContent}
				showsVerticalScrollIndicator={false}
				ListFooterComponent={
					<View style={styles.footer}>
						{hasMore && (
							<Pressable
								onPress={onShowMore}
								style={({ pressed }) => [
									styles.showMoreBtn,
									pressed && { opacity: 0.7 },
								]}
							>
								<Text style={styles.showMoreText}>show 25 more ›</Text>
							</Pressable>
						)}
						<Text style={styles.countCaption}>
							showing {shown} of {total} sounders
						</Text>
					</View>
				}
			/>
		</Shell>
	);
}

// One toggle pill — sun when selected, paper idle; ink border, matching the
// Leaderboard segment treatment.
function SegmentPill({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	return (
		<Pressable
			onPress={onPress}
			style={[styles.segBtn, active && styles.segBtnActive]}
		>
			<Text style={[styles.segText, active && styles.segTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

// The sticky MY-SOUNDER card — a sun Sticker pinned above the list, so scrolling
// never loses where I stand. Only mounts when my row is out of sight (pinNeeded),
// so the caller has already guaranteed I have a crew — the branches here cover
// ranked (rank · crew · score) vs the warm no-finds / sub-quorum nudges.
function MySounderCard({
	state,
	board,
	myCrewId,
}: {
	state: NonNullable<ReturnType<typeof useRace>["state"]>;
	board: Board;
	myCrewId: string | null;
}) {
	let line: string;
	if (board === "season") {
		const ms = state.mineSeason;
		if (!ms) {
			// A crew with no season find yet — warm nudge, never "join a Sounder".
			line = "no finds yet — dig to take your place";
		} else {
			const name =
				state.season.find((s) => s.crew_id === myCrewId)?.name ??
				"Your Sounder";
			line = `#${ms.rank} · ${name} · ${ms.total_finds} ${
				ms.total_finds === 1 ? "find" : "finds"
			}`;
		}
	} else {
		const mine = state.mine;
		if (!mine) {
			line = "dig this week for Monday's spoils";
		} else if (mine.rank != null) {
			const name =
				state.ranked.find((s) => s.crew_id === mine.crew_id)?.name ??
				"Your Sounder";
			line = `#${mine.rank} · ${name} · ${perSnoutLabel(mine.avg)} per snout`;
		} else {
			line = "spoils need two diggers this week";
		}
	}
	return (
		<View style={styles.myWrap}>
			<Sticker color="sun" rotate={-0.4} radius={RADII.lg} style={styles.myCard}>
				<Text style={styles.myKicker}>★ your Sounder</Text>
				<Text style={styles.myLine} numberOfLines={1}>
					{line}
				</Text>
			</Sticker>
		</View>
	);
}

// A weekly board row — modeled on SeasonRow's layout, scored by per-snout average.
// Sub-quorum (grayed) rows carry no rank ("—") and read in mute colors, exactly
// as the tab treats the bottom of the weekly field.
function WeeklyRow({
	row,
	onPress,
}: {
	row: StandingsRow;
	onPress?: () => void;
}) {
	if (row.kind === "separator") return null;
	const grayed = row.kind === "unranked";
	const rankLabel = row.kind === "ranked" ? `#${row.rank}` : "—";
	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			style={({ pressed }) => [
				styles.row,
				row.highlighted && styles.rowMine,
				pressed && onPress && styles.rowPressed,
			]}
		>
			<Text style={[styles.rowRank, grayed && styles.rowMuteText]}>
				{rankLabel}
			</Text>
			<View style={styles.rowMid}>
				<Text
					style={[styles.rowName, grayed && styles.rowMuteText]}
					numberOfLines={1}
				>
					{row.name}
				</Text>
				{row.diggers > 0 && (
					<Text style={styles.rowSub}>
						{row.diggers} {row.diggers === 1 ? "digger" : "diggers"}
					</Text>
				)}
			</View>
			<View style={styles.rowScoreCol}>
				<Text style={[styles.rowScoreNum, grayed && styles.rowMuteText]}>
					{perSnoutLabel(row.avg)}
				</Text>
				<Text style={styles.rowScoreCap}>per snout</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	loadingWrap: { marginTop: SPACE.xl, alignItems: "center" },
	// The two-segment board toggle — a single paper Sticker holding two compact
	// pills, matching the Leaderboard's segmented treatment (sun active fill, ink
	// border only on the active pill). One shared visual language, not a new one.
	toggleWrap: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.md },
	toggle: { flexDirection: "row", padding: SPACE.xs, gap: SPACE.xs },
	segBtn: {
		flex: 1,
		paddingVertical: SPACE.sm,
		borderRadius: RADII.xl,
		alignItems: "center",
	},
	segBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	segText: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	segTextActive: { fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	// The sticky my-Sounder card — above the FlatList, never scrolls away.
	myWrap: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.md },
	myCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: 2,
		...SHADOW_SM,
	},
	myKicker: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.accent },
	myLine: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	// The list.
	listContent: { paddingHorizontal: PAGE_PAD, paddingBottom: TAB_SAFE },
	// Rows — same grammar as the tab's SeasonRow.
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xs + 1,
		borderRadius: RADII.sm,
	},
	rowMine: {
		backgroundColor: WHIMSY.sun,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	rowPressed: { opacity: 0.6 },
	rowRank: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
		width: 34,
	},
	rowMid: { flex: 1, minWidth: 0 },
	rowName: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	rowSub: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	rowMuteText: { color: WHIMSY.mute },
	// Per-snout score column — big whimsy number over a tiny caption.
	rowScoreCol: { alignItems: "flex-end", minWidth: 52 },
	rowScoreNum: { fontFamily: FONTS.whimsy, fontSize: 22, color: WHIMSY.ink },
	rowScoreCap: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 9,
		letterSpacing: 0.8,
		textTransform: "uppercase",
		color: WHIMSY.mute,
		marginTop: -2,
	},
	// The reveal footer + running count.
	footer: { alignItems: "center", gap: SPACE.sm, paddingTop: SPACE.md },
	showMoreBtn: {
		paddingHorizontal: SPACE.xl,
		paddingVertical: SPACE.sm + 2,
		borderRadius: 999,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		...SHADOW_SM,
	},
	showMoreText: { fontFamily: FONTS.bodyExtra, fontSize: 13, color: WHIMSY.ink },
	countCaption: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
});
