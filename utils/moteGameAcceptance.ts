import type { RpcResult } from "@/utils/rpc";
import type {
  MoteGameReceipt, MoteGameState, MoteHistoryEnvelope, MotePlayCommand,
  MotePlayEnvelope, MoteReceiptLookupEnvelope, MoteWallet,
} from "@/utils/moteGame";
import type { ContraptionActivation, ContraptionDuration, ContraptionInventoryItem, ContraptionInventoryState } from "@/utils/moteMachine";

type Outcome = MoteGameReceipt["outcome"];
const OUTCOMES: Outcome[] = ["loss", "returned_stake", "small", "big", "jackpot"];
export const MOTE_WAGER_ACCEPTANCE_MATRIX = ([1, 3, 5] as const).flatMap((stake) =>
  OUTCOMES.map((outcome) => ({ stake, outcome })),
);
const STOPS: Record<Outcome, [number, number, number]> = {
  legacy_resource: [3, 3, 3], loss: [0, 1, 2], returned_stake: [0, 0, 0],
  small: [1, 1, 1], big: [2, 2, 2], jackpot: [3, 3, 3],
};
type Session = { wallet: MoteWallet; receipts: Map<string, MoteGameReceipt>; order: string[]; next: number; resourceBalance: number; unlocked: boolean; activeUntil: string | null };
const sessions = new Map<string, Session>();
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
export type MoteGameAcceptanceClient = {
  accountId: string;
  fetchState(): Promise<RpcResult<MoteGameState>>;
  play(command: MotePlayCommand): Promise<RpcResult<MotePlayEnvelope>>;
  lookup(requestId: string): Promise<RpcResult<MoteReceiptLookupEnvelope>>;
  history(cursor?: string | null): Promise<RpcResult<MoteHistoryEnvelope>>;
  fetchInventory(): Promise<RpcResult<ContraptionInventoryState>>;
  activate(duration: ContraptionDuration): Promise<RpcResult<ContraptionActivation>>;
};

function inventoryItem(session: Session): ContraptionInventoryItem {
  return { contraption_id: "auto_tickler", name: "Auto-Tickler",
    description: "Keeps regenerated Tickles moving while preserving the final five for you.",
    resource_id: "clockwork_acorn", resource_name: "Clockwork Acorn", resource_icon: "acorn",
    resource_balance: session.resourceBalance, unlocked_at: "2026-09-06T12:00:00.000Z",
    active_until: session.activeUntil };
}

