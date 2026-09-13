import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { PigRenderer } from "./PigRenderer";
import { RIVE_PIG_SOURCE } from "./rivePigAsset";
import { usePigActive } from "@/hooks/usePigActive";

export const ROSIE_LOADING_DELAY_MS = 200;

/** Reserve the footprint immediately; cached requests never mount a canvas. */
export function WaitingRosie({ size = 56, active = true }: { size?: number; active?: boolean }) {
  const visible = usePigActive(active);
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    if (!visible || waiting) return;
    const timer = setTimeout(() => setWaiting(true), ROSIE_LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, waiting]);
  return <View style={{ width: size, height: size }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <PigRenderer animation="idle" size={size} active={visible && waiting}
      frameIdx={visible && waiting ? undefined : 0} renderer="rive" riveSource={RIVE_PIG_SOURCE} rolloutEnabled />
  </View>;
}
