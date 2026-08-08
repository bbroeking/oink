export const HOMEGROWN_STORAGE_KEY = "ttp.homegrown-adventures.v1";

export const STAGES = Object.freeze({
	STARTING: "starting",
	CLOVER_GROWING: "clover-growing",
	CLOVER_READY: "clover-ready",
	PACKED: "packed",
	ADVENTURE: "adventure",
	GLOWROOT_RETURNED: "glowroot-returned",
	NEAR_DISCOVERY: "near-discovery",
	DEVELOPED: "developed",
});

export const ACTIONS = Object.freeze({
	TICKLE: "tickle",
	SELECT_CROP: "select-crop",
	CHOOSE_PURPOSE: "choose-purpose",
	TOGGLE_COMPOST: "toggle-compost",
	PLANT_CLOVER: "plant-clover",
	ADVANCE_TIME: "advance-time",
	SETTLE: "settle",
	HARVEST_BEAT: "harvest-beat",
	HARVEST_CLOVER: "harvest-clover",
	OPEN_BAG_SELECTION: "open-bag-selection",
	SET_BAG_SLOT: "set-bag-slot",
	PACK_ADVENTURE: "pack-adventure",
	PACK_LIGHT: "pack-light",
	START_ADVENTURE: "start-adventure",
	CONTINUE_ADVENTURE_STORY: "continue-adventure-story",
	WELCOME_HOME: "welcome-home",
	ACKNOWLEDGE_RETURN: "acknowledge-return",
	PLANT_GLOWROOT: "plant-glowroot",
	RETRY_PREP: "retry-prep",
	PLANT_NEXT: "plant-next",
	START_NEW_DAY: "start-new-day",
	TOGGLE_REDUCED_MOTION: "toggle-reduced-motion",
	JUMP_TO_POSITION: "jump-to-position",
	JUMP_TO_STATE: "jump-to-state",
	RESET: "reset",
});

export const PROTOTYPE_POSITIONS = Object.freeze([
	{ id: 1, key: "morning", name: "Morning tickle" },
	{ id: 2, key: "seed-choice", name: "Choose a Seed" },
	{ id: 3, key: "planting", name: "Plant + Compost" },
	{ id: 4, key: "growing", name: "Growing" },
	{ id: 5, key: "harvest", name: "Harvest Rhythm" },
	{ id: 6, key: "farm-stock", name: "Farm stock" },
	{ id: 7, key: "bag-selection", name: "Choose the Bag" },
	{ id: 8, key: "departure", name: "Departure" },
	{ id: 9, key: "adventure", name: "Adventure vignette" },
	{ id: 10, key: "return", name: "Return + Discovery" },
	{ id: 11, key: "changed-home", name: "Glowroot at Home" },
]);

export const FIRST_ADVENTURE_OPPORTUNITY = Object.freeze({
	id: "glow-beneath-hedge",
	name: "A Glow Beneath the Hedge",
	detail: "Until dusk · soft soil · carry it Home",
	growDetail: "Grow a Provision to stay until dusk",
	plantingObjective: "Prepare for the hedge glow",
	growingObjective: "Clover for the dusk trail",
	harvestObjective: "Harvest for Rosie’s journey",
	packedDetail: "Packed for dusk · soft soil · safe carrying",
	prepareLabel: "Prepare for the glow",
	packLabel: "Pack the Dusk Picnic",
	departLabel: "Follow the glow",
	waitLabel: "Let dusk pass",
	waitingObjective: "Rosie is following the moths",
	discoveryName: "Glowroot Seed",
	clueName: "Glowroot Trail",
	clueEntry: "Glowroot trail (clue)",
	nearFieldGuideEntries: Object.freeze(["Dusk Picnic"]),
	fieldGuideEntries: Object.freeze(["Dusk Picnic", "Glowroot Seed"]),
});

export const SECOND_ADVENTURE_OPPORTUNITY = Object.freeze({
	id: "lights-past-open-gate",
	name: "Lights Past the Open Gate",
	detail: "Nightfall · reflected leaves · gentle wrap",
	growDetail: "Grow a Provision to stay until nightfall",
	plantingObjective: "Prepare for the gate lights",
	growingObjective: "Clover for the open-gate trail",
	harvestObjective: "Harvest for Rosie’s new route",
	packedDetail: "Packed for nightfall · reflections · safe wrap",
	prepareLabel: "Prepare for the gate lights",
	packLabel: "Pack for the gate lights",
	departLabel: "Follow the gate lights",
	waitLabel: "Let nightfall pass",
	waitingObjective: "Rosie is following reflected leaves",
	discoveryName: "Lanternleaf Path",
	clueName: "Lanternleaf Trail",
	clueEntry: "Lanternleaf trail (clue)",
	nearFieldGuideEntries: Object.freeze([]),
	fieldGuideEntries: Object.freeze(["Lanternleaf Path"]),
});

export function adventureOpportunity(state) {
	return state.daysCompleted > 0 && state.glowrootPlanted
		? SECOND_ADVENTURE_OPPORTUNITY
		: FIRST_ADVENTURE_OPPORTUNITY;
}

export const BAG_SLOT_ORDER = Object.freeze(["provision", "tool", "pack"]);

export const BAG_ITEMS = Object.freeze({
	provision: Object.freeze([
		Object.freeze({
			id: "clover-lunch",
			name: "Clover Lunch",
			icon: "☘",
			effect: "Stay exploring until dusk",
		}),
	]),
	tool: Object.freeze([
		Object.freeze({
			id: "hand-trowel",
			name: "Hand Trowel",
			icon: "♠",
			effect: "Uncover 1 extra Glowroot Seed",
		}),
		Object.freeze({
			id: "lantern",
			name: "Lantern",
			icon: "✦",
			effect: "Follow a trail to 1 extra Willow Fiber",
		}),
	]),
	pack: Object.freeze([
		Object.freeze({
			id: "wicker-basket",
			name: "Wicker Basket",
			icon: "⌒",
			effect: "Bring Home 1 Compost",
		}),
		Object.freeze({
			id: "cloth-wrap",
			name: "Cloth Wrap",
			icon: "◇",
			effect: "Protect 1 Clover Seed",
		}),
	]),
});

const PACKING_MATERIAL_COSTS = Object.freeze({
	"cloth-wrap": Object.freeze({
		itemId: "willow-fiber",
		name: "Willow Fiber",
		amount: 1,
	}),
});

const PACK_RETURN_REWARDS = Object.freeze({
	"wicker-basket": Object.freeze({
		itemId: "compost",
		name: "Compost",
		amount: 1,
	}),
	"cloth-wrap": Object.freeze({
		itemId: "clover-seed",
		name: "Clover Seed",
		amount: 1,
	}),
});

const TOOL_RETURN_BONUSES = Object.freeze({
	"hand-trowel": Object.freeze({
		itemId: "glowroot-seed",
		name: "Glowroot Seed",
		amount: 1,
	}),
	lantern: Object.freeze({
		itemId: "willow-fiber",
		name: "Willow Fiber",
		amount: 1,
	}),
});

export const DEFAULT_BAG = Object.freeze({
	provision: "clover-lunch",
	tool: "hand-trowel",
	pack: "wicker-basket",
});

export const EMPTY_FARM_STOCK = Object.freeze({
	"clover-seed": 0,
	"clover-lunch": 0,
	"glowroot-seed": 0,
	compost: 0,
	"willow-fiber": 0,
});

