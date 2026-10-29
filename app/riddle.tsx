// The Sheep's Riddle: one shared picture riddle a day (proposal A,
// docs/explorations/2026-10-29-small-games/proposal.md). Reached from the
// Barn button's fan, beside the Trader, where the day's things live.
//
// The Ghost Sheep nods at a clue picture, and at another each time you ask,
// up to three. Nine pictures lie in the mud; exactly one is kin to every
// clue. Two guesses. Everyone gets the same riddle on the same UTC day, so
// the share line means the same thing to the whole herd. Solved or not, the
// answer is shown with the tags that tie it to each clue, so every riddle
// teaches the deck. Nothing is minted (v1): the solve and the share line are
// the reward. The rules are utils/dailyRiddle.ts; the device's record is
// hooks/useDailyRiddle.ts.
import { useState } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
	Body,
	Button,
	CardTitle,
	Glyph,
	Hand,
	LoadingBeat,
	PageHeader,
	STACK_SCROLL_EDGES,
	StackPage,
	Sticker,
	T,
	useStackScrollPad,
} from "@/components/ui";
import { TraderSprite } from "@/components/trader/TraderArt";
import { PictureTile, type TileState } from "@/components/play/games/snout_says/PictureTile";
import { listWords, pictureArt } from "@/components/play/games/snout_says/pictures";
import { ART_SIZE, BORDER, CHROME_TYPE_CAP, PAGE_PAD, RADII, SPACE } from "@/constants/theme";
import type { TraderAnim } from "@/constants/traderFrames";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { useDailyRiddle } from "@/hooks/useDailyRiddle";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import {
	RIDDLE_ANSWERS,
	RIDDLE_CLUES,
	guessesLeft,
	nextRiddleAt,
	shareLine,
	sharedTags,
	type DailyRiddle,
	type RiddleOutcome,
	type RiddlePlay,
} from "@/utils/dailyRiddle";

const COLUMNS = 3;

function sheepLine(riddle: DailyRiddle, play: RiddlePlay, outcome: RiddleOutcome): string {
	const answer = pictureArt(riddle.secret).name;
	if (outcome === "solved") return `He bows. The ${answer} it is.`;
	if (outcome === "failed") return `He shows you: the ${answer}. Kin to all three.`;
	const shown = riddle.clues.slice(0, play.revealed).map((c) => pictureArt(c).withArticle);
	if (play.guesses.length > 0) return "He shakes his head. One guess left.";
	if (play.revealed < RIDDLE_CLUES) {
		return `He nods at ${listWords(shown)}. One picture in the mud is kin to every clue he gives.`;
	}
	return `He nods at ${listWords(shown)}. Which one is kin to all three?`;
}

function guessLine(play: RiddlePlay): string {
	return guessesLeft(play) === 1 ? "one guess left" : "two guesses";
}

