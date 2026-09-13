#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const binaryPath = resolve(root, "assets/rive/mote-machine.riv");
const platformCopies = [
  resolve(root, "ios/ttp/mote_machine.riv"),
  resolve(root, "android/app/src/main/res/raw/mote_machine.riv"),
];
const requiredContractNames = [
  "MOTE MACHINE",
  "MoteMachine",
  "MoteMachineViewModel",
  "Default",
  "Machine Spin",
  "Machine Settle",
  "requestPlay",
  "spin",
  "tickles",
  "motes",
  "reduceMotion",
  "presenting",
  "busy",
  "canPlay",
  "hasError",
  "motesLabel",
  "ticklesLabel",
  "actionLabel",
  "statusLabel",
];
// Rive's runtime exporter deliberately strips ordinary layout/object instance
// names. Asset, animation, state-machine layer, and listener names remain in the
// runtime and are therefore the authoritative binary-verifiable composition
// surface. The full object hierarchy is verified separately by the MCP readback
// recorded in the implementation log.
const requiredRuntimeCompositionNames = [
  "V3 Open Barn Background",
  "V3 Rosie Cabinet Shell",
  "V3 Mote Preview Runtime",
  "V3 Project Symbol Reel Strip",
  "V3 Clockwork Acorn Reward",
  "V3 Lever Shaft",
  "V3 Lever Knob",
  "V3 Lever Pivot",
  "V3 Lever Pull Sign",
  "Request play from lever",
  "Result Hold",
];
const requiredNames = [
  ...requiredContractNames,
  ...requiredRuntimeCompositionNames,
];
const forbiddenNames = [
  /frame-[0-9]+/i,
  /snout/i,
  /alchemy/i,
  /warmth/i,
  /whirl/i,
  /resonance/i,
  /requestWarmth/i,
  /requestWhirl/i,
  /requestResonance/i,
  /BONUS TICKLES/i,
];

const MAX_RUNTIME_BYTES = 6 * 1024 * 1024;

function fail(message) {
  console.error(`Mote Machine Rive verification failed: ${message}`);
  process.exit(1);
}

let binary;
try {
  binary = readFileSync(binaryPath);
} catch {
  fail(
    "assets/rive/mote-machine.riv is missing; export the paid editor file first",
  );
}

if (statSync(binaryPath).size < 1024)
  fail("runtime export is unexpectedly small");
if (statSync(binaryPath).size > MAX_RUNTIME_BYTES) {
  fail("runtime export exceeds the 6 MB embedded-asset budget");
}
if (binary.subarray(0, 4).toString("ascii") !== "RIVE") {
  fail("runtime export does not have a RIVE binary header");
}

const searchable = binary.toString("latin1");
for (const name of requiredNames) {
  if (!searchable.includes(name))
    fail(`runtime export is missing authored name "${name}"`);
}
for (const forbidden of forbiddenNames) {
  if (forbidden.test(searchable))
    fail(`runtime export contains forbidden reference ${forbidden}`);
}

const digest = createHash("sha256").update(binary).digest("hex");
for (const copyPath of platformCopies) {
  let copy;
  try {
    copy = readFileSync(copyPath);
  } catch {
    fail(`${copyPath.slice(root.length + 1)} is missing`);
  }
  const copyDigest = createHash("sha256").update(copy).digest("hex");
  if (copyDigest !== digest) {
    fail(
      `${copyPath.slice(root.length + 1)} does not match the accepted runtime export`,
    );
  }
}

console.log(
  `Mote Machine Rive contract: ${requiredNames.length} authored names verified; ` +
    `3 byte-identical runtime copies (${digest})`,
);
