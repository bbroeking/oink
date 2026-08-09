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
	cropHarvestPattern,
	createInitialState,
	createPrototypeState,
	deserializeState,
	DURATIONS,
	EMPTY_BAG,
	FIRST_ADVENTURE_OPPORTUNITY,
	HARVEST_BEAT_MS,
	HARVEST_PATTERN,
	homegrownReducer,
	JOURNEY_HOMEWARD_RATIO,
	nearDiscoveryGuide,
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
import { formatAdventureReturnPromise } from "./journeyTime.mjs";

const at = 1_000_000;
const reduce = (state, action) => homegrownReducer(state, { now: at, ...action });
const appSource = readFileSync(fileURLToPath(new URL("./app.web.tsx", import.meta.url)), "utf8");
const animationLabSource = readFileSync(fileURLToPath(new URL("./animation-lab.web.tsx", import.meta.url)), "utf8");
const stylesSource = readFileSync(fileURLToPath(new URL("./styles.css", import.meta.url)), "utf8");
const riveSceneSource = readFileSync(fileURLToPath(new URL("../../../components/prototypes/homegrown-adventures/HomegrownRiveScene.web.tsx", import.meta.url)), "utf8");
const riveContractSource = readFileSync(fileURLToPath(new URL("../../../components/prototypes/homegrown-adventures/homegrownRiveContract.ts", import.meta.url)), "utf8");

function chooseAdventureBag(state, {
	provision = "clover-lunch",
	tool = "hand-trowel",
	pack = "wicker-basket",
} = {}) {
	if (state.prototypePosition === 6) {
		state = reduce(state, { type: ACTIONS.OPEN_BAG_SELECTION });
	}
	for (const [slot, item] of Object.entries({ provision, tool, pack })) {
		state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot, item });
	}
	return state;
}

function packAdventure(state, bag = {}) {
	state = chooseAdventureBag(state, bag);
	return reduce(state, { type: ACTIONS.PACK_ADVENTURE });
}

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
	]) state = reduce(state, action);
	state = packAdventure(state);
	for (const action of [
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
	state = packAdventure(state);
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
		type: ACTIONS.PLANT_CROP,
		label: "Plant Clover",
	});
	assert.equal(playerPresentation(state).detail, "Clover Lunch ×3 · ready in 4h");
	assert.match(appSource, /\{promisedYield\} \{rule\.outputName\} · ready in \{boosted \? boostedHours : normalHours\} hours/);
	assert.match(appSource, /Add Compost: 1 more, \$\{normalHours - boostedHours\} hours sooner\./);
	assert.doesNotMatch(appSource, /Ready in 4 hours · Harvest 3|Ready in 2 hours · Harvest 4/);
	state = reduce(state, { type: ACTIONS.TOGGLE_COMPOST });
	assert.equal(state.compostApplied, true);
	assert.deepEqual(primaryAction(state), {
		type: ACTIONS.PLANT_CROP,
		label: "Plant with Compost",
	});
	assert.equal(playerPresentation(state).detail, "Clover Lunch ×4 · ready in 2h");

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

test("Moonberries unlock from Home memory instead of appearing as an unearned Seed", () => {
	let firstMorning = createInitialState({ now: at });
	firstMorning = reduce(firstMorning, { type: ACTIONS.TICKLE });
	assert.equal(
		reduce(firstMorning, { type: ACTIONS.SELECT_CROP, crop: "moonberries" }),
		firstMorning,
	);
	assert.equal(firstMorning.farmStock.moonberries, 0);

	const secondMorning = throughSecondMorning();
	assert.equal(secondMorning.daysCompleted, 1);
	assert.equal(secondMorning.glowrootPlanted, true);
	assert.equal(secondMorning.nextPlanting, "moonberries");
	assert.equal(CROP_RULES.moonberries.seedId, null);
	assert.deepEqual(cropHarvestPattern("moonberries"), ["down", "left", "right", "up"]);
});

test("Moonberries complete the full grow, personal rhythm, stockpile, and Bag loop", () => {
	let state = throughSecondMorning();
	const cloverSeedsBefore = state.farmStock["clover-seed"];
	const cloverLunchesBefore = state.farmStock["clover-lunch"];

	state = reduce(state, { type: ACTIONS.SELECT_CROP, crop: "moonberries" });
	assert.equal(state.selectedCrop, "moonberries");
	assert.equal(playerPresentation(state).target, WORLD_TARGETS.MOONBERRY_BED);
	assert.equal(playerPresentation(state).detail, "Moonberries ×4 · ready in 8h");
	state = reduce(state, { type: ACTIONS.PLANT_CROP });
	assert.equal(state.readyAt - state.plantedAt, CROP_RULES.moonberries.baseDurationMs);
	assert.equal(state.farmStock["clover-seed"], cloverSeedsBefore);
	assert.equal(homegrownRiveModel(state, state.plantedAt).viewModel.bedOneState, "empty");
	assert.equal(homegrownRiveModel(state, state.plantedAt).viewModel.bedTwoState, "sprout");

	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	assert.equal(settleState(state, state.readyAt + 24 * 60 * 60 * 1000), state);
	state = reduce(state, { type: ACTIONS.TICKLE });
	assert.equal(homegrownRiveModel(state, state.readyAt).viewModel.bedTwoState, "ready");
	for (const [index, direction] of cropHarvestPattern(state).entries()) {
		state = reduce(state, {
			type: ACTIONS.HARVEST_BEAT,
			direction,
			input: "swipe",
			now: at + index * 400,
		});
	}
	assert.equal(state.lastHarvestYield, 5);
	assert.equal(state.farmStock.moonberries, 5);
	assert.equal(state.farmStock["clover-lunch"], cloverLunchesBefore);
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");

	state = reduce(state, { type: ACTIONS.OPEN_BAG_SELECTION });
	state = chooseAdventureBag(state, { provision: "moonberries", tool: "lantern" });
	assert.equal(adventureStory(state).journeyTags[0].detail, "make the reflected leaves shine against the dark");
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(state.packedProvisionSpent, "moonberries");
	assert.equal(state.farmStock.moonberries, 4);
	assert.match(adventureStory(state).tags[0].detail, /revealed silver leaves/);
});

