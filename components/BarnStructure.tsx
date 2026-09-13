// The barn you actually tap. It stands on the Exterior beside Rosie, on her
// ground plane, and it is the entrance — not a gold button that happens to say
// "Enter Barn". The object you tap is the object that becomes the transition.
//
// ONE DOOR LANGUAGE AT TWO SCALES. The full-screen panels in
// `HabitatDoorTransition` SLIDE apart; so do this sprite's two leaves. They do
// not swing on a hinge, however much a real barn door would, because a rotation
// here followed by a translation there would read as two different doors. Same
// curve, same fade-after-35%-of-travel, same rest pose under Reduce Motion —
// only the travel distance changes (LEAF_TRAVEL here, DOOR_TRAVEL there).
//
// THE BARN WEARS PAINTED ART. The in-code react-native-svg drawing that held
// this place until the art landed is retired: the sprite is now three raster
// layers out of `assets/images/barn/exterior/` — `barn_body.png` (the barn with
// its doorway already hollowed to a dark interior) and the two
// `door_leaf_*.png` halves, laid over the body from the door fractions in
// `constants/barnExterior.ts`. Nothing about the geometry is eyeballed: the
// slicer writes `barn_layers.json`, this file reads it, and re-slicing the art
// moves the leaves on its own. (2026-09-12)
//
// The paper-sticker drop shadow is still an ink DUPLICATE of the silhouette
// drawn behind the body — now a second `Image` of the body tinted `WHIMSY.ink`
// rather than an SVG polygon. A View shadow over a transparent image paints the
// bounding box on Android, which is how you get a grey rectangle behind a barn.
//
// THE BARN PRESSES LIKE ROSIE. Tapping it runs `squashAndSpring` — the recipe
// lifted out of her own press — on top of the sticker shove, so the building
// answers a tap the way the pig does. Its leaves spring too (`settle`, the
// room tempo's spring at sprite scale) instead of ramping on a linear timing:
// one motion language, the same physics at three sizes. (2026-09-12)
import React, { useEffect, useState } from "react";
import {
	Animated,
	Image,
	Pressable,
	StyleSheet,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	MOTION_SPRING,
	OPACITY,
	RADII,
	SPACE,
	TILT,
	WHIMSY,
} from "@/constants/theme";
import { BARN_EXTERIOR_LAYERS } from "@/constants/barnExterior";
import { BARN_EXTERIOR_ASSETS } from "@/constants/habitat";
import {
	MOTION_DURATION,
	startDecorativeLoop,
	useMotionPolicy,
} from "@/hooks/useMotionPolicy";
import { REST_SCALE, squashAndSpring } from "@/utils/motionRecipes";

// --- ART -------------------------------------------------------------------
// Drawing distances for this one sprite, in points. They are dimensions of a
// picture, not steps on the spacing scale, so they carry their own names the
// way DOOR_TRAVEL and DOOR_ART do rather than borrowing a SPACE value that
// happens to match.

// The on-screen width of the painted body, and the offset its ink duplicate
// sits at (the 4,4 of STICKER_SHADOW, expressed as geometry because this shadow
// is a shape).
const ART_WIDTH = 118;
const SHADOW_OFFSET = 4;
const [BODY_PX_W, BODY_PX_H] = BARN_EXTERIOR_LAYERS.bodyPx;

// The sprite's box IS the body, at the art's own aspect (354 × 333 → 118 × 111).
// The ink duplicate hangs 4pt past it on purpose: it is a shadow, and reserving
// box for it would push the barn's baseline off Rosie's ground plane.
export const BARN_STRUCTURE_SIZE = {
	width: ART_WIDTH,
	height: Math.round((ART_WIDTH * BODY_PX_H) / BODY_PX_W),
} as const;