export const STARTING_FARM_STOCK = Object.freeze({
	...EMPTY_FARM_STOCK,
	"clover-seed": 3,
	compost: 2,
});

export const CROP_RULES = Object.freeze({
	clover: Object.freeze({
		seedId: "clover-seed",
		baseDurationMs: 4 * 60 * 60 * 1000,
		compostDurationMs: 2 * 60 * 60 * 1000,
		baseYield: 3,
		compostYieldBonus: 1,
	}),
});

export const HARVEST_PATTERN = Object.freeze(["left", "right", "up"]);
export const HARVEST_BEAT_MS = 900;

export function bagItem(slot, itemId) {
	return BAG_ITEMS[slot]?.find((item) => item.id === itemId) ?? null;
}

export function bagPackingCost(itemId) {
	return PACKING_MATERIAL_COSTS[itemId] ?? null;
}

export function bagReturnReward(itemId) {
	return PACK_RETURN_REWARDS[itemId] ?? null;
}

export function toolReturnBonus(itemId) {
	return TOOL_RETURN_BONUSES[itemId] ?? null;
}

export function adventureStory(state) {
	const bag = state.bag ?? DEFAULT_BAG;
	const missingSlot = BAG_SLOT_ORDER.find((slot) => bag[slot] == null) ?? null;
	const opportunity = adventureOpportunity(state);
	const followingLanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const firstDetails = {
		provision: {
			"clover-lunch": "stayed exploring until dusk",
			empty: "came Home before the seed opened",
		},
		tool: {
			"hand-trowel": "uncovered a second glowing Seed",
			lantern: "followed a trail to extra Willow Fiber",
			empty: "felt warmth beneath the soil",
		},
		pack: {
			"wicker-basket": "carried fresh Compost with the seed",
			"cloth-wrap": "protected one Clover Seed beside the glow",
			empty: "made a glowing leaf-print",
		},
	};
	const firstNearDiscoveryDetails = {
		provision: {
			provision: "came Home before the seed opened",
			tool: "traced where the warm root sleeps",
			pack: "kept the glowing leaf-print safe",
		},
		tool: {
			provision: "stayed exploring until dusk",
			tool: "could not uncover the warm root",
			pack: "carried a warm soil sample Home",
		},
		pack: {
			provision: "stayed exploring until dusk",
			tool: "uncovered the sleeping root",
			pack: "made a leaf-print and left the seed safe",
		},
	};
	const firstJourneyDetails = {
		provision: {
			"clover-lunch": "keeps Rosie exploring until dusk",
			empty: "daylight fades before the warm root opens",
		},
		tool: {
			"hand-trowel": "opens a careful way beneath the roots",
			lantern: "makes the fading glow easier to follow",
			empty: "leaves the warmth safely beneath the soil",
		},
		pack: {
			"wicker-basket": "waits ready for a sturdy find",
			"cloth-wrap": "protects anything delicate along the way",
			empty: "lets Rosie remember the place for later",
		},
	};
	const firstNearJourneyDetails = {
		provision: {
			provision: "daylight fades before the warm root opens",
			tool: "marks the soft soil for another visit",
			pack: "keeps a warm leaf-print safe",
		},
		tool: {
			provision: "keeps Rosie beside the hedge until dusk",
			tool: "the warmth stays hidden beneath tangled roots",
			pack: "keeps a warm soil sample safe",
		},
		pack: {
			provision: "keeps Rosie exploring until dusk",
			tool: "reveals the sleeping root without disturbing it",
			pack: "records the place so Rosie can return",
		},
	};
	const lanternleafDetails = {
		provision: {
			"clover-lunch": "stayed past the open gate until nightfall",
			empty: "came Home before the leaves reflected their light",
		},
		tool: {
			"hand-trowel": "found a spare Glowroot Seed beneath the path",
			lantern: "followed reflected leaves to extra Willow Fiber",
			empty: "saw the lights but could not trace their path",
		},
		pack: {
			"wicker-basket": "carried fresh Compost from the open trail",
			"cloth-wrap": "protected one Clover Seed among delicate leaves",
			empty: "mapped the trail and left its supplies safe",
		},
	};
	const lanternleafNearDiscoveryDetails = {
		provision: {
			provision: "came Home before the reflected leaves appeared",
			tool: "marked where the open-gate trail begins",
			pack: "kept one fallen Lanternleaf safe",
		},
		tool: {
			provision: "stayed beside the open gate until nightfall",
			tool: "could not trace which leaves reflected the glow",
			pack: "carried a fallen leaf Home for another try",
		},
		pack: {
			provision: "stayed beside the open gate until nightfall",
			tool: "followed the reflected leaves into a new path",
			pack: "mapped the route and left its supplies safe",
		},
	};
	const lanternleafJourneyDetails = {
		provision: {
			"clover-lunch": "keeps Rosie on the trail past nightfall",
			empty: "daylight fades before the leaves catch their light",
		},
		tool: {
			"hand-trowel": "checks what lies beneath the path",
			lantern: "makes the reflected leaves readable",
			empty: "leaves the shifting trail difficult to trace",
		},
		pack: {
			"wicker-basket": "waits ready for sturdy trail supplies",
			"cloth-wrap": "waits ready to protect delicate leaves",
			empty: "lets Rosie map the route for another visit",
		},
	};
	const lanternleafNearJourneyDetails = {
		provision: {
			provision: "daylight fades before the leaves catch their light",
			tool: "marks the start of the open-gate trail",
			pack: "keeps one fallen leaf safe",
		},
		tool: {
			provision: "keeps Rosie beside the gate until nightfall",
			tool: "the reflected trail remains hard to follow",
			pack: "keeps a fallen leaf safe for another try",
		},
		pack: {
			provision: "keeps Rosie on the trail until nightfall",
			tool: "follows the reflections deeper beyond the gate",
			pack: "records the route so Rosie can return",
		},
	};
	const details = followingLanternleaf ? lanternleafDetails : firstDetails;
	const nearDiscoveryDetails = followingLanternleaf
		? lanternleafNearDiscoveryDetails
		: firstNearDiscoveryDetails;
	const journeyDetails = followingLanternleaf ? lanternleafJourneyDetails : firstJourneyDetails;
	const nearJourneyDetails = followingLanternleaf
		? lanternleafNearJourneyDetails
		: firstNearJourneyDetails;

	return {
		kind: missingSlot ? "near-discovery" : "discovery",
		opportunity,
		headline: missingSlot
			? followingLanternleaf
				? "Rosie found the start of a new path"
				: "Rosie found a promising clue"
			: followingLanternleaf
				? "Rosie found the Lanternleaf Path"
				: "Rosie found a sleeping Glowroot",
		result: missingSlot
			? "The missing capability changes what Rosie can bring Home."
			: followingLanternleaf
				? "Glowroot opened this route; her Tool and Pack shaped the supplies."
				: "Her Tool changes the bonus; her Pack changes the practical supply.",
		journeyObjective: followingLanternleaf
			? "The reflected leaves answer Rosie"
			: "A warm glow answers Rosie",
		journeyHeadline: followingLanternleaf
			? "Reflected leaves lead Rosie onward"
			: "Warm light stirs beneath the hedge",
		journeyResult: missingSlot
			? "One empty Bag slot changes how far this outing can unfold."
			: "Each packed choice changes what Rosie can notice and reach.",
		journeyTags: BAG_SLOT_ORDER.map((slot) => {
			const selected = bagItem(slot, bag[slot]);
			return {
				slot,
				name: selected?.name ?? `No ${slot[0].toUpperCase()}${slot.slice(1)}`,
				icon: selected?.icon ?? "·",
				detail: missingSlot
					? nearJourneyDetails[missingSlot][slot]
					: journeyDetails[slot][selected?.id ?? "empty"],
			};
		}),
		tags: BAG_SLOT_ORDER.map((slot) => {
			const selected = bagItem(slot, bag[slot]);
			return {
				slot,
				name: selected?.name ?? `No ${slot[0].toUpperCase()}${slot.slice(1)}`,
				icon: selected?.icon ?? "·",
				detail: missingSlot
					? nearDiscoveryDetails[missingSlot][slot]
					: details[slot][selected?.id ?? "empty"],
			};
		}),
	};
}

