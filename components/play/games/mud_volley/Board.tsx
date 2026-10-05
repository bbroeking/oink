// Mud Volley's board. The match screen owns the crown, the clock, the seat
// chips (seatStrip "compact": this board stages the pigs itself), emotes and
// the result sheet; this owns the pasture and the thumb zone.
//
// Live, top to bottom: the two score stickers with the toss counter between
// them; the pasture; one hand line that states the whole rule in context;
// three lane cards; the Lock it in ticket. Envelope: EnvelopeBoard.
//
// The board fills the height the match screen gives it (`fillsHeight`): the
// lane cards and the ticket are pinned at its foot at full size, and the
// score row, the pasture and the hand line are planned from what is left
// (./layout.ts volleyPlan): on a short phone the pasture and the cards' art
// scale down, so a turn's answer is never below the fold.
//
// A pure function of the view, plus one local beat. The rules open the next
// toss in the same step that resolves the last one, so the view arrives
// already describing toss N+1 while the pigs have not seen toss N land. The
// board plays that reveal first (settle, then the arc, then the splat or the
// catch) and holds the cards asleep until it has played; on the first toss
// it holds them through the wind-up instead. Every boundary is server time,
// read through `serverNow`: the ball leaves at `lastReveal.at + settle`,
// lands an arc later, and the cards wake at `commitOpensAt`, the instant the
// match screen's arc (`clock`) starts. A view that arrives late gets a
// shorter beat, never a longer one, so no pig loses window to the trip. A
// board that mounts mid-match (no cues) plays no beat and wakes at once.

import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { T, TicketButton, showToast } from "@/components/ui";
import { SPACE } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { VOLLEY_TIMING, type Lane, type VolleyRow, type VolleyView } from "@/multiplayer/games/mud_volley/rules";
import type { GameEvent } from "@/multiplayer/types";
import type { BoardProps } from "../../types";
import { useTextScale } from "../fit";
import { LANE_WORD, TABLE_CLOSED, finalLine, lanePayoff, promptLine, revealLine, tossCounter } from "./copy";
import { EnvelopeBoard } from "./EnvelopeBoard";
import { FitFrame } from "./FitFrame";
import { LaneCards } from "./LaneCards";
import { volleyPlan } from "./layout";
import { Pasture, ScoreSticker, type RevealStage } from "./Pasture";
import {
	QUIET_ERRORS,
	VOLLEY_TYPE_CAP,
	finalReactions,
	mudOf,
	revealReactions,
	scoreOf,
	seatLook,
	seatName,
	useReactions,
} from "./scene";

export function MudVolleyBoard(props: BoardProps<VolleyView>) {
	return props.view.mode === "envelope" ? <EnvelopeBoard {...props} /> : <LiveBoard {...props} />;
}

type BeatStage = "windup" | RevealStage;

interface Beat {
	/** The revision that started it. */
	key: string;
	kind: "windup" | "reveal";
	row: VolleyRow | null;
	stage: BeatStage;
	/** Server ms: the ball leaves the hoof, it lands, the cards wake. */
	flightAt: number;
	impactAt: number;
	endAt: number;
	/** What is left of the arc when the flight starts (a late view flies a
	 *  shorter arc rather than landing late). */
	flightMs: number;
	/** The last toss: the pigs wave when the beat ends. */
	finalScore: number[] | null;
}

/** The beat a revision's cues ask for, if any, scheduled in server time from
 *  the view alone (no clock is read while rendering). */
function beatFor(key: string, events: readonly GameEvent[], view: VolleyView): Beat | null {
	if (view.mode !== "live") return null;
	const row = view.lastReveal;
	if (row && events.some((e) => e.type === "reveal")) {
		const final = view.phase === "done";
		const flightAt = row.at + VOLLEY_TIMING.settleMs;
		const impactAt = flightAt + VOLLEY_TIMING.arcMs;
		// The next toss's window opens when the reveal is over; the last toss
		// has no next window, so its beat is the reveal itself.
		const endAt = !final && view.commitOpensAt !== null ? view.commitOpensAt : row.at + VOLLEY_TIMING.settleMs + VOLLEY_TIMING.revealMs;
		return { key, kind: "reveal", row, stage: "settle", flightAt, impactAt, endAt, flightMs: VOLLEY_TIMING.arcMs, finalScore: final ? view.score.slice() : null };
	}
	if (view.phase === "commit" && view.exchange === 0 && view.commitOpensAt !== null && events.some((e) => e.type === "start")) {
		const endAt = view.commitOpensAt;
		return { key, kind: "windup", row: null, stage: "windup", flightAt: endAt, impactAt: endAt, endAt, flightMs: 0, finalScore: null };
	}
	return null;
}

