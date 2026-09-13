import type { AnyMoteReceipt, MoteGameMode, MoteGameOutcome, MoteGameReceipt, MoteLegacyReceipt } from "@/utils/moteGame";

const MOTE_PRESENTATION_V4 = "mote-animation-v4";
export type MotePresentation = {
  mode: 0 | 1; stakeMotes: number; outcomeCode: number;
  leftStop: number; centerStop: number; rightStop: number;
  newlyUnlocked: boolean; replayedReceipt: boolean; resultValue: number;
};
const LOSS_STOPS = ["0,1,2", "1,2,3", "2,3,0", "3,0,1"];
const WIN_STOPS: Partial<Record<MoteGameOutcome, string>> = {
  returned_stake: "0,0,0", small: "1,1,1", big: "2,2,2", jackpot: "3,3,3",
};
function isMoteOutcome(value: unknown): value is MoteGameOutcome {
  return typeof value === "string" && Object.hasOwn(OUTCOME_CODES, value);
}
const OUTCOME_CODES: Record<MoteGameOutcome | "medium", number> = {
  legacy_resource: 0, loss: 1, returned_stake: 2, small: 3, medium: 4, big: 5, jackpot: 6,
};
export function legacyOutcomeForAmount(amount: number): "small" | "medium" | "big" | "jackpot" {
  if (amount === 1) return "small";
  if (amount === 2) return "medium";
  if (amount === 3) return "big";
  return "jackpot";
}
export function validateMoteGameReceipt(input: unknown): MoteGameReceipt | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Partial<MoteGameReceipt>;
  const integers = [r.stake_motes, r.motes_returned, r.net_motes, r.motes_remaining,
    r.wallet_revision, r.resource_amount, ...(Array.isArray(r.reel_stops) ? r.reel_stops : [])];
  if (r.protocol_version !== 2 || typeof r.spin_id !== "string" || typeof r.request_id !== "string" ||
    (r.mode !== "reveal" && r.mode !== "wager") || !isMoteOutcome(r.outcome) ||
    !Array.isArray(r.reel_stops) || r.reel_stops.length !== 3 ||
    integers.some((value) => !Number.isSafeInteger(value)) || (r.stake_motes !== 1 && r.stake_motes !== 3 && r.stake_motes !== 5) ||
    r.net_motes !== r.motes_returned! - r.stake_motes! || r.motes_remaining! < 0 || r.wallet_revision! < 0 ||
    r.resource_amount! < 0 || (r.resource_amount! > 0
      ? !Number.isSafeInteger(r.resource_balance) || r.resource_balance! < r.resource_amount!
      : r.resource_balance !== null && r.resource_balance !== 0) || typeof r.newly_unlocked !== "boolean" ||
    typeof r.paytable_version !== "string" || typeof r.presentation_version !== "string" ||
    typeof r.created_at !== "string" || !Number.isFinite(Date.parse(r.created_at)) ||
    (r.resource_amount! > 0
      ? r.contraption_id !== "auto_tickler" || r.resource_id !== "clockwork_acorn"
      : r.contraption_id !== null || r.resource_id !== null || r.newly_unlocked)) return null;
  if (r.mode === "reveal") {
    const selector = ({ 1: 3, 2: 5, 3: 10, 5: 25 } as Record<number, number>)[r.resource_amount!];
    if (r.outcome !== "legacy_resource" || r.stake_motes !== 1 || r.motes_returned !== 0 || r.net_motes !== -1 ||
      r.paytable_version !== "reveal-v1" || !["mote-animation-v3", MOTE_PRESENTATION_V4].includes(r.presentation_version!) ||
      r.reel_value !== selector || r.reel_stops.some((stop) => stop !== selector)) return null;
  } else {
    if (!isMoteOutcome(r.outcome)) return null;
    if (r.outcome === "legacy_resource" || r.paytable_version !== "wager-v1" || r.presentation_version !== MOTE_PRESENTATION_V4 || r.reel_value !== null) return null;
    const stopKey = r.reel_stops.join(",");
    if (r.outcome === "loss" ? !LOSS_STOPS.includes(stopKey) : WIN_STOPS[r.outcome] !== stopKey) return null;
    const multiplier = ({ loss: [0, 0], returned_stake: [1, 0], small: [2, 0], big: [3, 1], jackpot: [10, 5] } as const)[r.outcome];
    if (r.motes_returned !== multiplier[0] * r.stake_motes! || r.resource_amount !== multiplier[1] * r.stake_motes!) return null;
  }
  return r as MoteGameReceipt;
}
export function validateLegacyMoteReceipt(input: unknown): MoteLegacyReceipt | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Partial<MoteLegacyReceipt>;
  if (r.protocol_version !== 1 || typeof r.spin_id !== "string" || typeof r.request_id !== "string" ||
    r.mode !== "reveal" || r.stake_motes !== 1 || r.outcome !== "legacy_resource" ||
    r.motes_returned !== 0 || r.net_motes !== -1 || !Number.isSafeInteger(r.motes_remaining) || r.motes_remaining! < 0 ||
    (r.wallet_revision !== null && !Number.isSafeInteger(r.wallet_revision)) || r.resource_balance !== null ||
    r.newly_unlocked !== false || r.paytable_version !== null || r.presentation_version !== "mote-animation-v3" ||
    typeof r.created_at !== "string" || !Number.isFinite(Date.parse(r.created_at))) return null;
  const amount = r.resource_amount ?? r.reward_tickles;
  if (amount !== null && amount !== undefined && ![1, 2, 3, 5].includes(amount)) return null;
  if (r.reel_value !== null) {
    const selector = amount == null ? null : ({ 1: 3, 2: 5, 3: 10, 5: 25 } as Record<number, number>)[amount];
    if (r.reel_value !== selector || !Array.isArray(r.reel_stops) || r.reel_stops.length !== 3 ||
      r.reel_stops.some((stop) => stop !== selector)) return null;
  } else if (r.reel_stops !== null) return null;
  return r as MoteLegacyReceipt;
}
export function validateAnyMoteReceipt(input: unknown): AnyMoteReceipt | null {
  return validateMoteGameReceipt(input) ?? validateLegacyMoteReceipt(input);
}
export function receiptToMotePresentation(receipt: MoteGameReceipt, replayed: boolean): MotePresentation {
  if (!validateMoteGameReceipt(receipt)) throw new Error("Invalid Mote receipt presentation contract");
  const semanticOutcome = receipt.outcome === "legacy_resource"
    ? legacyOutcomeForAmount(receipt.resource_amount) : receipt.outcome;
  const [leftStop, centerStop, rightStop] = receipt.reel_stops;
  return {
    mode: receipt.mode === "wager" ? 1 : 0,
    stakeMotes: receipt.stake_motes,
    outcomeCode: receipt.outcome === "legacy_resource" ? 0 : OUTCOME_CODES[semanticOutcome],
    leftStop, centerStop, rightStop,
    newlyUnlocked: receipt.newly_unlocked,
    replayedReceipt: replayed,
    resultValue: receipt.reel_value ?? 0,
  };
}
export function canPresentMode(mode: MoteGameMode, required: string, loaded: string | null, bindingsReady: boolean) {
  if (mode === "reveal")
    return loaded === "mote-animation-v3" || loaded === MOTE_PRESENTATION_V4;
  return required === MOTE_PRESENTATION_V4 && loaded === required && bindingsReady;
}
