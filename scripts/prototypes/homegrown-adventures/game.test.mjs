import assert from "node:assert/strict";
import test from "node:test";
import {
	ACTIONS,
	createInitialState,
	deserializeState,
	homegrownReducer,
	serializeState,
	settleState,
	STAGES,
} from "./game.mjs";
import { homegrownRiveModel } from "./homegrownRiveModel.mjs";

const at = 1_000_000;
const reduce = (state, action) => homegrownReducer(state, { now: at, ...action });

function throughCloverReady() {
	let state = createInitialState({ now: at });
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.CHOOSE_PURPOSE, purpose: "dusk-picnic" });
	state = reduce(state, { type: ACTIONS.PLANT_CLOVER });
	state = reduce(state, { type: ACTIONS.ADVANCE_TIME });
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
	state = reduce(state, { type: ACTIONS.TICKLE });
	state = reduce(state, { type: ACTIONS.PLANT_GLOWROOT });

	assert.equal(state.stage, STAGES.DEVELOPED);
	assert.equal(state.glowrootKnown, true);
	assert.deepEqual(state.fieldGuide, ["Clover Lunch", "Dusk Picnic", "Glowroot Seed"]);
	assert.equal(state.readyToTickle, 21);
	assert.equal(state.ticklesEarned, 1122);
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

test("direct review presets are deterministic", () => {
	const initial = createInitialState({ now: at });
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "ready" }).stage, STAGES.CLOVER_READY);
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "developed" }).stage, STAGES.DEVELOPED);
	assert.equal(reduce(initial, { type: ACTIONS.JUMP_TO_STATE, target: "missing" }), initial);
});

test("developed Barn records the player's next purposeful planting", () => {
	let state = reduce(createInitialState({ now: at }), { type: ACTIONS.JUMP_TO_STATE, target: "developed" });
	state = reduce(state, { type: ACTIONS.PLANT_NEXT, crop: "moonberries" });
	assert.equal(state.nextPlanting, "moonberries");
	assert.equal(state.trace.at(-1).kind, "next-planting");
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
	model = homegrownRiveModel(state);
	assert.deepEqual(
		[
			model.viewModel.bedOneState,
			model.viewModel.bedTwoState,
			model.viewModel.bedThreeState,
		],
		["growing", "empty", "empty"],
	);
	assert.equal(model.trigger, "plant");
});

test("Rive developed state exposes the lasting Home consequences", () => {
	const state = reduce(createInitialState({ now: at }), {
		type: ACTIONS.JUMP_TO_STATE,
		target: "developed",
	});
	const { viewModel } = homegrownRiveModel(state);
	assert.equal(viewModel.hedgehogVisible, true);
	assert.equal(viewModel.frogVisible, true);
	assert.equal(viewModel.mothsVisible, true);
	assert.equal(viewModel.hedgeCrossingOpen, true);
	assert.equal(viewModel.hedgeBellEarned, true);
	assert.deepEqual(
		[viewModel.bedOneState, viewModel.bedTwoState, viewModel.bedThreeState],
		["ready", "growing", "sprout"],
	);
});
