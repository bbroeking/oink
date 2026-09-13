// The barn doors that open onto a Habitat and close behind you. The one motion
// surface in this slice, so it states its policy explicitly: `useMotionPolicy`
// decides the duration, and Reduce Motion takes the REST POSE — panels that do
// not travel at all, leaving a short crossfade. Durations are the shared
// MOTION_DURATION steps (celebration / state / crossfade), not hand-typed
// numbers.
//
// One door language at two scales. The ROOM tempo is the arrival: the Habitat
// itself opening, taking the full `celebration` beat because the room behind it
// is the event. The THRESHOLD tempo is the Exterior's own doorway — the same
// panels, the same travel, closing over the home tab at the brisker `state`
// beat, because a threshold is something you pass through, not something you
// watch. Same doors, same swing, two speeds.
//
// The swing itself is a SPRING, not a ramp. Doors this size moving on a linear
// timing read as a screen wipe; Rosie's press (a squash, then a spring that
// overshoots and settles) is the house motion, and the doors are now built out
// of the same physics at their own weight — `settle` for the room's arrival,
// the quicker `tap` for the threshold you pass through. `duration` stays on the
// motion contract: it is what Reduce Motion's crossfade runs on, and what the
// tests measure the two tempos by.
// [A-07] (2026-09-11; spring 2026-09-12)
import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { HABITAT_CHROME_ASSETS } from "@/constants/habitat";
import { MOTION_SPRING, WHIMSY } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";

export type HabitatDoorDirection = "enter" | "exit";

// "room": the Habitat opening onto you. "threshold": the Exterior's doorway
// closing behind you on the way in.
export type HabitatDoorTempo = "room" | "threshold";

// How far each door panel slides off-frame, in points. A drawing distance for
// this one piece of art, not a spacing step — so it carries its own name.
const DOOR_TRAVEL = 105;

// The doors are solid until the swing is a third done, then they fade out with
// the last of the travel.
const PANEL_FADE_INPUT = [0, 0.35, 1];
const PANEL_FADE_OUTPUT = [1, 1, 0];

// A spring overshoots its target, so `progress` runs past 1 and dips below 0.
// Opacity has no meaning outside 0..1, so every fade clamps at both ends. The
// TRAVEL clamps only at the closed end: overshooting OPEN just sends a panel
// further off-frame (invisible), but undershooting CLOSED would slide each
// panel past the seam and over its partner.
const CLAMP_BOTH = { extrapolate: "clamp" } as const;
const CLAMP_CLOSED = { extrapolateLeft: "clamp", extrapolateRight: "extend" } as const;

export function habitatDoorMotion(reduceMotion: boolean, direction: HabitatDoorDirection, tempo: HabitatDoorTempo = "room") {
  return {
    from: direction === "enter" ? 0 : 1,
    to: direction === "enter" ? 1 : 0,
    // Reduce Motion collapses both tempos to the one crossfade step.
    duration: reduceMotion ? MOTION_DURATION.crossfade : tempo === "room" ? MOTION_DURATION.celebration : MOTION_DURATION.state,
    // The rest pose: under Reduce Motion the panels never travel.
    travel: reduceMotion ? 0 : DOOR_TRAVEL,
    // The swing. Null under Reduce Motion, where `duration` drives a plain
    // crossfade instead — the one case where these doors do not spring.
    spring: reduceMotion ? null : tempo === "room" ? MOTION_SPRING.settle : MOTION_SPRING.tap,
  } as const;
}

// The value the progress track rests at with the doors wide open and the room
// showing through.
const DOORS_OPEN = 1;

// What the doors swing over. Cream is the ground everywhere the Habitat is the
// whole screen; `transparent` hands the ground to the surface behind the doors
// (the visit's host background), so a bottom-anchored room never shows a pale
// band above the action bar. (2026-09-12)
export type HabitatDoorGround = "cream" | "transparent";

