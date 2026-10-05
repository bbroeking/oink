// The Snout Says board (BoardProps in components/play/types.ts). Two views
// from one component, by this pig's role in the round in play:
//   Guesser  one hand line that reads the clues (or the free-sniff note),
//            the nine-picture spread on paper tiles and two guess pips. One
//            tap is one guess: a wrong first tap only dims that tile, so
//            there is nothing to confirm.
//   Nose     the answer ringed in sun on a small spread, the twelve-picture
//            tray, then Show this one (final). After that: whose picks are
//            in, never which pictures.
// The clue pictures themselves float over the Noses' pigs in the seat strip
// (GameUI.seatBubble, ./ClueBubble.tsx), not in a row on the board. Before
// each next beat the round just scored plays as a reveal; the server's
// clock pads the next clue beat by exactly that long.
//
// The board fills the height the match screen gives it (GameUI.fillsHeight;
// ../fit.ts holds the contract, ./layout.ts the plans): the taps that answer
// your turn are pinned at its foot at full size (the Guesser's spread and
// its pips, the Nose's tray and Show this one) and the words above them get
// what is left. On a short board the tiles shrink to TAP_MIN before anything
// a pig needs goes: first the gaps, the tally and the Nose's how-to line,
// then the answer card folds from a small spread beside its words to one row
// of nine under them, then to a single line. Before the match screen's first
// layout (`height` undefined) it draws the natural board.
//
// A pure function of `view`. Local state is presentation only: the tray
// picture before it is sent, the tile tapped while the table answers, and
// which scored round this board has already revealed.
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { BORDER, BUTTON_SIZE, CHROME_TYPE_CAP, LIST_BLEED, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { SNOUT_SAYS_TUNING, type SnoutSaysRecord, type SnoutSaysView } from "@/multiplayer/games/snout_says/rules";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import type { Seat } from "@/multiplayer/types";
import { Button, CardTitle, Hand, Icon, Kicker, Sticker, T } from "@/components/ui";
import type { BoardProps } from "../../types";
import { useTextScale } from "../fit";
import { FOOT, PIP, nosePlan, revealPlan, spreadPlan, type SpreadPlan } from "./layout";
import { PictureTile, type TileState } from "./PictureTile";
import { bandFor, guessPrompt, leftBand, listWords, outcomeLine, pictureArt, seatName, tallyLine, theName } from "./pictures";
import { GREAT_MINDS } from "./ClueBubble";
import { MiniSpread, NOTHING_SAID, Reveal } from "./Reveal";

/** How long the board plays a scored round: the server's live reveal pad. */
export const REVEAL_MS = SNOUT_SAYS_TUNING.revealMs.live;

/** What the guess pips say. */
export function pipWords(left: number): string {
	return left === 2 ? "two guesses" : left === 1 ? "one guess left" : "no guesses left";
}

/** The round and the table's running total, under the spread. */
function roundLine(view: SnoutSaysView): string {
	return `round ${view.round + 1} of ${view.rounds} · ${tallyLine(view.total, view.maxTotal)}`;
}

const shortName = (p: PictureId) => pictureArt(p).short;

export function SnoutSaysBoard({ view, room, you, yourTurn, act, pending, reduceMotion, width, height }: BoardProps<SnoutSaysView>) {
	const policy = useMotionPolicy();
	const still = reduceMotion || policy.reduceMotion;
	const s = useTextScale();
	const nameOf = (seat: Seat) => seatName(room, seat);

	// The reveal plays once per scored round this board watched happen. A
	// board that mounts mid-game starts as if it had already seen it.
	const lastIndex = view.lastRound?.index ?? -1;
	const [seen, setSeen] = useState(lastIndex);
	const [revealing, setRevealing] = useState<SnoutSaysRecord | null>(null);
	if (seen !== lastIndex) {
		setSeen(lastIndex);
		setRevealing(lastIndex > seen ? view.lastRound : null);
	}
	const over = view.phase === "over";
	useEffect(() => {
		if (!revealing || over) return;
		const timer = setTimeout(() => setRevealing(null), REVEAL_MS);
		return () => clearTimeout(timer);
	}, [revealing, over]);

	if (over) {
		const band = room.result?.reason === "ended_early" ? leftBand(view.total) : bandFor(view.total, view.maxTotal);
		const body = (
			<>
				{view.lastRound ? (
					<Reveal
						key={view.lastRound.index}
						record={view.lastRound}
						rounds={view.rounds}
						total={view.total}
						maxTotal={view.maxTotal}
						reduceMotion={still}
						animate={revealing !== null}
					/>
				) : null}
				<Sticker color="sun" pad accessibilityRole="summary" accessibilityLabel={`${band.title} ${band.line}`}>
					<CardTitle maxFontSizeMultiplier={CHROME_TYPE_CAP}>{band.title}</CardTitle>
					<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{band.line}
					</Hand>
				</Sticker>
			</>
		);
		if (height === undefined) {
			return (
				<View style={styles.board} testID="snout-board-ended">
					{body}
				</View>
			);
		}
		// Nothing is asked of anyone once the table is over, so a board too
		// short for the last round's card and the band line scrolls them.
		return (
			<View style={[styles.fitted, { height }]} testID="snout-board-ended">
				<ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
					{body}
				</ScrollView>
			</View>
		);
	}

	if (revealing) {
		const card = (
			<Reveal
				key={revealing.index}
				record={revealing}
				rounds={view.rounds}
				total={view.total}
				maxTotal={view.maxTotal}
				reduceMotion={still}
				animate
				onContinue={() => setRevealing(null)}
				plan={
					height === undefined
						? undefined
						: revealPlan({
								width,
								height,
								s,
								bubbles: [...revealing.clues.map(shortName), ...revealing.cancelled.map(() => GREAT_MINDS)],
								nothing: revealing.said.length === 0 ? NOTHING_SAID : null,
								outcome: outcomeLine(revealing),
							})
				}
			/>
		);
		return height === undefined ? (
			<View style={styles.board} testID="snout-board-reveal">
				{card}
			</View>
		) : (
			<View style={[styles.fitted, { height }]} testID="snout-board-reveal">
				<View style={styles.region}>{card}</View>
			</View>
		);
	}

	return view.role === "nose" && view.nose ? (
		<NoseBeat
			key={view.round}
			view={view}
			nameOf={nameOf}
			you={you}
			yourTurn={yourTurn}
			act={act}
			pending={pending}
			reduceMotion={still}
			width={width}
			height={height}
			s={s}
		/>
	) : (
		<GuesserBeat
			key={view.round}
			view={view}
			nameOf={nameOf}
			you={you}
			yourTurn={yourTurn}
			act={act}
			pending={pending}
			reduceMotion={still}
			width={width}
			height={height}
			s={s}
			rev={room.rev}
		/>
	);
}

interface BeatProps {
	view: SnoutSaysView;
	nameOf: (seat: Seat) => string;
	you: Seat;
	yourTurn: boolean;
	act: BoardProps<SnoutSaysView>["act"];
	pending: boolean;
	reduceMotion: boolean;
	width: number;
	/** The match screen's measure; undefined before its first layout. */
	height: number | undefined;
	/** The board's capped text scale. */
	s: number;
}

/**
 * A spread board fitted to its height: the hand line in the planned region
 * at the top, the spread and its footer pinned at the foot.
 */
function SpreadFrame({
	height,
	plan,
	testID,
	line,
	grid,
	footer,
}: {
	height: number;
	plan: SpreadPlan;
	testID: string;
	line: ReactNode;
	grid: ReactNode;
	footer: ReactNode;
}) {
	return (
		<View style={[styles.fitted, { height }]} testID={testID}>
			<View style={styles.region}>{line}</View>
			<View style={[styles.pinned, { marginTop: plan.gap }]} testID="snout-foot">
				{grid}
				{footer ? (
					<View style={[styles.slot, { height: plan.footerH, marginTop: plan.gap }]} testID="snout-footer">
						{footer}
					</View>
				) : null}
			</View>
		</View>
	);
}

// ── The Guesser (and a pig sitting the round out, who only watches) ─────────

function GuesserBeat({ view, nameOf, yourTurn, act, pending, reduceMotion, width, height, s, rev }: BeatProps & { rev: number }) {
	const guessing = view.role === "guesser" && view.phase === "guess";
	// The tile tapped while the table answers; the next revision clears it.
	const [tapped, setTapped] = useState<PictureId | null>(null);
	const [revSeen, setRevSeen] = useState(rev);
	if (revSeen !== rev) {
		setRevSeen(rev);
		setTapped(null);
	}
	const canGuess = guessing && yourTurn && !pending && tapped === null;

	const guess = async (picture: PictureId) => {
		if (!canGuess) return;
		setTapped(picture);
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
		const res = await act({ type: "guess", picture });
		if (!res.ok) setTapped(null);
	};

	const noseNames = view.noses.map((n) => nameOf(n.seat));
	const soloNose = view.noses.length === 1 ? noseNames[0] : null;
	const line =
		view.role !== "guesser"
			? `${view.guesser === null ? "a pig" : nameOf(view.guesser)} is guessing.`
			: view.phase === "clue"
				? soloNose
					? `${soloNose} is picking a picture for one of these.`
					: `${listWords(noseNames)} are picking pictures for one of these.`
				: guessPrompt(view.clues ?? [], soloNose);
	const pips = view.role === "guesser" ? pipWords(view.guessesLeft) : null;
	const tally = roundLine(view);
	const plan = spreadPlan({ width, height, s, line, pips, tally, labels: view.spread.map(shortName) });
	const testID = view.role === "guesser" ? "snout-board-guesser" : "snout-board-watching";

	const handLine = (
		<T role="handLg" align="center" numberOfLines={plan.handLines} maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-hand-line">
			{line}
		</T>
	);
	const grid = (
		<View
			style={[styles.grid, { width: plan.tileW * 3 + plan.gridGap * 2, gap: plan.gridGap }, height === undefined ? null : { height: plan.gridH }]}
			accessibilityRole="list"
			testID="snout-spread"
		>
			{view.spread.map((p) => {
				const state: TileState = view.sniffed.includes(p)
					? "fogged"
					: view.dimmed.includes(p)
						? "dimmed"
						: tapped === p
							? "lifted"
							: "idle";
				const open = state === "idle" || state === "lifted";
				const name = pictureArt(p).name;
				return (
					<PictureTile
						key={`${view.round}:${p}`}
						id={p}
						size={plan.tileW}
						height={plan.tileH}
						state={state}
						label
						labelLines={plan.labelLines}
						hitSlop={plan.hitSlop}
						reduceMotion={reduceMotion}
						onPress={canGuess && open ? () => void guess(p) : undefined}
						accessibilityLabel={
							state === "fogged"
								? `${name}, fogged over: not this one`
								: state === "dimmed"
									? `${name}, already guessed: not this one`
									: name
						}
						accessibilityHint="Guesses this picture"
						testID={`snout-spread-${p}`}
					/>
				);
			})}
		</View>
	);
	const footer =
		plan.footer === "none" ? null : (
			<View style={styles.footer}>
				{pips !== null ? <GuessPips left={view.guessesLeft} words={pips} /> : null}
				{plan.footer === "full" ? (
					<T role="kicker" tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.footerTally}>
						{tally}
					</T>
				) : null}
			</View>
		);

	if (height === undefined) {
		return (
			<View style={styles.board} testID={testID}>
				{handLine}
				{grid}
				{footer}
			</View>
		);
	}
	return <SpreadFrame height={height} plan={plan} testID={testID} line={handLine} grid={grid} footer={footer} />;
}

