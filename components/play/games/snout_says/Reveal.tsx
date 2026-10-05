// The reveal: the round just scored, played as a three-second story before
// the next beat (the server pads the next clue beat by the same time, and
// the match screen holds the result sheet for it after the last round).
//   1. what was said: the clues that landed drop in; a picture two Noses
//      both showed tears away with a giggle (no seat named: the bubbles
//      over the pigs already said whose was whose)
//   2. what it was: the answer rings in sun on the small spread, the wrong
//      taps dimmed and the fog still on
//   3. how it went: the outcome word (knew · nearly · got away · in the
//      mud) and the running total
// The card pops in on the dialog recipe; a tap moves on early. Reduce
// Motion: the card cross-fades in and everything is simply in place.
//
// Fitted to a short board (a RevealPlan from ./layout.ts), the card's inset
// and gaps tighten, the small spread steps down, the outcome word drops from
// display to section-title type and, last, the round kicker goes.
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { CHROME_TYPE_CAP, MOTION_SPRING, SPACE } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import type { SnoutSaysRecord } from "@/multiplayer/games/snout_says/rules";
import { Hand, Kicker, Sticker, T } from "@/components/ui";
import { ClueBubble } from "./ClueBubble";
import { MINI_GAP, MINI_TILE, miniSpan, type RevealPlan } from "./layout";
import { OUTCOME_WORD, outcomeLine, tallyLine, theName } from "./pictures";
import { PictureTile, type TileState } from "./PictureTile";

// Drawing geometry: how far the outcome word drops in.
const WORD_DROP = 16;

/** Said when a round had no clue at all. */
export const NOTHING_SAID = "no clue this round, so three tiles fogged over.";

export function MiniSpread({
	record,
	reduceMotion,
	celebrate,
	tile,
	columns = 3,
}: {
	record: Pick<SnoutSaysRecord, "spread" | "target" | "guesses" | "sniffed" | "index">;
	reduceMotion: boolean;
	celebrate: boolean;
	/** A fitted mini tile's edge (the board's plan); omitted: the natural 40pt. */
	tile?: number;
	/** Three across (beside the answer's words) or nine (one row under them). */
	columns?: number;
}) {
	const edge = tile ?? MINI_TILE;
	return (
		<View
			style={[styles.mini, { width: miniSpan(edge, columns) }]}
			accessible
			accessibilityRole="image"
			accessibilityLabel={`The answer: ${theName(record.target)}`}
			testID="snout-mini-spread"
		>
			{record.spread.map((p) => {
				const state: TileState =
					p === record.target
						? "ringed"
						: record.sniffed.includes(p)
							? "fogged"
							: record.guesses.includes(p)
								? "dimmed"
								: "idle";
				return (
					<PictureTile
						key={`${record.index}:${p}`}
						id={p}
						size={edge}
						height={tile}
						state={state}
						celebrate={celebrate}
						reduceMotion={reduceMotion}
					/>
				);
			})}
		</View>
	);
}

export function Reveal({
	record,
	rounds,
	total,
	maxTotal,
	reduceMotion,
	animate,
	onContinue,
	plan,
}: {
	record: SnoutSaysRecord;
	rounds: number;
	/** The running total, this round included. */
	total: number;
	maxTotal: number;
	reduceMotion: boolean;
	/** Play the story (false: the settled card, e.g. reopening a finished table). */
	animate: boolean;
	/** Move on early; omitted on the final round. */
	onContinue?: () => void;
	/** Fitted to a short board; omitted: the natural card. */
	plan?: RevealPlan;
}) {
	const policy = useMotionPolicy();
	const still = reduceMotion || policy.reduceMotion || !animate;
	const [scale] = useState(() => new Animated.Value(still ? 1 : 0));
	const [opacity] = useState(() => new Animated.Value(still ? 1 : 0));
	const [word] = useState(() => new Animated.Value(still ? 1 : 0));

	useEffect(() => {
		if (!animate) return;
		const reduced = reduceMotion || policy.reduceMotion;
		const entrance = popIn(
			scale,
			opacity,
			reduced ? { ...policy, reduceMotion: true, allowDecorativeMotion: false, largeTransition: "crossfade" } : policy,
		);
		if (reduced) {
			word.setValue(1);
			entrance.start();
			return () => entrance.stop();
		}
		const run = Animated.parallel([
			entrance,
			Animated.sequence([
				Animated.delay(MOTION_DURATION.celebration),
				Animated.spring(word, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot }),
			]),
		]);
		run.start();
		return () => run.stop();
	}, [animate, reduceMotion, policy, scale, opacity, word]);

	const landed = record.clues.length > 0 ? record.clues.map((c) => theName(c)).join(", ") : "nothing landed";
	const summary = `Round ${record.index + 1}. The answer was ${theName(record.target)}. Clues: ${landed}. ${OUTCOME_WORD[record.outcome]}. ${tallyLine(total, maxTotal)}.`;

	return (
		<Animated.View style={{ opacity, transform: [{ scale }] }} testID="snout-reveal">
			<Sticker
				color="paper"
				pad={!plan}
				onPress={onContinue}
				accessibilityRole={onContinue ? "button" : "summary"}
				accessibilityLabel={summary}
				accessibilityHint={onContinue ? "Moves on to the next round" : undefined}
				style={[styles.card, plan ? { padding: plan.pad, gap: plan.gap } : null]}
			>
				{plan?.kicker === false ? null : (
					<Kicker star={false} maxFontSizeMultiplier={CHROME_TYPE_CAP}>{`round ${record.index + 1} of ${rounds}`}</Kicker>
				)}
				<View style={styles.said} testID="snout-reveal-said">
					{record.clues.map((p) => (
						<ClueBubble
							key={`said:${record.index}:${p}`}
							entry={{ state: "said", picture: p }}
							label={`${theName(p)} landed`}
							named={plan?.names ?? true}
							reduceMotion={still}
						/>
					))}
					{record.cancelled.map((p) => (
						<ClueBubble
							key={`torn:${record.index}:${p}`}
							entry={{ state: "torn", picture: p }}
							label={`${theName(p)} tore away: two noses showed it`}
							named={plan?.names ?? true}
							reduceMotion={still}
						/>
					))}
					{record.said.length === 0 ? (
						<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP} style={styles.nothing}>
							{NOTHING_SAID}
						</Hand>
					) : null}
				</View>
				<View style={styles.result}>
					<MiniSpread record={record} reduceMotion={still} celebrate tile={plan?.mini} />
					<Animated.View
						style={[
							styles.outcome,
							{
								opacity: word,
								transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [-WORD_DROP, 0] }) }],
							},
						]}
					>
						<T role={plan?.word ?? "display"} maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-outcome">
							{OUTCOME_WORD[record.outcome]}
						</T>
						<Hand tone="secondary" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							{outcomeLine(record)}
						</Hand>
						<T role="numeral" maxFontSizeMultiplier={CHROME_TYPE_CAP} testID="snout-tally">
							{tallyLine(total, maxTotal)}
						</T>
					</Animated.View>
				</View>
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	card: { gap: SPACE.md },
	said: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: SPACE.sm },
	nothing: { flexShrink: 1 },
	result: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
	mini: { flexDirection: "row", flexWrap: "wrap", gap: MINI_GAP },
	outcome: { flex: 1, minWidth: 0, gap: SPACE.xxs },
});
