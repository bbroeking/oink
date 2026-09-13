#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const output = resolve(root, "artifacts/mote-wagering-2026-09-06/v4/captures");
mkdirSync(output, { recursive: true });
const rows = [];
for (const mode of ["reveal", "wager"]) for (const stake of mode === "reveal" ? [1] : [1, 3, 5]) {
  for (const outcome of mode === "reveal" ? ["legacy-small", "legacy-medium", "legacy-big", "legacy-jackpot"] : ["loss", "returned-stake", "small", "medium", "big", "jackpot"]) {
    const stops = mode === "reveal" ? null : {
      "returned-stake": [0, 0, 0], small: [1, 1, 1], big: [2, 2, 2], jackpot: [3, 3, 3],
      medium: [2, 3, 0], loss: [0, 1, 2],
    }[outcome];
    for (const motion of ["full", "reduced"]) rows.push({ mode, stake, outcome, stops, motion, status: "pending-runtime-capture" });
  }
}
writeFileSync(resolve(output, "capture-matrix.json"), `${JSON.stringify({ presentationVersion: "mote-animation-v4", rows }, null, 2)}\n`);
console.log(`Wrote ${rows.length} capture rows to ${output}`);
