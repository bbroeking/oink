// The wins board: this month's matchmade wins, and nothing else (SKILL.md
// 2026-10-04). No loss column, no zero row, no rating on show; it resets on
// the 1st. One segment per game that can be won (a co-op table is won
// together, so it never lands here) and All.
//
// Each row: the rank, the pig as it dresses, the name, the wins. Your own row
// is pinned at the foot while you have a win this month ("You · 3 wins");
// before your first, the foot says what one would do. The RPC is authored
// but may not be deployed yet: a missing function is "the board opens soon",
// never an error.
//
// The crown is pinned, so it states its type ceiling; the page leaves the
// bottom edge to the pinned foot, which ends on the stack scroll pad over the
// home indicator (no band of dead paper clipping the list above it).

import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router/react-navigation";
import {
	Button,
	EmptyState,
	Hand,
	ListRow,
	LoadingBeat,
	PageHeader,
	PigAvatar,
	SegmentedControl,
	STACK_SCROLL_EDGES,
	StackPage,
	Sticker,
	T,
	useStackScrollPad,
	type SegmentOption,
} from "@/components/ui";
import { AVATAR_SIZE, CHROME_TYPE_CAP, PAGE_PAD, RADII, SPACE } from "@/constants/theme";
import { GAMES, GAME_IDS } from "@/multiplayer/games";
import type { GameId } from "@/multiplayer/types";
import { fetchWinsBoard, type WinsBoardResult, type WinsRow } from "@/utils/multiplayer/leaderboard";
import { UNNAMED_PIG } from "@/utils/multiplayer/looks";
import { isPigId } from "@/utils/pigs";
import { leaveScreen } from "./nav";
import { WINS_COPY, fill, monthName, winsWords } from "./playCopy";
import { useSessionUserId } from "./useSessionUserId";

// The rank column keeps "#10" from nudging the names row to row.
const RANK_COL = 36;

/** The board's short segment labels; the games' titles do not fit five up. */
const SHORT_TITLE: Partial<Record<GameId, string>> = {
	rootle: "Rootle",
	fence_the_pen: "Fence",
	mud_volley: "Volley",
	out_looking: "Looking",
};

type Segment = "all" | GameId;

/** The games a pig can win (a co-op table wins together, off the board). */
export const WINNABLE_GAMES: GameId[] = GAME_IDS.filter((id) => GAMES[id].kind === "competitive");

