#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.resolve(here, '../../../landing/cards/cards.json'), 'utf8')).cards;
const starterIds = new Set([
  'ticket_takers_cap', 'bog_helmet', 'release_party_crown', 'toy_sword',
  'mud_shovel', 'golden_truffle', 'firefly_aura', 'shadow_aura',
  'golden_bog_aura', 'lantern_rabbit', 'bog_frog', 'truffle_mole',
]);
const eligible = catalog.filter((card) => !card.legend);
const byRarity = Object.groupBy(eligible, (card) => card.rarity);
const runs = Number(process.argv[2] ?? 10000);
const maxPacks = 500;

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function weighted(random, entries) {
  const roll = random();
  let total = 0;
  for (const [value, weight] of entries) {
    total += weight;
    if (roll < total) return value;
  }
  return entries.at(-1)[0];
}

function drawIdentity(random, rarity, owned, inPack) {
  const pool = byRarity[rarity].filter((card) => !inPack.has(card.id));
  const unseen = pool.filter((card) => !owned.has(card.id));
  const choices = unseen.length ? unseen : pool.length ? pool : byRarity[rarity];
  return choices[Math.floor(random() * choices.length)].id;
}

function drawPack(random, owned) {
  const rarities = [
    'common', 'common', 'uncommon',
    weighted(random, [['common', .60], ['uncommon', .30], ['rare', .10]]),
    weighted(random, [['rare', .85], ['epic', .12], ['legendary', .03]]),
  ];
  const inPack = new Set();
  return rarities.map((rarity) => {
    const id = drawIdentity(random, rarity, owned, inPack);
    inPack.add(id);
    return id;
  });
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

const completions = [];
const duplicateAtCompletion = [];
const firstFoil = [];
const tenthFoil = [];
const packDuplicateFrequency = Array.from({ length: 60 }, () => ({ packs: 0, anyRepeat: 0, repeats: 0 }));

for (let run = 0; run < runs; run += 1) {
  const random = rng((0xc0ffee + Math.imul(run + 1, 0x9e3779b1)) >>> 0);
  const owned = new Set(starterIds);
  let repeats = 0;
  let foilClaims = 0;
  for (let pack = 1; pack <= maxPacks; pack += 1) {
    const cards = drawPack(random, owned);
    let packRepeats = 0;
    for (const id of cards) {
      if (owned.has(id)) {
        repeats += 1;
        packRepeats += 1;
      }
      owned.add(id);
    }
    if (pack <= packDuplicateFrequency.length) {
      const row = packDuplicateFrequency[pack - 1];
      row.packs += 1;
      row.anyRepeat += Number(packRepeats > 0);
      row.repeats += packRepeats;
    }
    while (foilClaims < Math.floor(repeats / 10)) {
      foilClaims += 1;
      if (foilClaims === 1) firstFoil.push(pack);
      if (foilClaims === 10) tenthFoil.push(pack);
    }
    if (owned.size === eligible.length) {
      completions.push(pack);
      duplicateAtCompletion.push(repeats);
      break;
    }
  }
}

const selectedPacks = [1, 5, 10, 15, 20, 30, 50];
const output = {
  model: { runs, seed: '0xC0FFEE + run*0x9E3779B1', eligibleIdentities: eligible.length, starterIdentities: starterIds.size },
  completionPacks: {
    p10: percentile(completions, .10), median: percentile(completions, .50), p90: percentile(completions, .90),
    mean: Number((completions.reduce((a, b) => a + b, 0) / completions.length).toFixed(2)),
  },
  repeatsAtCompletion: {
    p10: percentile(duplicateAtCompletion, .10), median: percentile(duplicateAtCompletion, .50), p90: percentile(duplicateAtCompletion, .90),
    mean: Number((duplicateAtCompletion.reduce((a, b) => a + b, 0) / duplicateAtCompletion.length).toFixed(2)),
  },
  duplicateFrequencyByPack: Object.fromEntries(selectedPacks.map((pack) => {
    const row = packDuplicateFrequency[pack - 1];
    return [pack, { anyRepeatPercent: Number((100 * row.anyRepeat / row.packs).toFixed(1)), meanRepeats: Number((row.repeats / row.packs).toFixed(2)) }];
  })),
  tenRepeatFoilCadencePacks: {
    first: { p10: percentile(firstFoil, .10), median: percentile(firstFoil, .50), p90: percentile(firstFoil, .90) },
    tenth: { p10: percentile(tenthFoil, .10), median: percentile(tenthFoil, .50), p90: percentile(tenthFoil, .90) },
  },
  invariants: {
    noSelection: 'repeat credits bank unchanged; no claim is created',
    selectedGoal: 'each 10 credits permits one explicit finish claim for an eligible owned target',
    goalChange: 'selection changes only target metadata; credits and owned copy counts are unchanged',
    carryover: 'claim debits exactly 10 credits; surplus remains available',
  },
};

console.log(JSON.stringify(output, null, 2));
