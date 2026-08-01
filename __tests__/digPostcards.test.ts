import {
  digPostcardsAvailable,
  normalizeDigPostcard,
  postcardAccessibilityLabel,
} from "@/utils/digPostcards";
import { rpcOutcome } from "@/utils/rpc";

jest.mock("@/utils/rpc", () => ({
  rpc: jest.fn(),
  rpcAction: jest.fn(),
  rpcOutcome: jest.fn(),
}));

jest.mock("@/utils/supabase", () => ({
  supabase: {},
}));

jest.mock("@/utils/friendships", () => ({
  getFriendIds: jest.fn(),
}));

const mockedRpcOutcome = rpcOutcome as jest.MockedFunction<typeof rpcOutcome>;

describe("dig postcard snapshots", () => {
  it("keeps the composer dark until its read RPC exists", async () => {
    mockedRpcOutcome.mockResolvedValueOnce({
      ok: false,
      kind: "missing_function",
      error: { code: "PGRST202" },
    });
    await expect(digPostcardsAvailable()).resolves.toBe(false);

    mockedRpcOutcome.mockResolvedValueOnce({ ok: true, data: [] });
    await expect(digPostcardsAvailable()).resolves.toBe(true);
  });

  const raw = {
    id: "postcard-1",
    sender_id: "sender-1",
    recipient_id: "recipient-1",
    sender_username: "Poppy",
    recipient_username: "Moss",
    feeding_number: 402,
    cells: ["mud", "truffle", "shimmer", "unique"],
    digs: 19,
    finds: 3,
    golden_in_digs: 7,
    created_at: "2026-07-26T23:00:00.000Z",
    recipient_opened_at: null,
    cheered_at: null,
  };

  it("normalizes the RPC's snake-case durable snapshot", () => {
    expect(normalizeDigPostcard(raw)).toEqual({
      id: "postcard-1",
      senderId: "sender-1",
      recipientId: "recipient-1",
      senderUsername: "Poppy",
      recipientUsername: "Moss",
      feedingNumber: 402,
      cells: ["mud", "truffle", "shimmer", "unique"],
      digs: 19,
      finds: 3,
      goldenInDigs: 7,
      createdAt: "2026-07-26T23:00:00.000Z",
      recipientOpenedAt: null,
      cheeredAt: null,
    });
  });

  it("rejects an unknown share cell instead of rendering a forged shape", () => {
    expect(normalizeDigPostcard({ ...raw, cells: ["mud", "coin"] })).toBeNull();
  });

  it("describes the visual grid without relying on color or shape", () => {
    const postcard = normalizeDigPostcard(raw);
    expect(postcard && postcardAccessibilityLabel(postcard)).toBe(
      "Feeding 402: 3 finds in 19 digs",
    );
  });

  it("singularizes the receipt summary", () => {
    const postcard = normalizeDigPostcard({
      ...raw,
      cells: ["truffle"],
      digs: 1,
      finds: 1,
      golden_in_digs: 1,
    });
    expect(postcard && postcardAccessibilityLabel(postcard)).toBe(
      "Feeding 402: 1 find in 1 dig",
    );
  });
});
