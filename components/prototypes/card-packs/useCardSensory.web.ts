import { useCallback, useEffect, useRef } from "react";
import { Asset } from "expo-asset";
import { isMuted, subscribeMuted } from "@/utils/sound";

export type CardSensoryCue = "pickup" | "tear" | "reveal" | "receipt" | "inspect";
export interface CardSensoryOptions {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;
  active: boolean;
}

// Same temporary material/UI mapping as native. No synthesized pig voice.
const SOURCES: Record<CardSensoryCue, number | string> = {
  pickup: require("../../../assets/sounds/deeproot/creak.mp3"),
  tear: require("../../../assets/sounds/deeproot/scrape.mp3"),
  reveal: require("../../../assets/sounds/equip.mp3"),
  receipt: require("../../../assets/sounds/deeproot/pouch_clink.mp3"),
  inspect: require("../../../assets/sounds/deeproot/shimmer.mp3"),
};

const VOLUME: Record<CardSensoryCue, number> = {
  pickup: 0.24,
  tear: 0.3,
  reveal: 0.36,
  receipt: 0.3,
  inspect: 0.24,
};

export function useCardSensory(options: CardSensoryOptions) {
  const audio = useRef(new Map<CardSensoryCue, HTMLAudioElement>());
  const generation = useRef(0);
  const visible = useRef(typeof document !== "undefined" && document.visibilityState === "visible");
  const settings = useRef(options);
  useEffect(() => { settings.current = options; }, [options]);

  const stop = useCallback(() => {
    generation.current += 1;
    for (const element of audio.current.values()) {
      element.pause();
      try { element.currentTime = 0; } catch {}
    }
  }, []);

  const cue = useCallback((kind: CardSensoryCue) => {
    const current = settings.current;
    if (!current.active || !visible.current || !current.soundEnabled || isMuted()) return;
    const element = audio.current.get(kind);
    if (!element) return;
    const token = ++generation.current;
    element.pause();
    try { element.currentTime = 0; } catch {}
    const play = element.play();
    void play.then(() => {
      const latest = settings.current;
      if (token !== generation.current || !visible.current || !latest.active || !latest.soundEnabled || isMuted()) {
        element.pause();
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    const ownedAudio = audio.current;
    for (const kind of Object.keys(SOURCES) as CardSensoryCue[]) {
      const source = SOURCES[kind];
      const element = new Audio(typeof source === "string" ? source : Asset.fromModule(source).uri);
      element.preload = "auto";
      element.loop = false;
      element.volume = VOLUME[kind];
      ownedAudio.set(kind, element);
    }
    return () => { stop(); ownedAudio.clear(); };
  }, [stop]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => {
      visible.current = document.visibilityState === "visible";
      if (!visible.current) stop();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [stop]);

  useEffect(() => subscribeMuted(muted => { if (muted) stop(); }), [stop]);
  useEffect(() => {
    if (!options.active || !options.soundEnabled) stop();
  }, [options.active, options.soundEnabled, stop]);
  useEffect(() => { if (options.reduceMotion) stop(); }, [options.reduceMotion, stop]);

  return { cue, stop };
}
