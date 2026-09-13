import { rpcAction, type RpcResult } from "@/utils/rpc";

export type MoteGameMode = "reveal" | "wager";
export type MoteGameOutcome =
  | "legacy_resource"
  | "loss"
  | "returned_stake"
  | "small"
  | "big"
  | "jackpot";
export type MoteStake = 1 | 3 | 5;

export interface MoteWallet { motes: number; revision: number }
export interface MotePaytableRow {
  outcome: MoteGameOutcome;
  weight: number;
  motes_multiplier: number;
  acorns_multiplier: number;
}
export interface MoteInventoryItem {
  contraption_id: string;
  resource_id: string;
  resource_balance: number | null;
}
export interface MoteGameReceipt {
  protocol_version: 2;
  spin_id: string;
  request_id: string;
  mode: MoteGameMode;
  stake_motes: number;
  outcome: MoteGameOutcome;
  motes_returned: number;
  net_motes: number;
  motes_remaining: number;
  wallet_revision: number;
  contraption_id: string | null;
  resource_id: string | null;
  resource_amount: number;
  resource_balance: number | null;
  newly_unlocked: boolean;
  reel_stops: [number, number, number];
  reel_value: number | null;
  paytable_version: string;
  presentation_version: string;
  created_at: string;
}
export interface MoteLegacyReceipt {
  protocol_version: 1;
  spin_id: string; request_id: string; mode: "reveal"; stake_motes: 1;
  outcome: "legacy_resource"; motes_returned: 0; net_motes: -1;
  motes_remaining: number; wallet_revision: number | null;
  contraption_id: string | null; resource_id: string | null;
  resource_amount: number | null; resource_balance: null; newly_unlocked: false;
  reel_stops: [number, number, number] | null; reel_value: number | null;
  reward_tickles: number | null; tickles_balance: number | null;
  paytable_version: null; presentation_version: "mote-animation-v3"; created_at: string;
}
export type AnyMoteReceipt = MoteGameReceipt | MoteLegacyReceipt;
export interface MoteGameState {
  modes: MoteGameMode[];
  allowed_stakes: { reveal: number[]; wager: number[] };
  rules_versions: { reveal: string; wager: string };
  paytables: { reveal: MotePaytableRow[]; wager: MotePaytableRow[] };
  wallet: MoteWallet;
  inventory: MoteInventoryItem[];
  required_presentation_version: string;
  wager_enabled: boolean;
}
export interface MotePlayEnvelope {
  receipt: MoteGameReceipt;
  wallet: MoteWallet;
  replayed: boolean;
}
export interface MoteReceiptLookupEnvelope {
  receipt: AnyMoteReceipt | null;
  wallet: MoteWallet;
}
export interface MoteHistoryEnvelope {
  plays: AnyMoteReceipt[];
  next_cursor: string | null;
  wallet: MoteWallet;
}
export interface MotePlayCommand {
  protocolVersion: 2;
  requestId: string;
  accountId: string;
  mode: MoteGameMode;
  stakeMotes: number;
  expectedRulesVersion: string;
  createdAt: string;
}

const FROZEN_STAKES = { reveal: [1], wager: [1, 3, 5] } as const;
const FROZEN_PAYTABLES: Record<MoteGameMode, readonly MotePaytableRow[]> = {
  reveal: [
    { outcome: "legacy_resource", weight: 5000, motes_multiplier: 0, acorns_multiplier: 1 },
    { outcome: "legacy_resource", weight: 3000, motes_multiplier: 0, acorns_multiplier: 2 },
    { outcome: "legacy_resource", weight: 1500, motes_multiplier: 0, acorns_multiplier: 3 },
    { outcome: "legacy_resource", weight: 500, motes_multiplier: 0, acorns_multiplier: 5 },
  ],
  wager: [
    { outcome: "loss", weight: 5000, motes_multiplier: 0, acorns_multiplier: 0 },
    { outcome: "returned_stake", weight: 2500, motes_multiplier: 1, acorns_multiplier: 0 },
    { outcome: "small", weight: 1800, motes_multiplier: 2, acorns_multiplier: 0 },
    { outcome: "big", weight: 600, motes_multiplier: 3, acorns_multiplier: 1 },
    { outcome: "jackpot", weight: 100, motes_multiplier: 10, acorns_multiplier: 5 },
  ],
};

function sameNumbers(actual: number[], expected: readonly number[]) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function matchesFrozenPaytable(mode: MoteGameMode, rows: MotePaytableRow[]) {
  const key = (row: MotePaytableRow) =>
    `${row.outcome}:${row.weight}:${row.motes_multiplier}:${row.acorns_multiplier}`;
  return rows.length === FROZEN_PAYTABLES[mode].length &&
    rows.map(key).sort().every((value, index) => value === FROZEN_PAYTABLES[mode].map(key).sort()[index]);
}

