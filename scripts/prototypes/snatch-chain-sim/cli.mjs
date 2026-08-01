#!/usr/bin/env node
// PROTOTYPE — thin terminal shell around game.mjs. No persistence, no database.

import readline from "node:readline";
import { dispatch, initialState } from "./game.mjs";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";
let state = initialState();

function render() {
	console.clear();
	console.log(`${bold}SNATCH CHAIN — LOGIC PROTOTYPE${reset}`);
	console.log(`${dim}1 snout → 3× catches · 8h per response · memory only${reset}\n`);
	console.log(`${bold}Clock${reset}  hour ${state.now}`);
	console.log(`${bold}Last result${reset}  ${state.message}\n`);

	console.log(`${bold}Pigs${reset}`);
	for (const pig of state.players) {
		const flags = [pig.hidden && "hidden", pig.test && "test"].filter(Boolean).join(", ");
		console.log(`  ${pig.id.padEnd(5)} ${pig.name.padEnd(10)} ${String(pig.balance).padStart(4)} snouts${flags ? `  ${dim}${flags}${reset}` : ""}`);
	}

	console.log(`\n${bold}Chains${reset}`);
	if (state.chains.length === 0) console.log(`  ${dim}none${reset}`);
	for (const chain of state.chains) {
		const status =
			chain.status === "active"
				? `ACTIVE · ${chain.nextActor} can catch ${chain.lastActor} for ${chain.nextAmount} · deadline h${chain.deadline}`
				: `${chain.status.toUpperCase()} · ${chain.resolution}`;
		console.log(`  ${chain.id}  ${status}`);
		console.log(
			`      ${dim}${chain.history.map((hit) => `${hit.from}→${hit.to} ${hit.amount}${hit.bust ? " BUST" : ""}`).join(" | ")}${reset}`,
		);
	}

	console.log(`\n${bold}Recent starts${reset}`);
	const recentStarts = state.starts.filter((row) => row.at > state.now - 168);
	console.log(
		recentStarts.length
			? `  ${recentStarts.map((row) => `${row.attacker}→${row.target}@h${row.at}`).join("  ")}`
			: `  ${dim}none${reset}`,
	);
	console.log(`  ${dim}blocked pairs: ${state.blockedPairs.map((pair) => pair.join("↔")).join(", ") || "none"}${reset}`);

	console.log(`\n${bold}Commands${reset}`);
	console.log("  steal <attacker> <target>   catch <chain>");
	console.log("  wait <hours>                balance <pig> <snouts>");
	console.log("  block <pig> <pig>           reset   quit");
	console.log(`\n${dim}Try: steal you ada  →  catch h1  →  catch h1  →  wait 8${reset}`);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function prompt() {
	render();
	rl.question("\n> ", (line) => {
		if (["q", "quit", "exit"].includes(line.trim().toLowerCase())) {
			rl.close();
			return;
		}
		state = dispatch(state, line);
		prompt();
	});
}

rl.on("close", () => {
	console.log("\nPrototype closed. Nothing was persisted.");
});
prompt();

