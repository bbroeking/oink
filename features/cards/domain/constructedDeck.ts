import { CARD_CATALOG } from "../data/catalog";
import type { CardCatalogEntry } from "./catalog";

/** Canonical rules: docs/marketing/trading-cards/base-set-84/README.md#constructed-deck-rule. */
export const CONSTRUCTED_DECK_SIZE = 24;
export const CONSTRUCTED_DECK_VERSION = 1 as const;

export interface PigLegend {
  id: string;
  name: string;
  favoredStyles: readonly string[];
  abilityName: string;
  text: string;
}

const catalog: readonly CardCatalogEntry[] = CARD_CATALOG;
const cardById = new Map<string, CardCatalogEntry>(catalog.map((card) => [card.id, card]));

export const PIG_LEGENDS: readonly PigLegend[] = catalog
  .filter((card) => card.type === "legend" && card.startsOutsideDeck)
  .map((card) => ({
    id: card.id,
    name: card.name,
    favoredStyles: card.favoredStyles ?? [],
    abilityName: card.abilityName ?? "",
    text: card.text,
  }));

export const DEFAULT_LEGEND_ID = PIG_LEGENDS[0].id;

const legendById = new Map(PIG_LEGENDS.map((legend) => [legend.id, legend]));

export interface ConstructedDeckState {
  version: typeof CONSTRUCTED_DECK_VERSION;
  legendId: string;
  /** Positive copy counts keyed by immutable catalog card ID. */
  copies: Record<string, number>;
}

export type ConstructedDeckIssueCode =
  | "unknown_legend"
  | "unknown_card"
  | "legend_in_deck"
  | "style_mismatch"
  | "copy_limit"
  | "legendary_copy_limit"
  | "deck_size";

export interface ConstructedDeckIssue {
  code: ConstructedDeckIssueCode;
  cardId?: string;
  actual?: number;
  expected?: number;
}

export interface ConstructedDeckValidation {
  valid: boolean;
  totalCards: number;
  issues: readonly ConstructedDeckIssue[];
}

function requireLegend(legendId: string): PigLegend {
  const legend = legendById.get(legendId);
  if (!legend) throw new Error(`Unknown Pig Legend: ${legendId}`);
  return legend;
}

