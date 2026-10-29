import { CARD_CATALOG } from "@/features/cards/data/catalog";
import type { CardCatalogEntry } from "@/features/cards/domain/catalog";
import { SPOOKY_SNOUTS_CATALOG } from "@/features/cards/data/seasonalCatalog";
import {
  addConstructedCard,
  changeConstructedLegend,
  CONSTRUCTED_DECK_SIZE,
  createConstructedDeck,
  fillLegalDeck,
  PIG_LEGENDS,
  removeConstructedCard,
  restoreConstructedDeck,
  validateConstructedDeck,
} from "@/features/cards/domain/constructedDeck";

describe("constructed decks", () => {
  const cardById = new Map<string, CardCatalogEntry>(
    (CARD_CATALOG as readonly CardCatalogEntry[]).map((card) => [card.id, card]),
  );
  it("projects the six guaranteed Pig Legends from printed catalog records", () => {
    expect(PIG_LEGENDS).toHaveLength(6);
    expect(PIG_LEGENDS.map((legend) => legend.id)).toEqual([
      "legend_rosie", "legend_copper", "legend_pepper",
      "legend_bandit", "legend_pickles", "legend_biscuit",
    ]);
    expect(PIG_LEGENDS.every((legend) => legend.favoredStyles.length === 2)).toBe(true);
  });

  it("fills a deterministic legal 24-card preview for every Legend", () => {
    for (const legend of PIG_LEGENDS) {
      const first = fillLegalDeck(legend.id);
      const second = fillLegalDeck(legend.id);
      expect(second).toEqual(first);
      expect(validateConstructedDeck(first)).toEqual({ valid: true, totalCards: CONSTRUCTED_DECK_SIZE, issues: [] });
      for (const [cardId, count] of Object.entries(first.copies)) {
        const card = cardById.get(cardId)!;
        expect(legend.favoredStyles).toContain(card.style);
        expect(count).toBeLessThanOrEqual(card.rarity === "legendary" ? 1 : 2);
      }
    }
  });

  it("enforces style and per-card copy limits while add/remove stay immutable", () => {
    const empty = createConstructedDeck("legend_rosie");
    const one = addConstructedCard(empty, "firefly_swarm");
    const two = addConstructedCard(one, "firefly_swarm");
    expect(empty.copies).toEqual({});
    expect(two.copies.firefly_swarm).toBe(2);
    expect(() => addConstructedCard(two, "firefly_swarm")).toThrow("Copy limit");
    expect(() => addConstructedCard(empty, "mud_shovel")).toThrow("favored styles");
    expect(removeConstructedCard(two, "firefly_swarm").copies.firefly_swarm).toBe(1);
    expect(removeConstructedCard(empty, "firefly_swarm")).toBe(empty);

    let legendary = createConstructedDeck("legend_rosie");
    legendary = addConstructedCard(legendary, "release_party_crown");
    expect(() => addConstructedCard(legendary, "release_party_crown")).toThrow("Copy limit");
  });

  it("preserves cards on Legend change and reports newly mismatched styles", () => {
    const rosie = addConstructedCard(createConstructedDeck("legend_rosie"), "firefly_swarm");
    const copper = changeConstructedLegend(rosie, "legend_copper");
    expect(copper.copies).toEqual(rosie.copies);
    expect(validateConstructedDeck(copper).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "style_mismatch", cardId: "firefly_swarm" }),
      expect.objectContaining({ code: "deck_size", actual: 1, expected: 24 }),
    ]));
  });

  it("restores valid JSON and resets malformed nested records", () => {
    const deck = fillLegalDeck("legend_pickles");
    expect(restoreConstructedDeck(JSON.parse(JSON.stringify(deck)))).toEqual(deck);
    expect(restoreConstructedDeck({ ...deck, legendId: "unknown" }, "legend_copper")).toEqual(createConstructedDeck("legend_copper"));
    expect(restoreConstructedDeck({ ...deck, copies: { firefly_swarm: 3 } })).toEqual(createConstructedDeck());
    expect(restoreConstructedDeck({ ...deck, copies: { legend_rosie: 1 } })).toEqual(createConstructedDeck());
    expect(restoreConstructedDeck({ ...deck, copies: { firefly_swarm: Number.NaN } })).toEqual(createConstructedDeck());
  });

  it("validation distinguishes a per-card Legendary limit from total Legendary cards", () => {
    const state = {
      ...createConstructedDeck("legend_rosie"),
      copies: { release_party_crown: 2, great_hungerer: 1 },
    };
    const validation = validateConstructedDeck(state);
    expect(validation.issues).toContainEqual({
      code: "legendary_copy_limit", cardId: "release_party_crown", actual: 2, expected: 1,
    });
    expect(validation.issues).not.toContainEqual(expect.objectContaining({
      code: "legendary_copy_limit", cardId: "great_hungerer",
    }));
  });

  it("does not admit cosmetic collection cards into constructed decks", () => {
    for (const card of SPOOKY_SNOUTS_CATALOG) {
      expect(() => addConstructedCard(createConstructedDeck(), card.id)).toThrow("Unknown card");
    }
    expect(restoreConstructedDeck({
      ...createConstructedDeck(),
      copies: { halloween_2026_card_moonbrew_witch_hat: 1 },
    })).toEqual(createConstructedDeck());
  });
});
