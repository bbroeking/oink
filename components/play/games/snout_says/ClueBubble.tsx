// A Nose's clue, in the visit's thought-bubble grammar (components/visit/
// WishBubble.tsx): a paper bubble whose two tail dots step DOWN toward the
// pig it floats over. The match screen's seat strip floats it over each
// Nose (GameUI.seatBubble), so the signal sits on the pig it belongs to;
// the reveal reuses the bubble, tail-less, to recap a scored round.
// Three states, one shape:
//   picked  a check: chosen, and the picture stays secret
//   said    the picture and its name: a clue that landed (drops in)
//   torn    another Nose showed the same picture: it shows for a beat,
//           tears away with a giggle and leaves a dashed "great minds"
// Reduce Motion: no travel and no tear, each bubble simply in its state.
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { ART_SIZE, BORDER, CHROME_TYPE_CAP, MOTION, MOTION_SPRING, OPACITY, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { RoomSnapshot } from "@/multiplayer/protocol";
import type { SnoutSaysView } from "@/multiplayer/games/snout_says/rules";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import type { Seat } from "@/multiplayer/types";
import { Glyph, Icon, Sticker, T } from "@/components/ui";
import { pictureArt, seatName, theName } from "./pictures";

export type BubbleState = "picked" | "said" | "torn";

/** What a torn bubble says once its picture has gone. */
export const GREAT_MINDS = "great minds";

export interface BubbleEntry {
	state: BubbleState;
	picture?: PictureId;
}

// Drawing geometry: the tail's two dots, the bubble's floor (so all three
// states share one size), how far a landing clue drops in, and the tear.
const TAIL_LG = 10;
const TAIL_SM = 6;
const BUBBLE_MIN = 56;
const ARRIVE_TRAVEL = 12;
const TEAR_TILT_DEG = 14;
const TEAR_DROP = 10;
const GIGGLE_FROM = 0.7;

export function ClueBubble({
	entry,
	label,
	tail = false,
	named = true,
	reduceMotion = false,
	testID,
}: {
	entry: BubbleEntry;
	/** What a screen reader hears for the whole bubble. */
	label: string;
	/** Draw the two dots that step down toward a pig below. */
	tail?: boolean;
	/** Write the picture's name (or "great minds") under it. A recap on a
	 *  short board draws the picture alone; `label` still says it all. */
	named?: boolean;
	reduceMotion?: boolean;
	testID?: string;
}) {
	const policy = useMotionPolicy();
	const still = reduceMotion || policy.reduceMotion;
	const { state, picture } = entry;
	const [arrive] = useState(() => new Animated.Value(still || state !== "said" ? 1 : 0));
	const [tear] = useState(() => new Animated.Value(still || state !== "torn" ? 1 : 0));
	const [giggle] = useState(() => new Animated.Value(still || state !== "torn" ? 1 : GIGGLE_FROM));

	useEffect(() => {
		if (still) {
			arrive.setValue(1);
			tear.setValue(1);
			giggle.setValue(1);
			return;
		}
		if (state === "said") {
			const run = Animated.spring(arrive, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.settle });
			run.start();
			return () => run.stop();
		}
		if (state === "torn") {
			const run = Animated.sequence([
				Animated.delay(MOTION.beat),
				Animated.timing(tear, { toValue: 1, duration: MOTION_DURATION.state, useNativeDriver: true }),
				Animated.spring(giggle, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot }),
			]);
			run.start();
			return () => run.stop();
		}
	}, [state, still, arrive, tear, giggle]);

	const art = picture ? pictureArt(picture) : null;

	return (
		<View style={styles.wrap} accessible accessibilityRole="text" accessibilityLabel={label} testID={testID}>
			{state === "torn" && art ? (
				<View>
					<Sticker color="cream2" radius={RADII.xl} borderStyle="dashed" shadow="none" rotate={0} style={styles.bubble}>
						<Glyph name={art.glyph} size={ART_SIZE.glyphMd} style={[styles.silhouette, { tintColor: WHIMSY.ink }]} />
						{named ? (
							<Animated.View style={{ transform: [{ scale: giggle }] }}>
								<T role="kicker" tone="secondary" align="center" numberOfLines={2} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
									{GREAT_MINDS}
								</T>
							</Animated.View>
						) : null}
					</Sticker>
					{/* The picture itself, for a beat, then torn off the page. */}
					<Animated.View
						pointerEvents="none"
						style={[
							StyleSheet.absoluteFill,
							{
								opacity: tear.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
								transform: [
									{ translateY: tear.interpolate({ inputRange: [0, 1], outputRange: [0, TEAR_DROP] }) },
									{ rotate: tear.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${TEAR_TILT_DEG}deg`] }) },
								],
							},
						]}
					>
						<Sticker color="paper" radius={RADII.xl} shadow="sm" rotate={0} style={[styles.bubble, styles.fill]}>
							<Glyph name={art.glyph} size={ART_SIZE.glyphMd} />
							{named ? (
								<T role="kicker" align="center" numberOfLines={2} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
									{art.short}
								</T>
							) : null}
						</Sticker>
					</Animated.View>
				</View>
			) : (
				<Animated.View
					style={{
						opacity: arrive,
						transform: [{ translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [-ARRIVE_TRAVEL, 0] }) }],
					}}
				>
					<Sticker color="paper" radius={RADII.xl} shadow="sm" rotate={0} style={styles.bubble}>
						{state === "said" && art ? (
							<>
								<Glyph name={art.glyph} size={ART_SIZE.glyphMd} />
								{named ? (
									<T role="kicker" align="center" numberOfLines={2} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
										{art.short}
									</T>
								) : null}
							</>
						) : (
							<>
								<Icon name="check" size={ART_SIZE.glyphSm} />
								<T role="kicker" tone="secondary" align="center" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
									picked
								</T>
							</>
						)}
					</Sticker>
				</Animated.View>
			)}
			{tail ? (
				<>
					<View style={[styles.tail, styles.tailLg]} />
					<View style={[styles.tail, styles.tailSm]} />
				</>
			) : null}
		</View>
	);
}

/** What floats over one seat's pig right now: nothing for the Guesser or a
 *  Nose still thinking; a seal once a Nose has picked; once the clue beat
 *  closes, the picture that landed or the one that tore away. */
export function seatEntry(view: SnoutSaysView, seat: Seat): BubbleEntry | null {
	if (view.phase === "over" || seat === view.guesser) return null;
	if (view.said) {
		const said = view.said.find((c) => c.seat === seat);
		return said ? { state: said.cancelled ? "torn" : "said", picture: said.picture } : null;
	}
	const nose = view.noses.find((n) => n.seat === seat);
	return nose?.status === "picked" ? { state: "picked" } : null;
}

/** GameUI.seatBubble: the seat strip floats this over each seat's pig. */
export function SnoutSaysSeatBubble({ view, seat, room }: { view: SnoutSaysView; seat: Seat; room: RoomSnapshot<SnoutSaysView> }) {
	const entry = seatEntry(view, seat);
	if (!entry) return null;
	const you = room.you === seat;
	const who = you ? "You" : seatName(room, seat);
	const label =
		entry.state === "picked"
			? `${who} ${you ? "have" : "has"} picked`
			: entry.picture && entry.state === "said"
				? `${who} showed ${theName(entry.picture)}`
				: entry.picture
					? `${who} showed ${theName(entry.picture)}, and so did another nose. Great minds: it tore away`
					: who;
	return (
		<ClueBubble
			// A new state (or a new round) is a new bubble, so its entrance plays.
			key={`${view.round}:${entry.state}:${entry.picture ?? ""}`}
			entry={entry}
			label={label}
			tail
			testID={`snout-seat-bubble-${seat}`}
		/>
	);
}

const styles = StyleSheet.create({
	wrap: { alignItems: "center", maxWidth: "100%" },
	bubble: {
		minHeight: BUBBLE_MIN,
		minWidth: BUBBLE_MIN,
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.sm,
	},
	fill: { flex: 1 },
	tail: {
		borderRadius: RADII.pill,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
	},
	tailLg: { width: TAIL_LG, height: TAIL_LG, marginTop: SPACE.xxs },
	tailSm: { width: TAIL_SM, height: TAIL_SM, marginTop: SPACE.xxs },
	silhouette: { opacity: OPACITY.ghost },
});
