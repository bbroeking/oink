// The envelope (async pace): one sealed action holds your whole match.
//
//   form     your three tosses against your three wind-ups, then your three
//            catches against theirs; the same lane cards as a live toss, a
//            review row of all six picks (tap one to change it), then the
//            Seal the envelope ticket.
//   waiting  "Your toss is sealed. We'll tell you when a pig opens it." and
//            your six picks, read-only.
//   reel     once both envelopes are in, the six reveals replay in the
//            pasture (2.6 s each, skippable), then the final scene. It plays
//            whenever the finished match is opened, because for an envelope
//            that is the moment the pig first sees it.
//
// Each fills the height the match screen gives it, the way the live board
// does (./layout.ts volleyPlan, ./FitFrame.tsx): the form pins its cards, the
// review row and the Seal ticket; the waiting envelope its review row; the
// reel its cards and the skip link. The pasture and the cards' art take what
// is left.

import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { Button, Sticker, T, TicketButton, showToast } from "@/components/ui";
import { BORDER, RADII, SPACE } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { VOLLEY_TIMING, type Lane, type VolleyRow, type VolleyView } from "@/multiplayer/games/mud_volley/rules";
import type { BoardProps } from "../../types";
import { useTextScale } from "../fit";
import {
	ENVELOPE_WAITING,
	LANE_WORD,
	TABLE_CLOSED,
	envelopeSlotLabel,
	envelopeStepLine,
	envelopeSteps,
	finalLine,
	revealLine,
	type EnvelopeStep,
} from "./copy";
import { FitFrame } from "./FitFrame";
import { LaneCards } from "./LaneCards";
import { volleyPlan, type VolleyBoardKind } from "./layout";
import { Pasture, ScoreSticker, type RevealStage } from "./Pasture";
import {
	QUIET_ERRORS,
	REEL_STEP_MS,
	VOLLEY_TYPE_CAP,
	finalReactions,
	mudOf,
	revealReactions,
	scoreOf,
	seatLook,
	seatName,
	useReactions,
} from "./scene";

const NO_REACTIONS = {};
const noop = () => {};

/** One board kind's plan at the board's height and live text scale. */
function usePlan(kind: VolleyBoardKind, height: number | undefined) {
	const scale = useTextScale(VOLLEY_TYPE_CAP);
	return useMemo(() => volleyPlan({ kind, height, s: scale }), [kind, height, scale]);
}

export function EnvelopeBoard(props: BoardProps<VolleyView>) {
	if (props.view.phase === "done") return <EnvelopeReel {...props} />;
	if (props.view.yourEnvelope || props.room.phase === "ended") return <EnvelopeWaiting {...props} />;
	return <EnvelopeForm {...props} />;
}

function EnvelopeForm({ view, room, you, yourTurn, act, pending, reduceMotion, width, height }: BoardProps<VolleyView>) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const plan = usePlan("form", height);
	const steps = envelopeSteps(view);
	const [picks, setPicks] = useState<(Lane | null)[]>(() => steps.map(() => null));
	const [cursor, setCursor] = useState(0);
	const step: EnvelopeStep | undefined = steps[cursor];
	const filled = picks.filter((p) => p !== null).length;
	const complete = steps.length > 0 && filled === steps.length;
	const rivalName = seatName(room, view.rival);

	const pick = (lane: Lane) => {
		const next = picks.slice();
		next[cursor] = lane;
		setPicks(next);
		// On to the next empty pick after this one, else the first empty one.
		const after = next.findIndex((p, i) => i > cursor && p === null);
		const first = next.findIndex((p) => p === null);
		if (after >= 0) setCursor(after);
		else if (first >= 0) setCursor(first);
	};

	const seal = async () => {
		if (!complete || pending || !yourTurn) return;
		const tosses = picks.slice(0, steps.filter((s) => s.role === "toss").length) as Lane[];
		const catches = picks.slice(tosses.length) as Lane[];
		const res = await act({ type: "envelope", tosses, catches });
		if (!res.ok && !QUIET_ERRORS.has(res.error)) {
			showToast({ tone: "fail", title: "The envelope didn't go through", text: "Your picks are still here. Try again." });
		}
	};

	if (!step) return null;
	const card = plan.card;
	return (
		<FitFrame
			plan={plan}
			testID="volley-envelope-form"
			foot={
				<>
					<View style={{ height: card?.height ?? 0 }}>
						{card ? (
							<LaneCards
								role={step.role}
								windup={step.windup}
								picked={picks[cursor] ?? null}
								locked={null}
								rivalLane={null}
								reveal={false}
								asleep={pending || !yourTurn}
								you={you}
								rival={view.rival}
								onPick={pick}
								reduceMotion={reduce}
								size={card}
							/>
						) : null}
					</View>
					<ReviewRow steps={steps} picks={picks} cursor={cursor} height={plan.review} onSlot={pending ? undefined : setCursor} />
					<View style={{ height: plan.ticket }}>
						<TicketButton
							tone="golden"
							full
							stub={`${filled}/${steps.length}`}
							stubCaption="picked"
							label={complete ? "Seal the envelope" : "Pick all six"}
							disabled={!complete || !yourTurn}
							loading={pending}
							loadingLabel="sealing it"
							onPress={() => void seal()}
							accessibilityLabel={complete ? "Seal the envelope" : `Seal the envelope, ${filled} of ${steps.length} picked`}
							accessibilityHint="Sends all six picks at once. They can't be changed."
							testID="volley-seal"
						/>
					</View>
				</>
			}
		>
			<T role="kicker" tone="secondary" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={{ height: plan.kicker }}>
				{view.rivalLocked ? `${rivalName} sealed theirs. Your turn.` : "a sealed toss · all six at once"}
			</T>
			{plan.sceneH > 0 ? (
				<Pasture
					width={width}
					sceneH={plan.sceneH}
					you={you}
					rival={view.rival}
					youLook={seatLook(room, you)}
					rivalLook={seatLook(room, view.rival)}
					attacker={step.role === "toss" ? you : view.rival}
					windup={step.windup}
					arcKey={`envelope:${cursor}`}
					flight={null}
					rivalSealed={view.rivalLocked}
					mud={[0, 0]}
					reactions={NO_REACTIONS}
					onReactionDone={noop}
					reduceMotion={reduce}
					accessibilityLabel={`The envelope. ${filled} of ${steps.length} picked.`}
				/>
			) : null}
			<T role="handLg" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={{ height: plan.hand }} testID="volley-hand-line">
				{envelopeStepLine(step)}
			</T>
		</FitFrame>
	);
}

