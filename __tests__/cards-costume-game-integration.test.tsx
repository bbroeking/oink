import {
  createLocalCardAuthority,
  grantSpookySnoutsCostumePack,
  openLocalPack,
  restoreLocalCardAuthority,
  SPOOKY_SNOUTS_COSTUME_PACK_ID,
} from "@/features/cards/domain/localPrototypeAuthority";
import { SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE } from "@/features/cards/data/seasonalCatalog";
import { restoreEquippedRosieCostume } from "@/features/cards/data/costumeFits";

describe("Spooky Snouts costume packet authority", () => {
  it("grants the five wearable identities once and replays the original receipt", () => {
    const granted = grantSpookySnoutsCostumePack(createLocalCardAuthority());
    expect(grantSpookySnoutsCostumePack(granted)).toBe(granted);

    const first = openLocalPack(granted, SPOOKY_SNOUTS_COSTUME_PACK_ID);
    expect(first.receipt.results.map((result) => result.cardId)).toEqual(
      SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE.map((result) => result.cardId),
    );
    expect(first.receipt.results.every((result) => result.itemUnlock?.newlyOwned)).toBe(true);
    expect(first.receipt.repeatProgressCredit).toBe(0);
    expect(first.state.repeatProgress).toBe(0);
    expect(Object.keys(first.state.cosmeticUnlocks)).toHaveLength(5);

    const restored = restoreLocalCardAuthority(JSON.parse(JSON.stringify(first.state)));
    const replay = openLocalPack(restored, SPOOKY_SNOUTS_COSTUME_PACK_ID);
    expect(replay.state).toBe(restored);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.state.repeatProgress).toBe(0);
    expect(Object.keys(replay.state.cosmeticUnlocks)).toHaveLength(5);
  });

  it("rejects a restored costume receipt whose card identity was changed", () => {
    const first = openLocalPack(
      grantSpookySnoutsCostumePack(createLocalCardAuthority()),
      SPOOKY_SNOUTS_COSTUME_PACK_ID,
    );
    const changed = JSON.parse(JSON.stringify(first.state));
    changed.receipts[SPOOKY_SNOUTS_COSTUME_PACK_ID].results[0].cardId =
      "halloween_2026_card_moonpuff_costume";

    expect(restoreLocalCardAuthority(changed)).toEqual(createLocalCardAuthority());
  });

  it("rejects a truncated five-costume receipt even when its counts are self-consistent", () => {
    const first = openLocalPack(
      grantSpookySnoutsCostumePack(createLocalCardAuthority()),
      SPOOKY_SNOUTS_COSTUME_PACK_ID,
    );
    const truncated = JSON.parse(JSON.stringify(first.state));
    const receipt = truncated.receipts[SPOOKY_SNOUTS_COSTUME_PACK_ID];
    receipt.results = receipt.results.slice(0, 3);
    receipt.newCardCount = 3;
    const keptItems = new Set(receipt.results.map((result: { itemUnlock: { itemId: string } }) => result.itemUnlock.itemId));
    truncated.cosmeticUnlocks = Object.fromEntries(
      Object.entries(truncated.cosmeticUnlocks).filter(([itemId]) => keptItems.has(itemId)),
    );

    expect(restoreLocalCardAuthority(truncated)).toEqual(createLocalCardAuthority());
  });

  it("restores only a known costume that the local card authority owns", () => {
    const opened = openLocalPack(
      grantSpookySnoutsCostumePack(createLocalCardAuthority()),
      SPOOKY_SNOUTS_COSTUME_PACK_ID,
    ).state;
    const ownedId = "halloween_2026_count_snout_costume";
    expect(restoreEquippedRosieCostume(ownedId, opened.cosmeticUnlocks)).toBe(ownedId);
    expect(restoreEquippedRosieCostume("halloween_2026_hollow_jack_costume", opened.cosmeticUnlocks)).toBeNull();
    expect(restoreEquippedRosieCostume("unknown_costume", opened.cosmeticUnlocks)).toBeNull();
  });

  it("adds the unopened costume packet to an existing save without changing progress", () => {
    const existing = {
      ...createLocalCardAuthority(),
      repeatProgress: 7,
      copies: { moon_firefly: 2 },
      finishes: { moon_firefly: ["standard" as const] },
    };
    const migrated = grantSpookySnoutsCostumePack(existing);
    expect(migrated.repeatProgress).toBe(7);
    expect(migrated.copies).toEqual(existing.copies);
    expect(migrated.finishes).toEqual(existing.finishes);
    expect(migrated.grants[SPOOKY_SNOUTS_COSTUME_PACK_ID]).toMatchObject({
      fixtureId: "spooky-snouts-costumes",
      opened: false,
    });
  });
});
