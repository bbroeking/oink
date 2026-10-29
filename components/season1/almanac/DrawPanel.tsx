// The Draw panel — Monday's drum, and nothing else moving.
//
// Spec: docs/design/2026-09-21-season-page-rewrite.md §1 (the Draw cell) and
// §2 (the drum). The panel prints exactly THREE lines and one act:
//
//   · `7 of 21 balls this week`   — your own digs, the week's count
//   · `rare or better: 1 in 2`    — the closed form off those balls
//   · `the drum turns in 2d 5h`   — a clock
//
// The clock is a countdown, the way every other clock in the app reads
// ("Opens in 43m", the shop's restock). It used to print "Monday 00:00 UTC"
// first — a server's time zone, and for the Americas not even the right day
// (the turn lands on Sunday evening there). (2026-10-04)
//
// then the purse for the week that just ended: the draw when one waits, the
// receipt when it's drawn, one quiet invitation when the week held no balls.
// The first two lines are pure functions of the snout's own digs and the
// tuning row, the third is a clock: no standings, no other pigs, no herd flag,
// no streak. Every number comes from the server — the client never counts.
//
// Pure and props-driven, like FeedPanel / PassPanel: the copy lives in
// `drumLines`, so the words are a unit test rather than a reading of JSX. The
// strip's cell reads `drawCellValue` / `drawCellTodo` from here too, so the
// cell and the panel can never disagree about what the drum is doing.

import { StyleSheet, View } from "react-native";
import {
	Button,
	Hand,
	Label,
	LoadingBeat,
	ProgressTrack,
	Sticker,
	T,
	TickleIcon,
} from "@/components/ui";
import {
	ART_SIZE,
	RADII,
	SPACE,
	TAP_MIN,
	TILT,
} from "@/constants/theme";
import { formatHM } from "@/utils/duration";
import { ballsWord, oddsLine, type MondayDrawState } from "@/utils/mondayDraw";

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

const KICKER = "monday's drum";
const TURN_BASE = "the drum turns";
// No clock from the server (an older backend), or one already past: say the
// rhythm, never a time the player would have to convert.
const TURN_UNKNOWN = "the drum turns once a week";
const DRAW_LABEL = "Draw your Monday purse";
const NO_PURSE_LINE = "no purse this Monday · dig once this week and you're in Monday's drum";
const LOADING_LABEL = "finding your drum";

/** Which face the panel's bottom wears. */
export type DrumPurse = "draw" | "drawn" | "none";

export interface DrumLines {
	/** `7 of 21 balls this week` — the week's one dig number. */
	balls: string;
	/** `rare or better: 1 in 2`, at this week's balls. */
	odds: string;
	/** `the drum turns in 2d 5h`. */
	turn: string;
	/** The drawable week's purse: one waiting, one drawn, or none at all. */
	purse: DrumPurse;
	/** The CTA label, the receipt, or the invitation — whichever `purse` is. */
	purseLine: string;
}

// "2d 5h" / "5h 12m" / "12m" — how far off the turn is. Days earn a day
// word; anything inside a day falls back to the feeding clock's own h+m.
function awayWord(ms: number): string {
	if (ms >= MS_PER_DAY) {
		const d = Math.floor(ms / MS_PER_DAY);
		const h = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
		return h > 0 ? `${d}d ${h}h` : `${d}d`;
	}
	return formatHM(ms, { minMinute: 1 });
}

/**
 * The panel's whole copy, as data. `now` is passed so the turn line is a pure
 * function of the clock rather than a reading of Date.now() mid-render.
 */
export function drumLines(state: MondayDrawState, now: number = Date.now()): DrumLines {
	const balls = Math.max(0, Math.floor(state.runningBalls));
	const cap = Math.max(0, Math.floor(state.runningCap));
	// A full drum is the perfect week — the `every_last_feeding` achievement
	// reads the same number, so the panel says so in the same words.
	const ballsLine =
		cap > 0 && balls >= cap
			? `${cap} of ${cap} · every last feeding`
			: cap > 0
				? `${balls} of ${cap} balls this week`
				: `${ballsWord(balls)} this week`;

	let turn = TURN_UNKNOWN;
	if (state.nextTurnAt) {
		const at = Date.parse(state.nextTurnAt);
		if (Number.isFinite(at) && at > now) turn = `${TURN_BASE} in ${awayWord(at - now)}`;
	}

	const purse: DrumPurse = !state.eligible
		? "none"
		: state.drawn && state.amount != null
			? "drawn"
			: "draw";
	const purseLine =
		purse === "drawn"
			? `Drawn · ${state.amount} tickles`
			: purse === "draw"
				? DRAW_LABEL
				: NO_PURSE_LINE;

	return { balls: ballsLine, odds: oddsLine(state.runningOddsOneIn), turn, purse, purseLine };
}

