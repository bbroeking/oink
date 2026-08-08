#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const inputPath = resolve(
	process.argv[2] ??
		resolve(
			root,
			"assets/rive/homegrown-adventures/source/lanternleaf-reflections-editor-export.riv",
		),
);
const outputPath = resolve(
	process.argv[3] ??
		resolve(root, "assets/rive/homegrown-adventures/lanternleaf-reflections.riv"),
);

const source = readFileSync(inputPath);

function occurrences(buffer, value) {
	const needle = Buffer.from(value, "utf8");
	const matches = [];
	let cursor = 0;

	while (cursor < buffer.length) {
		const index = buffer.indexOf(needle, cursor);
		if (index === -1) break;
		if (index > 0 && buffer[index - 1] === needle.length) matches.push(index);
		cursor = index + needle.length;
	}

	return matches;
}

function replaceSingle(from, to) {
	const matches = occurrences(source, from);
	if (matches.length !== 1) {
		throw new Error(
			`Expected one length-prefixed occurrence of ${JSON.stringify(from)}, found ${matches.length}`,
		);
	}

	const replacement = Buffer.from(to, "utf8");
	if (replacement.length >= 128) {
		throw new Error(`Replacement is too long for the one-byte Rive string length: ${to}`);
	}

	const valueStart = matches[0];
	return Buffer.concat([
		source.subarray(0, valueStart - 1),
		Buffer.from([replacement.length]),
		replacement,
		source.subarray(valueStart + Buffer.byteLength(from, "utf8")),
	]);
}

const output = replaceSingle("Timeline 1", "Lanternleaf Reflection Pulse");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, output);

console.log("Patched the authored Lanternleaf reflection timeline name.");
console.log(`Source: ${inputPath}`);
console.log(`Output: ${outputPath}`);
