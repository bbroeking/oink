import {
  createMoteMachineAcceptanceClient,
  resetMoteMachineAcceptanceSessionsForTests,
} from "@/utils/moteMachineAcceptance";

describe("Mote Machine development acceptance client", () => {
  beforeEach(() => resetMoteMachineAcceptanceSessionsForTests());

  it("reveals only positive resource grants across repeated plays", async () => {
    const client = createMoteMachineAcceptanceClient("sequence", "rewards");
    expect(client).not.toBeNull();
    const rewards: number[] = [];
    for (const requestId of ["one", "two", "three", "four", "five"]) {
      const result = await client!.spin(requestId);
      expect(result.ok).toBe(true);
      if (result.ok) rewards.push(result.resource_amount);
    }
    expect(rewards).toEqual([1, 2, 3, 5, 1]);
    expect(rewards.every((reward) => reward > 0)).toBe(true);
    await expect(client!.fetchState()).resolves.toMatchObject({
      ok: true,
      motes: 3,
      inventory: [{ resource_balance: 12 }],
    });
  });

  it("replays one receipt without a second debit or resource grant", async () => {
    const client = createMoteMachineAcceptanceClient(
      "sequence",
      "idempotency",
    )!;
    const first = await client.spin("durable-request");
    const replay = await client.spin("durable-request");

    expect(first).toMatchObject({
      ok: true,
      resource_amount: 1,
      resource_balance: 1,
      newly_unlocked: true,
      replayed: false,
    });
    expect(replay).toMatchObject({
      ok: true,
      resource_amount: 1,
      resource_balance: 1,
      replayed: true,
    });
    await expect(client.fetchState()).resolves.toMatchObject({
      ok: true,
      motes: 7,
      inventory: [{ resource_balance: 1 }],
    });
  });

  it("models a committed receipt whose first response times out", async () => {
    const client = createMoteMachineAcceptanceClient(
      "timeout-after-commit",
      "timeout",
    )!;
    await expect(client.spin("same-request")).resolves.toEqual({
      ok: false,
      reason: "network",
    });
    await expect(client.spin("same-request")).resolves.toMatchObject({
      ok: true,
      resource_amount: 1,
      resource_balance: 1,
      motes_remaining: 7,
      replayed: true,
    });
  });

  it("provides a zero-Mote state without touching a server", async () => {
    const client = createMoteMachineAcceptanceClient("empty", "empty")!;
    await expect(client.fetchState()).resolves.toMatchObject({
      ok: true,
      motes: 0,
    });
    await expect(client.spin("no-spend")).resolves.toEqual({
      ok: false,
      reason: "no_motes",
    });
  });
  it("carries the same fuel into the inventory and extends service without another Mote debit", async () => {
    const machine = createMoteMachineAcceptanceClient("sequence", "inventory")!;
    await machine.spin("one");
    const shelf = createMoteMachineAcceptanceClient("sequence", "inventory")!;
    await expect(shelf.fetchInventory()).resolves.toMatchObject({ ok: true, items: [{ resource_balance: 1 }] });
    const activation = await shelf.activate("day");
    expect(activation).toMatchObject({ ok: true, cost: 1, resource_balance: 0 });
    await expect(shelf.activate("week")).resolves.toMatchObject({ ok: false, reason: "not_enough_resource" });
    await machine.spin("two");
    const extension = await shelf.activate("day");
    if (activation.ok && extension.ok) {
      expect(Date.parse(extension.active_until) - Date.parse(activation.active_until)).toBe(86_400_000);
    } else throw new Error("Expected both windings to succeed");
    await expect(machine.fetchState()).resolves.toMatchObject({ ok: true, motes: 6, inventory: [{ resource_balance: 1 }] });
  });

});
