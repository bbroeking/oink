import type { RpcResult } from "@/utils/rpc";
import type {
  ContraptionInventoryItem,
  ContraptionInventoryState,
  ContraptionActivation,
  ContraptionDuration,
  MoteMachineSpin,
  MoteMachineState,
} from "@/utils/moteMachine";

const REWARDS = [
  { amount: 1, reel: 3 },
  { amount: 2, reel: 5 },
  { amount: 3, reel: 10 },
  { amount: 5, reel: 25 },
] as const;

const REWARD_FAMILY = {
  contraption_id: "auto_tickler",
  name: "Auto-Tickler",
  resource_id: "clockwork_acorn",
  resource_name: "Clockwork Acorn",
  resource_icon: "acorn",
} as const;

export type MoteMachineAcceptanceScenario =
  | "sequence"
  | "empty"
  | "timeout-after-commit";

export type MoteMachineClient = {
  fetchState: () => Promise<RpcResult<MoteMachineState>>;
  fetchInventory: () => Promise<RpcResult<ContraptionInventoryState>>;
  activate: (
    duration: ContraptionDuration,
  ) => Promise<RpcResult<ContraptionActivation>>;
  spin: (requestId: string) => Promise<RpcResult<MoteMachineSpin>>;
};

type AcceptanceSession = {
  motes: number;
  resourceBalance: number;
  unlocked: boolean;
  activeUntil: string | null;
  nextReward: number;
  receipts: Map<string, MoteMachineSpin>;
  timedOutRequestIds: Set<string>;
};

const sessions = new Map<string, AcceptanceSession>();

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function isDevelopmentBuild(): boolean {
  return typeof __DEV__ !== "undefined" && __DEV__;
}

function parseScenario(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (
    candidate === "sequence" ||
    candidate === "empty" ||
    candidate === "timeout-after-commit"
  ) {
    return candidate;
  }
  return null;
}

function inventoryItem(session: AcceptanceSession): ContraptionInventoryItem {
  return {
    ...REWARD_FAMILY,
    description:
      "Keeps regenerated Tickles moving while preserving the final five for you.",
    resource_balance: session.resourceBalance,
    unlocked_at: "2026-08-29T12:00:00.000Z",
    active_until: session.activeUntil,
  };
}

/**
 * Local-only acceptance client. It never calls Supabase and is unreachable in
 * production builds. A stable session key lets a timeout be replayed after a
 * route remount with the same durable request id.
 */
export function createMoteMachineAcceptanceClient(
  scenarioParam: string | string[] | undefined,
  sessionParam: string | string[] | undefined,
): MoteMachineClient | null {
  if (!isDevelopmentBuild()) return null;
  const scenario = parseScenario(scenarioParam);
  if (!scenario) return null;
  const sessionName = Array.isArray(sessionParam)
    ? sessionParam[0]
    : sessionParam;
  const sessionKey = `${scenario}:${sessionName || "default"}`;
  let session = sessions.get(sessionKey);
  if (!session) {
    session = {
      motes: scenario === "empty" ? 0 : 8,
      resourceBalance: 0,
      unlocked: false,
      activeUntil: null,
      nextReward: 0,
      receipts: new Map(),
      timedOutRequestIds: new Set(),
    };
    sessions.set(sessionKey, session);
  }

  return {
    async fetchState() {
      await wait(120);
      return {
        ok: true,
        motes: session.motes,
        reward_family: REWARD_FAMILY,
        inventory: session.unlocked ? [inventoryItem(session)] : [],
      };
    },
    async fetchInventory() {
      await wait(120);
      return {
        ok: true,
        items: session.unlocked ? [inventoryItem(session)] : [],
        events: [],
      };
    },
    async activate(duration) {
      await wait(350);
      if (!session.unlocked) return { ok: false, reason: "locked" };
      const cost = duration === "day" ? 1 : 5;
      if (session.resourceBalance < cost)
        return { ok: false, reason: "not_enough_resource" };
      session.resourceBalance -= cost;
      const startsAt = Math.max(
        Date.now(),
        session.activeUntil ? Date.parse(session.activeUntil) : 0,
      );
      session.activeUntil = new Date(
        startsAt + (duration === "day" ? 1 : 7) * 86_400_000,
      ).toISOString();
      return {
        ok: true,
        contraption_id: "auto_tickler",
        resource_balance: session.resourceBalance,
        active_until: session.activeUntil,
        duration,
        cost,
      };
    },
    async spin(requestId) {
      await wait(350);
      const existing = session.receipts.get(requestId);
      if (existing) return { ok: true, ...existing, replayed: true };
      if (session.motes < 1) return { ok: false, reason: "no_motes" };

      const reward = REWARDS[session.nextReward % REWARDS.length];
      const newlyUnlocked = !session.unlocked;
      session.nextReward += 1;
      session.motes -= 1;
      session.resourceBalance += reward.amount;
      session.unlocked = true;
      const receipt: MoteMachineSpin = {
        spin_id: `acceptance-${sessionKey}-${requestId}`,
        ...REWARD_FAMILY,
        contraption_name: REWARD_FAMILY.name,
        resource_amount: reward.amount,
        resource_balance: session.resourceBalance,
        reel_value: reward.reel,
        newly_unlocked: newlyUnlocked,
        motes_remaining: session.motes,
        replayed: false,
      };
      session.receipts.set(requestId, receipt);

      if (
        scenario === "timeout-after-commit" &&
        !session.timedOutRequestIds.has(requestId)
      ) {
        session.timedOutRequestIds.add(requestId);
        return { ok: false, reason: "network" };
      }
      return { ok: true, ...receipt };
    },
  };
}

export function resetMoteMachineAcceptanceSessionsForTests() {
  sessions.clear();
}