// The dark way in, resolved from the slicer's fractions. The glow and the two
// leaves sit exactly on this rect — the same rect the body's painted doorway
// occupies, so a shut door is flush with the wall around it.
const DOOR_FRACTIONS = BARN_EXTERIOR_LAYERS.door;
const DOORWAY = {
	x: DOOR_FRACTIONS.x * BARN_STRUCTURE_SIZE.width,
	y: DOOR_FRACTIONS.y * BARN_STRUCTURE_SIZE.height,
	width: DOOR_FRACTIONS.w * BARN_STRUCTURE_SIZE.width,
	height: DOOR_FRACTIONS.h * BARN_STRUCTURE_SIZE.height,
} as const;
// Where the left leaf ends. `seam` is a fraction of the doorway, so an
// off-centre seam in a future cut lands correctly without a code change.
const LEFT_LEAF_WIDTH = DOORWAY.width * DOOR_FRACTIONS.seam;
const RIGHT_LEAF_WIDTH = DOORWAY.width - LEFT_LEAF_WIDTH;

// How far each leaf slides, as a fraction of the doorway it is covering: far
// enough that a parted door shows the lit interior behind it, short of sliding
// a leaf clear of the wall it is painted on.
const LEAF_TRAVEL_FRAC = 0.3;
const LEAF_TRAVEL = Math.round(DOORWAY.width * LEAF_TRAVEL_FRAC);
// Ajar: the beckon pose holds the leaves 30% open, short of the fade threshold
// below, so a beckoning barn is a barn with its doors cracked — not a fading one.
const BECKON_LEAF = 0.3;
// Solid until the slide is a third done, then out with the last of the travel.
// The big panels' curve, verbatim.
const LEAF_FADE_INPUT = [0, 0.35, 1];
const LEAF_FADE_OUTPUT = [1, 1, 0];
// A spring overshoots, so `leaf` runs past its pose at both ends. Opacity has
// no meaning outside 0..1, and a leaf undershooting CLOSED would slide past the
// centre line and over its partner — so the fade clamps both ways and the
// travel clamps at the closed end. The far side is left to extend: a leaf
// swinging a hair wider than fully open is exactly the bounce we want.
const CLAMP_BOTH = { extrapolate: "clamp" } as const;
const CLAMP_CLOSED = {
	extrapolateLeft: "clamp",
	extrapolateRight: "extend",
} as const;
// How far down the lamp dips at the bottom of a beckon breath.
const GLOW_PULSE_LOW = 0.55;

export type BarnStructureState =
	| "closed"
	| "beckon"
	| "opening"
	| "open"
	| "closing";

/**
 * The pure pose resolver — `habitatDoorMotion`'s little sibling, and the reason
 * the five states are testable without mounting a renderer. Every state
 * animates TO its pose (there is no "already at rest, skip it" case), so the
 * duration is always a real one.
 */
export function barnStructurePose(
	state: BarnStructureState,
	reduceMotion: boolean
) {
	const parting = state === "opening" || state === "open";
	return {
		leaf: state === "beckon" ? BECKON_LEAF : parting ? 1 : 0,
		glow: state === "beckon" || parting ? 1 : 0,
		duration: reduceMotion ? MOTION_DURATION.crossfade : MOTION_DURATION.state,
		// The rest pose: under Reduce Motion the leaves never travel, exactly as
		// the full-screen panels never travel.
		travel: reduceMotion ? 0 : LEAF_TRAVEL,
		// The swing the leaves take. Null under Reduce Motion, where `duration`
		// runs the crossfade instead — the doorway's one un-sprung case. The
		// glow is a fade, not a swing, so it stays on `duration` either way.
		spring: reduceMotion ? null : MOTION_SPRING.settle,
	} as const;
}

