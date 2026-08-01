// The Dig-Off — the full field. The season tab's Dig-Off card shows only the top
// rows; this standalone page shows EVERY Sounder in rank order, revealed 25 at a
// time. Three lenses share the same row grammar:
//   • THIS WEEK (the default, ranked by overall finds);
//   • PAST WEEKS (lazy-loaded settled tables, newest first);
//   • SEASON (cumulative finds across the whole season).
// My own Sounder highlights IN PLACE (rowMine) whenever its row is in the
// revealed slice; a sticky sun card appears above the list ONLY when it isn't —
// paging hasn't reached my rank, or I'm find-less. Never both, so
// the pin never duplicates the #1 row (pinNeeded in utils/race.ts owns the rule).
//
// Route/file is technical (race-standings); all player-facing copy says "Dig-Off"
// / "Sounder" / "snout". Feature-dark (RPC unpushed) → useRace reports null → a
// gentle empty state, never a crash.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
	View,
	Text,
	Pressable,
	StyleSheet,
	SafeAreaView,
	FlatList,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Sticker } from "../components/ui/Sticker";
import { EmptyState, LoadingBeat } from "../components/ui/EmptyState";
import { useRace } from "@/hooks/useRace";
import {
	RaceCrewDetail,
	RaceHistoryWeek,
	SeasonStandingsRow,
	StandingsRow,
	allSeasonRows,
	allWeeklyRows,
	fetchRaceCrewDetail,
	fetchRaceHistory,
	perSnoutLabel,
	pinNeeded,
} from "@/utils/race";
import { CrewLedger, SpoilsStrip } from "@/components/season1/RaceSection";
import {
	FONTS,
	RADII,
	SHADOW_SM,
	STICKER_SHADOW,
	SPACE,
	TYPE,
	WHIMSY,
	PAGE_PAD,
	TAB_SAFE,
} from "@/constants/theme";

// How many rows each "show 25 more" reveal adds — the field paginates client-side
// off the full arrays race_standings() already returns.
const PAGE_SIZE = 25;

type Board = "weekly" | "season" | "history";
type Metric = "perSnout" | "total";

export default function RaceStandingsScreen() {
	const { state } = useRace(true);
	// My crew id rides in as a route param from the season tab (the authoritative
	// source); the weekly `mine.crew_id` covers deep-links that arrive without it.
	// Never derived by rank-matching — dense ranks tie, and a tie would highlight
	// a stranger's row.
	const params = useLocalSearchParams<{ crew?: string; board?: string }>();
	const paramCrewId =
		typeof params.crew === "string" && params.crew ? params.crew : null;
	// The Dig-Off is a weekly race first. The cumulative season board is the
	// longer lens, not the landing state — but the season-tab links carry a
	// `board` param so "see the full season ›" lands on the season lens directly.
	const initialBoard: Board =
		params.board === "season" || params.board === "history"
			? params.board
			: "weekly";
	const [board, setBoard] = useState<Board>(initialBoard);
	const [pages, setPages] = useState(1);
	const [history, setHistory] = useState<RaceHistoryWeek[] | null | undefined>(
		undefined,
	);
	const [historyIndex, setHistoryIndex] = useState(0);

	// History is deliberately lazy: the season-tab preview and live/season boards
	// never pay to reconstruct past tables. `null` is the pre-push dark fallback.
	useEffect(() => {
		if (board !== "history" || history !== undefined) return;
		fetchRaceHistory().then(setHistory);
	}, [board, history]);

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
		[expandedCrew, detailCache],
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
			history={history}
			historyIndex={historyIndex}
			onHistoryIndex={(index) => {
				setHistoryIndex(index);
				setPages(1);
				setExpandedCrew(null);
			}}
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
					<DigOffHeader />
					{children}
				</SafeAreaView>
			</View>
		</>
	);
}