function requireDeckCard(cardId: string): CardCatalogEntry {
  const card = cardById.get(cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  if (card.type === "legend") throw new Error("A Pig Legend starts outside the constructed deck");
  return card;
}

function cardLimit(card: CardCatalogEntry): number {
  return card.rarity === "legendary" ? 1 : 2;
}

function cardMatchesLegend(card: CardCatalogEntry, legend: PigLegend): boolean {
  return typeof card.style === "string" && legend.favoredStyles.includes(card.style);
}

function totalCopies(copies: Readonly<Record<string, number>>): number {
  return Object.values(copies).reduce((sum, count) => sum + count, 0);
}

export function createConstructedDeck(legendId = DEFAULT_LEGEND_ID): ConstructedDeckState {
  requireLegend(legendId);
  return { version: CONSTRUCTED_DECK_VERSION, legendId, copies: {} };
}

/** Invalid persisted input recovers to an empty deck with the requested guaranteed Legend. */
export function restoreConstructedDeck(
  value: unknown,
  fallbackLegendId = DEFAULT_LEGEND_ID,
): ConstructedDeckState {
  const fallback = createConstructedDeck(fallbackLegendId);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<ConstructedDeckState>;
  if (
    candidate.version !== CONSTRUCTED_DECK_VERSION ||
    typeof candidate.legendId !== "string" ||
    !legendById.has(candidate.legendId) ||
    !candidate.copies ||
    typeof candidate.copies !== "object" ||
    Array.isArray(candidate.copies)
  ) return fallback;

  const copies: Record<string, number> = {};
  for (const [cardId, count] of Object.entries(candidate.copies)) {
    const card = cardById.get(cardId);
    if (
      !card || card.type === "legend" || !Number.isInteger(count) || count <= 0 ||
      count > cardLimit(card)
    ) return fallback;
    copies[cardId] = count;
  }
  if (totalCopies(copies) > CONSTRUCTED_DECK_SIZE) return fallback;
  return { version: CONSTRUCTED_DECK_VERSION, legendId: candidate.legendId, copies };
}

export function addConstructedCard(state: ConstructedDeckState, cardId: string): ConstructedDeckState {
  const legend = requireLegend(state.legendId);
  const card = requireDeckCard(cardId);
  if (!cardMatchesLegend(card, legend)) throw new Error(`${card.name} does not match ${legend.name}'s favored styles`);
  if (totalCopies(state.copies) >= CONSTRUCTED_DECK_SIZE) throw new Error("The constructed deck already has 24 cards");
  const nextCount = (state.copies[cardId] ?? 0) + 1;
  if (nextCount > cardLimit(card)) throw new Error(`Copy limit reached for ${card.name}`);
  return { ...state, copies: { ...state.copies, [cardId]: nextCount } };
}

export function removeConstructedCard(state: ConstructedDeckState, cardId: string): ConstructedDeckState {
  const count = state.copies[cardId] ?? 0;
  if (count === 0) return state;
  const copies = { ...state.copies };
  if (count === 1) delete copies[cardId];
  else copies[cardId] = count - 1;
  return { ...state, copies };
}

/** Preserves selected cards so the caller can show which choices no longer match. */
export function changeConstructedLegend(state: ConstructedDeckState, legendId: string): ConstructedDeckState {
  requireLegend(legendId);
  return state.legendId === legendId ? state : { ...state, legendId };
}

export function validateConstructedDeck(state: ConstructedDeckState): ConstructedDeckValidation {
  const issues: ConstructedDeckIssue[] = [];
  const legend = legendById.get(state.legendId);
  let totalCards = 0;
  if (!legend) issues.push({ code: "unknown_legend" });

  for (const [cardId, count] of Object.entries(state.copies)) {
    if (!Number.isInteger(count) || count <= 0) {
      issues.push({ code: "copy_limit", cardId, actual: count });
      continue;
    }
    totalCards += count;
    const card = cardById.get(cardId);
    if (!card) {
      issues.push({ code: "unknown_card", cardId });
      continue;
    }
    if (card.type === "legend") {
      issues.push({ code: "legend_in_deck", cardId });
      continue;
    }
    const limit = cardLimit(card);
    if (count > limit) {
      issues.push({
        code: card.rarity === "legendary" ? "legendary_copy_limit" : "copy_limit",
        cardId,
        actual: count,
        expected: limit,
      });
    }
    if (legend && !cardMatchesLegend(card, legend)) issues.push({ code: "style_mismatch", cardId });
  }
  if (totalCards !== CONSTRUCTED_DECK_SIZE) {
    issues.push({ code: "deck_size", actual: totalCards, expected: CONSTRUCTED_DECK_SIZE });
  }
  return { valid: issues.length === 0, totalCards, issues };
}

/** Creates a stable catalog-order preview deck without reading or changing collection ownership. */
export function fillLegalDeck(legendId = DEFAULT_LEGEND_ID): ConstructedDeckState {
  const legend = requireLegend(legendId);
  const copies: Record<string, number> = {};
  let remaining = CONSTRUCTED_DECK_SIZE;
  for (const card of catalog) {
    if (card.type === "legend" || !cardMatchesLegend(card, legend)) continue;
    const count = Math.min(cardLimit(card), remaining);
    copies[card.id] = count;
    remaining -= count;
    if (remaining === 0) break;
  }
  if (remaining !== 0) throw new Error(`The catalog cannot fill a legal deck for ${legend.name}`);
  return { version: CONSTRUCTED_DECK_VERSION, legendId, copies };
}
