import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	ACTIONS,
	adventureHomewardAt,
	adventureJourneyPhase,
	adventureJourneyProgress,
	adventureOpportunity,
	adventureStory,
	BAG_ITEMS,
	CROP_RULES,
	createInitialState,
	createPrototypeState,
	deserializeState,
	DURATIONS,
	FIRST_ADVENTURE_OPPORTUNITY,
	HARVEST_BEAT_MS,
	HARVEST_PATTERN,
	homegrownReducer,
	JOURNEY_HOMEWARD_RATIO,
	playerPresentation,
	PROTOTYPE_POSITIONS,
	primaryAction,
	serializeState,
	SECOND_ADVENTURE_OPPORTUNITY,
	settleState,
	STAGES,
	WORLD_TARGETS,
} from "./game.mjs";
import {
	CLOVER_LUSH_THRESHOLD,
	homegrownRiveModel,
} from "./homegrownRiveModel.mjs";

const at = 1_000_000;
const reduce = (state, action) => homegrownReducer(state, { now: at, ...action });
const appSource = readFileSync(fileURLToPath(new URL("./app.web.tsx", import.meta.url)), "utf8");
const stylesSource = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const riveSceneSource = readFileSync(fileURLToPath(new URL("../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web.tsx", import.meta.url)), "utf8");
const riveContractSource = readFileSync(fileURLToPath(new URL("../../../components/prototypes/homegrown-adventures/homegrownRiveContract.ts", import.meta.url)), "utf8");

function throughCloverReady() {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" });
	state = reduce(state, { type: ACTIONS.TOGGLE_COMPOST });
	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	return state;
}

function throughSecondMorning() {
	let state = throughCloverReady();
	for (const action of [
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.WELCOME_HOME },
		{ type: ACTIONS.ACKNOWLEDGE_RETURN },
		{ type: ACTIONS.PLANT_GLOWROOT },
		{ type: ACTIONS.PLANT_NEXT, crop: "moonberries" },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.START_NEW_DAY },
		{ type: ACTIONS.TICKLE },
	]) state = reduce(state, action);
	return state;
}

function throughSecondBag() {
	let state = throughSecondMorning();
	for (const action of [
		{ type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" },
		{ type: ACTIONS.PLANT_CLOVER },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.OPEN_BAG_SELECTION },
	]) state = reduce(state, action);
	return state;
}

test("the complete happy path reaches a developed Barn", () => {
	let state = throughCloverReady();
	assert.equal(state.stage, STAGES.CLOVER_READY);
	assert.equal(state.meaningfulChangePending, true);

	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	state = reduce(state, { type: ACTIONS.PLANT_GLOWROOT });

	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(state.prototypePosition, 11);
	assert.equal(state.glowrootKnown, true);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(state.farmStock["glowroot-seed"], 1);
	assert.deepEqual(state.fieldGuide, ["Clover Lunch", "Dusk Picnic", "Glowroot Seed"]);
	assert.equal(state.readyToTickle, 22);
	assert.equal(state.ticklesEarned, 1121);
});

test("every gated transition rejects an invalid action without mutation", () => {
	const initial = createInitialState({ now: at });
	const invalid = [
		{ type: ACTIONS.PLANT_CLOVER },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.WELCOME_HOME },
		{ type: ACTIONS.PLANT_GLOWROOT },
		{ type: ACTIONS.PLANT_NEXT, crop: "coins" },
		{ type: "unknown" },
	];

	for (const action of invalid) assert.equal(reduce(initial, action), initial);
});

test("purpose is asked before crop and only the named purpose is accepted", () => {
	let state = createInitialState({ now: at });
	assert.equal(reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" }), state);
	state = reduce(state, { type: ACTIONS.TICKLE });
	assert.equal(reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "coins" }), state);
	state = reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" });
	assert.equal(state.purpose, "dusk-picnic");
	assert.equal(state.selectedCrop, "clover");
});

test("Clover requires a Seed and leaves its predictable Compost boost freely chosen", () => {
	let state = createInitialState({ now: at });
	assert.equal(state.farmStock["clover-seed"], 3);
	assert.equal(state.farmStock.compost, 2);
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.SELECT_CROP, crop: "clover" });

	assert.equal(state.prototypePosition, 3);
	assert.equal(state.selectedCrop, "clover");
	assert.equal(state.compostApplied, false);
	assert.equal(reduce(state, { type: ACTIONS.SELECT_CROP, crop: "clover" }), state);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PLANT_CLOVER,
		label: "Plant Clover",
	});
	state = reduce(state, { type: ACTIONS.TOGGLE_COMPOST });
	assert.equal(state.compostApplied, true);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PLANT_CLOVER,
		label: "Plant with Compost",
	});

	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	assert.equal(state.farmStock["clover-seed"], 2);
	assert.equal(state.farmStock.compost, 1);
	assert.equal(state.readyAt - state.plantedAt, DURATIONS.COMPOSTED_GROWTH_MS);
	assert.equal(homegrownRiveModel(state).trigger, "plant-composted");
});

test("saving Compost keeps the normal duration and normal yield", () => {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.SELECT_CROP, crop: "clover" });
	assert.equal(state.compostApplied, false);

	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	assert.equal(state.farmStock["clover-seed"], 2);
	assert.equal(state.farmStock.compost, 2);
	assert.equal(state.readyAt - state.plantedAt, DURATIONS.GROWTH_MS);
	assert.equal(homegrownRiveModel(state).trigger, "plant");
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });
	assert.equal(state.lastHarvestYield, CROP_RULES.clover.baseYield);
	assert.equal(state.farmStock["clover-lunch"], CROP_RULES.clover.baseYield);
});

test("Compost shortens growth and adds exactly one guaranteed harvest item", () => {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.SELECT_CROP, crop: "clover" });
	state = reduce(state, { type: ACTIONS.TOGGLE_COMPOST });
	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });

	assert.equal(state.lastHarvestYield, CROP_RULES.clover.baseYield + 1);
	assert.equal(state.farmStock["clover-lunch"], CROP_RULES.clover.baseYield + 1);
});

test("Clover's left-right-up rhythm adds one small bonus to the guaranteed harvest", () => {
	let state = throughCloverReady();
	state = reduce(state, { type: ACTIONS.TICKLE });
	for (const [index, direction] of HARVEST_PATTERN.entries()) {
		state = reduce(state, {
			type: ACTIONS.HARVEST_BEAT,
			direction,
			now: at + index * 400,
		});
	}

	assert.equal(state.cloverHarvested, true);
	assert.equal(state.prototypePosition, 6);
	assert.equal(state.harvestRhythmBonus, true);
	assert.equal(state.harvestCompletedAt, at + 800);
	assert.equal(state.lastHarvestYield, 5);
	assert.equal(state.farmStock["clover-lunch"], 5);
	assert.match(state.trace.at(-1).detail, /rhythm \+1/);
	assert.equal(
		reduce(state, { type: ACTIONS.HARVEST_BEAT, direction: "left", now: at + 1_600 }),
		state,
	);
});

