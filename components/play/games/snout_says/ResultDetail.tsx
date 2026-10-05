// The result sheet's Snout Says detail: the warm band line (spec §4.2) and
// the round ledger, one row per round: the answer, what landed, and the
// outcome word. No seat is named on any row: a miss belongs to the table.
import { StyleSheet, View } from "react-native";
import { ART_SIZE, CHROME_TYPE_CAP, SPACE } from "@/constants/theme";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { SnoutSaysOutcome, SnoutSaysRecord, SnoutSaysView } from "@/multiplayer/games/snout_says/rules";
import type { Seat } from "@/multiplayer/types";
import { CardTitle, Glyph, Hand, ListRow, Tag, type ChipTone } from "@/components/ui";
import { OUTCOME_WORD, bandFor, leftBand, pictureArt, theName } from "./pictures";

const OUTCOME_TONE: Readonly<Record<SnoutSaysOutcome, ChipTone>> = {
	knew: "sun",
	nearly: "sage",
	got_away: "paper",
	mud: "paper",
};

/** What landed in a round, with no seat in it. */
export function cluesLine(record: Pick<SnoutSaysRecord, "clues" | "cancelled">): string {
	const short = (ids: readonly SnoutSaysRecord["clues"][number][]) => ids.map((p) => pictureArt(p).short).join(" · ");
	if (record.clues.length > 0) return `clue: ${short(record.clues)}`;
	if (record.cancelled.length > 0) return `great minds: ${short(record.cancelled)} tore away`;
	return "nothing landed: three tiles fogged";
}

export function SnoutSaysResultDetail({ view, room }: { view: SnoutSaysView; room: RoomSnapshot<SnoutSaysView>; you: Seat }) {
	const band = room.result?.reason === "ended_early" ? leftBand(view.total) : bandFor(view.total, view.maxTotal);
	return (
		<View style={styles.wrap} testID="snout-result">
			<View accessible accessibilityRole="summary" accessibilityLabel={`${band.title} ${band.line}`}>
				<CardTitle>{band.title}</CardTitle>
				<Hand tone="secondary">{band.line}</Hand>
			</View>
			{view.history.length > 0 ? (
				<View style={styles.rows} accessibilityRole="list">
					{view.history.map((r, i) => (
						<ListRow
							key={r.index}
							index={i}
							tilt={false}
							leading={<Glyph name={pictureArt(r.target).glyph} size={ART_SIZE.glyphMd} />}
							title={theName(r.target)}
							sub={cluesLine(r)}
							trailing={<Tag flat label={OUTCOME_WORD[r.outcome]} tone={OUTCOME_TONE[r.outcome]} maxFontSizeMultiplier={CHROME_TYPE_CAP} />}
							accessibilityLabel={`Round ${r.index + 1}: ${theName(r.target)}. ${cluesLine(r)}. ${OUTCOME_WORD[r.outcome]}.`}
							testID={`snout-ledger-${r.index}`}
						/>
					))}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.md },
	rows: { gap: SPACE.sm },
});
