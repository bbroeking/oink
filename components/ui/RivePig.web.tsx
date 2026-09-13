import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Asset } from "expo-asset";
import { Alignment, Fit, Layout, EventType, decodeImage, useRive, type ImageAsset } from "@rive-app/react-webgl2";
import { RasterPig } from "./RasterPig";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { usePigActive } from "@/hooks/usePigActive";
import { recordRivePigRendererFailure } from "@/utils/rivePigRollout";
import {
  RIVE_PIG_ARTBOARD, RIVE_PIG_STATE_MACHINE, RIVE_PIG_SKIN_ASSET,
  RIVE_PIG_COMPLETE_EVENT, resolveRivePigEquipment, rivePigSkinSource, type RivePigProps,
} from "./rivePigContract";
import { useRivePigPlayback, type PigPlaybackPort } from "./useRivePigPlayback";

export type { RivePigProps };
const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

export function RivePig(props: RivePigProps) {
  const motion = useMotionPolicy();
  const active = usePigActive(props.active);
  const reduced = props.reduceMotion ?? motion.reduceMotion;
  if (reduced || !resolveRivePigEquipment(props.equipment ?? {}).supported)
    return <RasterPig {...props} active={active} reduceMotion={reduced} />;
  return <WebPig key={`${props.source}:${props.pigId}:${props.skinSource}`} {...props} active={active} />;
}

function WebPig(props: RivePigProps) {
  const latest = useRef(props);
  useLayoutEffect(() => { latest.current = props; });
  const [failed, setFailed] = useState(false);
  const [skinReady, setSkinReady] = useState(false);
  const [state, setState] = useState("loading");
  const alive = useRef(true);
  const reportedError = useRef(false);
  const fail = useCallback((cause: unknown) => {
    if (!alive.current || reportedError.current) return;
    reportedError.current = true;
    const error = cause instanceof Error ? cause : new Error(String(cause));
    setFailed(true);
    recordRivePigRendererFailure(error, {
      pigId: latest.current.pigId ?? "rosie", animation: latest.current.animation, platform: "web",
    });
    latest.current.onRendererError?.(error);
  }, []);
  const skin = Asset.fromModule(props.skinSource ?? rivePigSkinSource(props.pigId ?? "rosie")).uri;
  const { rive, RiveComponent } = useRive({
    src: Asset.fromModule(props.source).uri,
    artboard: props.artboardName ?? RIVE_PIG_ARTBOARD,
    stateMachines: props.stateMachineName ?? RIVE_PIG_STATE_MACHINE,
    autoplay: false,
    layout,
    shouldDisableRiveListeners: true,
    enableRiveAssetCDN: false,
    onLoadError: () => fail(new Error("Could not load Rosie Rive asset")),
    onStateChange: (event) => setState(Array.isArray(event.data) ? event.data.join(",") : String(event.data)),
    assetLoader: (asset) => {
      if (asset.name !== RIVE_PIG_SKIN_ASSET || !asset.isImage) return false;
      void fetch(skin).then((response) => {
        if (!response.ok) throw new Error(`Rosie coat failed (${response.status})`);
        return response.arrayBuffer();
      }).then((bytes) => decodeImage(new Uint8Array(bytes))).then((image) => {
        if (alive.current) { (asset as ImageAsset).setRenderImage(image); setSkinReady(true); }
        image.unref();
      }).catch(fail);
      return true;
    },
  }, { useOffscreenRenderer: true });
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const port = useMemo<PigPlaybackPort | null>(() => {
    if (!rive || !skinReady || failed) return null;
    const machine = props.stateMachineName ?? RIVE_PIG_STATE_MACHINE;
    const inputs = rive.stateMachineInputs(machine);
    const input = (name: string) => {
      const result = inputs.find((item) => item.name === name);
      if (!result) throw new Error(`Missing Rosie input: ${name}`);
      return result;
    };
    return {
      number: (name, value) => { input(name).value = value; },
      fire: (name) => input(name).fire(),
      play: () => rive.play(machine),
      pause: () => rive.pause(machine),
      onComplete: (complete) => {
        const handler = (event: { data?: unknown }) => {
          if (event.data && typeof event.data === "object" && "name" in event.data && event.data.name === RIVE_PIG_COMPLETE_EVENT) complete();
        };
        rive.on(EventType.RiveEvent, handler);
        return () => rive.off(EventType.RiveEvent, handler);
      },
    };
  }, [rive, skinReady, failed, props.stateMachineName]);
  useRivePigPlayback(port, props, fail);
  useEffect(() => { if (port) latest.current.onRendererReady?.(); }, [port]);
  useEffect(() => {
    if (port || failed) return;
    const timeout = setTimeout(() => fail(new Error("Rosie Rive readiness timed out")), 4000);
    return () => clearTimeout(timeout);
  }, [port, failed, fail]);

  if (failed) return <RasterPig {...props} />;
  return <View style={[{ width: props.size ?? 300, height: props.size ?? 300 }, props.style]}>
    {!port && <RasterPig {...props} frameIdx={0} />}
    <View style={[StyleSheet.absoluteFill, { opacity: port ? 1 : 0 }]} pointerEvents="none">
      <RiveComponent style={{ width: "100%", height: "100%" }} aria-hidden="true" data-rive-state={state} />
    </View>
  </View>;
}
