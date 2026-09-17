// The Great Hungerer — the Snout Deep dig's pressure meter that is not a bar
// (spec §1.6). He sleeps at the edge of the patch: snoring in topsoil,
// stirring in the mud, one eye open at the root, and awake the frame he wakes.
//
// HE IS THE REAL ART: one painting per state (`great_hungerer_{state}.png`,
// the ImageGen lane off the hero, 2026-09-14) — eyes shut and slack, brows
// knit with a sweat drop, one eye cracked at you, roaring with the crown
// askew — same pose, camera and size so the swap is a frame. The tag under
// him and the small overlays here ("z z" while snoring, a rose ring when
// awake) stay as accents.
//
// Motion: a slow breath (a 3 % swell) runs as a decorative loop under
// `startDecorativeLoop`, so Reduce Motion gets a still pig; the flip to
// `awake` is one frame with no wobble either way (spec §1.7).
import { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { Hand } from "@/components/ui";
import { BORDER, RADII, WHIMSY } from "@/constants/theme";
import { startDecorativeLoop, useMotionPolicy } from "@/hooks/useMotionPolicy";

export type HungererState = "snoring" | "stirring" | "oneeye" | "awake";

const HUNGERER_ART: Readonly<Record<HungererState, number>> = {
  snoring: require("../../assets/images/hunger/great_hungerer_snoring.png"),
  stirring: require("../../assets/images/hunger/great_hungerer_stirring.png"),
  oneeye: require("../../assets/images/hunger/great_hungerer_oneeye.png"),
  awake: require("../../assets/images/hunger/great_hungerer_awake.png"),
};

// --- ART -------------------------------------------------------------------
// Drawing geometry for one object, in points: the default box the art fills,
// the ring that marks him awake, and where the snore sits off his ear.
const FACE_BOX = 64;
const RING_INSET = -4;
const SNORE_RIGHT = -6;
const SNORE_TOP = -4;
// The breath: a slow swell and back, in ms and scale. Half of a "celebration"
// beat each way reads as sleep; the swell is small enough that the tag under
// him never moves.
const BREATH_MS = 1400;
const BREATH_SCALE = 1.03;
const REST_SCALE = 1;

export const HUNGERER_STATE_LABEL: Readonly<Record<HungererState, string>> = {
  snoring: "snoring",
  stirring: "stirring",
  oneeye: "one eye open",
  awake: "HE WOKE.",
};

/** His face for a layer (spec §1.6): topsoil snoring, mud stirring, the root
 *  one eye open; `attentive` (a sniff past the budget) lifts it a step; `woke`
 *  overrides everything. */
export function hungererStateFor(layer: 0 | 1 | 2, woke: boolean, attentive = false): HungererState {
  if (woke) return "awake";
  // Attention (the sniff budget, 2026-09-16) lifts his face one step: a
  // snorer stirs, a stirrer opens an eye. The root has nowhere higher to go
  // short of waking, so it stays one eye open — the tag says the rest.
  const step = (layer === 0 ? 0 : layer === 1 ? 1 : 2) + (attentive ? 1 : 0);
  return step <= 0 ? "snoring" : step === 1 ? "stirring" : "oneeye";
}

export function Hungerer({ state, size = FACE_BOX }: { state: HungererState; size?: number }) {
  const policy = useMotionPolicy();
  const breath = useRef(new Animated.Value(REST_SCALE)).current;

  useEffect(() => {
    if (state === "awake") {
      // One frame: no breath, no wobble — he is simply up.
      breath.setValue(REST_SCALE);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: BREATH_SCALE, duration: BREATH_MS, useNativeDriver: true }),
        Animated.timing(breath, { toValue: REST_SCALE, duration: BREATH_MS, useNativeDriver: true }),
      ]),
    );
    return startDecorativeLoop({
      policy,
      animation: loop,
      rest: () => breath.setValue(REST_SCALE),
    });
  }, [breath, policy, state]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`the Great Hungerer, ${HUNGERER_STATE_LABEL[state]}`}
      style={[styles.box, { width: size, height: size }]}
    >
      <Animated.View style={{ transform: [{ scale: breath }] }}>
        <Image
          source={HUNGERER_ART[state]}
          resizeMode="contain"
          accessible={false}
          style={{ width: size, height: size }}
        />
      </Animated.View>
      {state === "awake" ? <View pointerEvents="none" style={styles.ring} /> : null}
      {state === "snoring" ? (
        <Hand style={styles.snore} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          z z
        </Hand>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
  // Awake: a rose ring around him — the one-frame flip the screen's rose rim
  // echoes on the patch.
  ring: {
    position: "absolute",
    top: RING_INSET,
    left: RING_INSET,
    right: RING_INSET,
    bottom: RING_INSET,
    borderRadius: RADII.pill,
    borderWidth: BORDER.heavy,
    borderColor: WHIMSY.accent,
  },
  snore: {
    position: "absolute",
    top: SNORE_TOP,
    right: SNORE_RIGHT,
  },
});
