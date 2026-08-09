export const ROUTES = Object.freeze({
	glowroot: Object.freeze({
		name: "A Glow Beneath the Hedge",
		clue: "Soft soil",
	}),
	lanternleaf: Object.freeze({
		name: "Lights Past the Open Gate",
		clue: "Reflected leaves",
	}),
});

export const POLICIES = Object.freeze({
	shared: Object.freeze({
		name: "Shared Materials",
		detail: "Both routes keep returning two Willow Fiber.",
		rewards: Object.freeze({
			glowroot: Object.freeze({ willowFiber: 2 }),
			lanternleaf: Object.freeze({ willowFiber: 2 }),
		}),
	}),
	additive: Object.freeze({
		name: "Add a Route Bonus",
		detail: "Keep the shared Fiber and add one route-flavored unit.",
		rewards: Object.freeze({
			glowroot: Object.freeze({ compost: 1, willowFiber: 2 }),
			lanternleaf: Object.freeze({ willowFiber: 3 }),
		}),
	}),
	distinct: Object.freeze({
		name: "Distinct Existing Materials",
		detail: "Warm roots return Compost; reflected leaves return Willow Fiber.",
		rewards: Object.freeze({
			glowroot: Object.freeze({ compost: 1 }),
			lanternleaf: Object.freeze({ willowFiber: 2 }),
		}),
	}),
});

export const INITIAL_STATE = Object.freeze({
	policy: "shared",
	route: "glowroot",
	tool: "trowel",
	carrier: "wicker",
	useCompost: true,
	cycles: 0,
	stock: Object.freeze({
		cloverSeed: 2,
		cloverLunch: 0,
		compost: 2,
		willowFiber: 2,
	}),
	lastReceipt: Object.freeze([]),
});

const ITEM_NAMES = Object.freeze({
	cloverSeed: "Clover Seed",
	cloverLunch: "Clover Lunch",
	compost: "Compost",
	willowFiber: "Willow Fiber",
});

function add(stock, item, amount, receipt, cause) {
	stock[item] += amount;
	receipt.push(`${ITEM_NAMES[item]} ${amount > 0 ? "+" : ""}${amount} · ${cause}`);
}

export function reset(policy = "shared", route = "glowroot") {
	return {
		...INITIAL_STATE,
		policy,
		route,
		stock: { ...INITIAL_STATE.stock },
		lastReceipt: [],
	};
}

export function canRunCycle(state) {
	if (state.stock.cloverSeed < 1) {
		return { ok: false, reason: "No Clover Seed remains for the next Provision crop." };
	}
	if (state.useCompost && state.stock.compost < 1) {
		return { ok: false, reason: "No Compost remains for the chosen predictable boost." };
	}
	if (state.carrier === "cloth" && state.stock.willowFiber < 1) {
		return { ok: false, reason: "No Willow Fiber remains to line the Cloth Wrap." };
	}
	return { ok: true, reason: "Rosie can farm, pack, and revisit the chosen route." };
}

export function runCycle(state) {
	const allowed = canRunCycle(state);
	if (!allowed.ok) return { ...state, lastReceipt: [allowed.reason] };

	const stock = { ...state.stock };
	const receipt = [];
	add(stock, "cloverSeed", -1, receipt, "plant Clover");
	if (state.useCompost) add(stock, "compost", -1, receipt, "predictable crop boost");
	add(stock, "cloverLunch", state.useCompost ? 5 : 4, receipt, "clean Harvest Rhythm");
	add(stock, "cloverLunch", -1, receipt, "packed Provision");
	if (state.carrier === "cloth") add(stock, "willowFiber", -1, receipt, "line Cloth Wrap");

	add(stock, "cloverSeed", 1, receipt, "familiar route · next Seed");
	const routeReward = POLICIES[state.policy].rewards[state.route];
	for (const [item, amount] of Object.entries(routeReward)) {
		add(stock, item, amount, receipt, `${ROUTES[state.route].clue} route material`);
	}
	if (state.tool === "trowel") {
		add(stock, "cloverSeed", 1, receipt, "Hand Trowel");
	} else {
		add(stock, "willowFiber", 1, receipt, "Lantern");
	}
	if (state.carrier === "wicker") {
		add(stock, "compost", 1, receipt, "Wicker Basket");
	} else {
		add(stock, "cloverSeed", 1, receipt, "Cloth Wrap");
	}

	return {
		...state,
		cycles: state.cycles + 1,
		stock,
		lastReceipt: receipt,
	};
}

export function runRoutes(policy, routes, overrides = {}) {
	let state = { ...reset(policy, routes[0]), ...overrides };
	state.stock = { ...INITIAL_STATE.stock, ...(overrides.stock ?? {}) };
	for (const route of routes) state = runCycle({ ...state, route });
	return state;
}

export function comparePolicies() {
	return Object.keys(POLICIES).map((policy) => {
		const glowroot = runRoutes(policy, ["glowroot", "glowroot"]);
		const lanternleaf = runRoutes(policy, ["lanternleaf", "lanternleaf"]);
		const alternating = runRoutes(policy, ["glowroot", "lanternleaf"]);
		return { policy, glowroot, lanternleaf, alternating };
	});
}

export function routeDifference(policy) {
	const glowroot = POLICIES[policy].rewards.glowroot;
	const lanternleaf = POLICIES[policy].rewards.lanternleaf;
	return JSON.stringify(glowroot) !== JSON.stringify(lanternleaf);
}

export function updateChoice(state, key) {
	switch (key) {
		case "1": return reset("shared", state.route);
		case "2": return reset("additive", state.route);
		case "3": return reset("distinct", state.route);
		case "r": return runCycle(state);
		case "o": return { ...state, route: state.route === "glowroot" ? "lanternleaf" : "glowroot" };
		case "t": return { ...state, tool: state.tool === "trowel" ? "lantern" : "trowel" };
		case "p": return { ...state, carrier: state.carrier === "wicker" ? "cloth" : "wicker" };
		case "c": return { ...state, useCompost: !state.useCompost };
		default: return state;
	}
}
