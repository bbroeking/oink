// The Monday drum — every snout that dug turns its own drum.
//
// Spec: docs/design/2026-09-21-season-page-rewrite.md §2 ("The drum"). One
// ball per submitted dig in the week that just ended; on Monday the server
// rolls the tier table once per ball and pays the best. The sheet is that
// drum: the balls, the printed odds, the 148pt pink disc with the amount, the
// four tier tiles with a hand `you` over the hit, and one gold button.
//
// Three states, and the copy for each:
//   · UNDRAWN PURSE — `Your purse is waiting.`, `7 of 21 balls in the drum`,
//     `rare or better: 1 in 2`, and the gold `Draw your Monday purse`.
//     Peeking never rolls; only that button (or `autoDraw`) asks the server,
//     so looking at the odds can't spend the one draw. DRAWING sits between,
//     with the button waiting.
//   · DRAWN — the drum turns (the balls drop in, the winner comes up, the
//     amount lands), the hit tile wears `you`, and `Pocket N tickles` closes
//     the sheet (the tickles are already in the snout's count — pocketing is
//     the snout's beat, not a second write). Reopened later it is a receipt:
//     `60 tickles, pocketed.` and a plain door back, never a second `Pocket`,
//     which read as a claim that hadn't cleared (2026-09-17).
//   · NO PURSE (0 balls) — the invitation: `No purse this Monday.` /
//     `Dig once this week and you're in Monday's drum.` A door, not a verdict.
//
// The result is written server-side BEFORE the animation starts, so a killed
// app reopens onto the receipt — state is the truth, the drum is only its
// telling. Reduce Motion cuts straight to the result with no drop, no lift,
// no spring. Nothing here names another snout, a streak, or a herd.
//
// It rides the shared `Sheet`, which takes the `useUnmanagedModalHold` latch
// for us (the popup queue admits nothing while it is open).
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	ART_SIZE,
	BORDER,
	MOTION,
	MOTION_SPRING,
	RADII,
	SPACE,
	TILT,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import {
	Button,
	EmptyState,
	Hand,
	KickerPill,
	LoadingBeat,
	PageTitle,
	Sheet,
	Sticker,
	T,
} from "@/components/ui";
import {
	MONDAY_DRAW_TUNING,
	RARE_OR_BETTER,
	ballsWord,
	leftoverSuffix,
	oddsLine,
	verdictFor,
	type MondayDrawState,
	type MondayDrawTier,
} from "@/utils/mondayDraw";

// The disc's scale before the amount lands.
const DISC_FROM = 0.6;
// A ball's drop: how far above its seat it starts, and the gap between drops.
const BALL_DROP = 14;
const BALL_STAGGER_MS = 40;
// The winning ball's lift once the drum stops.
const BALL_LIFT = 6;
const BALL_LIFT_SCALE = 1.5;
// A drum never draws more pips than this — past it the row is a texture, not
// a count, and the line above says the number anyway.
const MAX_BALLS_DRAWN = 21;

const KICKER = "monday · every snout that dug draws its own purse";
const NOT_ELIGIBLE_TITLE = "No purse this Monday.";
const NOT_ELIGIBLE_SUB = "Dig once this week and you're in Monday's drum.";
const PEEK_TITLE = "Your purse is waiting.";
const DRAWING_TITLE = "Drawing your purse…";
const FAILED_TITLE = "The purse slipped. Try again.";
const DRAW_LABEL = "Draw your Monday purse";
const DRAWING_LABEL = "drawing your purse";
const DONE_LABEL = "Back to the season";

/** The receipt title for a reopened, already-pocketed purse. */
export function pocketedTitle(amount: number): string {
	return `${amount} tickles, pocketed.`;
}

/**
 * `7 of 21 balls in the drum` — the sheet's ball line. The cap comes from the
 * server (the snout's own feeding windows); a server that didn't say drops the
 * "of N" rather than invent one, and a full drum earns the perfect-week words.
 */
export function drumBallsLine(balls: number, cap: number): string {
	const n = Math.max(0, Math.floor(balls));
	const c = Math.max(0, Math.floor(cap));
	if (c <= 0) return `${ballsWord(n)} in the drum`;
	if (n >= c) return `${c} of ${c} balls in the drum · every last feeding`;
	return `${n} of ${c} balls in the drum`;
}

interface Props {
	open: boolean;
	onClose: () => void;
	/** Null while the first read is in flight or the feature is dark. */
	state: MondayDrawState | null;
	/** draw_monday_purse — fired from the draw button (or on open with `autoDraw`). */
	onDraw: () => Promise<MondayDrawState | null> | void;
	/**
	 * Roll on open instead of peeking. Only for a door that already SAID it
	 * draws; the Draw panel's own odds door opens the peek.
	 */
	autoDraw?: boolean;
	testID?: string;
}