function DigOffHeader() {
	return (
		<View style={styles.header}>
			<Pressable
				onPress={() => router.back()}
				hitSlop={12}
				accessibilityRole="button"
				accessibilityLabel="Go back"
				style={styles.backBtn}
			>
				<Text style={styles.backText}>‹ back</Text>
			</Pressable>
			<Text style={styles.headerKicker}>★ the dig-off ★</Text>
			<View style={styles.hangers} pointerEvents="none">
				<View style={styles.hanger} />
				<View style={styles.hanger} />
			</View>
			<Sticker color="sun" rotate={-1} radius={RADII.md} border={3} style={styles.titlePlaque}>
				<Text style={styles.titleText}>The Dig-Off</Text>
				<Text style={styles.titleSub}>sounders, one board</Text>
			</Sticker>
		</View>
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
	history,
	historyIndex,
	onHistoryIndex,
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
	history: RaceHistoryWeek[] | null | undefined;
	historyIndex: number;
	onHistoryIndex: (index: number) => void;
	expandedCrew: string | null;
	detailCache: Record<string, RaceCrewDetail | "dark">;
	onToggleCrew: (crewId: string) => void;
}) {
	// My crew id: route param first (authoritative), weekly `mine` as fallback.
	const myCrewId = paramCrewId ?? state.mine?.crew_id ?? null;
	const historyWeek = history?.[historyIndex] ?? null;
	// Each lens remembers its own useful default: fairness while the race is live,
	// tangible herd totals once a week (or season) becomes history.
	const [metrics, setMetrics] = useState<Record<Board, Metric>>({
		weekly: "total",
		history: "total",
		season: "total",
	});
	const metric = metrics[board];
	const setMetric = useCallback(
		(next: Metric) => setMetrics((current) => ({ ...current, [board]: next })),
		[board],
	);

	// The full field, flat, sliced to what's revealed so far.
	const allRows = useMemo(() => {
		if (board === "season") return allSeasonRows(state.season, myCrewId);
		if (board === "history") {
			if (!historyWeek) return [];
			return allWeeklyRows(
				{
					...state,
					ranked: historyWeek.ranked,
					unranked: historyWeek.unranked,
				},
				myCrewId,
			);
		}
		return allWeeklyRows(state, myCrewId);
	}, [board, state, historyWeek, myCrewId]);
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
			// race_crew_detail is live/season-aware, not a historical ledger. Past
			// rows therefore stay honest and non-expandable.
			const onPress =
				crewId && board !== "history" ? () => onToggleCrew(crewId) : undefined;
			return (
				<View>
					<ScoreRow row={item} onPress={onPress} metric={metric} />
					{expanded && crewId && <CrewLedger entry={detailCache[crewId]} />}
				</View>
			);
		},
		[board, metric, expandedCrew, detailCache, onToggleCrew],
	);

	return (
		<Shell>
			<View style={styles.toggleWrap}>
				<Sticker
					color="paper"
					rotate={0.4}
					radius={RADII.xl}
					border={3}
					style={styles.filterCard}
				>
					<View style={styles.periodToggle} accessibilityRole="tablist">
						<SegmentPill
							label="this week"
							active={board === "weekly"}
							onPress={() => onSwitchBoard("weekly")}
						/>
						<SegmentPill
							label="past weeks"
							active={board === "history"}
							onPress={() => onSwitchBoard("history")}
						/>
						<SegmentPill
							label="season"
							active={board === "season"}
							onPress={() => onSwitchBoard("season")}
						/>
					</View>
					<Text style={styles.boardCaption}>
						{board === "season"
							? "every find this season"
							: board === "history"
								? "the race resets each Monday"
								: "this race settles Monday"}
					</Text>
				</Sticker>
			</View>

			{board === "history" && (
				<HistoryPicker
					history={history}
					index={historyIndex}
					onChange={onHistoryIndex}
				/>
			)}

			{showPin && (board !== "history" || historyWeek) && (
				<MySounderCard
					state={state}
					board={board}
					myCrewId={myCrewId}
					historyWeek={historyWeek}
					metric={metric}
				/>
			)}

			{board === "weekly" && <SpoilsStrip prizes={state.prizes} compact />}

			<View style={styles.boardCard}>
				<View style={styles.metricHeader}>
					<Text style={styles.countingLabel}>counting ›</Text>
					<MetricToggle value={metric} onChange={setMetric} compact />
				</View>
				{((board === "history" && metric === "perSnout") ||
					(board === "season" && metric === "perSnout")) && (
					<Text style={styles.rankingNote}>
						{board === "season"
							? "season rank still follows overall finds"
							: "final rank follows overall finds"}
					</Text>
				)}
				<FlatList
					data={visible}
					keyExtractor={(item, i) =>
						"crew_id" in item ? item.crew_id || String(i) : String(i)
					}
					renderItem={renderRow}
					contentContainerStyle={styles.listContent}
					showsVerticalScrollIndicator={false}
					ListEmptyComponent={
						board === "history" && history !== undefined ? (
							<View style={styles.historyEmpty}>
								<EmptyState
									glyph="trophy"
									title={
										history === null
											? "the archive is waking up"
											: "no past races yet"
									}
									sub={
										history === null
											? "try again after the next update"
											: "the first table settles Monday"
									}
								/>
							</View>
						) : null
					}
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
							{total > 0 && (
								<Text style={styles.countCaption}>
									showing {shown} of {total} sounders
								</Text>
							)}
						</View>
					}
				/>
			</View>
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
			accessibilityRole="tab"
			accessibilityState={{ selected: active }}
			style={[styles.segBtn, active && styles.segBtnActive]}
		>
			<Text style={[styles.segText, active && styles.segTextActive]}>
				{label}
			</Text>
		</Pressable>
	);
}