test("Moonberry rootstock visibly persists from harvest through the next morning", () => {
	let state = throughSecondMorning();
	for (const action of [
		{ type: ACTIONS.SELECT_CROP, crop: "moonberries" },
		{ type: ACTIONS.PLANT_CROP },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CROP },
	]) state = reduce(state, action);

	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
	state = packAdventure(state, {
		provision: "moonberries",
		tool: "lantern",
		pack: "wicker-basket",
	});
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");

	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
	state = reduce(state, { type: ACTIONS.START_NEW_DAY });
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
});

test("Compost predictably makes Moonberries two hours faster and adds one guaranteed berry", () => {
	let state = throughSecondMorning();
	state = reduce(state, { type: ACTIONS.SELECT_CROP, crop: "moonberries" });
	state = reduce(state, { type: ACTIONS.TOGGLE_COMPOST });
	state = reduce(state, { type: ACTIONS.PLANT_CROP });
	assert.equal(state.readyAt - state.plantedAt, CROP_RULES.moonberries.compostDurationMs);
	assert.equal(state.farmStock.compost, 1);
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CROP });
	assert.equal(state.lastHarvestYield, 5);
	assert.equal(state.farmStock.moonberries, 5);
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

test("the rendered Harvest Rhythm keeps the crop gesture primary with one integrated tap fallback", () => {
	const state = createPrototypeState(5, { now: at });
	assert.equal(playerPresentation(state).objective, "Harvest for Rosie’s journey");
	assert.equal(playerPresentation(state).detail, "Clover rhythm: ← → ↑");
	assert.match(appSource, /aria-label=\{`Tap \$\{HARVEST_DIRECTION_LABELS\[direction\]\.name\} instead`\}/);
	assert.match(appSource, /Swipe bed · or tap arrow/);
	assert.match(appSource, /\{guaranteedYield\} \{rule\.outputName\} guaranteed · clean rhythm \+1/);
	assert.match(appSource, /className="harvest-bed-assist is-unified"/);
	assert.doesNotMatch(appSource, /className="harvest-assist"|objective: "Clover’s rhythm: ← → ↑"/);
	assert.match(stylesSource, /\.harvest-bed-assist\.is-unified \{/);
});

test("a ready crop announces the harvest before the affectionate Tickle handoff", () => {
	const state = throughCloverReady();
	assert.equal(state.changeRevealed, false);
	assert.equal(primaryAction(state).label, "Tickle Rosie");
	assert.deepEqual(playerPresentation(state), {
		target: "rosie",
		objective: "Clover Lunch is ready",
		detail: "Tickle Rosie to begin Clover's harvest rhythm",
		label: "Tickle Rosie",
		action: primaryAction(state),
	});
	assert.match(appSource, /eyebrow: "Ready to harvest"/);
	assert.match(appSource, /Tickle Rosie to begin \$\{cropPossessive\} personal harvest rhythm/);
	assert.doesNotMatch(appSource, /Welcome Rosie with a tickle|title: "The Kitchen Patch is rustling"/);

	let moonberries = throughSecondMorning();
	moonberries = reduce(moonberries, { type: ACTIONS.SELECT_CROP, crop: "moonberries" });
	moonberries = reduce(moonberries, { type: ACTIONS.PLANT_CROP });
	moonberries = reduce(moonberries, { type: ACTIONS.ADVANCE_TIME });
	assert.equal(playerPresentation(moonberries).objective, "Moonberries are ready");
	assert.equal(
		playerPresentation(moonberries).detail,
		"Tickle Rosie to begin Moonberries’ harvest rhythm",
	);
});

test("the rendered Moonberry harvest names and animates its rooted regrowth", () => {
	assert.match(appSource, /Roots stay in Bed 2/);
	assert.match(stylesSource, /data-rive-bed-two="sprout"[^}]+clip-path:/s);
	assert.match(riveSceneSource, /className="painted-moonberry-rootstock-base"/);
	assert.match(stylesSource, /data-rive-moonberry-motion="regrow"/);
	assert.match(stylesSource, /@keyframes painted-memory-crop-regrow/);
	assert.match(riveSceneSource, /previousState === "ready" && model\.bedTwoState === "sprout"/);
	assert.match(riveSceneSource, /setMoonberryMotion\(regrowingAfterHarvest \? "regrow" : "plant"\)/);
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
	crop = packAdventure(crop);
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
	assert.equal(deserializeState('{"version":3,"stage":"starting"}', { now: at }).stage, STAGES.STARTING);
});

test("version-one untouched prescribed Bags migrate to an empty player-authored Bag", () => {
	const untouched = createPrototypeState(7, { now: at });
	untouched.version = 1;
	untouched.bag = {
		provision: "clover-lunch",
		tool: "hand-trowel",
		pack: "wicker-basket",
	};
	const migrated = deserializeState(JSON.stringify(untouched), { now: at });
	assert.equal(migrated.version, 2);
	assert.deepEqual(migrated.bag, EMPTY_BAG);

	const progressed = createPrototypeState(8, { now: at });
	progressed.version = 1;
	assert.deepEqual(
		deserializeState(JSON.stringify(progressed), { now: at }).bag,
		progressed.bag,
	);
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
	assert.equal(homegrownRiveModel(state).viewModel.bedTwoState, "sprout");
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
	]) state = reduce(state, action);
	state = packAdventure(state);
	for (const action of [
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
		["empty", "sprout", "sprout"],
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
		["growing", "sprout", "sprout"],
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

	state = packAdventure(state, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});
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
	state = packAdventure(state, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: null,
	});
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
	assert.equal(playerPresentation(state).objective, "Lanternleaf Trail · Field Guide");
	assert.equal(playerPresentation(state).label, "Open the Carrier pocket");
});

