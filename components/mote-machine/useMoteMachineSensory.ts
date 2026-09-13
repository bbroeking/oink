import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import type { AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { isMuted, subscribeMuted } from "@/utils/sound";
import { createMoteSensoryController, DEFAULT_MOTE_SENSORY, MOTE_SENSORY_STORAGE_KEY, parseMoteSensorySettings, type MoteSensorySettings } from "./moteMachineSensory";
import type { MoteCue } from "./moteMachineTiming";

const SOURCES: Record<MoteCue, number> = {
  room_tone: require("../../assets/sounds/mote-machine/room_tone.wav"),
  mote_ready: require("../../assets/sounds/mote-machine/mote_ready.wav"),
  deposit_1: require("../../assets/sounds/mote-machine/deposit_1.wav"),
  deposit_bundle: require("../../assets/sounds/mote-machine/deposit_bundle.wav"),
  lever_down: require("../../assets/sounds/mote-machine/lever_down.wav"),
  lever_return: require("../../assets/sounds/mote-machine/lever_return.wav"),
  reel_start: require("../../assets/sounds/mote-machine/reel_start.wav"),
  reel_loop: require("../../assets/sounds/mote-machine/reel_loop.wav"),
  reel_stop_1: require("../../assets/sounds/mote-machine/reel_stop_1.wav"),
  reel_stop_2: require("../../assets/sounds/mote-machine/reel_stop_2.wav"),
  reel_stop_3: require("../../assets/sounds/mote-machine/reel_stop_3.wav"),
  loss: require("../../assets/sounds/mote-machine/loss.wav"),
  returned_stake: require("../../assets/sounds/mote-machine/stake_returned.wav"),
  small: require("../../assets/sounds/mote-machine/small.wav"),
  medium: require("../../assets/sounds/mote-machine/medium.wav"),
  big: require("../../assets/sounds/mote-machine/big.wav"),
  jackpot: require("../../assets/sounds/mote-machine/jackpot.wav"),
  acorn_award: require("../../assets/sounds/mote-machine/acorn_award.wav"),
  first_unlock: require("../../assets/sounds/mote-machine/first_unlock.wav"),
  receipt_replay: require("../../assets/sounds/mote-machine/receipt_replay.wav"),
  recovery_ok: require("../../assets/sounds/mote-machine/recovery_ok.wav"),
  recovery_error: require("../../assets/sounds/mote-machine/recovery_error.wav"),
};

function createNativeDriver() {
  const players = new Map<MoteCue, AudioPlayer>();
  let generation = 0;
  let modeReady = false;
  const pause = (cue?: MoteCue) => {
    generation += 1;
    for (const [key, player] of players) if (!cue || key === cue) {
      try { player.pause(); } catch { /* unavailable native output */ }
    }
  };
  return {
    globallyMuted: isMuted,
    preload() {
      // Load on route activation; imports of recovery utilities need no audio module.
      const { createAudioPlayer, setAudioModeAsync } = require("expo-audio") as typeof import("expo-audio");
      // Reassert on focus: other app audio may have changed the shared mode.
      modeReady = false;
      void setAudioModeAsync({ playsInSilentMode: false, shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers" }).then(() => { modeReady = true; }).catch(() => {});
      for (const key of Object.keys(SOURCES) as MoteCue[]) if (!players.has(key)) {
        try {
          const player = createAudioPlayer(SOURCES[key]);
          player.loop = key === "reel_loop" || key === "room_tone";
          player.volume = key === "room_tone" ? .16 : .55;
          players.set(key, player);
        } catch { /* keep exact result usable when audio is unavailable */ }
      }
    },
    sound(cue: MoteCue) {
      const player = players.get(cue);
      if (!player || !modeReady || isMuted()) return;
      const token = generation;
      // seekTo is asynchronous. A blur/mute during seeking cannot restart audio.
      void player.seekTo(0).then(() => {
        if (token === generation && !isMuted()) player.play();
      }).catch(() => {});
    },
    haptic(kind: "light" | "medium" | "success") {
      const promise = kind === "success"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.impactAsync(kind === "medium" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
      void promise.catch(() => {});
    },
    pause,
    release() {
      pause();
      for (const player of players.values()) { try { player.remove(); } catch {} }
      players.clear();
    },
  };
}

export function useMoteMachineSensory(active: boolean) {
  const [controller] = useState(() => createMoteSensoryController(createNativeDriver()));
  const [settings, setSettings] = useState({ ...DEFAULT_MOTE_SENSORY });
  const [hydrated, setHydrated] = useState(false);
  const changed = useRef(false);
  const settingsRef = useRef(settings);
  const writeChain = useRef(Promise.resolve());
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(MOTE_SENSORY_STORAGE_KEY).then(raw => {
      if (!live || changed.current) return;
      const saved = parseMoteSensorySettings(raw);
      settingsRef.current = saved;
      controller.setSettings(saved);
      setSettings(saved);
    }).catch(() => {}).finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, [controller]);
  useEffect(() => {
    const sync = (state: string) => controller.setActive(active && hydrated && state === "active");
    sync(AppState.currentState);
    const subscription = AppState.addEventListener("change", sync);
    return () => { subscription.remove(); controller.setActive(false); };
  }, [active, hydrated, controller]);
  useEffect(() => subscribeMuted(muted => { if (muted) controller.silenceSound(); }), [controller]);
  useEffect(() => () => controller.dispose(), [controller]);
  const change = useCallback((key: keyof MoteSensorySettings, value: boolean) => {
    changed.current = true;
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    controller.setSettings(next);
    setSettings(next);
    writeChain.current = writeChain.current.catch(() => {}).then(() => AsyncStorage.setItem(MOTE_SENSORY_STORAGE_KEY, JSON.stringify(next)));
    void writeChain.current.catch(() => {});
  }, [controller]);
  return useMemo(() => ({ settings, hydrated, setSound: (value: boolean) => change("sound", value),
    setHaptics: (value: boolean) => change("haptics", value),
    playPresentation: controller.playPresentation, stop: controller.stop, cue: controller.cue }), [settings, hydrated, change, controller]);
}