export function normalizePrototypePosition(value) {
	const numeric = Number(value);
	return Number.isInteger(numeric) && numeric >= 1 && numeric <= PROTOTYPE_POSITIONS.length
		? numeric
		: 1;
}

const GROWTH_MS = CROP_RULES.clover.baseDurationMs;
const COMPOSTED_GROWTH_MS = CROP_RULES.clover.compostDurationMs;
const ADVENTURE_MS = 6 * 60 * 60 * 1000;
const DEPARTURE_MS = 1_000;
const REDUCED_MOTION_DEPARTURE_MS = 120;

function event(kind, detail, at) {
	return { kind, detail, at };
}

export function createInitialState({ now = Date.now(), reduceMotion = false } = {}) {
	return {
		version: 1,
		prototypePosition: 1,
		stage: STAGES.STARTING,
		readyToTickle: 24,
		ticklesEarned: 1119,
		hasTickled: false,
		meaningfulChangePending: false,
		changeRevealed: false,
		purpose: null,
		selectedCrop: null,
		compostApplied: false,
		cloverHarvested: false,
		harvestCompletedAt: null,
		lastHarvestYield: null,
		harvestBeats: [],
		harvestRhythmEligible: true,
		harvestRhythmBonus: false,
		farmStock: { ...STARTING_FARM_STOCK },
		dayStartFarmStock: { ...STARTING_FARM_STOCK },
		bag: { ...DEFAULT_BAG },
		lastBagSelection: null,
		packedProvisionSpent: null,
		nearDiscoveryReason: null,
		returnRewardAcknowledged: false,
		plantedAt: null,
		readyAt: null,
		adventureStartedAt: null,
		adventureReadyAt: null,
		departureStartedAt: null,
		departureReadyAt: null,
		departureComplete: false,
		adventureComplete: false,
		adventureVignetteSeen: false,
		underprepared: false,
		glowrootKnown: false,
		glowrootPlanted: false,
		fieldGuide: [],
		nextPlanting: null,
		cycleComplete: false,
		daysCompleted: 0,
		reduceMotion,
		lastAction: "arrive",
		trace: [event("arrive", "Starting Barn", now)],
	};
}

export function createPrototypeState(position, { now = Date.now(), reduceMotion = false } = {}) {
	const target = normalizePrototypePosition(position);
	const base = createInitialState({ now, reduceMotion });
	const tickled = {
		...base,
		readyToTickle: 23,
		ticklesEarned: 1120,
		hasTickled: true,
	};
	const purposeful = {
		...tickled,
		purpose: "dusk-picnic",
		selectedCrop: "clover",
		compostApplied: false,
	};
	const composted = { ...purposeful, compostApplied: true };
	const plantedStock = {
		...composted.farmStock,
		"clover-seed": composted.farmStock["clover-seed"] - 1,
		compost: composted.farmStock.compost - 1,
	};
	const ready = {
		...composted,
		stage: STAGES.CLOVER_READY,
		farmStock: plantedStock,
		plantedAt: now - COMPOSTED_GROWTH_MS,
		readyAt: now,
		meaningfulChangePending: false,
		changeRevealed: true,
	};
	const harvested = {
		...ready,
		cloverHarvested: true,
		harvestCompletedAt: now - 1_000,
		harvestBeats: HARVEST_PATTERN.map((direction, index) => ({
			direction,
			correct: true,
			at: now - (HARVEST_PATTERN.length - index) * 400,
		})),
		harvestRhythmEligible: true,
		harvestRhythmBonus: true,
		lastHarvestYield:
			CROP_RULES.clover.baseYield +
			CROP_RULES.clover.compostYieldBonus +
			1,
		farmStock: { ...plantedStock, "clover-lunch": 5 },
		fieldGuide: ["Clover Lunch"],
	};
	const packed = {
		...harvested,
		stage: STAGES.PACKED,
		underprepared: false,
		packedProvisionSpent: "clover-lunch",
		farmStock: {
			...harvested.farmStock,
			"clover-lunch": harvested.farmStock["clover-lunch"] - 1,
		},
	};
	const returnedStock = {
		...packed.farmStock,
		"glowroot-seed": 1,
		"willow-fiber": 2,
	};
	for (const reward of [
		bagReturnReward(packed.bag?.pack ?? null),
		toolReturnBonus(packed.bag?.tool ?? null),
	]) {
		if (reward !== null) {
			returnedStock[reward.itemId] =
				(returnedStock[reward.itemId] ?? 0) + reward.amount;
		}
	}
	const plantedGlowrootStock = {
		...returnedStock,
		"glowroot-seed": returnedStock["glowroot-seed"] - 1,
	};

	const presets = {
		1: base,
		2: tickled,
		3: purposeful,
		4: {
			...composted,
			stage: STAGES.CLOVER_GROWING,
			farmStock: plantedStock,
			// Position 4 is the approved late-growth review checkpoint, not the
			// first frame after planting. Real play still begins at plantedAt.
			plantedAt: now - Math.round(COMPOSTED_GROWTH_MS * 0.66),
			readyAt: now + Math.round(COMPOSTED_GROWTH_MS * 0.34),
		},
		5: ready,
		6: harvested,
		7: harvested,
		8: packed,
		9: {
			...packed,
			stage: STAGES.ADVENTURE,
			prototypePosition: 9,
			underprepared: false,
			adventureStartedAt: now,
			adventureReadyAt: now + ADVENTURE_MS,
			departureStartedAt: now - DEPARTURE_MS,
			departureReadyAt: now,
			departureComplete: true,
			adventureComplete: false,
			adventureVignetteSeen: false,
		},
		10: {
			...packed,
			stage: STAGES.GLOWROOT_RETURNED,
			glowrootKnown: true,
			changeRevealed: true,
			returnRewardAcknowledged: false,
			farmStock: returnedStock,
			fieldGuide: ["Clover Lunch", "Dusk Picnic", "Glowroot Seed"],
		},
		11: {
			...packed,
			stage: STAGES.DEVELOPED,
			glowrootKnown: true,
			glowrootPlanted: true,
			changeRevealed: true,
			returnRewardAcknowledged: true,
			farmStock: plantedGlowrootStock,
			nextPlanting: "moonberries",
			cycleComplete: true,
			fieldGuide: ["Clover Lunch", "Dusk Picnic", "Glowroot Seed", "Moonberries"],
		},
	};

	return {
		...presets[target],
		prototypePosition: target,
		lastAction: "jump-to-position",
		trace: [event("jump-to-position", PROTOTYPE_POSITIONS[target - 1].name, now)],
	};
}