/** Your envelope is in (or the room closed the table before it opened). */
function EnvelopeWaiting({ view, room, you, reduceMotion, width, height }: BoardProps<VolleyView>) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const plan = usePlan("waiting", height);
	const steps = envelopeSteps(view);
	const mine = view.yourEnvelope;
	const picks = mine ? [...mine.tosses, ...mine.catches] : [];
	const closed = room.phase === "ended";
	return (
		<FitFrame
			plan={plan}
			testID="volley-envelope-waiting"
			foot={mine ? <ReviewRow steps={steps} picks={picks} cursor={null} height={plan.review} /> : <View style={{ height: plan.review }} />}
		>
			{plan.sceneH > 0 ? (
				<Pasture
					width={width}
					sceneH={plan.sceneH}
					you={you}
					rival={view.rival}
					youLook={seatLook(room, you)}
					rivalLook={seatLook(room, view.rival)}
					attacker={null}
					windup={null}
					arcKey="envelope:sealed"
					flight={null}
					rivalSealed={view.rivalLocked}
					mud={[0, 0]}
					reactions={NO_REACTIONS}
					onReactionDone={noop}
					reduceMotion={reduce}
					accessibilityLabel={closed ? TABLE_CLOSED : "Your envelope is sealed."}
				/>
			) : null}
			<T role="handLg" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={{ height: plan.hand }} testID="volley-hand-line">
				{closed ? TABLE_CLOSED : ENVELOPE_WAITING}
			</T>
		</FitFrame>
	);
}