export function WinsBoard() {
	const myId = useSessionUserId();
	const scrollPad = useStackScrollPad();
	const [segment, setSegment] = useState<Segment>("all");
	const [attempt, setAttempt] = useState(0);
	const key = `${segment}:${attempt}`;
	const [result, setResult] = useState<{ key: string; res: WinsBoardResult } | null>(null);

	useFocusEffect(
		useCallback(() => {
			let live = true;
			void fetchWinsBoard(segment === "all" ? null : segment).then((res) => {
				if (live) setResult({ key, res });
			});
			return () => {
				live = false;
			};
		}, [segment, key]),
	);

	const current = result?.key === key ? result.res : null;
	const board = current?.ok ? current.board : null;
	const kicker = monthName(board?.period) ?? WINS_COPY.kicker;
	const options: SegmentOption<Segment>[] = [
		{ value: "all", label: WINS_COPY.all, accessibilityHint: "Shows wins at every game" },
		...WINNABLE_GAMES.map((id) => ({
			value: id as Segment,
			label: SHORT_TITLE[id] ?? GAMES[id].title,
			accessibilityLabel: GAMES[id].title,
			accessibilityHint: `Shows wins at ${GAMES[id].title}`,
		})),
	];

	let body: ReactNode;
	if (!current) {
		body = <LoadingBeat label={WINS_COPY.loading} />;
	} else if (!current.ok && current.reason === "missing") {
		body = <EmptyState glyph="trophy" title={WINS_COPY.soonTitle} sub={WINS_COPY.soonSub} />;
	} else if (!current.ok) {
		body = (
			<EmptyState
				kind="error"
				sub={WINS_COPY.errorSub}
				action={
					<Button variant="ghost" size="sm" onPress={() => setAttempt((n) => n + 1)} accessibilityHint={WINS_COPY.retryHint} testID="wins-retry">
						{WINS_COPY.retry}
					</Button>
				}
			/>
		);
	} else if (current.board.rows.length === 0) {
		body = <EmptyState glyph="trophy" title={WINS_COPY.emptyTitle} sub={WINS_COPY.emptySub} />;
	} else {
		body = (
			<View style={styles.rows}>
				{current.board.rows.map((row, i) => (
					<WinsRowView key={row.userId} row={row} index={i} mine={!!myId && row.userId === myId} />
				))}
			</View>
		);
	}

	return (
		<StackPage testID="wins-board" edges={STACK_SCROLL_EDGES}>
			<PageHeader
				kicker={kicker}
				title={WINS_COPY.title}
				onBack={leaveScreen}
				maxFontSizeMultiplier={CHROME_TYPE_CAP}
				below={
					<SegmentedControl
						label={WINS_COPY.segmentsLabel}
						options={options}
						value={segment}
						onChange={setSegment}
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
						style={styles.segments}
					/>
				}
			/>
			<ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				{body}
			</ScrollView>
			<View style={[styles.foot, { paddingBottom: scrollPad }]} testID="wins-foot">
				{board ? (
					board.me.wins > 0 ? (
						<Sticker color="rose" radius={RADII.md} shadow="sm" rotate={0} style={styles.you} accessibilityRole="text" accessibilityLabel={youLabel(board.me)} testID="wins-you">
							<T role="cardTitleSm" style={styles.youName}>
								{fill(WINS_COPY.youWins, { wins: winsWords(board.me.wins) })}
							</T>
							{board.me.rank !== null ? <T role="numeral" tone="secondary">{`#${board.me.rank}`}</T> : null}
						</Sticker>
					) : (
						<Hand align="center" testID="wins-first">
							{WINS_COPY.firstWin}
						</Hand>
					)
				) : null}
				<Hand tone="secondary" align="center" testID="wins-footnote">
					{WINS_COPY.footnote}
				</Hand>
			</View>
		</StackPage>
	);
}

function youLabel(me: { wins: number; rank: number | null }): string {
	return me.rank !== null
		? fill(WINS_COPY.youRowLabel, { rank: String(me.rank), wins: winsWords(me.wins) })
		: fill(WINS_COPY.youWins, { wins: winsWords(me.wins) });
}

function WinsRowView({ row, index, mine }: { row: WinsRow; index: number; mine: boolean }) {
	const name = row.username ?? UNNAMED_PIG;
	return (
		<ListRow
			index={index}
			fill={mine ? "rose" : "paper"}
			leading={
				<View style={styles.lead}>
					<T role="numeral" tone="secondary" style={styles.rank}>{`#${row.rank}`}</T>
					<PigAvatar size={AVATAR_SIZE[1]} pigId={isPigId(row.pigId) ? row.pigId : "rosie"} hatId={row.hatId} bowId={row.bowId} mode="worn" />
				</View>
			}
			title={
				<T role="cardTitleSm" numberOfLines={1}>
					{name}
				</T>
			}
			trailing={<T role="numeral">{winsWords(row.wins)}</T>}
			accessibilityLabel={
				mine
					? fill(WINS_COPY.youRowLabel, { rank: String(row.rank), wins: winsWords(row.wins) })
					: fill(WINS_COPY.rowLabel, { rank: String(row.rank), name, wins: winsWords(row.wins) })
			}
			testID={`wins-row-${row.userId}`}
		/>
	);
}

const styles = StyleSheet.create({
	segments: { marginTop: SPACE.sm },
	scroll: { flex: 1 },
	content: { paddingHorizontal: PAGE_PAD, paddingBottom: SPACE.lg, gap: SPACE.sm },
	rows: { gap: SPACE.sm },
	lead: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	rank: { width: RANK_COL },
	foot: { paddingHorizontal: PAGE_PAD, paddingTop: SPACE.sm, gap: SPACE.xs },
	you: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
	youName: { flex: 1, minWidth: 0 },
});
