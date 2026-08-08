#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assetDirectory = resolve(root, "assets/rive/homegrown-adventures");
const manifestPath = resolve(assetDirectory, "lanternleaf-contract.json");
const binaryPath = resolve(assetDirectory, "lanternleaf-reflections.riv");

function fail(message) {
	console.error(`Lanternleaf Rive verification failed: ${message}`);
	process.exit(1);
}

if (!existsSync(manifestPath)) fail("lanternleaf-contract.json is missing");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.artboard?.width !== 390 || manifest.artboard?.height !== 844) {
	fail("the reflection artboard must be 390x844");
}
if (!existsSync(binaryPath)) fail("lanternleaf-reflections.riv is missing");
if (statSync(binaryPath).size < 500) fail("lanternleaf-reflections.riv is unexpectedly small");

const binary = readFileSync(binaryPath);
if (binary.subarray(0, 4).toString("ascii") !== "RIVE") {
	fail("lanternleaf-reflections.riv does not have a RIVE binary header");
}

const printableStrings = binary
	.toString("latin1")
	.match(/[ -~]{3,}/g)
	?.join("\n") ?? "";

for (const name of [manifest.artboard?.name, manifest.animation]) {
	if (typeof name !== "string" || name.length === 0) {
		fail("lanternleaf-contract.json contains an empty authored name");
	}
	if (!printableStrings.includes(name)) {
		fail(`lanternleaf-reflections.riv is missing authored name ${JSON.stringify(name)}`);
	}
}

console.log(
	"Lanternleaf Rive static gate passed: 390x844 header plus authored artboard and reflection timeline verified.",
);
