import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CARDS,
  SET_META,
} from "../docs/marketing/trading-cards/base-set-84/cards.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

const fail = (message) => failures.push(message);
const countBy = (cards, key) =>
  cards.reduce((counts, card) => {
    const value = card[key] ?? "none";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});

const expectCounts = (label, actual, expected) => {
  for (const [key, count] of Object.entries(expected)) {
    if (actual[key] !== count) {
      fail(`${label}.${key}: expected ${count}, received ${actual[key] ?? 0}`);
    }
  }
  const extras = Object.keys(actual).filter((key) => !(key in expected));
  if (extras.length) fail(`${label}: unexpected values ${extras.join(", ")}`);
};

if (CARDS.length !== SET_META.cardCount) {
  fail(`set size: expected ${SET_META.cardCount}, received ${CARDS.length}`);
}

const ids = new Set();
const numbers = new Set();
const allowedRarities = new Set([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
]);
const allowedStyles = new Set(["brave", "steady", "spark"]);
const allowedTypes = new Set([
  "legend",
  "gear",
  "critter",
  "enemy",
  "stunt",
  "place",
]);
const allowedTrainingKinds = new Set(["action", "burst"]);
const allowedArtStatuses = new Set([
  "ready",
  "adapt-existing",
  "needs-illustration",
]);
const allowedSources = new Set(["game", "game-concept", "card-original"]);

for (const [index, card] of CARDS.entries()) {
  const prefix = `${card.number ?? "???"} ${card.name ?? card.id ?? "unknown"}`;
  const expectedNumber = String(index + 1).padStart(3, "0");

  if (card.number !== expectedNumber) {
    fail(`${prefix}: expected collector number ${expectedNumber}`);
  }
  if (numbers.has(card.number)) fail(`${prefix}: duplicate collector number`);
  numbers.add(card.number);

  if (!/^[a-z0-9_]+$/.test(card.id ?? "")) {
    fail(`${prefix}: id must be snake_case`);
  }
  if (ids.has(card.id)) fail(`${prefix}: duplicate id ${card.id}`);
  ids.add(card.id);

  if (!allowedTypes.has(card.type))
    fail(`${prefix}: invalid type ${card.type}`);
  if (!allowedRarities.has(card.rarity)) {
    fail(`${prefix}: invalid rarity ${card.rarity}`);
  }
  if (!allowedArtStatuses.has(card.artStatus)) {
    fail(`${prefix}: invalid artStatus ${card.artStatus}`);
  }
  if (!allowedSources.has(card.source)) {
    fail(`${prefix}: invalid source ${card.source}`);
  }
  if (!card.text || !card.flavor)
    fail(`${prefix}: missing rules or flavor text`);

  if (card.type === "legend") {
    if (card.legend !== true || card.startsOutsideDeck !== true) {
      fail(`${prefix}: every Legend must begin outside the deck`);
    }
    if (card.fullArt !== true || !card.identityArt) {
      fail(`${prefix}: every Legend must have full art and identity art`);
    }
    if (card.startingCheer !== 12)
      fail(`${prefix}: Legend must start at 12 Cheer`);
    if (!card.abilityName) {
      fail(`${prefix}: Legend must have a named ability`);
    }
    if (!card.breedInspiration || !card.legendRole || !card.frameMotif) {
      fail(`${prefix}: Legend must define breed inspiration, role, and frame motif`);
    }
    if (
      !Array.isArray(card.favoredStyles) ||
      card.favoredStyles.length !== 2 ||
      card.favoredStyles.some((style) => !allowedStyles.has(style))
    ) {
      fail(`${prefix}: Legend must have two valid favored styles`);
    }
    if ("rank" in card || "training" in card) {
      fail(`${prefix}: Legend cannot have rank or Training`);
    }
  } else {
    if (![1, 2, 3].includes(card.rank)) fail(`${prefix}: invalid rank`);
    if (!allowedStyles.has(card.style)) fail(`${prefix}: invalid style`);
    if (!card.training) {
      fail(`${prefix}: deck card must have Training`);
    } else {
      if (card.training.style !== card.style) {
        fail(`${prefix}: Training style must match card style`);
      }
      if (!allowedTrainingKinds.has(card.training.kind)) {
        fail(`${prefix}: invalid Training kind ${card.training.kind}`);
      }
      if (!card.training.name || !card.training.text) {
        fail(`${prefix}: incomplete Training strip`);
      }
    }
  }

  if (card.type === "gear") {
    if (!["head", "held", "aura"].includes(card.slot)) {
      fail(`${prefix}: invalid Gear slot`);
    }
    if (card.slot === "head") {
      const [min, max] = { 1: [1, 2], 2: [2, 3], 3: [3, 4] }[card.rank];
      if (card.guard < min || card.guard > max) {
        fail(`${prefix}: Guard ${card.guard} outside rank-${card.rank} budget`);
      }
    }
    if (card.slot === "held") {
      const [min, max] = { 1: [2, 3], 2: [3, 3], 3: [3, 4] }[card.rank];
      if (card.bash < min || card.bash > max) {
        fail(`${prefix}: Bash ${card.bash} outside rank-${card.rank} budget`);
      }
    }
  }

  if (card.type === "critter") {
    const total = card.bash + card.hearts;
    const [min, max] = { 1: [3, 4], 2: [5, 5], 3: [7, 7] }[card.rank];
    if (total < min || total > max) {
      fail(
        `${prefix}: Critter stat total ${total} outside rank-${card.rank} budget`,
      );
    }
  }

  if (card.type === "enemy") {
    const total = card.bash + card.hearts;
    const [min, max] = { 1: [4, 5], 2: [6, 6], 3: [8, 11] }[card.rank];
    if (total < min || total > max) {
      fail(
        `${prefix}: Enemy stat total ${total} outside rank-${card.rank} budget`,
      );
    }
  }

  if (card.art) {
    try {
      await access(path.join(ROOT, card.art));
    } catch {
      fail(`${prefix}: art path does not exist: ${card.art}`);
    }
  } else if (card.artStatus !== "needs-illustration") {
    fail(`${prefix}: non-placeholder art status requires an art path`);
  }
}