export function BarnStructure({
	state,
	disabled = false,
	onPress,
	style,
	testID = "barn-structure",
}: {
	state: BarnStructureState;
	disabled?: boolean;
	onPress?: () => void;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}) {
	const policy = useMotionPolicy();
	const pose = barnStructurePose(state, policy.reduceMotion);
	const [leaf] = useState(() => new Animated.Value(pose.leaf));
	const [glow] = useState(() => new Animated.Value(pose.glow));
	const [pulse] = useState(() => new Animated.Value(1));
	// The whole building's press. Separate from the leaves: the doors answer the
	// STATE, this answers the TOUCH.
	const [press] = useState(() => new Animated.Value(REST_SCALE));

	useEffect(() => {
		const next = barnStructurePose(state, policy.reduceMotion);
		const animation = Animated.parallel([
			next.spring
				? Animated.spring(leaf, {
						toValue: next.leaf,
						...next.spring,
						useNativeDriver: true,
					})
				: Animated.timing(leaf, {
						toValue: next.leaf,
						duration: next.duration,
						useNativeDriver: true,
					}),
			Animated.timing(glow, {
				toValue: next.glow,
				duration: next.duration,
				useNativeDriver: true,
			}),
		]);
		animation.start();
		return () => animation.stop();
	}, [glow, leaf, policy, state]);

	// The beckon breath. Decorative, so it is the first thing Reduce Motion
	// takes away — `startDecorativeLoop` drops us back to a steady lamp.
	useEffect(() => {
		if (state !== "beckon") {
			pulse.setValue(1);
			return;
		}
		return startDecorativeLoop({
			policy,
			animation: Animated.loop(
				Animated.sequence([
					Animated.timing(pulse, {
						toValue: GLOW_PULSE_LOW,
						duration: MOTION_DURATION.celebration,
						useNativeDriver: true,
					}),
					Animated.timing(pulse, {
						toValue: 1,
						duration: MOTION_DURATION.celebration,
						useNativeDriver: true,
					}),
				])
			),
			rest: () => pulse.setValue(1),
		});
	}, [policy, pulse, state]);

	const travel = pose.travel;
	const leafOpacity = leaf.interpolate({
		inputRange: LEAF_FADE_INPUT,
		outputRange: LEAF_FADE_OUTPUT,
		...CLAMP_BOTH,
	});
	const leftX = leaf.interpolate({
		inputRange: [0, 1],
		outputRange: [0, -travel],
		...CLAMP_CLOSED,
	});
	const rightX = leaf.interpolate({
		inputRange: [0, 1],
		outputRange: [0, travel],
		...CLAMP_CLOSED,
	});
	const glowOpacity = Animated.multiply(glow, pulse);

	// Locked (habitat flag off): the painted art goes quiet. The outline that
	// used to survive a dim is BAKED INTO THE RASTER now — there is no separate
	// stroke left to spare — so the whole art layer takes `OPACITY.dim` instead,
	// and the ink shadow behind it stays at full strength so the building keeps
	// a legible silhouette rather than dissolving into the background.
	const artStyle = disabled ? styles.artAsleep : undefined;

	// Mid-swing the barn is busy being a door; a second tap is not a second push.
	const busy = state === "opening" || state === "open" || state === "closing";
	const handlePress = () => {
		if (busy) return;
		// Rosie's press, on a building. Reduce Motion is handled inside the
		// recipe, which hands back the rest pose instead of a squash.
		squashAndSpring(press, policy).start();
		onPress?.();
	};

	return (
		<Pressable
			accessible={!disabled}
			accessibilityRole="button"
			accessibilityLabel="Your Barn"
			accessibilityHint="Opens the doors to your room and furnishings"
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={disabled ? undefined : handlePress}
			hitSlop={HIT_SLOP}
			testID={testID}
			style={[styles.root, style]}
		>
			{({ pressed }) => (
				<Animated.View
					style={[styles.sprite, { transform: [{ scale: press }] }]}
					pointerEvents="none"
				>
					<Image
						source={BARN_EXTERIOR_ASSETS.body}
						style={styles.shadow}
						resizeMode="stretch"
					/>
					<Animated.View
						style={[styles.body, pressed && !disabled && styles.pressed]}
						pointerEvents="none"
					>
						<Image
							source={BARN_EXTERIOR_ASSETS.body}
							style={[styles.art, artStyle]}
							resizeMode="stretch"
						/>
						{/* The lamp inside the doorway — above the painted body (whose
						    doorway is opaque dark), below the leaves that hide it. */}
						<Animated.View
							style={[styles.glow, { opacity: glowOpacity }]}
							pointerEvents="none"
							testID="barn-structure-glow"
						/>
						<Animated.View
							style={[
								styles.leaf,
								styles.leftLeaf,
								{ opacity: leafOpacity, transform: [{ translateX: leftX }] },
							]}
							pointerEvents="none"
							testID="barn-structure-leaf-left"
						>
							<Image
								source={BARN_EXTERIOR_ASSETS.doorLeafLeft}
								style={[styles.leafArt, artStyle]}
								resizeMode="stretch"
							/>
						</Animated.View>
						<Animated.View
							style={[
								styles.leaf,
								styles.rightLeaf,
								{ opacity: leafOpacity, transform: [{ translateX: rightX }] },
							]}
							pointerEvents="none"
							testID="barn-structure-leaf-right"
						>
							<Image
								source={BARN_EXTERIOR_ASSETS.doorLeafRight}
								style={[styles.leafArt, artStyle]}
								resizeMode="stretch"
							/>
						</Animated.View>
					</Animated.View>
				</Animated.View>
			)}
		</Pressable>
	);
}

