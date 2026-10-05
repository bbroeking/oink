// The die: the board's hero. A painted die face on a paper tray.
//
// When a roll lands, the tray tumbles: most of a turn of spin that eases out
// onto the face, a squash that springs back past full size, and three quick
// faces flicking by before the real one (never the Hungerer, so a flick can
// never read as a bust). Landing on the Hungerer adds a thud and turns the
// tray rose. While your own roll is on its way to the server the tray
// wobbles, so the world answers the tap at once. Reduce Motion: no spin, no
// flicks, no wobble; the new face cross-fades in.
//
// The art is ROOTLE_ART.die[face - 1] (face 1 is the Hungerer); a tray with
// no roll yet is the dashed "not yet" sticker.

import { useEffect, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { Hand, Sticker, T } from "@/components/ui";
import { BORDER, MOTION, MOTION_SPRING, RADII, SPACE, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, startDecorativeLoop, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { ROOTLE_TUNING } from "@/multiplayer/games/rootle/rules";
import { popIn } from "@/utils/motionRecipes";
import { ROOTLE_ART } from "../../playArt";
import type { RollCue } from "./cues";
import { BOARD_TYPE_CAP } from "./layout";

// --- ART -------------------------------------------------------------------
// Drawing geometry, not spacing: the painted face fills this share of the
// tray (the art carries its own ink outline and sparkles).
const DIE_ART_SHARE = 0.82;
// The tumble starts this far round and spins back to the tray's rest.
const TUMBLE_FROM_DEG = -300;
// How flat the tray squashes as it is thrown, before springing back.
const TUMBLE_SQUASH = 0.86;
// Faces that flick by before the real one, one per `MOTION.tap`.
const FLICKS = 3;
// The thud's swing, and the pending wobble's share of it.
const THUD_DEG = 10;
const WOBBLE_SHARE = 0.4;
// The "last turn" tape leans like tape, but less than TILT.tape: it carries
// words that have to stay readable.
const TAPE_TILT = -4;
// The empty tray's words need this much tray (two lines of the hand at the
// chrome cap); a smaller tray says "not yet" with its dashes alone, and the
// accessibility label still says it in words.
const WORDS_MIN = 64;

const HUNGERER = ROOTLE_TUNING.hungerer;

/** The i-th face to flick past on the way to `final`: any 2 to 6 but the
 *  final one, so the flick never shows the Hungerer or gives the face away. */
export function flickFace(final: number, i: number): number {
	const candidates = [2, 3, 4, 5, 6].filter((face) => face !== final);
	return candidates[(final + i) % candidates.length];
}

function isFace(face: number | null): face is number {
	return face !== null && Number.isInteger(face) && face >= 1 && face <= ROOTLE_TUNING.faces;
}

export interface DieProps {
	/** The face the die rests on (null before the first roll of the game). */
	face: number | null;
	/** The latest revision's roll, if it had one: plays the tumble once. */
	roll: RollCue | null;
	/** Your own roll is on its way: wobble until it lands. */
	shaking: boolean;
	/** The tray's edge, in points. */
	size: number;
	/** Words taped across the top of the tray ("last turn"), or null. */
	tape: string | null;
	accessibilityLabel: string;
}

export function Die({ face, roll, shaking, size, tape, accessibilityLabel }: DieProps) {
	const motion = useMotionPolicy();
	const [spin] = useState(() => new Animated.Value(1));
	const [squash] = useState(() => new Animated.Value(1));
	const [wobble] = useState(() => new Animated.Value(0));
	const [fade] = useState(() => new Animated.Value(1));
	const [tapeScale] = useState(() => new Animated.Value(1));
	const [tapeOpacity] = useState(() => new Animated.Value(1));
	// The face on show mid-tumble, tied to the roll it belongs to, so a stale
	// flick can never outlive its roll.
	const [flick, setFlick] = useState<{ roll: RollCue; face: number } | null>(null);

	// The tumble: once per roll.
	useEffect(() => {
		if (!roll) return;
		if (motion.reduceMotion) {
			// At rest, whatever an interrupted tumble left behind.
			spin.setValue(1);
			squash.setValue(1);
			wobble.setValue(0);
			fade.setValue(0);
			const crossfade = Animated.timing(fade, {
				toValue: 1,
				duration: MOTION_DURATION.crossfade,
				useNativeDriver: true,
			});
			crossfade.start();
			return () => crossfade.stop();
		}
		spin.setValue(0);
		const thud = Animated.sequence([
			Animated.timing(wobble, { toValue: 1, duration: MOTION.tap, useNativeDriver: true }),
			Animated.spring(wobble, { toValue: 0, ...MOTION_SPRING.overshoot, useNativeDriver: true }),
		]);
		const tumble = Animated.parallel([
			Animated.timing(spin, {
				toValue: 1,
				duration: MOTION_DURATION.celebration,
				easing: Easing.out(Easing.cubic),
				useNativeDriver: true,
			}),
			Animated.sequence([
				Animated.timing(squash, { toValue: TUMBLE_SQUASH, duration: MOTION.tap, useNativeDriver: true }),
				Animated.spring(squash, { toValue: 1, ...MOTION_SPRING.overshoot, useNativeDriver: true }),
			]),
		]);
		tumble.start(({ finished }) => {
			if (finished && roll.face === HUNGERER) thud.start();
		});
		const flicks = Array.from({ length: FLICKS }, (_, i) =>
			setTimeout(() => setFlick({ roll, face: flickFace(roll.face, i) }), i * MOTION.tap),
		);
		const land = setTimeout(() => setFlick(null), FLICKS * MOTION.tap);
		return () => {
			tumble.stop();
			thud.stop();
			flicks.forEach(clearTimeout);
			clearTimeout(land);
		};
	}, [roll, motion.reduceMotion, fade, spin, squash, wobble]);

	// The wobble while your own roll is in the air.
	useEffect(() => {
		if (!shaking) return;
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(wobble, { toValue: -WOBBLE_SHARE, duration: MOTION.tap, useNativeDriver: true }),
				Animated.timing(wobble, { toValue: WOBBLE_SHARE, duration: MOTION.tap, useNativeDriver: true }),
			]),
		);
		return startDecorativeLoop({ policy: motion, animation: loop, rest: () => wobble.setValue(0) });
	}, [shaking, motion, wobble]);

	// The tape slaps on when the last round begins.
	useEffect(() => {
		if (!tape) return;
		tapeScale.setValue(0);
		tapeOpacity.setValue(0);
		const slap = popIn(tapeScale, tapeOpacity, motion);
		slap.start();
		return () => slap.stop();
	}, [tape, motion, tapeScale, tapeOpacity]);

	const shown = flick && flick.roll === roll && !motion.reduceMotion ? flick.face : face;
	const landed = shown === face;
	const art = Math.round(size * DIE_ART_SHARE);
	const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: [`${TUMBLE_FROM_DEG}deg`, "0deg"] });
	const wobbleDeg = wobble.interpolate({ inputRange: [-1, 1], outputRange: [`${-THUD_DEG}deg`, `${THUD_DEG}deg`] });

	return (
		<View
			accessible
			accessibilityRole="image"
			accessibilityLabel={accessibilityLabel}
			testID="rootle-die"
			style={[styles.wrap, { width: size, height: size }]}
		>
			<Animated.View style={{ opacity: fade, transform: [{ rotate: spinDeg }, { rotate: wobbleDeg }, { scale: squash }] }}>
				<Sticker
					color={!isFace(face) ? "cream" : landed && face === HUNGERER ? "rose" : "paper"}
					radius={RADII.xl}
					borderStyle={isFace(face) ? "solid" : "dashed"}
					shadow={isFace(face) ? "sticker" : "none"}
					style={[styles.tray, { width: size, height: size }]}
				>
					{isFace(shown) ? (
						<Image
							source={ROOTLE_ART.die[shown - 1]}
							style={{ width: art, height: art }}
							resizeMode="contain"
							accessible={false}
							testID={`rootle-die-face-${shown}`}
						/>
					) : size >= WORDS_MIN ? (
						<Hand tone="secondary" align="center" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
							no rolls yet
						</Hand>
					) : null}
				</Sticker>
			</Animated.View>
			{tape ? (
				<Animated.View
					pointerEvents="none"
					testID="rootle-tape"
					style={[styles.tape, { opacity: tapeOpacity, transform: [{ rotate: `${TAPE_TILT}deg` }, { scale: tapeScale }] }]}
				>
					<T role="kickerPill" maxFontSizeMultiplier={BOARD_TYPE_CAP}>
						{tape}
					</T>
				</Animated.View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: "center",
		justifyContent: "center",
	},
	tray: {
		alignItems: "center",
		justifyContent: "center",
	},
	// Masking tape across the tray's top edge, overhanging it.
	tape: {
		position: "absolute",
		top: -SPACE.sm,
		alignSelf: "center",
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xxs,
		backgroundColor: WHIMSY.tape,
		borderColor: WHIMSY.tapeEdge,
		borderWidth: BORDER.thin,
	},
});
