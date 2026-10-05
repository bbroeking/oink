// The turn strip: the last few turns at the table, newest first, on one
// cream paper with dashed rules between them (the "one paper" ladder). It is
// the table's memory: what you missed while you were away (async), what the
// Hungerer just did (live), and on the result sheet, how it ended.
//
// It is a ledger with a fixed number of lines: a line with no turn on it yet
// stays blank, so the strip is one height from the first turn to the last
// and the controls under it never walk down the screen as turns fill in.
// Before the first turn the rules are hidden and one hand line, floating
// over the same frame, says how the race ends.
//
// Each row: the pig's seat fill as a small disc beside its name (the name is
// always there, so nothing depends on hue alone), the faces it rolled, and
// how the turn ended in the hand voice. A bust ends on the Hungerer's own
// face, drawn rather than written.

import { Fragment } from "react";
import { StyleSheet, View } from "react-native";
import { DashedRule, Glyph, Hand, Kicker, Sticker, T } from "@/components/ui";
import { ART_SIZE, BORDER, RADII, SEAT_TINTS, SPACE, TILT, UI_COLORS } from "@/constants/theme";
import { type RootleTurn } from "@/multiplayer/games/rootle/rules";
import { turnOutcome, turnPips, turnSpoken } from "./copy";
import { BOARD_TYPE_CAP, STRIP_HINT, STRIP_HINT_SHORT, STRIP_ROWS } from "./layout";

// --- ART -------------------------------------------------------------------
// The seat disc beside a name: a mark, a step under the label's line.
const SEAT_DISC = 12;
// A name gives way to the turn's story past this share of the row.
const NAME_MAX = "34%";

export interface TurnStripProps {
	log: readonly RootleTurn[];
	/** One name per seat ("You" for your own). */
	names: readonly string[];
	/** False once that pig has left the table. */
	present: readonly boolean[];
	/** The kicker over the paper. */
	title?: string;
	/** How many turns to show. */
	rows?: number;
	/** The first-turn hint in full, or its short form when a short board
	 *  keeps fewer lines than the full hint needs. */
	hint?: "long" | "short";
}

export function TurnStrip({ log, names, present, title = "last turns", rows = STRIP_ROWS, hint = "long" }: TurnStripProps) {
	const recent = log.slice(-rows).reverse();
	const empty = recent.length === 0;
	const lines = Array.from({ length: rows }, (_, i) => recent[i] ?? null);
	return (
		<View style={styles.wrap} testID="rootle-strip">
			<Kicker maxFontSizeMultiplier={BOARD_TYPE_CAP}>{title}</Kicker>
			<Sticker
				color="cream"
				borderStyle={empty ? "dashed" : "solid"}
				shadow={empty ? "none" : "sm"}
				rotate={empty ? 0 : TILT.card}
				style={styles.paper}
			>
				{lines.map((turn, i) => (
					<Fragment key={i}>
						{i > 0 ? <DashedRule style={empty ? styles.hidden : undefined} /> : null}
						<View style={styles.line} testID="rootle-strip-line">
							{turn ? (
								<TurnRow
									turn={turn}
									name={names[turn.seat] ?? "a pig"}
									gone={present[turn.seat] === false}
									newest={i === 0}
								/>
							) : null}
						</View>
					</Fragment>
				))}
				{empty ? (
					<View pointerEvents="none" style={styles.hint}>
						<Hand tone="secondary" align="center" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
							{hint === "long" ? STRIP_HINT : STRIP_HINT_SHORT}
						</Hand>
					</View>
				) : null}
			</Sticker>
		</View>
	);
}

function TurnRow({ turn, name, gone, newest }: { turn: RootleTurn; name: string; gone: boolean; newest: boolean }) {
	const pips = turnPips(turn);
	const bust = turn.end === "bust";
	const tone = newest ? "primary" : "secondary";
	return (
		<View
			accessible
			accessibilityRole="text"
			accessibilityLabel={turnSpoken(turn, name, gone)}
			style={styles.row}
			testID="rootle-strip-row"
		>
			<View style={[styles.disc, { backgroundColor: SEAT_TINTS[turn.seat % SEAT_TINTS.length] }]} />
			<T role="label" tone={tone} numberOfLines={1} maxFontSizeMultiplier={BOARD_TYPE_CAP} style={styles.name}>
				{name}
			</T>
			<View style={styles.pips}>
				{pips ? (
					<T
						role="label"
						tone="secondary"
						numberOfLines={1}
						ellipsizeMode="head"
						maxFontSizeMultiplier={BOARD_TYPE_CAP}
						style={styles.pipText}
					>
						{bust ? `${pips} ·` : pips}
					</T>
				) : bust ? null : (
					<T role="label" tone="secondary" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
						–
					</T>
				)}
				{bust ? <Glyph name="ogre" size={ART_SIZE.glyphSm} /> : null}
			</View>
			<T role="hand" tone={tone} numberOfLines={1} maxFontSizeMultiplier={BOARD_TYPE_CAP} style={styles.outcome}>
				{turnOutcome(turn, gone)}
			</T>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		gap: SPACE.xs,
	},
	paper: {
		gap: SPACE.xs,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	// One ledger line: a turn's row, or blank and the same height.
	line: {
		minHeight: ART_SIZE.glyphSm,
		justifyContent: "center",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	hidden: {
		opacity: 0,
	},
	// The first-turn hint, over the blank ledger rather than in it, so it can
	// take two lines without changing the strip's height.
	hint: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: SPACE.md,
	},
	disc: {
		width: SEAT_DISC,
		height: SEAT_DISC,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
	},
	name: {
		flexShrink: 1,
		maxWidth: NAME_MAX,
	},
	// The faces take whatever the name and the outcome leave, and lose their
	// oldest faces first if a long turn will not fit.
	pips: {
		flex: 1,
		minWidth: 0,
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xxs,
	},
	pipText: {
		flexShrink: 1,
	},
	outcome: {
		flexShrink: 0,
	},
});