test("an imperfect or slow rhythm still grants the complete base and Compost harvest", () => {
	for (const beats of [
		[
			["left", at],
			["up", at + 400],
			["up", at + 800],
		],
		[
			["left", at],
			["right", at + HARVEST_BEAT_MS + 1],
			["up", at + HARVEST_BEAT_MS + 401],
		],
	]) {
		let state = throughCloverReady();
		state = reduce(state, { type: ACTIONS.TICKLE });
		for (const [direction, now] of beats) {
			state = reduce(state, { type: ACTIONS.HARVEST_BEAT, direction, now });
		}
		assert.equal(state.cloverHarvested, true);
		assert.equal(state.harvestRhythmBonus, false);
		assert.equal(state.lastHarvestYield, 4);
		assert.equal(state.farmStock["clover-lunch"], 4);
	}
});

test("the accessible normal gather fallback never loses the ready crop", () => {
	let state = throughCloverReady();
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });
	assert.equal(state.cloverHarvested, true);
	assert.equal(state.harvestCompletedAt, at);
	assert.equal(state.harvestRhythmBonus, false);
	assert.equal(state.lastHarvestYield, 4);
	assert.equal(state.farmStock["clover-lunch"], 4);
});

test("planting is rejected without a Seed and Compost cannot be selected when empty", () => {
	let state = createPrototypeState(3, { now: at });
	state = {
		...state,
		compostApplied: false,
		farmStock: { ...state.farmStock, "clover-seed": 0, compost: 0 },
	};
	assert.equal(reduce(state, { type: ACTIONS.TOGGLE_COMPOST }), state);
	assert.equal(reduce(state, { type: ACTIONS.PLANT_CLOVER }), state);
});

test("settlement is idempotent for crops and adventures", () => {
	let crop = throughCloverReady();
	assert.equal(settleState(crop, at + 99_000), crop);

	crop = reduce(crop, { type: ACTIONS.TICKLE });
	crop = reduce(crop, { type: ACTIONS.HARVEST_CLOVER });
	crop = reduce(crop, { type: ACTIONS.PACK_ADVENTURE });
	let adventure = reduce(crop, { type: ACTIONS.START_ADVENTURE });
	adventure = reduce(adventure, { type: ACTIONS.ADVANCE_TIME });
	assert.equal(settleState(adventure, at + 99_000), adventure);
	assert.equal(
		adventure.trace.filter(
			({ kind, detail }) => kind === "settle" && detail === "Rosie is waiting at the hedge",
		).length,
		1,
	);
});

test("persisted state resumes and settles elapsed time", () => {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" });
	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	const restored = deserializeState(serializeState(state), { now: state.readyAt });
	assert.equal(restored.stage, STAGES.CLOVER_READY);
	assert.equal(restored.meaningfulChangePending, true);
});

test("malformed and future persisted data reset safely", () => {
	assert.equal(deserializeState("not-json", { now: at }).stage, STAGES.STARTING);
	assert.equal(deserializeState('{"version":2,"stage":"starting"}', { now: at }).stage, STAGES.STARTING);
});

test("legacy developed saves infer the lasting Glowroot Home upgrade", () => {
	const legacy = createPrototypeState(11, { now: at });
	delete legacy.glowrootPlanted;
	const restored = deserializeState(serializeState(legacy), { now: at });
	assert.equal(restored.glowrootPlanted, true);
	assert.equal(homegrownRiveModel(restored).viewModel.hedgeCrossingOpen, true);
});

test("direct review presets are deterministic", () => {
	const initial = createInitialState({ now: at });
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "ready" }).stage, STAGES.CLOVER_READY);
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "developed" }).stage, STAGES.DEVELOPED);
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "missing" }), initial);
});

test("developed Barn records the player's next purposeful planting", () => {
	let state = reduce(createInitialState({ now: at }), { type: ACTIONS.JUMP_TO_STATE, target: "developed" });
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "empty");
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PLANT_NEXT,
		crop: "moonberries",
		label: "Grow Moonberries for the moths",
	});
	state = reduce(state, { type: ACTIONS.PLANT_NEXT, crop: "moonberries" });
	assert.equal(state.nextPlanting, "moonberries");
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "growing");
	assert.equal(state.trace.at(-1).kind, "next-planting");
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.TICKLE,
		label: "Tickle Rosie with the moths",
	});
});

test("the end-to-end mode completes a Barn day and starts the next one", () => {
	let state = throughCloverReady();
	for (const action of [
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.WELCOME_HOME },
		{ type: ACTIONS.ACKNOWLEDGE_RETURN },
		{ type: ACTIONS.PLANT_GLOWROOT },
		{ type: ACTIONS.PLANT_NEXT, crop: "moonberries" },
		{ type: ACTIONS.TICKLE },
	]) state = reduce(state, action);

	assert.equal(state.cycleComplete, true);
	assert.ok(state.fieldGuide.includes("Moonberries"));
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.START_NEW_DAY,
		label: "Begin another day",
	});

	const tickles = state.ticklesEarned;
	const stock = { ...state.farmStock };
	const bag = { ...state.bag };
	state = reduce(state, { type: ACTIONS.START_NEW_DAY });
	assert.equal(state.stage, STAGES.STARTING);
	assert.equal(state.cycleComplete, false);
	assert.equal(state.daysCompleted, 1);
	assert.equal(state.ticklesEarned, tickles);
	assert.deepEqual(state.farmStock, stock);
	assert.deepEqual(state.bag, bag);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(state.nextPlanting, "moonberries");
	assert.equal(homegrownRiveModel(state).viewModel.hedgeCrossingOpen, true);
	assert.equal(homegrownRiveModel(state).viewModel.hedgeBellEarned, true);
	assert.deepEqual(
		[
			homegrownRiveModel(state).viewModel.bedOneState,
			homegrownRiveModel(state).viewModel.bedTwoState,
			homegrownRiveModel(state).viewModel.bedThreeState,
		],
		["empty", "growing", "sprout"],
	);
	assert.equal(state.lastAction, "new-day");

	state = reduce(state, { type: ACTIONS.TICKLE });
	assert.equal(state.prototypePosition, 2);
	assert.equal(state.daysCompleted, 1);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(state.nextPlanting, "moonberries");
	const secondMorning = deserializeState(serializeState(state), { now: at });
	assert.equal(secondMorning.prototypePosition, 2);
	assert.equal(secondMorning.glowrootPlanted, true);
	assert.equal(secondMorning.nextPlanting, "moonberries");

	const fastForwarded = reduce(secondMorning, {
		type: ACTIONS.JUMP_TO_POSITION,
		position: 4,
	});
	assert.equal(fastForwarded.prototypePosition, 4);
	assert.equal(fastForwarded.daysCompleted, 1);
	assert.equal(fastForwarded.glowrootPlanted, true);
	assert.equal(
		fastForwarded.farmStock["clover-seed"],
		secondMorning.dayStartFarmStock["clover-seed"] - 1,
	);
	assert.equal(
		fastForwarded.farmStock.compost,
		secondMorning.dayStartFarmStock.compost - 1,
	);
	assert.equal(
		fastForwarded.farmStock["clover-lunch"],
		secondMorning.dayStartFarmStock["clover-lunch"],
	);
	assert.deepEqual(
		[
			homegrownRiveModel(fastForwarded).viewModel.bedOneState,
			homegrownRiveModel(fastForwarded).viewModel.bedTwoState,
			homegrownRiveModel(fastForwarded).viewModel.bedThreeState,
		],
		["growing", "growing", "sprout"],
	);
});

