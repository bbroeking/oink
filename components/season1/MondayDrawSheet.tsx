// The Monday draw — every snout that dug draws its own purse.
//
// Spec: docs/design/season-almanac-2026-09-16/SPEC.md ("Monday draw" sheet;
// render: screens/MondayDraw.png). One Sheet: the kicker, a 148pt pink disc
// with the amount in TYPE.hero, the verdict, the four tier tiles with a hand
// `you` over the hit, the warming row, and one gold button.
//
// Three states on an eligible week:
//   · PEEK — undrawn. The odds door on the Race panel opens here: the tiles
//     (no `you`), the warming row, and the gold `Draw your Monday purse`.
//     Peeking never rolls; only that button (or `autoDraw`, which the
//     race-run view's own "Draw your Monday purse" CTA passes) asks the
//     server, so looking at the odds can't spend the one draw.
//   · DRAWING — the purse is rolling server-side (draw_monday_purse); the
//     button waits.
//   · DRAWN — the disc reveals the amount (a spring in; a cut under Reduce
//     Motion), the hit tile wears `you`, and `Pocket N tickles` closes the
//     sheet (the tickles are already in the snout's count — pocketing is the
//     snout's beat, not a second write).
//   · POCKETED — the week was already drawn when this open began (the Race
//     panel's row reopens the result any time). The disc holds the amount,
//     the title is a receipt (`60 tickles, pocketed.`) and the button is
//     `Back to the race` — never a second `Pocket`, which read as a claim
//     that hadn't cleared (2026-09-17).
//
// No shame: a week without a dig is `No purse this Monday. Dig any feeding
// and next one's yours.` — a door, not a verdict. The warming row tells the
// streak as a promise (a warmer next Monday), never as a loss. Nothing here
// names another snout.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	ART_SIZE,
	BORDER,
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
	Glyph,
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
	verdictFor,
	warmingLine,
	type MondayDrawState,
	type MondayDrawTier,
} from "@/utils/mondayDraw";

// The disc's scale before the amount lands.
const DISC_FROM = 0.6;

const KICKER = "monday · every snout that dug draws its own purse";
const NOT_ELIGIBLE_TITLE = "No purse this Monday.";
const NOT_ELIGIBLE_SUB = "Dig any feeding and next one's yours.";
const PEEK_TITLE = "Your purse is waiting.";
const DRAWING_TITLE = "Drawing your purse…";
const FAILED_TITLE = "The purse slipped — try again.";
const DRAW_LABEL = "Draw your Monday purse";
const DRAWING_LABEL = "drawing your purse";
const POCKETED_LABEL = "Back to the race";

/** The receipt title for a reopened, already-pocketed purse. */
export function pocketedTitle(amount: number): string {
	return `${amount} tickles, pocketed.`;
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
	 * draws (the race-run view's "Draw your Monday purse" CTA); the odds door
	 * opens the peek.
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
				Back to the race
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
				{POCKETED_LABEL}
			</Button>
		);
	} else if (peeking || failed) {
		footer = (
			<Button
				variant="gold"
				full
				onPress={fire}
				accessibilityHint="Rolls this week's purse — one per snout, yours to keep"
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
			closeLabel="Close the Monday draw"
			testID={testID ?? "monday-draw-sheet"}
			footer={footer}
		>
			{!state ? (
				<LoadingBeat label="finding your purse" />
			) : !state.eligible ? (
				<EmptyState
					glyph="sleepyface"
					title={NOT_ELIGIBLE_TITLE}
					sub={NOT_ELIGIBLE_SUB}
					accessibilityRole="summary"
				/>
			) : (
				<View style={styles.body}>
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
						style={styles.warming}
						accessibilityRole="text"
						testID="monday-draw-warming"
					>
						<View style={styles.emberBox}>
							<Glyph name="flame" size={ART_SIZE.glyphSm} />
						</View>
						<Hand style={styles.warmingLine}>
							{warmingLine(state.mondaysSinceRare, state.nextRareOddsOneIn)}
						</Hand>
					</Sticker>
				</View>
			)}
		</Sheet>
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
	warming: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.md,
		alignSelf: "stretch",
	},
	emberBox: {
		width: ART_SIZE.glyphMd,
		height: ART_SIZE.glyphMd,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.rose,
		alignItems: "center",
		justifyContent: "center",
	},
	warmingLine: {
		flex: 1,
		minWidth: 0,
	},
});
