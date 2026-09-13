import { useEffect, useRef, useState } from "react";
import { Asset } from "expo-asset";
import { log } from "@/utils/log";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceTrigger,
} from "@rive-app/react-webgl2";
import { MoteMachineFallback } from "./MoteMachineFallback";
import {
  MOTE_MACHINE_RIVE,
  type MoteMachineRiveViewModel,
} from "./moteMachineRiveContract";

const source = Asset.fromModule(
  require("../../assets/rive/mote-machine.riv"),
).uri;
const layout = new Layout({ fit: Fit.Contain, alignment: Alignment.Center });

/** The same authored file and receipt contract used by the native machine. */
export function MoteMachineRive(props: MoteMachineRiveViewModel) {
  const [failed, setFailed] = useState(false);
  const [animationState, setAnimationState] = useState("loading");
  const reportedReady = useRef(false);
  const reportedFailure = useRef(false);
  const lastSpin = useRef(0);
  const lastReset = useRef(0);
  const lastEnter = useRef(0);
  const forcedFailure =
    typeof __DEV__ !== "undefined" && __DEV__ && props.forceFailure;
  const { rive, RiveComponent } = useRive({
    src: source,
    artboard: MOTE_MACHINE_RIVE.artboard,
    stateMachines: MOTE_MACHINE_RIVE.stateMachine,
    autoplay: true,
    layout,
    onLoadError: () => setFailed(true),
    onStateChange: (event) =>
      setAnimationState(
        Array.isArray(event.data) ? event.data.join(",") : String(event.data),
      ),
  });
  const viewModel = useViewModel(rive, { name: MOTE_MACHINE_RIVE.viewModel });
  const instance = useViewModelInstance(viewModel, {
    name: MOTE_MACHINE_RIVE.viewModelInstance,
    rive,
  });
  useViewModelInstanceTrigger(
    MOTE_MACHINE_RIVE.properties.requestPlay,
    instance,
    { onTrigger: props.onRequestPlay },
  );

  useEffect(() => {
    if (!rive || !instance || forcedFailure || failed) return;
    const keys = MOTE_MACHINE_RIVE.properties;
    try {
      const numbers = {
        [keys.motes]: props.motes,
        [keys.resultValue]: props.resultValue,
      };
      const booleans = {
        [keys.reduceMotion]: props.reduceMotion,
        [keys.presenting]: props.presenting,
        [keys.busy]: props.busy,
        [keys.canPlay]: props.canPlay,
        [keys.hasError]: props.hasError,
      };
      const strings = {
        [keys.motesLabel]: props.motesLabel,
        [keys.rewardLabel]: props.rewardLabel,
        [keys.actionLabel]: props.actionLabel,
        [keys.statusLabel]: props.statusLabel,
      };
      for (const [name, value] of Object.entries(numbers)) {
        const property = instance.number(name);
        if (!property) throw new Error(`Missing machine property ${name}`);
        property.value = value;
      }
      for (const [name, value] of Object.entries(booleans)) {
        const property = instance.boolean(name);
        if (!property) throw new Error(`Missing machine property ${name}`);
        property.value = value;
      }
      for (const [name, value] of Object.entries(strings)) {
        const property = instance.string(name);
        if (!property) throw new Error(`Missing machine property ${name}`);
        property.value = value;
      }
      const spin = instance.trigger(keys.spin);
      if (!spin || !instance.trigger(keys.requestPlay))
        throw new Error("Missing machine trigger");
      const v4Numbers = [
        [keys.mode, props.mode ?? 0], [keys.stakeMotes, props.stakeMotes ?? 1],
        [keys.outcomeCode, props.outcomeCode ?? 0], [keys.leftStop, props.leftStop ?? 0],
        [keys.centerStop, props.centerStop ?? 0], [keys.rightStop, props.rightStop ?? 0],
        [keys.phase, props.phase ?? 0],
      ] as const;
      const v4Booleans = [
        [keys.newlyUnlocked, props.newlyUnlocked ?? false],
        [keys.replayedReceipt, props.replayedReceipt ?? false],
      ] as const;
      const reset = instance.trigger(keys.reset); const enter = instance.trigger(keys.enter);
      const v4NumberBindings = v4Numbers.map(([name]) => instance.number(name));
      const v4BooleanBindings = v4Booleans.map(([name]) => instance.boolean(name));
      const v4Ready = Boolean(reset && enter && v4NumberBindings.every(Boolean) && v4BooleanBindings.every(Boolean));
      if (v4Ready) {
        v4Numbers.forEach(([, value], index) => { v4NumberBindings[index]!.value = value; });
        v4Booleans.forEach(([, value], index) => { v4BooleanBindings[index]!.value = value; });
        if (props.resetToken && props.resetToken !== lastReset.current) { lastReset.current = props.resetToken; reset!.trigger(); }
        if (props.enterToken && props.enterToken !== lastEnter.current) { lastEnter.current = props.enterToken; enter!.trigger(); }
      }
      if (props.spinToken > 0 && props.spinToken !== lastSpin.current) {
        lastSpin.current = props.spinToken;
        spin.trigger();
      }
      if (!reportedReady.current) {
        reportedReady.current = true;
        props.onRuntimeReady?.(v4Ready ? "mote-animation-v4" : "mote-animation-v3");
      }
    } catch (error) {
      log.warn("[MoteMachineRive] binding failed", error);
      setFailed(true);
    }
  }, [failed, forcedFailure, instance, props, rive]);

  useEffect(() => {
    if (!(failed || forcedFailure) || reportedFailure.current) return;
    reportedFailure.current = true;
    props.onRuntimeError?.();
  }, [failed, forcedFailure, props]);

  if (failed || forcedFailure) return <MoteMachineFallback {...props} />;
  return (
    <RiveComponent
      style={{ width: "100%", height: "100%" }}
      aria-label="Mote Machine reels"
      data-rive-state={animationState}
    />
  );
}