test("Glowroot opens a distinct second opportunity across purpose, Bag, journey, and return", () => {
	let state = throughSecondMorning();
	assert.equal(adventureOpportunity(state), SECOND_ADVENTURE_OPPORTUNITY);
	assert.equal(playerPresentation(state).objective, SECOND_ADVENTURE_OPPORTUNITY.name);
	assert.equal(playerPresentation(state).detail, SECOND_ADVENTURE_OPPORTUNITY.growDetail);
	assert.match(state.fieldGuide.join(" · "), /Glowroot Seed/);

	state = throughSecondBag();
	assert.equal(state.prototypePosition, 7);
	assert.equal(playerPresentation(state).objective, "Lights Past the Open Gate");
	assert.equal(playerPresentation(state).detail, "Nightfall · reflected leaves · gentle wrap");
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PACK_ADVENTURE,
		label: "Pack for the gate lights",
	});
	assert.ok(state.farmStock["willow-fiber"] >= 1);

	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(playerPresentation(state).label, "Follow the gate lights");
	const stockBeforeReturn = { ...state.farmStock };

	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	const story = adventureStory(state);
	assert.equal(story.opportunity, SECOND_ADVENTURE_OPPORTUNITY);
	assert.equal(story.headline, "Rosie found the Lanternleaf Path");
	assert.match(story.tags[0].detail, /nightfall/);
	assert.match(story.tags[1].detail, /reflected leaves/);
	assert.match(story.tags[2].detail, /delicate leaves/);
	assert.match(state.trace.at(-1).detail, /Lights Past the Open Gate began/);

	state = settleState(state, state.departureReadyAt);
	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.ADVANCE_TIME,
		label: "Fast-forward to Homecoming",
	});
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });

	assert.equal(state.stage, STAGES.GLOWROOT_RETURNED);
	assert.ok(state.fieldGuide.includes("Lanternleaf Path"));
	assert.equal(state.fieldGuide.filter((entry) => entry === "Lanternleaf Path").length, 1);
	assert.equal(state.farmStock["glowroot-seed"], stockBeforeReturn["glowroot-seed"] + 1);
	assert.equal(state.farmStock["willow-fiber"], stockBeforeReturn["willow-fiber"] + 3);
	assert.equal(state.farmStock["clover-seed"], stockBeforeReturn["clover-seed"] + 1);
	assert.equal(state.farmStock.compost, stockBeforeReturn.compost);
	assert.equal(playerPresentation(state).objective, "Lanternleaf Path is mapped");

	const restored = deserializeState(serializeState(state), { now: at });
	assert.equal(adventureOpportunity(restored), SECOND_ADVENTURE_OPPORTUNITY);
	assert.ok(restored.fieldGuide.includes("Lanternleaf Path"));
	state = reduce(restored, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(state.cycleComplete, true);
});

test("an incomplete Bag finds the Lanternleaf clue without granting the route", () => {
	let state = throughSecondBag();
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	const stockBeforeReturn = { ...state.farmStock };
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });

	const story = adventureStory(state);
	assert.equal(story.kind, "near-discovery");
	assert.match(story.headline, /start of a new path/);
	assert.match(story.tags[2].detail, /left its supplies safe/);

	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.ok(state.fieldGuide.includes("Lanternleaf trail (clue)"));
	assert.ok(!state.fieldGuide.includes("Lanternleaf Path"));
	assert.equal(state.farmStock["glowroot-seed"], stockBeforeReturn["glowroot-seed"]);
	assert.equal(state.farmStock.compost, stockBeforeReturn.compost + 1);
	assert.equal(state.farmStock["willow-fiber"], stockBeforeReturn["willow-fiber"] + 1);
	assert.equal(playerPresentation(state).objective, "A Pack can carry trail supplies");
});

test("a known Glowroot return stays in Farm stock and completes the second day", () => {
	let state = throughCloverReady();
	for (const action of [
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.WELCOME_HOME },
		{ type: ACTIONS.ACKNOWLEDGE_RETURN },
		{ type: ACTIONS.PLANT_GLOWROOT },
		{ type: ACTIONS.PLANT_NEXT, crop: "moonberries" },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.START_NEW_DAY },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" },
		{ type: ACTIONS.PLANT_CLOVER },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.ADVANCE_TIME },
	]) state = reduce(state, action);

	const stockBeforeReturn = { ...state.farmStock };
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });

	assert.equal(state.stage, STAGES.GLOWROOT_RETURNED);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(state.farmStock["glowroot-seed"], stockBeforeReturn["glowroot-seed"] + 2);
	assert.equal(state.farmStock.compost, stockBeforeReturn.compost + 1);
	assert.equal(state.farmStock["willow-fiber"], stockBeforeReturn["willow-fiber"] + 2);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.ACKNOWLEDGE_RETURN,
		label: "Keep supplies in Farm stock",
	});

	state = deserializeState(serializeState(state), { now: at });
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.ACKNOWLEDGE_RETURN,
		label: "Keep supplies in Farm stock",
	});
	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });

	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(state.prototypePosition, 11);
	assert.equal(state.cycleComplete, true);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(state.farmStock["glowroot-seed"], stockBeforeReturn["glowroot-seed"] + 2);
	assert.equal(state.trace.at(-1).kind, "store-return");
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.START_NEW_DAY,
		label: "Begin another day",
	});

	const restored = deserializeState(serializeState(state), { now: at });
	assert.equal(restored.stage, STAGES.DEVELOPED);
	assert.equal(restored.cycleComplete, true);
	assert.equal(restored.farmStock["glowroot-seed"], stockBeforeReturn["glowroot-seed"] + 2);
});

test("underpreparation returns a kind Near-Discovery and a useful retry clue", () => {
	let state = throughCloverReady();
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });
	state = reduce(state, { type: ACTIONS.PACK_LIGHT });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.equal(state.glowrootKnown, false);
	assert.ok(state.fieldGuide.includes("Glowroot trail (clue)"));
	assert.ok(!state.fieldGuide.includes("Glowroot Seed"));
	state = reduce(state, { type: ACTIONS.RETRY_PREP });
	assert.equal(state.stage, STAGES.CLOVER_READY);
	assert.equal(state.cloverHarvested, true);
});

test("an empty tickle bank rejects extra taps without changing farm progress", () => {
	let state = createInitialState({ now: at });
	for (let index = 0; index < 24; index += 1) {
		state = reduce(state, { type: ACTIONS.TICKLE });
	}
	assert.equal(state.readyToTickle, 0);
	const empty = state;
	assert.equal(reduce(state, { type: ACTIONS.TICKLE }), empty);
	assert.equal(state.ticklesEarned, 1143);
});

