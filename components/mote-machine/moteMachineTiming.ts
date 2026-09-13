/** Frozen alongside the authored V4 manifest. Times are milliseconds after spin. */
export const MOTE_TIMING_VERSION = "mote-animation-v4" as const;
export type MotePresentationOutcome = "loss" | "returned_stake" | "small" | "medium" | "big" | "jackpot";
export const MOTE_TIMING = {
  deposit: 0, leverDown: 120, leverReturn: 560, reelStart: 520, reelCruise: 920,
  stopLeft: 3000, stopCenter: 3240, stopRight: 3600, outcome: 3700,
  readable: { loss: 4300, returned_stake: 4350, small: 4500, medium: 4600, big: 4900, jackpot: 5700 },
  legacyReadable: { small: 4400, medium: 4500, big: 4700, jackpot: 5100 },
  replay: 650, reducedOutcome: 140, reducedReadable: 490, unlockDelay: 120, unlockDuration: 850,
} as const;
export type MoteCue = "room_tone" | "mote_ready" | "deposit_1" | "deposit_bundle"
  | "lever_down" | "lever_return" | "reel_start" | "reel_loop"
  | "reel_stop_1" | "reel_stop_2" | "reel_stop_3" | MotePresentationOutcome
  | "acorn_award" | "first_unlock" | "receipt_replay" | "recovery_ok" | "recovery_error";
export type MoteHaptic = "light" | "medium" | "success";
export type MoteCueEvent = { at: number; cue?: MoteCue; haptic?: MoteHaptic; stopReels?: boolean };
export type MoteSensoryPresentation = {
  receiptId: string; stake: number; outcome: MotePresentationOutcome; acorns: number;
  newlyUnlocked: boolean; recovered: boolean; reduceMotion: boolean;
  presentationVersion: "mote-animation-v3" | "mote-animation-v4";
  legacy?: boolean;
};

export function moteReadableAt(play: MoteSensoryPresentation): number {
  if (play.recovered) return MOTE_TIMING.replay;
  if (play.reduceMotion) return MOTE_TIMING.reducedReadable;
  if (play.presentationVersion === "mote-animation-v3") return 4300;
  if (play.legacy && play.outcome !== "loss" && play.outcome !== "returned_stake") return MOTE_TIMING.legacyReadable[play.outcome];
  return MOTE_TIMING.readable[play.outcome];
}

export function getMoteCueSchedule(play: MoteSensoryPresentation): MoteCueEvent[] {
  // Recovery never replays a deposit, an award, or celebration haptics.
  if (play.recovered) return [{ at: 0, cue: "receipt_replay" }];
  const readable = moteReadableAt(play);
  const outcomeHaptic = play.outcome === "loss" ? undefined : play.outcome === "returned_stake" ? "light" : "success";
  if (play.reduceMotion) return [
    { at: 0, cue: play.stake === 1 ? "deposit_1" : "deposit_bundle", haptic: "medium" },
    { at: readable, cue: play.outcome, haptic: outcomeHaptic },
  ];
  const v3 = play.presentationVersion === "mote-animation-v3";
  const outcomeAt = v3 ? 3720 : MOTE_TIMING.outcome;
  const events: MoteCueEvent[] = [
    { at: 0, cue: play.stake === 1 ? "deposit_1" : "deposit_bundle", haptic: "medium" },
    { at: 120, cue: "lever_down" },
    { at: 560, cue: "lever_return", haptic: "light" },
    { at: 520, cue: "reel_start" }, { at: 920, cue: "reel_loop" },
    { at: 3000, cue: "reel_stop_1", haptic: "light" },
    { at: v3 ? 3400 : 3240, cue: "reel_stop_2", haptic: "light" },
    { at: v3 ? 3717 : 3600, cue: "reel_stop_3", haptic: "light", stopReels: true },
    { at: outcomeAt, cue: play.outcome },
    { at: readable, haptic: outcomeHaptic },
  ];
  if (play.acorns > 0) events.push({ at: outcomeAt + (play.outcome === "jackpot" ? 900 : 400), cue: "acorn_award", haptic: play.outcome === "big" ? "medium" : undefined });
  if (play.outcome === "jackpot") events.push({ at: outcomeAt + 500, haptic: "medium" });
  if (play.newlyUnlocked && play.acorns > 0) events.push({ at: readable + MOTE_TIMING.unlockDelay, cue: "first_unlock", haptic: "light" });
  return events.sort((a,b) => a.at-b.at);
}