export function createMoteGameAcceptanceClient(scenario: string | string[] | undefined, name: string | string[] | undefined): MoteGameAcceptanceClient | null {
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;
  const value = Array.isArray(scenario) ? scenario[0] : scenario;
  if (!value?.startsWith("wager")) return null;
  const key = `${value}:${Array.isArray(name) ? name[0] : name || "default"}`;
  const accountId = `acceptance-${key}`;
  let session = sessions.get(key);
  if (!session) { session = { wallet: { motes: 40, revision: 1 }, receipts: new Map(), order: [], next: 0, resourceBalance: 0, unlocked: false, activeUntil: null }; sessions.set(key, session); }
  const state = (): MoteGameState => ({
    modes: ["reveal", "wager"], allowed_stakes: { reveal: [1], wager: [1, 3, 5] },
    rules_versions: { reveal: "reveal-v1", wager: "wager-v1" },
    paytables: {
      reveal: [
        ["legacy_resource", 5000, 0, 1], ["legacy_resource", 3000, 0, 2],
        ["legacy_resource", 1500, 0, 3], ["legacy_resource", 500, 0, 5],
      ].map(([outcome, weight, motes_multiplier, acorns_multiplier]) => ({ outcome: outcome as Outcome, weight: weight as number, motes_multiplier: motes_multiplier as number, acorns_multiplier: acorns_multiplier as number })),
      wager: [
        ["loss", 5000, 0, 0], ["returned_stake", 2500, 1, 0], ["small", 1800, 2, 0],
        ["big", 600, 3, 1], ["jackpot", 100, 10, 5],
      ].map(([outcome, weight, motes_multiplier, acorns_multiplier]) => ({ outcome: outcome as Outcome, weight: weight as number, motes_multiplier: motes_multiplier as number, acorns_multiplier: acorns_multiplier as number })),
    }, wallet: session!.wallet, inventory: session!.unlocked ? [inventoryItem(session!)] : [], required_presentation_version: "mote-animation-v4", wager_enabled: true,
  });
  return {
    accountId,
    async fetchState() { await wait(); return { ok: true, ...state() }; },
    async lookup(requestId) { await wait(); return { ok: true, receipt: session!.receipts.get(requestId) ?? null, wallet: session!.wallet }; },
    async play(command) {
      await wait();
      const existing = session!.receipts.get(command.requestId);
      if (existing) return { ok: true, receipt: existing, wallet: session!.wallet, replayed: true };
      if (session!.wallet.motes < command.stakeMotes) return { ok: false, reason: "no_motes" };
      const outcome = command.mode === "reveal" ? "legacy_resource" : OUTCOMES[session!.next % OUTCOMES.length];
      const multipliers = outcome === "legacy_resource" ? [0, [1, 2, 3, 5][session!.next % 4]] :
        ({ loss: [0, 0], returned_stake: [1, 0], small: [2, 0], big: [3, 1], jackpot: [10, 5] } as const)[outcome];
      const stake = command.stakeMotes; const returned = multipliers[0] * stake; const acorns = multipliers[1] * stake;
      session!.wallet = { motes: session!.wallet.motes - stake + returned, revision: session!.wallet.revision + 1 };
      const newlyUnlocked = acorns > 0 && !session!.unlocked;
      if (acorns > 0) { session!.resourceBalance += acorns; session!.unlocked = true; }
      const selector = outcome === "legacy_resource" ? [3, 5, 10, 25][session!.next % 4] : null;
      const receipt: MoteGameReceipt = {
        protocol_version: 2, spin_id: `spin-${key}-${session!.next}`, request_id: command.requestId,
        mode: command.mode, stake_motes: stake, outcome, motes_returned: returned, net_motes: returned - stake,
        motes_remaining: session!.wallet.motes, wallet_revision: session!.wallet.revision,
        contraption_id: acorns ? "auto_tickler" : null, resource_id: acorns ? "clockwork_acorn" : null,
        resource_amount: acorns, resource_balance: acorns ? session!.resourceBalance : null, newly_unlocked: newlyUnlocked,
        reel_stops: selector == null ? STOPS[outcome] : [selector, selector, selector], reel_value: selector,
        paytable_version: command.expectedRulesVersion, presentation_version: "mote-animation-v4", created_at: new Date().toISOString(),
      };
      session!.next++; session!.receipts.set(command.requestId, receipt); session!.order.unshift(command.requestId);
      if (value === "wager-timeout" && session!.next === 1) return { ok: false, reason: "network" };
      return { ok: true, receipt, wallet: session!.wallet, replayed: false };
    },
    async history(cursor = null) {
      await wait(); const start = cursor ? Number(cursor) : 0;
      const ids = session!.order.slice(start, start + 20);
      return { ok: true, plays: ids.map((id) => session!.receipts.get(id)!), next_cursor: start + 20 < session!.order.length ? String(start + 20) : null, wallet: session!.wallet };
    },
    async fetchInventory() {
      await wait(); return { ok: true, items: session!.unlocked ? [inventoryItem(session!)] : [], events: [] };
    },
    async activate(duration) {
      await wait();
      if (!session!.unlocked) return { ok: false, reason: "locked" };
      const cost = duration === "day" ? 1 : 5;
      if (session!.resourceBalance < cost) return { ok: false, reason: "not_enough_resource" };
      session!.resourceBalance -= cost;
      const startsAt = Math.max(Date.now(), session!.activeUntil ? Date.parse(session!.activeUntil) : 0);
      session!.activeUntil = new Date(startsAt + (duration === "day" ? 1 : 7) * 86_400_000).toISOString();
      return { ok: true, contraption_id: "auto_tickler", resource_balance: session!.resourceBalance,
        active_until: session!.activeUntil, duration, cost };
    },
  };
}

export function resetMoteGameAcceptanceSessionsForTests() { sessions.clear(); }