function nextDealTime(): string {
	return nextRiddleAt().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function RiddleScreen() {
	const scrollPad = useStackScrollPad();
	const { width } = useWindowDimensions();
	const motion = useMotionPolicy();
	const { riddle, book, outcome, reveal, guess } = useDailyRiddle();
	const [sheep, setSheep] = useState<{ anim: TraderAnim; cue: number }>({ anim: "greet", cue: 0 });
	const [copied, setCopied] = useState(false);

	// Three tiles a row inside the page gutters, one gap between each.
	const tile = Math.floor((width - PAGE_PAD * 2 - SPACE.md * (COLUMNS - 1)) / COLUMNS);

	// The sheep answers a guess that landed: a bow for the right one, a shake
	// for a miss, and VoiceOver hears what the eye sees.
	const onGuess = (picture: PictureId) => {
		const after = guess(picture);
		if (!after) return;
		setSheep((s) => ({ anim: after === "solved" ? "greet" : "shake", cue: s.cue + 1 }));
		AccessibilityInfo.announceForAccessibility(
			after === "solved"
				? `Yes. The ${pictureArt(picture).name} is the answer.`
				: after === "failed"
					? `Not this one. The answer was the ${pictureArt(riddle.secret).name}.`
					: "Not this one. One guess left.",
		);
	};

	const copy = async () => {
		if (!book) return;
		try {
			await Clipboard.setStringAsync(shareLine(riddle, book.play));
			setCopied(true);
		} catch {
			// The clipboard said no: nothing to undo.
		}
	};

	const header = (
		<PageHeader
			kicker={`riddle ${riddle.number} · the same for every pig today`}
			title="The Sheep's Riddle"
			onBack={() => router.back()}
		/>
	);

	if (!book) {
		return (
			<StackPage edges={STACK_SCROLL_EDGES}>
				{header}
				<View style={styles.loading}>
					<LoadingBeat label="the sheep is thinking" />
				</View>
			</StackPage>
		);
	}

	const play = book.play;
	const over = outcome !== "playing";

	const answerState = (id: PictureId): TileState => {
		if (play.guesses.includes(id) && id !== riddle.secret) return "dimmed";
		if (over && id === riddle.secret) return "ringed";
		return "idle";
	};

	return (
		<StackPage edges={STACK_SCROLL_EDGES} testID="riddle-screen">
			{header}
			<ScrollView
				contentContainerStyle={[styles.scroll, { paddingBottom: scrollPad }]}
				showsVerticalScrollIndicator={false}
			>
				{/* The sheep and what he says. The sprite is decoration: the line
				    beside him carries everything a screen reader needs. */}
				<View style={styles.sheepRow}>
					<View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
						<TraderSprite size={ART_SIZE.thumb} anim={sheep.anim} cue={sheep.cue} />
					</View>
					<Sticker
						color="paper"
						rotate={0}
						radius={RADII.lg}
						border={BORDER.thin}
						shadow="none"
						style={styles.speech}
					>
						<Hand testID="riddle-sheep-line">{sheepLine(riddle, play, outcome)}</Hand>
					</Sticker>
				</View>

				{/* The clues, shown in turn. An unasked clue is a dashed slot. */}
				<View style={styles.row} testID="riddle-clues">
					{riddle.clues.map((clue, i) =>
						i < play.revealed ? (
							<PictureTile
								key={clue}
								id={clue}
								size={tile}
								label
								reduceMotion={motion.reduceMotion}
								accessibilityLabel={`Clue ${i + 1}: ${pictureArt(clue).name}`}
								testID={`riddle-clue-${i}`}
							/>
						) : (
							<Sticker
								key={`hidden-${i}`}
								color="cream2"
								rotate={0}
								radius={RADII.lg}
								border={BORDER.ink}
								borderStyle="dashed"
								shadow="none"
								style={[styles.hiddenClue, { width: tile, minHeight: tile }]}
								accessibilityRole="image"
								accessibilityLabel={`Clue ${i + 1}, not shown yet`}
								testID={`riddle-clue-${i}`}
							>
								<T role="numeral" tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
									?
								</T>
							</Sticker>
						),
					)}
				</View>
				{!over && play.revealed < RIDDLE_CLUES ? (
					<Button
						variant="lilac"
						size="md"
						onPress={reveal}
						accessibilityHint="The sheep nods at one more picture"
						testID="riddle-more"
					>
						Another clue
					</Button>
				) : null}

				{/* The nine in the mud. */}
				<View style={styles.mudHeading}>
					<T role="label">In the mud</T>
					{!over ? (
						<Hand tone="secondary" testID="riddle-guesses">
							{guessLine(play)}
						</Hand>
					) : null}
				</View>
				<View style={styles.grid} testID="riddle-answers">
					{riddle.answers.map((id, i) => {
						const state = answerState(id);
						const name = pictureArt(id).name;
						const tappable = !over && state === "idle";
						const label =
							state === "dimmed"
								? `${name}, not this one`
								: state === "ringed"
									? `${name}, the answer`
									: `${name}, picture ${i + 1} of ${RIDDLE_ANSWERS}`;
						return (
							<PictureTile
								key={id}
								id={id}
								size={tile}
								label
								state={state}
								celebrate={outcome === "solved"}
								reduceMotion={motion.reduceMotion}
								onPress={tappable ? () => onGuess(id) : undefined}
								accessibilityLabel={label}
								accessibilityHint="Guesses this picture"
								testID={`riddle-answer-${id}`}
							/>
						);
					})}
				</View>

				{over ? (
					<Sticker
						color={outcome === "solved" ? "sun" : "paper"}
						rotate={0}
						radius={RADII.xl}
						border={BORDER.ink}
						shadow="sm"
						style={styles.result}
						testID="riddle-result"
					>
						<CardTitle>
							{outcome === "solved"
								? play.guesses.length === 1
									? "Got it in one."
									: "Got it in two."
								: "The sheep kept this one."}
						</CardTitle>
						<Body>{`Why the ${pictureArt(riddle.secret).name} is kin to all three:`}</Body>
						{riddle.clues.map((clue) => (
							<View key={clue} style={styles.tie}>
								<Glyph name={pictureArt(clue).glyph} size={ART_SIZE.glyphSm} />
								<Hand style={styles.tieText}>
									{`${pictureArt(clue).short}: ${sharedTags(clue, riddle.secret).join(" · ")}`}
								</Hand>
							</View>
						))}
						<Button
							variant={copied ? "success" : "ghost"}
							size="sm"
							onPress={() => void copy()}
							accessibilityHint="Copies a line about today's riddle to share with friends"
							testID="riddle-copy"
						>
							{copied ? "Copied" : "Copy the share line"}
						</Button>
						<Hand tone="secondary" testID="riddle-tomorrow">
							{`Come back tomorrow for the next riddle. It deals at ${nextDealTime()}.`}
						</Hand>
						<Hand tone="secondary">
							{book.solved === 1 ? "1 riddle solved on this phone" : `${book.solved} riddles solved on this phone`}
						</Hand>
					</Sticker>
				) : null}
			</ScrollView>
		</StackPage>
	);
}

const styles = StyleSheet.create({
	loading: { flex: 1, alignItems: "center", justifyContent: "center" },
	scroll: { paddingHorizontal: PAGE_PAD, gap: SPACE.lg },
	sheepRow: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	speech: { flex: 1, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.md },
	row: { flexDirection: "row", gap: SPACE.md },
	hiddenClue: { alignItems: "center", justifyContent: "center" },
	mudHeading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.md },
	result: { gap: SPACE.sm, padding: SPACE.lg },
	tie: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
	tieText: { flex: 1 },
});