// The 44pt frame restored around a sprite that is allowed to look its own size
// (the IconButton visual/frame split, applied to a building).
const HIT_SLOP = SPACE.md;

const styles = StyleSheet.create({
	root: {
		width: BARN_STRUCTURE_SIZE.width,
		height: BARN_STRUCTURE_SIZE.height,
		// Sticker DNA: the barn leans the same degree the tickets do.
		transform: [{ rotate: `${TILT.card}deg` }],
	},
	// The sprite inside the frame — the thing that squashes. It fills the root
	// so the scale pivots on the building's own centre, and the press rides here
	// rather than on the Pressable so the 44pt touch frame never shrinks.
	sprite: {
		width: BARN_STRUCTURE_SIZE.width,
		height: BARN_STRUCTURE_SIZE.height,
	},
	// The ink duplicate, sitting where STICKER_SHADOW's 4,4 offset would put it.
	// `tintColor` flattens the painted body to one ink silhouette — the raster
	// equivalent of the polygon this replaced.
	shadow: {
		position: "absolute",
		left: SHADOW_OFFSET,
		top: SHADOW_OFFSET,
		width: BARN_STRUCTURE_SIZE.width,
		height: BARN_STRUCTURE_SIZE.height,
		tintColor: WHIMSY.ink,
	},
	body: {
		position: "absolute",
		left: 0,
		top: 0,
		width: BARN_STRUCTURE_SIZE.width,
		height: BARN_STRUCTURE_SIZE.height,
	},
	art: {
		width: BARN_STRUCTURE_SIZE.width,
		height: BARN_STRUCTURE_SIZE.height,
	},
	// The locked look: one dim over the painted layers only (see `artStyle`).
	artAsleep: {
		opacity: OPACITY.dim,
	},
	// The press: shove the sprite into its own shadow so the offset collapses,
	// the way PRESSED does for every other sticker. Same SPACE.xxs it shoves by.
	pressed: {
		transform: [{ translateX: SPACE.xxs }, { translateY: SPACE.xxs }],
	},
	glow: {
		position: "absolute",
		left: DOORWAY.x,
		top: DOORWAY.y,
		width: DOORWAY.width,
		height: DOORWAY.height,
		backgroundColor: WHIMSY.sun,
		borderRadius: RADII.hair,
	},
	leaf: {
		position: "absolute",
		top: DOORWAY.y,
		height: DOORWAY.height,
	},
	leftLeaf: { left: DOORWAY.x, width: LEFT_LEAF_WIDTH },
	rightLeaf: { left: DOORWAY.x + LEFT_LEAF_WIDTH, width: RIGHT_LEAF_WIDTH },
	// Each leaf fills its own half of the doorway; the wrapper above carries the
	// width, so the art stretches to exactly the rect the body painted.
	leafArt: {
		width: "100%",
		height: "100%",
	},
});
