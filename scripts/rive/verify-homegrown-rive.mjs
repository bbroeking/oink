#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const assetDirectory = resolve(root, "assets/rive/homegrown-adventures");
const manifestPath = resolve(assetDirectory, "contract.json");
const binaryPath = resolve(assetDirectory, "homegrown-adventures.riv");

function fail(message) {
	console.error(`Homegrown Adventures Rive verification failed: ${message}`);
	process.exit(1);
}

if (!existsSync(manifestPath)) fail("contract.json is missing");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.artboard?.width !== 390 || manifest.artboard?.height !== 844) {
	fail("the contract artboard must be 390x844");
}

const names = [...new Set([
	manifest.artboard?.name,
	manifest.stateMachine,
	...(manifest.animations ?? []),
	manifest.viewModel?.name,
	manifest.viewModel?.defaultInstance,
	...Object.keys(manifest.viewModel?.enums ?? {}),
	...Object.values(manifest.viewModel?.enums ?? {}).flat(),
	...(manifest.viewModel?.booleans ?? []),
	...(manifest.viewModel?.triggers ?? []),
])];

if (names.some((name) => typeof name !== "string" || name.length === 0)) {
	fail("contract.json contains an empty authored name");
}
if (!existsSync(binaryPath)) {
	fail(
		"homegrown-adventures.riv is missing. Export it from Rive using docs/rive-homegrown-adventures-authoring.md.",
	);
}

if (statSync(binaryPath).size < 10_000) {
	fail("homegrown-adventures.riv is unexpectedly small for the required scene");
}

const binary = readFileSync(binaryPath);
if (binary.subarray(0, 4).toString("ascii") !== "RIVE") {
	fail("homegrown-adventures.riv does not have a RIVE binary header");
}

const printableStrings = binary
	.toString("latin1")
	.match(/[ -~]{3,}/g)
	?.join("\n") ?? "";

for (const name of names) {
	if (!printableStrings.includes(name)) {
		fail(`homegrown-adventures.riv is missing authored contract name "${name}"`);
	}
}

console.log(
	`Homegrown Adventures Rive static gate passed: 390x844 header plus ${names.length} authored names verified.`,
);
console.log(
	"Manual mobile Safari motion, reduced-motion, silhouette, and attachment checks remain required.",
);

await import("./verify-lanternleaf-rive.mjs");
