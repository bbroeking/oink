#!/usr/bin/env node
// Runs the actual installed WASM engine. Pixels/attachment are a separate
// browser/device gate; a no-op image loader cannot prove visual fidelity.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "../..");
const path = process.argv[2] ? resolve(process.argv[2]) : join(root, "assets/rive/pig.riv");
const binary = readFileSync(path);
const webRequire = createRequire(require.resolve("@rive-app/react-webgl2/package.json"));
const runtimePath = webRequire.resolve("@rive-app/webgl2/rive.js");
const rive = webRequire(runtimePath);
const buffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
rive.RuntimeLoader.setWasmFallbackUrl(null);
rive.RuntimeLoader.setWasmBinary(buffer(readFileSync(join(dirname(runtimePath), "rive.wasm"))));
const file = new rive.RiveFile({ buffer: buffer(binary), assetLoader: () => true });
await file.init();
const runtime = file.runtime;
const artboard = file.getInstance().artboardByName("pig");
assert(artboard, 'Missing artboard "pig"');
const definition = artboard.stateMachineByName("pig");
assert(definition, 'Missing state machine "pig"');
const machine = new runtime.StateMachineInstance(definition, artboard);
const inputs = new Map(Array.from({ length: machine.inputCount() }, (_, i) => {
  const input = machine.input(i); return [input.name, input];
}));
const number = (name, value) => {
  assert(inputs.has(name), `Missing numeric input ${name}`);
  const input = inputs.get(name).asNumber();
  assert(input, `${name} must be a Number`);
  input.value = value;
};
const fire = (name) => {
  assert(inputs.has(name), `Missing reaction trigger ${name}`);
  const input = inputs.get(name).asTrigger();
  assert(input, `${name} must be a Trigger`);
  input.fire();
};
let completions = 0;
const trace = [];
const advance = (seconds) => {
  const states = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) {
    machine.advanceAndApply(1 / 60);
    for (let i = 0; i < machine.stateChangedCount(); i++) states.push(machine.stateChangedNameByIndex(i));
    for (let i = 0; i < machine.reportedEventCount(); i++) {
      if (machine.reportedEventAt(i)?.name === "reaction_complete") completions++;
    }
  }
  trace.push({ seconds, states, completions });
  return states;
};
try {
  for (const name of ["skin", "rest", "activity", "equip_hat", "equip_face", "equip_held"]) number(name, 0);
  advance(.1);
  for (const [rest, name] of [[1,"sad"], [2,"tired"], [3,"happy"], [0,"idle"]]) {
    number("rest", rest);
    assert(advance(.5).includes(name), `rest=${rest} never entered ${name}`);
  }
  for (const [activity, name] of [[1,"walk"], [2,"bounce"], [3,"wave"]]) {
    number("activity", activity);
    const before = completions;
    assert(advance(3).includes(name), `activity=${activity} never entered ${name}`);
    assert.equal(completions, before, `${name} loop incorrectly completed as a reaction`);
  }
  number("activity", 0); advance(.5);
  for (const kind of ["jump", "happy", "surprise", "wave"]) {
    const reactionState = kind === "happy" || kind === "wave" ? `${kind}_reaction` : kind;
    for (const [rest, name] of [[1,"sad"], [2,"tired"], [3,"happy"], [0,"idle"]]) {
      const before = completions;
      fire(kind);
      assert(advance(.15).includes(reactionState), `${kind} never entered ${reactionState}`);
      fire(kind);
      assert(advance(.15).includes(reactionState), `${kind} did not re-enter on the identical request`);
      assert.equal(completions, before, `${kind} completed the interrupted request`);
      number("rest", rest); // Updating mood must not cut or restart the reaction.
      const states = advance(2);
      assert.equal(completions, before + 1, `${kind} did not complete exactly once`);
      assert(states.includes(name), `${kind} did not return to the latest mood ${name}`);
    }
  }
  const beforeInterruption = completions;
  fire("jump"); advance(.15);
  fire("wave");
  assert(advance(.15).includes("wave_reaction"), "Wave failed to interrupt jump");
  number("rest", 2);
  assert(advance(2).includes("tired"), "Interrupted reaction did not return to tired");
  assert.equal(completions, beforeInterruption + 1, "Interrupted reactions emitted stale completions");
  // All six identities use this same artboard instance and graph. Visual coat
  // replacement still needs actual decoding/rendering in both platform adapters.
  for (let skin = 0; skin < 6; skin++) {
    number("skin", skin);
    for (let mask = 0; mask < 8; mask++) {
      number("equip_hat", mask & 1);
      number("equip_face", (mask >> 1) & 1);
      number("equip_held", (mask >> 2) & 1);
      advance(.1);
    }
  }
  console.log(JSON.stringify({ result: "pass", completions, trace }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ result: "fail", trace }, null, 2));
  throw error;
} finally {
  machine.delete(); artboard.delete(); file.cleanup();
}