const RESPONSE_TIMEOUT_MS = 8_000;
async function withTimeout<T>(request: Promise<RpcResult<T>>): Promise<RpcResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<RpcResult<T>>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, reason: "network" }), RESPONSE_TIMEOUT_MS);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function validateMoteGameState(input: unknown): MoteGameState | null {
  if (!input || typeof input !== "object") return null;
  const state = input as Partial<MoteGameState>;
  const stakes = state.allowed_stakes;
  const paytables = state.paytables;
  if (!Array.isArray(state.modes) || !state.modes.every((mode) => mode === "reveal" || mode === "wager") ||
    !stakes || !Array.isArray(stakes.reveal) || !Array.isArray(stakes.wager) ||
    !stakes.reveal.every(Number.isSafeInteger) || !stakes.wager.every(Number.isSafeInteger) ||
    !sameNumbers(stakes.reveal, FROZEN_STAKES.reveal) || !sameNumbers(stakes.wager, FROZEN_STAKES.wager) ||
    !state.rules_versions || state.rules_versions.reveal !== "reveal-v1" || state.rules_versions.wager !== "wager-v1" ||
    !paytables || typeof paytables !== "object" ||
    Object.keys(paytables).length !== 2 || !Object.hasOwn(paytables, "reveal") || !Object.hasOwn(paytables, "wager") ||
    !Array.isArray(paytables.reveal) || !Array.isArray(paytables.wager) ||
    !state.wallet || !Number.isSafeInteger(state.wallet.motes) || !Number.isSafeInteger(state.wallet.revision) ||
    state.wallet.motes < 0 || state.wallet.revision < 0 || !Array.isArray(state.inventory) ||
    state.required_presentation_version !== "mote-animation-v4" || typeof state.wager_enabled !== "boolean") return null;
  for (const mode of ["reveal", "wager"] as const) {
    const rows = paytables[mode];
    if (!rows.length || rows.some((row) =>
      !row || typeof row !== "object" || typeof row.outcome !== "string" ||
      !Number.isSafeInteger(row.weight) || row.weight <= 0 ||
      !Number.isSafeInteger(row.motes_multiplier) || row.motes_multiplier < 0 ||
      !Number.isSafeInteger(row.acorns_multiplier) || row.acorns_multiplier < 0)) return null;
    if (rows.reduce((sum, row) => sum + row.weight, 0) !== 10_000) return null;
    if (!matchesFrozenPaytable(mode, rows)) return null;
  }
  return state as MoteGameState;
}
export async function fetchMoteGameState(): Promise<RpcResult<MoteGameState>> {
  const result = await rpcAction<MoteGameState>("mote_game_state");
  if (!result.ok) return result;
  const valid = validateMoteGameState(result);
  return valid ? { ok: true, ...valid } : { ok: false, reason: "invalid_contract" };
}
export const playMoteGame = (command: MotePlayCommand) =>
  withTimeout(rpcAction<MotePlayEnvelope>("play_mote_game", {
    p_request_id: command.requestId,
    p_mode: command.mode,
    p_stake_motes: command.stakeMotes,
    p_expected_rules_version: command.expectedRulesVersion,
  }));
export const lookupMotePlayReceipt = (requestId: string) =>
  withTimeout(rpcAction<MoteReceiptLookupEnvelope>("mote_play_receipt", { p_request_id: requestId }));
export const fetchMotePlayHistory = (cursor: string | null = null, limit = 20) =>
  rpcAction<MoteHistoryEnvelope>("mote_play_history", { p_cursor: cursor, p_limit: limit });

export function newerWallet(current: MoteWallet | null | undefined, incoming: MoteWallet): MoteWallet {
  return !current || incoming.revision >= current.revision ? incoming : current;
}

export function moteGameErrorMessage(reason: string): string {
  switch (reason) {
    case "no_motes": return "Your Mote pouch does not cover that stake.";
    case "insufficient_motes": return "Your Mote balance changed on another device. The pouch was refreshed and nothing was spent.";
    case "rules_changed": return "The paytable changed. Review it before playing.";
    case "wager_disabled": return "Wager is resting right now. Reveal is still available.";
    case "request_conflict": return "That saved play no longer matches. Contact support with its request ID.";
    case "unauthenticated": return "Sign in again before playing.";
    case "network": case "no_data": case "unknown": return "The signal failed. Check the last play.";
    default: return "The machine stayed quiet. Nothing was spent.";
  }
}