test("reduced motion is a presentation setting and reset preserves it", () => {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TOGGLE_REDUCED_MOTION });
	assert.equal(state.reduceMotion, true);
	assert.equal(state.stage, STAGES.STARTING);
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.RESET });
	assert.equal(state.reduceMotion, true);
	assert.equal(state.stage, STAGES.STARTING);
	assert.equal(state.readyToTickle, 24);
});

test("Rive presentation state is derived deterministically from reducer facts", () => {
	let state = createInitialState({ now: at });
	let model = homegrownRiveModel(state);
	assert.deepEqual(
		[
			model.viewModel.bedOneState,
			model.viewModel.bedTwoState,
			model.viewModel.bedThreeState,
		],
		["empty", "empty", "empty"],
	);
	assert.equal(model.viewModel.rosieAction, "idle");
	assert.equal(model.trigger, null);

	state = reduce(state, { type: ACTIONS.TICKLE });
	model = homegrownRiveModel(state);
	assert.equal(model.viewModel.rosieMood, "happy");
	assert.equal(model.viewModel.rosieAction, "tickle");
	assert.equal(model.trigger, "tickle");

	state = reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" });
	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	model = homegrownRiveModel(state, at);
	assert.deepEqual(
		[
			model.viewModel.bedOneState,
			model.viewModel.bedTwoState,
			model.viewModel.bedThreeState,
		],
		["sprout", "empty", "empty"],
	);
	assert.equal(model.trigger, "plant");

	const lushAt =
		state.plantedAt +
		(state.readyAt - state.plantedAt) * CLOVER_LUSH_THRESHOLD;
	model = homegrownRiveModel(state, lushAt);
	assert.equal(model.viewModel.bedOneState, "growing");
});

test("Rive developed state exposes lasting Home consequences after the named crop", () => {
	let state = reduce(createInitialState({ now: at }), {
		type: ACTIONS.JUMP_TO_STATE,
		target: "developed",
	});
	let { viewModel } = homegrownRiveModel(state);
	assert.equal(viewModel.hedgehogVisible, true);
	assert.equal(viewModel.frogVisible, true);
	assert.equal(viewModel.mothsVisible, false);
	assert.equal(viewModel.hedgeCrossingOpen, true);
	assert.equal(viewModel.hedgeBellEarned, true);
	assert.deepEqual(
		[viewModel.bedOneState, viewModel.bedTwoState, viewModel.bedThreeState],
		["ready", "empty", "sprout"],
	);

	state = reduce(state, { type: ACTIONS.PLANT_NEXT, crop: "moonberries" });
	({ viewModel } = homegrownRiveModel(state));
	assert.equal(viewModel.mothsVisible, true);
	assert.equal(viewModel.bedTwoState, "growing");
});

test("every happy-path state exposes one short spatial action", () => {
	let state = createInitialState({ now: at });
	const observed = [];
	const capture = () => {
		const presentation = playerPresentation(state);
		observed.push(presentation);
		assert.ok(Object.values(WORLD_TARGETS).includes(presentation.target));
		assert.ok(presentation.objective.length <= 38);
		if (presentation.detail) assert.ok(presentation.detail.length <= 46);
		assert.ok(presentation.label.length <= 28);
		assert.deepEqual(presentation.action, primaryAction(state));
	};

	capture();
	for (const action of [
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" },
		{ type: ACTIONS.PLANT_CLOVER },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
		{ type: ACTIONS.PACK_ADVENTURE },
		{ type: ACTIONS.START_ADVENTURE },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.WELCOME_HOME },
		{ type: ACTIONS.ACKNOWLEDGE_RETURN },
		{ type: ACTIONS.PLANT_GLOWROOT },
		{ type: ACTIONS.PLANT_NEXT, crop: "moonberries" },
	]) {
		state = reduce(state, action);
		capture();
	}

	assert.equal(observed[0].target, WORLD_TARGETS.ROSIE);
	assert.equal(observed[1].target, WORLD_TARGETS.PATCH);
	assert.equal(observed[6].target, WORLD_TARGETS.BAG);
	assert.equal(observed[7].target, WORLD_TARGETS.HEDGE);
	assert.equal(observed.at(-1).target, WORLD_TARGETS.ROSIE);
});

test("all eleven prototype positions are valid reload-stable reducer states", () => {
	assert.equal(PROTOTYPE_POSITIONS.length, 11);

	for (const position of PROTOTYPE_POSITIONS) {
		const state = createPrototypeState(position.id, { now: at });
		assert.equal(state.prototypePosition, position.id);
		assert.ok(Object.values(STAGES).includes(state.stage));

		const presentation = playerPresentation(state);
		assert.ok(Object.values(WORLD_TARGETS).includes(presentation.target));
		assert.ok(presentation.objective.length > 0);
		assert.ok(presentation.label.length > 0);

		const reloaded = deserializeState(serializeState(state), { now: at });
		assert.equal(reloaded.prototypePosition, position.id);
		assert.equal(reloaded.stage, state.stage);
	}
});

test("Farm stock opens a distinct Bag-selection position before departure", () => {
	let state = createPrototypeState(6, { now: at });
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.OPEN_BAG_SELECTION,
		label: "Prepare for the glow",
	});

	state = reduce(state, { type: ACTIONS.OPEN_BAG_SELECTION });
	assert.equal(state.prototypePosition, 7);
	assert.equal(playerPresentation(state).objective, FIRST_ADVENTURE_OPPORTUNITY.name);
	assert.equal(playerPresentation(state).detail, FIRST_ADVENTURE_OPPORTUNITY.detail);

	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(state.prototypePosition, 8);
	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(playerPresentation(state).label, "Follow the glow");
});

test("prototype position jumps reject invalid targets without mutation", () => {
	const state = createInitialState({ now: at });
	assert.equal(reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 0 }), state);
	assert.equal(reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 12 }), state);
	assert.equal(reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: "2" }), state);
	assert.equal(
		reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 10 }).prototypePosition,
		10,
	);
});

test("fast-forward applies the exact return delta and triggers one Rive homecoming", () => {
	const adventure = createPrototypeState(9, { now: at });
	const before = { ...adventure.farmStock };
	const returned = reduce(
		adventure,
		{ type: ACTIONS.JUMP_TO_POSITION, position: 10 },
		at + 1,
	);

	assert.equal(returned.farmStock["glowroot-seed"], before["glowroot-seed"] + 2);
	assert.equal(returned.farmStock.compost, before.compost + 1);
	assert.equal(returned.farmStock["willow-fiber"], before["willow-fiber"] + 2);
	assert.equal(homegrownRiveModel(returned).trigger, "return");
	assert.equal(
		reduce(returned, { type: ACTIONS.JUMP_TO_POSITION, position: 10 }, at + 2),
		returned,
	);

	const changedHome = reduce(
		returned,
		{ type: ACTIONS.JUMP_TO_POSITION, position: 11 },
		at + 3,
	);
	assert.equal(changedHome.farmStock["glowroot-seed"], before["glowroot-seed"] + 1);

	const rewound = reduce(
		returned,
		{ type: ACTIONS.JUMP_TO_POSITION, position: 9 },
		at + 4,
	);
	assert.deepEqual(rewound.farmStock, before);
});

