// The Dig-Off — the full field. The season tab's Dig-Off card shows only the top
// rows; this standalone page shows EVERY Sounder in rank order, revealed 25 at a
// time. Three lenses share the same row grammar:
//   • THIS WEEK (the default, ranked by overall finds);
//   • PAST WEEKS (lazy-loaded settled tables, newest first);
//   • SEASON (cumulative finds across the whole season).
// My own Sounder highlights IN PLACE (a selected ListRow) whenever its row is in
// the revealed slice; a sticky sun row appears above the list ONLY when it isn't —
// paging hasn't reached my rank, or I'm find-less. Never both, so
// the pin never duplicates the #1 row (pinNeeded in utils/race.ts owns the rule).
//
// Route/file is technical (race-standings); all player-facing copy says "Dig-Off"
// / "Sounder" / "snout". Feature-dark (RPC unpushed) → useRace reports null → an
// error state with a retry, never a crash.
//
// Wave 3 · section C (2026-09-11): the hand-rolled crown became
// `PageHeader variant="plaque"` — the variant that was built FROM it [C-10]; the
// two hand-rolled segments (`SegmentPill` + `MetricToggle`, which announced the
// same gesture as a tablist and as a radiogroup on one screen) became one
// `SegmentedControl` [C-05]; every board row became a `ListRow` with a rank stamp
// leading and the score trailing [C-16]; the 0.28-opacity week arrows and the
// dissolve-pressed rows became `Button` + the `PRESSED` token [C-01, C-07].

import { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
	Button,
	CardTitle,
	EmptyState,
	Hand,
	Kicker,
	ListRow,
	LoadingBeat,
	PageHeader,
	SegmentedControl,
	Sticker,
	T,
	StackPage,
} from "@/components/ui";
import { useCrewLedger, useRace } from "@/hooks/useRace";
import {
	RaceCrewDetail,
	RaceHistoryWeek,
	SeasonStandingsRow,
	StandingsRow,
	allSeasonRows,
	allWeeklyRows,
	fetchRaceHistory,
	perSnoutLabel,
	pinNeeded,
} from "@/utils/race";
import { CrewLedger, SpoilsStrip } from "@/components/season1/RaceSection";
import {
	BORDER,
	FONTS,
	PAGE_PAD,
	RADII,
	SHADOW_SM,
	SPACE,
	STICKER_SHADOW,
	TAB_SAFE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";

// How many rows each "show 25 more" reveal adds — the field paginates client-side
// off the full arrays race_standings() already returns.
const PAGE_SIZE = 25;

// The rank stamp's diameter. Drawing geometry (a medal on a row), not a spacing
// step, so it is named here rather than borrowed from SPACE. (2026-09-11)
const RANK_STAMP = 36;
// The week arrows sit either side of the settled-week title; a floor keeps the
// two the same width so the title stays centred as the label changes.
const WEEK_ARROW_MIN = 72;

type Board = "weekly" | "season" | "history";
type Metric = "perSnout" | "total";

// The two mutually-exclusive choices this page offers. Both run through the one
// `SegmentedControl`, so both announce as a radiogroup — the screen used to say
// "tab" for one and "radio" for the other. [C-05] (2026-09-11)
const BOARD_OPTIONS = [
	{ value: "weekly" as const, label: "this week" },
	{ value: "history" as const, label: "past weeks" },
	{ value: "season" as const, label: "season" },
];

const METRIC_OPTIONS = [
	{
		value: "perSnout" as const,
		label: "per snout",
		accessibilityHint: "Ranks by finds divided by diggers",
	},
	{
		value: "total" as const,
		label: "overall",
		accessibilityHint: "Ranks by every find the Sounder banked",
	},
];

export default function RaceStandingsScreen() {
	const { state, refresh } = useRace(true);
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

	const retryHistory = useCallback(() => {
		setHistory(undefined);
	}, []);

	// One crew's ledger open at a time — same machine the tab card runs.
	const { expandedCrew, setExpandedCrew, detailCache, toggleCrew } =
		useCrewLedger();

	// Flip boards → collapse back to the first page (the header shows the new count).
	const switchBoard = useCallback(
		(next: Board) => {
			setBoard(next);
			setPages(1);
			setExpandedCrew(null);
		},
		[setExpandedCrew],
	);

	if (state === undefined) {
		return (
			<Shell>
				<View style={styles.loadingWrap}>
					<LoadingBeat label="reading the race" />
				</View>
			</Shell>
		);
	}
	// `null` is a fetch that could not answer (the RPC is dark), not an empty
	// board — so it is an error with a way out, never a cozy "nothing here".
	// Behaviour law, spec §3.4. (2026-09-11)
	if (state === null) {
		return (
			<Shell>
				<View style={styles.stateWrap}>
					<EmptyState
						kind="error"
						glyph="trophy"
						title="the Dig-Off is quiet"
						sub="the race is still waking up"
						action={
							<Button
								variant="handLink"
								size="sm"
								onPress={refresh}
								accessibilityLabel="Try loading the Dig-Off again"
							>
								try again ›
							</Button>
						}
					/>
				</View>
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
			onRetryHistory={retryHistory}
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

// The page chrome — StackPage (headerless, cream, safe area), the plaque crown,
// tab-safe pad. The crown is `PageHeader variant="plaque"`, the variant that was written
// from this screen's own hanging sign. [C-10] (2026-09-11)
function Shell({ children }: { children: React.ReactNode }) {
	return (
		<>
			<StackPage>
				<PageHeader
					variant="plaque"
					kicker="the dig-off"
					title="The Dig-Off"
					subtitle="sounders, one board"
					onBack={() => router.back()}
				/>
				{children}
			</StackPage>
		</>
	);
}

// The live body — the toggle, the sticky my-Sounder row, and the paginated list.
function StandingsBody({
	state,
	paramCrewId,
	board,
	onSwitchBoard,
	pages,
	onShowMore,
	history,
	onRetryHistory,
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
	onRetryHistory: () => void;
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
	// otherwise it duplicates the in-place selected row (the tab's grammar).
	const showPin = pinNeeded(allRows, shown, myCrewId);

	const renderRow = useCallback(
		({
			item,
			index,
		}: {
			item: SeasonStandingsRow | StandingsRow;
			index: number;
		}) => {
			const crewId = "crew_id" in item ? item.crew_id : null;
			const expanded = !!crewId && crewId === expandedCrew;
			// race_crew_detail is live/season-aware, not a historical ledger. Past
			// rows therefore stay honest and non-expandable.
			const onPress =
				crewId && board !== "history" ? () => onToggleCrew(crewId) : undefined;
			return (
				<View>
					<ScoreRow
						row={item}
						index={index}
						onPress={onPress}
						metric={metric}
					/>
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
					rotate={-TILT.card}
					radius={RADII.xl}
					border={BORDER.heavy}
					style={styles.filterCard}
				>
					<SegmentedControl
						label="Dig-Off board"
						value={board}
						onChange={onSwitchBoard}
						options={BOARD_OPTIONS}
					/>
					<Hand tone="secondary" align="center" style={styles.boardCaption}>
						{board === "season"
							? "every find this season"
							: board === "history"
								? "the race resets each Monday"
								: "this race settles Monday"}
					</Hand>
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
					<Hand tone="secondary">counting ›</Hand>
					<SegmentedControl
						label="Counting"
						value={metric}
						onChange={setMetric}
						options={METRIC_OPTIONS}
						style={styles.metricToggle}
					/>
				</View>
				{((board === "history" && metric === "perSnout") ||
					(board === "season" && metric === "perSnout")) && (
					<Kicker star={false} align="center" style={styles.rankingNote}>
						{board === "season"
							? "season rank still follows overall finds"
							: "final rank follows overall finds"}
					</Kicker>
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
								{history === null ? (
									// A null archive is a fetch that failed, not an
									// empty shelf. [spec §3.4] (2026-09-11)
									<EmptyState
										kind="error"
										glyph="trophy"
										title="the archive is waking up"
										sub="try again after the next update"
										action={
											<Button
												variant="handLink"
												size="sm"
												onPress={onRetryHistory}
												accessibilityLabel="Try loading past Dig-Off weeks again"
											>
												try again ›
											</Button>
										}
									/>
								) : (
									<EmptyState
										glyph="trophy"
										title="no past races yet"
										sub="the first table settles Monday"
									/>
								)}
							</View>
						) : null
					}
					ListFooterComponent={
						<View style={styles.footer}>
							{hasMore && (
								<Button
									variant="ghost"
									size="sm"
									onPress={onShowMore}
									accessibilityLabel={`Show ${PAGE_SIZE} more Sounders`}
									accessibilityHint={`Reveals the next ${PAGE_SIZE} rows of the field`}
								>
									show {PAGE_SIZE} more ›
								</Button>
							)}
							{total > 0 && (
								<Hand tone="secondary">
									showing {shown} of {total} sounders
								</Hand>
							)}
						</View>
					}
				/>
			</View>
		</Shell>
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
	// A week arrow you cannot take keeps its whole shape — `Button`'s disabled
	// look is the "a button, asleep" ruling, not the 0.28 crush this screen used
	// to draw. [C-07] (2026-09-11)
	return (
		<View style={styles.historyPickerWrap}>
			<Button
				variant="ghost"
				size="sm"
				disabled={!canGoOlder}
				onPress={() => onChange(index + 1)}
				accessibilityLabel="Show an older Dig-Off week"
				style={styles.weekArrow}
			>
				‹ older
			</Button>
			<View style={styles.weekTitleWrap}>
				<CardTitle align="center">
					{index === 0 ? "last week" : weekLabel(week)}
				</CardTitle>
				{index === 0 && <Hand tone="secondary">{weekLabel(week)}</Hand>}
			</View>
			<Button
				variant="ghost"
				size="sm"
				disabled={!canGoNewer}
				onPress={() => onChange(index - 1)}
				accessibilityLabel="Show a newer Dig-Off week"
				style={styles.weekArrow}
			>
				newer ›
			</Button>
		</View>
	);
}

// The sticky MY-SOUNDER row — a selected sun `ListRow` pinned above the list, so
// scrolling never loses where I stand. Only mounts when my row is out of sight
// (pinNeeded), so the caller has already guaranteed I have a crew — the branches
// here cover ranked (rank · crew · score) vs the warm no-finds / sub-quorum
// nudges. [C-13] (2026-09-11)
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
			<ListRow
				selected
				fill="sun"
				title={
					<>
						<Kicker>your Sounder</Kicker>
						<CardTitle numberOfLines={1}>{line}</CardTitle>
					</>
				}
				accessibilityLabel={`Your Sounder: ${line}`}
			/>
		</View>
	);
}

// A board row — overall finds are the official weekly score; per-snout remains
// available as a secondary comparison lens. Legacy unranked rows stay defensive:
// they keep the row's whole shape and read `muted` ("already run"), never dimmed.
function ScoreRow({
	row,
	onPress,
	index = 0,
	metric = "perSnout",
}: {
	row: StandingsRow | SeasonStandingsRow;
	onPress?: () => void;
	index?: number;
	metric?: Metric;
}) {
	if (row.kind === "separator") return null;
	const grayed = row.kind === "unranked";
	const rankLabel = row.kind === "ranked" ? `#${row.rank}` : "—";
	const rankNumber = row.kind === "ranked" ? row.rank : null;
	const badgeColor = grayed
		? UI_COLORS.surfaceStrong
		: rankNumber === 1
			? WHIMSY.sun
			: rankNumber === 2
				? WHIMSY.rose
				: rankNumber === 3
					? WHIMSY.sky
					: WHIMSY.paper;
	const badgeTilt =
		rankNumber != null && rankNumber <= 3
			? rankNumber % 2 === 0
				? "3deg"
				: "-3deg"
			: "0deg";
	const perSnout =
		"avg" in row ? row.avg : row.total_finds / Math.max(1, row.diggers);
	const score =
		metric === "total" ? String(row.total_finds) : perSnoutLabel(perSnout);
	const scoreCaption =
		metric === "total"
			? row.total_finds === 1
				? "find"
				: "finds"
			: "per snout";
	return (
		<ListRow
			index={index}
			onPress={onPress}
			selected={row.highlighted}
			muted={grayed}
			fill={row.highlighted ? "sun" : undefined}
			leading={
				<View
					style={[
						styles.rankBadge,
						{
							backgroundColor: badgeColor,
							transform: [{ rotate: badgeTilt }],
						},
					]}
				>
					<T role="label" tone={grayed ? "secondary" : "primary"} style={styles.rowRank}>
						{rankLabel}
					</T>
				</View>
			}
			title={
				<CardTitle
					tone={grayed ? "secondary" : "primary"}
					numberOfLines={1}
					style={styles.rowName}
				>
					{row.name}
				</CardTitle>
			}
			sub={
				row.diggers > 0 ? (
					<T role="bodySm" tone="secondary">
						{row.diggers} {row.diggers === 1 ? "digger" : "diggers"}
					</T>
				) : null
			}
			trailing={
				<View style={styles.rowScoreCol}>
					<T role="sectionTitle" tone={grayed ? "secondary" : "primary"}>
						{score}
					</T>
					<T role="kickerPillSm" tone="secondary">
						{scoreCaption}
					</T>
				</View>
			}
			accessibilityLabel={`${rankLabel} ${row.name}, ${score} ${scoreCaption}`}
			accessibilityHint={
				onPress ? "Opens this Sounder's member ledger" : undefined
			}
		/>
	);
}

const styles = StyleSheet.create({
	loadingWrap: { marginTop: SPACE.xl, alignItems: "center" },
	stateWrap: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.md },
	// The reference groups period selection into one slightly tilted paper card.
	toggleWrap: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.md,
	},
	filterCard: { padding: SPACE.md },
	boardCaption: { marginTop: SPACE.sm },
	// The metric selector lives on the leaderboard itself, matching the HTML.
	boardCard: {
		flex: 1,
		marginHorizontal: PAGE_PAD,
		marginBottom: SPACE.sm,
		backgroundColor: WHIMSY.cream2,
		borderWidth: BORDER.heavy,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.lg,
		...STICKER_SHADOW,
		overflow: "hidden",
	},
	metricHeader: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
		borderBottomWidth: BORDER.thin,
		borderBottomColor: UI_COLORS.uiMuted,
	},
	metricToggle: { flexShrink: 1 },
	rankingNote: { paddingHorizontal: SPACE.card, paddingTop: SPACE.xs },
	// Past weeks use one compact time control, then the same honest standings
	// rows as the live race. Both arrows are Buttons, so both clear 44pt.
	historyLoading: { paddingVertical: SPACE.md, alignItems: "center" },
	historyPickerWrap: {
		paddingHorizontal: PAGE_PAD,
		paddingBottom: SPACE.sm,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: SPACE.sm,
	},
	weekArrow: { minWidth: WEEK_ARROW_MIN },
	weekTitleWrap: { flex: 1, alignItems: "center" },
	historyEmpty: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.md },
	// The sticky my-Sounder row — above the FlatList, never scrolls away.
	myWrap: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.sm },
	// The board rows are scrapbook stickers, tilted by their index.
	listContent: {
		paddingHorizontal: SPACE.card,
		paddingTop: SPACE.sm,
		paddingBottom: TAB_SAFE,
		gap: SPACE.sm,
	},
	rankBadge: {
		width: RANK_STAMP,
		height: RANK_STAMP,
		flexShrink: 0,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		alignItems: "center",
		justifyContent: "center",
		...SHADOW_SM,
	},
	// The stamp's figure is a display numeral at label size — the same pairing
	// the season card's podium medallion uses.
	rowRank: { fontFamily: FONTS.whimsy },
	rowName: { flexShrink: 1 },
	rowScoreCol: { alignItems: "flex-end" },
	// The reveal footer + running count.
	footer: { alignItems: "center", gap: SPACE.sm, paddingTop: SPACE.md },
});
