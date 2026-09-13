#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { repairMoteMachineTransitions } from "./repair-mote-machine-transitions.mjs";

const root = resolve(import.meta.dirname, "../..");
const acceptedRiv = resolve(
  root,
  "artifacts/mote-machine/mote-machine-polish-final-source.riv",
);
const acceptedRev = resolve(
  root,
  "artifacts/mote-machine/mote-machine-polish-v7-source.rev",
);
const editorRev = resolve(root, "assets/rive/mote-machine.rev");
const retiredRev = resolve(
  root,
  "assets/rive/backups/mote-machine-alchemy-retired-2026-08-29.rev",
);
const runtimeCopies = [
  resolve(root, "assets/rive/mote-machine.riv"),
  resolve(root, "ios/ttp/mote_machine.riv"),
  resolve(root, "android/app/src/main/res/raw/mote_machine.riv"),
];

function replaceEqualLength(buffer, beforeText, afterText) {
  const before = Buffer.from(beforeText, "utf8");
  const after = Buffer.from(afterText, "utf8");
  if (before.length !== after.length) {
    throw new Error(`Rive label replacement must preserve bytes: ${beforeText}`);
  }
  let offset = 0;
  let count = 0;
  while ((offset = buffer.indexOf(before, offset)) !== -1) {
    after.copy(buffer, offset);
    offset += after.length;
    count += 1;
  }
  if (count === 0) throw new Error(`Missing Rive label: ${beforeText}`);
}

let runtime = Buffer.from(readFileSync(acceptedRiv));
replaceEqualLength(runtime, "BONUS TICKLES", "ACORN CHARGES");
replaceEqualLength(runtime, "BONUS +0 TICKLES", "0 ACORN CHARGES ");
runtime = repairMoteMachineTransitions(runtime);

for (const output of runtimeCopies) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, runtime);
}

if (!existsSync(retiredRev) && existsSync(editorRev)) {
  copyFileSync(editorRev, retiredRev);
}
copyFileSync(acceptedRev, editorRev);

console.log(
  `Restored three-reel Mote Machine (${runtime.length} bytes) and editable .rev source.`,
);
