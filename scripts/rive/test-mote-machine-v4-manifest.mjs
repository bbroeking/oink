#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "artifacts/mote-wagering-2026-09-06/v4/mote-machine-v4-manifest.json"), "utf8"));
assert.equal(manifest.presentationVersion, "mote-animation-v4");
assert.deepEqual(manifest.mechanicalScheduleMs.stopRegisters, { left: 3000, center: 3240, right: 3600 });
assert.equal(manifest.mechanicalScheduleMs.finalSettle, 3700);
assert.deepEqual(manifest.wagerStops.returned_stake, [0, 0, 0]);
assert.deepEqual(manifest.wagerStops.small, [1, 1, 1]);
assert.deepEqual(manifest.wagerStops.big, [2, 2, 2]);
assert.deepEqual(manifest.wagerStops.jackpot, [3, 3, 3]);
assert.deepEqual(manifest.revealSelectors, [3, 5, 10, 25]);
assert.deepEqual(manifest.bindings.numbers.slice(-7), ["mode", "stakeMotes", "outcomeCode", "leftStop", "centerStop", "rightStop", "phase"]);
assert.deepEqual(manifest.bindings.triggers.slice(-2), ["reset", "enter"]);
for (const stake of [1, 3, 5]) assert.ok(manifest.clips[`Deposit ${stake}`]);
for (const name of ["Stop Left", "Stop Center", "Stop Right", "Receipt Replay", "Recovery Pending", "Recoverable Error", "Low Motion Entry", "Low Motion Deposit", "Low Motion Result", "Next Play Reset"]) assert.ok(manifest.clips[name], name);
for (const [name, clip] of Object.entries(manifest.clips)) {
  assert.ok(Number.isInteger(clip.durationMs) && clip.durationMs > 0, `${name} duration`);
}
console.log(`Mote Machine V4 manifest passed: ${Object.keys(manifest.clips).length} authored clips and frozen stop schedule.`);