function appendTrace(state, kind, detail, now) {
	return [...state.trace, event(kind, detail, now)].slice(-60);
}

function changed(state, patch, kind, detail, now) {
	return {
		...state,
		...patch,
		lastAction: kind,
		trace: appendTrace(state, kind, detail, now),
	};
}

function completeCloverHarvest(state, { rhythmBonus = false } = {}, now) {
	const yieldAmount =
		CROP_RULES.clover.baseYield +
		(state.compostApplied ? CROP_RULES.clover.compostYieldBonus : 0) +
		(rhythmBonus ? 1 : 0);
	return changed(
		state,
		{
			cloverHarvested: true,
			harvestCompletedAt: now,
			harvestRhythmBonus: rhythmBonus,
			lastHarvestYield: yieldAmount,
			farmStock: {
				...state.farmStock,
				"clover-lunch": (state.farmStock?.["clover-lunch"] ?? 0) + yieldAmount,
			},
			prototypePosition: 6,
			fieldGuide: state.fieldGuide.includes("Clover Lunch")
				? state.fieldGuide
				: [...state.fieldGuide, "Clover Lunch"],
		},
		"harvest",
		rhythmBonus ? `Clover Lunch +${yieldAmount} · rhythm +1` : `Clover Lunch +${yieldAmount}`,
		now,
	);
}

function prototypeBagStockAdjustment(position, bag = DEFAULT_BAG) {
	const adjustment = { ...EMPTY_FARM_STOCK };
	const emptySlot = BAG_SLOT_ORDER.find((slot) => bag?.[slot] == null) ?? null;
	const add = (reward, direction = 1) => {
		if (reward === null) return;
		adjustment[reward.itemId] += reward.amount * direction;
	};

	if (position >= 8) {
		add(DEFAULT_BAG.provision === null ? null : {
			itemId: DEFAULT_BAG.provision,
			amount: 1,
		}, 1);
		add(bag.provision == null ? null : {
			itemId: bag.provision,
			amount: 1,
		}, -1);
		add(bagPackingCost(DEFAULT_BAG.pack), 1);
		add(bagPackingCost(bag.pack ?? null), -1);
	}
	if (position >= 10) {
		if (emptySlot !== null) {
			add(bagReturnReward(DEFAULT_BAG.pack), -1);
			add(toolReturnBonus(DEFAULT_BAG.tool), -1);
			add({ itemId: "glowroot-seed", amount: 1 }, -1);
			add({ itemId: "willow-fiber", amount: 2 }, -1);
			add({ itemId: "compost", amount: 1 }, 1);
			add({ itemId: "willow-fiber", amount: 1 }, 1);
		} else {
			add(bagReturnReward(DEFAULT_BAG.pack), -1);
			add(bagReturnReward(bag.pack ?? null), 1);
			add(toolReturnBonus(DEFAULT_BAG.tool), -1);
			add(toolReturnBonus(bag.tool ?? null), 1);
		}
	}

	return adjustment;
}

function jumpState(state, target, now) {
	const base = createInitialState({ now, reduceMotion: state.reduceMotion });
	const presets = {
		starting: base,
		ready: {
			...base,
			prototypePosition: 5,
			stage: STAGES.CLOVER_READY,
			hasTickled: true,
			purpose: "dusk-picnic",
			meaningfulChangePending: true,
			plantedAt: now - GROWTH_MS,
			readyAt: now,
		},
		developed: {
			...base,
			prototypePosition: 11,
			stage: STAGES.DEVELOPED,
			hasTickled: true,
			purpose: "dusk-picnic",
			cloverHarvested: true,
			glowrootKnown: true,
			glowrootPlanted: true,
			changeRevealed: true,
			farmStock: {
				...base.farmStock,
				"glowroot-seed": 0,
				compost: 2,
				"willow-fiber": 2,
			},
			fieldGuide: ["Clover Lunch", "Dusk Picnic", "Glowroot Seed"],
		},
	};

	if (!Object.hasOwn(presets, target)) return state;
	return changed(presets[target], {}, "jump-to-state", target, now);
}

export function settleState(state, now = Date.now()) {
	if (
		state.stage === STAGES.CLOVER_GROWING &&
		state.readyAt !== null &&
		now >= state.readyAt
	) {
		return changed(
			state,
			{
				stage: STAGES.CLOVER_READY,
				prototypePosition: 5,
				meaningfulChangePending: true,
				changeRevealed: false,
			},
			"settle",
			"Clover Lunch is ready",
			now,
		);
	}

	if (
		state.stage === STAGES.ADVENTURE &&
		!state.departureComplete &&
		state.departureReadyAt !== null &&
		now >= state.departureReadyAt
	) {
		const departed = changed(
			state,
			{
				prototypePosition: 9,
				departureComplete: true,
			},
			"departure-complete",
			"Rosie crossed the hedge",
			now,
		);
		return settleState(departed, now);
	}

	if (
		state.stage === STAGES.ADVENTURE &&
		state.adventureReadyAt !== null &&
		now >= state.adventureReadyAt &&
		!state.adventureComplete
	) {
		return changed(
			state,
			{ adventureComplete: true, meaningfulChangePending: true },
			"settle",
			"Rosie is waiting at the hedge",
			now,
		);
	}

	return state;
}

