import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Alignment, Fit, RiveView, useRive, useRiveFile } from "@rive-app/react-native";
import { RasterPig } from "./RasterPig";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePigActive } from "@/hooks/usePigActive";
import { recordRivePigRendererFailure } from "@/utils/rivePigRollout";
import {
  RIVE_PIG_ARTBOARD, RIVE_PIG_STATE_MACHINE, RIVE_PIG_SKIN_ASSET,
  RIVE_PIG_COMPLETE_EVENT, resolveRivePigEquipment, rivePigSkinSource,
  type RivePigProps,
} from "./rivePigContract";
import { useRivePigPlayback, type PigPlaybackPort } from "./useRivePigPlayback";

export type { RivePigProps };

export function RivePig(props: RivePigProps) {
  const motion = useMotionPolicy();
  const active = usePigActive(props.active);
  const reduced = props.reduceMotion ?? motion.reduceMotion;
  if (reduced || !resolveRivePigEquipment(props.equipment ?? {}).supported)
    return <RasterPig {...props} active={active} reduceMotion={reduced} />;
  // Remount the file owner too: referenced texture updates must never recolor
  // another visible pig, or leave the new view using its predecessor's inputs.
  return <NativePig key={`${props.source}:${props.pigId}:${props.skinSource}`} {...props} active={active} />;
}

function NativePig(props: RivePigProps) {
  const { source, pigId = "rosie", skinSource, size = 300, style } = props;
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const { riveViewRef, setHybridRef } = useRive();
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const reportedError = useRef(false);
  const referencedAssets = useMemo(() => ({
    [RIVE_PIG_SKIN_ASSET]: { source: skinSource ?? rivePigSkinSource(pigId) },
  }), [pigId, skinSource]);
  const { riveFile, error } = useRiveFile(source, { referencedAssets });
  const fail = useCallback((cause: unknown) => {
    if (reportedError.current) return;
    reportedError.current = true;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    setFailed(true);
    recordRivePigRendererFailure(error, {
      pigId, animation: latest.current.animation, platform: Platform.OS,
    });
    latest.current.onRendererError?.(error);
  }, [pigId]);

  useEffect(() => { if (error) fail(error); }, [error, fail]);
  useEffect(() => {
    if (failed || ready) return;
    const timeout = setTimeout(() => fail(new Error("Rosie Rive readiness timed out")), 4000);
    return () => clearTimeout(timeout);
  }, [failed, ready, fail]);
  useEffect(() => {
    if (!riveViewRef || failed) return;
    let mounted = true;
    riveViewRef.awaitViewReady().then((isReady) => {
      if (!mounted) return;
      if (!isReady) { fail(new Error("Rosie Rive view did not become ready")); return; }
      setReady(true);
      latest.current.onRendererReady?.();
    }).catch((cause: unknown) => { if (mounted) fail(cause); });
    return () => { mounted = false; };
  }, [riveViewRef, failed, fail]);

  const port = useMemo<PigPlaybackPort | null>(() => {
    if (!ready || !riveViewRef || failed) return null;
    return {
      number: (name, value) => riveViewRef.setNumberInputValue(name, value),
      fire: (name) => riveViewRef.triggerInput(name),
      play: () => riveViewRef.play(),
      pause: () => riveViewRef.pause(),
      onComplete: (complete) => {
        riveViewRef.onEventListener((event) => {
          if (event.name === RIVE_PIG_COMPLETE_EVENT) complete();
        });
        return () => riveViewRef.removeEventListeners();
      },
    };
  }, [ready, riveViewRef, failed]);
  useRivePigPlayback(port, props, fail);

  if (failed || !riveFile) return <RasterPig {...props} frameIdx={failed ? undefined : 0} />;
  return <View style={[{ width: size, height: size }, style]}>
    {!ready && <RasterPig {...props} frameIdx={0} />}
    <RiveView
    hybridRef={setHybridRef}
    file={riveFile}
    artboardName={props.artboardName ?? RIVE_PIG_ARTBOARD}
    stateMachineName={props.stateMachineName ?? RIVE_PIG_STATE_MACHINE}
    fit={Fit.Contain}
    alignment={Alignment.Center}
    autoPlay={false}
    style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
    onError={(event) => fail(new Error(event.message))}
    />
  </View>;
}