expectCounts("type", countBy(CARDS, "type"), {
  legend: 6,
  gear: 27,
  critter: 19,
  enemy: 13,
  stunt: 16,
  place: 7,
});
if (CARDS.filter((card) => card.legend === true).length !== 6) {
  fail("legends: expected exactly six Legend cards");
}
expectCounts("rarity", countBy(CARDS, "rarity"), {
  common: 31,
  uncommon: 26,
  rare: 16,
  epic: 6,
  legendary: 9,
});
expectCounts(
  "style",
  countBy(
    CARDS.filter((card) => card.type !== "legend"),
    "style",
  ),
  {
    brave: 27,
    steady: 28,
    spark: 27,
  },
);
expectCounts(
  "rank",
  countBy(
    CARDS.filter((card) => card.type !== "legend"),
    "rank",
  ),
  {
    1: 27,
    2: 28,
    3: 27,
  },
);
expectCounts(
  "gear slot",
  countBy(
    CARDS.filter((card) => card.type === "gear"),
    "slot",
  ),
  {
    head: 9,
    held: 9,
    aura: 9,
  },
);

if (failures.length) {
  console.error(
    `Rosie's Loadout base-set validation failed (${failures.length}):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  const readyArt = CARDS.filter((card) => card.artStatus === "ready").length;
  const adaptedArt = CARDS.filter(
    (card) => card.artStatus === "adapt-existing",
  ).length;
  const neededArt = CARDS.filter(
    (card) => card.artStatus === "needs-illustration",
  ).length;
  console.log(
    [
      `${SET_META.name}: ${CARDS.length} cards valid.`,
      "Types: 6 Legend · 27 Gear · 19 Critter · 13 Enemy · 16 Stunt · 7 Place.",
      "Styles: 27 Brave · 28 Steady · 27 Spark.",
      "Ranks: 27 rank 1 · 28 rank 2 · 27 rank 3.",
      "Rarity: 31 common · 26 uncommon · 16 rare · 6 epic · 9 legendary.",
      `Art: ${readyArt} ready · ${adaptedArt} adaptable · ${neededArt} new illustrations needed.`,
    ].join("\n"),
  );
}
