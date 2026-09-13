import { getMoteCueSchedule, type MoteCue, type MoteHaptic, type MoteSensoryPresentation } from "./moteMachineTiming";

export const MOTE_SENSORY_STORAGE_KEY = "mote_machine_sensory_v1";
export type MoteSensorySettings = { sound: boolean; haptics: boolean };
export const DEFAULT_MOTE_SENSORY: MoteSensorySettings = { sound: true, haptics: true };
export function parseMoteSensorySettings(raw: string | null): MoteSensorySettings {
  try {
    const value = raw ? JSON.parse(raw) : null;
    return { sound: typeof value?.sound === "boolean" ? value.sound : true,
      haptics: typeof value?.haptics === "boolean" ? value.haptics : true };
  } catch { return { ...DEFAULT_MOTE_SENSORY }; }
}
export type MoteSensoryDriver = {
  preload: () => void; sound: (cue: MoteCue) => void; haptic: (kind: MoteHaptic) => void;
  pause: (cue?: MoteCue) => void; release: () => void; globallyMuted: () => boolean;
};

/** Receipt identity guards sensory effects; it has no wallet or reward authority. */
export function createMoteSensoryController(driver: MoteSensoryDriver) {
  let active = false;
  let disposed = false;
  let settings = { ...DEFAULT_MOTE_SENSORY };
  const delivered = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const safely = (action: () => void) => { try { action(); } catch { /* Sensory failure never blocks a result. */ } };
  const stop = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    safely(() => driver.pause());
  };
  const cue = (sound: MoteCue, haptic?: MoteHaptic) => {
    if (!active || disposed) return;
    if (settings.sound && !driver.globallyMuted()) safely(() => driver.sound(sound));
    if (haptic && settings.haptics) safely(() => driver.haptic(haptic));
  };
  return {
    stop, cue, silenceSound: () => safely(() => driver.pause()),
    setActive(next: boolean) {
      // React development effect replay may release and reactivate this owner.
      if (next) disposed = false;
      active = next;
      if (active) safely(() => driver.preload()); else stop();
    },
    setSettings(next: MoteSensorySettings) {
      settings = { ...next };
      if (!settings.sound) safely(() => driver.pause());
    },
    playPresentation(play: MoteSensoryPresentation) {
      if (!active || disposed || delivered.has(play.receiptId)) return;
      stop();
      delivered.add(play.receiptId);
      for (const event of getMoteCueSchedule(play)) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!active || disposed) return;
          if (event.stopReels) safely(() => driver.pause("reel_loop"));
          if (event.cue) cue(event.cue);
          if (event.haptic && settings.haptics) safely(() => driver.haptic(event.haptic!));
        }, event.at);
        timers.add(timer);
      }
    },
    dispose() { disposed = true; active = false; stop(); safely(() => driver.release()); },
  };
}