function LiveBoard({ view, room, you, yourTurn, act, pending, events, reduceMotion, width, height, serverNow }: BoardProps<VolleyView>) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const scale = useTextScale(VOLLEY_TYPE_CAP);
	const plan = useMemo(() => volleyPlan({ kind: "live", height, s: scale }), [height, scale]);
	const rival = view.rival;
	const rivalName = seatName(room, rival);
	const roomKey = `${room.roomId}:${room.rev}`;
	const { reactions, play, done } = useReactions();

	// The table's clock, read only in effects and timers. Kept in a ref so a
	// new function identity from the screen never restarts a playing beat.
	const clockRef = useRef(serverNow);
	useEffect(() => {
		clockRef.current = serverNow;
	});

	// ── The beat: started by a revision's cues (state adjusted during render,
	// the React-sanctioned way), advanced and ended by timers.
	const [beat, setBeat] = useState<Beat | null>(() => beatFor(roomKey, events, view));
	const [beatSeen, setBeatSeen] = useState(roomKey);
	if (beatSeen !== roomKey) {
		setBeatSeen(roomKey);
		const next = beatFor(roomKey, events, view);
		// A revision with no cue (the rival's lock) leaves a playing beat alone.
		if (next) setBeat(next);
	}
	const beatKey = beat?.key ?? null;
	const beatKind = beat?.kind ?? null;
	const beatRow = beat?.row ?? null;
	const beatFlightAt = beat?.flightAt ?? 0;
	const beatImpactAt = beat?.impactAt ?? 0;
	const beatEndAt = beat?.endAt ?? 0;
	const beatFinal = beat?.finalScore ?? null;
	useEffect(() => {
		if (beatKey === null) return;
		const clock = () => (clockRef.current ?? Date.now)();
		const timers: ReturnType<typeof setTimeout>[] = [];
		// Each boundary is a server instant; a past one fires at once, in order.
		const at = (serverAt: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, serverAt - clock())));
		const mine = (b: Beat | null) => b !== null && b.key === beatKey;
		if (beatKind === "reveal" && beatRow) {
			at(beatFlightAt, () => {
				const flightMs = Math.max(0, beatImpactAt - clock());
				setBeat((b) => (b && mine(b) ? { ...b, stage: "flight", flightMs } : b));
			});
			at(beatImpactAt, () => {
				setBeat((b) => (b && mine(b) ? { ...b, stage: "impact" } : b));
				play(revealReactions(beatRow));
				AccessibilityInfo.announceForAccessibility(revealLine(beatRow, you, rivalName));
			});
		}
		at(beatEndAt, () => {
			setBeat((b) => (mine(b) ? null : b));
			if (beatFinal) play(finalReactions(beatFinal));
		});
		return () => timers.forEach(clearTimeout);
	}, [beatKey, beatKind, beatRow, beatFlightAt, beatImpactAt, beatEndAt, beatFinal, play, you, rivalName]);

	// ── Your pick, before it is sealed. A new toss starts with none.
	const [picked, setPicked] = useState<Lane | null>(null);
	const [pickedFor, setPickedFor] = useState(view.exchange);
	if (pickedFor !== view.exchange) {
		setPickedFor(view.exchange);
		setPicked(null);
	}

	const revealing =
		beat?.kind === "reveal" && beat.row ? { row: beat.row, stage: beat.stage as RevealStage, flightMs: beat.flightMs } : null;
	// The room ended the table early: nothing is owed, so nothing is asked.
	const closed = room.phase === "ended" && view.phase !== "done" && !revealing;
	// Until the ball lands, the revealed toss is not on the scoreboard or on
	// the catcher's coat yet.
	const hidden = revealing && revealing.stage !== "impact" ? revealing.row.ex : null;
	const shown = hidden === null ? view.history : view.history.filter((r) => r.ex !== hidden);
	const score = scoreOf(shown);
	const mud = mudOf(shown);
	const counter = revealing ? `toss ${revealing.row.ex + 1} of ${view.exchanges}` : tossCounter(view);

	const line = revealing
		? revealing.stage === "impact"
			? revealLine(revealing.row, you, rivalName)
			: "Both lanes are in. Here it comes!"
		: closed
			? TABLE_CLOSED
			: view.phase === "done"
				? finalLine(view, rivalName)
				: promptLine(view, rivalName);

	const lockIn = async () => {
		if (!picked || pending || !yourTurn || beat) return;
		const res = await act({ type: "lane", lane: picked, ex: view.exchange });
		if (!res.ok && !QUIET_ERRORS.has(res.error)) {
			showToast({ tone: "fail", title: "That toss didn't go through", text: "Your lane is still open. Try again." });
		}
	};

	// The ticket: the stub carries the points, the face the verb.
	const pick = view.yourLane ?? picked;
	const payoff = pick && view.role && view.windup ? lanePayoff(view.role, pick, view.windup) : null;
	const ticketLabel = view.yourLane
		? "Locked in"
		: beatKind === "reveal"
			? "Watch the toss"
			: beatKind === "windup"
				? "Winding up"
				: "Lock it in";

	const card = plan.card;

	// The pinned foot: the cards and the ticket keep their place and their
	// size in every state (an empty slot keeps its height).
	const foot = (
		<>
			<View style={{ height: card?.height ?? 0 }}>
				{!card ? null : revealing ? (
					<LaneCards
						role={revealing.row.attacker === you ? "toss" : "catch"}
						windup={revealing.row.windup}
						picked={null}
						locked={revealing.row.attacker === you ? revealing.row.toss : revealing.row.catchLane}
						rivalLane={revealing.stage === "settle" ? null : revealing.row.attacker === you ? revealing.row.catchLane : revealing.row.toss}
						reveal
						asleep={false}
						you={you}
						rival={rival}
						reduceMotion={reduce}
						size={card}
					/>
				) : !closed && view.phase === "commit" && view.role && view.windup ? (
					<LaneCards
						role={view.role}
						windup={view.windup}
						picked={picked}
						locked={view.yourLane}
						rivalLane={null}
						reveal={false}
						asleep={pending || !yourTurn || beat !== null}
						you={you}
						rival={rival}
						onPick={setPicked}
						reduceMotion={reduce}
						size={card}
					/>
				) : view.lastReveal ? (
					<LaneCards
						role={view.lastReveal.attacker === you ? "toss" : "catch"}
						windup={view.lastReveal.windup}
						picked={null}
						locked={view.lastReveal.attacker === you ? view.lastReveal.toss : view.lastReveal.catchLane}
						rivalLane={view.lastReveal.attacker === you ? view.lastReveal.catchLane : view.lastReveal.toss}
						reveal
						asleep={false}
						you={you}
						rival={rival}
						reduceMotion={reduce}
						size={card}
					/>
				) : null}
			</View>

			<View style={{ height: plan.ticket }}>
				{(view.phase === "commit" && !closed) || revealing ? (
					<TicketButton
						tone="golden"
						full
						stub={payoff && !beat ? `+${payoff.points}` : "?"}
						stubCaption={payoff && !beat ? payoff.caption : "pick a lane"}
						label={ticketLabel}
						disabled={!picked || view.yourLane !== null || beat !== null || !yourTurn}
						loading={pending}
						loadingLabel="locking it in"
						onPress={() => void lockIn()}
						accessibilityLabel={view.yourLane ? `Locked in the ${LANE_WORD[view.yourLane]} lane` : picked ? `Lock in the ${LANE_WORD[picked]} lane` : "Lock in a lane"}
						accessibilityHint={view.yourLane ? "Sealed. Waiting on the other pig." : "Seals your pick for this toss. It can't be changed."}
						testID="volley-lock"
					/>
				) : null}
			</View>
		</>
	);

	return (
		<FitFrame plan={plan} testID="volley-board" foot={foot}>
			<View style={[styles.scoreRow, { height: plan.score }]}>
				<ScoreSticker seat={you} name="You" score={score[you] ?? 0} side="left" />
				<T role="kicker" tone="secondary" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={styles.counter}>
					{counter}
				</T>
				<ScoreSticker seat={rival} name={rivalName} score={score[rival] ?? 0} side="right" />
			</View>

			{plan.sceneH > 0 ? (
				<Pasture
					width={width}
					sceneH={plan.sceneH}
					you={you}
					rival={rival}
					youLook={seatLook(room, you)}
					rivalLook={seatLook(room, rival)}
					attacker={revealing ? revealing.row.attacker : closed ? null : view.attacker}
					windup={revealing || closed ? null : view.windup}
					arcKey={`${view.exchange}`}
					flight={revealing}
					rivalSealed={!revealing && !closed && view.rivalLocked}
					mud={mud}
					reactions={reactions}
					onReactionDone={done}
					reduceMotion={reduce}
					accessibilityLabel={`You ${score[you] ?? 0}, ${rivalName} ${score[rival] ?? 0}. ${counter}.`}
				/>
			) : null}

			<T role="handLg" align="center" maxFontSizeMultiplier={VOLLEY_TYPE_CAP} style={{ height: plan.hand }} testID="volley-hand-line">
				{line}
			</T>
		</FitFrame>
	);
}

const styles = StyleSheet.create({
	scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
	counter: { flexShrink: 0 },
});
