// The Rootle board: the play area under the match screen's seat strip, which
// already stands every pig on its ground line with its name and its barn
// (rootleUi.seatStatus). Top to bottom:
//
//   the fence rail   wood across the table; it lights sun in the last round
//   the die          the hero: tumbles on every roll, thuds on the Hungerer,
//                    wears a "last turn" tape through the last round
//   the haul         this turn's basket, the arrow home, that pig's barn
//   the turn strip   the last three turns, newest first
//   the status line  one hand-voice sentence: whose turn, what trotting home
//                    now would do
//   the thumb zone   Rootle and Trot home on your turn (Trot home locked
//                    until your first roll); otherwise where you stand in the
//                    order. The zone keeps its height either way, so nothing
//                    above it moves when the turn changes hands.
//
// It fills the height the match screen gives it (GameUI.fillsHeight, ../fit):
// the status line and the thumb zone are pinned at the foot at full size, so
// Rootle and Trot home are never under the emote tray; above them the die is
// the hero, scaled from what is left (132pt down to 48), the turn strip keeps
// a line only while the die stays big enough for it, and on the shortest
// boards the gaps tighten, the Buttons step down a size and the rail goes
// (rootleFit in ./layout).
//
// A pure function of the view: no rule is decided here (the board reads the
// rules module's own helpers), no action is applied locally. A tap calls
// `act`, the die wobbles at once, and input stays shut until the server's
// next revision lands or the action is refused.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Button, Hand, T } from "@/components/ui";
import { BORDER, LIST_BLEED, MOTION_SPRING, RADII, SPACE, UI_COLORS, WHIMSY, WOOD } from "@/constants/theme";
import { MOTION_DURATION, MotionPolicyProvider, useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	rootleCanTrotHome,
	rootleLastFace,
	type RootleAction,
	type RootleView,
} from "@/multiplayer/games/rootle/rules";
import { buttonSlot, useTextScale } from "../fit";
import type { BoardProps } from "../../types";
import { useFreshCues, type RootleCues } from "./cues";
import {
	ROOTLE_HINT,
	announcement,
	dieSpoken,
	statusLine,
	tableFacts,
	trotHomeHint,
	trotHomeLabel,
	waitingLine,
	widestStatus,
} from "./copy";
import { Die } from "./Die";
import { Haul } from "./Haul";
import { BOARD_TYPE_CAP, RAIL_H, rootleFit, statusLines } from "./layout";
import { TurnStrip } from "./TurnStrip";

// --- ART -------------------------------------------------------------------
// Your controls arrive from a little under full size.
const CONTROLS_FROM = 0.9;
// The pinned foot's spacing (rootleFit's footHeight reads the same steps).
const STATUS_GAP = SPACE.sm;

export function RootleBoard(props: BoardProps<RootleView>) {
	// The match screen's Reduce Motion wins over the system's "no".
	return (
		<MotionPolicyProvider reduceMotion={props.reduceMotion ? true : undefined}>
			<RootleTable {...props} />
		</MotionPolicyProvider>
	);
}

