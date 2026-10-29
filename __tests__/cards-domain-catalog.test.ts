import {
  CARD_BY_ID, CARD_CATALOG, CARD_SET, COLLECTION_CATALOG, CURRENT_PACK_CARD_COUNT,
  LEGACY_FIVE_CARD_OPENING_FIXTURE, OPENING_FIXTURE,
} from "@/features/cards/data/catalog";
import {
  restoreCardAlbumSet,
  SPOOKY_SNOUTS_CATALOG,
  SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE,
  SPOOKY_SNOUTS_SET,
} from "@/features/cards/data/seasonalCatalog";
import { HEDGE_RUN_KIT } from "@/features/cards/domain/hedgeRun";

describe("card catalog", () => {
  it("preserves all 88 stable identities and printed source records", () => {
    expect(CARD_SET.cardCount).toBe(88);
    expect(CARD_CATALOG).toHaveLength(88);
    expect(new Set(CARD_CATALOG.map((card) => card.id)).size).toBe(88);
    expect(new Set(CARD_CATALOG.map((card) => card.number)).size).toBe(88);
    expect(CARD_BY_ID.get("mud_shovel")).toMatchObject({
      number: "019",
      name: "Mud Shovel",
      art: "assets/images/hats/mud_shovel.png",
    });
  });

  it("keeps Spooky Snouts as a separate cosmetic collection", () => {
    expect(CARD_CATALOG).toHaveLength(88);
    expect(SPOOKY_SNOUTS_CATALOG).toHaveLength(SPOOKY_SNOUTS_SET.cardCount);
    expect(SPOOKY_SNOUTS_CATALOG[0]).toMatchObject({ number: "001", setCode: "SSN", collectionKind: "cosmetic-unlock" });
    expect(SPOOKY_SNOUTS_CATALOG.at(-1)?.number).toBe(String(SPOOKY_SNOUTS_SET.cardCount).padStart(3, "0"));
    expect(COLLECTION_CATALOG).toHaveLength(88 + SPOOKY_SNOUTS_SET.cardCount);
    const hedgeIds = new Set(HEDGE_RUN_KIT.map((card) => card.cardId));
    expect(SPOOKY_SNOUTS_CATALOG.every((card) => !hedgeIds.has(card.id))).toBe(true);
    expect(restoreCardAlbumSet(undefined, SPOOKY_SNOUTS_CATALOG[0].id)).toBe("spooky");
    expect(restoreCardAlbumSet("spooky", "moon_firefly")).toBe("spooky");
    expect(restoreCardAlbumSet("bogus", "moon_firefly")).toBe("base");
    expect(SPOOKY_SNOUTS_SET.cardCount).toBe(49);
    expect(SPOOKY_SNOUTS_CATALOG.filter((card) => card.unlock?.category === "costume")).toHaveLength(11);
  });

  it("appends the five login-gift costume cards without disturbing the original 44", () => {
    const originalPackCostumes = SPOOKY_SNOUTS_CATALOG.slice(39, 44);
    const loginGiftCostumes = SPOOKY_SNOUTS_CATALOG.slice(44);
    expect(loginGiftCostumes.map(({ number, id }) => ({ number, id }))).toEqual([
      { number: "045", id: "halloween_2026_card_linen_lurker_costume" },
      { number: "046", id: "halloween_2026_card_starspell_costume" },
      { number: "047", id: "halloween_2026_card_bat_nap_costume" },
      { number: "048", id: "halloween_2026_card_little_imp_costume" },
      { number: "049", id: "halloween_2026_card_marshmallow_boo_costume" },
    ]);
    expect(loginGiftCostumes.map((card) => card.unlock?.category)).toEqual(Array(5).fill("costume"));
    expect(loginGiftCostumes.map((card) => card.unlock?.itemId)).toEqual([
      "halloween_2026_linen_lurker_costume",
      "halloween_2026_starspell_costume",
      "halloween_2026_bat_nap_costume",
      "halloween_2026_little_imp_costume",
      "halloween_2026_marshmallow_boo_costume",
    ]);
    expect(originalPackCostumes.map(({ number, id }) => ({ number, id }))).toEqual([
      { number: "040", id: "halloween_2026_card_count_snout_costume" },
      { number: "041", id: "halloween_2026_card_moonpuff_costume" },
      { number: "042", id: "halloween_2026_card_little_reaper_costume" },
      { number: "043", id: "halloween_2026_card_patchwork_pal_costume" },
      { number: "044", id: "halloween_2026_card_candy_corn_costume" },
    ]);
    expect(originalPackCostumes.map((card) => card.unlock?.itemId)).toEqual([
      "halloween_2026_count_snout_costume",
      "halloween_2026_moonpuff_costume",
      "halloween_2026_little_reaper_costume",
      "halloween_2026_patchwork_pal_costume",
      "halloween_2026_candy_corn_costume",
    ]);
    expect(SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE).toEqual(originalPackCostumes.map((card) => ({
      cardId: card.id,
      finish: "standard",
    })));
  });

  it("uses three existing identities and retains the legacy five-card prefix", () => {
    expect(CURRENT_PACK_CARD_COUNT).toBe(3);
    expect(OPENING_FIXTURE.map((item) => item.cardId)).toEqual([
      "firefly_swarm", "mud_shovel", "puddle_duckling",
    ]);
    expect(LEGACY_FIVE_CARD_OPENING_FIXTURE.slice(0, 3)).toEqual(OPENING_FIXTURE);
    for (const item of LEGACY_FIVE_CARD_OPENING_FIXTURE) expect(CARD_BY_ID.has(item.cardId)).toBe(true);
  });
});
