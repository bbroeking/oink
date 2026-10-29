import {
  claimLocalFoil, createLocalCardAuthority, FOIL_PROGRESS_COST, grantFixturePack, grantWelcomePack,
  grantSpookySnoutsPack, LOCAL_AUTHORITY_KIND, openLocalPack, restoreLocalCardAuthority, selectFoilGoal,
  SPOOKY_SNOUTS_PACK_ID,
} from "@/features/cards/domain/localPrototypeAuthority";
import { LEGACY_FIVE_CARD_OPENING_FIXTURE } from "@/features/cards/data/catalog";
import { createOpeningPresentation, openingPresentationReducer, restoreOpeningPresentation } from "@/features/cards/domain/openingPresentation";

describe("opening presentation", () => {
  it("keeps partial tear progress monotonic and resumes from serializable state", () => {
    let state = createOpeningPresentation("opening-1");
    state = openingPresentationReducer(state, { type: "tear", progress: 0.62 });
    state = openingPresentationReducer(state, { type: "tear", progress: 0.2 });
    expect(state.tearProgress).toBe(0.62);
    const restored = JSON.parse(JSON.stringify(state));
    expect(openingPresentationReducer(restored, { type: "tear", progress: 1 })).toMatchObject({ phase: "revealing", tearProgress: 1 });
  });

  it("coalesces rapid reveal taps, stops at the receipt count, and can skip", () => {
    let state = openingPresentationReducer(createOpeningPresentation("opening-1", 3), { type: "open" });
    state = openingPresentationReducer(state, { type: "requestReveal" });
    state = openingPresentationReducer(state, { type: "requestReveal" });
    expect(state.revealedCount).toBe(0);
    expect(state.revealPending).toBe(true);
    for (let count = 0; count < 3; count += 1) {
      state = openingPresentationReducer(state, { type: "cardSettled" });
      if (count < 2) state = openingPresentationReducer(state, { type: "requestReveal" });
    }
    expect(state).toMatchObject({ phase: "revealing", cardCount: 3, revealedCount: 3, revealPending: false });
    expect(openingPresentationReducer(state, { type: "requestReveal" })).toBe(state);
    expect(openingPresentationReducer(state, { type: "inspect", index: 2 })).toMatchObject({ phase: "inspecting", inspectingIndex: 2 });
    expect(openingPresentationReducer(state, { type: "showReceipt" })).toMatchObject({ phase: "receipt" });

    const skipped = openingPresentationReducer(createOpeningPresentation("opening-2", 3), { type: "skipToReceipt" });
    expect(skipped).toMatchObject({ phase: "receipt", revealedCount: 3 });
  });

  it("replay resets only presentation state", () => {
    const receipt = openingPresentationReducer(createOpeningPresentation("same-receipt"), { type: "skipToReceipt" });
    expect(openingPresentationReducer(receipt, { type: "replay" })).toEqual(createOpeningPresentation("same-receipt"));
  });

  it("recovers corrupt persistence and clears an interrupted reveal token", () => {
    expect(restoreOpeningPresentation({ version: 1, tearProgress: Number.NaN }, "o1")).toEqual(createOpeningPresentation("o1"));
    let pending = openingPresentationReducer(createOpeningPresentation("o1"), { type: "open" });
    pending = openingPresentationReducer(pending, { type: "requestReveal" });
    expect(restoreOpeningPresentation(pending, "o1").revealPending).toBe(false);
    expect(openingPresentationReducer(pending, { type: "tear", progress: 0.1 })).toBe(pending);
  });

  it("restores legacy count-less five-card progress and count-aware three-card progress", () => {
    const legacy = { ...createOpeningPresentation("old", 5), revealedCount: 4 } as Record<string, unknown>;
    delete legacy.cardCount;
    expect(restoreOpeningPresentation(legacy, "old")).toMatchObject({ cardCount: 5, revealedCount: 4 });

    const current = { ...createOpeningPresentation("new", 3), phase: "revealing", revealedCount: 2, revealPending: true };
    expect(restoreOpeningPresentation(current, "new", 3)).toMatchObject({ cardCount: 3, revealedCount: 2, revealPending: false });
    expect(restoreOpeningPresentation(current, "new", 5)).toEqual(createOpeningPresentation("new", 5));
  });
});