test("Bag slots accept owned choices, alternatives, and empty values", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 1 },
	};
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	assert.equal(homegrownRiveModel(state).viewModel.rosieAction, "pack");
	assert.equal(homegrownRiveModel(state).trigger, "bag-receive");
	assert.deepEqual(homegrownRiveModel(state).bagReceive, {
		slot: "tool",
		item: "lantern",
		previousItem: "hand-trowel",
		at: state.lastBagSelection.at,
	});
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "provision", item: null });

	assert.deepEqual(state.bag, {
		provision: null,
		tool: "lantern",
		pack: "cloth-wrap",
	});
	assert.deepEqual(homegrownRiveModel(state).bagReceive, {
		slot: "provision",
		item: null,
		previousItem: "clover-lunch",
		at: state.lastBagSelection.at,
	});
	assert.equal(BAG_ITEMS.tool.length, 2);
	assert.equal(BAG_ITEMS.pack.length, 2);

	const reloaded = deserializeState(serializeState(state), { now: at });
	assert.deepEqual(reloaded.bag, state.bag);
	assert.deepEqual(reloaded.lastBagSelection, state.lastBagSelection);

	const invalid = reduce(state, {
		type: ACTIONS.SET_BAG_SLOT,
		slot: "tool",
		item: "golden-sword",
	});
	assert.equal(invalid, state);
});

test("Cloth Wrap requires and consumes one Willow Fiber as reusable packing material", () => {
	let state = createPrototypeState(7, { now: at });
	assert.equal(state.farmStock["willow-fiber"], 0);
	assert.equal(
		reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" }),
		state,
	);
	const staleSelection = {
		...state,
		bag: { ...state.bag, pack: "cloth-wrap" },
	};
	assert.equal(reduce(staleSelection, { type: ACTIONS.PACK_ADVENTURE }), staleSelection);

	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 2 },
	};
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	assert.equal(state.bag.pack, "cloth-wrap");
	assert.equal(state.farmStock["willow-fiber"], 2);

	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(state.bag.pack, "cloth-wrap");
	assert.equal(state.farmStock["willow-fiber"], 1);
	assert.match(state.trace.at(-1).detail, /spent 1 Willow Fiber/);
	assert.equal(reduce(state, { type: ACTIONS.PACK_ADVENTURE }), state);

	const restored = deserializeState(serializeState(state), { now: at });
	assert.equal(restored.bag.pack, "cloth-wrap");
	assert.equal(restored.farmStock["willow-fiber"], 1);
});

test("Wicker Basket returns Compost while Cloth Wrap preserves a Clover Seed", () => {
	const completeAdventure = (prepared) => {
		let state = reduce(prepared, { type: ACTIONS.PACK_ADVENTURE });
		state = reduce(state, { type: ACTIONS.START_ADVENTURE });
		state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
		state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
		return reduce(state, { type: ACTIONS.WELCOME_HOME });
	};

	const wickerStart = createPrototypeState(7, { now: at });
	const wickerReturn = completeAdventure(wickerStart);
	assert.equal(wickerReturn.farmStock.compost, wickerStart.farmStock.compost + 1);
	assert.equal(wickerReturn.farmStock["clover-seed"], wickerStart.farmStock["clover-seed"]);
	assert.match(adventureStory(wickerReturn).tags[2].detail, /Compost/);

	let clothStart = createPrototypeState(7, { now: at });
	clothStart = {
		...clothStart,
		farmStock: { ...clothStart.farmStock, "willow-fiber": 2 },
	};
	clothStart = reduce(clothStart, {
		type: ACTIONS.SET_BAG_SLOT,
		slot: "pack",
		item: "cloth-wrap",
	});
	const clothReturn = completeAdventure(clothStart);
	assert.equal(clothReturn.farmStock.compost, clothStart.farmStock.compost);
	assert.equal(clothReturn.farmStock["clover-seed"], clothStart.farmStock["clover-seed"] + 1);
	assert.equal(clothReturn.farmStock["willow-fiber"], clothStart.farmStock["willow-fiber"] + 1);
	assert.match(adventureStory(clothReturn).tags[2].detail, /Clover Seed/);
});

test("Hand Trowel returns an extra Glowroot Seed while Lantern returns extra Willow Fiber", () => {
	const completeAdventure = (tool) => {
		let state = createPrototypeState(7, { now: at });
		state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: tool });
		const before = { ...state.farmStock };
		state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
		state = reduce(state, { type: ACTIONS.START_ADVENTURE });
		state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
		state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
		return { before, returned: reduce(state, { type: ACTIONS.WELCOME_HOME }) };
	};

	const trowel = completeAdventure("hand-trowel");
	assert.equal(trowel.returned.farmStock["glowroot-seed"], trowel.before["glowroot-seed"] + 2);
	assert.equal(trowel.returned.farmStock["willow-fiber"], trowel.before["willow-fiber"] + 2);
	assert.match(adventureStory(trowel.returned).tags[1].detail, /second glowing Seed/);

	const lantern = completeAdventure("lantern");
	assert.equal(lantern.returned.farmStock["glowroot-seed"], lantern.before["glowroot-seed"] + 1);
	assert.equal(lantern.returned.farmStock["willow-fiber"], lantern.before["willow-fiber"] + 3);
	assert.match(adventureStory(lantern.returned).tags[1].detail, /extra Willow Fiber/);
});

test("packing consumes one Provision exactly once while Tool and Pack remain reusable", () => {
	let state = createPrototypeState(7, { now: at });
	assert.equal(state.farmStock["clover-lunch"], 5);
	const compostBefore = state.farmStock.compost;
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });

	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(state.prototypePosition, 8);
	assert.equal(state.packedProvisionSpent, "clover-lunch");
	assert.equal(state.farmStock["clover-lunch"], 4);
	assert.equal(state.farmStock.compost, compostBefore);
	assert.match(state.trace.at(-1).detail, /spent 1 Provision/);
	assert.equal(reduce(state, { type: ACTIONS.PACK_ADVENTURE }), state);

	const restored = deserializeState(serializeState(state), { now: at });
	assert.equal(restored.farmStock["clover-lunch"], 4);
	assert.equal(restored.packedProvisionSpent, "clover-lunch");
});

test("an unowned Provision is refused but an empty Provision keeps the Adventure available", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "clover-lunch": 0 },
	};
	assert.equal(reduce(state, { type: ACTIONS.PACK_ADVENTURE }), state);

	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "provision", item: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(state.farmStock["clover-lunch"], 0);
	assert.equal(state.packedProvisionSpent, null);
	assert.equal(state.underprepared, true);
	assert.equal(state.nearDiscoveryReason, "provision");
});

