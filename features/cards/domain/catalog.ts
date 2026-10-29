export type CardRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type CardFinish = "standard" | "foil" | "living";
export type CardType = "legend" | "gear" | "critter" | "enemy" | "stunt" | "place";
export type CardCollectionKind = "constructed" | "cosmetic-unlock";

export interface CardSetMeta {
  id: string;
  name: string;
  code: string;
  cardCount: number;
  release: string;
}

export interface PrintedTrainingRule {
  style: string;
  kind: string;
  name: string;
  text: string;
}

/** The immutable identity and printed-rule record authored by the physical set. */
export interface CardCatalogEntry {
  number: string;
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  text: string;
  flavor: string;
  art: string | null;
  artStatus: string;
  source: string;
  rank?: number;
  style?: string;
  slot?: "head" | "held" | "aura";
  guard?: number;
  bash?: number;
  hearts?: number;
  training?: PrintedTrainingRule;
  legend?: boolean;
  startsOutsideDeck?: boolean;
  fullArt?: boolean;
  startingCheer?: number;
  favoredStyles?: readonly string[];
  abilityName?: string;
  identityArt?: string;
  legendRole?: string;
  breedInspiration?: string;
  frameMotif?: string;
  setId?: string;
  setCode?: string;
  setSize?: number;
  collectionKind?: CardCollectionKind;
  unlock?: {
    itemId: string;
    itemName: string;
    category: string;
    rule: "first_copy";
  };
}

export interface CollectedCard {
  cardId: string;
  finish: CardFinish;
}
