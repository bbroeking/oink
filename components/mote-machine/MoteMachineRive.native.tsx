import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import {
  Alignment,
  DataBindByName,
  Fit,
  RiveView,
  type RiveError,
  useRive,
  useRiveBoolean,
  useRiveFile,
  useRiveNumber,
  useRiveString,
  useRiveTrigger,
  useViewModelInstance,
} from "@rive-app/react-native";
import { MoteMachineFallback } from "./MoteMachineFallback";
import {
  MOTE_MACHINE_RIVE,
  type MoteMachineRiveViewModel,
} from "./moteMachineRiveContract";

export function MoteMachineRive({
  spinToken,
  resultValue,
  motes,
  reduceMotion,
  presenting,
  busy,
  canPlay,
  hasError,
  motesLabel,
  rewardLabel,
  actionLabel,
  statusLabel,
  confirmedRewardLabel,
  uncertainPlay,
  onRequestPlay,
  onRetryRuntime,
  onRuntimeReady,
  onRuntimeError,
  forceFailure = false,
  mode = 0, stakeMotes = 1, outcomeCode = 0, leftStop = 0,
  centerStop = 0, rightStop = 0, newlyUnlocked = false,
  replayedReceipt = false, phase = 0, resetToken = 0, enterToken = 0,
}: MoteMachineRiveViewModel) {
  const [failed, setFailed] = useState(false);
  const lastSpinToken = useRef(0);
  const lastResetToken = useRef(0);
  const lastEnterToken = useRef(0);
  const reportedReady = useRef(false);
  const reportedFailure = useRef(false);
  const { riveFile, isLoading, error: fileError } = useRiveFile("mote_machine");
  const { riveViewRef, setHybridRef } = useRive();
  const dataBind = useMemo(
    () => new DataBindByName(MOTE_MACHINE_RIVE.viewModelInstance),
    [],
  );
  const { instance, error: viewModelError } = useViewModelInstance(
    riveViewRef,
    {
      async: true,
    },
  );
  const { setValue: setMotes, error: motesError } = useRiveNumber(
    MOTE_MACHINE_RIVE.properties.motes,
    instance,
  );
  const { setValue: setResultValue, error: resultValueError } = useRiveNumber(
    MOTE_MACHINE_RIVE.properties.resultValue,
    instance,
  );
  const { setValue: setReduceMotion, error: reduceMotionError } =
    useRiveBoolean(MOTE_MACHINE_RIVE.properties.reduceMotion, instance);
  const { setValue: setPresenting, error: presentingError } = useRiveBoolean(
    MOTE_MACHINE_RIVE.properties.presenting,
    instance,
  );
  const { setValue: setBusy, error: busyError } = useRiveBoolean(
    MOTE_MACHINE_RIVE.properties.busy,
    instance,
  );
  const { setValue: setCanPlay, error: canPlayError } = useRiveBoolean(
    MOTE_MACHINE_RIVE.properties.canPlay,
    instance,
  );
  const { setValue: setHasError, error: hasErrorError } = useRiveBoolean(
    MOTE_MACHINE_RIVE.properties.hasError,
    instance,
  );
  const { setValue: setMotesLabel, error: motesLabelError } = useRiveString(
    MOTE_MACHINE_RIVE.properties.motesLabel,
    instance,
  );
  const { setValue: setRewardLabel, error: rewardLabelError } = useRiveString(
    MOTE_MACHINE_RIVE.properties.rewardLabel,
    instance,
  );
  const { setValue: setActionLabel, error: actionLabelError } = useRiveString(
    MOTE_MACHINE_RIVE.properties.actionLabel,
    instance,
  );
  const { setValue: setStatusLabel, error: statusLabelError } = useRiveString(
    MOTE_MACHINE_RIVE.properties.statusLabel,
    instance,
  );
  const { error: requestPlayError } = useRiveTrigger(
    MOTE_MACHINE_RIVE.properties.requestPlay,
    instance,
    { onTrigger: onRequestPlay },
  );
  const { trigger: triggerSpin, error: spinError } = useRiveTrigger(
    MOTE_MACHINE_RIVE.properties.spin,
    instance,
  );
  const v4Numbers = [
    useRiveNumber(MOTE_MACHINE_RIVE.properties.mode, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.stakeMotes, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.outcomeCode, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.leftStop, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.centerStop, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.rightStop, instance),
    useRiveNumber(MOTE_MACHINE_RIVE.properties.phase, instance),
  ];
  const v4Booleans = [
    useRiveBoolean(MOTE_MACHINE_RIVE.properties.newlyUnlocked, instance),
    useRiveBoolean(MOTE_MACHINE_RIVE.properties.replayedReceipt, instance),
  ];
  const resetBinding = useRiveTrigger(MOTE_MACHINE_RIVE.properties.reset, instance);
  const enterBinding = useRiveTrigger(MOTE_MACHINE_RIVE.properties.enter, instance);
  const v4Ready = [...v4Numbers, ...v4Booleans, resetBinding, enterBinding].every((binding) => !binding.error);
  const forcedFailure =
    typeof __DEV__ !== "undefined" && __DEV__ && forceFailure;

  useEffect(() => {
    if (!instance) return;
    setMotes(motes);
    setMotesLabel(motesLabel);
    setReduceMotion(reduceMotion);
    setResultValue(resultValue);
    setRewardLabel(rewardLabel);
    setBusy(busy);
    setCanPlay(canPlay);
    setHasError(hasError);
    setActionLabel(actionLabel);
    setStatusLabel(statusLabel);
    // Display state only. The separate receipt-bound trigger starts motion
    // after all confirmed values have been bound.
    setPresenting(presenting);
    if (v4Ready) {
      [mode, stakeMotes, outcomeCode, leftStop, centerStop, rightStop, phase]
        .forEach((value, index) => v4Numbers[index].setValue(value));
      v4Booleans[0].setValue(newlyUnlocked);
      v4Booleans[1].setValue(replayedReceipt);
    }
    riveViewRef?.playIfNeeded?.();
  }, [
    actionLabel,
    busy,
    canPlay,
    hasError,
    instance,
    motes,
    motesLabel,
    presenting,
    reduceMotion,
    riveViewRef,
    setActionLabel,
    setBusy,
    setCanPlay,
    setHasError,
    setMotes,
    setMotesLabel,
    setPresenting,
    setReduceMotion,
    setResultValue,
    setRewardLabel,
    setStatusLabel,
    statusLabel,
    resultValue,
    rewardLabel,
    mode, stakeMotes, outcomeCode, leftStop, centerStop, rightStop, phase,
    newlyUnlocked, replayedReceipt, v4Ready,
  ]);

  useEffect(() => {
    if (!instance || !v4Ready) return;
    if (resetToken && resetToken !== lastResetToken.current) {
      lastResetToken.current = resetToken; resetBinding.trigger();
    }
    if (enterToken && enterToken !== lastEnterToken.current) {
      lastEnterToken.current = enterToken; enterBinding.trigger();
    }
  }, [enterBinding, enterToken, instance, resetBinding, resetToken, v4Ready]);

  useEffect(() => {
    if (!instance || spinToken === 0 || spinToken === lastSpinToken.current)
      return;
    lastSpinToken.current = spinToken;
    triggerSpin();
    riveViewRef?.playIfNeeded?.();
  }, [instance, riveViewRef, spinToken, triggerSpin]);

  const contractError =
    fileError ??
    viewModelError ??
    motesError ??
    resultValueError ??
    motesLabelError ??
    rewardLabelError ??
    reduceMotionError ??
    spinError;
  const fullContractError =
    contractError ??
    busyError ??
    canPlayError ??
    hasErrorError ??
    actionLabelError ??
    statusLabelError ??
    requestPlayError;
  const runtimeContractError = fullContractError ?? presentingError;

  useEffect(() => {
    if (
      !instance ||
      runtimeContractError ||
      forcedFailure ||
      reportedReady.current
    )
      return;
    reportedReady.current = true;
    onRuntimeReady?.(v4Ready ? "mote-animation-v4" : "mote-animation-v3");
  }, [forcedFailure, instance, onRuntimeReady, runtimeContractError, v4Ready]);

  useEffect(() => {
    if (
      (!failed && !runtimeContractError && !forcedFailure) ||
      reportedFailure.current
    )
      return;
    reportedFailure.current = true;
    onRuntimeError?.();
  }, [failed, forcedFailure, onRuntimeError, runtimeContractError]);

  if (
    failed ||
    runtimeContractError ||
    forcedFailure ||
    isLoading ||
    !riveFile
  ) {
    return (
      <MoteMachineFallback
        loading={!failed && !runtimeContractError && !forcedFailure}
        confirmedRewardLabel={confirmedRewardLabel}
        uncertainPlay={uncertainPlay}
        onRetryRuntime={onRetryRuntime}
      />
    );
  }

  return (
    <RiveView
      file={riveFile}
      artboardName={MOTE_MACHINE_RIVE.artboard}
      stateMachineName={MOTE_MACHINE_RIVE.stateMachine}
      dataBind={dataBind}
      hybridRef={setHybridRef}
      fit={Fit.Contain}
      alignment={Alignment.Center}
      autoPlay
      style={styles.rive}
      onError={(_error: RiveError) => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({ rive: { width: "100%", height: "100%" } });