test("a known Glowroot return stays in Farm stock and completes the second day", () => {
	let state = throughSecondMorning();
	for (const action of [
		{ type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" },
		{ type: ACTIONS.PLANT_CLOVER },
		{ type: ACTIONS.ADVANCE_TIME },
		{ type: ACTIONS.TICKLE },
		{ type: ACTIONS.HARVEST_CLOVER },
	]) state = reduce(state, action);
	state = packAdventure(state);
	for (const action of [
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

test("the animation lab enters Bag selection before demonstrating Pack", () => {
	assert.match(
		animationLabSource,
		/HARVEST_CLOVER\),\s*action\(ACTIONS\.OPEN_BAG_SELECTION\)/,
	);
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
		["empty", "empty", "sprout"],
	);

	state = reduce(state, { type: ACTIONS.PLANT_NEXT, crop: "moonberries" });
	({ viewModel } = homegrownRiveModel(state));
	assert.equal(viewModel.mothsVisible, true);
	assert.equal(viewModel.bedTwoState, "sprout");
});

test("annual Clover stays harvested through Homecoming, changed Home, and the next morning", () => {
	let state = throughCloverReady();
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.HARVEST_CLOVER });
	assert.equal(homegrownRiveModel(state).viewModel.bedOneState, "empty");

	state = packAdventure(state);
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	assert.equal(homegrownRiveModel(state).viewModel.bedOneState, "empty");

	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	state = reduce(state, { type: ACTIONS.ACKNOWLEDGE_RETURN });
	assert.equal(homegrownRiveModel(state).viewModel.bedOneState, "empty");

	state = reduce(state, { type: ACTIONS.PLANT_GLOWROOT });
	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(homegrownRiveModel(state).viewModel.bedOneState, "empty");

	state = reduce(state, { type: ACTIONS.PLANT_NEXT, crop: "moonberries" });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.START_NEW_DAY });
	assert.equal(state.stage, STAGES.STARTING);
	assert.equal(homegrownRiveModel(state).viewModel.bedOneState, "empty");
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
	]) {
		state = reduce(state, action);
		capture();
	}
	state = chooseAdventureBag(state);
	capture();
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	capture();
	for (const action of [
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
	assert.ok(observed.some(({ target }) => target === WORLD_TARGETS.BAG));
	assert.ok(observed.some(({ target }) => target === WORLD_TARGETS.HEDGE));
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
	assert.deepEqual(state.bag, EMPTY_BAG);

	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	assert.equal(state.prototypePosition, 8);
	assert.equal(state.stage, STAGES.PACKED);
	assert.equal(state.nearDiscoveryReason, "provision");
	assert.equal(playerPresentation(state).label, "Follow the glow");
});

