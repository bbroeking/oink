// The haul: the basket and the barn of the pig whose turn it is, side by
// side, with the trot-home arrow between them. The barn wears that pig's
// seat fill (SEAT_TINTS), so the row reads as theirs at a glance.
//
// The two moments that end a turn are held for a beat, because by the time
// they arrive the die has already passed to the next pig:
//   bust      the basket turns rose, the boom sticker splats over it and it
//             shakes; its number is the truffles he ate, struck through.
//   trot home the basket is already empty paper ("trotted home") and its
//             number slides along the arrow into the barn, which pops as it
//             lands on the new total.
// Then the row settles on the next pig. Reduce Motion: no splat travel, no
// slide, no pop; the beat still shows what happened, still. The turn strip
// keeps the record either way, so a missed beat loses nothing.
//
// Every animated style stays bound to its value for the life of the row, and
// every path (a beat ending, a newer revision cutting one short, Reduce
// Motion, unmounting) puts the values back at rest. The beats run on the JS
// driver on purpose. A native-driven value stays on the view after its
// binding is dropped (unbinding the slide when a trot home's beat closed left
// the basket's number at opacity 0 for the rest of the table: the 2026-10-04
// sim pass, A-04e / A-07h), and a native animation stopped mid-beat reports
// where it stopped only after the reset, which Fabric then commits over it.
// On the JS driver a stop and a reset are one synchronous step; the beats are
// short and the views small, so nothing is lost.

import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Glyph, Hand, Icon, Sticker, T } from "@/components/ui";
import { ART_SIZE, MOTION, MOTION_SPRING, SEAT_TINTS, SPACE, TILT, UI_COLORS } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { RootleView } from "@/multiplayer/games/rootle/rules";
import type { BustCue, HoldCue } from "./cues";
import { YOU, barnSpoken, basketSpoken, type TableFacts } from "./copy";
import { BOARD_TYPE_CAP } from "./layout";

// --- ART -------------------------------------------------------------------
// The beat: long enough to read one line after the motion lands.
const BEAT_MS = MOTION.sheetIn + MOTION.beat;
// The barn swells this much as the basket lands in it.
const LAND_POP = 1.15;
// The splat grows from this, past full size, and settles.
const SPLAT_FROM = 0.4;
// How far the basket shakes when the Hungerer eats it.
const SHAKE_DEG = 6;
// The beats' driver (see the header): JS, so a stop and a reset are one step.
const NATIVE = false;

export interface HaulProps {
	view: RootleView;
	/** The latest revision's bust / trot home, if it had one. */
	bust: BustCue | null;
	hold: HoldCue | null;
	/** Names, presence and whether the room has ended. */
	facts: TableFacts;
}

function topSeat(barn: readonly number[]): number {
	return barn.reduce((best, b, i) => (b > barn[best] ? i : best), 0);
}

