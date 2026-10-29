import {
  ackLocalHalloweenLoginGift,
  createLocalCardAuthority,
  grantLocalHalloweenLoginGift,
  restoreLocalCardAuthority,
} from "@/features/cards/domain/localPrototypeAuthority";
import { HALLOWEEN_LOGIN_GIFT_CAMPAIGN, HALLOWEEN_LOGIN_GIFT_POOL } from "@/features/cards/domain/halloweenLoginGift";

const CLAIMED_AT = "2026-10-14T12:00:00.000Z";
const ACKNOWLEDGED_AT = "2026-10-14T12:01:00.000Z";

describe("local Halloween login gift", () => {
  it.each([
    [0, 0],
    [0.2, 1],
    [0.4, 2],
    [0.6, 3],
    [0.999999, 4],
  ])("maps draw %s to uniform pool quantile %s", (draw, index) => {
    const result = grantLocalHalloweenLoginGift(createLocalCardAuthority(), { draw, claimedAt: CLAIMED_AT });
    const expected = HALLOWEEN_LOGIN_GIFT_POOL[index];

    expect(result.status).toBe("new");
    expect(result.receipt).toMatchObject({
      receiptId: `local-demo:${HALLOWEEN_LOGIN_GIFT_CAMPAIGN}`,
      campaignKey: HALLOWEEN_LOGIN_GIFT_CAMPAIGN,
      costumeId: expected.costumeId,
      cardId: expected.cardId,
      claimedAt: CLAIMED_AT,
      acknowledgedAt: null,
    });
    expect(result.state.copies[expected.cardId]).toBe(1);
    expect(result.state.finishes[expected.cardId]).toEqual(["standard"]);
    expect(result.state.cosmeticUnlocks[expected.costumeId]).toBe(result.receipt.receiptId);
    expect(result.state.repeatProgress).toBe(0);
    expect(result.state.grants).toEqual({});
  });

  it.each([-0.001, 1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid draw %s", (draw) => {
    expect(() => grantLocalHalloweenLoginGift(createLocalCardAuthority(), { draw, claimedAt: CLAIMED_AT }))
      .toThrow("draw");
  });

  it("replays the immutable saved choice without granting again, even after acknowledgement", () => {
    const first = grantLocalHalloweenLoginGift(createLocalCardAuthority(), { draw: 0, claimedAt: CLAIMED_AT });
    const replay = grantLocalHalloweenLoginGift(first.state, { draw: 0.999999, claimedAt: "2099-01-01T00:00:00.000Z" });
    expect(replay.status).toBe("replay");
    expect(replay.state).toBe(first.state);
    expect(replay.receipt).toBe(first.receipt);
    expect(replay.state.copies[first.receipt.cardId]).toBe(1);
    expect(grantLocalHalloweenLoginGift(first.state, { draw: Number.NaN }).state).toBe(first.state);

    const acknowledged = ackLocalHalloweenLoginGift(replay.state, ACKNOWLEDGED_AT);
    expect(acknowledged.loginGift?.acknowledgedAt).toBe(ACKNOWLEDGED_AT);
    expect(ackLocalHalloweenLoginGift(acknowledged, "2099-01-01T00:00:00.000Z")).toBe(acknowledged);
    const afterAck = grantLocalHalloweenLoginGift(acknowledged, { draw: 0.4, claimedAt: CLAIMED_AT });
    expect(afterAck.status).toBe("replay");
    expect(afterAck.state).toBe(acknowledged);
    expect(afterAck.receipt.acknowledgedAt).toBe(ACKNOWLEDGED_AT);
    expect(afterAck.state.copies[first.receipt.cardId]).toBe(1);
  });

  it("adds one card copy while preserving existing progress, finishes, and cosmetic provenance", () => {
    const selected = HALLOWEEN_LOGIN_GIFT_POOL[2];
    const before = {
      ...createLocalCardAuthority(),
      copies: { [selected.cardId]: 2 },
      finishes: { [selected.cardId]: ["standard", "foil"] as const },
      repeatProgress: 7,
      cosmeticUnlocks: { [selected.costumeId]: "opening:earlier-receipt" },
    };
    const result = grantLocalHalloweenLoginGift(before, { draw: 0.4, claimedAt: CLAIMED_AT });
    expect(result.state.copies[selected.cardId]).toBe(3);
    expect(result.state.finishes[selected.cardId]).toEqual(["standard", "foil"]);
    expect(result.state.repeatProgress).toBe(7);
    expect(result.state.cosmeticUnlocks[selected.costumeId]).toBe("opening:earlier-receipt");
  });

  it("restores an unacknowledged receipt for presentation and preserves an acknowledged receipt", () => {
    const first = grantLocalHalloweenLoginGift(createLocalCardAuthority(), { draw: 0.6, claimedAt: CLAIMED_AT });
    const restored = restoreLocalCardAuthority(JSON.parse(JSON.stringify(first.state)));
    expect(restored).toEqual(first.state);
    expect(restored.loginGift?.acknowledgedAt).toBeNull();

    const acknowledged = ackLocalHalloweenLoginGift(restored, ACKNOWLEDGED_AT);
    expect(restoreLocalCardAuthority(JSON.parse(JSON.stringify(acknowledged)))).toEqual(acknowledged);
  });

  it("fails closed when persisted gift identity, selection, timestamp, ownership, or provenance is tampered", () => {
    const valid = grantLocalHalloweenLoginGift(createLocalCardAuthority(), { draw: 0.2, claimedAt: CLAIMED_AT }).state;
    const empty = createLocalCardAuthority();
    const cases = [
      { ...valid, loginGift: { ...valid.loginGift!, receiptId: "local-demo:tampered" } },
      { ...valid, loginGift: { ...valid.loginGift!, cardId: HALLOWEEN_LOGIN_GIFT_POOL[4].cardId } },
      { ...valid, loginGift: { ...valid.loginGift!, claimedAt: "not-a-timestamp" } },
      { ...valid, copies: {} },
      { ...valid, finishes: {} },
      { ...valid, cosmeticUnlocks: {} },
      { ...valid, cosmeticUnlocks: { [valid.loginGift!.costumeId]: "local-demo:wrong-receipt" } },
    ];
    for (const candidate of cases) expect(restoreLocalCardAuthority(candidate)).toEqual(empty);
  });
});
