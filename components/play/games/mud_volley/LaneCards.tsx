// The three lane cards in the thumb zone: left, middle, right, in the same
// order as the posts above them, so the card you tap sits under the post it
// means. Each card wears what it pays (tossing, the wind-up card reads
// "big splat · 2" and the others "splat · 1"; catching, all three read
// "catch · 1") and the wind-up card carries a "wind-up" tag either way.
//
// Two modes. Pick: a tap lifts the card (sun, heavy border, sticker shadow;
// the Trader's lifted pick), the board's ticket seals it, and the sealed
// card stamps "locked". Reveal: a pure drawing of a resolved toss, each card
// tagged with whose lane it was in one short word: "you", "them", or "both"
// when the two pigs picked the same lane (a catch). The tag takes the payoff
// line's slot, so a card is the same height picking and revealing, and the
// word fits a card on the smallest phone at the chrome cap (the old "your
// toss" / "their catch" tags ran past a 100pt card and truncated). The
// screen reader still hears the whole of it ("Middle lane, your toss, their
// catch").
//
// The board plans the card's height and its art (./layout.ts cardSize): the
// payoff art shrinks on a short board and goes on the shortest, where the
// payoff line already says it in words.

import { useEffect, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Sticker, T } from "@/components/ui";
import { BORDER, CHROME_TYPE_CAP, MOTION_SPRING, RADII, SEAT_TINTS, SPACE, TILT } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { popIn } from "@/utils/motionRecipes";
import { LANES, type Lane, type VolleyRole } from "@/multiplayer/games/mud_volley/rules";
import type { Seat } from "@/multiplayer/types";
import { VOLLEY_ART } from "../../playArt";
import { LANE_TITLE, lanePayoff, type VolleyMark } from "./copy";
import { CARD_LIFT, CARD_ROW_GAP, type CardSize } from "./layout";

/** The stamp leans like a rubber stamp, much more than a card. */
const STAMP_TILT = -10;
const STAMP_OFFSET = -6;

const MARK_ART: Record<VolleyMark, typeof VOLLEY_ART.mudball> = {
	splatBig: VOLLEY_ART.splatBig,
	splatSmall: VOLLEY_ART.splatSmall,
	bucket: VOLLEY_ART.bucket,
};

/** Whose lane a revealed card was. */
export type LaneWho = "you" | "them" | "both";

/** The tag's word: one short word, so it fits a card at the chrome cap. */
export const WHO_WORD: Readonly<Record<LaneWho, string>> = { you: "you", them: "them", both: "both" };

export interface LaneCardsProps {
	role: VolleyRole;
	windup: Lane;
	/** Pick mode: your choice before it is sealed. */
	picked: Lane | null;
	/** Your sealed lane (pick mode), or your lane in a revealed toss. */
	locked: Lane | null;
	/** Reveal mode: the rival's lane, once it shows. */
	rivalLane: Lane | null;
	/** Reveal mode: no taps; your card and theirs are tagged. */
	reveal: boolean;
	/** Pick mode: the cards are asleep (in flight, between beats, done). */
	asleep: boolean;
	you: Seat;
	rival: Seat;
	onPick?: (lane: Lane) => void;
	reduceMotion: boolean;
	/** The planned card: its height, its art and its rows. */
	size: CardSize;
}

export function LaneCards(props: LaneCardsProps) {
	return (
		<View accessibilityRole="radiogroup" accessibilityLabel="Lanes" style={[styles.row, { height: props.size.height }]} testID="volley-lane-cards">
			{LANES.map((lane, i) => (
				<LaneCard key={lane} lane={lane} tilt={TILT.row[i % TILT.row.length]} {...props} />
			))}
		</View>
	);
}