export function homegrownReducer(state, action) {
	const now = Number.isFinite(action.now) ? action.now : Date.now();

	switch (action.type) {
		case ACTIONS.TICKLE:
			if (state.readyToTickle <= 0) return state;
			{
				const completesDay =
					state.stage === STAGES.DEVELOPED &&
					state.nextPlanting === "moonberries";
			return changed(
				state,
				{
					readyToTickle: state.readyToTickle - 1,
					ticklesEarned: state.ticklesEarned + 1,
					hasTickled: true,
					changeRevealed:
						state.changeRevealed || state.meaningfulChangePending,
					meaningfulChangePending: false,
					cycleComplete: state.cycleComplete || completesDay,
					fieldGuide: completesDay
						? [...new Set([...state.fieldGuide, "Moonberries"])]
						: state.fieldGuide,
					prototypePosition:
						state.stage === STAGES.STARTING && !state.hasTickled
							? 2
							: state.stage === STAGES.CLOVER_READY
								? 5
								: state.stage === STAGES.GLOWROOT_RETURNED
									? 10
									: state.prototypePosition,
				},
				"tickle",
				completesDay
					? "The dusk moths found Home; the Barn day is complete"
					: state.meaningfulChangePending
					? "Rosie noticed what changed"
					: "Rosie laughed",
				now,
			);
			}

		case ACTIONS.SELECT_CROP:
		case ACTIONS.CHOOSE_PURPOSE:
			if (!state.hasTickled || state.stage !== STAGES.STARTING) return state;
			if (state.selectedCrop) return state;
			if (
				(action.type === ACTIONS.SELECT_CROP && action.crop !== "clover") ||
				(action.type === ACTIONS.CHOOSE_PURPOSE && action.purpose !== "dusk-picnic") ||
				(state.farmStock?.[CROP_RULES.clover.seedId] ?? 0) < 1
			) {
				return state;
			}
			return changed(
				state,
				{
					purpose: "dusk-picnic",
					selectedCrop: "clover",
					compostApplied: false,
					prototypePosition: 3,
				},
				action.type === ACTIONS.SELECT_CROP ? "select-crop" : "choose-purpose",
				"Clover Seed for the Dusk Picnic",
				now,
			);

		case ACTIONS.TOGGLE_COMPOST:
			if (
				state.stage !== STAGES.STARTING ||
				state.prototypePosition !== 3 ||
				state.selectedCrop !== "clover"
			) {
				return state;
			}
			if (!state.compostApplied && (state.farmStock?.compost ?? 0) < 1) return state;
			return changed(
				state,
				{ compostApplied: !state.compostApplied },
				"toggle-compost",
				state.compostApplied ? "Compost saved for later" : "Compost will help Clover",
				now,
			);

		case ACTIONS.PLANT_CLOVER:
			if (
				state.stage !== STAGES.STARTING ||
				state.purpose !== "dusk-picnic" ||
				state.selectedCrop !== "clover" ||
				(state.farmStock?.[CROP_RULES.clover.seedId] ?? 0) < 1
			) {
				return state;
			}
			{
				const compostUsed = state.compostApplied && (state.farmStock?.compost ?? 0) > 0;
				const duration = compostUsed ? COMPOSTED_GROWTH_MS : GROWTH_MS;
			return changed(
				state,
				{
					stage: STAGES.CLOVER_GROWING,
					prototypePosition: 4,
					compostApplied: compostUsed,
					farmStock: {
						...state.farmStock,
						[CROP_RULES.clover.seedId]: state.farmStock[CROP_RULES.clover.seedId] - 1,
						compost: state.farmStock.compost - (compostUsed ? 1 : 0),
					},
					plantedAt: now,
					readyAt: now + duration,
				},
				"plant",
				compostUsed ? "Clover Lunch with Compost" : "Clover Lunch without Compost",
				now,
			);
			}

		case ACTIONS.ADVANCE_TIME: {
			if (state.stage === STAGES.CLOVER_GROWING) {
				return settleState(state, state.readyAt ?? now);
			}
			if (state.stage === STAGES.ADVENTURE) {
				return settleState(state, state.adventureReadyAt ?? now);
			}
			return state;
		}

		case ACTIONS.SETTLE:
			return settleState(state, now);

		case ACTIONS.HARVEST_BEAT: {
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.changeRevealed ||
				state.cloverHarvested ||
				!HARVEST_PATTERN.includes(action.direction)
			) {
				return state;
			}
			const beatIndex = state.harvestBeats?.length ?? 0;
			if (beatIndex >= HARVEST_PATTERN.length) return state;
			const previousBeat = state.harvestBeats?.at(-1) ?? null;
			const correct = action.direction === HARVEST_PATTERN[beatIndex];
			const timely =
				action.input === "button" ||
				previousBeat === null ||
				now - previousBeat.at <= HARVEST_BEAT_MS;
			const eligible = state.harvestRhythmEligible && correct && timely;
			const harvestBeats = [
				...(state.harvestBeats ?? []),
				{ direction: action.direction, correct, at: now },
			];
			const beatState = {
				...state,
				harvestBeats,
				harvestRhythmEligible: eligible,
			};
			if (harvestBeats.length === HARVEST_PATTERN.length) {
				return completeCloverHarvest(beatState, { rhythmBonus: eligible }, now);
			}
			return changed(
				state,
				{ harvestBeats, harvestRhythmEligible: eligible },
				"harvest-beat",
				`${action.direction}${correct ? "" : " · steady harvest"}`,
				now,
			);
		}

		case ACTIONS.HARVEST_CLOVER:
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.changeRevealed ||
				state.cloverHarvested
			) {
				return state;
			}
			return completeCloverHarvest(state, { rhythmBonus: false }, now);

		case ACTIONS.OPEN_BAG_SELECTION:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			return changed(
				state,
				{ prototypePosition: 7 },
				"open-bag-selection",
				"Choose one Provision, Tool, and Pack",
				now,
			);

		case ACTIONS.SET_BAG_SLOT: {
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.cloverHarvested ||
				state.prototypePosition !== 7 ||
				!BAG_SLOT_ORDER.includes(action.slot)
			) {
				return state;
			}
			const nextItem = action.item ?? null;
			if (nextItem !== null && !bagItem(action.slot, nextItem)) return state;
			const packingCost = action.slot === "pack" ? bagPackingCost(nextItem) : null;
			if (
				packingCost !== null &&
				(state.farmStock?.[packingCost.itemId] ?? 0) < packingCost.amount
			) {
				return state;
			}
			return changed(
				state,
				{
					bag: { ...state.bag, [action.slot]: nextItem },
					lastBagSelection: {
						slot: action.slot,
						item: nextItem,
						previousItem: state.bag?.[action.slot] ?? null,
						at: now,
					},
				},
				"choose-bag-item",
				`${action.slot}: ${bagItem(action.slot, nextItem)?.name ?? "empty"}`,
				now,
			);
		}

		case ACTIONS.PACK_ADVENTURE:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			{
				const emptySlot = BAG_SLOT_ORDER.find((slot) => state.bag?.[slot] == null) ?? null;
				const provisionId = state.bag?.provision ?? null;
				const packingCost = bagPackingCost(state.bag?.pack ?? null);
				if (provisionId !== null && (state.farmStock?.[provisionId] ?? 0) < 1) {
					return state;
				}
				if (
					packingCost !== null &&
					(state.farmStock?.[packingCost.itemId] ?? 0) < packingCost.amount
				) {
					return state;
				}
				const farmStock = { ...state.farmStock };
				if (provisionId !== null) {
					farmStock[provisionId] -= 1;
				}
				if (packingCost !== null) {
					farmStock[packingCost.itemId] -= packingCost.amount;
				}
			return changed(
				state,
				{
					stage: STAGES.PACKED,
					farmStock: provisionId === null && packingCost === null ? state.farmStock : farmStock,
					packedProvisionSpent: provisionId,
					underprepared: emptySlot !== null,
					nearDiscoveryReason: emptySlot,
					prototypePosition: 8,
				},
				"pack",
				`${BAG_SLOT_ORDER.map((slot) => bagItem(slot, state.bag?.[slot])?.name ?? `Empty ${slot}`).join(" + ")}${provisionId ? " · spent 1 Provision" : ""}${packingCost ? ` · spent ${packingCost.amount} ${packingCost.name}` : ""}`,
				now,
			);
			}

		case ACTIONS.PACK_LIGHT:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			return changed(
				state,
				{
					stage: STAGES.PACKED,
					bag: { ...state.bag, provision: null },
					packedProvisionSpent: null,
					underprepared: true,
					nearDiscoveryReason: "provision",
					prototypePosition: 8,
				},
				"pack",
				"Wooden Spoon + Wicker Basket; Clover Lunch left Home",
				now,
			);

		case ACTIONS.START_ADVENTURE:
			if (state.stage !== STAGES.PACKED) return state;
			{
				const opportunity = adventureOpportunity(state);
				const departureDuration = state.reduceMotion
					? REDUCED_MOTION_DEPARTURE_MS
					: DEPARTURE_MS;
			return changed(
				state,
				{
					stage: STAGES.ADVENTURE,
					prototypePosition: 8,
					adventureStartedAt: now,
					adventureReadyAt: now + ADVENTURE_MS,
					departureStartedAt: now,
					departureReadyAt: now + departureDuration,
					departureComplete: false,
					adventureComplete: false,
					adventureVignetteSeen: false,
				},
				"adventure",
				`${opportunity.name} began`,
				now,
			);
			}

		case ACTIONS.CONTINUE_ADVENTURE_STORY:
			if (state.stage !== STAGES.ADVENTURE || state.adventureVignetteSeen) return state;
			return changed(
				state,
				{ adventureVignetteSeen: true },
				"adventure-vignette",
				adventureStory(state).headline,
				now,
			);

		case ACTIONS.WELCOME_HOME:
			if (state.stage !== STAGES.ADVENTURE || !state.adventureComplete) {
				return state;
			}
			const opportunity = adventureOpportunity(state);
			const followingLanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
			if (state.underprepared) {
				const nearDetail = (followingLanternleaf ? {
					provision: "Rosie found the open-gate trail, but came Home before the reflected leaves appeared",
					tool: "Rosie stayed until nightfall, but had no Tool to trace the Lanternleaf Path",
					pack: "Rosie mapped the Lanternleaf Path, but left its supplies safe beyond the gate",
				} : {
					provision: "Rosie found the warm moth trail, but came Home kindly before the seed opened",
					tool: "Rosie stayed until dusk and found a warm root, but had no Tool to uncover it",
					pack: "Rosie uncovered the warm seed, but brought Home its glowing leaf-print instead",
				})[state.nearDiscoveryReason] ?? "Rosie brought Home a useful clue for the next Adventure";
				return changed(
					state,
					{
						stage: STAGES.NEAR_DISCOVERY,
						prototypePosition: 10,
						meaningfulChangePending: false,
						changeRevealed: true,
						farmStock: {
							...state.farmStock,
							compost: (state.farmStock?.compost ?? 0) + 1,
							"willow-fiber": (state.farmStock?.["willow-fiber"] ?? 0) + 1,
						},
						fieldGuide: [...new Set([...state.fieldGuide, ...opportunity.nearFieldGuideEntries, opportunity.clueEntry])],
					},
					"near-discovery",
					nearDetail,
					now,
				);
			}
			const returnReward = bagReturnReward(state.bag?.pack ?? null);
			const toolBonus = toolReturnBonus(state.bag?.tool ?? null);
			const farmStock = {
				...state.farmStock,
				"glowroot-seed": (state.farmStock?.["glowroot-seed"] ?? 0) + 1,
				"willow-fiber": (state.farmStock?.["willow-fiber"] ?? 0) + 2,
			};
			if (returnReward !== null) {
				farmStock[returnReward.itemId] =
					(state.farmStock?.[returnReward.itemId] ?? 0) + returnReward.amount;
			}
			if (toolBonus !== null) {
				farmStock[toolBonus.itemId] =
					(farmStock[toolBonus.itemId] ?? 0) + toolBonus.amount;
			}
			return changed(
				state,
				{
					stage: STAGES.GLOWROOT_RETURNED,
					prototypePosition: 10,
					glowrootKnown: true,
					meaningfulChangePending: true,
					changeRevealed: true,
					returnRewardAcknowledged: false,
					farmStock,
					fieldGuide: [...new Set([...state.fieldGuide, ...opportunity.fieldGuideEntries])],
				},
				"return",
				`${opportunity.discoveryName} — ${returnReward ? `${returnReward.name} +${returnReward.amount}` : "no Pack supply"} — ${toolBonus ? `${toolBonus.name} +${toolBonus.amount} Tool bonus` : "no Tool bonus"}`,
				now,
			);

		case ACTIONS.ACKNOWLEDGE_RETURN:
			if (state.stage !== STAGES.GLOWROOT_RETURNED || state.returnRewardAcknowledged) {
				return state;
			}
			if (state.glowrootPlanted) {
				const storedPackReward = bagReturnReward(state.bag?.pack ?? null);
				const storedToolBonus = toolReturnBonus(state.bag?.tool ?? null);
				return changed(
					state,
					{
						stage: STAGES.DEVELOPED,
						prototypePosition: 11,
						returnRewardAcknowledged: true,
						meaningfulChangePending: false,
						cycleComplete: true,
					},
					"store-return",
					`Known Glowroot Seeds stay in Farm stock · ${storedPackReward ? `${storedPackReward.name} +${storedPackReward.amount}` : "no Pack supply"} · ${storedToolBonus ? `${storedToolBonus.name} +${storedToolBonus.amount} Tool bonus` : "no Tool bonus"}`,
					now,
				);
			}
			return changed(
				state,
				{
					prototypePosition: 11,
					returnRewardAcknowledged: true,
					meaningfulChangePending: false,
				},
				"acknowledge-return",
				"Glowroot Seed, Compost, and Willow Fiber joined Farm stock",
				now,
			);

		case ACTIONS.PLANT_GLOWROOT:
			if (
				state.stage !== STAGES.GLOWROOT_RETURNED ||
				!state.changeRevealed ||
				!state.returnRewardAcknowledged ||
				state.glowrootPlanted ||
				(state.farmStock?.["glowroot-seed"] ?? 0) < 1
			) {
				return state;
			}
			return changed(
				state,
				{
					stage: STAGES.DEVELOPED,
					prototypePosition: 11,
					glowrootPlanted: true,
					farmStock: {
						...state.farmStock,
						"glowroot-seed": state.farmStock["glowroot-seed"] - 1,
					},
				},
				"plant",
				`Glowroot Seed ${state.farmStock["glowroot-seed"]} → ${state.farmStock["glowroot-seed"] - 1} · the Barn path remembers`,
				now,
			);

		case ACTIONS.RETRY_PREP:
			if (state.stage !== STAGES.NEAR_DISCOVERY) return state;
			return changed(
				state,
				{
					stage: STAGES.CLOVER_READY,
					prototypePosition: 7,
					underprepared: false,
					adventureComplete: false,
					meaningfulChangePending: false,
					changeRevealed: true,
					packedProvisionSpent: null,
				},
				"retry-prep",
				"The clue suggests packing Clover Lunch",
				now,
			);

		case ACTIONS.PLANT_NEXT:
			if (state.stage !== STAGES.DEVELOPED) return state;
			if (!new Set(["clover", "moonberries", "glowroot"]).has(action.crop)) {
				return state;
			}
			return changed(
				state,
				{ nextPlanting: action.crop },
				"next-planting",
				action.crop,
				now,
			);

		case ACTIONS.START_NEW_DAY:
			if (!state.cycleComplete) return state;
			return {
				...createInitialState({ now, reduceMotion: state.reduceMotion }),
				ticklesEarned: state.ticklesEarned,
				glowrootKnown: state.glowrootKnown,
				glowrootPlanted: state.glowrootPlanted,
				fieldGuide: state.fieldGuide,
				farmStock: { ...state.farmStock },
				dayStartFarmStock: { ...state.farmStock },
				bag: { ...state.bag },
				nextPlanting: state.nextPlanting,
				daysCompleted: state.daysCompleted + 1,
				lastAction: "new-day",
				trace: appendTrace(state, "new-day", `Barn day ${state.daysCompleted + 2}`, now),
			};

		case ACTIONS.TOGGLE_REDUCED_MOTION:
			return changed(
				state,
				{ reduceMotion: !state.reduceMotion },
				"reduce-motion",
				!state.reduceMotion ? "on" : "off",
				now,
			);

		case ACTIONS.JUMP_TO_POSITION:
			if (!Number.isInteger(action.position) || normalizePrototypePosition(action.position) !== action.position) return state;
			if (action.position === state.prototypePosition) return state;
			{
				const previewOpportunity = adventureOpportunity(state);
				const next = createPrototypeState(action.position, { now, reduceMotion: state.reduceMotion });
				const emptySlot = BAG_SLOT_ORDER.find((slot) => state.bag?.[slot] == null) ?? null;
				const underprepared = emptySlot !== null;
				const currentPosition = normalizePrototypePosition(state.prototypePosition ?? 1);
				const currentPreset = createPrototypeState(currentPosition, { now, reduceMotion: state.reduceMotion });
				const currentBagAdjustment = prototypeBagStockAdjustment(currentPosition, state.bag);
				const nextBagAdjustment = prototypeBagStockAdjustment(action.position, state.bag);
				const previewFarmStock = Object.fromEntries(
					Object.keys(EMPTY_FARM_STOCK).map((itemId) => [
						itemId,
						Math.max(
							0,
							(state.farmStock?.[itemId] ?? 0) +
								(next.farmStock?.[itemId] ?? 0) -
								(currentPreset.farmStock?.[itemId] ?? 0) +
								(nextBagAdjustment[itemId] ?? 0) -
								(currentBagAdjustment[itemId] ?? 0),
						),
					]),
				);
				const returnPreview = action.position === 10
					? {
						...(underprepared ? {
							stage: STAGES.NEAR_DISCOVERY,
							glowrootKnown: state.glowrootKnown,
							fieldGuide: [...new Set([
								...state.fieldGuide,
								...previewOpportunity.nearFieldGuideEntries,
								previewOpportunity.clueEntry,
							])],
							lastAction: "near-discovery",
							trace: appendTrace(state, "near-discovery", "Useful clue preview", now),
						} : {
							fieldGuide: [...new Set([
								...state.fieldGuide,
								...previewOpportunity.fieldGuideEntries,
							])],
							lastAction: "return",
							trace: appendTrace(state, "return", `${previewOpportunity.discoveryName} preview`, now),
						}),
					}
					: {};
				const preparationPreview = action.position >= 8
					? {
						underprepared,
						nearDiscoveryReason: emptySlot,
						packedProvisionSpent: state.bag?.provision ?? null,
					}
					: {};
				const homeMemory = state.daysCompleted > 0 || state.glowrootPlanted;
				const persistentHome = homeMemory
					? {
						readyToTickle: state.readyToTickle,
						ticklesEarned: state.ticklesEarned,
						glowrootKnown: state.glowrootKnown,
						glowrootPlanted: state.glowrootPlanted,
						fieldGuide: [...state.fieldGuide],
						nextPlanting: state.nextPlanting,
						daysCompleted: state.daysCompleted,
						dayStartFarmStock: { ...state.dayStartFarmStock },
					}
					: {};
				if ((state.prototypePosition ?? 1) < 6 || action.position < 6) {
					if (!homeMemory) return next;
					const dayStartFarmStock = state.dayStartFarmStock ?? state.farmStock;
					const farmStock = Object.fromEntries(
						Object.keys(EMPTY_FARM_STOCK).map((itemId) => {
							const targetDelta =
								(next.farmStock?.[itemId] ?? 0) -
								(STARTING_FARM_STOCK[itemId] ?? 0);
							return [
								itemId,
								Math.max(0, (dayStartFarmStock?.[itemId] ?? 0) + targetDelta),
							];
						}),
					);
					return {
						...next,
						...persistentHome,
						bag: { ...state.bag },
						farmStock,
						...returnPreview,
						...preparationPreview,
					};
				}
				return {
					...next,
					...persistentHome,
					bag: { ...state.bag },
					farmStock: previewFarmStock,
					...returnPreview,
					...preparationPreview,
				};
			}

		case ACTIONS.JUMP_TO_STATE:
			return jumpState(state, action.target, now);

		case ACTIONS.RESET:
			return createInitialState({ now, reduceMotion: state.reduceMotion });

		default:
			return state;
	}
}

