import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { isMuted, subscribeMuted } from "@/utils/sound";

export type CardSensoryCue = "pickup" | "tear" | "reveal" | "receipt" | "inspect";
export interface CardSensoryOptions {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;
  active: boolean;
}

// Temporary reuse of existing one-shots. These are material/UI sounds, not a
// claim that final paper, card flick, or pig-vocal performances are authored.
const SOURCES: Record<CardSensoryCue, number> = {
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
  const players = useRef(new Map<CardSensoryCue, AudioPlayer>());
  const generation = useRef(0);
  const mounted = useRef(true);
  const foreground = useRef(AppState.currentState === "active");
  const settings = useRef(options);
  useEffect(() => { settings.current = options; }, [options]);

  const stop = useCallback(() => {
    generation.current += 1;
    for (const player of players.current.values()) {
      try { player.pause(); } catch { /* native output may already be gone */ }
    }
  }, []);

  const cue = useCallback((kind: CardSensoryCue) => {
    const current = settings.current;
    if (!current.active || !foreground.current) return;

    if (current.hapticsEnabled) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    }
    if (!current.soundEnabled || isMuted()) return;

    const player = players.current.get(kind);
    if (!player) return;
    const token = ++generation.current;
    try { player.pause(); } catch {}
    void player.seekTo(0).then(() => {
      const latest = settings.current;
      if (
        mounted.current && token === generation.current && foreground.current && latest.active &&
        latest.soundEnabled && !isMuted()
      ) player.play();
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const ownedPlayers = players.current;
    try {
      void setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      }).then(() => {
        if (cancelled) return;
        for (const kind of Object.keys(SOURCES) as CardSensoryCue[]) {
          if (ownedPlayers.has(kind)) continue;
          try {
            const player = createAudioPlayer(SOURCES[kind]);
            player.loop = false;
            player.volume = VOLUME[kind];
            ownedPlayers.set(kind, player);
          } catch { /* the card flow remains usable without native audio */ }
        }
      }).catch(() => undefined);
    } catch { /* expo-audio may be unavailable in tests */ }
    return () => {
      cancelled = true;
      mounted.current = false;
      stop();
      for (const player of ownedPlayers.values()) {
        try { player.remove(); } catch {}
      }
      ownedPlayers.clear();
    };
  }, [stop]);

  useEffect(() => {
    const sync = (next: string) => {
      foreground.current = next === "active";
      if (!foreground.current) stop();
    };
    sync(AppState.currentState);
    const subscription = AppState.addEventListener("change", sync);
    return () => subscription.remove();
  }, [stop]);

  useEffect(() => subscribeMuted(muted => { if (muted) stop(); }), [stop]);
  useEffect(() => {
    if (!options.active || !options.soundEnabled) stop();
  }, [options.active, options.soundEnabled, stop]);
  // No cue loops. This still guarantees a future loop cannot survive the
  // reduced-motion transition if the implementation grows.
  useEffect(() => { if (options.reduceMotion) stop(); }, [options.reduceMotion, stop]);

  return { cue, stop };
}
