#!/usr/bin/env node
import {
	POLICIES,
	ROUTES,
	canRunCycle,
	comparePolicies,
	reset,
	routeDifference,
	updateChoice,
} from "./routeRewardPrototypeModel.mjs";

const bold = "\x1b[1m";
const dim = "\x1b[2m";
const resetStyle = "\x1b[0m";

let state = reset("shared");

function itemLine(name, amount, note = "") {
	return `${bold}${name.padEnd(15)}${resetStyle} ${String(amount).padStart(3)} ${dim}${note}${resetStyle}`;
}

function frame() {
	const policy = POLICIES[state.policy];
	const route = ROUTES[state.route];
	const health = canRunCycle(state);
	return [
		`${bold}PROTOTYPE — Familiar routes should feel different${resetStyle}`,
		`${dim}Question: which predictable route reward makes Rosie's map a useful choice without breaking the next Seed?${resetStyle}`,
		"",
		`${bold}${policy.name}${resetStyle} · ${policy.detail}`,
		`Route: ${route.name} · ${route.clue}`,
		`Cycle: ${state.cycles} · Tool: ${state.tool === "trowel" ? "Hand Trowel" : "Lantern"} · Carrier: ${state.carrier === "wicker" ? "Wicker Basket" : "Cloth Wrap"} · Compost: ${state.useCompost ? "use" : "save"}`,
		"",
		`${bold}Farm stock${resetStyle}`,
		itemLine("Clover Seed", state.stock.cloverSeed, "guaranteed next cycle"),
		itemLine("Clover Lunch", state.stock.cloverLunch, "Provision stockpile"),
		itemLine("Compost", state.stock.compost, "crop boost"),
		itemLine("Willow Fiber", state.stock.willowFiber, "Cloth Wrap lining"),
		"",
		`${bold}Route decision${resetStyle} ${routeDifference(state.policy) ? "✓ distinct consequence" : "✗ prose only"}`,
		`${bold}Loop health${resetStyle} ${health.ok ? "✓" : "✗"} ${health.reason}`,
		"",
		`${bold}Last complete cycle${resetStyle}`,
		...(state.lastReceipt.length ? state.lastReceipt.map((line) => `  ${line}`) : [`  ${dim}Run a cycle to compare exact stock movement.${resetStyle}`]),
		"",
		`${bold}[1]${resetStyle} Shared  ${bold}[2]${resetStyle} Add bonus  ${bold}[3]${resetStyle} Distinct materials`,
		`${bold}[r]${resetStyle} run  ${bold}[o]${resetStyle} route  ${bold}[t]${resetStyle} tool  ${bold}[p]${resetStyle} carrier  ${bold}[c]${resetStyle} Compost  ${bold}[q]${resetStyle} quit`,
	].join("\n");
}

function comparison() {
	const rows = comparePolicies().map(({ policy, glowroot, lanternleaf, alternating }) => {
		const label = POLICIES[policy].name.padEnd(28);
		const stocks = [glowroot, lanternleaf, alternating].map(({ stock }) =>
			`Seed ${stock.cloverSeed} · Compost ${stock.compost} · Fiber ${stock.willowFiber}`,
		);
		return `${label} | Hedge×2: ${stocks[0]} | Gate×2: ${stocks[1]} | Alternate: ${stocks[2]}`;
	});
	return [
		"PROTOTYPE — Familiar-route material comparison",
		"Two boosted Clover / Trowel / Wicker cycles from Seed 2 · Compost 2 · Fiber 2",
		"",
		...rows,
		"",
		"Verdict: Distinct Existing Materials.",
		"A familiar hedge visit guarantees Clover Seed +1 and finds Compost +1 from soft soil.",
		"A familiar open-gate visit guarantees Clover Seed +1 and gathers Willow Fiber +2 from reflected leaves.",
		"Tool and Carrier bonuses stay separate and freely chosen.",
	].join("\n");
}

function render() {
	process.stdout.write("\x1b[2J\x1b[H" + frame());
}

if (!process.stdin.isTTY) {
	process.stdout.write(comparison() + "\n");
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