/**
 * The strip cell's nowrap value: `Ready` while a purse waits (the cell wears
 * the act-now badge then too), `Drawn` once it's pocketed, and otherwise this
 * week's own count. `–` before the first read lands. The pocketed purse's
 * amount lives in the panel ("Drawn · 60 tickles"), not the cell: "Drawn ·
 * 60" measured 92pt against an SE cell's 88 and "Drawn · 400" overran a
 * 17 Pro's, so the cell ended in "…" at default text size (2026-10-04).
 */
export function drawCellValue(state: MondayDrawState | null): string {
	if (!state) return "–";
	if (drawCellTodo(state)) return "Ready";
	if (state.drawn && state.amount != null) return "Drawn";
	return ballsWord(Math.max(0, Math.floor(state.runningBalls)));
}

/** Act-now on the strip: a purse is drawable and still undrawn. */
export function drawCellTodo(state: MondayDrawState | null): boolean {
	return !!state && state.eligible && !state.drawn;
}

export interface DrawPanelProps {
	/** Null while the first read is in flight or the feature is dark. */
	state: MondayDrawState | null;
	/** draw_monday_purse, through the page's draw door. */
	onDraw: () => void;
	/** Opens the draw sheet on the drawn purse — the receipt and the tiers. */
	onOpenSheet: () => void;
	/** This panel holds the page's one gold act-now. */
	hero: boolean;
	testID?: string;
}

export function DrawPanel({ state, onDraw, onOpenSheet, hero, testID }: DrawPanelProps) {
	if (!state) {
		return (
			<View style={styles.panel} testID={testID}>
				<LoadingBeat label={LOADING_LABEL} />
			</View>
		);
	}

	const lines = drumLines(state);
	const cap = Math.max(0, Math.floor(state.runningCap));
	const balls = Math.max(0, Math.floor(state.runningBalls));

	return (
		<View style={styles.panel} testID={testID}>
			<Sticker color="cream" rotate={TILT.card} radius={RADII.xl} style={styles.hero}>
				<View style={styles.heroRow}>
					<TickleIcon size={ART_SIZE.badge} />
					<View style={styles.heroText}>
						<T role="kickerPill" tone="secondary">
							{KICKER}
						</T>
						{/* "1 of 21 balls this / week" left one word on the second line;
						    push-out breaks earlier so the line ends in a pair. */}
						<T
							role="pageTitle"
							accessibilityRole="header"
							lineBreakStrategyIOS="push-out"
							testID="draw-balls-line"
						>
							{lines.balls}
						</T>
						<Hand tone="secondary" testID="draw-odds-line">
							{lines.odds}
						</Hand>
					</View>
				</View>
				{cap > 0 && (
					<ProgressTrack
						value={Math.min(balls, cap)}
						max={cap}
						tone="sage"
						height="sm"
						accessibilityLabel={`${balls} of ${cap} balls this week`}
					/>
				)}
				<Hand tone="secondary" align="center" style={styles.turn} testID="draw-turn-line">
					{lines.turn}
				</Hand>
				{lines.purse === "draw" ? (
					<Button
						variant={hero ? "gold" : "lilac"}
						size="lg"
						full
						onPress={onDraw}
						accessibilityLabel={lines.purseLine}
						accessibilityHint="Turns the drum. One purse per snout, yours to keep"
						testID="draw-panel-draw"
					>
						{lines.purseLine}
					</Button>
				) : lines.purse === "drawn" ? (
					<Sticker
						color="paper"
						rotate={0}
						radius={RADII.pill}
						shadow="sm"
						onPress={onOpenSheet}
						accessibilityLabel={lines.purseLine}
						accessibilityHint="Opens Monday's draw"
						style={styles.door}
						testID="draw-panel-receipt"
					>
						<Label>{lines.purseLine}</Label>
					</Sticker>
				) : (
					<Hand tone="secondary" align="center" testID="draw-panel-invite">
						{lines.purseLine}
					</Hand>
				)}
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { gap: SPACE.md },
	hero: {
		paddingHorizontal: SPACE.card,
		paddingVertical: SPACE.card,
		gap: SPACE.sm,
	},
	heroRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
	},
	heroText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	turn: { marginBottom: SPACE.xs },
	door: {
		alignSelf: "center",
		minHeight: TAP_MIN,
		justifyContent: "center",
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.sm,
	},
});
