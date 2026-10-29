import { CARD_CATALOG, CARD_SET } from "./catalog.generated";
import { SPOOKY_SNOUTS_CATALOG, SPOOKY_SNOUTS_SET } from "./seasonalCatalog";

export { CARD_CATALOG, CARD_SET };
export const CARD_BY_ID = new Map(CARD_CATALOG.map((card) => [card.id, card]));
export const CARD_BY_NUMBER = new Map(CARD_CATALOG.map((card) => [card.number, card]));
export const COLLECTION_SETS = [CARD_SET, SPOOKY_SNOUTS_SET] as const;
export const COLLECTION_CATALOG = [...CARD_CATALOG, ...SPOOKY_SNOUTS_CATALOG] as const;
export const COLLECTION_CARD_BY_ID = new Map(COLLECTION_CATALOG.map((card) => [card.id, card]));

export const CURRENT_PACK_CARD_COUNT = 3 as const;
export const LEGACY_PACK_CARD_COUNT = 5 as const;

export const OPENING_FIXTURE = [
  { cardId: "firefly_swarm", finish: "standard" },
  { cardId: "mud_shovel", finish: "standard" },
  { cardId: "puddle_duckling", finish: "foil" },
] as const;

/** The original fixed prototype pack, retained only to validate committed receipts. */
export const LEGACY_FIVE_CARD_OPENING_FIXTURE = [
  ...OPENING_FIXTURE,
  { cardId: "mushroom_cap", finish: "standard" },
  { cardId: "moon_firefly", finish: "living" },
] as const;

export const LIVING_SHOWCASE_CARD_IDS = [
  "firefly_swarm",
  "puddle_duckling",
  "moon_firefly",
] as const;

for (const result of LEGACY_FIVE_CARD_OPENING_FIXTURE) {
  if (!CARD_BY_ID.has(result.cardId)) throw new Error(`Unknown opening fixture card: ${result.cardId}`);
}
