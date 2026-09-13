#!/usr/bin/env node

import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { readFileSync } from "node:fs";

const runtimeFile = resolve(process.argv[2] ?? "artifacts/mote-wagering-2026-09-06/v4/mote-machine-v4.riv");
const requireFromRive = createRequire(createRequire(import.meta.url).resolve("@rive-app/react-webgl2/package.json"));
const runtimePath = requireFromRive.resolve("@rive-app/webgl2/rive.js");
const rive = createRequire(runtimePath)(runtimePath);
const buffer = readFileSync(runtimeFile);
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
rive.RuntimeLoader.setWasmFallbackUrl(null);
rive.RuntimeLoader.setWasmBinary(ab(readFileSync(join(dirname(runtimePath), "rive.wasm"))));
const riveFile = new rive.RiveFile({ buffer: ab(buffer), assetLoader: () => true });
await riveFile.init();
const file = riveFile.getInstance();

function session() {
  const artboard = file.artboardByName("MOTE MACHINE");
  const definition = artboard?.stateMachineByName("MoteMachine");
  const viewModel = file.defaultArtboardViewModel(artboard)?.defaultInstance();
  if (!artboard || !definition || !viewModel) throw new Error("V4 artboard, state machine, or default View Model is missing");
  const machine = new riveFile.runtime.StateMachineInstance(definition, artboard);
  machine.bindViewModelInstance(viewModel); machine.bind();
  const trace = []; let total = 0;
  const step = (seconds) => {
    let advanced = 0;
    while (advanced < seconds) {
      const delta = Math.min(1 / 60, seconds - advanced); machine.advanceAndApply(delta); advanced += delta; total += delta;
      for (let i = 0; i < machine.stateChangedCount(); i += 1) trace.push({ name: machine.stateChangedNameByIndex(i), at: total });
    }
  };
  machine.advanceAndApply(0);
  return { artboard, machine, viewModel, trace, step, now: () => total };
}