function LaneCard({
	lane,
	tilt,
	role,
	windup,
	picked,
	locked,
	rivalLane,
	reveal,
	asleep,
	you,
	rival,
	onPick,
	reduceMotion,
	size,
}: LaneCardsProps & { lane: Lane; tilt: number }) {
	const policy = useMotionPolicy();
	const reduce = reduceMotion || policy.reduceMotion;
	const payoff = lanePayoff(role, lane, windup);
	const mine = locked === lane || (!reveal && locked === null && picked === lane);
	const theirs = reveal && rivalLane === lane;
	const who: LaneWho | null = !reveal ? null : mine && theirs ? "both" : mine ? "you" : theirs ? "them" : null;
	const sealedHere = !reveal && locked === lane;
	// Pick mode: only an unsealed, awake card answers a tap. The sealed card
	// stays sun (it is yours); the rest sleep once something is sealed.
	const pressable = !reveal && !asleep && locked === null && !!onPick;
	const sleeping = !reveal && !mine && (asleep || locked !== null);

	// The lift: a spring up when picked, back down when not.
	const [lift] = useState(() => new Animated.Value(mine ? -CARD_LIFT : 0));
	useEffect(() => {
		const to = mine ? -CARD_LIFT : 0;
		if (reduce) {
			lift.setValue(to);
			return;
		}
		const anim = Animated.spring(lift, { toValue: to, ...MOTION_SPRING.tap, useNativeDriver: true });
		anim.start();
		return () => anim.stop();
	}, [mine, reduce, lift]);

	const word = LANE_TITLE[lane];
	const job = role === "toss" ? "toss" : "catch";
	const label = reveal
		? `${word} lane${mine ? `, your ${job}` : ""}${theirs ? `, their ${role === "toss" ? "catch" : "toss"}` : ""}`
		: `${word} lane, ${payoff.label.replace(" · ", ", ")} ${payoff.points === 1 ? "point" : "points"}${lane === windup ? ", the wind-up" : ""}`;

	return (
		<Animated.View style={[styles.slot, { transform: [{ translateY: lift }] }]}>
			<Sticker
				color={mine ? "sun" : "paper"}
				radius={RADII.lg}
				border={mine ? BORDER.heavy : BORDER.ink}
				shadow={mine ? "sticker" : "sm"}
				rotate={tilt}
				disabled={sleeping}
				onPress={
					pressable
						? () => {
								Haptics.selectionAsync().catch(() => {});
								onPick?.(lane);
							}
						: undefined
				}
				accessibilityRole={reveal ? "text" : "radio"}
				accessibilityLabel={label}
				accessibilityHint={pressable ? "Picks this lane. Lock it in to seal it." : undefined}
				accessibilityState={{ selected: mine, checked: mine }}
				style={[styles.card, { height: size.height, paddingVertical: size.padV }]}
				testID={`volley-lane-${lane}`}
			>
				<View style={[styles.line, { height: size.tagRow }]}>
					{lane === windup ? (
						<T role="kickerPillSm" tone="accent" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							wind-up
						</T>
					) : null}
				</View>
				{size.art > 0 ? (
					<Image source={MARK_ART[payoff.mark]} style={{ width: size.art, height: size.art }} resizeMode="contain" accessible={false} />
				) : null}
				<View style={[styles.line, { height: size.title }]}>
					<T role="cardTitleSm" align="center" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
						{word}
					</T>
				</View>
				<View style={[styles.line, { height: size.slot }]}>
					{who ? (
						<WhoTag who={who} you={you} rival={rival} lane={lane} />
					) : (
						<T
							role="label"
							tone={sleeping ? "disabled" : payoff.points > 1 ? "accent" : "secondary"}
							align="center"
							maxFontSizeMultiplier={CHROME_TYPE_CAP}
						>
							{payoff.label}
						</T>
					)}
				</View>
			</Sticker>
			{sealedHere ? <LockedStamp reduce={reduce} /> : null}
		</Animated.View>
	);
}

/** Whose lane it was: your tint, theirs, or plain paper when it was both of
 *  yours. The word says it too, so nothing rests on the hue. */
function WhoTag({ who, you, rival, lane }: { who: LaneWho; you: Seat; rival: Seat; lane: Lane }) {
	const color = who === "both" ? "paper" : SEAT_TINTS[(who === "you" ? you : rival) % SEAT_TINTS.length];
	return (
		<Sticker color={color} radius={RADII.pill} shadow="none" rotate={0} border={BORDER.thin} style={styles.who} testID={`volley-who-${lane}`}>
			<T role="kickerPillSm" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
				{WHO_WORD[who]}
			</T>
		</Sticker>
	);
}

/** The sealed card's rubber stamp. */
function LockedStamp({ reduce }: { reduce: boolean }) {
	const policy = useMotionPolicy();
	const [scale] = useState(() => new Animated.Value(0));
	const [opacity] = useState(() => new Animated.Value(0));
	useEffect(() => {
		const anim = popIn(scale, opacity, { ...policy, reduceMotion: reduce });
		anim.start();
		return () => anim.stop();
	}, [scale, opacity, policy, reduce]);
	return (
		<Animated.View pointerEvents="none" style={[styles.stamp, { opacity, transform: [{ scale }] }]} testID="volley-locked-stamp">
			<Sticker color="paper" radius={RADII.sm} border={BORDER.heavy} shadow="sm" rotate={STAMP_TILT} style={styles.stampChip}>
				<T role="kickerPill" tone="accent" maxFontSizeMultiplier={CHROME_TYPE_CAP}>
					locked
				</T>
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", gap: SPACE.sm, alignItems: "stretch" },
	slot: { flex: 1, minWidth: 0 },
	// Explicit rows, centred: the card's height is the plan's, never its text's.
	card: {
		alignItems: "center",
		justifyContent: "center",
		gap: CARD_ROW_GAP,
		paddingHorizontal: SPACE.xxs,
	},
	line: { alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
	who: { paddingHorizontal: SPACE.sm, maxWidth: "100%" },
	stamp: { position: "absolute", top: STAMP_OFFSET, right: STAMP_OFFSET },
	stampChip: { paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs },
});
