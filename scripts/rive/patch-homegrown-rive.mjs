#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const inputPath = resolve(
	process.argv[2] ??
		resolve(
			root,
			"assets/rive/homegrown-adventures/source/homegrown-adventures-editor-export.riv",
		),
);
const outputPath = resolve(
	process.argv[3] ??
		resolve(root, "assets/rive/homegrown-adventures/homegrown-adventures.riv"),
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

const edits = [];

function replaceOccurrence(from, occurrence, to, expectedCount) {
	const matches = occurrences(source, from);
	if (matches.length !== expectedCount) {
		throw new Error(
			`Expected ${expectedCount} length-prefixed occurrence(s) of ${JSON.stringify(from)}, found ${matches.length}`,
		);
	}
	if (occurrence < 0 || occurrence >= matches.length) {
		throw new Error(`Occurrence ${occurrence} is out of range for ${JSON.stringify(from)}`);
	}

	const replacement = Buffer.from(to, "utf8");
	if (replacement.length >= 128) {
		throw new Error(`Replacement is too long for the one-byte Rive string length used here: ${to}`);
	}

	const valueStart = matches[occurrence];
	edits.push({
		start: valueStart - 1,
		end: valueStart + Buffer.byteLength(from, "utf8"),
		bytes: Buffer.concat([Buffer.from([replacement.length]), replacement]),
		label: `${from}[${occurrence}] -> ${to}`,
	});
}

replaceOccurrence("ViewModel1", 0, "Homegrown Adventures View Model", 1);
replaceOccurrence("Instance", 0, "Browser Prototype", 1);

// Rive serializes custom enums by internal id, from 0 through 4. The editor
// shows them in reverse order. The bound property ids prove this mapping:
// bed three, bed two, bed one, Rosie action, Rosie mood.
for (const [index, name] of [
	[0, "bedThreeState"],
	[1, "bedTwoState"],
	[2, "bedOneState"],
	[3, "rosieAction"],
	[4, "rosieMood"],
]) {
	replaceOccurrence("Enum1", index, name, 5);
}

for (const [index, name] of [
	[0, "rosieMood"],
	[1, "rosieAction"],
	[2, "bedOneState"],
	[3, "bedTwoState"],
	[4, "bedThreeState"],
]) {
	replaceOccurrence("enumProperty", index, name, 5);
}

for (const [index, name] of [
	[0, "tickle"],
	[1, "harvest"],
	[2, "pack"],
	[3, "return"],
	[4, "plant"],
]) {
	replaceOccurrence("triggerProperty", index, name, 5);
}

for (const [index, name] of [
	[0, "satchelEquipped"],
	[1, "hedgehogVisible"],
	[2, "frogVisible"],
	[3, "mothsVisible"],
	[4, "hedgeCrossingOpen"],
	[5, "hedgeBellEarned"],
	[6, "reduceMotion"],
]) {
	replaceOccurrence("booleanProperty", index, name, 7);
}

replaceOccurrence("pig", 0, "Homegrown Adventures State Machine", 1);

// The foreground idle, jump, and later wave clips have each received their
// browser-stage pass. The remaining duplicate names belong to the recovered
// legacy rig and stay available only as editor history.
replaceOccurrence("idle", 1, "Rosie Breathing Idle", 3);
replaceOccurrence("jump", 1, "Rosie Tickle", 3);
replaceOccurrence("wave", 1, "Rosie Notice", 3);

for (const [from, name] of [
	["Timeline 4", "Clover Bed Empty"],
	["Timeline 5", "Clover Bed Growing"],
	["Timeline 6", "Clover Bed Ready"],
	["Timeline 7", "Clover Plant"],
	["Timeline 8", "Clover Ready Flourish"],
	["Timeline 9", "Clover Harvest"],
	["Timeline 10", "Home Consequence Hidden"],
	["Timeline 11", "Home Consequence Developed"],
	["Timeline 12", "Glowroot Home Flourish"],
]) {
	replaceOccurrence(from, 0, name, 1);
}

edits.sort((a, b) => a.start - b.start);
for (let index = 1; index < edits.length; index += 1) {
	if (edits[index - 1].end > edits[index].start) {
		throw new Error(`Overlapping Rive metadata edits: ${edits[index - 1].label} and ${edits[index].label}`);
	}
}

const chunks = [];
let cursor = 0;
for (const edit of edits) {
	chunks.push(source.subarray(cursor, edit.start), edit.bytes);
	cursor = edit.end;
}
chunks.push(source.subarray(cursor));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.concat(chunks));

console.log(`Patched ${edits.length} authored Rive names.`);
console.log(`Source: ${inputPath}`);
console.log(`Output: ${outputPath}`);
