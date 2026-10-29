import halloweenContent from "../../../docs/design/halloween-2026/content.json";
import type { CardCatalogEntry, CardSetMeta } from "../domain/catalog";

export const SPOOKY_SNOUTS_SET = {
  id: "halloween_2026_v1",
  name: "Spooky Snouts",
  code: "SSN",
  cardCount: halloweenContent.unlockCards.length,
  release: "Halloween 2026 draft",
} as const satisfies CardSetMeta;

type ContentItem = {
  id: string;
  name: string;
  category: string;
  cardId: string;
  rarity: CardCatalogEntry["rarity"];
  copy: string;
  cardArtVersion: number;
};

const rawContentItems = [
  ...halloweenContent.wearables,
  ...halloweenContent.backgrounds,
];
const contentItems: readonly ContentItem[] = rawContentItems.map((item) => {
  if (!["common", "uncommon", "rare", "epic", "legendary"].includes(item.rarity)) {
    throw new Error(`Invalid Spooky Snouts rarity: ${item.id}`);
  }
  const authoredVersion = (item as typeof item & { cardArtVersion?: unknown }).cardArtVersion ?? 1;
  if (typeof authoredVersion !== "number" || !Number.isInteger(authoredVersion) || authoredVersion < 1) {
    throw new Error(`Invalid Spooky Snouts card art version: ${item.id}`);
  }
  return { id: item.id, name: item.name, category: item.category, cardId: item.cardId,
    rarity: item.rarity as ContentItem["rarity"], copy: item.copy, cardArtVersion: authoredVersion };
});
const itemById = new Map(contentItems.map((item) => [item.id, item]));

export const SPOOKY_SNOUTS_CATALOG: readonly CardCatalogEntry[] = halloweenContent.unlockCards.map((mapping, index) => {
  const item = itemById.get(mapping.unlocks);
  if (!item || item.cardId !== mapping.id || mapping.firstCopyUnlock !== true) {
    throw new Error(`Invalid Spooky Snouts card mapping: ${mapping.id}`);
  }
  const category = item.category;
  return {
    number: String(index + 1).padStart(3, "0"),
    id: mapping.id,
    name: item.name,
    type: category === "background" ? "place" : "gear",
    rarity: item.rarity,
    text: category === "background"
      ? `The first copy permanently unlocks ${item.name}.`
      : `The first copy grants ${item.name}.`,
    flavor: item.copy,
    art: `assets/images/trading-cards/halloween-2026/${String(index + 1).padStart(3, "0")}-${item.id.replaceAll("_", "-")}-card-v${item.cardArtVersion}.png`,
    artStatus: "concept-fallback",
    source: "halloween-2026-draft",
    setId: SPOOKY_SNOUTS_SET.id,
    setCode: SPOOKY_SNOUTS_SET.code,
    setSize: SPOOKY_SNOUTS_SET.cardCount,
    collectionKind: "cosmetic-unlock",
    unlock: { itemId: item.id, itemName: item.name, category, rule: "first_copy" },
  };
});

export const SPOOKY_SNOUTS_BY_ID = new Map(SPOOKY_SNOUTS_CATALOG.map((card) => [card.id, card]));

export type CardAlbumSet = "base" | "spooky";
export function restoreCardAlbumSet(value: unknown, selectedCardId: string): CardAlbumSet {
  if (value === "base" || value === "spooky") return value;
  return SPOOKY_SNOUTS_BY_ID.has(selectedCardId) ? "spooky" : "base";
}

export const SPOOKY_SNOUTS_OPENING_FIXTURE = [
  { cardId: "halloween_2026_card_moonbrew_witch_hat", finish: "standard" },
  { cardId: "halloween_2026_card_hedge_broom", finish: "standard" },
  { cardId: "halloween_2026_card_lantern_porch_bg", finish: "foil" },
] as const;

export const SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE = [
  { cardId: "halloween_2026_card_count_snout_costume", finish: "standard" },
  { cardId: "halloween_2026_card_moonpuff_costume", finish: "standard" },
  { cardId: "halloween_2026_card_little_reaper_costume", finish: "standard" },
  { cardId: "halloween_2026_card_patchwork_pal_costume", finish: "standard" },
  { cardId: "halloween_2026_card_candy_corn_costume", finish: "standard" },
] as const;

for (const result of [...SPOOKY_SNOUTS_OPENING_FIXTURE, ...SPOOKY_SNOUTS_COSTUME_OPENING_FIXTURE]) {
  if (!SPOOKY_SNOUTS_BY_ID.has(result.cardId)) throw new Error(`Unknown Spooky Snouts fixture card: ${result.cardId}`);
}
