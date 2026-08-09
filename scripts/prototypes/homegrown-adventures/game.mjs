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
	CHOOSE_ADVENTURE_ROUTE: "choose-adventure-route",
	SELECT_CROP: "select-crop",
	CHOOSE_PURPOSE: "choose-purpose",
	TOGGLE_COMPOST: "toggle-compost",
	PLANT_CROP: "plant-crop",
	PLANT_CLOVER: "plant-clover",
	ADVANCE_TIME: "advance-time",
	SETTLE: "settle",
	HARVEST_BEAT: "harvest-beat",
	HARVEST_CROP: "harvest-crop",
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
	{ id: 2, key: "crop-choice", name: "Choose what to grow" },
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
	growingObjective: "A Provision for the open-gate trail",
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
	if (state.selectedAdventureOpportunityId === FIRST_ADVENTURE_OPPORTUNITY.id) {
		return FIRST_ADVENTURE_OPPORTUNITY;
	}
	if (state.selectedAdventureOpportunityId === SECOND_ADVENTURE_OPPORTUNITY.id) {
		return SECOND_ADVENTURE_OPPORTUNITY;
	}
	return state.daysCompleted > 0 && state.glowrootPlanted
		? SECOND_ADVENTURE_OPPORTUNITY
		: FIRST_ADVENTURE_OPPORTUNITY;
}

export function canChooseKnownAdventureRoute(state) {
	const fieldGuide = Array.isArray(state.fieldGuide) ? state.fieldGuide : [];
	return fieldGuide.includes(FIRST_ADVENTURE_OPPORTUNITY.discoveryName) &&
		fieldGuide.includes(SECOND_ADVENTURE_OPPORTUNITY.discoveryName);
}

export const BAG_SLOT_ORDER = Object.freeze(["provision", "tool", "pack"]);
const BAG_SLOT_PUBLIC_NAMES = Object.freeze({
	provision: "Provision",
	tool: "Tool",
	pack: "Carrier",
});

