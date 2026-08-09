#!/usr/bin/env node
import {
	POLICIES,
	deriveRepeatHealth,
	resetWithPolicy,
	updateChoice,
} from "./repeatRewardPrototypeModel.mjs";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const reset = "\x1b[0m";

let state = resetWithPolicy("discovery");

function itemLine(name, amount, note = "") {
	return `${bold}${name.padEnd(16)}${reset} ${String(amount).padStart(3)} ${dim}${note}${reset}`;
}

function frame() {
	const policy = POLICIES[state.policy];
	const health = deriveRepeatHealth(state);
	return [
		`${bold}PROTOTYPE — Familiar-route reward loop${reset}`,
		`${dim}Question: what deterministic repeat reward stays useful to the next farm → Bag → Adventure cycle?${reset}`,
		"",
		`${bold}${policy.name}${reset} · ${policy.detail}`,
		`Route: ${state.route === "glowroot" ? "A Glow Beneath the Hedge" : "Lights Past the Open Gate"}`,
		`Cycle: ${state.cycles} · Crop: ${state.crop === "clover" ? "Clover" : "Moonberries"} · Tool: ${state.tool === "trowel" ? "Hand Trowel" : "Lantern"} · Carrier: ${state.carrier === "wicker" ? "Wicker Basket" : "Cloth Wrap"}`,
		"",
		`${bold}Farm stock${reset}`,
		itemLine("Clover Seed", state.stock.cloverSeed, `${health.plantableCloverCycles} Clover cycles ready`),
		itemLine("Clover Lunch", state.stock.cloverLunch, "Provision"),
		itemLine("Moonberries", state.stock.moonberries, "rooted crop + Provision"),
		itemLine("Glowroot Seed", state.stock.glowrootSeed, state.stock.glowrootSeed > 0 ? "NO USE after Glowroot is planted" : "resolved Discovery"),
		itemLine("Compost", state.stock.compost, `${health.boostableCycles} boosts ready`),
		itemLine("Willow Fiber", state.stock.willowFiber, "Cloth Wrap lining"),
		"",
		`${bold}Loop health${reset} ${health.canRepeat ? "✓" : "✗"} ${health.reason}`,
		`${bold}Dead stock${reset} ${health.deadDiscoveryStock} Glowroot Seed`,
		"",
		`${bold}Last complete cycle${reset}`,
		...(state.lastReceipt.length ? state.lastReceipt.map((line) => `  ${line}`) : [`  ${dim}Run a cycle to compare exact stock movement.${reset}`]),
		"",
		`${bold}[1]${reset} Keep Discovery  ${bold}[2]${reset} Bring Next Seed  ${bold}[3]${reset} Bring Farm Boost`,
		`${bold}[r]${reset} run cycle  ${bold}[c]${reset} crop  ${bold}[t]${reset} tool  ${bold}[p]${reset} carrier  ${bold}[o]${reset} route  ${bold}[q]${reset} quit`,
	].join("\n");
}

function render() {
	process.stdout.write("\x1b[2J\x1b[H" + frame());
}

if (!process.stdin.isTTY) {
	process.stdout.write(frame() + "\n");
	process.exit(0);
}

process.stdin.setRawMode(true);
process.stdin.setEncoding("utf8");
process.stdin.resume();
render();
process.stdin.on("data", (key) => {
	if (key === "q" || key === "\u0003") {
		process.stdin.setRawMode(false);
		process.stdout.write("\n");
		process.exit(0);
	}
	state = updateChoice(state, key);
	render();
});