const failures = [];
const symbols = ["Clover", "Mote", "Acorn", "Rosie Crest"];
const cases = [
  { outcome: 1, stops: [0, 1, 2], result: "Outcome Loss" },
  { outcome: 2, stops: [0, 0, 0], result: "Outcome Stake Returned" },
  { outcome: 3, stops: [1, 1, 1], result: "Outcome Small" },
  { outcome: 4, stops: [2, 3, 0], result: "Outcome Medium", unlock: true },
  { outcome: 5, stops: [2, 2, 2], result: "Outcome Big" },
  { outcome: 6, stops: [3, 3, 3], result: "Outcome Jackpot" },
];
const rewardAnimation = (outcome, stake) => {
  if (outcome === 1) return "Wager Reward None";
  if (outcome === 2) return `Wager Reward Motes ${stake}`;
  if (outcome === 3) return `Wager Reward Motes ${Math.min(5, stake * 2)}`;
  if (outcome === 4) return "Wager Reward Motes 3";
  if (outcome === 5) return stake === 1 ? "Wager Reward Motes 3 Acorn 1" : stake === 3 ? "Wager Reward Motes 5 Acorns 3" : "Wager Reward Motes 5 Acorns 5";
  return "Wager Reward Motes 5 Acorns 5";
};
for (const reduced of [false, true]) for (const stake of [1, 3, 5]) for (const { outcome, stops, result, unlock = false } of cases) {
  const s = session();
  s.viewModel.boolean("reduceMotion").value = reduced;
  s.viewModel.trigger("enter").trigger(); s.step(0.9);
  s.viewModel.number("mode").value = 1;
  s.viewModel.number("phase").value = 2; s.step(0.05);
  s.viewModel.number("stakeMotes").value = stake;
  s.viewModel.number("outcomeCode").value = outcome;
  s.viewModel.number("leftStop").value = stops[0];
  s.viewModel.number("centerStop").value = stops[1];
  s.viewModel.number("rightStop").value = stops[2];
  s.viewModel.boolean("newlyUnlocked").value = unlock;
  s.viewModel.number("phase").value = 3;
  s.step(0.1);
  if (s.trace.some(({ name }) => name.startsWith("Deposit"))) failures.push(`stake ${stake} deposited before spin`);
  s.viewModel.trigger("spin").trigger(); s.step(8);
  if (reduced) {
    const depositAt = s.trace.find(({ name }) => name === "Low Motion Deposit")?.at;
    const resultAt = s.trace.find(({ name }) => name === "Low Motion Result")?.at;
    const holdAt = s.trace.find(({ name }) => name === "Result Hold")?.at;
    if (depositAt == null || resultAt == null || holdAt == null || holdAt - depositAt > .49) failures.push(`reduced stake ${stake} outcome ${outcome} was not held by 490ms`);
    if (s.trace.some(({ name }) => name === result || name === "First Unlock" || name.startsWith("Stop Left ·"))) failures.push(`reduced stake ${stake} outcome ${outcome} entered a full award route`);
    const reward = rewardAnimation(outcome, stake);
    if (!s.trace.some(({ name }) => name === reward)) failures.push(`reduced stake ${stake} outcome ${outcome} missed held resource ${reward}`);
    if (s.trace.some(({ name }) => name === "Wager Reward Delay" || name.startsWith("Parallel Deposit ") || name.startsWith("Full Motion ")))
      failures.push(`reduced stake ${stake} outcome ${outcome} entered a delayed/full-motion side layer`);
    s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
    continue;
  }
  const expectedStates = [
    `Deposit ${stake}`, "Lever Pull", "Reel Accelerate", "Reel Cruise",
    `Stop Left · ${symbols[stops[0]]}`,
    `Stop Center · ${symbols[stops[1]]}`,
    `Stop Right · ${symbols[stops[2]]}`,
    result, "Result Hold",
  ];
  for (const expected of expectedStates)
    if (!s.trace.some(({ name }) => name === expected)) failures.push(`stake ${stake} outcome ${outcome} missed ${expected}: ${s.trace.map(({ name }) => name).join(" > ")}`);
  const reward = rewardAnimation(outcome, stake);
  const rewardCount = s.trace.filter(({ name }) => name === reward).length;
  if (rewardCount < (outcome === 1 ? 2 : 1)) failures.push(`stake ${stake} outcome ${outcome} missed ${reward}`);
  if (unlock && !s.trace.some(({ name }) => name === "First Unlock")) failures.push(`${result} did not reach First Unlock`);
  const spinAt = s.trace.find(({ name }) => name === `Deposit ${stake}`)?.at;
  const expectedOffsets = { "Lever Pull": .12, "Reel Accelerate": .52, "Reel Cruise": .92, [`Stop Left · ${symbols[stops[0]]}`]: 2.7, [`Stop Center · ${symbols[stops[1]]}`]: 2.94, [`Stop Right · ${symbols[stops[2]]}`]: 3.18, [result]: 3.7 };
  for (const [name, offset] of Object.entries(expectedOffsets)) {
    const at = s.trace.find((entry) => entry.name === name)?.at;
    if (spinAt == null || at == null || Math.abs((at - spinAt) - offset) > .035) failures.push(`${name} timing drift: expected ${offset.toFixed(2)}s after deposit, got ${at == null || spinAt == null ? "missing" : (at-spinAt).toFixed(3)}`);
  }
  s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
}