function MetricToggle({
	value,
	onChange,
	compact = false,
}: {
	value: Metric;
	onChange: (metric: Metric) => void;
	compact?: boolean;
}) {
	return (
		<View
			style={[styles.metricToggle, compact && styles.metricToggleCompact]}
			accessibilityRole="radiogroup"
		>
			<Pressable
				onPress={() => onChange("perSnout")}
				accessibilityRole="radio"
				accessibilityState={{ checked: value === "perSnout" }}
				style={[
					styles.metricBtn,
					compact && styles.metricBtnCompact,
					value === "perSnout" && styles.metricBtnActive,
				]}
			>
				<Text
					style={[
						styles.metricText,
						value === "perSnout" && styles.metricTextActive,
					]}
				>
					per snout
				</Text>
			</Pressable>
			<Pressable
				onPress={() => onChange("total")}
				accessibilityRole="radio"
				accessibilityState={{ checked: value === "total" }}
				style={[
					styles.metricBtn,
					compact && styles.metricBtnCompact,
					value === "total" && styles.metricBtnActive,
				]}
			>
				<Text
					style={[
						styles.metricText,
						value === "total" && styles.metricTextActive,
					]}
				>
					overall
				</Text>
			</Pressable>
		</View>
	);
}

function weekLabel(week: RaceHistoryWeek): string {
	const start = new Date(week.cycle.starts_at);
	const end = new Date(new Date(week.cycle.ends_at).getTime() - 86_400_000);
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
		return "settled week";
	}
	const startMonth = start.toLocaleDateString("en-US", {
		month: "short",
		timeZone: "UTC",
	});
	const endMonth = end.toLocaleDateString("en-US", {
		month: "short",
		timeZone: "UTC",
	});
	const startDay = start.getUTCDate();
	const endDay = end.getUTCDate();
	return startMonth === endMonth
		? `${startMonth} ${startDay}–${endDay}`
		: `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

function HistoryPicker({
	history,
	index,
	onChange,
}: {
	history: RaceHistoryWeek[] | null | undefined;
	index: number;
	onChange: (index: number) => void;
}) {
	if (history === undefined) {
		return (
			<View style={styles.historyLoading}>
				<LoadingBeat label="opening the archive" />
			</View>
		);
	}
	if (!history?.length) return null;
	const week = history[index] ?? history[0];
	const canGoNewer = index > 0;
	const canGoOlder = index < history.length - 1;
	return (
		<View style={styles.historyPickerWrap}>
			<Pressable
				onPress={() => onChange(index + 1)}
				disabled={!canGoOlder}
				accessibilityRole="button"
				accessibilityLabel="Show an older Dig-Off week"
				style={({ pressed }) => [
					styles.weekArrow,
					!canGoOlder && styles.weekArrowDisabled,
					pressed && canGoOlder && styles.rowPressed,
				]}
			>
				<Text style={styles.weekArrowText}>‹ older</Text>
			</Pressable>
			<View style={styles.weekTitleWrap}>
				<Text style={styles.weekTitle}>
					{index === 0 ? "last week" : weekLabel(week)}
				</Text>
				{index === 0 && <Text style={styles.weekDates}>{weekLabel(week)}</Text>}
			</View>
			<Pressable
				onPress={() => onChange(index - 1)}
				disabled={!canGoNewer}
				accessibilityRole="button"
				accessibilityLabel="Show a newer Dig-Off week"
				style={({ pressed }) => [
					styles.weekArrow,
					!canGoNewer && styles.weekArrowDisabled,
					pressed && canGoNewer && styles.rowPressed,
				]}
			>
				<Text style={styles.weekArrowText}>newer ›</Text>
			</Pressable>
		</View>
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
	historyWeek,
	metric,
}: {
	state: NonNullable<ReturnType<typeof useRace>["state"]>;
	board: Board;
	myCrewId: string | null;
	historyWeek: RaceHistoryWeek | null;
	metric: Metric;
}) {
	let line: string;
	if (board === "season") {
		const ms = state.mineSeason;
		if (!ms) {
			// A crew with no season find yet — warm nudge, never "join a Sounder".
			line = "no finds yet — dig to take your place";
		} else {
			const mine = state.season.find((s) => s.crew_id === myCrewId);
			const name = mine?.name ?? "Your Sounder";
			line =
				metric === "perSnout"
					? `#${ms.rank} · ${name} · ${perSnoutLabel(
							ms.total_finds / Math.max(1, mine?.diggers ?? 0),
						)} per snout`
					: `#${ms.rank} · ${name} · ${ms.total_finds} ${
							ms.total_finds === 1 ? "find" : "finds"
						}`;
		}
	} else if (board === "weekly") {
		const mine = state.mine;
		if (!mine) {
			line = "dig this week for Monday's spoils";
		} else if (mine.rank != null) {
			const name =
				state.ranked.find((s) => s.crew_id === mine.crew_id)?.name ??
				"Your Sounder";
			line =
				metric === "total"
					? `#${mine.rank} · ${name} · ${mine.total_finds} ${
							mine.total_finds === 1 ? "find" : "finds"
						}`
					: `#${mine.rank} · ${name} · ${perSnoutLabel(mine.avg)} per snout`;
		} else {
			line = "dig this week for Monday's spoils";
		}
	} else {
		const ranked = historyWeek?.ranked.find((row) => row.crew_id === myCrewId);
		const unranked = historyWeek?.unranked.find(
			(row) => row.crew_id === myCrewId,
		);
		if (ranked) {
			line =
				metric === "perSnout"
					? `#${ranked.rank} · ${ranked.name} · ${perSnoutLabel(
							ranked.avg,
						)} per snout`
					: `#${ranked.rank} · ${ranked.name} · ${ranked.total_finds} ${
							ranked.total_finds === 1 ? "find" : "finds"
						}`;
		} else if (unranked) {
			line =
				metric === "perSnout"
					? `${unranked.name} · ${perSnoutLabel(unranked.avg)} per snout`
					: `${unranked.name} · ${unranked.total_finds} ${
							unranked.total_finds === 1 ? "find" : "finds"
						}`;
		} else {
			line = "no finds recorded for this week";
		}
	}
	return (
		<View style={styles.myWrap}>
			<Sticker
				color="sun"
				rotate={-0.4}
				radius={RADII.lg}
				style={styles.myCard}
			>
				<Text style={styles.myKicker}>★ your Sounder</Text>
				<Text style={styles.myLine} numberOfLines={1}>
					{line}
				</Text>
			</Sticker>
		</View>
	);
}

