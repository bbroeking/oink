#!/usr/bin/env node

/**
 * Reproduce the 2026-09-05 editor transition repair on the exact prior export.
 * Rive's download action was unavailable in the connected browser. The source
 * graph was corrected in file 2506441 first; this applies the same transition and visibility edits.
 *
 * Schema: rive-app/rive-runtime at 77804e8, generated animation/data-bind defs.
 * The whole-file hash and every byte range must match. Art, masks, keyframes,
 * listeners, result selectors, and reduced-motion conditions remain identical.
 * Retired-layer opacity tracks and premature Mote/reward reappearance are zeroed.
 * A new editor export must be verified normally, never patched by loose search.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BEFORE =
  "9e728bb2d468873480eabfccbaf458834e92b06f5216055f44a2c1324a9e5e9c";
const AFTER =
  "ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

function uint(value) {
  const bytes = [];
  while (value > 127) {
    bytes.push((value & 127) | 128);
    value >>>= 7;
  }
  return Buffer.from([...bytes, value]);
}
function object(type, properties = []) {
  return Buffer.concat([
    uint(type),
    ...properties.flatMap(([key, value]) => [
      uint(key),
      ...(Buffer.isBuffer(value) ? [uint(value.length), value] : [uint(value)]),
    ]),
    uint(0),
  ]);
}

// BindablePropertyBoolean -> Trigger; DataBindContext target 634 -> 686,
// VM path [0, presenting=0] -> [0, spin=9]; Boolean comparator -> Trigger.
const condition = (trigger) =>
  Buffer.concat([
    object(trigger ? 503 : 472),
    object(447, [
      [586, trigger ? 686 : 634],
      [588, Buffer.from([0, trigger ? 9 : 0])],
    ]),
    object(479),
    object(trigger ? 505 : 481, trigger ? [] : [[647, 1]]),
  ]);

export function repairMoteMachineTransitions(source) {
  const sourceHash = hash(source);
  if (sourceHash === AFTER) return source;
  if (sourceHash !== BEFORE)
    throw new Error("Unrecognized Mote Machine export; refusing to patch it.");
  const edits = [
    ...[2726209, 2726265, 2726355, 2726414].map((offset) => ({
      offset,
      before: condition(false),
      after: condition(true),
    })),
    { offset: 2726452, before: uint(28), after: uint(467) },
    { offset: 2726468, before: uint(258), after: uint(4300) },
  ];
  const visibilityEdits = JSON.parse(
    readFileSync(
      new URL("./mote-machine-visibility-repair.json", import.meta.url),
      "utf8",
    ),
  );
  edits.push(
    ...visibilityEdits.map(({ offset, before, after }) => ({
      offset,
      before: Buffer.from(before, "hex"),
      after: Buffer.from(after, "hex"),
    })),
  );
  edits.sort((a, b) => a.offset - b.offset);
  let cursor = 0;
  const chunks = [];
  for (const { offset, before, after } of edits) {
    if (!source.subarray(offset, offset + before.length).equals(before))
      throw new Error(`Unexpected transition at ${offset}.`);
    chunks.push(source.subarray(cursor, offset), after);
    cursor = offset + before.length;
  }
  const repaired = Buffer.concat([...chunks, source.subarray(cursor)]);
  if (hash(repaired) !== AFTER)
    throw new Error("Repaired file hash did not match the verified candidate.");
  return repaired;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const root = resolve(import.meta.dirname, "../..");
  const repaired = repairMoteMachineTransitions(
    readFileSync(resolve(root, "assets/rive/mote-machine.riv")),
  );
  for (const path of [
    "assets/rive/mote-machine.riv",
    "ios/ttp/mote_machine.riv",
    "android/app/src/main/res/raw/mote_machine.riv",
  ]) {
    writeFileSync(resolve(root, path), repaired);
  }
  console.log(
    `Repaired and synchronized Mote Machine: ${hash(repaired)} (${repaired.length} bytes).`,
  );
}