test("the Bag interface starts empty and presents every choice directly", () => {
	assert.deepEqual(createInitialState({ now: at }).bag, EMPTY_BAG);
	assert.deepEqual(createPrototypeState(7, { now: at }).bag, EMPTY_BAG);
	assert.match(appSource, /The Bag begins empty\. Every slot is optional\./);
	assert.match(appSource, /What should help Rosie keep going\?/);
	assert.match(appSource, /What should Rosie try\?/);
	assert.match(appSource, /What should hold Rosie's find\?/);
	assert.match(appSource, /Rosie remembers it, but cannot carry it Home/);
	assert.match(appSource, /Set out with an empty Bag/);
	assert.match(appSource, /An empty Bag still returns a useful clue\. Rosie is always safe\./);
	assert.match(appSource, /Rosie's Bag is ready to pack/);
	assert.match(appSource, /\$\{crop\.outputName\} joined Farm stock/);
	assert.match(appSource, /role="tabpanel"/);
	assert.match(appSource, /tabIndex=\{focus === slot \? 0 : -1\}/);
	assert.match(appSource, /ArrowRight: 1/);
	assert.doesNotMatch(appSource, /Clover Lunch is in Rosie's Bag/);
	assert.doesNotMatch(appSource, /cycleItem|className="bag-change"|Pack these/);
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
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "provision", item: "clover-lunch" });
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	assert.equal(homegrownRiveModel(state).viewModel.rosieAction, "pack");
	assert.equal(homegrownRiveModel(state).trigger, "bag-receive");
	assert.deepEqual(homegrownRiveModel(state).bagReceive, {
		slot: "tool",
		item: "lantern",
		previousItem: null,
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

	const wickerStart = chooseAdventureBag(createPrototypeState(7, { now: at }));
	const wickerReturn = completeAdventure(wickerStart);
	assert.equal(wickerReturn.farmStock.compost, wickerStart.farmStock.compost + 1);
	assert.equal(wickerReturn.farmStock["clover-seed"], wickerStart.farmStock["clover-seed"]);
	assert.match(adventureStory(wickerReturn).tags[2].detail, /Compost/);

	let clothStart = createPrototypeState(7, { now: at });
	clothStart = {
		...clothStart,
		farmStock: { ...clothStart.farmStock, "willow-fiber": 2 },
	};
	clothStart = chooseAdventureBag(clothStart, { pack: "cloth-wrap" });
	const clothReturn = completeAdventure(clothStart);
	assert.equal(clothReturn.farmStock.compost, clothStart.farmStock.compost);
	assert.equal(clothReturn.farmStock["clover-seed"], clothStart.farmStock["clover-seed"] + 1);
	assert.equal(clothReturn.farmStock["willow-fiber"], clothStart.farmStock["willow-fiber"] + 1);
	assert.match(adventureStory(clothReturn).tags[2].detail, /Clover Seed/);
});

test("Hand Trowel returns an extra Glowroot Seed while Lantern returns extra Willow Fiber", () => {
	const completeAdventure = (tool) => {
		let state = createPrototypeState(7, { now: at });
		state = chooseAdventureBag(state, { tool });
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

test("packing consumes one Provision exactly once while Tool and Carrier remain reusable", () => {
	let state = createPrototypeState(7, { now: at });
	assert.equal(state.farmStock["clover-lunch"], 5);
	const compostBefore = state.farmStock.compost;
	state = packAdventure(state);

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
	let state = chooseAdventureBag(createPrototypeState(7, { now: at }));
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
	const pocketNames = { provision: "Provision", tool: "Tool", pack: "Carrier" };
	for (const missingSlot of ["provision", "tool", "pack"]) {
		let state = chooseAdventureBag(createPrototypeState(7, { now: at }), {
			[missingSlot]: null,
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
		assert.match(playerPresentation(state).objective, /Field Guide/);
		assert.match(playerPresentation(state).label, new RegExp(`Open the ${pocketNames[missingSlot]} pocket`));
	}
});

test("every Near-Discovery records a route-specific lesson and opens the missing pocket", () => {
	const firstRoute = createPrototypeState(10, { now: at });
	const secondRoute = throughSecondBag();
	const expected = {
		provision: ["seed to open at dusk", "Provision pocket", "silver route appears"],
		tool: ["sleeping root", "Tool pocket", "complete reflected path"],
		pack: ["protect the Seed", "Carrier pocket", "trail supplies Home"],
	};

	for (const missingSlot of ["provision", "tool", "pack"]) {
		const firstGuide = nearDiscoveryGuide({
			...firstRoute,
			stage: STAGES.NEAR_DISCOVERY,
			nearDiscoveryReason: missingSlot,
		});
		const secondGuide = nearDiscoveryGuide({
			...secondRoute,
			stage: STAGES.NEAR_DISCOVERY,
			nearDiscoveryReason: missingSlot,
		});
		assert.match(firstGuide.next, new RegExp(expected[missingSlot][0]));
		assert.match(firstGuide.action, new RegExp(expected[missingSlot][1]));
		assert.match(secondGuide.next, new RegExp(expected[missingSlot][2]));
		assert.match(secondGuide.action, new RegExp(expected[missingSlot][1]));
	}
});

test("a complete alternative loadout remains successful and visible at departure", () => {
	let state = createPrototypeState(7, { now: at });
	state = {
		...state,
		farmStock: { ...state.farmStock, "willow-fiber": 1 },
	};
	state = packAdventure(state, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});

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
	state = packAdventure(state, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});
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

test("all three Bag causes now happen in the clearing without field-note cards", () => {
	assert.match(appSource, /const activeTag = resolved \? null : story\.journeyTags\[activeBeatIndex\]/);
	assert.match(appSource, /beat === "provision" \? \(/);
	assert.match(appSource, /className="adventure-dusk-observation" role="status" aria-live="polite"/);
	assert.match(appSource, /<span className="sr-only">\{activeTag\.name\} \{activeTag\.detail\}<\/span>/);
	assert.doesNotMatch(appSource, /className="adventure-field-note"/);
	assert.doesNotMatch(stylesSource, /\.adventure-field-note/);
	assert.doesNotMatch(appSource, /className="adventure-cause-thread"/);
	assert.doesNotMatch(appSource, /className="adventure-find"/);
	assert.match(stylesSource, /@keyframes adventure-dusk-answer/);
	assert.match(stylesSource, /data-adventure-opportunity="lights-past-open-gate"[^\n]+\.adventure-dusk-observation i/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-dusk-observation i \{ animation: none; \}/);
	assert.match(appSource, /beat === "tool" \? \(/);
	assert.match(appSource, /className="adventure-tool-observation"/);
	assert.match(appSource, /data-tool-kind=\{state\.bag\?\.tool \?\? "none"\}/);
	assert.match(stylesSource, /@keyframes adventure-ground-answer/);
	assert.match(stylesSource, /data-tool-kind="lantern"/);
	assert.match(stylesSource, /data-tool-kind="none"/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-tool-observation i \{ animation: none; \}/);
	assert.match(appSource, /beat === "pack" \? \(/);
	assert.match(appSource, /className="adventure-pack-observation"/);
	assert.match(appSource, /data-pack-kind=\{state\.bag\?\.pack \?\? "none"\}/);
	assert.match(stylesSource, /@keyframes adventure-pack-answer/);
	assert.match(stylesSource, /data-pack-kind="cloth-wrap"/);
	assert.match(stylesSource, /data-pack-kind="none"/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-pack-observation i \{ animation: none; \}/);
});

test("the resolved cause sequence hands itself into the idle journey without revealing the Find", () => {
	assert.match(appSource, /className="adventure-trail-opening" role="status" aria-live="polite"/);
	assert.match(appSource, /Rosie follows the \{lanternleaf \? "reflected leaves beyond the gate" : "warm moth lights beyond the hedge"\}\. The journey continues\./);
	assert.match(appSource, /<i aria-hidden="true" \/><i aria-hidden="true" \/><i aria-hidden="true" \/><i aria-hidden="true" \/><i aria-hidden="true" \/>/);
	assert.match(appSource, /adventureCauseBeat === "resolved"[\s\S]+adventureHandoffPresentation\(state\)/);
	assert.match(appSource, /"Silver leaves lead Rosie onward"/);
	assert.match(appSource, /"Warm lights lead Rosie onward"/);
	assert.match(appSource, /adventureCauseBeat !== "resolved"/);
	assert.match(appSource, /ACTIONS\.CONTINUE_ADVENTURE_STORY/);
	assert.match(appSource, /REDUCED_ADVENTURE_HANDOFF_MS = 1800/);
	assert.doesNotMatch(appSource, /What Rosie found/);
	assert.doesNotMatch(appSource, /className="adventure-continue"/);
	assert.doesNotMatch(appSource, /className="adventure-auto-handoff"/);
	assert.doesNotMatch(appSource, />Let Rosie explore</);
	assert.doesNotMatch(appSource, /story\.journeyHeadline/);
	assert.match(stylesSource, /\.phone\[data-adventure-opportunity="lights-past-open-gate"\] \.adventure-trail-opening/);
	assert.match(stylesSource, /@keyframes adventure-trail-open-light/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-trail-opening::before,[\s\S]+\.adventure-trail-opening i \{ animation: none; \}/);
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

test("the idle journey receives the clearing lights before its information settles", () => {
	assert.match(appSource, /const JOURNEY_ENTRY_BRIDGE_MS = 900/);
	assert.match(appSource, /const \[journeyEntryFresh, setJourneyEntryFresh\] = useState\(false\)/);
	assert.match(appSource, /if \(!state\.reduceMotion\) setJourneyEntryFresh\(true\)/);
	assert.match(appSource, /setJourneyEntryFresh\(false\), JOURNEY_ENTRY_BRIDGE_MS/);
	assert.match(appSource, /entering && <div className="journey-entry-lights" aria-hidden="true"><i \/><i \/><i \/><i \/><i \/><\/div>/);
	assert.match(appSource, /entering=\{journeyEntryFresh\}/);
	assert.match(appSource, /showingJourneyWatch && !state\.adventureComplete && !journeyEntryFresh/);
	assert.match(stylesSource, /\.journey-entry-lights \{[\s\S]+--entry-light: var\(--journey-route-light\)/);
	assert.match(stylesSource, /@keyframes journey-entry-light-travel/);
	assert.match(stylesSource, /\.journey-watch\.is-entering \.journey-watch-note,[\s\S]+journey-entry-ui-arrive 430ms 390ms/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.journey-entry-lights,[\s\S]+animation: none/);
	assert.doesNotMatch(appSource, /journeyEntryFresh[^\n]+localStorage|serializeState\([^)]*journeyEntryFresh/);
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

test("the rendered journey advances one field note and one physical light route without shipping prototype controls", () => {
	assert.match(appSource, /data-journey-phase=\{journeyPhase\}/);
	assert.match(appSource, /The moths turn Home/);
	assert.match(appSource, /The leaves turn Home/);
	assert.match(appSource, /Rosie is heading Home/);
	assert.match(appSource, /const routeStatus = homecomingReady/);
	assert.match(appSource, /\? "Rosie is at the gate"/);
	assert.match(appSource, /"Silver leaves turn Home" : "Warm lights turn Home"/);
	assert.match(appSource, /homecomingReady \|\| homeward \? "is-complete" : "is-current"/);
	assert.match(appSource, /<div className="journey-watch-lights" aria-hidden="true">[\s\S]*<span>\{routeStatus\}<\/span>[\s\S]*<i \/><i \/><i \/><i \/><i \/>/);
	assert.match(appSource, /adventureHomewardAt\(state\)/);
	assert.match(appSource, /initialSearch\.get\("journey"\) === "homeward"/);
	assert.match(appSource, /initialSearch\.get\("route"\) === "lanternleaf"/);
	assert.match(stylesSource, /\.journey-watch-route \{[^}]*width: 1px;[^}]*clip-path: inset\(50%\)/s);
	assert.match(stylesSource, /\.journey-watch-lights span \{[^}]*left: 248px;[^}]*top: 268px/s);
	assert.match(stylesSource, /\.journey-watch\[data-journey-phase="homeward"\] \.journey-home-dusk i/);
	assert.match(stylesSource, /\.journey-watch\[data-journey-phase="homeward"\] \.journey-watch-lights i \{[^}]*animation-direction: reverse/s);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.journey-watch-lights i \{ animation: none; \}/);
	assert.doesNotMatch(appSource, /ProgressionPrototypeSwitcher|JourneyPathPrototypeSwitcher|progressionTreatment|searchParams\.set\("progression"|searchParams\.set\("path"/);
});

test("the browser fast-forward stays touch-safe beside the review rail while Homecoming remains in the world", () => {
	assert.match(appSource, /function JourneyReviewRailAction\(\{ actionLabel, onAction \}\)/);
	assert.match(appSource, /<small>Browser prototype<\/small><strong>Skip the six-hour wait<\/strong>/);
	assert.match(appSource, /<button type="button" aria-label=\{actionLabel\} onClick=\{onAction\}><span aria-hidden="true">↠<\/span> Fast-forward<\/button>/);
	assert.match(appSource, /showingJourneyWatch && !state\.adventureComplete && !journeyEntryFresh && <JourneyReviewRailAction/);
	assert.match(appSource, /actionLabel=\{presentation\.label\}/);
	assert.match(appSource, /homecomingReady && <button type="button" className="journey-watch-action"/);
	assert.match(stylesSource, /\.journey-review-rail-action button \{[^}]*min-height: 44px/s);
	assert.match(stylesSource, /\.journey-review-rail-action \{[^}]*bottom: max\(76px, calc\(env\(safe-area-inset-bottom\) \+ 64px\)\)/s);
	assert.doesNotMatch(appSource, /FastForwardPrototypeSwitcher|fastForwardTreatment|searchParams\.set\("fastforward"/);
});

test("the review rail names the real Position 9 journey beat", () => {
	assert.match(appSource, /function positionRailName\(\{ position, showingAdventureVignette, showingJourneyWatch, journeyPhase, adventureComplete \}\)/);
	assert.match(appSource, /if \(showingAdventureVignette\) return "Adventure begins"/);
	assert.match(appSource, /if \(adventureComplete\) return "At the gate"/);
	assert.match(appSource, /journeyPhase === "homeward" \? "Heading Home" : "Following the trail"/);
	assert.match(appSource, /<small>\{positionName \?\? current\.name\}<\/small>/);
	assert.match(appSource, /<PositionRail position=\{position\} onChange=\{jumpToPosition\} positionName=\{currentPositionName\} \/>/);
	assert.doesNotMatch(appSource, /RailReadoutVariant|RailCopySwitcher|railcopy/);
});

test("the quiet HUD follows Position 9 homeward without adding another journey surface", () => {
	assert.match(appSource, /function journeyHudObjective\(\{ showingJourneyWatch, journeyPhase, adventureComplete, defaultObjective \}\)/);
	assert.match(appSource, /if \(!showingJourneyWatch \|\| adventureComplete \|\| journeyPhase !== "homeward"\) return defaultObjective/);
	assert.match(appSource, /return "Rosie is heading Home"/);
	assert.match(appSource, /objective: journeyHudObjective\(\{/);
	assert.doesNotMatch(appSource, /JourneyHudPrototypeSwitcher|hudCopyVariant|hudcopy/);
});

test("the scene description follows Rosie Home without changing the visible composition", () => {
	assert.match(appSource, /if \(journeyPhase === "homeward"\) \{/);
	assert.match(appSource, /\? "Silver reflections turn toward the old gate"/);
	assert.match(appSource, /: "Warm moth lights turn toward the old gate"/);
	assert.match(appSource, /return `Rosie is heading Home\. \$\{homewardRoute\} across the twilight paper-craft Barn and remembered Kitchen Patch\. The porch light is waiting for her\.`/);
	assert.match(appSource, /aria-label=\{sceneLabel\(state, \{/);
	assert.match(appSource, /journeyPhase,/);
	assert.doesNotMatch(appSource, /SceneLabelPrototypeSwitcher|sceneCopyVariant|scenecopy/);
});

test("the journey watch keeps a quiet truthful reminder of what Rosie packed", () => {
	assert.match(appSource, /function JourneyPackedStamp\(\{ bag \}\)/);
	assert.match(appSource, /const label = `Rosie set out with: \$\{items\.map/);
	assert.match(appSource, /<div className="journey-packed-stamp" role="group" aria-label=\{label\}>/);
	assert.match(appSource, /!homecomingReady && <div className="journey-watch-facts">/);
	assert.match(appSource, /<JourneyPackedStamp bag=\{state\.bag\} \/>/);
	assert.match(stylesSource, /\.journey-packed-stamp \{[^}]*position: static;[^}]*flex: 1 1 58%;[^}]*grid-template-columns: 32px repeat\(3, 1fr\)/s);
	assert.match(stylesSource, /\.journey-packed-stamp > span\.is-empty \{ opacity: \.46; \}/);
	assert.doesNotMatch(appSource, /JourneyBagPrototypeSwitcher|JourneyWatchPrototypeSwitcher|loadoutTreatment|searchParams\.set\("loadout"|searchParams\.set\("watch"/);
});

test("an incomplete Bag stays causal throughout the idle journey", () => {
	assert.match(appSource, /const missingSlot = state\.underprepared \? state\.nearDiscoveryReason : null/);
	assert.match(appSource, /data-missing-capability=\{missingSlot \?\? undefined\}/);
	assert.match(appSource, /Without a Provision, she marks the warm glow/);
	assert.match(appSource, /Without a Tool, she leaves the roots undisturbed/);
	assert.match(appSource, /Without a Carrier, she traces its glowing leaf-print/);
	assert.match(appSource, /Without a Provision, she saves the night route/);
	assert.match(appSource, /Without a Tool, she follows their direction/);
	assert.match(appSource, /Without a Carrier, she records the reflected path/);
	assert.match(appSource, /provision: "Marked the glow", tool: "Root clue", pack: "Leaf-print"/);
	assert.match(appSource, /provision: "Marked reflections", tool: "Path clue", pack: "Trail map"/);
	assert.match(appSource, /A useful clue is coming Home/);
	assert.match(stylesSource, /\.journey-watch\.is-near-discovery \.journey-watch-lights i \{[^}]*background: transparent;[^}]*border: 2px dashed[^}]*animation: none;[^}]*opacity: \.78/s);
	assert.doesNotMatch(appSource, /JourneyTruthSwitcher|journeyTruthTreatment|journeytruth/);
});

test("the journey watch gives the persisted return time one calm stable place", () => {
	assert.match(appSource, /formatAdventureReturnPromise\(state\.adventureReadyAt, \{ now \}\)/);
	assert.match(appSource, /className="journey-return-time-ticket" role="group" aria-label=\{returnPromise\.ariaLabel\}/);
	assert.match(appSource, /<small aria-hidden="true">Expected Home<\/small>/);
	assert.match(appSource, /<strong aria-hidden="true">\{returnPromise\.display\}<\/strong>/);
	assert.match(appSource, /now=\{visualNow\}/);
	assert.match(stylesSource, /\.journey-watch-facts \{[^}]*display: flex;[^}]*border-top: 1px solid/s);
	assert.match(stylesSource, /\.journey-return-time-ticket \{[^}]*position: static;[^}]*flex: 1 1 42%;[^}]*height: 35px/s);
	assert.doesNotMatch(appSource, /ReturnTimePrototypeSwitcher|returnTimeVariant|searchParams\.set\("returntime"/);
});

test("the return promise adds local calendar context only when the date changes", () => {
	const now = Date.UTC(2026, 7, 8, 12, 0);
	const sameDay = formatAdventureReturnPromise(
		Date.UTC(2026, 7, 8, 18, 30),
		{ now, locale: "en-US" },
	);
	assert.match(sameDay.display, /^Around /);
	assert.doesNotMatch(sameDay.display, /Today|Tomorrow/);
	assert.match(sameDay.ariaLabel, /^Rosie is expected Home around /);

	const tomorrow = formatAdventureReturnPromise(
		Date.UTC(2026, 7, 9, 18, 30),
		{ now, locale: "en-US" },
	);
	assert.match(tomorrow.display, /^Tomorrow · /);
	assert.match(tomorrow.ariaLabel, /^Rosie is expected Home tomorrow around /);

	const later = formatAdventureReturnPromise(
		Date.UTC(2026, 7, 11, 18, 30),
		{ now, locale: "en-US" },
	);
	assert.match(later.display, /^Tue · /);
	assert.match(later.ariaLabel, /^Rosie is expected Home Tuesday around /);
	assert.equal(formatAdventureReturnPromise(now, { now }), null);
	assert.equal(formatAdventureReturnPromise(Number.NaN, { now }), null);
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

test("the first Adventure visibly settles a carried find into its chosen Carrier", () => {
	assert.match(appSource, /function adventurePackPresentation\(state\)/);
	assert.match(appSource, /Wicker Basket makes the Glowroot find safe/);
	assert.match(appSource, /Cloth Wrap protects the Lanternleaf/);
	assert.match(appSource, /Rosie maps the route for another visit/);
	assert.match(appSource, /adventureCauseBeat === "pack"[\s\S]+adventurePackPresentation\(state\)/);
	assert.match(appSource, /className="adventure-find-handoff" aria-hidden="true"><i \/><i \/><\/div>/);
	assert.match(stylesSource, /data-adventure-opportunity="glow-beneath-hedge"[^\n]+data-adventure-beat="pack"[^\n]+\.adventure-find-handoff/);
	assert.match(stylesSource, /animation: adventure-find-to-carrier 760ms cubic-bezier\(\.22,\.72,\.2,1\) both/);
	assert.match(stylesSource, /@keyframes adventure-find-to-carrier/);
	assert.match(stylesSource, /animation: adventure-carrier-receive 760ms cubic-bezier\(\.22,\.72,\.2,1\) both/);
	assert.match(stylesSource, /@keyframes adventure-carrier-receive/);
	assert.match(stylesSource, /67% \{ transform: translateY\(7px\) scale\(\.97\) rotate\(-1\.8deg\); \}/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\][^\n]+\.adventure-find-handoff/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-pack-prop \{ animation: none; \}/);
});

test("a packed Provision performs once and leaves the Adventure at dusk", () => {
	assert.match(stylesSource, /data-adventure-provision="clover-lunch"[^\n]+data-adventure-provision="moonberries"[^\n]+\[data-adventure-beat="provision"\] \.adventure-provision-prop/);
	assert.match(stylesSource, /animation: adventure-provision-one-use 760ms cubic-bezier\(\.16,1,\.3,1\) both/);
	assert.match(stylesSource, /@keyframes adventure-provision-dusk-arrive/);
	assert.match(stylesSource, /data-adventure-provision="moonberries"[^\n]+data-adventure-beat="tool"[^\n]+\.adventure-vignette-backdrop::before/);
	assert.match(stylesSource, /data-adventure-provision="moonberries"[^\n]+data-adventure-beat="resolved"[^\n]+\.adventure-provision-prop \{[\s\S]+?opacity: 0;[\s\S]+?animation: none;/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.adventure-provision-prop \{ animation: none; \}/);
	assert.match(stylesSource, /100% \{ opacity: \.16; transform: translate\(86px,-104px\) scale\(\.34\) rotate\(1deg\); \}/);
});

test("the Provision beat names its cause in the HUD and gives Rosie one authored response", () => {
	assert.match(appSource, /function adventureProvisionPresentation\(state\)/);
	assert.match(appSource, /Clover Lunch carries Rosie into \$\{lanternleaf \? "nightfall" : "dusk"\}/);
	assert.match(appSource, /Moonberries reveal the reflected path/);
	assert.match(appSource, /Daylight turns Rosie Home before the root opens/);
	assert.match(appSource, /adventureCauseBeat === "provision"[\s\S]+\? "adventure-provision"/);
	assert.match(appSource, /adventure-provision:\$\{opportunity\.id\}/);
	assert.match(riveContractSource, /\| "adventure-provision"/);
	assert.match(riveSceneSource, /"adventure-provision": "Rosie Tickle"/);
	assert.match(riveSceneSource, /trigger !== "adventure-provision"/);
});

test("the Tool beat gives Rosie one authored attention response", () => {
	assert.match(appSource, /function adventureToolPresentation\(state\)/);
	assert.match(appSource, /Hand Trowel tests the Lanternleaf path/);
	assert.match(appSource, /Hand Trowel parts the soft roots/);
	assert.match(appSource, /Lantern light catches the reflected leaves/);
	assert.match(appSource, /Rosie leaves the warm roots safely sleeping/);
	assert.match(appSource, /adventureCauseBeat === "tool"[\s\S]+adventureToolPresentation\(state\)/);
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
	let state = chooseAdventureBag(createPrototypeState(7, { now: at }), { pack: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });

	const story = adventureStory(state);
	assert.equal(story.kind, "near-discovery");
	assert.equal(story.tags[2].name, "No Carrier");
	assert.match(story.tags[2].detail, /leaf-print/);
});

test("Near-Discovery causes never claim that an unearned Seed came Home", () => {
	let state = chooseAdventureBag(createPrototypeState(7, { now: at }), { provision: null });
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
	state = chooseAdventureBag(state, {
		provision: "clover-lunch",
		tool: "lantern",
		pack: "cloth-wrap",
	});
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
	state = chooseAdventureBag(state, {
		provision: null,
		tool: "lantern",
		pack: "wicker-basket",
	});
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
	state = chooseAdventureBag(state, {
		provision: "clover-lunch",
		tool: null,
		pack: "wicker-basket",
	});
	state = reduce(state, { type: ACTIONS.JUMP_TO_POSITION, position: 10 });

	assert.equal(state.stage, STAGES.NEAR_DISCOVERY);
	assert.equal(state.nearDiscoveryReason, "tool");
	assert.equal(state.farmStock["glowroot-seed"], before["glowroot-seed"]);
	assert.equal(state.farmStock.compost, before.compost + 1);
	assert.equal(state.farmStock["willow-fiber"], before["willow-fiber"] + 1);
});

test("a successful return adds one named Discovery and practical Farm supplies", () => {
	let state = createPrototypeState(7, { now: at });
	state = packAdventure(state);
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
	assert.match(appSource, /Glowroot changed Home/);
	assert.match(appSource, /Bed 3 · Open hedge · Pond frog/);
	assert.match(appSource, /Farm stock stays useful/);
	assert.match(appSource, /Open Home changes and Farm stock/);
	assert.match(appSource, /!homeMemoryExpanded && <WorldAction/);
	assert.match(appSource, /!homeMemoryExpanded && !showingFarmingPanel/);
	assert.doesNotMatch(appSource, /className="home-memory-promise"/);
	assert.doesNotMatch(appSource, /className="home-memory-stock"/);
	assert.doesNotMatch(appSource, /Crops grow · Stock stays · Discoveries stay/);
	assert.match(stylesSource, /\.home-memory-pocket > span \{ min-width: 0; overflow: hidden;/);
	assert.match(stylesSource, /html\[data-reduce-motion="true"\] \.home-memory-pocket-detail \{ animation: none; \}/);
});

test("the earned crop choice keeps Rosie's current Adventure purpose attached to both harvests", () => {
	const firstMorning = createPrototypeState(2, { now: at });
	assert.equal(adventureOpportunity(firstMorning), FIRST_ADVENTURE_OPPORTUNITY);

	const secondMorning = createPrototypeState(2, {
		now: at,
		adventureRoute: "lanternleaf",
	});
	assert.equal(adventureOpportunity(secondMorning), SECOND_ADVENTURE_OPPORTUNITY);
	assert.equal(secondMorning.glowrootPlanted, true);
	assert.equal(secondMorning.nextPlanting, "moonberries");

	assert.match(appSource, /function SeedAdventureReceipt\(\{ opportunity, className = "", twoCrops = false \}\)/);
	assert.match(appSource, /Both harvests help Rosie explore/);
	assert.match(appSource, /Clover: stay longer · Moonberries: reveal reflections/);
	assert.match(appSource, /<SeedAdventureReceipt opportunity=\{opportunity\} className="seed-adventure-memory-receipt" twoCrops \/>/);
	assert.match(appSource, /<SeedChoicePanel\s+state=\{state\}\s+opportunity=\{opportunity\}/);
	assert.match(appSource, /What should Rosie grow for the lights\?/);
	assert.match(appSource, /3 guaranteed · stay until nightfall/);
	assert.match(appSource, /4 guaranteed · reveal reflected leaves/);
	assert.match(appSource, /onChoose\("moonberries"\)/);
	assert.match(stylesSource, /\.crop-choice-options \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
	assert.match(stylesSource, /\.seed-adventure-receipt \{/);
	assert.doesNotMatch(appSource, /InvitationSwitcher|invitationTreatment/);
});

test("a Near-Discovery still returns useful supplies without granting the Seed", () => {
	let state = chooseAdventureBag(createPrototypeState(7, { now: at }), { tool: null });
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
	assert.equal(playerPresentation(state).objective, "Glowroot Trail · Field Guide");
	assert.equal(playerPresentation(state).label, "Open the Tool pocket");
	assert.equal(primaryAction(state).label, "Open the Tool pocket");

	state = reduce(state, { type: ACTIONS.RETRY_PREP });
	assert.equal(state.prototypePosition, 7);
	assert.equal(state.nearDiscoveryReason, "tool");
	assert.equal(state.trace.at(-1).detail, "Open the Tool pocket");
});

test("the Near-Discovery Homecoming separates Field Guide knowledge from Farm supplies", () => {
	assert.match(appSource, /<span className="return-card-eyebrow">\{nearDiscovery \? "Field Guide updated"/);
	assert.match(appSource, /<b>\{guide\.next\}<\/b>/);
	assert.match(appSource, /nearDiscovery \? "Supplies brought Home" : "Added to Farm stock"/);
	assert.match(appSource, /\{!nearDiscovery && <span>\s*<b>Glowroot Seed<\/b>/);
	assert.match(appSource, /nearDiscovery \? guide\.action : actionLabel/);
	assert.match(appSource, /initialFocus=\{state\.nearDiscoveryReason \?\? "provision"\}/);
	assert.match(stylesSource, /\.return-stock-ledger-near > div \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
	assert.doesNotMatch(appSource, /NearHomeSwitcher|nearHomeTreatment|nearhome/);
});

test("the complete Homecoming separates the named Discovery from repeatable Farm supplies", () => {
	assert.match(appSource, /title: "Rosie discovered Glowroot"/);
	assert.match(appSource, /lanternleafDiscovery \? opportunity\.discoveryName : "Glowroot"/);
	assert.match(appSource, /: "A new living Crop for Home"/);
	assert.doesNotMatch(appSource, /lanternleafDiscovery \? opportunity\.discoveryName : `Glowroot Seed/);
	assert.match(appSource, /<b>Glowroot Seed<\/b>\s*<strong>\+\{glowrootAmount\}<\/strong>/);
	assert.match(stylesSource, /\.return-discovery-plaque:not\(\.is-near-discovery\) \{/);
	assert.match(stylesSource, /\.return-stock-ledger:not\(\.return-stock-ledger-near\) \{/);
	assert.doesNotMatch(appSource, /HomecomingHierarchySwitcher|returnVariant|homecomingTreatment/);
});

test("an earned Field Guide clue stays attached to the matching Bag pocket", () => {
	let state = chooseAdventureBag(createPrototypeState(7, { now: at }), { tool: null });
	state = reduce(state, { type: ACTIONS.PACK_ADVENTURE });
	state = reduce(state, { type: ACTIONS.START_ADVENTURE });
	state = reduce(state, { type: ACTIONS.CONTINUE_ADVENTURE_STORY });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
	state = reduce(state, { type: ACTIONS.WELCOME_HOME });
	state = reduce(state, { type: ACTIONS.RETRY_PREP });

	assert.equal(state.nearDiscoveryReason, "tool");
	state = reduce(state, { type: ACTIONS.SET_BAG_SLOT, slot: "tool", item: "lantern" });
	assert.equal(state.bag.tool, "lantern");
	assert.equal(state.nearDiscoveryReason, "tool");

	assert.match(appSource, /const bagClueSlot = BAG_SLOT_ORDER\.includes\(state\.nearDiscoveryReason\)/);
	assert.match(appSource, /\? `\$\{bagItem\(clueSlot, bag\[clueSlot\]\)\?\.name\} answers the \$\{opportunity\.clueName\} clue\.`/);
	assert.match(appSource, /\{slot === clueSlot && <i>\{clueIsApplied \? "Answered" : "Clue"\}<\/i>\}/);
	assert.match(appSource, /clueGuide=\{bagClueGuide\}/);
	assert.match(appSource, /clueSlot=\{bagClueSlot\}/);
	assert.match(stylesSource, /\.bag-selection\.has-bag-clue \.bag-guided-tabs button \{ grid-template-columns: 52px minmax\(0, 1fr\) auto; \}/);
	assert.match(stylesSource, /\.bag-guided-tabs i \{/);
	assert.doesNotMatch(appSource, /BagCluePrototypeSwitcher|bagClueStudy|bagclue/);
});
