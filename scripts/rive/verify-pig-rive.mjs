#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const manifestPath = resolve(
	root,
	"assets/rive/prototype/rig-manifest.json",
);
const binaryPath = resolve(root, "assets/rive/pig.riv");
const texturesDir = resolve(root, "assets/rive/prototype/textures");
const assetsOnly = process.argv.includes("--assets-only");
const pigIds = ["rosie", "copper", "pepper", "bandit", "pickles", "biscuit"];
const requiredRiveNames = [
	"pig",
	"pig_skin",
	"idle",
	"jump",
	"wave",
	"skin",
	"rest",
	"equip_hat",
	"equip_face",
	"equip_held",
];

function fail(message) {
	console.error(`Rive verification failed: ${message}`);
	process.exit(1);
}

function run(command, args) {
	try {
		return execFileSync(command, args, {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (error) {
		const detail =
			error && typeof error === "object" && "stderr" in error
				? String(error.stderr).trim()
				: String(error);
		fail(`${command} ${args.join(" ")} failed: ${detail}`);
	}
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.artboard?.name !== "pig") {
	fail(`Expected artboard "pig", received ${manifest.artboard?.name ?? "none"}`);
}
if (manifest.editorPrototypeStatus?.stateMachine?.name !== "pig") {
	fail(
		`Expected state machine "pig", received ${
			manifest.editorPrototypeStatus?.stateMachine?.name ?? "none"
		}`,
	);
}
if (manifest.source?.referencedAsset !== "pig_skin") {
	fail(
		`Expected referenced asset "pig_skin", received ${
			manifest.source?.referencedAsset ?? "none"
		}`,
	);
}

for (const [index, pigId] of pigIds.entries()) {
	const skin = manifest.skins?.[pigId];
	if (skin?.index !== index) {
		fail(`Manifest skin index for ${pigId} must be ${index}`);
	}
	if (skin?.texture !== `textures/${pigId}.png`) {
		fail(`Manifest texture path for ${pigId} is incorrect`);
	}
}

const rosieTexture = resolve(texturesDir, "rosie.png");
for (const pigId of pigIds) {
	const texture = resolve(texturesDir, `${pigId}.png`);
	const dimensions = run("magick", ["identify", "-format", "%wx%h", texture]);
	if (dimensions !== "370x383") {
		fail(`${pigId} texture is ${dimensions}; expected 370x383`);
	}

	const alphaDifference = run("magick", [
		"(",
		rosieTexture,
		"-alpha",
		"extract",
		")",
		"(",
		texture,
		"-alpha",
		"extract",
		")",
		"-metric",
		"AE",
		"-compare",
		"-format",
		"%[distortion]",
		"info:",
	]);
	if (alphaDifference !== "0" && alphaDifference !== "0 (0)") {
		fail(`${pigId} alpha differs from Rosie by ${alphaDifference} pixels`);
	}
}

console.log("Rive textures: six 370x383 skins with one identical alpha field");

if (assetsOnly) {
	console.log("Rive binary: skipped (--assets-only)");
	process.exit(0);
}

if (!existsSync(binaryPath)) {
	fail(
		"assets/rive/pig.riv is missing. Export the authored prototype before running the full gate.",
	);
}

const binary = readFileSync(binaryPath);
if (statSync(binaryPath).size < 1_000) {
	fail("assets/rive/pig.riv is unexpectedly small");
}
if (binary.subarray(0, 4).toString("ascii") !== "RIVE") {
	fail("assets/rive/pig.riv does not have a RIVE binary header");
}

const printableStrings = binary
	.toString("latin1")
	.match(/[ -~]{3,}/g)
	?.join("\n") ?? "";
for (const name of requiredRiveNames) {
	if (!printableStrings.includes(name)) {
		fail(`assets/rive/pig.riv is missing required authored name "${name}"`);
	}
}

console.log(
	`Rive binary: header and ${requiredRiveNames.length} authored contract names verified`,
);
console.log(
	"Static gate passed. Simulator/device motion and attachment validation is still required.",
);
