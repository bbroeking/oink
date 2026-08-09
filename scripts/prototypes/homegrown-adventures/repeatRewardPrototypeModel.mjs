export const POLICIES = Object.freeze({
	discovery: Object.freeze({
		name: "Keep the Discovery",
		detail: "Every familiar route still returns Glowroot Seed.",
		baseItem: "glowrootSeed",
		toolItem: "glowrootSeed",
	}),
	replant: Object.freeze({
		name: "Bring the Next Seed",
		detail: "A familiar route returns Clover Seed for the next Provision crop.",
		baseItem: "cloverSeed",
		toolItem: "cloverSeed",
	}),
	boost: Object.freeze({
		name: "Bring a Farm Boost",
		detail: "A familiar route returns Compost to improve the next crop.",
		baseItem: "compost",
		toolItem: "compost",
	}),
});

export const INITIAL_REPEAT_STATE = Object.freeze({
	policy: "discovery",
	route: "lanternleaf",
	crop: "clover",
	tool: "trowel",
	carrier: "wicker",
	cycles: 0,
	stock: Object.freeze({
		cloverSeed: 2,
		cloverLunch: 0,
		moonberries: 5,
		glowrootSeed: 0,
		compost: 2,
		willowFiber: 2,
	}),
	lastReceipt: Object.freeze([]),
});

const ITEM_NAMES = Object.freeze({
	cloverSeed: "Clover Seed",
	cloverLunch: "Clover Lunch",
	moonberries: "Moonberries",
	glowrootSeed: "Glowroot Seed",
	compost: "Compost",
	willowFiber: "Willow Fiber",
});

function add(stock, item, amount, receipt, cause) {
	stock[item] += amount;
	receipt.push(`${ITEM_NAMES[item]} ${amount > 0 ? "+" : ""}${amount} · ${cause}`);
}

export function canRunCycle(state) {
	if (state.crop === "clover" && state.stock.cloverSeed < 1) {
		return { ok: false, reason: "No Clover Seed remains to grow the next Provision." };
	}
	if (state.carrier === "cloth" && state.stock.willowFiber < 1) {
		return { ok: false, reason: "No Willow Fiber remains to line the Cloth Wrap." };
	}
	return { ok: true, reason: "Rosie can farm, pack, and revisit the route." };
}

export function runRepeatCycle(state) {
	const allowed = canRunCycle(state);
	if (!allowed.ok) return { ...state, lastReceipt: [allowed.reason] };
	const stock = { ...state.stock };
	const receipt = [];

	if (state.crop === "clover") {
		add(stock, "cloverSeed", -1, receipt, "plant Clover");
		add(stock, "cloverLunch", 5, receipt, "boosted clean harvest");
		add(stock, "cloverLunch", -1, receipt, "packed Provision");
	} else {
		add(stock, "moonberries", 6, receipt, "boosted clean harvest");
		add(stock, "moonberries", -1, receipt, "packed Provision");
	}

	if (state.carrier === "cloth") {
		add(stock, "willowFiber", -1, receipt, "line Cloth Wrap");
	}

	const policy = POLICIES[state.policy];
	add(stock, policy.baseItem, 1, receipt, "familiar-route base return");
	add(stock, "willowFiber", 2, receipt, "familiar-route materials");

	if (state.tool === "trowel") {
		add(stock, policy.toolItem, 1, receipt, "Hand Trowel bonus");
	} else {
		add(stock, "willowFiber", 1, receipt, "Lantern bonus");
	}

	if (state.carrier === "wicker") {
		add(stock, "compost", 1, receipt, "Wicker Basket return");
	} else {
		add(stock, "cloverSeed", 1, receipt, "Cloth Wrap return");
	}

	return {
		...state,
		cycles: state.cycles + 1,
		stock,
		lastReceipt: receipt,
	};
}

export function resetWithPolicy(policy) {
	return {
		...INITIAL_REPEAT_STATE,
		policy,
		stock: { ...INITIAL_REPEAT_STATE.stock },
		lastReceipt: [],
	};
}

export function deriveRepeatHealth(state) {
	const next = canRunCycle(state);
	return {
		canRepeat: next.ok,
		reason: next.reason,
		deadDiscoveryStock: state.stock.glowrootSeed,
		plantableCloverCycles: state.stock.cloverSeed,
		boostableCycles: state.stock.compost,
	};
}

export function updateChoice(state, key) {
	switch (key) {
		case "1": return resetWithPolicy("discovery");
		case "2": return resetWithPolicy("replant");
		case "3": return resetWithPolicy("boost");
		case "r": return runRepeatCycle(state);
		case "c": return { ...state, crop: state.crop === "clover" ? "moonberries" : "clover" };
		case "t": return { ...state, tool: state.tool === "trowel" ? "lantern" : "trowel" };
		case "p": return { ...state, carrier: state.carrier === "wicker" ? "cloth" : "wicker" };
		case "o": return { ...state, route: state.route === "glowroot" ? "lanternleaf" : "glowroot" };
		default: return state;
	}
}
