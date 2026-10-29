import { useEffect, useMemo, useRef, useState } from "react";
import { decodeImage } from "@rive-app/react-webgl2";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceImage,
  useViewModelInstanceTrigger,
} from "@rive-app/react-webgl2";
import {
  CARD_PACK_RIVE,
  clamp,
  riveFinish,
  type CardArtSource,
  type CardPackRiveProps,
} from "./riveTypes";

// The web prototype build loads .riv as a URL string.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundledSource = require("../../../assets/rive/card-packs/card-pack-reveal.riv");
const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });
const sourceUrl = (source: CardArtSource) => typeof source === "string" ? source :
  typeof source === "number" ? String(source) : source.uri;

export function CardPackRive(props: CardPackRiveProps) {
  const [failed, setFailed] = useState<Error | null>(null);
  const [loadedArtUrl, setLoadedArtUrl] = useState<string | null>(null);
  const reportedReady = useRef(false);
  const reportedFailure = useRef(false);
  const lastActionToken = useRef(0);
  const artUrl = sourceUrl(props.cardArt);
  const src = props.sourcePath ?? (typeof bundledSource === "string" ? bundledSource : bundledSource?.default);
  const { rive, RiveComponent } = useRive({
    src,
    artboard: CARD_PACK_RIVE.artboard,
    stateMachines: CARD_PACK_RIVE.stateMachine,
    autoplay: true,
    layout,
    onLoadError: () => setFailed(new Error("Could not load card-pack Rive asset")),
  }, { useOffscreenRenderer: true });
  // Resolve the definition bound to this artboard. This stays robust if an
  // editor export ever contains another definition with the same display name.
  const viewModel = useViewModel(rive, { useDefault: true });
  const instance = useViewModelInstance(viewModel, { name: CARD_PACK_RIVE.viewModelInstance, rive });
  const { setValue: setArtValue } = useViewModelInstanceImage(
    CARD_PACK_RIVE.properties.cardArt,
    instance,
  );
  const tearComplete = useViewModelInstanceTrigger(CARD_PACK_RIVE.properties.tearComplete, instance,
    { onTrigger: () => props.onSignal?.("tearComplete") });
  const cardSettled = useViewModelInstanceTrigger(CARD_PACK_RIVE.properties.cardSettled, instance,
    { onTrigger: () => props.onSignal?.("cardSettled") });
  const inspectComplete = useViewModelInstanceTrigger(CARD_PACK_RIVE.properties.inspectComplete, instance,
    { onTrigger: () => props.onSignal?.("inspectComplete") });
  const sequenceComplete = useViewModelInstanceTrigger(CARD_PACK_RIVE.properties.sequenceComplete, instance,
    { onTrigger: () => props.onSignal?.("sequenceComplete") });

  useEffect(() => {
    if (!rive || !instance || failed) return;
    try {
      const numberValues = {
        tearProgress: clamp(props.tearProgress, 0, 1),
        revealIndex: clamp(Math.round(props.revealIndex), 0, 4),
        tiltX: clamp(props.tiltX, -1, 1),
        tiltY: clamp(props.tiltY, -1, 1),
      };
      for (const [name, value] of Object.entries(numberValues)) {
        const binding = instance.number(name);
        if (!binding) throw new Error(`Missing Rive number binding ${name}`);
        binding.value = value;
      }
      const motion = instance.boolean(CARD_PACK_RIVE.properties.reduceMotion);
      const finish = instance.enum(CARD_PACK_RIVE.properties.finish);
      const image = instance.image(CARD_PACK_RIVE.properties.cardArt);
      if (!motion || !finish || !image) throw new Error("Missing Rive finish, reduceMotion, or cardArt binding");
      motion.value = props.reduceMotion;
      finish.value = riveFinish(props.finish);
      for (const name of ["open", "reveal", "inspect", "reset"] as const) {
        if (!instance.trigger(CARD_PACK_RIVE.properties[name])) throw new Error(`Missing Rive trigger ${name}`);
      }
      for (const name of ["tearComplete", "cardSettled", "sequenceComplete"] as const) {
        if (!instance.trigger(CARD_PACK_RIVE.properties[name])) throw new Error(`Missing Rive output trigger ${name}`);
      }
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      queueMicrotask(() => setFailed(failure));
    }
  }, [failed, instance, props, rive]);

  useEffect(() => {
    if (!props.actionToken || props.actionToken === lastActionToken.current) return;
    if (!instance || failed || !props.active || loadedArtUrl !== artUrl) return;
    lastActionToken.current = props.actionToken;
    instance.trigger(CARD_PACK_RIVE.properties[props.action])?.trigger();
  }, [artUrl, failed, instance, loadedArtUrl, props.action, props.actionToken, props.active]);

  useEffect(() => {
    if (!rive) return;
    if (props.active) rive.play(CARD_PACK_RIVE.stateMachine);
    else rive.pause(CARD_PACK_RIVE.stateMachine);
    // useRive owns teardown. Calling pause from this effect's cleanup races its
    // disposal and can pass an already-deleted WASM artboard back to Embind.
  }, [props.active, rive]);

  useEffect(() => {
    if (!rive || !instance) return;
    let cancelled = false;
    void fetch(artUrl).then((response) => {
      if (!response.ok) throw new Error(`Card artwork failed (${response.status})`);
      return response.arrayBuffer();
    }).then((bytes) => decodeImage(new Uint8Array(bytes))).then((image) => {
      if (!cancelled) {
        setArtValue(image);
        setLoadedArtUrl(artUrl);
      }
      image.unref();
    }).catch((error: unknown) => {
      if (!cancelled) setFailed(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      cancelled = true;
      // The decoded image is unref'd after assignment and useRive owns the VM.
      // Do not mutate its image property while the WASM instance is tearing down.
    };
  }, [artUrl, instance, rive, setArtValue]);

  useEffect(() => {
    if (!instance || loadedArtUrl !== artUrl || failed || reportedReady.current) return;
    reportedReady.current = true;
    props.onReady?.();
  }, [artUrl, failed, instance, loadedArtUrl, props]);

  useEffect(() => {
    if (!failed || reportedFailure.current) return;
    reportedFailure.current = true;
    props.onError?.(failed);
  }, [failed, props]);

  // Referencing these hook results documents that all authored output triggers
  // are required by this adapter; the hooks themselves own the listeners.
  useMemo(() => [tearComplete, cardSettled, inspectComplete, sequenceComplete],
    [cardSettled, inspectComplete, sequenceComplete, tearComplete]);

  if (failed || !src) return null;
  return <RiveComponent style={{ width: "100%", height: "100%" }}
    aria-label="Card pack opening" />;
}
