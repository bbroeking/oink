import assert from "node:assert/strict";
import test from "node:test";
import {
	ACTIONS,
	OPTIONS,
	STEPS,
	adventureReducer,
	createInitialAdventureState,
	deserializeAdventureState,
	resolveAdventure,
	serializeAdventureState,
} from "./game.mjs";

test("the Adventure loop has no farming gate", () => {
	const publicModel = JSON.stringify({ STEPS, OPTIONS }).toLowerCase();
	for (const farmTerm of ["crop", "plant", "harvest", "compost", "farm stock", "seed inventory"]) {
		assert.equal(publicModel.includes(farmTerm), false, `${farmTerm} leaked into Adventure setup`);
	}
});

test("the return grants a fixed tickle reward independent of preparation", () => {
	let state = createInitialAdventureState();
	state = adventureReducer(state, { type: ACTIONS.NEXT });
	state = adventureReducer(state, { type: ACTIONS.NEXT });
	state = adventureReducer(state, { type: ACTIONS.NEXT });
	assert.equal(state.step, 3);
	assert.equal(state.ticklesEarned, 20);

	state = adventureReducer(state, {
		type: ACTIONS.CHOOSE,
		kind: "pack",
		value: "dry-bag",
	});
	assert.equal(state.ticklesEarned, 20);
});

test("changing only the Pack changes the default clue into Creek Glass", () => {
	const baseline = createInitialAdventureState();
	assert.equal(resolveAdventure(baseline).name, "The Blue Button");

	const dryBag = adventureReducer(baseline, {
		type: ACTIONS.CHOOSE,
		kind: "pack",
		value: "dry-bag",
	});
	assert.equal(resolveAdventure(dryBag).name, "Creek Glass");
});

test("a longer Spoon trip reveals the Hedge Bell", () => {
	const state = adventureReducer(createInitialAdventureState(), {
		type: ACTIONS.CHOOSE,
		kind: "trip",
		value: "good-wander",
	});
	assert.equal(resolveAdventure(state).name, "The Hedge Bell");
	assert.match(resolveAdventure(state).trace, /hangs beside the Barn door/);
});

test("navigation clamps and persisted state safely resumes", () => {
	let state = createInitialAdventureState();
	state = adventureReducer(state, { type: ACTIONS.BACK });
	assert.equal(state.step, 0);
	for (let index = 0; index < 10; index += 1) {
		state = adventureReducer(state, { type: ACTIONS.NEXT });
	}
	assert.equal(state.step, STEPS.length - 1);

	const resumed = deserializeAdventureState(serializeAdventureState(state));
	assert.equal(resumed.step, STEPS.length - 1);
	assert.equal(resumed.ticklesEarned, 20);
	assert.equal(deserializeAdventureState("not json").step, 0);
});
