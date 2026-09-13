// The Great Hungerer's face — the Snout Deep dig's pressure meter that is not
// a bar (spec §1.6). He sleeps at the edge of the patch: snoring in topsoil,
// stirring in the mud, one eye open at the root, and awake the frame he wakes.
// Drawn in the sticker hand (ink outline, flat fills, one lean), so it sits
// beside the paper sign like everything else on the screen.
//
// Motion: a slow breath (a 3 % swell) runs as a decorative loop under
// `startDecorativeLoop`, so Reduce Motion gets a still face; the flip to
// `awake` is one frame with no wobble either way (spec §1.7).
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Ellipse, Line, Path } from "react-native-svg";
import { WHIMSY } from "@/constants/theme";
import { startDecorativeLoop, useMotionPolicy } from "@/hooks/useMotionPolicy";

export type HungererState = "snoring" | "stirring" | "oneeye" | "awake";

// --- ART -------------------------------------------------------------------
// Drawing geometry for one object: the face fills a 64-unit box and is drawn
// once, so every size is a scale of these units, never a spacing step.
const FACE_BOX = 64;
const FACE_INK_W = 2.5;
const FINE_INK_W = 2;
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
 *  one eye open; `woke` overrides everything. */
export function hungererStateFor(layer: 0 | 1 | 2, woke: boolean): HungererState {
  if (woke) return "awake";
  return layer === 0 ? "snoring" : layer === 1 ? "stirring" : "oneeye";
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
        <Face state={state} size={size} />
      </Animated.View>
    </View>
  );
}

function Face({ state, size }: { state: HungererState; size: number }) {
  const ink = WHIMSY.ink;
  const skin = state === "awake" ? WHIMSY.roseDeep : WHIMSY.peach;
  const awake = state === "awake";
  const leftOpen = awake || state === "oneeye";
  const rightOpen = awake;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${FACE_BOX} ${FACE_BOX}`}>
      {/* ears */}
      <Path d="M12 22 L6 8 L22 14 Z" fill={skin} stroke={ink} strokeWidth={FACE_INK_W} strokeLinejoin="round" />
      <Path d="M52 22 L58 8 L42 14 Z" fill={skin} stroke={ink} strokeWidth={FACE_INK_W} strokeLinejoin="round" />
      {/* the head */}
      <Ellipse cx={32} cy={36} rx={24} ry={22} fill={skin} stroke={ink} strokeWidth={FACE_INK_W} />
      {/* brows: flat asleep, knit when stirring, up when awake */}
      {state === "stirring" ? (
        <>
          <Line x1={18} y1={26} x2={27} y2={29} stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
          <Line x1={46} y1={26} x2={37} y2={29} stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
        </>
      ) : awake ? (
        <>
          <Line x1={18} y1={22} x2={27} y2={20} stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
          <Line x1={46} y1={22} x2={37} y2={20} stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
        </>
      ) : null}
      {/* eyes */}
      {leftOpen ? (
        <>
          <Circle cx={23} cy={31} r={awake ? 5 : 4} fill={WHIMSY.paper} stroke={ink} strokeWidth={FINE_INK_W} />
          <Circle cx={23} cy={31} r={awake ? 2.5 : 1.8} fill={ink} />
        </>
      ) : (
        <Path d="M18 31 Q23 35 28 31" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
      )}
      {rightOpen ? (
        <>
          <Circle cx={41} cy={31} r={5} fill={WHIMSY.paper} stroke={ink} strokeWidth={FINE_INK_W} />
          <Circle cx={41} cy={31} r={2.5} fill={ink} />
        </>
      ) : (
        <Path d="M36 31 Q41 35 46 31" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
      )}
      {/* snout */}
      <Ellipse cx={32} cy={43} rx={9} ry={6} fill={WHIMSY.rose} stroke={ink} strokeWidth={FINE_INK_W} />
      <Circle cx={28.5} cy={43} r={1.6} fill={ink} />
      <Circle cx={35.5} cy={43} r={1.6} fill={ink} />
      {/* mouth: a soft line asleep, a twitch stirring, open awake */}
      {awake ? (
        <Ellipse cx={32} cy={53} rx={6} ry={3.5} fill={ink} />
      ) : state === "stirring" ? (
        <Path d="M27 52 Q32 55 37 51" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
      ) : (
        <Path d="M28 52 Q32 54 36 52" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" />
      )}
      {/* the snore: small z's, only while he snores */}
      {state === "snoring" ? (
        <>
          <Path d="M50 12 h5 l-5 5 h5" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M57 3 h4 l-4 4 h4" fill="none" stroke={ink} strokeWidth={FINE_INK_W} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", justifyContent: "center" },
});
