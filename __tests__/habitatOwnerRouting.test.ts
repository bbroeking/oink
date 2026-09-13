import { HABITAT_CATALOG_BY_ID, HABITAT_STARTER_POSITIONS } from "@/constants/habitat";
import { fetchFriendHabitat } from "@/utils/habitat";
import { rpcAction } from "@/utils/rpc";

jest.mock("@/utils/rpc", () => ({ rpcAction: jest.fn() }));
const rpc = jest.mocked(rpcAction);
const room = (ownerId: string) => ({
  ownerId,
  revision: 2,
  positions: Object.fromEntries(Object.entries(HABITAT_STARTER_POSITIONS).map(
    ([position, id]) => [position, id ? HABITAT_CATALOG_BY_ID[id] : null],
  )),
});

describe("friend Barn RPC owner binding", () => {
  beforeEach(() => jest.clearAllMocks());
  it("requests exactly the selected host and returns that host's room", async () => {
    const response = { ok: true as const, snapshot: room("friend-b") };
    rpc.mockResolvedValue(response);
    const result = await fetchFriendHabitat("friend-b");
    expect(rpc).toHaveBeenCalledWith("view_habitat", { p_owner: "friend-b" });
    expect(result).toMatchObject({ ok: true, ownerId: "friend-b" });
  });
  it("rejects a successful response for another host", async () => {
    const response = { ok: true as const, snapshot: room("friend-a") };
    rpc.mockResolvedValue(response);
    expect(await fetchFriendHabitat("friend-b")).toEqual({ ok: false, reason: "invalid_response" });
  });
  it("preserves authorization failures instead of substituting the caller's Barn", async () => {
    rpc.mockResolvedValue({ ok: false, reason: "not_friends" });
    expect(await fetchFriendHabitat("stranger")).toEqual({ ok: false, reason: "not_friends" });
  });
});
