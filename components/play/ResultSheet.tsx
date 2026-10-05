// The result sheet: how the table ended, once the board's last beat has
// played (GameUI.resultDelayMs, skipped under Reduce Motion).
//
// The words are the protocol's (resultCopy: "You took it", "Bandit took
// it", "You did it together", "Ended early" with "Bandit had to head home"):
// a forfeit never blames, a fall-short is the table's. A table that went on
// without you (you left, or it seated you out: the result cannot tell which)
// says the one line true of both (resultWords: "The table moved on without
// you.", your row "sat out"). Then one row per pig
// with its score in the game's own words (GameUI.seatStatus at the final
// view, so "5 pens", never "0 pens"), winners wearing "took it"; a co-op
// table is ONE row, the pigs together, because nobody at it lost to anybody.
// The game's own extra (GameUI.ResultDetail) follows. Then what's next:
// Rematch (a live table, while its window is open, saying who already wants
// one), Find another pig (same game, same pace) and Head home.

import { StyleSheet, View } from "react-native";
import { Button, Hand, ListRow, PigAvatar, Sheet, T, Tag } from "@/components/ui";
import { AVATAR_SIZE, SPACE } from "@/constants/theme";
import { useServerClock, type RoomSource } from "@/hooks/useMultiplayer";
import type { RoomSnapshot, SeatInfo } from "@/multiplayer/protocol";
import type { GameKind } from "@/multiplayer/types";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { rematchMsLeft } from "@/utils/multiplayer/store";
import type { GameUI } from "./types";
import { MATCH_COPY, RESULT_COPY, fill, joinNames, othersAtTable, resultWords } from "./playCopy";

// The rematch window redraws by the half second.
const REMATCH_TICK_MS = 500;

export interface ResultSheetProps {
	open: boolean;
	onClose: () => void;
	room: RoomSnapshot;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	ui: GameUI<any>;
	gameTitle: string;
	kind: GameKind;
	practice: boolean;
	source: RoomSource;
	rematchBusy: boolean;
	onRematch: () => void;
	onFindAnother: () => void;
	onHeadHome: () => void;
}

export function ResultSheet(props: ResultSheetProps) {
	const { open, onClose, room, gameTitle, practice } = props;
	const words = resultWords(room);
	return (
		<Sheet
			open={open}
			onClose={onClose}
			kicker={practice ? MATCH_COPY.kickerPractice : gameTitle.toLowerCase()}
			title={words.headline}
			subtitle={words.detail ?? undefined}
			footer={open ? <ResultActions {...props} /> : undefined}
			testID="result-sheet"
		>
			<ResultRows {...props} />
		</Sheet>
	);
}

function scoreWords(props: ResultSheetProps, seat: SeatInfo): string | null {
	const { room, ui } = props;
	if (ui.seatStatus && room.view !== null) {
		try {
			return ui.seatStatus(room.view, seat.seat, room);
		} catch {
			return null;
		}
	}
	const score = room.result?.scores?.[seat.seat];
	return typeof score === "number" && score > 0 ? String(score) : null;
}

function ResultRows(props: ResultSheetProps) {
	const { room, ui, kind, practice } = props;
	const result = room.result;
	const name = (s: SeatInfo) => (s.seat === room.you ? MATCH_COPY.you : s.name);
	const Detail = ui.ResultDetail;

	if (result && (result.kind === "coop" || kind !== "competitive")) {
		// One row: the pigs, together.
		const pigs = room.seats;
		const shared = result.summary?.trim() || null;
		// Played to the end together; a table that ended early simply was.
		const together = result.kind === "coop";
		return (
			<View style={styles.body}>
				<ListRow
					tilt={false}
					fill={together && result.success !== false ? "sage" : "cream"}
					leading={<Huddle seats={pigs} />}
					title={<T role="cardTitleSm">{RESULT_COPY.theTable}</T>}
					sub={joinNames(pigs.map(name))}
					trailing={together ? <Tag flat label={RESULT_COPY.together} tone="paper" /> : undefined}
					accessibilityLabel={`${RESULT_COPY.theTable}: ${joinNames(pigs.map(name))}${shared ? `. ${shared}` : ""}`}
					testID="result-row-table"
				/>
				{Detail && room.view !== null && room.you !== null ? <Detail view={room.view} room={room} you={room.you} /> : null}
				{practice ? <PracticeNote /> : null}
			</View>
		);
	}

	const winners = result?.winners ?? [];
	const draw = result?.kind === "draw";
	const ordered = [...room.seats].sort((a, b) => {
		const aw = winners.includes(a.seat) ? 1 : 0;
		const bw = winners.includes(b.seat) ? 1 : 0;
		if (aw !== bw) return bw - aw;
		const as = result?.scores?.[a.seat] ?? 0;
		const bs = result?.scores?.[b.seat] ?? 0;
		return bs - as || a.seat - b.seat;
	});
	return (
		<View style={styles.body}>
			{ordered.map((s, i) => {
				const won = winners.includes(s.seat) && !s.gone;
				const words = scoreWords(props, s);
				const tag = s.gone
					? s.seat === room.you
						? RESULT_COPY.satOut
						: RESULT_COPY.headedHome
					: won
						? draw
							? RESULT_COPY.sharedIt
							: RESULT_COPY.tookIt
						: null;
				const pig = pigStagePropsForLook(s.look);
				return (
					<ListRow
						key={s.seat}
						index={i}
						fill={s.seat === room.you ? "rose" : "paper"}
						leading={<PigAvatar size={AVATAR_SIZE[1]} pigId={pig.pigId} hatId={s.look.hat} bowId={s.look.bow} mode="worn" />}
						title={<T role="cardTitleSm" numberOfLines={1}>{name(s)}</T>}
						sub={words ?? undefined}
						trailing={tag ? <Tag flat label={tag} tone={s.gone ? "muted" : "sun"} glyph={s.gone ? undefined : "star"} /> : undefined}
						accessibilityLabel={[name(s), words, tag].filter(Boolean).join(", ")}
						testID={`result-row-${s.seat}`}
					/>
				);
			})}
			{Detail && room.view !== null && room.you !== null ? <Detail view={room.view} room={room} you={room.you} /> : null}
			{practice ? <PracticeNote /> : null}
		</View>
	);
}

