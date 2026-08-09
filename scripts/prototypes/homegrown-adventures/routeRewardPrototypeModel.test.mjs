import assert from "node:assert/strict";
import test from "node:test";

import {
	POLICIES,
	routeDifference,
	runRoutes,
} from "./routeRewardPrototypeModel.mjs";

test("the shipped shared-material rule leaves route receipts identical", () => {
	assert.equal(routeDifference("shared"), false);
	assert.deepEqual(POLICIES.shared.rewards.glowroot, POLICIES.shared.rewards.lanternleaf);
});

test("the additive rule distinguishes routes by inflating both established bundles", () => {
	const glowroot = runRoutes("additive", ["glowroot"]);
	const lanternleaf = runRoutes("additive", ["lanternleaf"]);
	assert.equal(routeDifference("additive"), true);
	assert.equal(glowroot.stock.compost, 3);
	assert.equal(glowroot.stock.willowFiber, 4);
	assert.equal(lanternleaf.stock.compost, 2);
	assert.equal(lanternleaf.stock.willowFiber, 5);
});

test("distinct materials preserve the next Seed and give each familiar place one job", () => {
	const glowroot = runRoutes("distinct", ["glowroot"]);
	const lanternleaf = runRoutes("distinct", ["lanternleaf"]);
	assert.equal(glowroot.stock.cloverSeed, 3);
	assert.equal(lanternleaf.stock.cloverSeed, 3);
	assert.equal(glowroot.stock.compost, 3);
	assert.equal(glowroot.stock.willowFiber, 2);
	assert.equal(lanternleaf.stock.compost, 2);
	assert.equal(lanternleaf.stock.willowFiber, 4);
});

test("Tool and Carrier jobs remain freely composable with either route", () => {
	const hedge = runRoutes("distinct", ["glowroot"], {
		tool: "lantern",
		carrier: "cloth",
		useCompost: false,
	});
	const gate = runRoutes("distinct", ["lanternleaf"], {
		tool: "lantern",
		carrier: "cloth",
		useCompost: false,
	});
	assert.equal(hedge.stock.cloverSeed, 3);
	assert.equal(hedge.stock.compost, 3);
	assert.equal(hedge.stock.willowFiber, 2);
	assert.equal(gate.stock.cloverSeed, 3);
	assert.equal(gate.stock.compost, 2);
	assert.equal(gate.stock.willowFiber, 4);
});
