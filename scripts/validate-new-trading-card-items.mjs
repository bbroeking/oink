import { NEW_GAME_ITEMS } from "../docs/marketing/trading-cards/base-set-84/new-game-items.mjs";

const ids = new Set();
const categories = new Set(["hat", "held", "aura"]);
const styles = new Set(["brave", "steady", "spark"]);
const rarities = new Set(["common", "uncommon", "rare", "epic", "legendary"]);
const expectedStats = {
  head: { 1: 2, 2: 3, 3: 4 },
  held: { 1: 2, 2: 3, 3: 4 },
};

for (const item of NEW_GAME_ITEMS) {
  if (ids.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
  ids.add(item.id);
  if (!/^[a-z0-9_]+$/.test(item.id)) throw new Error(`Invalid id: ${item.id}`);
  if (!categories.has(item.category)) throw new Error(`Invalid category: ${item.id}`);
  if (!rarities.has(item.rarity)) throw new Error(`Invalid rarity: ${item.id}`);
  if (!styles.has(item.card.style)) throw new Error(`Invalid style: ${item.id}`);
  if (![1, 2, 3].includes(item.card.rank)) throw new Error(`Invalid rank: ${item.id}`);
  if (!item.description || !item.card.text || !item.card.training?.text) {
    throw new Error(`Incomplete copy: ${item.id}`);
  }
  const budget = expectedStats[item.card.slot]?.[item.card.rank];
  const stat = item.card.slot === "head" ? item.card.guard : item.card.bash;
  if (budget && stat !== budget) {
    throw new Error(`${item.id} has ${stat}; expected ${budget} for ${item.card.slot} rank ${item.card.rank}`);
  }
}

if (NEW_GAME_ITEMS.length !== 9) throw new Error("Expected exactly nine concepts.");
for (const style of styles) {
  if (NEW_GAME_ITEMS.filter((item) => item.card.style === style).length !== 3) {
    throw new Error(`Expected three ${style} concepts.`);
  }
}

console.log("9 proposed cosmetics valid: 3 Head · 3 Held · 3 Aura; 3 per style.");