for (const reduced of [false, true]) {
  const expected = reduced ? "Machine Settle" : "Machine Spin";
  // State-change events expose the played animation name, rather than the editor state's caption.
  const legacy = new Map([[3, ["Legacy Resource Small", 4.4]], [5, ["Legacy Resource Medium", 4.5]], [10, ["Legacy Resource Big", 4.7]], [25, ["Legacy Resource Jackpot", 5.1]]]);
  for (const selector of [3, 5, 10, 25]) {
    const s = session();
    s.viewModel.number("mode").value = 0;
    s.viewModel.boolean("reduceMotion").value = reduced;
    s.viewModel.number("tickles").value = selector;
    s.viewModel.trigger("spin").trigger(); s.step(6);
    const machineAt = s.trace.find(({ name }) => name === expected)?.at;
    const [overlay, readable] = legacy.get(selector);
    const overlayAt = s.trace.find(({ name }) => name === overlay)?.at;
    const holdAt = s.trace.find(({ name, at }) => name === "Result Hold" && machineAt != null && at - machineAt >= readable - .05)?.at;
    const overlayCount = s.trace.filter(({ name }) => name === overlay).length;
    if (reduced) {
      const quickHold = s.trace.find(({ name }) => name === "Result Hold")?.at;
      if (machineAt == null || quickHold == null || quickHold - machineAt > .49) failures.push(`Reveal reduced selector ${selector} was not readable by 490ms`);
      if (overlayCount !== 0) failures.push(`Reveal reduced selector ${selector} played award-flight ${overlay}`);
    } else {
      if (machineAt == null || overlayCount !== 1 || holdAt == null) failures.push(`Reveal full selector ${selector} did not play ${overlay} exactly once and hold`);
      if (overlayAt != null && machineAt != null && Math.abs((overlayAt - machineAt) - 3.7) > .05) failures.push(`${overlay} start drift: ${(overlayAt-machineAt).toFixed(3)}s`);
      if (holdAt != null && machineAt != null && Math.abs((holdAt - machineAt) - readable) > .05) failures.push(`${overlay} readable deadline drift: ${(holdAt-machineAt).toFixed(3)}s`);
    }
    if (s.trace.some(({ name }) => name.startsWith("Deposit ") || name.startsWith("Stop Left ·"))) failures.push(`Reveal ${reduced ? "reduced" : "full"} entered a Wager-only route`);
    s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
  }
}

// A replayed receipt uses the quiet recovery lane and remains quiet after all
// normal-play side-layer deadlines have elapsed.
for (const reduced of [false, true]) {
  const s = session();
  s.viewModel.number("mode").value = 1;
  s.viewModel.boolean("reduceMotion").value = reduced;
  s.viewModel.number("stakeMotes").value = 3;
  s.viewModel.number("outcomeCode").value = 5;
  s.viewModel.number("leftStop").value = 2;
  s.viewModel.number("centerStop").value = 2;
  s.viewModel.number("rightStop").value = 2;
  s.viewModel.number("phase").value = 5; s.step(.05);
  s.viewModel.boolean("replayedReceipt").value = true;
  s.viewModel.number("phase").value = 3;
  s.viewModel.trigger("spin").trigger(); s.step(4.2);
  const replayAt = s.trace.find(({ name }) => name === "Receipt Replay")?.at;
  const holdAt = s.trace.find(({ name, at }) => name === "Result Hold" && replayAt != null && at >= replayAt)?.at;
  if (replayAt == null || holdAt == null || holdAt - replayAt > .65 + 1 / 60) failures.push(`replay ${reduced ? "reduced" : "full"} did not settle within 650ms`);
  for (const expected of [
    "Low Motion Set Left · Acorn",
    "Low Motion Set Center · Acorn",
    "Low Motion Set Right · Acorn",
    "Wager Reward Motes 5 Acorns 3",
  ]) if (!s.trace.some(({ name }) => name === expected))
    failures.push(`replay ${reduced ? "reduced" : "full"} missed receipt resource ${expected}`);
  const forbiddenReplayState = s.trace.find(({ name }) =>
    name.startsWith("Deposit ") || name.startsWith("Outcome ") ||
    name.startsWith("Parallel Deposit ") || name.startsWith("Full Motion ") ||
    name.startsWith("Full Left Stop ") || name.startsWith("Full Center Stop ") ||
    name.startsWith("Full Right Stop ") || name === "Wager Reward Delay");
  if (forbiddenReplayState) failures.push(`replay ${reduced ? "reduced" : "full"} entered normal-play side layer ${forbiddenReplayState.name}`);
  s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
}

