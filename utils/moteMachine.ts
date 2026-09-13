import { rpcAction, type RpcResult } from "@/utils/rpc";

export type ContraptionId = "auto_tickler";
export type ContraptionDuration = "day" | "week";

export interface ContraptionInventoryItem {
  contraption_id: ContraptionId;
  name: string;
  description: string;
  resource_id: string;
  resource_name: string;
  resource_icon: string;
  resource_balance: number;
  unlocked_at: string;
  active_until: string | null;
}

export interface ContraptionServiceEvent {
  kind: "activated" | "auto_tickles";
  amount: number;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface ContraptionInventoryState {
  items: ContraptionInventoryItem[];
  events: ContraptionServiceEvent[];
}

export interface MoteRewardFamily {
  contraption_id: ContraptionId;
  name: string;
  resource_id: string;
  resource_name: string;
  resource_icon: string;
}

export interface MoteMachineState {
  motes: number;
  reward_family: MoteRewardFamily;
  inventory: ContraptionInventoryItem[];
}

export interface MoteMachineSpin {
  spin_id: string;
  contraption_id: ContraptionId;
  contraption_name: string;
  resource_id: string;
  resource_name: string;
  resource_icon: string;
  resource_amount: 1 | 2 | 3 | 5;
  resource_balance: number;
  /** Legacy Rive reel selector. It is presentation-only, never a Tickle grant. */
  reel_value: 3 | 5 | 10 | 25;
  newly_unlocked: boolean;
  motes_remaining: number;
  replayed: boolean;
}

export interface ContraptionActivation {
  contraption_id: ContraptionId;
  resource_balance: number;
  active_until: string;
  duration: ContraptionDuration;
  cost: number;
}

const SPIN_RESPONSE_TIMEOUT_MS = 8_000;

export function newMoteSpinRequestId(): string {
  return `mote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function fetchMoteMachineState(): Promise<RpcResult<MoteMachineState>> {
  return rpcAction<MoteMachineState>("mote_machine_state");
}

export function fetchContraptionInventory(): Promise<
  RpcResult<ContraptionInventoryState>
> {
  return rpcAction<ContraptionInventoryState>("contraption_inventory");
}

export function activateContraption(
  contraptionId: ContraptionId,
  duration: ContraptionDuration,
): Promise<RpcResult<ContraptionActivation>> {
  return rpcAction<ContraptionActivation>("activate_contraption", {
    p_contraption_id: contraptionId,
    p_duration: duration,
  });
}

export async function spinMoteMachine(
  requestId: string,
): Promise<RpcResult<MoteMachineSpin>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      rpcAction<MoteMachineSpin>("spin_mote_machine", {
        p_request_id: requestId,
      }),
      new Promise<RpcResult<MoteMachineSpin>>((resolve) => {
        timeout = setTimeout(
          () => resolve({ ok: false, reason: "network" }),
          SPIN_RESPONSE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function moteMachineErrorMessage(reason: string): string {
  switch (reason) {
    case "no_motes":
      return "Your Mote pouch is empty.";
    case "network":
      return "The signal failed. Check the last play.";
    case "unauthenticated":
      return "Sign in again before using a Mote.";
    default:
      return "The machine stayed quiet. Your Mote was not spent.";
  }
}

export function contraptionErrorMessage(reason: string): string {
  switch (reason) {
    case "not_enough_resource":
      return "Not enough Clockwork Acorns yet.";
    case "locked":
      return "Find this Contraption in the Mote Machine first.";
    case "network":
      return "The workshop lost its connection. Reopen your shelf to check whether it started.";
    default:
      return "The Contraption could not start. Nothing was spent.";
  }
}