test("direct review states show Farm stock before and after packing", () => {
	assert.equal(createPrototypeState(7, { now: at }).farmStock["clover-lunch"], 5);
	assert.equal(createPrototypeState(8, { now: at }).farmStock["clover-lunch"], 4);
	assert.equal(createPrototypeState(10, { now: at }).farmStock["glowroot-seed"], 2);
	assert.equal(createPrototypeState(11, { now: at }).farmStock["glowroot-seed"], 1);
	assert.equal(createPrototypeState(11, { now: at }).glowrootPlanted, true);
});

test("every empty Bag slot creates a specific deterministic Near-Discovery", () => {
	for (const missingSlot of ["provision", "tool", "pack"]) {
		let state = createPrototypeState(7, { now: at });
		state = reduce(state, {
			type: ACTIONS.SET_BAG_SLOT,
			slot: missingSlot,
			item: null,
		});
		state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
		assert.equal(state.underprepared, true);
		assert.equal(state.nearDiscoveryReason, missingSlot);
		assert.equal(state.prototypePosition, 8);

		state = reduce(state, { type: ACTIONS.START_ADVENTURE });
		state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
		state = reduce(state, { type: ACTIONS.WELCOME_HOME });
		assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
		assert.match(state.trace.at(-1).detail, /Rosie|seed|root|leaf-print/);
		assert.match(playerPresentation(state).objective, /Provision|Tool|Pack/);
	}
});

test("a complete alternative loadout remains successful and visible at departure", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 1 },
	};
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });

	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(state.underprepared, false);
	assert.deepEqual(state.bag, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});
	assert.equal(state.farmStock["willow-fiber"], 0);
});

test("the Adventure vignette explains every selected item before idle waiting", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 1 },
	};
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });

	const story = adventureStory(state);
	assert.equal(story.kind, "discovery");
	assert.equal(story.journeyHeadline, "Warm light stirs beneath the hedge");
	assert.deepEqual(story.journeyTags.map((tag) => tag.name), [
		"Clover Lunch",
		"Lantern",
		"Cloth Wrap",
	]);
	assert.doesNotMatch(
		story.journeyTags.map((tag) => tag.detail).join(" "),
		/Seed|Compost|Willow Fiber|found/i,
	);
	assert.deepEqual(story.tags.map((tag) => tag.name), [
		"Clover Lunch",
		"Lantern",
		"Cloth Wrap",
	]);
	assert.equal(state.prototypePosition, 8);
	assert.equal(state.departureComplete, false);
	assert.equal(homegrownRiveModel(state).trigger, "departure");
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.SETTLE,
		label: "Rosie is heading for the hedge…",
	});

	state = homegrownReducer(state, {
		type: ACTIONS.SETTLE,
		now: at + DURATIONS.DEPARTURE_MS,
	});
	assert.equal(state.prototypePosition, 9);
	assert.equal(state.departureComplete, true);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.CONTINUE_ADVENTURE_STORY,
		label: "The journey continues…",
	});

	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	assert.equal(state.adventureVignetteSeen, true);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.ADVANCE_TIME,
		label: "Fast-forward to Homecoming",
	});
	assert.deepEqual(playerPresentation(state), {
		target: WORLD_TARGETS.HEDGE,
		objective: "Rosie is following the moths",
		label: "Fast-forward to Homecoming",
		action: {
			type: ACTIONS.ADVANCE_TIME,
			label: "Fast-forward to Homecoming",
		},
	});
});

test("the Adventure tells one Bag cause at a time without covering the clearing", () => {
	assert.match(appSource, /const activeTag = resolved \? null : story\.journeyTags\[activeBeatIndex\]/);
	assert.match(appSource, /key=\{beat\} className="adventure-field-note" role="status" aria-live="polite"/);
	assert.match(appSource, /BAG_SLOT_LABELS\[activeTag\.slot\]/);
	assert.doesNotMatch(appSource, /className="adventure-cause-thread"/);
	assert.doesNotMatch(appSource, /className="adventure-find"/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-field-note \{ animation: none; \}/);
});

test("the resolved cause sequence hands itself into the idle journey without revealing the Find", () => {
	assert.match(appSource, /className="adventure-auto-handoff" role="status" aria-live="polite"/);
	assert.match(appSource, /Rosie follows the \{lanternleaf \? "reflected leaves" : "warm light"\}/);
	assert.match(appSource, /<strong>The journey continues…<\/strong>/);
	assert.match(appSource, /adventureCauseBeat !== "resolved"/);
	assert.match(appSource, /ACTIONS\.CONTINUE_ADVENTURE_STORY/);
	assert.match(appSource, /REDUCED_ADVENTURE_HANDOFF_MS = 1800/);
	assert.doesNotMatch(appSource, /What Rosie found/);
	assert.doesNotMatch(appSource, /className="adventure-continue"/);
	assert.doesNotMatch(appSource, />Let Rosie explore</);
	assert.doesNotMatch(appSource, /story\.journeyHeadline/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-auto-handoff \{ animation: none; \}/);
});