export function HabitatDoorTransition({ children, direction = "enter", tempo = "room", mountedOpen = false, ground = "cream", onOpened, onClosed }: { children: ReactNode; direction?: HabitatDoorDirection; tempo?: HabitatDoorTempo; mountedOpen?: boolean; ground?: HabitatDoorGround; onOpened?: () => void; onClosed?: () => void }) {
  const policy = useMotionPolicy();
  const motion = habitatDoorMotion(policy.reduceMotion, direction, tempo);
  // A threshold you already stand inside: the Exterior mounts with its doors
  // open and only ever closes them on the way in, so it starts at rest rather
  // than swinging open at every cold start.
  const [progress] = useState(() => new Animated.Value(mountedOpen ? DOORS_OPEN : motion.from));
  const firstSwing = useRef(true);
  useEffect(() => {
    const next = habitatDoorMotion(policy.reduceMotion, direction, tempo);
    const settle = (finished: boolean) => {
      if (!finished) return;
      if (direction === "enter") onOpened?.();
      else onClosed?.();
    };
    const alreadyThere = firstSwing.current && mountedOpen && next.to === DOORS_OPEN;
    firstSwing.current = false;
    // Mounted open onto an "enter": the doors are already where the swing would
    // put them, so there is no swing to play. We skip the timing rather than
    // run a 450ms no-op, and hand the same `settle` the finished callback would
    // have got — `onOpened` still fires exactly once, just without the wait.
    if (alreadyThere) {
      settle(true);
      return;
    }
    // A spring finishes when the physics settle, not on a clock — but it hands
    // back the same `finished` flag, so `onOpened` / `onClosed` still fire
    // exactly once per swing and never on a swing we stopped.
    const animation = next.spring
      ? Animated.spring(progress, { toValue: next.to, ...next.spring, useNativeDriver: true })
      : Animated.timing(progress, { toValue: next.to, duration: next.duration, useNativeDriver: true });
    animation.start(({ finished }) => settle(finished));
    return () => animation.stop();
  }, [direction, mountedOpen, onClosed, onOpened, policy, progress, tempo]);
  const travel = motion.travel;
  const panelOpacity = progress.interpolate({ inputRange: PANEL_FADE_INPUT, outputRange: PANEL_FADE_OUTPUT, ...CLAMP_BOTH });
  const contentOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], ...CLAMP_BOTH });
  return <View style={[styles.root, ground === "transparent" && styles.rootBare]} testID="habitat-door-transition">
    <Animated.View style={[styles.content, { opacity: contentOpacity }]}>{children}</Animated.View>
    <Animated.View pointerEvents="none" style={[styles.panel, styles.left, { opacity: panelOpacity, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -travel], ...CLAMP_CLOSED }) }] }]}><Image source={HABITAT_CHROME_ASSETS.barnDoor} style={styles.doorImage} resizeMode="cover" /></Animated.View>
    <Animated.View pointerEvents="none" style={[styles.panel, styles.right, { opacity: panelOpacity, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, travel], ...CLAMP_CLOSED }) }] }]}><Image source={HABITAT_CHROME_ASSETS.barnDoor} style={styles.doorImageRight} resizeMode="cover" /></Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden", backgroundColor: WHIMSY.cream },
  rootBare: { backgroundColor: "transparent" },
  content: { flex: 1 },
  // Each panel covers just over half the frame so the two meet with no seam.
  panel: { position: "absolute", top: 0, bottom: 0, width: "51%", overflow: "hidden", backgroundColor: WHIMSY.bark },
  left: { left: 0 }, right: { right: 0 },
  // The door art is drawn as a full pair, so each panel shows one half of a
  // double-width image. `cover` fits the pair to the panel's full height, so
  // the raster is magnified to the phone: `barn_door.png` is exported at 10x
  // of its SVG (2600×3000, `scripts/habitat/generate-art.mjs`) so a 3x Pro Max
  // never upsamples it — the 1x export it started on blurred every edge.
  doorImage: { width: "200%", height: "100%" },
  doorImageRight: { position: "relative", left: "-100%", width: "200%", height: "100%" },
});