describe("local prototype authority", () => {
  it("grants and opens the welcome fixture idempotently", () => {
    const empty = createLocalCardAuthority();
    const granted = grantWelcomePack(grantWelcomePack(empty));
    expect(Object.keys(granted.grants)).toHaveLength(1);
    const first = openLocalPack(granted);
    const retry = openLocalPack(first.state);
    expect(retry.state).toBe(first.state);
    expect(retry.receipt).toBe(first.receipt);
    expect(first.receipt.authority).toBe(LOCAL_AUTHORITY_KIND);
    expect(first.receipt.results).toHaveLength(3);
    expect(Object.values(first.state.copies).reduce((sum, count) => sum + count, 0)).toBe(21);
    expect(first.receipt.results.find((result) => result.cardId === "mud_shovel")).toMatchObject({ isNew: false, copyNumber: 2 });
  });

  it("retains duplicate copies and banks repeat progress", () => {
    const seeded = { ...grantWelcomePack(createLocalCardAuthority()), copies: { mud_shovel: 2, firefly_swarm: 1 } };
    const { state, receipt } = openLocalPack(seeded);
    expect(state.copies.mud_shovel).toBe(3);
    expect(state.copies.firefly_swarm).toBe(2);
    expect(receipt.repeatProgressCredit).toBe(2);
    expect(state.repeatProgress).toBe(2);
  });

  it("does not double-spend an idempotent foil claim", () => {
    const owned = {
      ...createLocalCardAuthority(), copies: { mud_shovel: 1 }, repeatProgress: FOIL_PROGRESS_COST,
      finishes: { mud_shovel: ["standard" as const] },
    };
    const claimed = claimLocalFoil(owned, "mud_shovel", "claim-1");
    expect(claimed.repeatProgress).toBe(0);
    expect(claimed.finishes.mud_shovel).toContain("foil");
    expect(claimLocalFoil(claimed, "mud_shovel", "claim-1")).toBe(claimed);
  });

  it("supports fixed demo packs and goal changes without spending progress", () => {
    const welcome = grantWelcomePack(createLocalCardAuthority());
    const withDemo = grantFixturePack(welcome, "demo:tenth", "tenth-pack");
    expect(grantFixturePack(withDemo, "demo:tenth", "tenth-pack")).toBe(withDemo);
    const selected = selectFoilGoal({ ...withDemo, repeatProgress: 7 }, "mud_shovel");
    expect(selected).toMatchObject({ selectedFoilGoal: "mud_shovel", repeatProgress: 7 });
    expect(restoreLocalCardAuthority({ bad: true })).toEqual(createLocalCardAuthority());
    expect(restoreLocalCardAuthority(selected)).toBe(selected);
    const repeats = grantFixturePack(createLocalCardAuthority(), "demo:repeats", "all-repeat");
    const allRepeatReceipt = openLocalPack(repeats, "demo:repeats").receipt;
    expect(allRepeatReceipt.newCardCount).toBe(0);
    expect(allRepeatReceipt.repeatProgressCredit).toBe(3);
  });

  it("restores an already committed legacy five-card receipt without changing its progress", () => {
    const before = grantWelcomePack(createLocalCardAuthority());
    const grant = before.grants["local-demo:welcome-pack:v1"];
    const copies = { ...before.copies };
    const finishes = { ...before.finishes };
    let repeatProgressCredit = 0;
    const results = LEGACY_FIVE_CARD_OPENING_FIXTURE.map(({ cardId, finish }) => {
      const prior = copies[cardId] ?? 0;
      copies[cardId] = prior + 1;
      if (prior > 0) repeatProgressCredit += 1;
      finishes[cardId] = [...new Set([...(finishes[cardId] ?? []), finish])];
      return { cardId, finish, isNew: prior === 0, copyNumber: prior + 1 };
    });
    const receipt = {
      id: "opening:local-demo:welcome-pack:v1", packId: "local-demo:welcome-pack:v1",
      authority: LOCAL_AUTHORITY_KIND, results,
      newCardCount: results.filter((result) => result.isNew).length, repeatProgressCredit,
    } as const;
    const legacy = {
      ...before, copies, finishes, repeatProgress: repeatProgressCredit,
      grants: { ...before.grants, [grant.id]: { ...grant, opened: true } },
      receipts: { [grant.id]: receipt },
    };
    const restored = restoreLocalCardAuthority(JSON.parse(JSON.stringify(legacy)));
    expect(restored.receipts[grant.id].results).toHaveLength(5);
    expect(restored.repeatProgress).toBe(repeatProgressCredit);
    expect(openLocalPack(restored).receipt).toEqual(receipt);
  });

  it("rejects malformed nested persisted authority records", () => {
    const valid = openLocalPack(grantWelcomePack(createLocalCardAuthority())).state;
    expect(restoreLocalCardAuthority({ ...valid, copies: { mud_shovel: -1 } })).toEqual(createLocalCardAuthority());
    const badResults = {
      ...valid,
      receipts: {
        ...valid.receipts,
        [Object.keys(valid.receipts)[0]]: { ...Object.values(valid.receipts)[0], results: [{ cardId: "bogus" }] },
      },
    };
    expect(restoreLocalCardAuthority(badResults)).toEqual(createLocalCardAuthority());
    expect(restoreLocalCardAuthority({ ...valid, finishes: { mud_shovel: ["diamond"] } })).toEqual(createLocalCardAuthority());
  });

  it("persists and replays the local Spooky Snouts cosmetic receipt", () => {
    const granted = grantSpookySnoutsPack(createLocalCardAuthority());
    const first = openLocalPack(granted, SPOOKY_SNOUTS_PACK_ID);
    expect(first.receipt.results).toHaveLength(3);
    expect(first.receipt.results.every((result) => result.itemUnlock?.newlyOwned)).toBe(true);
    expect(Object.keys(first.state.cosmeticUnlocks)).toHaveLength(3);
    const restored = restoreLocalCardAuthority(JSON.parse(JSON.stringify(first.state)));
    const replay = openLocalPack(restored, SPOOKY_SNOUTS_PACK_ID);
    expect(replay.state).toBe(restored);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.state.repeatProgress).toBe(0);

    const repeatedGrant = grantFixturePack(restored, "local-demo:spooky-snouts:repeat", "spooky-snouts");
    const repeated = openLocalPack(repeatedGrant, "local-demo:spooky-snouts:repeat");
    expect(repeated.receipt.results.every((result) => result.itemUnlock?.newlyOwned === false)).toBe(true);
    expect(Object.keys(repeated.state.cosmeticUnlocks)).toHaveLength(3);
    expect(repeated.state.repeatProgress).toBe(0);
    expect(restoreLocalCardAuthority(JSON.parse(JSON.stringify(repeated.state)))).toEqual(repeated.state);

    const missingOwnership = { ...first.state, cosmeticUnlocks: {} };
    expect(restoreLocalCardAuthority(missingOwnership)).toEqual(createLocalCardAuthority());
    const bogusOwnership = { ...first.state, cosmeticUnlocks: { bogus_hat: first.receipt.id } };
    expect(restoreLocalCardAuthority(bogusOwnership)).toEqual(createLocalCardAuthority());
    const bogusReceipt = { ...first.state, cosmeticUnlocks: {
      ...first.state.cosmeticUnlocks,
      moonbrew_witch_hat: "opening:not-a-committed-pack",
    } };
    expect(restoreLocalCardAuthority(bogusReceipt)).toEqual(createLocalCardAuthority());
  });
});
