import React, { isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ART_SIZE } from "@/constants/theme";
import { PigStage } from "@/components/ui/PigStage";
import type { PigAnimation, PigMood, PigReactionKind } from "@/components/ui/pigRendererContract";
import { useHabitatPigConsumer } from "@/hooks/useHabitatPigBridge";
import { MOTE_TIMING, type MotePresentationOutcome } from "./moteMachineTiming";

// Planned pig-rive-v4 names. These remain presentation intent until the shared
// rig exporter and runtime verifier publish that version.
export type MoteRosieAuthoredReaction = "attention" | "brace" | "track_left" |
  "track_center" | "track_right" | "wince" | "relieved_nod" | "hoof_tap" |
  "proud_jump" | "hoof_clap" | "unlock_lean" | "empty_glance" | "recovery_watch";
export type MoteRosieBeat = "ready" | "empty" | "commit_pending" | "deposit" | "spin" |
  "stop_left" | "stop_center" | "stop_right" | "result" | "unlock" | "recovery";
export type MoteRosiePerformance = { authored: MoteRosieAuthoredReaction | null; fallback: PigReactionKind | null; animation: PigAnimation };

export function resolveMoteRosiePerformance(beat: MoteRosieBeat, outcome: MotePresentationOutcome | null, reduced: boolean): MoteRosiePerformance {
  if (beat === "ready") return { authored: null, fallback: null, animation: "idle" };
  if (beat === "empty") return { authored: "empty_glance", fallback: reduced ? null : "surprise", animation: "idle" };
  if (beat === "commit_pending" || beat === "deposit") return { authored: "attention", fallback: reduced ? null : "surprise", animation: "idle" };
  if (beat === "spin") return { authored: "brace", fallback: reduced ? null : "surprise", animation: reduced ? "idle" : "bounce" };
  if (beat.startsWith("stop_")) return { authored: beat === "stop_left" ? "track_left" : beat === "stop_center" ? "track_center" : "track_right", fallback: null, animation: "idle" };
  if (beat === "recovery") return { authored: "recovery_watch", fallback: null, animation: "idle" };
  if (beat === "unlock") return { authored: "unlock_lean", fallback: reduced ? null : "happy", animation: reduced ? "idle" : "happy" };
  const result = outcome ?? "loss";
  const authored = ({ loss: "wince", returned_stake: "relieved_nod", small: "hoof_tap", medium: "hoof_tap", big: "proud_jump", jackpot: "hoof_clap" } as const)[result];
  const fallback: PigReactionKind | null = reduced ? null
    : result === "loss" ? null : result === "returned_stake" ? "surprise" : result === "small" || result === "medium" ? "happy" : "jump";
  return { authored, fallback, animation: fallback === "jump" ? "jump" : fallback === "happy" ? "happy" : "idle" };
}

function playerPigProps(node: ReactNode): Record<string, unknown> | null {
  if (Array.isArray(node)) { for (const child of node) { const found = playerPigProps(child); if (found) return found; } return null; }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown>;
  if ("restingAnim" in props && "pigId" in props) return props;
  return playerPigProps(props.children as ReactNode);
}

export function MoteRosieStage({ phase, outcome, receiptId, newlyUnlocked, replayed,
  reduceMotion, presentationVersion, active }: { phase: number; outcome: MotePresentationOutcome | null;
  receiptId: string | null; newlyUnlocked: boolean; replayed: boolean; reduceMotion: boolean;
  presentationVersion: "mote-animation-v3" | "mote-animation-v4"; active: boolean }) {
  const bridge = useHabitatPigConsumer();
  const [beat, setBeat] = useState<MoteRosieBeat>(phase === 1 ? "empty" : "ready");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (!active) { setBeat("ready"); return; }
    const later = (at: number, next: MoteRosieBeat) => timers.current.push(setTimeout(() => setBeat(next), at));
    if (phase === 1) setBeat("empty");
    else if (phase === 2) setBeat("commit_pending");
    else if (phase === 3 && receiptId) {
      if (replayed) { setBeat("recovery"); later(MOTE_TIMING.replay, "result"); }
      else if (reduceMotion) { setBeat("deposit"); later(MOTE_TIMING.reducedReadable, "result"); }
      else {
        setBeat("deposit"); later(MOTE_TIMING.reelStart, "spin"); later(MOTE_TIMING.stopLeft, "stop_left");
        later(presentationVersion === "mote-animation-v3" ? 3400 : MOTE_TIMING.stopCenter, "stop_center");
        later(presentationVersion === "mote-animation-v3" ? 3717 : MOTE_TIMING.stopRight, "stop_right");
        later(presentationVersion === "mote-animation-v3" ? 4300 : MOTE_TIMING.readable[outcome ?? "loss"], "result");
      }
    } else if (phase === 4) setBeat(newlyUnlocked && !replayed ? "unlock" : replayed ? "recovery" : "result");
    else setBeat("ready");
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [active, newlyUnlocked, outcome, phase, presentationVersion, receiptId, reduceMotion, replayed]);
  const performance = resolveMoteRosiePerformance(beat, outcome, reduceMotion);
  const sequence = useRef(0); const prior = useRef("");
  const reactionKey = `${receiptId ?? "idle"}:${beat}`;
  if (prior.current !== reactionKey) { prior.current = reactionKey; sequence.current += 1; }
  const reaction = performance.fallback ? { id: sequence.current, kind: performance.fallback } : null;
  const player = playerPigProps(bridge.presentation);
  const restingAnim = player?.restingAnim;
  const pigMood: PigMood = restingAnim === "happy" || restingAnim === "sad" || restingAnim === "tired" ? restingAnim : "content";
  const content = <PigStage pigId={(player?.pigId as "rosie") ?? "rosie"} pigAnimation={performance.animation}
    pigMood={pigMood} pigReaction={reaction} pigFrozen={reduceMotion} pigFrameIdx={0} active={active}
    equipped={player?.equipped as never} equippedBow={player?.equippedBow as never}
    equippedGlasses={player?.equippedGlasses as never} equippedMask={player?.equippedMask as never}
    equippedNeck={player?.equippedNeck as never} equippedAura={player?.equippedAura as never}
    equippedHeld={player?.equippedHeld as never} prestigeLevel={player?.prestigeLevel as number | undefined} />;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    testID="mote-rosie-stage" style={styles.safeZone} data-authored-reaction={performance.authored ?? "none"}>
    <View style={styles.scaledPig}>{content}</View>
  </View>;
}

// Drawing geometry, not spacing. COMPANION_POCKET is the lower-left window the
// authored 390×844 machine stage leaves for Rosie — it ends above the native
// receipt/controls and never reaches the centre reel bank — and PIG_RESERVE is
// PigStage's own square reserve (ART_SIZE.stage), scaled down into that window.
const COMPANION_POCKET = { width: 118, height: 132 };
const PIG_RESERVE = { width: ART_SIZE.stage, height: ART_SIZE.stage };

const styles = StyleSheet.create({
  safeZone: { position: "absolute", left: 0, bottom: 0, ...COMPANION_POCKET, overflow: "hidden", zIndex: 3 },
  scaledPig: { position: "absolute", ...PIG_RESERVE, left: -91, top: -84, transform: [{ scale: 0.44 }] },
});
