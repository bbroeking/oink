import { rpcAction } from "@/utils/rpc";
import {
  activateContraption,
  fetchContraptionInventory,
  fetchMoteMachineState,
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


});
