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

export interface ContraptionActivation {
  contraption_id: ContraptionId;
  resource_balance: number;
  active_until: string;
  duration: ContraptionDuration;
  cost: number;
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
