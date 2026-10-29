import React, { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { PIG_ATTACHMENT_FRAMES } from "@/constants/pigAttachmentFrames.generated";
import { PIG_FRAMES } from "@/constants/pigFrames.generated";
import { PIG_FRAMES_EXTRA } from "@/constants/pigFramesExtra";
import { BORDER, RADII, SHADOW_SM, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePigPlayback } from "@/components/ui/usePigPlayback";
import type { RosieCostumeFit } from "@/features/cards/data/costumeFits";

const SOURCE_SIZE = 300;
const STAGE_SIZE = 360;
const PIG_LEFT = 30;
const PIG_TOP = 60;
const REFERENCE_CROWN = PIG_ATTACHMENT_FRAMES.rosie.idle_1;
const ROSIE_FRAMES = { ...PIG_FRAMES.rosie, ...PIG_FRAMES_EXTRA.rosie };

export function CostumeRosieStage({ fit, active = true, reduceMotion, displaySize = 300, showControls = true, frameIndex }: {
  fit: RosieCostumeFit | null;
  active?: boolean;
  reduceMotion?: boolean;
  displaySize?: number;
  showControls?: boolean;
  /** Controlled source frame for galleries: source and clothing share one parent clock. */
  frameIndex?: number;
}) {
  const motion = useMotionPolicy();
  const [paused, setPaused] = useState(false);
  const [inspectedFrame, setInspectedFrame] = useState(0);
  const playback = usePigPlayback({
    animation: "idle",
    active: active && !paused,
    reduced: reduceMotion ?? motion.reduceMotion,
    tempo: 1,
    frameIdx: frameIndex ?? (paused ? inspectedFrame : undefined),
    onFrame: frameIndex === undefined ? setInspectedFrame : undefined,
  });
  const displayedFrame = Math.max(0, Math.min(playback.frameIdx, playback.frames.length - 1));
  const frameName = playback.frames[displayedFrame];
  const frameSource = ROSIE_FRAMES[frameName] ?? PIG_FRAMES.rosie.idle_1;
  const crown = PIG_ATTACHMENT_FRAMES.rosie[frameName as keyof typeof PIG_ATTACHMENT_FRAMES.rosie] ?? REFERENCE_CROWN;
  const stageScale = displaySize / STAGE_SIZE;
  const hoodTransform = [
    { rotate: `${crown.rotation - REFERENCE_CROWN.rotation}deg` },
    { scale: crown.scale / REFERENCE_CROWN.scale },
  ];
  const transformOrigin = Platform.OS === "web"
    ? `${PIG_LEFT + REFERENCE_CROWN.x}px ${PIG_TOP + REFERENCE_CROWN.y}px`
    : [PIG_LEFT + REFERENCE_CROWN.x, PIG_TOP + REFERENCE_CROWN.y, 0];

  const step = (delta: number) => {
    setPaused(true);
    setInspectedFrame((current) => (current + delta + playback.frames.length) % playback.frames.length);
  };

  return <View style={styles.root}>
    <View style={{ width: displaySize, height: displaySize }}>
      <View
        accessibilityLabel={`Rosie${fit ? ` wearing ${fit.name}` : " without a costume"}, idle frame ${displayedFrame + 1}`}
        style={[styles.stage, { transform: [{ scale: stageScale }], transformOrigin: Platform.OS === "web" ? "top left" : [0, 0, 0] }]}
      >
        <Image source={frameSource} resizeMode="contain" style={styles.pig}/>
        {fit && <>
          <Image source={fit.hoodSource} resizeMode="stretch" style={[styles.layer, fit.hood, {
            left: fit.hood.left + crown.x - REFERENCE_CROWN.x,
            top: fit.hood.top + crown.y - REFERENCE_CROWN.y,
            transform: hoodTransform,
            transformOrigin,
          }]}/>
          <Image source={fit.romperSource} resizeMode="stretch" style={[styles.layer, fit.romper]}/>
        </>}
      </View>
    </View>
    {showControls ? <>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous idle frame" onPress={() => step(-1)} style={styles.control}><Text style={styles.controlText}>Previous</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Play idle animation" : "Pause idle animation"} onPress={() => setPaused(value => !value)} style={[styles.control, styles.primary]}><Text style={styles.controlText}>{paused ? "Play" : "Pause"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Next idle frame" onPress={() => step(1)} style={styles.control}><Text style={styles.controlText}>Next</Text></Pressable>
      </View>
      <Text style={styles.readout}>Idle frame {displayedFrame + 1} of {playback.frames.length} · one shared source clock</Text>
    </> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { alignItems: "center", gap: SPACE.md },
  stage: { width: STAGE_SIZE, height: STAGE_SIZE, position: "relative", overflow: "hidden", backgroundColor: WHIMSY.cream2, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.lg, ...SHADOW_SM },
  pig: { position: "absolute", left: PIG_LEFT, top: PIG_TOP, width: SOURCE_SIZE, height: SOURCE_SIZE },
  layer: { position: "absolute" },
  controls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACE.sm },
  control: { minWidth: 82, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.md, backgroundColor: UI_COLORS.surface, borderWidth: BORDER.ink, borderColor: UI_COLORS.border, borderRadius: RADII.xxl, ...SHADOW_SM },
  primary: { backgroundColor: WHIMSY.sun },
  controlText: { ...TYPE.label, color: UI_COLORS.textPrimary },
  readout: { ...TYPE.kicker, color: UI_COLORS.textSecondary, textAlign: "center" },
});
