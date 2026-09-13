import { rpcAction } from "@/utils/rpc";
import {
  activateContraption,
  fetchContraptionInventory,
  fetchMoteMachineState,
  moteMachineErrorMessage,
  spinMoteMachine,
} from "@/utils/moteMachine";

jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));

const mockedRpcAction = rpcAction as jest.MockedFunction<typeof rpcAction>;

describe("Mote Machine and Contraption client contracts", () => {
  beforeEach(() => mockedRpcAction.mockReset());

  it("reads the Mote balance, guaranteed reward family, and inventory", async () => {
    mockedRpcAction.mockResolvedValue({
      ok: true,
      motes: 4,
      reward_family: {
        contraption_id: "auto_tickler",
        name: "Auto-Tickler",
        resource_id: "clockwork_acorn",
        resource_name: "Clockwork Acorn",
        resource_icon: "acorn",
      },
      inventory: [],
    } as never);

    await expect(fetchMoteMachineState()).resolves.toMatchObject({
      ok: true,
      motes: 4,
      reward_family: { resource_name: "Clockwork Acorn" },
    });
    expect(mockedRpcAction).toHaveBeenCalledWith("mote_machine_state");
  });

  it("sends only the idempotency key and returns positive Contraption fuel", async () => {
    mockedRpcAction.mockResolvedValue({
      ok: true,
      spin_id: "spin-1",
      contraption_id: "auto_tickler",
      resource_amount: 3,
      resource_balance: 8,
      reel_value: 10,
      motes_remaining: 2,
      replayed: false,
    } as never);

    await expect(spinMoteMachine("mote-request-1")).resolves.toMatchObject({
      ok: true,
      resource_amount: 3,
      resource_balance: 8,
      motes_remaining: 2,
    });
    expect(mockedRpcAction).toHaveBeenCalledWith("spin_mote_machine", {
      p_request_id: "mote-request-1",
    });
  });

  it("reads inventory and activates the exact requested service duration", async () => {
    mockedRpcAction.mockResolvedValue({ ok: true, items: [], events: [] } as never);
    await fetchContraptionInventory();
    expect(mockedRpcAction).toHaveBeenLastCalledWith("contraption_inventory");

    mockedRpcAction.mockResolvedValue({
      ok: true,
      contraption_id: "auto_tickler",
      resource_balance: 2,
      active_until: "2026-08-30T12:00:00Z",
      duration: "day",
      cost: 1,
    } as never);
    await activateContraption("auto_tickler", "day");
    expect(mockedRpcAction).toHaveBeenLastCalledWith("activate_contraption", {
      p_contraption_id: "auto_tickler",
      p_duration: "day",
    });
  });

  it("turns a lost response into a replay-safe check instead of hanging", async () => {
    jest.useFakeTimers();
    mockedRpcAction.mockReturnValue(new Promise(() => {}) as never);
    const result = spinMoteMachine("mote-request-timeout");

    jest.advanceTimersByTime(8_000);
    await expect(result).resolves.toEqual({ ok: false, reason: "network" });
    jest.useRealTimers();
  });

  it("explains an uncertain network result without claiming a refund", () => {
    expect(moteMachineErrorMessage("network")).toBe(
      "The signal failed. Check the last play.",
    );
    expect(moteMachineErrorMessage("no_motes")).toContain("empty");
  });
});