function GuessPips({ left, words }: { left: number; words: string }) {
	return (
		<View style={styles.pips} accessible accessibilityRole="text" accessibilityLabel={words} testID="snout-pips">
			{Array.from({ length: SNOUT_SAYS_TUNING.guesses }, (_, i) => (
				<View key={i} style={[styles.pip, i < left ? styles.pipOn : styles.pipSpent]} />
			))}
			<T role="kicker" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
				{words}
			</T>
		</View>
	);
}

// ── A Nose ──────────────────────────────────────────────────────────────────

function NoseBeat({ view, nameOf, you, yourTurn, act, pending, reduceMotion, width, height, s }: BeatProps) {
	const nose = view.nose;
	const [selected, setSelected] = useState<PictureId | null>(null);
	if (!nose) return null;
	const myPick = nose.myPick;
	const canPick = view.phase === "clue" && yourTurn && myPick === null && !pending;
	const guesserName = view.guesser === null ? "a pig" : nameOf(view.guesser);
	const fitted = height !== undefined;

	const show = async () => {
		if (!canPick || !selected) return;
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		await act({ type: "clue", picture: selected });
	};

	// Whose picks are in, never which pictures.
	const others = view.noses
		.filter((n) => n.seat !== you && n.status !== "out")
		.map((n) => `${nameOf(n.seat)} ${n.status === "picked" ? "has picked" : "is still thinking"}`);

	if (view.phase === "guess") {
		const mine = view.said?.find((c) => c.seat === you) ?? null;
		const landed = mine
			? mine.cancelled
				? `your ${pictureArt(mine.picture).short} tore away: great minds.`
				: `your ${pictureArt(mine.picture).short} landed.`
			: (view.clues ?? []).length === 0
				? "nothing landed, so three tiles fogged over."
				: null;
		const line = landed ? `${guesserName} is guessing. ${landed}` : `${guesserName} is guessing.`;
		const tally = roundLine(view);
		const plan = spreadPlan({ width, height, s, line, pips: null, tally, labels: view.spread.map(shortName) });
		const handLine = (
			<T role="handLg" align="center" numberOfLines={plan.handLines} maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-hand-line">
				{line}
			</T>
		);
		const grid = (
			<View
				style={[styles.grid, { width: plan.tileW * 3 + plan.gridGap * 2, gap: plan.gridGap }, fitted ? { height: plan.gridH } : null]}
				accessibilityRole="list"
				testID="snout-spread"
			>
				{view.spread.map((p) => {
					const state: TileState =
						p === nose.target ? "ringed" : view.sniffed.includes(p) ? "fogged" : view.dimmed.includes(p) ? "dimmed" : "idle";
					return (
						<PictureTile
							key={`${view.round}:${p}`}
							id={p}
							size={plan.tileW}
							height={plan.tileH}
							state={state}
							label
							labelLines={plan.labelLines}
							reduceMotion={reduceMotion}
							accessibilityLabel={
								p === nose.target
									? `${pictureArt(p).name}, the answer`
									: state === "idle"
										? pictureArt(p).name
										: `${pictureArt(p).name}, not this one`
							}
							testID={`snout-spread-${p}`}
						/>
					);
				})}
			</View>
		);
		const footer =
			plan.footer === "full" ? (
				<T role="kicker" tone="secondary" align="center" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					{tally}
				</T>
			) : null;
		if (height === undefined) {
			return (
				<View style={styles.board} testID="snout-board-nose-watching">
					{handLine}
					{grid}
					{footer}
				</View>
			);
		}
		return <SpreadFrame height={height} plan={plan} testID="snout-board-nose-watching" line={handLine} grid={grid} footer={footer} />;
	}

	const instruction = `show a picture that reminds you of it. ${guesserName} guesses.`;
	const othersLine = others.length > 0 ? others.join(" · ") : null;
	const plan = nosePlan({ width, height, s, title: theName(nose.target), instruction, others: othersLine, labels: nose.tray.map(shortName) });
	const record = { spread: view.spread, target: nose.target, guesses: [], sniffed: [], index: view.round };
	const lifted = myPick ?? selected;
	const tray = plan.tray;

	const answer =
		plan.answer === "grid" ? (
			<View style={styles.answerRow}>
				<MiniSpread record={record} reduceMotion={reduceMotion} celebrate={false} tile={fitted ? plan.mini : undefined} />
				<View style={styles.answerText}>
					<Kicker star={false} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						the answer
					</Kicker>
					<CardTitle numberOfLines={plan.titleLines} maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-answer">
						{theName(nose.target)}
					</CardTitle>
					{plan.instruction ? (
						<Hand tone="secondary" numberOfLines={plan.instructionLines} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							{instruction}
						</Hand>
					) : null}
				</View>
			</View>
		) : (
			<View style={styles.answerStack}>
				<AnswerLine
					target={nose.target}
					height={plan.titleRowH}
					ringed={plan.answer === "line" ? plan.mini : null}
					reduceMotion={reduceMotion}
				/>
				{plan.answer === "row" ? <MiniSpread record={record} reduceMotion={reduceMotion} celebrate={false} tile={plan.mini} columns={9} /> : null}
			</View>
		);

	const trayNode = (
		<View
			style={[
				styles.tray,
				fitted ? styles.trayFitted : null,
				fitted ? { width: tray.columns * tray.tileW + (tray.columns - 1) * tray.gap, height: tray.h, gap: tray.gap } : null,
			]}
			accessibilityRole="list"
			testID="snout-tray"
		>
			{nose.tray.map((p) => {
				const isLifted = lifted === p;
				return (
					<PictureTile
						key={`${view.round}:${p}`}
						id={p}
						size={tray.tileW}
						height={tray.tileH}
						state={isLifted ? "lifted" : "idle"}
						label
						labelLines={tray.labelLines}
						hitSlop={tray.hitSlop}
						reduceMotion={reduceMotion}
						onPress={
							canPick
								? () => {
										Haptics.selectionAsync().catch(() => {});
										setSelected((cur) => (cur === p ? null : p));
									}
								: undefined
						}
						accessibilityLabel={myPick === p ? `${pictureArt(p).name}, your clue` : pictureArt(p).name}
						accessibilityHint="Picks this picture as your clue"
						testID={`snout-tray-${p}`}
					/>
				);
			})}
		</View>
	);

	const othersNode =
		plan.others && othersLine ? (
			<Hand tone="secondary" align="center" numberOfLines={plan.othersLines} maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-others">
				{othersLine}
			</Hand>
		) : null;

	const action = myPick ? (
		<Sticker
			color="sage"
			rotate={0}
			shadow="sm"
			style={[styles.shown, fitted ? { minHeight: plan.button } : null]}
			accessibilityRole="text"
			accessibilityLabel={`You showed ${theName(myPick)}. It is final.`}
			testID="snout-shown"
		>
			<Icon name="check" size={PIP} />
			<T role="hand" maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.shownText}>{`you showed ${theName(myPick)}. it's final.`}</T>
		</Sticker>
	) : (
		<Button
			variant="gold"
			size="lg"
			full
			disabled={!selected || !canPick}
			loading={pending}
			loadingLabel="showing it"
			onPress={() => void show()}
			maxFontSizeMultiplier={CHROME_TYPE_CAP}
			accessibilityLabel={selected ? `Show ${theName(selected)}` : "Show this one"}
			accessibilityHint={selected ? "Shows this picture as your clue. It is final." : "Pick a picture above first"}
			testID="snout-show"
		>
			{selected ? "Show this one" : "Pick a picture"}
		</Button>
	);

	if (!fitted) {
		return (
			<View style={styles.board} testID="snout-board-nose">
				{answer}
				{trayNode}
				{othersNode}
				{action}
			</View>
		);
	}
	return (
		<View style={[styles.fitted, { height }]} testID="snout-board-nose">
			<View style={styles.region}>{answer}</View>
			<View style={[styles.pinned, { marginTop: plan.gap }]} testID="snout-foot">
				{trayNode}
				{othersNode ? (
					<View style={[styles.slot, { height: plan.othersH, marginTop: plan.gap }]} testID="snout-others-slot">
						{othersNode}
					</View>
				) : null}
				<View style={[styles.slot, { height: plan.button, marginTop: plan.gap }]} testID="snout-action">
					{action}
				</View>
			</View>
		</View>
	);
}

