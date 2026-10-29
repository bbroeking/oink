import { useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet } from "react-native";
import {
  Alignment,
  DataBindByName,
  Fit,
  RiveImages,
  RiveView,
  type RiveError,
  type RiveImage,
  useRive,
  useRiveBoolean,
  useRiveEnum,
  useRiveFile,
  useRiveNumber,
  useRiveTrigger,
  useViewModelInstance,
} from "@rive-app/react-native";
import {
  CARD_PACK_RIVE,
  clamp,
  riveFinish,
  type CardArtSource,
  type CardPackRiveProps,
  type CardPackSignal,
} from "./riveTypes";

// Metro turns the bundled .riv into the numeric module accepted by useRiveFile.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bundledSource = require("../../../assets/rive/card-packs/card-pack-reveal.riv");

function imageUri(source: CardArtSource) {
  if (typeof source === "string") return source;
  if (typeof source === "number") return Image.resolveAssetSource(source)?.uri;
  return source.uri;
}

export function CardPackRive(props: CardPackRiveProps) {
  const [failed, setFailed] = useState<Error | null>(null);
  const [loadedArtUri, setLoadedArtUri] = useState<string | null>(null);
  const reportedReady = useRef(false);
  const reportedFailure = useRef(false);
  const lastActionToken = useRef(0);
  const artUri = imageUri(props.cardArt);
  const { riveFile, isLoading, error: fileError } = useRiveFile(bundledSource);
  const { riveViewRef, setHybridRef } = useRive();
  const dataBind = useMemo(
    () => new DataBindByName(CARD_PACK_RIVE.viewModelInstance),
    [],
  );
  const { instance, error: instanceError } = useViewModelInstance(riveViewRef, {
    async: true,
  });
  const tear = useRiveNumber(CARD_PACK_RIVE.properties.tearProgress, instance);
  const revealIndex = useRiveNumber(CARD_PACK_RIVE.properties.revealIndex, instance);
  const tiltX = useRiveNumber(CARD_PACK_RIVE.properties.tiltX, instance);
  const tiltY = useRiveNumber(CARD_PACK_RIVE.properties.tiltY, instance);
  const finish = useRiveEnum(CARD_PACK_RIVE.properties.finish, instance);
  const reduceMotion = useRiveBoolean(CARD_PACK_RIVE.properties.reduceMotion, instance);
  const open = useRiveTrigger(CARD_PACK_RIVE.properties.open, instance);
  const reveal = useRiveTrigger(CARD_PACK_RIVE.properties.reveal, instance);
  const inspect = useRiveTrigger(CARD_PACK_RIVE.properties.inspect, instance);
  const reset = useRiveTrigger(CARD_PACK_RIVE.properties.reset, instance);
  const signal = (name: CardPackSignal) => ({ onTrigger: () => props.onSignal?.(name) });
  const tearComplete = useRiveTrigger(CARD_PACK_RIVE.properties.tearComplete, instance, signal("tearComplete"));
  const cardSettled = useRiveTrigger(CARD_PACK_RIVE.properties.cardSettled, instance, signal("cardSettled"));
  useRiveTrigger(CARD_PACK_RIVE.properties.inspectComplete, instance, signal("inspectComplete"));
  const sequenceComplete = useRiveTrigger(CARD_PACK_RIVE.properties.sequenceComplete, instance, signal("sequenceComplete"));

  const bindingError = fileError ?? instanceError ?? tear.error ?? revealIndex.error ??
    tiltX.error ?? tiltY.error ?? finish.error ?? reduceMotion.error ?? open.error ??
    reveal.error ?? inspect.error ?? reset.error ?? tearComplete.error ??
    cardSettled.error ?? sequenceComplete.error;

  useEffect(() => {
    if (!instance || bindingError) return;
    tear.setValue(clamp(props.tearProgress, 0, 1));
    revealIndex.setValue(clamp(Math.round(props.revealIndex), 0, 4));
    tiltX.setValue(clamp(props.tiltX, -1, 1));
    tiltY.setValue(clamp(props.tiltY, -1, 1));
    finish.setValue(riveFinish(props.finish));
    reduceMotion.setValue(props.reduceMotion);
    riveViewRef?.playIfNeeded?.();
  }, [bindingError, finish, instance, props.finish, props.reduceMotion, props.revealIndex,
    props.tearProgress, props.tiltX, props.tiltY, reduceMotion, revealIndex, riveViewRef,
    tear, tiltX, tiltY]);

  useEffect(() => {
    if (!instance || bindingError) return;
    const property = instance.imageProperty(CARD_PACK_RIVE.properties.cardArt);
    if (!property) {
      queueMicrotask(() => setFailed(new Error(`Missing Rive image binding ${CARD_PACK_RIVE.properties.cardArt}`)));
      return;
    }
    if (!artUri) {
      queueMicrotask(() => setFailed(new Error("Card artwork has no resolvable URI")));
      return;
    }
    let cancelled = false;
    let loadedImage: RiveImage | null = null;
    void RiveImages.loadFromURLAsync(artUri).then((image) => {
      if (cancelled) { image.dispose(); return; }
      loadedImage = image;
      property.set(image);
      setLoadedArtUri(artUri);
      riveViewRef?.playIfNeeded?.();
    }).catch((error: unknown) => {
      if (!cancelled) setFailed(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      cancelled = true;
      try { property.set(undefined); } catch { /* Runtime may already be disposed. */ }
      try { loadedImage?.dispose(); } catch { /* Hybrid image may already be disposed. */ }
    };
  }, [artUri, bindingError, instance, riveViewRef]);

  useEffect(() => {
    if (!props.actionToken || props.actionToken === lastActionToken.current) return;
    // Wait for the artwork associated with this render. If the host advances
    // again while it loads, React replaces these props and the superseded token
    // never fires against either card.
    if (!instance || bindingError || !props.active || !artUri || loadedArtUri !== artUri) return;
    lastActionToken.current = props.actionToken;
    ({ open, reveal, inspect, reset })[props.action].trigger();
    riveViewRef?.playIfNeeded?.();
  }, [bindingError, inspect, instance, loadedArtUri, open, props.action, props.actionToken,
    props.active, artUri, reset, reveal, riveViewRef]);

  useEffect(() => {
    if (!riveViewRef) return;
    if (props.active) riveViewRef.playIfNeeded?.();
    else riveViewRef.pause?.();
    return () => { void riveViewRef.pause?.().catch(() => undefined); };
  }, [props.active, props.phase, riveViewRef]);

  useEffect(() => {
    if (!instance || !artUri || loadedArtUri !== artUri || bindingError || failed || reportedReady.current) return;
    reportedReady.current = true;
    props.onReady?.();
  }, [artUri, bindingError, failed, instance, loadedArtUri, props]);

  const error = failed ?? bindingError;
  useEffect(() => {
    if (!error || reportedFailure.current) return;
    reportedFailure.current = true;
    props.onError?.(error);
  }, [error, props]);

  if (error || isLoading || !riveFile) return null;
  return <RiveView file={riveFile} artboardName={CARD_PACK_RIVE.artboard}
    stateMachineName={CARD_PACK_RIVE.stateMachine} dataBind={dataBind}
    hybridRef={setHybridRef} fit={Fit.Contain} alignment={Alignment.Center}
    autoPlay style={styles.rive}
    onError={(value: RiveError) => setFailed(new Error(value.message ?? "Rive renderer failed"))} />;
}

const styles = StyleSheet.create({ rive: { width: "100%", height: "100%" } });
