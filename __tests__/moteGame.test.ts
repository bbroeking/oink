import {
  canPresentMode,
  receiptToMotePresentation,
  validateMoteGameReceipt,
  validateLegacyMoteReceipt,
} from "@/utils/moteGamePresentation";
import { newerWallet, validateMoteGameState, type MoteGameReceipt, type MoteGameState } from "@/utils/moteGame";
import {
  clearMoteCommand,
  loadMoteCommand,
  pendingMoteCommandKey,
  persistMoteCommand,
} from "@/utils/moteGameSession";
import { createMoteGameAcceptanceClient, MOTE_WAGER_ACCEPTANCE_MATRIX, resetMoteGameAcceptanceSessionsForTests } from "@/utils/moteGameAcceptance";
import databaseVectors from "@/__tests__/fixtures/mote-game-db-receipts.json";
jest.mock("@/utils/log", () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const receipt: MoteGameReceipt = {
  protocol_version: 2, spin_id: "s1", request_id: "request-123", mode: "wager",
  stake_motes: 3, outcome: "big", motes_returned: 9, net_motes: 6,
  motes_remaining: 16, wallet_revision: 7, contraption_id: "auto_tickler",
  resource_id: "clockwork_acorn", resource_amount: 3, resource_balance: 8,
  newly_unlocked: true, reel_stops: [2, 2, 2], reel_value: null,
  paytable_version: "wager-v1", presentation_version: "mote-animation-v4",
  created_at: "2026-09-06T12:00:00.000Z",
};

describe("mote game frozen client contract", () => {
  beforeEach(() => resetMoteGameAcceptanceSessionsForTests());
  it("parses every actual database receipt vector through the canonical boundary", () => {
    for (const envelope of databaseVectors.receipts)
      expect(validateMoteGameReceipt(envelope.receipt)?.request_id).toBe(envelope.receipt.request_id);
    for (const legacy of databaseVectors.legacy_receipts)
      expect(validateLegacyMoteReceipt(legacy)?.request_id).toBe(legacy.request_id);
  });
  it("maps the exact receipt once at the presentation boundary", () => {
    expect(receiptToMotePresentation(receipt, true)).toEqual({
      mode: 1, stakeMotes: 3, outcomeCode: 5, leftStop: 2, centerStop: 2,
      rightStop: 2, newlyUnlocked: true, replayedReceipt: true, resultValue: 0,
    });
  });

  it("fails closed on impossible outcome stops, arithmetic, or presentation versions", () => {
    expect(validateMoteGameReceipt({ ...receipt, reel_stops: [0, 1, 2] })).toBeNull();
    expect(validateMoteGameReceipt({ ...receipt, net_motes: 7 })).toBeNull();
    expect(validateMoteGameReceipt({ ...receipt, presentation_version: "mote-animation-v3" })).toBeNull();
    expect(validateMoteGameReceipt({ ...receipt, resource_id: null })).toBeNull();
    expect(validateMoteGameReceipt({ ...receipt, created_at: "not-a-timestamp" })).toBeNull();
  });

  it("rejects altered stakes or payouts published under the frozen rules version", () => {
    const client = createMoteGameAcceptanceClient("wager-matrix", "frozen-state")!;
    return client.fetchState().then((state) => {
      if (!state.ok) throw new Error("Expected acceptance state");
      expect(validateMoteGameState(state)).not.toBeNull();
      const changedStake = { ...state, allowed_stakes: { ...state.allowed_stakes, wager: [1, 2, 5] } };
      expect(validateMoteGameState(changedStake)).toBeNull();
      const changedPayout = { ...state, paytables: { ...state.paytables,
        wager: state.paytables.wager.map((row) => row.outcome === "jackpot" ? { ...row, motes_multiplier: 9 } : row),
      } } as MoteGameState;
      expect(validateMoteGameState(changedPayout)).toBeNull();
    });
  });

  it("fails closed without throwing on malformed or extended paytable payloads", async () => {
    const client = createMoteGameAcceptanceClient("wager-matrix", "malformed-state")!;
    const state = await client.fetchState();
    if (!state.ok) throw new Error("Expected acceptance state");
    const malformed = [
      { ...state, paytables: null },
      { ...state, paytables: { ...state.paytables, wager: null } },
      { ...state, paytables: { ...state.paytables, wager: [null] } },
      { ...state, paytables: { ...state.paytables, bonus: state.paytables.wager } },
    ];
    for (const payload of malformed) {
      expect(() => validateMoteGameState(payload)).not.toThrow();
      expect(validateMoteGameState(payload)).toBeNull();
    }
  });

  it("accepts the frozen protocol-1 history adapter without treating it as a v2 play", () => {
    expect(validateLegacyMoteReceipt({ protocol_version: 1, spin_id: "old-spin", request_id: "old-request",
      mode: "reveal", stake_motes: 1, outcome: "legacy_resource", motes_returned: 0, net_motes: -1,
      motes_remaining: 4, wallet_revision: null, contraption_id: "auto_tickler", resource_id: "clockwork_acorn",
      resource_amount: 2, resource_balance: null, newly_unlocked: false, reel_stops: [5, 5, 5], reel_value: 5,
      reward_tickles: null, tickles_balance: null, paytable_version: null,
      presentation_version: "mote-animation-v3", created_at: "2026-08-30T12:00:00Z" })?.protocol_version).toBe(1);
  });

  it("requires the loaded V4 manifest and bindings for Wager but lets Reveal continue", () => {
    expect(canPresentMode("wager", "mote-animation-v4", "mote-animation-v3", true)).toBe(false);
    expect(canPresentMode("wager", "mote-animation-v4", "mote-animation-v4", false)).toBe(false);
    expect(canPresentMode("wager", "mote-animation-v4", "mote-animation-v4", true)).toBe(true);
    expect(canPresentMode("reveal", "mote-animation-v4", null, false)).toBe(false);
    expect(canPresentMode("reveal", "mote-animation-v4", "mote-animation-v3", false)).toBe(true);
  });

  it("exposes every Wager outcome at every allowed stake for development acceptance", () => {
    expect(MOTE_WAGER_ACCEPTANCE_MATRIX).toHaveLength(15);
    for (const stake of [1, 3, 5])
      expect(MOTE_WAGER_ACCEPTANCE_MATRIX.filter((row) => row.stake === stake).map((row) => row.outcome))
        .toEqual(["loss", "returned_stake", "small", "big", "jackpot"]);
  });

  it("never replaces a newer wallet with replay or history facts", () => {
    expect(newerWallet({ motes: 20, revision: 9 }, { motes: 16, revision: 7 })).toEqual({ motes: 20, revision: 9 });
  });

  it("persists a full account-scoped command and clears only the same request", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: async (key: string) => values.get(key) ?? null,
      setItem: async (key: string, value: string) => { values.set(key, value); },
      removeItem: async (key: string) => { values.delete(key); },
    };
    const command = { protocolVersion: 2 as const, requestId: "request-123", accountId: "account-a",
      mode: "wager" as const, stakeMotes: 3, expectedRulesVersion: "wager-v1",
      createdAt: "2026-09-06T12:00:00.000Z" };
    await persistMoteCommand(storage, command);
    expect(await loadMoteCommand(storage, "account-a")).toEqual(command);
    expect(await loadMoteCommand(storage, "account-b")).toBeNull();
    values.set(pendingMoteCommandKey("account-a"), JSON.stringify({ ...command, requestId: "request-new" }));
    await clearMoteCommand(storage, command);
    expect(values.has(pendingMoteCommandKey("account-a"))).toBe(true);
  });

  it("shares accumulated Acorns and activation time across machine and inventory routes", async () => {
    const machine = createMoteGameAcceptanceClient("wager-matrix", "cross-route")!;
    const command = { protocolVersion: 2 as const, accountId: machine.accountId, mode: "reveal" as const,
      stakeMotes: 1, expectedRulesVersion: "reveal-v1", createdAt: "2026-09-06T12:00:00Z" };
    await expect(machine.play({ ...command, requestId: "route-reveal-one" })).resolves.toMatchObject({
      ok: true, receipt: { resource_amount: 1, resource_balance: 1, newly_unlocked: true },
    });
    const shelf = createMoteGameAcceptanceClient("wager-matrix", "cross-route")!;
    await expect(shelf.fetchInventory()).resolves.toMatchObject({ ok: true, items: [{ resource_balance: 1 }] });
    const first = await shelf.activate("day");
    expect(first).toMatchObject({ ok: true, cost: 1, resource_balance: 0 });
    await machine.play({ ...command, requestId: "route-reveal-two" });
    const second = await shelf.activate("day");
    if (!first.ok || !second.ok) throw new Error("Expected shared acceptance activation state");
    expect(Date.parse(second.active_until) - Date.parse(first.active_until)).toBe(86_400_000);
    await expect(machine.fetchState()).resolves.toMatchObject({ inventory: [{ resource_balance: 1, active_until: second.active_until }] });
  });
});
