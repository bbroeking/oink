#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const stage = resolve(root, "artifacts/mote-wagering-2026-09-06/v4");
const manifest = JSON.parse(readFileSync(resolve(stage, "mote-machine-v4-manifest.json"), "utf8"));
const runtimePath = process.argv[2] ? resolve(process.argv[2]) : resolve(stage, manifest.source.runtime);
const baseline = manifest.source.baselineRuntimeSha256;

function fail(message) {
  console.error(`Mote Machine V4 verification failed: ${message}`);
  process.exit(1);
}

let binary;
try { binary = readFileSync(runtimePath); }
catch { fail(`staged runtime is missing: ${runtimePath}`); }
if (binary.subarray(0, 4).toString("ascii") !== "RIVE") fail("runtime has no RIVE header");
if (statSync(runtimePath).size < 1024) fail("runtime is unexpectedly small");
if (statSync(runtimePath).size > 6 * 1024 * 1024) fail("runtime exceeds the 6 MB hard limit in spec 23a");

const digest = createHash("sha256").update(binary).digest("hex");
if (digest === baseline) fail("runtime is still the accepted V3 binary");
const requireFromRive = createRequire(createRequire(import.meta.url).resolve("@rive-app/react-webgl2/package.json"));
const runtimeModulePath = requireFromRive.resolve("@rive-app/webgl2/rive.js");
const rive = createRequire(runtimeModulePath)(runtimeModulePath);
const arrayBuffer = (value) => value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
rive.RuntimeLoader.setWasmFallbackUrl(null);
rive.RuntimeLoader.setWasmBinary(arrayBuffer(readFileSync(join(dirname(runtimeModulePath), "rive.wasm"))));
const riveFile = new rive.RiveFile({ buffer: arrayBuffer(binary), assetLoader: () => true });
try { await riveFile.init(); } catch (error) { fail(`runtime import failed: ${error.message}`); }
const file = riveFile.getInstance();
const artboard = file.artboardByName(manifest.artboard);
if (!artboard) fail(`missing public artboard "${manifest.artboard}"`);
if (!artboard.stateMachineByName(manifest.stateMachine)) fail(`missing public state machine "${manifest.stateMachine}"`);
const viewModel = file.viewModelByName(manifest.viewModel);
if (!viewModel) fail(`missing public View Model "${manifest.viewModel}"`);
if (!viewModel.getInstanceNames().includes(manifest.instance)) fail(`missing public View Model instance "${manifest.instance}"`);

const animations = new Set(Array.from({ length: artboard.animationCount() }, (_, index) => artboard.animationByIndex(index).name));
const animationNames = [
  ...Object.keys(manifest.clips),
  ...Object.values(manifest.canonicalStopClips ?? {}).flat(),
  ...(manifest.parallelMechanicalLayers?.depositTimelines ?? []),
  ...Object.values(manifest.parallelMechanicalLayers?.delayTimelines ?? {}),
];
for (const name of new Set(animationNames)) if (!animations.has(name)) fail(`missing authored animation "${name}"`);

const properties = new Map(viewModel.getProperties().map(({ name, type }) => [name, type]));
for (const [group, expectedType] of [["numbers", "number"], ["booleans", "boolean"], ["triggers", "trigger"], ["strings", "string"]]) {
  for (const name of manifest.bindings[group]) if (properties.get(name) !== expectedType) fail(`missing public ${expectedType} binding "${name}"`);
}

// Editor layer and scene-object names are authoring provenance. Rive export optimization
// does not guarantee that they remain as plaintext or expose them through the runtime API.
const searchable = binary.toString("latin1");
for (const forbidden of [/alchemy/i, /warmth/i, /whirl/i, /resonance/i, /frame-[0-9]+/i]) {
  if (forbidden.test(searchable)) fail(`contains forbidden reference ${forbidden}`);
}
console.log(`Mote Machine V4 staged runtime: ${new Set(animationNames).size} animations, ${properties.size} public bindings, ${binary.length} bytes, sha256 ${digest}`);
artboard.delete(); file.unref(); riveFile.cleanup();