export function MondayDrawSheet({
	open,
	onClose,
	state,
	onDraw,
	autoDraw = false,
	testID,
}: Props) {
	// Whether this open has asked the server (by button or autoDraw). The
	// hook flips `drawn` optimistically; the amount lands with the purse.
	const [tapped, setTapped] = useState(false);
	// A draw the server refused or a network blip dropped — the button becomes
	// the retry so the sheet never sits on a spinner-less "drawing".
	const [failed, setFailed] = useState(false);
	// Each open starts afresh (a peek), however the last one was closed.
	const [seenOpen, setSeenOpen] = useState(open);
	// Was the week already drawn when this open began? Captured from the first
	// state this open sees (the state can land after the sheet does), and
	// before any tap flips `drawn` — so a purse drawn THIS open still gets its
	// reveal, and one drawn earlier reads as the receipt it is.
	const [drawnAtOpen, setDrawnAtOpen] = useState<boolean | null>(null);
	if (open !== seenOpen) {
		setSeenOpen(open);
		setDrawnAtOpen(null);
		if (open) {
			setTapped(false);
			setFailed(false);
		}
	}
	if (open && drawnAtOpen === null && state) {
		setDrawnAtOpen(state.drawn);
	}
	// An autoDraw open is "asked" from its first frame; the effect below sends
	// the one request once the state says the week is drawable.
	const asked = tapped || autoDraw;

	const fire = useCallback(() => {
		setTapped(true);
		setFailed(false);
		void Promise.resolve(onDraw()).then((settled) => {
			if (settled === null) setFailed(true);
		});
	}, [onDraw]);

	const autoFired = useRef(false);
	useEffect(() => {
		if (!open) {
			autoFired.current = false;
			return;
		}
		if (!autoDraw || autoFired.current) return;
		if (!state || !state.eligible || state.drawn) return;
		autoFired.current = true;
		void Promise.resolve(onDraw()).then((settled) => {
			if (settled === null) setFailed(true);
		});
	}, [open, autoDraw, state, onDraw]);

	const close = () => {
		onClose();
	};

	const tiers = state?.tuning.tiers ?? MONDAY_DRAW_TUNING.tiers;
	const revealed = !!state && state.drawn && state.amount != null && state.tier != null;
	const pocketed = revealed && drawnAtOpen === true;
	const peeking = !!state && state.eligible && !state.drawn && !asked;
	const drawing = !!state && state.eligible && !revealed && asked && !failed;

	let footer: React.ReactNode;
	if (state && !state.eligible) {
		footer = (
			<Button variant="lilac" full onPress={close} testID="monday-draw-done">
				{DONE_LABEL}
			</Button>
		);
	} else if (pocketed) {
		footer = (
			<Button
				variant="lilac"
				full
				onPress={close}
				accessibilityHint="Closes the sheet; this week's purse is already in your count"
				testID="monday-draw-done"
			>
				{DONE_LABEL}
			</Button>
		);
	} else if (peeking || failed) {
		footer = (
			<Button
				variant="gold"
				full
				onPress={fire}
				accessibilityHint="Turns the drum. One purse per snout, yours to keep"
				testID="monday-draw-draw"
			>
				{DRAW_LABEL}
			</Button>
		);
	} else {
		footer = (
			<Button
				variant="gold"
				full
				loading={!revealed}
				loadingLabel={DRAWING_LABEL}
				onPress={close}
				accessibilityHint="Closes the sheet; the tickles are already yours"
				testID="monday-draw-pocket"
			>
				{revealed ? `Pocket ${state.amount} tickles` : "Pocket your purse"}
			</Button>
		);
	}

	return (
		<Sheet
			open={open}
			onClose={close}
			kicker={KICKER}
			testID={testID ?? "monday-draw-sheet"}
			footer={footer}
		>
			{!state ? (
				<LoadingBeat label="finding your drum" />
			) : !state.eligible ? (
				<EmptyState
					glyph="sleepyface"
					title={NOT_ELIGIBLE_TITLE}
					sub={NOT_ELIGIBLE_SUB}
					accessibilityRole="summary"
				/>
			) : (
				<View style={styles.body}>
					<BallRow
						// A leftover (Season 2) rolls beside the dug balls, so it
						// sits in the drum with them.
						balls={state.balls + (state.leftoverBalls ?? 0)}
						rolls={revealed ? state.rolls : null}
						winner={revealed ? state.tier : null}
					/>
					<PurseDisc amount={revealed ? state.amount : null} />
					<PageTitle align="center" accessibilityRole="header" testID="monday-draw-verdict">
						{pocketed && state.amount != null
							? pocketedTitle(state.amount)
							: revealed && state.tier
								? verdictFor(state.tier)
								: failed
									? FAILED_TITLE
									: drawing
										? DRAWING_TITLE
										: PEEK_TITLE}
					</PageTitle>
					<View style={styles.tiles} accessibilityRole="list">
						{tiers.map((t) => (
							<TierTile
								key={t.tier}
								tier={t.tier}
								amount={t.amount}
								hit={revealed && state.tier === t.tier}
							/>
						))}
					</View>
					<Sticker
						color="paper"
						rotate={0}
						radius={RADII.md}
						border={BORDER.thin}
						borderStyle="dashed"
						shadow="none"
						pad
						style={styles.drumCard}
						accessibilityRole="text"
						testID="monday-draw-drum"
					>
						<Hand align="center">
							{drumBallsLine(state.balls, state.cap) + leftoverSuffix(state.leftoverBalls ?? 0)}
						</Hand>
						<Hand tone="secondary" align="center">
							{oddsLine(state.purseOddsOneIn ?? 1)}
						</Hand>
					</Sticker>
				</View>
			)}
		</Sheet>
	);
}