function EnvelopeReel({ view, room, you, reduceMotion, width, height }: BoardProps<VolleyView>) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const plan = usePlan("reel", height);
	const rivalName = seatName(room, view.rival);
	// The six rows never change once the match is done; keep the first copy
	// so a later revision (a rematch vote) never restarts the reel mid-toss.
	const [rows] = useState<VolleyRow[]>(() => view.history);
	const [finalScore] = useState<number[]>(() => view.score.slice());
	const [index, setIndex] = useState(0);
	const [stage, setStage] = useState<RevealStage>("flight");
	const { reactions, play, done } = useReactions();
	const row = index < rows.length ? rows[index] : null;

	useEffect(() => {
		if (index >= rows.length) return;
		const current = rows[index];
		const land = setTimeout(() => {
			setStage("impact");
			play(revealReactions(current));
			AccessibilityInfo.announceForAccessibility(revealLine(current, you, rivalName));
		}, VOLLEY_TIMING.arcMs);
		const nextToss = setTimeout(() => {
			setStage("flight");
			setIndex((i) => i + 1);
			if (index + 1 === rows.length) play(finalReactions(finalScore));
		}, REEL_STEP_MS);
		return () => {
			clearTimeout(land);
			clearTimeout(nextToss);
		};
	}, [index, rows, play, you, rivalName, finalScore]);

	const shown = row ? [...rows.slice(0, index), ...(stage === "impact" ? [row] : [])] : rows;
	const score = scoreOf(shown);
	const counter = row ? `toss ${row.ex + 1} of ${view.exchanges}` : "the envelope, opened";
	const line = row ? (stage === "impact" ? revealLine(row, you, rivalName) : "Here it comes!") : finalLine(view, rivalName);
	const shownRow = row ?? rows[rows.length - 1] ?? null;

	const card = plan.card;
	return (
		<FitFrame
			plan={plan}
			testID="volley-envelope-reel"
			foot={
				<>
					<View style={{ height: card?.height ?? 0 }}>
						{card && shownRow ? (
							<LaneCards
								role={shownRow.attacker === you ? "toss" : "catch"}
								windup={shownRow.windup}
								picked={null}
								locked={shownRow.attacker === you ? shownRow.toss : shownRow.catchLane}
								rivalLane={shownRow.attacker === you ? shownRow.catchLane : shownRow.toss}
								reveal
								asleep={false}
								you={you}
								rival={view.rival}
								reduceMotion={reduce}
								size={card}
							/>
						) : null}
					</View>
					<View style={[styles.link, { height: plan.link }]}>
						{row ? (
							<Button
								variant="handLink"
								onPress={() => {
									setIndex(rows.length);
									setStage("flight");
									play(finalReactions(finalScore));
								}}
								accessibilityLabel="Skip to the end"
								accessibilityHint="Jumps to the end of the six tosses"
								maxFontSizeMultiplier={VOLLEY_TYPE_CAP}
								testID="volley-reel-skip"
							>
								Skip to the end
							</Button>
						) : (
							<Button
								variant="handLink"
								onPress={() => {
									setIndex(0);
									setStage("flight");
								}}
								accessibilityLabel="Watch it again"
								accessibilityHint="Plays the six tosses again"
								maxFontSizeMultiplier={VOLLEY_TYPE_CAP}
								testID="volley-reel-again"
							>
								Watch it again
							</Button>
						)}
					</View>
				</>
			}
		>
			<View style={[styles.scoreRow, { height: plan.score }]}>
				<ScoreSticker seat={you} name="You" score={score[you] ?? 0} side="left" />
				<T role="kicker" tone="secondary" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={styles.counter}>
					{counter}
				</T>
				<ScoreSticker seat={view.rival} name={rivalName} score={score[view.rival] ?? 0} side="right" />
			</View>
			{plan.sceneH > 0 ? (
				<Pasture
					width={width}
					sceneH={plan.sceneH}
					you={you}
					rival={view.rival}
					youLook={seatLook(room, you)}
					rivalLook={seatLook(room, view.rival)}
					attacker={row ? row.attacker : null}
					windup={null}
					arcKey="envelope:reel"
					flight={row ? { row, stage } : null}
					rivalSealed={false}
					mud={mudOf(shown)}
					reactions={reactions}
					onReactionDone={done}
					reduceMotion={reduce}
					accessibilityLabel={`You ${score[you] ?? 0}, ${rivalName} ${score[view.rival] ?? 0}. ${counter}.`}
				/>
			) : null}
			<T role="handLg" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={{ height: plan.hand }} testID="volley-hand-line">
				{line}
			</T>
		</FitFrame>
	);
}

/** All six picks at a glance: T1–T3 your tosses, C1–C3 your catches. In the
 *  form a slot is a door back to that pick. */
function ReviewRow({
	steps,
	picks,
	cursor,
	height,
	onSlot,
}: {
	steps: EnvelopeStep[];
	picks: (Lane | null)[];
	cursor: number | null;
	/** The planned row height (./layout.ts reviewRowHeight). */
	height: number;
	onSlot?: (index: number) => void;
}) {
	return (
		<View style={[styles.review, { height }]} testID="volley-review-row">
			{steps.map((step, i) => {
				const pick = picks[i] ?? null;
				const current = cursor === i;
				const name = `${step.role === "toss" ? "Toss" : "Catch"} ${step.index + 1}`;
				return (
					<Sticker
						key={`${step.role}-${step.index}`}
						color={current ? "sun" : pick ? "paper" : "cream"}
						radius={RADII.md}
						border={current ? BORDER.heavy : BORDER.ink}
						borderStyle={pick || current ? "solid" : "dashed"}
						shadow={current ? "sm" : "none"}
						rotate={0}
						onPress={onSlot ? () => onSlot(i) : undefined}
						accessibilityRole={onSlot ? "button" : "text"}
						accessibilityLabel={`${name}, ${pick ? LANE_WORD[pick] : "not picked yet"}`}
						accessibilityHint={onSlot ? "Goes back to this pick" : undefined}
						accessibilityState={{ selected: current }}
						style={styles.slot}
						testID={`volley-review-${i}`}
					>
						<T role="kickerPillSm" tone="secondary" maxFontSizeMultiplier={VOLLEY_TYPE_CAP}>
							{envelopeSlotLabel(step)}
						</T>
						<T role="cardTitleSm" maxFontSizeMultiplier={VOLLEY_TYPE_CAP}>
							{pick ?? "?"}
						</T>
					</Sticker>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
	counter: { flexShrink: 0 },
	link: { alignItems: "center", justifyContent: "center" },
	review: { flexDirection: "row", gap: SPACE.xs, alignItems: "stretch" },
	slot: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingVertical: SPACE.xxs },
});