export function serializeState(state) {
	return JSON.stringify(state);
}

export function deserializeState(value, { now = Date.now(), reduceMotion = false } = {}) {
	if (!value) return createInitialState({ now, reduceMotion });
	try {
		const parsed = JSON.parse(value);
		if (parsed?.version !== 1 || !Object.values(STAGES).includes(parsed.stage)) {
			return createInitialState({ now, reduceMotion });
		}
		const initial = createInitialState({ now, reduceMotion });
		const legacyStock = parsed.farmStock ?? {};
		const farmStock = { ...initial.farmStock, ...legacyStock };
		if (!Object.hasOwn(legacyStock, CROP_RULES.clover.seedId)) {
			farmStock[CROP_RULES.clover.seedId] = STARTING_FARM_STOCK[CROP_RULES.clover.seedId];
			farmStock.compost = Math.max(farmStock.compost, STARTING_FARM_STOCK.compost);
		}
		const legacyDepartureComplete =
			parsed.departureComplete ??
			(parsed.stage !== STAGES.ADVENTURE || (parsed.prototypePosition ?? 1) >= 9);
		const restored = {
				...initial,
				...parsed,
				departureComplete: legacyDepartureComplete,
				departureStartedAt:
					parsed.departureStartedAt ??
					(parsed.stage === STAGES.ADVENTURE && !legacyDepartureComplete ? now : null),
				departureReadyAt:
					parsed.stage === STAGES.ADVENTURE && !legacyDepartureComplete
						? now + (reduceMotion ? REDUCED_MOTION_DEPARTURE_MS : DEPARTURE_MS)
						: parsed.departureReadyAt ?? null,
				glowrootPlanted:
					parsed.glowrootPlanted ?? (parsed.stage === STAGES.DEVELOPED),
				farmStock,
				dayStartFarmStock: parsed.dayStartFarmStock
					? { ...initial.dayStartFarmStock, ...parsed.dayStartFarmStock }
					: parsed.daysCompleted > 0
						? { ...farmStock }
						: { ...initial.dayStartFarmStock },
				bag: { ...initial.bag, ...parsed.bag },
			};
		return settleState(restored, now);
	} catch {
		return createInitialState({ now, reduceMotion });
	}
}