// The drum's balls. One pip per ball (capped at MAX_BALLS_DRAWN — past that
// the line under the disc carries the count). Undrawn, they sit still. When
// the purse lands they drop in on a stagger and the winning ball — the first
// pip that rolled the paying tier — comes up on the sun. Reduce Motion places
// every pip at rest, already lifted: the result, with no telling.
function BallRow({
	balls,
	rolls,
	winner,
}: {
	balls: number;
	rolls: readonly MondayDrawTier[] | null;
	winner: MondayDrawTier | null;
}) {
	const motion = useMotionPolicy();
	const count = Math.min(MAX_BALLS_DRAWN, Math.max(0, Math.floor(rolls?.length ?? balls)));
	const winnerIndex = winner && rolls ? rolls.indexOf(winner) : -1;
	const revealed = winner != null;
	const [drop] = useState(() => new Animated.Value(revealed ? 1 : 0));
	const [lift] = useState(() => new Animated.Value(revealed ? 1 : 0));

	useEffect(() => {
		if (!revealed) {
			drop.setValue(0);
			lift.setValue(0);
			return;
		}
		if (motion.reduceMotion) {
			drop.setValue(1);
			lift.setValue(1);
			return;
		}
		drop.setValue(0);
		lift.setValue(0);
		const run = Animated.sequence([
			Animated.timing(drop, {
				toValue: 1,
				duration: MOTION.fade + BALL_STAGGER_MS * count,
				useNativeDriver: true,
			}),
			Animated.spring(lift, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot }),
		]);
		run.start();
		return () => run.stop();
	}, [revealed, motion.reduceMotion, count, drop, lift]);

	if (count <= 0) return null;

	return (
		<View
			style={styles.balls}
			accessibilityRole="text"
			accessibilityLabel={
				revealed
					? `${ballsWord(count)} turned, one paid`
					: `${ballsWord(count)} in the drum`
			}
			testID="monday-draw-balls"
		>
			{Array.from({ length: count }, (_, i) => {
				const isWinner = i === winnerIndex;
				// Each pip lands on its own beat: its slice of the drop ramp.
				const from = count <= 1 ? 0 : i / count;
				const stage = drop.interpolate({
					inputRange: [from, Math.min(1, from + 1 / Math.max(1, count))],
					outputRange: [0, 1],
					extrapolate: "clamp",
				});
				const roll = rolls?.[i];
				const hot = roll != null && RARE_OR_BETTER.has(roll);
				// Two translateYs compose: the drop into the seat, then the
				// winner's lift out of the row.
				const transform = revealed
					? [
							{
								translateY: stage.interpolate({
									inputRange: [0, 1],
									outputRange: [-BALL_DROP, 0],
								}),
							},
							...(isWinner
								? [
										{
											translateY: lift.interpolate({
												inputRange: [0, 1],
												outputRange: [0, -BALL_LIFT],
											}),
										},
										{
											scale: lift.interpolate({
												inputRange: [0, 1],
												outputRange: [1, BALL_LIFT_SCALE],
											}),
										},
									]
								: []),
						]
					: [];
				return (
					<Animated.View
						key={i}
						testID={isWinner ? "monday-draw-ball-winner" : undefined}
						style={[
							styles.ball,
							hot && styles.ballHot,
							isWinner && styles.ballWinner,
							{ opacity: revealed ? stage : 1, transform },
						]}
					/>
				);
			})}
		</View>
	);
}