// Reset must interrupt every full-motion side layer. No pre-reset reward may
// arrive later, and a second receipt must enter each mechanical layer cleanly.
for (const interruptAt of [.2, 1.2, 2.8, 3.5]) {
  const s = session();
  s.viewModel.number("mode").value = 1;
  s.viewModel.boolean("reduceMotion").value = false;
  s.viewModel.boolean("replayedReceipt").value = false;
  s.viewModel.trigger("enter").trigger(); s.step(.9);
  s.viewModel.number("phase").value = 2; s.step(.05);
  s.viewModel.number("stakeMotes").value = 1;
  s.viewModel.number("outcomeCode").value = 6;
  s.viewModel.number("leftStop").value = 3;
  s.viewModel.number("centerStop").value = 3;
  s.viewModel.number("rightStop").value = 3;
  s.viewModel.number("phase").value = 3;
  s.viewModel.trigger("spin").trigger(); s.step(interruptAt);
  s.viewModel.number("phase").value = 0;
  s.viewModel.trigger("reset").trigger(); s.step(.25);
  const resetAt = s.now();
  s.step(3.8);
  const staleAfterReset = s.trace.find(({ name, at }) => at > resetAt &&
    (name === "Wager Reward Motes 5 Acorns 5" || name === "Full Left Stop · Rosie Crest" ||
      name === "Full Center Stop · Rosie Crest" || name === "Full Right Stop · Rosie Crest"));
  if (staleAfterReset) failures.push(`reset at ${interruptAt.toFixed(1)}s leaked stale ${staleAfterReset.name}`);

  const secondStart = s.now();
  s.viewModel.number("phase").value = 2; s.step(.05);
  s.viewModel.number("outcomeCode").value = 3;
  s.viewModel.number("leftStop").value = 1;
  s.viewModel.number("centerStop").value = 1;
  s.viewModel.number("rightStop").value = 1;
  s.viewModel.number("phase").value = 3;
  s.viewModel.trigger("spin").trigger(); s.step(7);
  const secondNames = s.trace.filter(({ at }) => at > secondStart).map(({ name }) => name);
  for (const expected of ["Parallel Deposit 1", "Full Motion Left Delay", "Full Motion Center Delay", "Full Motion Right Delay", "Wager Reward Motes 2", "Outcome Small"])
    if (!secondNames.includes(expected)) failures.push(`reset at ${interruptAt.toFixed(1)}s left second receipt unable to enter ${expected}`);
  s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
}

// Reset must clear Hold and permit an independent second receipt in the same instance.
{
  const s = session();
  s.viewModel.number("mode").value = 1; s.viewModel.number("stakeMotes").value = 3;
  s.viewModel.trigger("enter").trigger(); s.step(.9);
  for (const outcome of [3, 5]) {
    s.viewModel.number("phase").value = 2; s.step(.05);
    s.viewModel.number("outcomeCode").value = outcome;
    s.viewModel.number("leftStop").value = outcome === 3 ? 1 : 2;
    s.viewModel.number("centerStop").value = outcome === 3 ? 1 : 2;
    s.viewModel.number("rightStop").value = outcome === 3 ? 1 : 2;
    s.viewModel.number("phase").value = 3; s.viewModel.trigger("spin").trigger(); s.step(7);
    s.viewModel.number("phase").value = 0; s.viewModel.trigger("reset").trigger(); s.step(.25);
  }
  if (s.trace.filter(({ name }) => name === "Deposit 3").length !== 2 || !s.trace.some(({ name }) => name === "Outcome Small") || !s.trace.some(({ name }) => name === "Outcome Big")) failures.push("reset/repeated-play did not execute two independent receipts");
  s.machine.delete(); s.artboard.delete(); s.viewModel.delete();
}

riveFile.cleanup();
if (failures.length) {
  console.error("Mote Machine V4 runtime behavior FAILED:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log("Mote Machine V4 runtime behavior passed: 36 Wager rows (6 outcomes × 3 stakes × full/reduced), 8 Reveal rows (4 selectors × full/reduced), 2 quiet replay lanes through all side-layer deadlines, four mid-play reset points, and reset/repeated-play; full motion verifies canonical stop-state routing and frozen phase timing, reduced motion verifies exact held resource states and quiet hold deadlines. Rendered motion, symbol positions and visibility require separate pixel acceptance.");