test("the idle journey keeps Home in route-aware dusk without adding another screen", () => {
	assert.match(appSource, /className="journey-home-dusk" aria-hidden="true"><i \/><\/div>/);
	assert.match(appSource, /The twilight paper-craft Barn and remembered Kitchen Patch stay visible while Rosie explores beyond the hedge/);
	assert.match(stylesSource, /\.journey-watch-open \.scene-plate \{[^}]*filter: brightness\(\.62\) saturate\(\.98\)/s);
	assert.match(stylesSource, /\.journey-watch-open\[data-adventure-opportunity="lights-past-open-gate"\] \{[^}]*--journey-route-light: #c3ead6/s);
	assert.match(stylesSource, /\.journey-watch-lights i \{[^}]*background: var\(--journey-route-light\)/s);
	assert.match(stylesSource, /@keyframes journey-home-dusk-enter/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.journey-watch-open \.scene-plate/);
	assert.doesNotMatch(appSource, /AtmosphereSwitcher|atmospherePrototype|searchParams\.set\("atmosphere"/);
});

test("the idle journey derives a predictable trail and homeward beat from its persisted timestamps", () => {
	const journey = {
		...createPrototypeState(9, { now: at }),
		adventureVignetteSeen: true,
	};
	const homewardAt = adventureHomewardAt(journey);
	assert.equal(homewardAt, at + DURATIONS.ADVENTURE_MS * JOURNEY_HOMEWARD_RATIO);
	assert.equal(adventureJourneyProgress(journey, at), 0);
	assert.equal(adventureJourneyPhase(journey, at), "trail");
	assert.equal(adventureJourneyPhase(journey, homewardAt - 1), "trail");
	assert.equal(adventureJourneyPhase(journey, homewardAt), "homeward");
	assert.equal(adventureJourneyPhase(journey, journey.adventureReadyAt), "home");
	assert.equal(adventureJourneyProgress(journey, journey.adventureReadyAt + 1), 1);

	const reloaded = deserializeState(serializeState(journey), { now: homewardAt });
	assert.equal(adventureJourneyPhase(reloaded, homewardAt), "homeward");
	assert.equal(adventureHomewardAt({ ...journey, adventureStartedAt: null }), null);
	assert.equal(adventureJourneyPhase(createInitialState({ now: at }), at), null);
	const homewardReview = createPrototypeState(9, { now: at, journeyPhase: "homeward" });
	assert.equal(adventureJourneyPhase(homewardReview, at), "homeward");
	assert.equal(homewardReview.adventureReadyAt - at, DURATIONS.ADVENTURE_MS * 0.2);
	const lanternleafReview = createPrototypeState(9, {
		now: at,
		journeyPhase: "homeward",
		adventureRoute: "lanternleaf",
	});
	assert.equal(adventureOpportunity(lanternleafReview).id, SECOND_ADVENTURE_OPPORTUNITY.id);
	assert.equal(adventureJourneyPhase(lanternleafReview, at), "homeward");
});

test("the rendered journey advances one existing note and route without shipping prototype controls", () => {
	assert.match(appSource, /data-journey-phase=\{journeyPhase\}/);
	assert.match(appSource, /The moths turn Home/);
	assert.match(appSource, /The leaves turn Home/);
	assert.match(appSource, /Rosie is heading Home/);
	assert.match(appSource, /homecomingReady \|\| homeward \? "is-complete" : "is-current"/);
	assert.match(appSource, /adventureHomewardAt\(state\)/);
	assert.match(appSource, /initialSearch\.get\("journey"\) === "homeward"/);
	assert.match(appSource, /initialSearch\.get\("route"\) === "lanternleaf"/);
	assert.match(stylesSource, /\.journey-watch\[data-journey-phase="homeward"\] \.journey-home-dusk i/);
	assert.match(stylesSource, /\.journey-watch\[data-journey-phase="homeward"\] \.journey-watch-lights i \{[^}]*animation-direction: reverse/s);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.journey-watch-lights i \{ animation: none; \}/);
	assert.doesNotMatch(appSource, /ProgressionPrototypeSwitcher|progressionTreatment|searchParams\.set\("progression"/);
});

test("the first Hand Trowel cause performs one separable dig", () => {
	assert.match(appSource, /showingAdventureVignette && <div className="adventure-tool-prop" aria-hidden="true" \/>/);
	assert.match(stylesSource, /data-adventure-opportunity="glow-beneath-hedge"\]\[data-adventure-tool="hand-trowel"\]\[data-adventure-beat="tool"\]/);
	assert.match(stylesSource, /animation: adventure-trowel-one-dig 680ms cubic-bezier\(\.16,1,\.3,1\) both/);
	assert.match(stylesSource, /@keyframes adventure-trowel-one-dig/);
	assert.doesNotMatch(stylesSource, /adventure-clearing-trowel-no-pack\.webp/);
	assert.doesNotMatch(stylesSource, /adventure-clearing-lantern-no-pack\.webp/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.phone\[data-adventure-opportunity="glow-beneath-hedge"\] \.adventure-tool-prop/);
});

test("the first Adventure visibly settles a carried find into its chosen Pack", () => {
	assert.match(appSource, /className="adventure-find-handoff" aria-hidden="true"><i \/><i \/><\/div>/);
	assert.match(stylesSource, /data-adventure-opportunity="glow-beneath-hedge"[^\n]+data-adventure-beat="pack"[^\n]+\.adventure-find-handoff/);
	assert.match(stylesSource, /@keyframes adventure-find-to-pack/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\][^\n]+\.adventure-find-handoff/);
});

test("a packed Provision performs once and leaves the Adventure at dusk", () => {
	assert.match(stylesSource, /data-adventure-provision="clover-lunch"\]\[data-adventure-beat="provision"\] \.adventure-provision-prop/);
	assert.match(stylesSource, /animation: adventure-provision-one-use 760ms cubic-bezier\(\.16,1,\.3,1\) both/);
	assert.match(stylesSource, /@keyframes adventure-provision-dusk-arrive/);
	assert.match(stylesSource, /data-adventure-provision="clover-lunch"\]:is\(\[data-adventure-beat="tool"\],\[data-adventure-beat="pack"\],\[data-adventure-beat="resolved"\]\) \.adventure-vignette-backdrop::before/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-provision-prop \{ animation: none; \}/);
});

test("the Tool beat gives Rosie one authored attention response", () => {
	assert.match(appSource, /showingAdventureVignette && !state\.reduceMotion && adventureCauseBeat === "tool"/);
	assert.match(appSource, /\? "adventure-attention"/);
	assert.match(appSource, /adventure-attention:\$\{opportunity\.id\}/);
	assert.match(riveContractSource, /\| "adventure-attention"/);
	assert.match(riveSceneSource, /"adventure-attention": "Rosie Notice"/);
	assert.match(riveSceneSource, /trigger !== "adventure-attention"/);
	assert.doesNotMatch(appSource, /adventureCauseBeat === "provision"\s*\? "adventure-attention"/);
	assert.doesNotMatch(appSource, /adventureCauseBeat === "pack"\s*\? "adventure-attention"/);
});

test("departure timing is reducer-owned, reload-stable, reduced-motion aware, and idempotent", () => {
	let state = createPrototypeState(8, { now: at });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	const started = state;

	assert.equal(state.prototypePosition, 8);
	assert.equal(state.departureReadyAt - state.departureStartedAt, DURATIONS.DEPARTURE_MS);
	assert.equal(reduce(state, { type: ACTIONS.START_ADVENTURE }), state);
	assert.equal(
		settleState(state, state.departureReadyAt - 1),
		state,
	);

	state = deserializeState(serializeState(state), { now: at + 200 });
	assert.equal(state.prototypePosition, 8);
	assert.equal(state.departureComplete, false);
	assert.equal(state.departureReadyAt, at + 200 + DURATIONS.DEPARTURE_MS);
	state = settleState(state, state.departureReadyAt);
	assert.equal(state.prototypePosition, 9);
	assert.equal(state.departureComplete, true);
	assert.equal(settleState(state, state.departureReadyAt), state);

	let reduced = createPrototypeState(8, { now: at, reduceMotion: true });
	reduced = reduce(reduced, { type: ACTIONS.START_ADVENTURE });
	assert.ok(reduced.departureReadyAt - reduced.departureStartedAt < DURATIONS.DEPARTURE_MS);
	assert.equal(reduced.prototypePosition, 8);

	const legacyPositionNine = { ...started, prototypePosition: 9 };
	delete legacyPositionNine.departureComplete;
	delete legacyPositionNine.departureStartedAt;
	delete legacyPositionNine.departureReadyAt;
	const migrated = deserializeState(JSON.stringify(legacyPositionNine), { now: at });
	assert.equal(migrated.prototypePosition, 9);
	assert.equal(migrated.departureComplete, true);
});

test("an empty Bag slot changes the deterministic vignette instead of removing it", () => {
	let state = createPrototypeState(7, { now: at });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });

	const story = adventureStory(state);
	assert.equal(story.kind, "near-discovery");
	assert.equal(story.tags[2].name, "No Pack");
	assert.match(story.tags[2].detail, /leaf-print/);
});