// The 148pt pink disc (ART_SIZE.reveal — the Almanac sheets' hero). The
// amount springs in when it lands with MOTION_SPRING.settle (a landed thing,
// not a tap); Reduce Motion cuts straight to it.
function PurseDisc({ amount }: { amount: number | null }) {
	const motion = useMotionPolicy();
	const [scale] = useState(() => new Animated.Value(amount == null ? DISC_FROM : 1));

	useEffect(() => {
		if (amount == null) {
			scale.setValue(DISC_FROM);
			return;
		}
		if (motion.reduceMotion) {
			scale.setValue(1);
			return;
		}
		scale.setValue(DISC_FROM);
		const spring = Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
			...MOTION_SPRING.settle,
		});
		spring.start();
		return () => spring.stop();
	}, [amount, motion.reduceMotion, scale]);

	return (
		<Sticker
			color="rose"
			rotate={0}
			radius={ART_SIZE.reveal / 2}
			border={BORDER.heavy}
			shadow="sticker"
			style={styles.disc}
			accessibilityRole="text"
			accessibilityLabel={amount == null ? "Your purse, not drawn yet" : `${amount} tickles`}
			testID="monday-draw-disc"
		>
			<Animated.View style={[styles.discInner, { transform: [{ scale }] }]}>
				<T role="hero" align="center" testID="monday-draw-amount">
					{amount == null ? "?" : String(amount)}
				</T>
				<KickerPill star={false} align="center">
					tickles
				</KickerPill>
			</Animated.View>
		</Sticker>
	);
}

// One of the four tier tiles. The hit tile is blush with the sticker shadow and
// a hand `you` over it; jackpot always wears sun; the rest are flat paper.
function TierTile({
	tier,
	amount,
	hit,
}: {
	tier: MondayDrawTier;
	amount: number;
	hit: boolean;
}) {
	const color = hit ? "rose" : tier === "jackpot" ? "sun" : "paper";
	return (
		<View style={styles.tileWrap} accessibilityRole="none">
			<Hand
				tone="accent"
				align="center"
				style={[styles.you, !hit && styles.youHidden]}
				accessibilityElementsHidden={!hit}
				importantForAccessibility={hit ? "auto" : "no-hide-descendants"}
				testID={hit ? "monday-draw-you" : undefined}
			>
				you
			</Hand>
			<Sticker
				color={color}
				rotate={hit ? TILT.card : 0}
				radius={RADII.md}
				border={BORDER.ink}
				shadow={hit ? "sticker" : "none"}
				style={styles.tile}
				accessibilityRole="text"
				accessibilityLabel={`${amount} tickles, ${tier}${hit ? ", yours" : ""}`}
				testID={`monday-draw-tile-${tier}`}
			>
				<T role="cardTitle" align="center">
					{String(amount)}
				</T>
				<KickerPill star={false} align="center">
					{tier}
				</KickerPill>
			</Sticker>
		</View>
	);
}

const styles = StyleSheet.create({
	body: {
		alignItems: "center",
		gap: SPACE.lg,
		paddingTop: SPACE.sm,
	},
	balls: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		alignItems: "center",
		gap: SPACE.xs,
		alignSelf: "stretch",
		// The winner's lift and scale overhang the row; give it the room.
		paddingVertical: SPACE.sm,
	},
	ball: {
		width: ART_SIZE.mark,
		height: ART_SIZE.mark,
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream,
	},
	ballHot: {
		backgroundColor: WHIMSY.rose,
	},
	ballWinner: {
		backgroundColor: WHIMSY.sun,
		borderWidth: BORDER.ink,
	},
	disc: {
		width: ART_SIZE.reveal,
		height: ART_SIZE.reveal,
		alignItems: "center",
		justifyContent: "center",
	},
	discInner: {
		alignItems: "center",
		gap: SPACE.xxs,
	},
	tiles: {
		flexDirection: "row",
		gap: SPACE.sm,
		alignSelf: "stretch",
		alignItems: "flex-end",
	},
	tileWrap: {
		flex: 1,
		minWidth: 0,
	},
	you: {
		marginBottom: SPACE.xxs,
	},
	youHidden: {
		opacity: 0,
	},
	tile: {
		paddingVertical: SPACE.md,
		paddingHorizontal: SPACE.xs,
		alignItems: "center",
		gap: SPACE.xxs,
	},
	drumCard: {
		alignSelf: "stretch",
		gap: SPACE.xxs,
	},
});