// A board row — overall finds are the official weekly score; per-snout remains
// available as a secondary comparison lens. Legacy unranked rows stay defensive.
function ScoreRow({
	row,
	onPress,
	metric = "perSnout",
}: {
	row: StandingsRow | SeasonStandingsRow;
	onPress?: () => void;
	metric?: "perSnout" | "total";
}) {
	if (row.kind === "separator") return null;
	const grayed = row.kind === "unranked";
	const rankLabel = row.kind === "ranked" ? `#${row.rank}` : "—";
	const rankNumber = row.kind === "ranked" ? row.rank : null;
	const badgeColor =
		rankNumber === 1
			? WHIMSY.sun
			: rankNumber === 2
				? WHIMSY.rose
				: rankNumber === 3
					? WHIMSY.sky
					: WHIMSY.paper;
	const badgeTilt = rankNumber != null && rankNumber <= 3
		? rankNumber % 2 === 0
			? "3deg"
			: "-3deg"
		: "0deg";
	const perSnout =
		"avg" in row
			? row.avg
			: row.total_finds / Math.max(1, row.diggers);
	const score =
		metric === "total" ? String(row.total_finds) : perSnoutLabel(perSnout);
	const scoreCaption =
		metric === "total"
			? row.total_finds === 1
				? "find"
				: "finds"
			: "per snout";
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
			<View
				style={[
					styles.rankBadge,
					{ backgroundColor: badgeColor, transform: [{ rotate: badgeTilt }] },
					grayed && styles.rankBadgeMuted,
				]}
			>
				<Text style={[styles.rowRank, grayed && styles.rowMuteText]}>
					{rankLabel}
				</Text>
			</View>
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
					{score}
				</Text>
				<Text style={styles.rowScoreCap}>{scoreCaption}</Text>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	bg: { flex: 1, backgroundColor: WHIMSY.cream },
	loadingWrap: { marginTop: SPACE.xl, alignItems: "center" },
	header: {
		paddingHorizontal: 20,
		paddingTop: SPACE.sm,
		paddingBottom: SPACE.md,
	},
	backBtn: { alignSelf: "flex-start", minHeight: 30, justifyContent: "center" },
	backText: { fontFamily: FONTS.hand, fontSize: 15, color: WHIMSY.mute },
	headerKicker: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		letterSpacing: 2.5,
		textTransform: "uppercase",
		textAlign: "center",
		color: WHIMSY.mute,
		marginTop: -2,
	},
	hangers: {
		height: 16,
		marginHorizontal: 92,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	hanger: { width: 2.5, height: 16, backgroundColor: WHIMSY.ink, opacity: 0.7 },
	titlePlaque: {
		alignSelf: "center",
		width: 258,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
		alignItems: "center",
		...SHADOW_SM,
	},
	titleText: { fontFamily: FONTS.whimsy, fontSize: 26, lineHeight: 28, color: WHIMSY.ink },
	titleSub: { fontFamily: FONTS.hand, fontSize: 13, color: WHIMSY.mute },
	// The reference groups period selection into one slightly tilted paper card.
	toggleWrap: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.md,
	},
	filterCard: { padding: 11 },
	periodToggle: {
		flexDirection: "row",
		padding: 3,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream,
	},
	segBtn: {
		flex: 1,
		minHeight: 38,
		paddingHorizontal: 2,
		borderRadius: RADII.pill,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2.5,
		borderColor: "transparent",
	},
	segBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	segText: { fontFamily: FONTS.display, fontSize: 13, color: WHIMSY.mute },
	segTextActive: { color: WHIMSY.ink },
	boardCaption: {
		fontFamily: FONTS.hand,
		fontSize: 14,
		lineHeight: 18,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	// The metric selector lives on the leaderboard itself, matching the HTML.
	boardCard: {
		flex: 1,
		marginHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		backgroundColor: WHIMSY.cream2,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.lg,
		...STICKER_SHADOW,
		overflow: "hidden",
	},
	metricHeader: {
		minHeight: 52,
		paddingHorizontal: 14,
		paddingVertical: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(42,31,21,0.22)",
	},
	countingLabel: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.mute },
	metricToggle: {
		flexDirection: "row",
		padding: 2,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.pill,
		backgroundColor: WHIMSY.cream,
	},
	metricToggleCompact: { flexShrink: 1 },
	metricBtn: {
		minWidth: 104,
		minHeight: 44,
		paddingHorizontal: SPACE.md,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
		borderWidth: 2,
		borderColor: "transparent",
	},
	metricBtnCompact: { minWidth: 0, minHeight: 30, paddingHorizontal: SPACE.md },
	metricBtnActive: {
		backgroundColor: WHIMSY.sun,
		borderColor: WHIMSY.ink,
		...SHADOW_SM,
	},
	metricText: { ...TYPE.bodySm, fontFamily: FONTS.bodyExtra, color: WHIMSY.mute },
	metricTextActive: { color: WHIMSY.ink },
	rankingNote: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.accent,
		textAlign: "center",
		paddingHorizontal: 14,
		paddingTop: SPACE.xs,
	},
	// Past weeks use one compact time control, then the same honest standings
	// rows as the live race. Arrow targets stay at the iOS 44pt minimum.
	historyLoading: { paddingVertical: SPACE.md, alignItems: "center" },
	historyPickerWrap: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	weekArrow: {
		minWidth: 72,
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
	},
	weekArrowDisabled: { opacity: 0.28 },
	weekArrowText: {
		...TYPE.bodySm,
		fontFamily: FONTS.bodyExtra,
		color: WHIMSY.accent,
	},
	weekTitleWrap: { flex: 1, alignItems: "center" },
	weekTitle: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	weekDates: { ...TYPE.hand, fontFamily: FONTS.hand, color: WHIMSY.mute },
	historyEmpty: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.md },
	// The sticky my-Sounder card — above the FlatList, never scrolls away.
	myWrap: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.sm },
	myCard: {
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.md,
		gap: 2,
		...SHADOW_SM,
	},
	myKicker: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.accent },
	myLine: { ...TYPE.cardTitle, fontFamily: FONTS.whimsy, color: WHIMSY.ink },
	// The board rows use circular rank stamps and low-contrast ledger dividers.
	listContent: { paddingHorizontal: 14, paddingBottom: TAB_SAFE },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		paddingVertical: 11,
		borderBottomWidth: 2,
		borderBottomColor: "rgba(42,31,21,0.22)",
	},
	rowMine: {
		backgroundColor: WHIMSY.sun,
		borderRadius: RADII.sm,
		paddingHorizontal: SPACE.sm,
		marginHorizontal: -SPACE.sm,
	},
	rowPressed: { opacity: 0.6 },
	rankBadge: {
		width: 36,
		height: 36,
		flexShrink: 0,
		borderRadius: 18,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	rankBadgeMuted: { opacity: 0.55 },
	rowRank: {
		fontFamily: FONTS.display,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	rowMid: { flex: 1, minWidth: 0 },
	rowName: { fontFamily: FONTS.display, fontSize: 16.5, lineHeight: 19, color: WHIMSY.ink },
	rowSub: { fontFamily: FONTS.hand, fontSize: 12.5, color: WHIMSY.mute },
	rowMuteText: { color: WHIMSY.mute },
	rowScoreCol: { alignItems: "flex-end", minWidth: 52 },
	rowScoreNum: { fontFamily: FONTS.whimsy, fontSize: 22, lineHeight: 24, color: WHIMSY.ink },
	rowScoreCap: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
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
	showMoreText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.ink,
	},
	countCaption: {
		...TYPE.kicker,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
	},
});
