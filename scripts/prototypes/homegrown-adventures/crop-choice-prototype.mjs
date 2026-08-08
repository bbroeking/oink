#!/usr/bin/env node
// PROTOTYPE — throwaway TUI over the pure crop-choice model.

import readline from "node:readline";
import { createCropChoiceState, cropChoiceReducer, describeCropChoices, POLICIES } from "./crop-choice-model.mjs";

const scripted = process.argv.slice(2);
let state = createCropChoiceState("detour");

function frame(clear = true) {
	if (clear && process.stdout.isTTY) console.clear();
	console.log("\x1b[1mHOMEGROWN CROP-CHOICE PROTOTYPE\x1b[0m");
	console.log(`\x1b[2mQuestion: which model makes Choose a Seed genuinely authored without losing today's purpose?\x1b[0m\n`);
	console.log(`\x1b[1mPolicy\x1b[0m        ${state.policy} — ${POLICIES[state.policy]}`);
	console.log(`\x1b[1mStep\x1b[0m          ${state.step}`);
	console.log(`\x1b[1mPurpose\x1b[0m       ${state.purpose}`);
	console.log(`\x1b[1mPurpose ready\x1b[0m ${state.purposeReady}`);
	console.log(`\x1b[1mSelected\x1b[0m      ${state.selected.join(" + ") || "none"}`);
	console.log(`\x1b[1mCompost\x1b[0m       ${state.compost ? "yes" : "no"}`);
	console.log(`\x1b[1mStock\x1b[0m         ${JSON.stringify(state.stock)}`);
	console.log(`\x1b[1mResult\x1b[0m        ${state.lastResult}\n`);
	for (const line of describeCropChoices(state)) console.log(`  • ${line}`);
	console.log("\n\x1b[1m[1]\x1b[0m equivalent  \x1b[1m[2]\x1b[0m detour  \x1b[1m[3]\x1b[0m parallel  \x1b[1m[c]\x1b[0m Clover  \x1b[1m[m]\x1b[0m Moonberry");
	console.log("\x1b[1m[p]\x1b[0m Compost  \x1b[1m[g]\x1b[0m grow/advance  \x1b[1m[h]\x1b[0m harvest  \x1b[1m[r]\x1b[0m reset  \x1b[1m[q]\x1b[0m quit");
}

function dispatchKey(key) {
	const actions = {
		"1": { type: "policy", policy: "equivalent" },
		"2": { type: "policy", policy: "detour" },
		"3": { type: "policy", policy: "parallel" },
		c: { type: "choose", crop: "clover" },
		m: { type: "choose", crop: "moonberry" },
		p: { type: "compost" },
		g: { type: "grow" },
		h: { type: "harvest" },
		r: { type: "reset" },
	};
	if (actions[key]) state = cropChoiceReducer(state, actions[key]);
}

if (scripted.length) {
	frame(false);
	for (const key of scripted) {
		dispatchKey(key);
		console.log(`\n\x1b[2m> ${key}\x1b[0m`);
		frame(false);
	}
	process.exit(0);
}

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);
frame();
process.stdin.on("keypress", (_input, key) => {
	if (key.name === "q" || (key.ctrl && key.name === "c")) process.exit(0);
	dispatchKey(key.sequence);
	frame();
});