/** The pigs of a co-op table, shoulder to shoulder. */
function Huddle({ seats }: { seats: SeatInfo[] }) {
	return (
		<View style={styles.huddle}>
			{seats.map((s, i) => {
				const pig = pigStagePropsForLook(s.look);
				return (
					<PigAvatar
						key={s.seat}
						size={AVATAR_SIZE[0]}
						pigId={pig.pigId}
						hatId={s.look.hat}
						bowId={s.look.bow}
						mode="worn"
						style={i > 0 ? styles.tucked : undefined}
					/>
				);
			})}
		</View>
	);
}

function PracticeNote() {
	return (
		<Hand tone="secondary" align="center" testID="result-practice-note">
			{RESULT_COPY.practiceNote}
		</Hand>
	);
}

function ResultActions(props: ResultSheetProps) {
	const { room, practice, source, rematchBusy, onRematch, onFindAnother, onHeadHome, gameTitle } = props;
	const now = useServerClock(REMATCH_TICK_MS, source);
	const you = room.you;
	const mine = room.seats.find((s) => s.seat === you) ?? null;
	const others = othersAtTable(room);
	const offered = practice || (room.pace === "live" && room.result?.reason !== "server" && !!mine && !mine.gone && others.length > 0);

	let line: string | null = null;
	let rematch: { label: string; asleep: boolean } | null = null;
	if (offered) {
		const left = practice ? null : rematchMsLeft(room, now);
		const votes = room.rematch?.votes ?? [];
		const voted = you !== null && votes.includes(you);
		if (left !== null && left <= 0) {
			rematch = { label: RESULT_COPY.rematch, asleep: true };
			line = RESULT_COPY.tooLate;
		} else if (voted) {
			const waiting = others.filter((s) => !votes.includes(s.seat)).map((s) => s.name);
			rematch = { label: RESULT_COPY.asked, asleep: true };
			line = waiting.length > 0 ? fill(RESULT_COPY.waitingRematch, { names: joinNames(waiting) }) : null;
		} else {
			const askers = others.filter((s) => votes.includes(s.seat)).map((s) => s.name);
			rematch = { label: RESULT_COPY.rematch, asleep: false };
			line = askers.length > 0 ? fill(RESULT_COPY.wantsRematch, { name: joinNames(askers) }) : null;
		}
		if (left !== null && left > 0) {
			const s = fill(RESULT_COPY.windowLeft, { s: String(Math.ceil(left / 1000)) });
			line = line ? `${line} · ${s}` : s;
		}
	}

	return (
		<View style={styles.actions} testID="result-actions">
			{line ? (
				<Hand tone="secondary" align="center" testID="result-rematch-line">
					{line}
				</Hand>
			) : null}
			{/* Stacked, full width: two labels side by side do not fit a 375pt
			    sheet ("Find another pig" wraps in a half-width pill). */}
			{rematch ? (
				<Button
					variant={rematch.asleep ? "locked" : "primary"}
					full
					disabled={rematch.asleep}
					loading={rematchBusy}
					loadingLabel="asking"
					onPress={onRematch}
					accessibilityHint={RESULT_COPY.rematchHint}
					testID="result-rematch"
				>
					{rematch.label}
				</Button>
			) : null}
			<Button
				variant={rematch ? "ghost" : "primary"}
				full
				onPress={onFindAnother}
				accessibilityHint={fill(RESULT_COPY.findAnotherHint, { game: gameTitle })}
				testID="result-find-another"
			>
				{practice ? RESULT_COPY.findReal : RESULT_COPY.findAnother}
			</Button>
			<Button variant="handLink" size="sm" onPress={onHeadHome} accessibilityHint={RESULT_COPY.headHomeHint} testID="result-head-home">
				{RESULT_COPY.headHome}
			</Button>
		</View>
	);
}

const styles = StyleSheet.create({
	body: { gap: SPACE.sm },
	huddle: { flexDirection: "row" },
	tucked: { marginLeft: -SPACE.sm },
	actions: { gap: SPACE.sm, alignItems: "stretch" },
});