export function Haul({ view, bust, hold, facts }: HaulProps) {
	const { names, filled, ended } = facts;
	const motion = useMotionPolicy();
	const [splat] = useState(() => new Animated.Value(1));
	const [shake] = useState(() => new Animated.Value(0));
	const [slide] = useState(() => new Animated.Value(0));
	const [pop] = useState(() => new Animated.Value(1));
	const [span, setSpan] = useState(0);

	// A new bust or trot home opens a beat (adjusted during render, the
	// React-sanctioned way); the beat closes after BEAT_MS, or as soon as a
	// newer revision replaces the cue.
	const cue: BustCue | HoldCue | null = bust ?? hold;
	const [seenCue, setSeenCue] = useState(cue);
	const [beat, setBeat] = useState<BustCue | HoldCue | null>(null);
	if (seenCue !== cue) {
		setSeenCue(cue);
		setBeat(cue);
	}
	useEffect(() => {
		if (!beat) return;
		const close = setTimeout(() => setBeat(null), BEAT_MS);
		return () => clearTimeout(close);
	}, [beat]);
	const eaten = beat !== null && beat === bust ? bust : null;
	const banked = beat !== null && beat === hold ? hold : null;

	useEffect(() => {
		// Every beat starts from rest, and every way out of one goes back there:
		// the beat closing, a newer cue replacing it, Reduce Motion, unmounting.
		const rest = () => {
			slide.setValue(0);
			pop.setValue(1);
			shake.setValue(0);
			splat.setValue(1);
		};
		rest();
		if (motion.reduceMotion || (!eaten && !banked)) return;
		let run: Animated.CompositeAnimation;
		if (eaten) {
			splat.setValue(SPLAT_FROM);
			run = Animated.parallel([
				Animated.spring(splat, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: NATIVE }),
				Animated.sequence([
					Animated.timing(shake, { toValue: 1, duration: MOTION.tap, useNativeDriver: NATIVE }),
					Animated.timing(shake, { toValue: -1, duration: MOTION.tap, useNativeDriver: NATIVE }),
					Animated.spring(shake, { toValue: 0, ...MOTION_SPRING.overshoot, useNativeDriver: NATIVE }),
				]),
			]);
		} else {
			run = Animated.sequence([
				Animated.timing(slide, {
					toValue: 1,
					duration: MOTION.sheetIn,
					easing: Easing.in(Easing.quad),
					useNativeDriver: NATIVE,
				}),
				Animated.timing(pop, { toValue: LAND_POP, duration: MOTION.tap, useNativeDriver: NATIVE }),
				Animated.spring(pop, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: NATIVE }),
			]);
		}
		run.start();
		return () => {
			run.stop();
			rest();
		};
	}, [eaten, banked, motion.reduceMotion, splat, shake, slide, pop]);

	// Bound once per value (and per span), for the life of the row: at rest
	// they draw the number in place, unturned, at full size.
	const carried = useMemo(
		() => ({
			opacity: slide.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
			transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, span] }) }],
		}),
		[slide, span],
	);
	const shaken = useMemo(
		() => ({ transform: [{ rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: [`${-SHAKE_DEG}deg`, `${SHAKE_DEG}deg`] }) }] }),
		[shake],
	);
	const swelled = useMemo(() => ({ transform: [{ scale: pop }] }), [pop]);

	// Whose haul is on show: the beat's pig, else the pig whose turn it is;
	// once the race is run, the biggest barn.
	let seat = view.turn;
	let basket = view.basket;
	let barn = view.barn[view.turn] ?? 0;
	if (eaten) {
		seat = eaten.seat;
		basket = eaten.lost;
		barn = view.barn[eaten.seat] ?? 0;
	} else if (banked) {
		seat = banked.seat;
		basket = banked.banked;
		barn = banked.barn;
	} else if (ended) {
		seat = topSeat(view.barn);
		basket = 0;
		barn = view.barn[seat] ?? 0;
	}
	const owner = names[seat] ?? "a pig";
	// The barn names its pig in words as well as in its fill; an async chair
	// nobody has taken yet has no name to give.
	const named = filled[seat] !== false;
	const tint = SEAT_TINTS[seat % SEAT_TINTS.length];
	const full = basket > 0;

	return (
		<View style={styles.row} testID="rootle-haul">
			<Animated.View style={[styles.cell, shaken]} testID="rootle-basket-cell">
				<Sticker
					color={eaten ? "rose" : full && !banked ? "sun" : "cream"}
					borderStyle={eaten || (full && !banked) ? "solid" : "dashed"}
					shadow={eaten || (full && !banked) ? "sm" : "none"}
					rotate={TILT.row[1]}
					accessibilityRole="text"
					accessibilityLabel={ended && !eaten ? "The baskets are all home" : basketSpoken(owner, basket, !!eaten)}
					style={styles.sticker}
				>
					<Animated.View style={[styles.line, carried]} testID="rootle-basket-line">
						<Glyph name="digBag" size={ART_SIZE.glyphMd} />
						{full ? (
							<T role="numeralLg" maxFontSizeMultiplier={BOARD_TYPE_CAP} style={eaten ? styles.eaten : null} testID="rootle-basket">
								{basket}
							</T>
						) : (
							<Hand tone="secondary" maxFontSizeMultiplier={BOARD_TYPE_CAP} testID="rootle-basket">
								{ended ? "all home" : "empty"}
							</Hand>
						)}
					</Animated.View>
					<T role="kickerPillSm" tone="secondary" numberOfLines={1} maxFontSizeMultiplier={BOARD_TYPE_CAP}>
						{eaten ? "he ate it" : banked ? "trotted home" : ended ? "race over" : "in the basket"}
					</T>
				</Sticker>
				{eaten ? (
					<Animated.View
						pointerEvents="none"
						testID="rootle-splat"
						style={[styles.splat, { opacity: splat, transform: [{ scale: splat }] }]}
					>
						<Glyph name="digBoom" size={ART_SIZE.badge} />
					</Animated.View>
				) : null}
			</Animated.View>

			<Icon name="arrowRight" size={ART_SIZE.glyphSm} color={UI_COLORS.uiMuted} />

			<View style={styles.cell} onLayout={(e: LayoutChangeEvent) => setSpan(e.nativeEvent.layout.x)}>
				<Sticker
					color={tint}
					shadow="sm"
					rotate={TILT.row[2]}
					accessibilityRole="text"
					accessibilityLabel={barnSpoken(owner, barn, view.target)}
					style={styles.sticker}
				>
					<Animated.View style={[styles.line, swelled]} testID="rootle-barn-line">
						<Glyph name="barn" size={ART_SIZE.glyphMd} />
						{barn > 0 ? (
							<>
								<T role="numeralLg" maxFontSizeMultiplier={BOARD_TYPE_CAP} testID="rootle-barn">
									{barn}
								</T>
								{barn < view.target ? (
									<T role="hand" tone="secondary" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
										{`/ ${view.target}`}
									</T>
								) : null}
							</>
						) : (
							<Hand tone="secondary" maxFontSizeMultiplier={BOARD_TYPE_CAP} testID="rootle-barn">
								nothing yet
							</Hand>
						)}
					</Animated.View>
					<View style={styles.caption} testID="rootle-barn-owner">
						{!named ? (
							<T role="kickerPillSm" tone="secondary" numberOfLines={1} maxFontSizeMultiplier={BOARD_TYPE_CAP}>
								in the barn
							</T>
						) : owner === YOU ? (
							<T role="kickerPillSm" tone="secondary" numberOfLines={1} maxFontSizeMultiplier={BOARD_TYPE_CAP}>
								your barn
							</T>
						) : (
							<>
								<T
									role="kickerPillSm"
									tone="secondary"
									numberOfLines={1}
									maxFontSizeMultiplier={BOARD_TYPE_CAP}
									style={styles.ownerName}
								>
									{owner}
								</T>
								<T role="kickerPillSm" tone="secondary" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
									{"'s barn"}
								</T>
							</>
						)}
					</View>
				</Sticker>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.sm,
	},
	// Each sticker yields to the other equally; neither may push the arrow out.
	cell: {
		flex: 1,
		minWidth: 0,
	},
	sticker: {
		gap: SPACE.xxs,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.sm,
	},
	line: {
		flexDirection: "row",
		alignItems: "center",
		gap: SPACE.xs,
		minWidth: 0,
	},
	// One line, always: a long name gives way, "'s barn" never does.
	caption: {
		flexDirection: "row",
		minWidth: 0,
	},
	ownerName: {
		flexShrink: 1,
	},
	// What he ate, struck through: it was there, and now it is not.
	eaten: {
		textDecorationLine: "line-through",
	},
	// The boom sticker, centred over the basket.
	splat: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
	},
});
