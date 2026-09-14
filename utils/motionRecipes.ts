// Rosie's press, extracted — the app's one shared motion RECIPE.
//
// Tapping Rosie squashes her to 94% in 70ms and then springs her back with a
// loose `friction: 4`, so she overshoots a little before settling. That quick
// squash + bouncy settle is the house style for "this thing answered you", and
// it was living inline in `SwipeElement.handlePress` where nothing else could
// reach it. Now the barn takes the same press, and anything else that wants to
// feel like Rosie asks for it by name instead of retyping the numbers.
//
// It is a pure BUILDER, not a hook: it takes the caller's `MotionPolicy` and
// hands back an `Animated.CompositeAnimation` the caller starts. Under Reduce
// Motion it hands back the rest pose — a composite that snaps the value home
// and reports finished, so every call site's `.start()` / `finished` handling
// stays identical whether or not the motion plays. (2026-09-12)
//
// eslint ttp/animated-needs-motion-policy looks for a `useMotionPolicy()` call
// in the file that animates. A pure builder must not call a hook — the policy
// arrives as an argument and is honoured on the first line of the recipe — so
// the rule's heuristic cannot see what it is asking for here.
/* eslint-disable ttp/animated-needs-motion-policy */
import { Animated, Easing } from "react-native";
import { MOTION_DURATION, type MotionPolicy } from "@/hooks/useMotionPolicy";

// --- THE RECIPE ------------------------------------------------------------
// How deep the squash goes and how long it takes. 70ms has no step on
// MOTION_DURATION: the nearest is `feedback` (120), which is nearly twice as
// long and stops the squash reading as a snap. So it keeps its own name here
// rather than being rounded onto a step it does not sit on.
export const SQUASH_SCALE = 0.94;
export const SQUASH_MS = 70;
// Where the spring puts it back: its own full size.
export const REST_SCALE = 1;

// Rosie's bounce, kept in the Origami friction/tension vocabulary it was
// authored in. `friction: 4` with the default `tension: 40` converts to
// { damping: 13, stiffness: 230 } — which is NOT any MOTION_SPRING step:
// `overshoot` (damping 8, stiffness 140) is 40% softer and bouncier, and even
// the closest, `tap` (damping 14, stiffness 220), settles a touch tighter.
// Rounding onto either would change how the pig's press reads, and this press
// is the thing every other press is being matched TO — so the legacy pair is
// the token, named. [taste-standard: motion] (2026-09-12)
export const ROSIE_BOUNCE = { friction: 4 } as const;

/** The spring half of the recipe, minus the parts the builder owns. */
export type SpringRecipe = Omit<
	Animated.SpringAnimationConfig,
	"toValue" | "useNativeDriver"
>;

export interface SquashAndSpringOptions {
	/** How far in the squash goes. Defaults to Rosie's `SQUASH_SCALE`. */
	scale?: number;
	/** How long the squash takes. Defaults to Rosie's `SQUASH_MS`. */
	duration?: number;
	/** The spring that brings it home. Defaults to `ROSIE_BOUNCE`. */
	spring?: SpringRecipe;
	/** What "home" is. Defaults to `REST_SCALE`. */
	rest?: number;
}

/**
 * Rosie's press: a quick squash, then a bouncy spring back.
 *
 * Reduce Motion gets the REST POSE — the value snaps home and the composite
 * reports finished immediately, so a caller that sequences off `finished`
 * behaves the same either way.
 */
export function squashAndSpring(
	value: Animated.Value,
	policy: MotionPolicy,
	opts: SquashAndSpringOptions = {}
): Animated.CompositeAnimation {
	const {
		scale = SQUASH_SCALE,
		duration = SQUASH_MS,
		spring = ROSIE_BOUNCE,
		rest = REST_SCALE,
	} = opts;

	if (policy.reduceMotion) return restPose(value, rest);

	return Animated.sequence([
		Animated.timing(value, {
			toValue: scale,
			duration,
			useNativeDriver: true,
		}),
		Animated.spring(value, {
			toValue: rest,
			...spring,
			useNativeDriver: true,
		}),
	]);
}

// --- THE DIALOG POP-IN -----------------------------------------------------
// The alignment dialogs' entrance: the card springs up from nothing while its
// opacity eases in over the `state` step. A loose spring so the sticker
// overshoots a touch before settling — hand-wound, not a linear fade.
// The pair lived as two identical 25-line effects in AlignmentExplainerModal
// and AlignmentSchismModal; here it is once, by name. (2026-09-12)
export const POP_IN_SPRING = { tension: 60, friction: 7 } as const;

/**
 * Spring `scale` 0 → 1 while `opacity` fades 0 → 1. Under Reduce Motion the
 * scale snaps home and only the opacity crossfades, so the dialog still
 * arrives with a beat rather than teleporting in.
 */
export function popIn(
	scale: Animated.Value,
	opacity: Animated.Value,
	policy: MotionPolicy
): Animated.CompositeAnimation {
	if (policy.reduceMotion) {
		scale.setValue(1);
		return Animated.timing(opacity, {
			toValue: 1,
			duration: MOTION_DURATION.crossfade,
			useNativeDriver: true,
		});
	}
	return Animated.parallel([
		Animated.spring(scale, {
			toValue: 1,
			...POP_IN_SPRING,
			useNativeDriver: true,
		}),
		Animated.timing(opacity, {
			toValue: 1,
			duration: MOTION_DURATION.state,
			easing: Easing.out(Easing.quad),
			useNativeDriver: true,
		}),
	]);
}

// --- ROSIE'S BREATH ---------------------------------------------------------
// The rest loops are, visually, still drawings: the standing idle holds one
// pose (`idle_2`/`idle_4` are the same drawing, see PIG_ANIMATION_SPECS) and
// the seated rest blinks once every four seconds. So a pig at rest is alive by
// this instead — a slow out→in→out breath on the whole stage, so a worn hat
// rises with her. One breath is 3.2 s: nothing on MOTION_DURATION is within an
// order of magnitude of a breath, so the half-cycle keeps its own name. The
// depth is a 3% stretch with a 1.5% counter-squash — enough to see across the
// room, not enough to read as a bounce. (2026-09-13)
export const BREATH_HALF_MS = 1600;
export const BREATH_STRETCH = 1.03;
export const BREATH_SQUASH = 0.985;

/**
 * Loop `value` 0 → 1 → 0 forever at the breathing tempo. Under Reduce Motion
 * the value rests at 0 (no stretch) and the loop never starts.
 */
export function breathe(
	value: Animated.Value,
	policy: MotionPolicy
): Animated.CompositeAnimation {
	if (!policy.allowDecorativeMotion) return restPose(value, 0);
	return Animated.loop(
		Animated.sequence([
			Animated.timing(value, {
				toValue: 1,
				duration: BREATH_HALF_MS,
				easing: Easing.inOut(Easing.sin),
				useNativeDriver: true,
			}),
			Animated.timing(value, {
				toValue: 0,
				duration: BREATH_HALF_MS,
				easing: Easing.inOut(Easing.sin),
				useNativeDriver: true,
			}),
		])
	);
}

/**
 * The Reduce Motion answer to any recipe: put the value where the motion would
 * have left it and report finished, without animating. Shaped as a
 * `CompositeAnimation` so it is interchangeable with the real thing.
 */
export function restPose(
	value: Animated.Value,
	at: number
): Animated.CompositeAnimation {
	return {
		start: (callback) => {
			value.setValue(at);
			callback?.({ finished: true });
		},
		stop: () => {},
		reset: () => {
			value.setValue(at);
		},
	};
}