export function primaryAction(state) {
	const opportunity = adventureOpportunity(state);
	if (state.cycleComplete) {
		return { type: ACTIONS.START_NEW_DAY, label: "Begin another day" };
	}
	if (!state.hasTickled) return { type: ACTIONS.TICKLE, label: "Tickle Rosie" };
	if (state.stage === STAGES.STARTING && !state.selectedCrop) {
		return {
			type: ACTIONS.SELECT_CROP,
			crop: "clover",
			label: "Choose Clover Seed",
		};
	}
	if (state.stage === STAGES.STARTING) {
		return {
			type: ACTIONS.PLANT_CLOVER,
			label: state.compostApplied ? "Plant with Compost" : "Plant Clover",
		};
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		return { type: ACTIONS.ADVANCE_TIME, label: "Let the afternoon pass" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		return { type: ACTIONS.TICKLE, label: "Welcome Rosie" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return { type: ACTIONS.HARVEST_CLOVER, label: "Gather normally" };
	}
	if (state.stage === STAGES.CLOVER_READY) {
		if (state.prototypePosition === 6) {
			return { type: ACTIONS.OPEN_BAG_SELECTION, label: opportunity.prepareLabel };
		}
		return { type: ACTIONS.PACK_ADVENTURE, label: opportunity.packLabel };
	}
	if (state.stage === STAGES.PACKED) {
		return { type: ACTIONS.START_ADVENTURE, label: opportunity.departLabel };
	}
	if (state.stage === STAGES.ADVENTURE && !state.departureComplete) {
		return { type: ACTIONS.SETTLE, label: "Rosie is heading for the hedge…" };
	}
	if (state.stage === STAGES.ADVENTURE && !state.adventureComplete) {
		if (!state.adventureVignetteSeen) {
			return { type: ACTIONS.CONTINUE_ADVENTURE_STORY, label: "Let Rosie explore" };
		}
		return { type: ACTIONS.ADVANCE_TIME, label: opportunity.waitLabel };
	}
	if (state.stage === STAGES.ADVENTURE) {
		return { type: ACTIONS.WELCOME_HOME, label: "Welcome Rosie Home" };
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && !state.changeRevealed) {
		return { type: ACTIONS.TICKLE, label: "Tickle Rosie to hear her story" };
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED) {
		if (!state.returnRewardAcknowledged) {
			return {
				type: ACTIONS.ACKNOWLEDGE_RETURN,
				label: state.glowrootPlanted ? "Keep supplies in Farm stock" : "Welcome Rosie Home",
			};
		}
		return { type: ACTIONS.PLANT_GLOWROOT, label: "Plant Glowroot" };
	}
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		return { type: ACTIONS.RETRY_PREP, label: "Adjust Rosie’s Bag" };
	}
	if (state.nextPlanting === "moonberries") {
		return {
			type: ACTIONS.TICKLE,
			label: "Tickle Rosie with the moths",
		};
	}
	return { type: ACTIONS.PLANT_NEXT, crop: "moonberries", label: "Grow Moonberries for the moths" };
}

export const WORLD_TARGETS = Object.freeze({
	ROSIE: "rosie",
	PATCH: "patch",
	GLOWROOT_BED: "glowroot-bed",
	MOONBERRY_BED: "moonberry-bed",
	BAG: "bag",
	HEDGE: "hedge",
});

/**
 * One visible objective, one spatial target, one short action.
 *
 * This is intentionally separate from the reducer. The state machine keeps the
 * full prototype loop; the player-facing layer reveals only the next thing the
 * Barn wants them to notice.
 */
export function playerPresentation(state) {
	const action = primaryAction(state);
	const opportunity = adventureOpportunity(state);

	if (state.cycleComplete) {
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: "Rosie’s Barn day is complete",
			label: "Begin another day",
			action,
		};
	}

	if (!state.hasTickled) {
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: "Rosie wants to play",
			label: "Tickle Rosie",
			action,
		};
	}
	if (state.stage === STAGES.STARTING && !state.selectedCrop) {
		return {
			target: WORLD_TARGETS.PATCH,
			objective: opportunity.name,
			detail: opportunity.growDetail,
			label: "Choose Clover Seed",
			action,
		};
	}
	if (state.stage === STAGES.STARTING) {
		return {
			target: WORLD_TARGETS.PATCH,
			objective: opportunity.plantingObjective,
			detail: state.compostApplied ? "Compost: 2h · harvest 4" : "Clover: 4h · harvest 3",
			label: state.compostApplied ? "Plant with Compost" : "Plant Clover",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		return {
			target: WORLD_TARGETS.PATCH,
			objective: opportunity.growingObjective,
			detail: state.compostApplied ? "Composted · ready in 2h" : "Growing · ready in 4h",
			label: "Preview it ready",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: "Rosie noticed something",
			label: "Welcome Rosie",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return {
			target: WORLD_TARGETS.PATCH,
			objective: opportunity.harvestObjective,
			detail: "Clover’s rhythm: ← → ↑",
			label: "Follow the rhythm",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_READY) {
		if (state.prototypePosition === 6) {
			return {
				target: WORLD_TARGETS.BAG,
				objective: opportunity.name,
				detail: opportunity.detail,
				label: opportunity.prepareLabel,
				action,
			};
		}
		if (state.prototypePosition === 7) {
			return {
				target: WORLD_TARGETS.BAG,
				objective: opportunity.name,
				detail: opportunity.detail,
				label: "Pack these",
				action,
			};
		}
		return {
			target: WORLD_TARGETS.BAG,
			objective: "Clover is ready to travel",
			label: "Pack Rosie’s Bag",
			action,
		};
	}
	if (state.stage === STAGES.PACKED) {
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: opportunity.name,
			detail: opportunity.packedDetail,
			detailInAction: false,
			label: opportunity.departLabel,
			action,
		};
	}
	if (state.stage === STAGES.ADVENTURE && !state.departureComplete) {
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: "Rosie is setting off",
			label: "Heading beyond the hedge…",
			action,
		};
	}
	if (state.stage === STAGES.ADVENTURE && !state.adventureComplete) {
		if (!state.adventureVignetteSeen) {
			return {
				target: WORLD_TARGETS.HEDGE,
				objective: adventureStory(state).journeyObjective,
				label: "Let Rosie explore",
				action,
			};
		}
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: opportunity.waitingObjective,
			label: "Preview her return",
			action,
		};
	}
	if (state.stage === STAGES.ADVENTURE) {
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: "Rosie is waiting at the gate",
			label: "Welcome Rosie home",
			action,
		};
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && !state.changeRevealed) {
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: "Something glows in Rosie’s Bag",
			label: "Tickle Rosie",
			action,
		};
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED) {
		if (!state.returnRewardAcknowledged) {
			if (state.glowrootPlanted) {
				return {
					target: WORLD_TARGETS.BAG,
					objective: `${opportunity.discoveryName} is mapped`,
					label: "Keep supplies in Farm stock",
					action,
				};
			}
			return {
				target: WORLD_TARGETS.ROSIE,
				objective: "Rosie brought Home a Discovery",
				label: "Welcome Rosie Home",
				action,
			};
		}
		return {
			target: WORLD_TARGETS.GLOWROOT_BED,
			objective: "Bed 3 is ready for Glowroot",
			label: "Plant Glowroot",
			detail: `Glowroot Seed ${state.farmStock?.["glowroot-seed"] ?? 0} → ${Math.max(0, (state.farmStock?.["glowroot-seed"] ?? 0) - 1)}`,
			action,
		};
	}
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		const followingLanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
		return {
			target: WORLD_TARGETS.BAG,
			objective: (followingLanternleaf ? {
				provision: "A Provision reaches nightfall",
				tool: "A Tool can trace the reflections",
				pack: "A Pack can carry trail supplies",
			} : {
				provision: "A Provision could extend the trip",
				tool: "A Tool could uncover the Find",
				pack: "A Pack could carry the Find Home",
			})[state.nearDiscoveryReason] ?? "Rosie found a useful clue",
			label: "Adjust Rosie’s Bag",
			action,
		};
	}
	if (state.nextPlanting === "moonberries") {
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: "The dusk moths found Home",
			label: "Tickle Rosie",
			action,
		};
	}
	return {
		target: WORLD_TARGETS.MOONBERRY_BED,
		objective: "Bed 2 is ready for Moonberries",
		label: "Grow Moonberries",
		detail: "Invite the dusk moths",
		action,
	};
}

export const DURATIONS = Object.freeze({
	GROWTH_MS,
	COMPOSTED_GROWTH_MS,
	DEPARTURE_MS,
	ADVENTURE_MS,
});