export const BAG_ITEMS = Object.freeze({
	provision: Object.freeze([
		Object.freeze({
			id: "clover-lunch",
			name: "Clover Lunch",
			icon: "☘",
			effect: "Stay exploring until dusk",
		}),
		Object.freeze({
			id: "moonberries",
			name: "Moonberries",
			icon: "●",
			effect: "Reveal reflected things at night",
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

export const EMPTY_BAG = Object.freeze({
	provision: null,
	tool: null,
	pack: null,
});

const REVIEW_BAG = Object.freeze({
	provision: "clover-lunch",
	tool: "hand-trowel",
	pack: "wicker-basket",
});

export const EMPTY_FARM_STOCK = Object.freeze({
	"clover-seed": 0,
	"clover-lunch": 0,
	moonberries: 0,
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
		id: "clover",
		name: "Clover",
		outputId: "clover-lunch",
		outputName: "Clover Lunch",
		fieldGuideName: "Clover Lunch",
		seedId: "clover-seed",
		baseDurationMs: 4 * 60 * 60 * 1000,
		compostDurationMs: 2 * 60 * 60 * 1000,
		baseYield: 3,
		compostYieldBonus: 1,
		harvestPattern: Object.freeze(["left", "right", "up"]),
	}),
	moonberries: Object.freeze({
		id: "moonberries",
		name: "Moonberries",
		outputId: "moonberries",
		outputName: "Moonberries",
		fieldGuideName: "Moonberries",
		seedId: null,
		baseDurationMs: 8 * 60 * 60 * 1000,
		compostDurationMs: 6 * 60 * 60 * 1000,
		baseYield: 4,
		compostYieldBonus: 1,
		harvestPattern: Object.freeze(["down", "left", "right", "up"]),
	}),
});

export const HARVEST_PATTERN = CROP_RULES.clover.harvestPattern;
export const HARVEST_BEAT_MS = 900;

export function cropRule(crop) {
	return CROP_RULES[crop] ?? null;
}

export function cropHarvestPattern(stateOrCrop) {
	const crop = typeof stateOrCrop === "string"
		? stateOrCrop
		: stateOrCrop?.selectedCrop;
	return cropRule(crop)?.harvestPattern ?? HARVEST_PATTERN;
}

const HARVEST_ARROWS = Object.freeze({ left: "←", right: "→", up: "↑", down: "↓" });

export function cropHarvestPatternLabel(stateOrCrop) {
	return cropHarvestPattern(stateOrCrop).map((direction) => HARVEST_ARROWS[direction]).join(" ");
}

export function cropIsAvailable(state, crop) {
	const rule = cropRule(crop);
	if (rule === null) return false;
	if (rule.seedId !== null) return (state.farmStock?.[rule.seedId] ?? 0) > 0;
	return crop === "moonberries" &&
		state.daysCompleted > 0 &&
		state.glowrootPlanted &&
		state.nextPlanting === "moonberries";
}

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

export function adventureBaseReturn(state) {
	return state?.selectedAdventureOpportunityId
		? { itemId: "clover-seed", name: "Clover Seed", amount: 1 }
		: { itemId: "glowroot-seed", name: "Glowroot Seed", amount: 1 };
}

export function adventureToolReturnBonus(state, itemId) {
	const bonus = toolReturnBonus(itemId);
	if (state?.selectedAdventureOpportunityId && bonus?.itemId === "glowroot-seed") {
		return { itemId: "clover-seed", name: "Clover Seed", amount: bonus.amount };
	}
	return bonus;
}

export function adventureRouteMaterialReturn(state) {
	const revisitingKnownRoute = Boolean(state?.selectedAdventureOpportunityId);
	const followingLanternleaf = adventureOpportunity(state).id === SECOND_ADVENTURE_OPPORTUNITY.id;
	if (revisitingKnownRoute && !followingLanternleaf) {
		return { itemId: "compost", name: "Compost", amount: 1, cause: "Warm roots +1" };
	}
	return {
		itemId: "willow-fiber",
		name: "Willow Fiber",
		amount: 2,
		cause: revisitingKnownRoute ? "Reflected leaves +2" : "Find +2",
	};
}

export function adventureReturnLedger(state) {
	const revisitingKnownRoute = Boolean(state?.selectedAdventureOpportunityId);
	const baseReturn = adventureBaseReturn(state);
	const routeMaterial = adventureRouteMaterialReturn(state);
	const packReward = bagReturnReward(state?.bag?.pack ?? null);
	const toolBonus = adventureToolReturnBonus(state, state?.bag?.tool ?? null);
	const contributions = revisitingKnownRoute
		? [
			{ reward: baseReturn, cause: "Route +1" },
			{ reward: routeMaterial, cause: routeMaterial.cause },
			{ reward: packReward, cause: state?.bag?.pack === "wicker-basket" ? "Wicker +1" : "Cloth Wrap +1" },
			{ reward: toolBonus, cause: state?.bag?.tool === "hand-trowel" ? "Trowel +1" : "Lantern +1" },
		]
		: [
			{ reward: baseReturn, cause: "Find +1" },
			{ reward: packReward, cause: state?.bag?.pack === "wicker-basket" ? "Wicker +1" : "Cloth Wrap +1" },
			{ reward: routeMaterial, cause: routeMaterial.cause },
			{ reward: toolBonus, cause: state?.bag?.tool === "hand-trowel" ? "Trowel +1" : "Lantern +1" },
		];
	const rows = [];
	for (const { reward, cause } of contributions) {
		if (reward === null) continue;
		const existing = rows.find((row) => row.itemId === reward.itemId);
		if (existing) {
			existing.amount += reward.amount;
			existing.causes.push(cause);
		} else {
			rows.push({
				itemId: reward.itemId,
				name: reward.name,
				amount: reward.amount,
				causes: [cause],
			});
		}
	}
	return rows;
}

export function adventureStory(state) {
	const bag = state.bag ?? EMPTY_BAG;
	const missingSlot = BAG_SLOT_ORDER.find((slot) => bag[slot] == null) ?? null;
	const opportunity = adventureOpportunity(state);
	const followingLanternleaf = opportunity.id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const revisitingKnownRoute = Boolean(state.selectedAdventureOpportunityId);
	const firstDetails = {
		provision: {
			"clover-lunch": "stayed exploring until dusk",
			moonberries: "noticed a warm reflection beneath the hedge",
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
			moonberries: "make hidden reflections easier to notice",
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
			moonberries: "revealed silver leaves along the hidden path",
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
			moonberries: "make the reflected leaves shine against the dark",
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
			: revisitingKnownRoute
				? followingLanternleaf
					? "The reflected path gives Willow Fiber; her Tool and Carrier shape the rest."
					: "The warm soil gives Compost; her Tool and Carrier shape the rest."
			: followingLanternleaf
				? "Glowroot opened this route; her Tool and Carrier shaped the supplies."
				: "Her Tool changes the bonus; her Carrier changes the practical supply.",
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
				name: selected?.name ?? `No ${BAG_SLOT_PUBLIC_NAMES[slot]}`,
				icon: selected?.icon ?? "·",
				detail: missingSlot === null && revisitingKnownRoute && slot === "tool" && selected?.id === "hand-trowel"
					? "looks for Clover Seed that can begin the next Provision crop"
					: missingSlot
					? nearJourneyDetails[missingSlot][slot]
					: journeyDetails[slot][selected?.id ?? "empty"],
			};
		}),
		tags: BAG_SLOT_ORDER.map((slot) => {
			const selected = bagItem(slot, bag[slot]);
			return {
				slot,
				name: selected?.name ?? `No ${BAG_SLOT_PUBLIC_NAMES[slot]}`,
				icon: selected?.icon ?? "·",
				detail: missingSlot === null && revisitingKnownRoute && slot === "tool" && selected?.id === "hand-trowel"
					? followingLanternleaf
						? "found another Clover Seed beside the reflected path"
						: "found another Clover Seed beside the warm roots"
					: missingSlot
					? nearDiscoveryDetails[missingSlot][slot]
					: details[slot][selected?.id ?? "empty"],
			};
		}),
	};
}

export function nearDiscoveryGuide(state) {
	const lanternleaf = adventureOpportunity(state).id === SECOND_ADVENTURE_OPPORTUNITY.id;
	const routeCopy = lanternleaf
		? {
			provision: {
				story: "Rosie recorded where the reflected leaves begin before nightfall.",
				next: "A Provision lets Rosie stay until the silver route appears.",
				action: "Open the Provision pocket",
			},
			tool: {
				story: "Rosie recorded which leaves turn toward the open gate.",
				next: "A Tool lets Rosie trace the complete reflected path.",
				action: "Open the Tool pocket",
			},
			pack: {
				story: "Rosie mapped the Lanternleaf Path and left its supplies safe.",
				next: "A Carrier lets Rosie bring the trail supplies Home.",
				action: "Open the Carrier pocket",
			},
		}
		: {
			provision: {
				story: "Rosie recorded where warm moths gather before the Glowroot opens.",
				next: "A Provision lets Rosie wait for the seed to open at dusk.",
				action: "Open the Provision pocket",
			},
			tool: {
				story: "Rosie recorded the warm root resting beneath the soft soil.",
				next: "A Tool lets Rosie work carefully with the sleeping root.",
				action: "Open the Tool pocket",
			},
			pack: {
				story: "Rosie brought Home the Glowroot's delicate glowing leaf-print.",
				next: "A Carrier lets Rosie protect the Seed on the way Home.",
				action: "Open the Carrier pocket",
			},
		};
	return routeCopy[state.nearDiscoveryReason] ?? {
		story: "Rosie recorded a promising route in the Field Guide.",
		next: "A different Bag choice can reveal more on the next outing.",
		action: "Open Rosie’s Bag",
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
export const JOURNEY_HOMEWARD_RATIO = 0.75;
const DEPARTURE_MS = 1_000;
const REDUCED_MOTION_DEPARTURE_MS = 120;

function event(kind, detail, at) {
	return { kind, detail, at };
}

export function createInitialState({ now = Date.now(), reduceMotion = false } = {}) {
	return {
		version: 2,
		prototypePosition: 1,
		stage: STAGES.STARTING,
		readyToTickle: 24,
		ticklesEarned: 1119,
		hasTickled: false,
		meaningfulChangePending: false,
		changeRevealed: false,
		purpose: null,
		selectedAdventureOpportunityId: null,
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
		bag: { ...EMPTY_BAG },
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

export function createPrototypeState(position, {
	now = Date.now(),
	reduceMotion = false,
	journeyPhase = "trail",
	adventureRoute = "glowroot",
	repeatAdventure = false,
} = {}) {
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
		bag: { ...REVIEW_BAG },
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
	const familiarReviewState = {
		...packed,
		selectedAdventureOpportunityId: adventureRoute === "lanternleaf"
			? SECOND_ADVENTURE_OPPORTUNITY.id
			: FIRST_ADVENTURE_OPPORTUNITY.id,
	};
	const familiarReturnedStock = { ...packed.farmStock };
	for (const reward of [
		adventureBaseReturn(familiarReviewState),
		adventureRouteMaterialReturn(familiarReviewState),
		bagReturnReward(packed.bag?.pack ?? null),
		adventureToolReturnBonus(familiarReviewState, packed.bag?.tool ?? null),
	]) {
		if (reward !== null) {
			familiarReturnedStock[reward.itemId] =
				(familiarReturnedStock[reward.itemId] ?? 0) + reward.amount;
		}
	}

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
			adventureStartedAt: journeyPhase === "homeward"
				? now - ADVENTURE_MS * 0.8
				: now,
			adventureReadyAt: journeyPhase === "homeward"
				? now + ADVENTURE_MS * 0.2
				: now + ADVENTURE_MS,
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

	const routePreview = [2, 9, 11].includes(target) && adventureRoute === "lanternleaf"
		? {
			daysCompleted: target === 2 ? 2 : 1,
			farmStock: target === 2
				? {
					...presets[target].farmStock,
					"clover-lunch": plantedGlowrootStock["clover-lunch"],
					moonberries: plantedGlowrootStock.moonberries,
					compost: 2,
					"willow-fiber": 4,
				}
				: presets[target].farmStock,
			glowrootKnown: true,
			glowrootPlanted: true,
			nextPlanting: "moonberries",
			fieldGuide: [2, 11].includes(target)
				? [...new Set([
					...presets[target].fieldGuide,
					...FIRST_ADVENTURE_OPPORTUNITY.fieldGuideEntries,
					...SECOND_ADVENTURE_OPPORTUNITY.fieldGuideEntries,
				])]
				: ["Clover Lunch", "Dusk Picnic", "Glowroot Seed"],
		}
		: {};
	const repeatRoutePreview = repeatAdventure && [10, 11].includes(target)
		? {
			daysCompleted: 2,
			glowrootKnown: true,
			glowrootPlanted: true,
			nextPlanting: "moonberries",
			selectedAdventureOpportunityId: adventureRoute === "lanternleaf"
				? SECOND_ADVENTURE_OPPORTUNITY.id
				: FIRST_ADVENTURE_OPPORTUNITY.id,
			farmStock: familiarReturnedStock,
			fieldGuide: [...new Set([
				...presets[target].fieldGuide,
				...FIRST_ADVENTURE_OPPORTUNITY.fieldGuideEntries,
				...SECOND_ADVENTURE_OPPORTUNITY.fieldGuideEntries,
			])],
		}
		: {};

	return {
		...presets[target],
		...routePreview,
		...repeatRoutePreview,
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

function completeCropHarvest(state, { rhythmBonus = false } = {}, now) {
	const rule = cropRule(state.selectedCrop);
	if (rule === null) return state;
	const yieldAmount =
		rule.baseYield +
		(state.compostApplied ? rule.compostYieldBonus : 0) +
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
				[rule.outputId]: (state.farmStock?.[rule.outputId] ?? 0) + yieldAmount,
			},
			prototypePosition: 6,
			fieldGuide: state.fieldGuide.includes(rule.fieldGuideName)
				? state.fieldGuide
				: [...state.fieldGuide, rule.fieldGuideName],
		},
		"harvest",
		rhythmBonus ? `${rule.outputName} +${yieldAmount} · rhythm +1` : `${rule.outputName} +${yieldAmount}`,
		now,
	);
}

function prototypeBagStockAdjustment(position, bag = REVIEW_BAG, selectedAdventureOpportunityId = null) {
	const adjustment = { ...EMPTY_FARM_STOCK };
	const emptySlot = BAG_SLOT_ORDER.find((slot) => bag?.[slot] == null) ?? null;
	const previewState = selectedAdventureOpportunityId
		? { selectedAdventureOpportunityId }
		: {};
	const add = (reward, direction = 1) => {
		if (reward === null) return;
		adjustment[reward.itemId] += reward.amount * direction;
	};

	if (position >= 8) {
		add(REVIEW_BAG.provision === null ? null : {
			itemId: REVIEW_BAG.provision,
			amount: 1,
		}, 1);
		add(bag.provision == null ? null : {
			itemId: bag.provision,
			amount: 1,
		}, -1);
		add(bagPackingCost(REVIEW_BAG.pack), 1);
		add(bagPackingCost(bag.pack ?? null), -1);
	}
	if (position >= 10) {
		if (emptySlot !== null) {
			add(bagReturnReward(REVIEW_BAG.pack), -1);
			add(adventureToolReturnBonus(previewState, REVIEW_BAG.tool), -1);
			add(adventureBaseReturn(previewState), -1);
			add(adventureRouteMaterialReturn(previewState), -1);
			add({ itemId: "compost", amount: 1 }, 1);
			add({ itemId: "willow-fiber", amount: 1 }, 1);
		} else {
			add(bagReturnReward(REVIEW_BAG.pack), -1);
			add(bagReturnReward(bag.pack ?? null), 1);
			add(adventureToolReturnBonus(previewState, REVIEW_BAG.tool), -1);
			add(adventureToolReturnBonus(previewState, bag.tool ?? null), 1);
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
			`${cropRule(state.selectedCrop)?.outputName ?? "Crop"} is ready`,
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

export function adventureJourneyProgress(state, now = Date.now()) {
	if (
		state.stage !== STAGES.ADVENTURE ||
		!Number.isFinite(state.adventureStartedAt) ||
		!Number.isFinite(state.adventureReadyAt) ||
		state.adventureReadyAt <= state.adventureStartedAt
	) return 0;
	return Math.max(
		0,
		Math.min(
			1,
			(now - state.adventureStartedAt) /
				(state.adventureReadyAt - state.adventureStartedAt),
		),
	);
}

export function adventureHomewardAt(state) {
	if (
		!Number.isFinite(state.adventureStartedAt) ||
		!Number.isFinite(state.adventureReadyAt) ||
		state.adventureReadyAt <= state.adventureStartedAt
	) return null;
	return state.adventureStartedAt +
		(state.adventureReadyAt - state.adventureStartedAt) * JOURNEY_HOMEWARD_RATIO;
}

export function adventureJourneyPhase(state, now = Date.now()) {
	if (state.stage !== STAGES.ADVENTURE) return null;
	if (state.adventureComplete || adventureJourneyProgress(state, now) >= 1) return "home";
	return adventureJourneyProgress(state, now) >= JOURNEY_HOMEWARD_RATIO
		? "homeward"
		: "trail";
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

		case ACTIONS.CHOOSE_ADVENTURE_ROUTE:
			if (
				!state.hasTickled ||
				state.stage !== STAGES.STARTING ||
				state.selectedCrop ||
				state.selectedAdventureOpportunityId ||
				!canChooseKnownAdventureRoute(state)
			) return state;
			if (![FIRST_ADVENTURE_OPPORTUNITY.id, SECOND_ADVENTURE_OPPORTUNITY.id].includes(action.opportunityId)) {
				return state;
			}
			{
				const selectedOpportunity = action.opportunityId === FIRST_ADVENTURE_OPPORTUNITY.id
					? FIRST_ADVENTURE_OPPORTUNITY
					: SECOND_ADVENTURE_OPPORTUNITY;
				return changed(
					state,
					{ selectedAdventureOpportunityId: selectedOpportunity.id },
					"choose-route",
					selectedOpportunity.name,
					now,
				);
			}

		case ACTIONS.SELECT_CROP:
		case ACTIONS.CHOOSE_PURPOSE:
			if (!state.hasTickled || state.stage !== STAGES.STARTING) return state;
			if (state.selectedCrop) return state;
			if (canChooseKnownAdventureRoute(state) && !state.selectedAdventureOpportunityId) return state;
			{
				const selectedCrop = action.type === ACTIONS.SELECT_CROP ? action.crop : "clover";
				const rule = cropRule(selectedCrop);
				if (
					(action.type === ACTIONS.CHOOSE_PURPOSE && action.purpose !== "dusk-picnic") ||
					rule === null ||
					!cropIsAvailable(state, selectedCrop)
				) return state;
			return changed(
				state,
				{
					purpose: "dusk-picnic",
					selectedCrop,
					compostApplied: false,
					prototypePosition: 3,
				},
				action.type === ACTIONS.SELECT_CROP ? "select-crop" : "choose-purpose",
				selectedCrop === "moonberries"
					? "Moonberries from Bed 2 for the reflected trail"
					: "Clover Seed for the Dusk Picnic",
				now,
			);
			}

		case ACTIONS.TOGGLE_COMPOST:
			if (
				state.stage !== STAGES.STARTING ||
				state.prototypePosition !== 3 ||
				cropRule(state.selectedCrop) === null
			) {
				return state;
			}
			if (!state.compostApplied && (state.farmStock?.compost ?? 0) < 1) return state;
			return changed(
				state,
				{ compostApplied: !state.compostApplied },
				"toggle-compost",
				state.compostApplied
					? "Compost saved for later"
					: `Compost will help ${cropRule(state.selectedCrop).name}`,
				now,
			);

		case ACTIONS.PLANT_CROP:
		case ACTIONS.PLANT_CLOVER:
			if (
				state.stage !== STAGES.STARTING ||
				state.purpose !== "dusk-picnic" ||
				cropRule(state.selectedCrop) === null ||
				!cropIsAvailable(state, state.selectedCrop)
			) {
				return state;
			}
			{
				const rule = cropRule(state.selectedCrop);
				const compostUsed = state.compostApplied && (state.farmStock?.compost ?? 0) > 0;
				const duration = compostUsed ? rule.compostDurationMs : rule.baseDurationMs;
				const farmStock = {
					...state.farmStock,
					compost: state.farmStock.compost - (compostUsed ? 1 : 0),
				};
				if (rule.seedId !== null) farmStock[rule.seedId] -= 1;
			return changed(
				state,
				{
					stage: STAGES.CLOVER_GROWING,
					prototypePosition: 4,
					compostApplied: compostUsed,
					farmStock,
					plantedAt: now,
					readyAt: now + duration,
				},
				"plant",
				`${rule.outputName}${compostUsed ? " with Compost" : " without Compost"}`,
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
			const harvestPattern = cropHarvestPattern(state);
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.changeRevealed ||
				state.cloverHarvested ||
				!harvestPattern.includes(action.direction)
			) {
				return state;
			}
			const beatIndex = state.harvestBeats?.length ?? 0;
			if (beatIndex >= harvestPattern.length) return state;
			const previousBeat = state.harvestBeats?.at(-1) ?? null;
			const correct = action.direction === harvestPattern[beatIndex];
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
			if (harvestBeats.length === harvestPattern.length) {
				return completeCropHarvest(beatState, { rhythmBonus: eligible }, now);
			}
			return changed(
				state,
				{ harvestBeats, harvestRhythmEligible: eligible },
				"harvest-beat",
				`${action.direction}${correct ? "" : " · steady harvest"}`,
				now,
			);
		}

		case ACTIONS.HARVEST_CROP:
		case ACTIONS.HARVEST_CLOVER:
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.changeRevealed ||
				state.cloverHarvested
			) {
				return state;
			}
			return completeCropHarvest(state, { rhythmBonus: false }, now);

		case ACTIONS.OPEN_BAG_SELECTION:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			return changed(
				state,
				{ prototypePosition: 7 },
				"open-bag-selection",
				"Choose one Provision, Tool, and Carrier",
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
			if (
				state.stage !== STAGES.CLOVER_READY ||
				!state.cloverHarvested ||
				state.prototypePosition !== 7
			) {
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
				`${BAG_SLOT_ORDER.map((slot) => bagItem(slot, state.bag?.[slot])?.name ?? `Empty ${BAG_SLOT_PUBLIC_NAMES[slot]}`).join(" + ")}${provisionId ? " · spent 1 Provision" : ""}${packingCost ? ` · spent ${packingCost.amount} ${packingCost.name}` : ""}`,
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
			const baseReturn = adventureBaseReturn(state);
			const routeMaterial = adventureRouteMaterialReturn(state);
			const returnReward = bagReturnReward(state.bag?.pack ?? null);
			const toolBonus = adventureToolReturnBonus(state, state.bag?.tool ?? null);
			const farmStock = { ...state.farmStock };
			for (const reward of [baseReturn, routeMaterial, returnReward, toolBonus]) {
				if (reward !== null) {
					farmStock[reward.itemId] = (farmStock[reward.itemId] ?? 0) + reward.amount;
				}
			}
			const returnLedger = adventureReturnLedger(state);
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
				returnLedger.map((row) => `${row.name} +${row.amount} · ${row.causes.join(" · ")}`).join(" — "),
				now,
			);

		case ACTIONS.ACKNOWLEDGE_RETURN:
			if (state.stage !== STAGES.GLOWROOT_RETURNED || state.returnRewardAcknowledged) {
				return state;
			}
			if (state.glowrootPlanted) {
				const storedPackReward = bagReturnReward(state.bag?.pack ?? null);
				const storedBaseReturn = adventureBaseReturn(state);
				const storedToolBonus = adventureToolReturnBonus(state, state.bag?.tool ?? null);
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
					`${storedBaseReturn.name} can begin the next crop · ${storedPackReward ? `${storedPackReward.name} +${storedPackReward.amount}` : "no Carrier supply"} · ${storedToolBonus ? `${storedToolBonus.name} +${storedToolBonus.amount} Tool bonus` : "no Tool bonus"}`,
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
			{
				const guide = nearDiscoveryGuide(state);
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
				guide.action,
				now,
			);
			}

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
				const currentPosition = normalizePrototypePosition(state.prototypePosition ?? 1);
				if (
					currentPosition === 4 &&
					action.position === 5 &&
					state.stage === STAGES.CLOVER_GROWING &&
					cropRule(state.selectedCrop) !== null
				) {
					return changed(
						state,
						{
							stage: STAGES.CLOVER_READY,
							prototypePosition: 5,
							readyAt: now,
							meaningfulChangePending: false,
							changeRevealed: true,
						},
						"growth-fast-forward",
						`${cropRule(state.selectedCrop).outputName} ready`,
						now,
					);
				}
				const previewOpportunity = adventureOpportunity(state);
				const next = createPrototypeState(action.position, { now, reduceMotion: state.reduceMotion });
				const emptySlot = BAG_SLOT_ORDER.find((slot) => state.bag?.[slot] == null) ?? null;
				const underprepared = emptySlot !== null;
				const currentPreset = createPrototypeState(currentPosition, { now, reduceMotion: state.reduceMotion });
				const selectedAdventureOpportunityId = state.selectedAdventureOpportunityId;
				const currentBagAdjustment = prototypeBagStockAdjustment(currentPosition, state.bag, selectedAdventureOpportunityId);
				const nextBagAdjustment = prototypeBagStockAdjustment(action.position, state.bag, selectedAdventureOpportunityId);
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
						selectedAdventureOpportunityId: state.selectedAdventureOpportunityId,
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
		if (![1, 2].includes(parsed?.version) || !Object.values(STAGES).includes(parsed.stage)) {
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
		const legacyUntouchedFirstBag =
			parsed.version === 1 &&
			parsed.stage === STAGES.CLOVER_READY &&
			(parsed.prototypePosition ?? 1) <= 7 &&
			parsed.lastBagSelection == null &&
			parsed.bag?.provision === REVIEW_BAG.provision &&
			parsed.bag?.tool === REVIEW_BAG.tool &&
			parsed.bag?.pack === REVIEW_BAG.pack;
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
				version: 2,
				selectedAdventureOpportunityId: [
					FIRST_ADVENTURE_OPPORTUNITY.id,
					SECOND_ADVENTURE_OPPORTUNITY.id,
				].includes(parsed.selectedAdventureOpportunityId)
					? parsed.selectedAdventureOpportunityId
					: null,
				bag: legacyUntouchedFirstBag
					? { ...EMPTY_BAG }
					: { ...initial.bag, ...parsed.bag },
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
		if (canChooseKnownAdventureRoute(state) && !state.selectedAdventureOpportunityId) {
			return {
				type: ACTIONS.CHOOSE_ADVENTURE_ROUTE,
				opportunityId: FIRST_ADVENTURE_OPPORTUNITY.id,
				label: "Choose today’s route",
			};
		}
		return {
			type: ACTIONS.SELECT_CROP,
			crop: "clover",
			label: "Choose what to grow",
		};
	}
	if (state.stage === STAGES.STARTING) {
		const rule = cropRule(state.selectedCrop);
		return {
			type: ACTIONS.PLANT_CROP,
			label: state.compostApplied
				? `${state.selectedCrop === "moonberries" ? "Tend" : "Plant"} with Compost`
				: `${state.selectedCrop === "moonberries" ? "Tend" : "Plant"} ${rule?.name ?? "crop"}`,
		};
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		return { type: ACTIONS.ADVANCE_TIME, label: "Let the afternoon pass" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		return { type: ACTIONS.TICKLE, label: "Tickle Rosie" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return { type: ACTIONS.HARVEST_CROP, label: "Gather normally" };
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
			return { type: ACTIONS.CONTINUE_ADVENTURE_STORY, label: "The journey continues…" };
		}
		return { type: ACTIONS.ADVANCE_TIME, label: "Fast-forward to Homecoming" };
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
				label: state.glowrootPlanted ? "Keep supplies in Farm stock" : "Take Seed to Bed 3",
			};
		}
		return { type: ACTIONS.PLANT_GLOWROOT, label: "Plant Glowroot" };
	}
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		return { type: ACTIONS.RETRY_PREP, label: nearDiscoveryGuide(state).action };
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
		if (canChooseKnownAdventureRoute(state) && !state.selectedAdventureOpportunityId) {
			return {
				target: WORLD_TARGETS.HEDGE,
				objective: "Rosie’s map",
				detail: "Choose a familiar route",
				label: "Choose today’s route",
				action,
			};
		}
		return {
			target: WORLD_TARGETS.PATCH,
			objective: opportunity.name,
			detail: opportunity.growDetail,
			label: state.daysCompleted > 0 ? "Choose what to grow" : "Choose Clover Seed",
			action,
		};
	}
	if (state.stage === STAGES.STARTING) {
		const rule = cropRule(state.selectedCrop);
		const promisedYield =
			rule.baseYield +
			(state.compostApplied ? rule.compostYieldBonus : 0);
		const durationHours = (state.compostApplied ? rule.compostDurationMs : rule.baseDurationMs) / (60 * 60 * 1000);
		return {
			target: state.selectedCrop === "moonberries" ? WORLD_TARGETS.MOONBERRY_BED : WORLD_TARGETS.PATCH,
			objective: opportunity.plantingObjective,
			detail: `${rule.outputName} ×${promisedYield} · ready in ${durationHours}h`,
			label: action.label,
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		const rule = cropRule(state.selectedCrop);
		const durationHours = (state.compostApplied ? rule.compostDurationMs : rule.baseDurationMs) / (60 * 60 * 1000);
		return {
			target: state.selectedCrop === "moonberries" ? WORLD_TARGETS.MOONBERRY_BED : WORLD_TARGETS.PATCH,
			objective: opportunity.growingObjective,
			detail: `${state.compostApplied ? "Composted" : "Growing"} · ready in ${durationHours}h`,
				label: "Growing",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		const rule = cropRule(state.selectedCrop);
		const cropName = rule?.name ?? "the crop";
		const cropPossessive = `${cropName}${cropName.endsWith("s") ? "’" : "'s"}`;
		return {
			target: WORLD_TARGETS.ROSIE,
			objective: `${rule?.outputName ?? "Crop"} ${state.selectedCrop === "moonberries" ? "are" : "is"} ready`,
			detail: `Tickle Rosie to begin ${cropPossessive} harvest rhythm`,
			label: "Tickle Rosie",
			action,
		};
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		const rule = cropRule(state.selectedCrop);
		return {
			target: state.selectedCrop === "moonberries" ? WORLD_TARGETS.MOONBERRY_BED : WORLD_TARGETS.PATCH,
			objective: opportunity.harvestObjective,
			detail: `${rule.name} rhythm: ${cropHarvestPatternLabel(state)}`,
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
				label: "The journey continues…",
				action,
			};
		}
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: opportunity.waitingObjective,
			label: "Fast-forward to Homecoming",
			action,
		};
	}
	if (state.stage === STAGES.ADVENTURE) {
		return {
			target: WORLD_TARGETS.HEDGE,
			objective: "Rosie is Home",
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
					objective: state.selectedAdventureOpportunityId
						? `${opportunity.name} revisited`
						: `${opportunity.discoveryName} is mapped`,
					label: "Keep supplies in Farm stock",
					action,
				};
			}
			return {
				target: WORLD_TARGETS.GLOWROOT_BED,
				objective: "Glowroot can change the Farm",
				label: "Take Seed to Bed 3",
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
		const guide = nearDiscoveryGuide(state);
		return {
			target: WORLD_TARGETS.BAG,
			objective: `${opportunity.clueName} · Field Guide`,
			label: guide.action,
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