test("Near-Discovery causes never claim that an unearned Seed came Home", () => {
	let state = createPrototypeState(7, { now: at });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "provision", item: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });

	const story = adventureStory(state);
	assert.match(story.tags[2].detail, /leaf-print/);
	assert.doesNotMatch(story.tags[2].detail, /seed Home/);
});

test("prototype navigation carries the selected loadout and exact rewards forward and backward", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 1 },
	};
	const before = { ...state.farmStock };
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "pack", item: "cloth-wrap" });
	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 8 });
	assert.equal(state.farmStock["willow-fiber"], before["willow-fiber"] - 1);
	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 9 });

	assert.equal(state.prototypePosition, 9);
	assert.deepEqual(state.bag, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});
	assert.equal(adventureStory(state).tags[1].name, "Lantern");

	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 10 });
	assert.equal(state.farmStock["clover-seed"], before["clover-seed"] + 1);
	assert.equal(state.farmStock["glowroot-seed"], before["glowroot-seed"] + 1);
	assert.equal(state.farmStock.compost, before.compost);
	assert.equal(state.farmStock["willow-fiber"], before["willow-fiber"] + 2);

	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 7 });
	assert.deepEqual(state.farmStock, before);
});

test("prototype navigation keeps an incomplete Bag on the clue branch through Return", () => {
	let state = createPrototypeState(7, { now: at });
	const before = { ...state.farmStock };
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "provision", item: null });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 9 });

	assert.equal(state.underprepared, true);
	assert.equal(state.nearDiscoveryReason, "provision");
	assert.equal(state.farmStock["clover-lunch"], before["clover-lunch"]);
	assert.equal(adventureStory(state).kind, "near-discovery");

	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.equal(state.farmStock["glowroot-seed"], before["glowroot-seed"]);
	assert.equal(state.farmStock.compost, before.compost + 1);
	assert.equal(state.farmStock["willow-fiber"], before["willow-fiber"] + 1);

	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 7 });
	assert.deepEqual(state.farmStock, before);
});

test("direct Return review derives the clue reward from an incomplete Bag", () => {
	let state = createPrototypeState(7, { now: at });
	const before = { ...state.farmStock };
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: null });
	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 10 });

	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.equal(state.nearDiscoveryReason, "tool");
	assert.equal(state.farmStock["glowroot-seed"], before["glowroot-seed"]);
	assert.equal(state.farmStock.compost, before.compost + 1);
	assert.equal(state.farmStock["willow-fiber"], before["willow-fiber"] + 1);
});

test("a successful return adds one named Discovery and practical Farm supplies", () => {
	let state = createPrototypeState(7, { now: at });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });

	assert.equal(state.stage, STAGES.GLOWROOT_RETURNED);
	assert.equal(state.prototypePosition, 10);
	assert.equal(state.farmStock["glowroot-seed"], 2);
	assert.equal(state.farmStock.compost, 2);
	assert.equal(state.farmStock["willow-fiber"], 2);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.ACKNOWLEDGE_RETURN,
		label: "Take Seed to Bed 3",
	});
	assert.deepEqual(playerPresentation(state), {
		target: WORLD_TARGETS.GLOWROOT_BED,
		objective: "Glowroot can change the Farm",
		label: "Take Seed to Bed 3",
		action: {
			type: ACTIONS.ACKNOWLEDGE_RETURN,
			label: "Take Seed to Bed 3",
		},
	});

	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	assert.equal(state.returnRewardAcknowledged, true);
	assert.equal(state.prototypePosition, 11);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PLANT_GLOWROOT,
		label: "Plant Glowroot",
	});
	assert.deepEqual(deserializeState(serializeState(state), { now: at }).farmStock, state.farmStock);

	const beforePlant = state;
	state = reduce(state, { type: ACTIONS.PLANT_GLOWROOT });
	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(state.prototypePosition, 11);
	assert.equal(state.glowrootPlanted, true);
	assert.equal(homegrownRiveModel(state).trigger, "plant-glowroot");
	assert.equal(state.farmStock["glowroot-seed"], 1);
	assert.equal(playerPresentation(state).target, WORLD_TARGETS.MOONBERRY_BED);
	assert.equal(playerPresentation(state).objective, "Bed 2 is ready for Moonberries");
	assert.equal(playerPresentation(state).detail, "Invite the dusk moths");
	assert.match(state.trace.at(-1).detail, /2 → 1/);
	assert.equal(reduce(state, { type: ACTIONS.PLANT_GLOWROOT }), state);
	assert.equal(beforePlant.farmStock["glowroot-seed"], 2);
	const restored = deserializeState(serializeState(state), { now: at });
	assert.equal(restored.glowrootPlanted, true);
	assert.equal(restored.farmStock["glowroot-seed"], 1);
});

test("Glowroot cannot be planted before the return is acknowledged or without its Seed", () => {
	let state = createPrototypeState(10, { now: at });
	assert.equal(reduce(state, { type: ACTIONS.PLANT_GLOWROOT }), state);

	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	const noSeed = {
		...state,
		farmStock: { ...state.farmStock, "glowroot-seed": 0 },
	};
	assert.equal(reduce(noSeed, { type: ACTIONS.PLANT_GLOWROOT }), noSeed);
});

test("the Glowroot flourish owns one quiet beat before memory and Moonberries return", () => {
	assert.match(appSource, /const GLOWROOT_HOME_REVEAL_MS = 900;/);
	assert.match(appSource, /objective: "Glowroot takes root", detail: "The Farm remembers"/);
	assert.match(appSource, /showingHomeMemory && !holdingGlowrootHomeReveal && <HomeMemoryPanel/);
	assert.match(appSource, /showingMoonberryPlanting && !holdingGlowrootHomeReveal/);
	assert.match(appSource, /nextAction\.type === ACTIONS\.PLANT_GLOWROOT && !state\.reduceMotion/);
	assert.match(appSource, /window\.clearTimeout\(glowrootHomeRevealTimer\.current\)/);
});

test("stable Home memory collapses into one accessible stock pocket", () => {
	assert.match(appSource, /aria-controls="farm-memory-detail"/);
	assert.match(appSource, /aria-expanded=\{expanded\}/);
	assert.match(appSource, /Crops grow · Stock stays · Discoveries stay/);
	assert.match(appSource, /!homeMemoryExpanded && <WorldAction/);
	assert.match(appSource, /!homeMemoryExpanded && !showingFarmingPanel/);
	assert.doesNotMatch(appSource, /className="home-memory-promise"/);
	assert.doesNotMatch(appSource, /className="home-memory-stock"/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.home-memory-pocket-detail \{ animation: none; \}/);
});

test("a Near-Discovery still returns useful supplies without granting the Seed", () => {
	let state = createPrototypeState(7, { now: at });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });

	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.equal(state.prototypePosition, 10);
	assert.equal(state.farmStock["glowroot-seed"], 0);
	assert.equal(state.farmStock.compost, 2);
	assert.equal(state.farmStock["willow-fiber"], 1);
	assert.equal(playerPresentation(state).label, "Adjust Rosie’s Bag");
});