/** The folded answer card: "the answer:" and the name on one line, led by
 *  the answer's own ringed tile once the small spread has gone too. */
function AnswerLine({ target, height, ringed, reduceMotion }: { target: PictureId; height: number; ringed: number | null; reduceMotion: boolean }) {
	return (
		<View
			style={[styles.answerLine, { height }]}
			accessible
			accessibilityRole="text"
			accessibilityLabel={`The answer: ${theName(target)}`}
			testID="snout-answer-line"
		>
			{ringed !== null ? <PictureTile id={target} size={ringed} height={ringed} state="ringed" reduceMotion={reduceMotion} /> : null}
			<Kicker star={false} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
				the answer:
			</Kicker>
			<T role="cardTitleSm" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.answerName} testID="snout-answer">
				{theName(target)}
			</T>
		</View>
	);
}

const styles = StyleSheet.create({
	board: { gap: SPACE.md },
	// Fitted: exactly the height the match screen measured.
	fitted: { alignSelf: "stretch" },
	// What is left above the pinned foot. Clipped, so a wrong estimate costs
	// the words an edge, never the taps their place; bled out by LIST_BLEED so
	// a tile's side shadow is not the edge that clips.
	region: {
		flex: 1,
		minHeight: 0,
		justifyContent: "center",
		overflow: "hidden",
		marginHorizontal: -LIST_BLEED,
		paddingHorizontal: LIST_BLEED,
	},
	pinned: { paddingBottom: FOOT },
	slot: { justifyContent: "center" },
	scroll: { flex: 1, marginHorizontal: -LIST_BLEED },
	scrollContent: { gap: SPACE.md, paddingHorizontal: LIST_BLEED, paddingBottom: FOOT },
	grid: { flexDirection: "row", flexWrap: "wrap", alignSelf: "center" },
	tray: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm },
	trayFitted: { alignSelf: "center" },
	footer: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACE.sm },
	footerTally: { flexShrink: 1, marginLeft: "auto" },
	pips: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
	pip: { width: PIP, height: PIP, borderRadius: RADII.pill, borderWidth: BORDER.ink, borderColor: UI_COLORS.border },
	pipOn: { backgroundColor: WHIMSY.sun },
	pipSpent: { backgroundColor: WHIMSY.cream2, borderStyle: "dashed" },
	answerRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	answerText: { flex: 1, minWidth: 0, gap: SPACE.xxs },
	answerStack: { gap: SPACE.xs },
	answerLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	answerName: { flexShrink: 1 },
	shown: {
		minHeight: BUTTON_SIZE.lg.minH,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.sm,
		paddingHorizontal: SPACE.lg,
	},
	shownText: { flexShrink: 1 },
});