function RootleTable({ view, room, you, yourTurn, act, pending, events, width, height }: BoardProps<RootleView>) {
	const motion = useMotionPolicy();
	const facts = useMemo(() => tableFacts(view, room, you), [view, room, you]);
	const scale = useTextScale(BOARD_TYPE_CAP);
	const widest = widestStatus(facts);
	const plan = useMemo(() => rootleFit(width, height, scale, statusLines(width, scale, widest)), [width, height, scale, widest]);
	const cues = useFreshCues(room.rev, events);
	const myMove = !facts.ended && yourTurn && view.turn === you;
	const canTrot = rootleCanTrotHome(view, you);

	// The action in flight, pinned to the revision it was sent from: input
	// stays shut until a newer revision arrives (or the server refuses).
	const [sent, setSent] = useState<{ type: RootleAction["type"]; rev: number } | null>(null);
	const inFlight = sent !== null && sent.rev === room.rev;
	const busy = pending || inFlight;
	// Two taps inside one frame both see `busy` false, and two rolls are both
	// legal mid-turn, so the door also shuts synchronously.
	const sending = useRef(false);

	const send = useCallback(
		async (type: RootleAction["type"]) => {
			if (busy || sending.current) return;
			sending.current = true;
			setSent({ type, rev: room.rev });
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
			try {
				const res = await act({ type });
				if (!res.ok) setSent(null);
			} catch {
				setSent(null);
			} finally {
				sending.current = false;
			}
		},
		[busy, act, room.rev],
	);

	// Say what each revision did, once; and let your own bust and trot home
	// land in the hand.
	const told = useRef<RootleCues | null>(null);
	useEffect(() => {
		if (!cues || told.current === cues) return;
		told.current = cues;
		const line = announcement(cues, view, facts);
		if (line) AccessibilityInfo.announceForAccessibility(line);
		if (cues.bust?.seat === you) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
		} else if (cues.hold?.seat === you) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
		}
	}, [cues, view, facts, you]);

	// Your controls spring in when the die comes to you.
	const [controlsScale] = useState(() => new Animated.Value(1));
	const [controlsOpacity] = useState(() => new Animated.Value(1));
	useEffect(() => {
		if (!myMove) return;
		controlsOpacity.setValue(0);
		const fadeIn = Animated.timing(controlsOpacity, {
			toValue: 1,
			duration: motion.reduceMotion ? MOTION_DURATION.crossfade : MOTION_DURATION.state,
			useNativeDriver: true,
		});
		if (motion.reduceMotion) {
			controlsScale.setValue(1);
			fadeIn.start();
			return () => fadeIn.stop();
		}
		controlsScale.setValue(CONTROLS_FROM);
		const arrive = Animated.parallel([
			fadeIn,
			Animated.spring(controlsScale, { toValue: 1, ...MOTION_SPRING.tap, useNativeDriver: true }),
		]);
		arrive.start();
		return () => arrive.stop();
	}, [myMove, motion.reduceMotion, controlsScale, controlsOpacity]);

	const face = rootleLastFace(view);
	const lastRound = view.lastRound !== null && !facts.ended;
	const waiting = waitingLine(view, facts);

	return (
		<View style={[styles.board, plan.fit ? { height } : null]} testID="rootle-board">
			<View style={[plan.fit ? styles.planned : null, { gap: plan.gap }]} testID="rootle-planned">
				{plan.rail ? (
					<View style={[styles.rail, lastRound ? styles.railLit : null]} testID={lastRound ? "rootle-rail-lit" : "rootle-rail"} />
				) : null}

				<View style={[styles.stage, plan.fit ? styles.stageFill : null]}>
					<Die
						face={face}
						roll={cues?.roll ?? null}
						shaking={inFlight && sent?.type === "roll"}
						size={plan.die}
						tape={lastRound ? "last turn" : null}
						accessibilityLabel={dieSpoken(face)}
					/>
				</View>

				<Haul view={view} bust={cues?.bust ?? null} hold={cues?.hold ?? null} facts={facts} />

				{plan.rows > 0 ? (
					<TurnStrip log={view.log} names={facts.names} present={facts.present} rows={plan.rows} hint={plan.longHint ? "long" : "short"} />
				) : null}
			</View>

			<View style={styles.foot} testID="rootle-foot">
				<T role="handLg" align="center" maxFontSizeMultiplier={BOARD_TYPE_CAP} testID="rootle-status">
					{statusLine(view, facts)}
				</T>

				<View style={[styles.thumb, { minHeight: buttonSlot(plan.button, scale) }]} testID="rootle-thumb">
					{myMove ? (
						<Animated.View style={[styles.controls, { opacity: controlsOpacity, transform: [{ scale: controlsScale }] }]}>
							<View style={styles.half}>
								<Button
									variant="primary"
									size={plan.button}
									full
									disabled={busy}
									loading={inFlight && sent?.type === "roll"}
									loadingLabel="rolling"
									onPress={() => void send("roll")}
									accessibilityLabel="Rootle"
									accessibilityHint={ROOTLE_HINT}
									maxFontSizeMultiplier={BOARD_TYPE_CAP}
									testID="rootle-roll"
								>
									Rootle
								</Button>
							</View>
							<View style={styles.half}>
								<Button
									variant="gold"
									size={plan.button}
									full
									disabled={busy || !canTrot}
									loading={inFlight && sent?.type === "hold"}
									loadingLabel="trotting home"
									onPress={() => void send("hold")}
									accessibilityLabel={trotHomeLabel(view, you)}
									accessibilityHint={trotHomeHint(view, you)}
									maxFontSizeMultiplier={BOARD_TYPE_CAP}
									testID="rootle-hold"
								>
									Trot home
								</Button>
							</View>
						</Animated.View>
					) : waiting ? (
						<Hand tone="secondary" align="center" maxFontSizeMultiplier={BOARD_TYPE_CAP} testID="rootle-waiting">
							{waiting}
						</Hand>
					) : null}
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	board: {
		alignSelf: "stretch",
	},
	// The rows above the foot, on a board that knows its height: they take
	// what the foot leaves and clip there (the plan sizes them to fit, so the
	// clip is a guard, never a cut). The bleed keeps the stickers' side
	// shadows and tilt inside the clip.
	planned: {
		flex: 1,
		minHeight: 0,
		overflow: "hidden",
		marginHorizontal: -LIST_BLEED,
		paddingHorizontal: LIST_BLEED,
	},
	// The fence the pigs stand behind: a wooden rail that lights in the last
	// round.
	rail: {
		height: RAIL_H,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WOOD.top,
	},
	railLit: {
		backgroundColor: WHIMSY.sun,
	},
	// Room above the tray for the tape's overhang, and round it for the tilt
	// and the sticker shadow.
	stage: {
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: SPACE.sm,
	},
	// On a board that knows its height the stage takes the slack, so the die
	// floats between the rail and the haul instead of leaving a hole.
	stageFill: {
		flexGrow: 1,
	},
	// The status line over the thumb zone, pinned at the board's foot; the
	// last step keeps the Buttons' hard shadow inside the board.
	foot: {
		paddingTop: SPACE.sm,
		gap: STATUS_GAP,
		paddingBottom: SPACE.xs,
	},
	// Holds a Button's height whether or not the Buttons are there.
	thumb: {
		justifyContent: "center",
	},
	controls: {
		flexDirection: "row",
		gap: SPACE.md,
	},
	half: {
		flex: 1,
		minWidth: 0,
	},
});
