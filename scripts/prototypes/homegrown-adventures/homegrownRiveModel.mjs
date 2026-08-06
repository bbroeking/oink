import { STAGES } from "./game.mjs";

const EMPTY_BEDS = Object.freeze(["empty", "empty", "empty"]);

function bedStates(state) {
	if (state.stage === STAGES.CLOVER_GROWING) return ["growing", "empty", "empty"];
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return ["ready", "empty", "empty"];
	}
	if (state.stage === STAGES.DEVELOPED) {
		return [
			"ready",
			state.nextPlanting === "moonberries" ? "growing" : "empty",
			"sprout",
		];
	}
	return EMPTY_BEDS;
}

function rosieAction(state) {
	const latest = state.trace.at(-1);
	if (state.lastAction === "tickle") {
		return latest?.detail === "Rosie noticed what changed" ? "notice" : "tickle";
	}
	if (state.lastAction === "harvest") return "harvest";
	if (state.lastAction === "pack") return "pack";
	if (["return", "near-discovery"].includes(state.lastAction)) return "return";
	return "idle";
}

function riveTrigger(state) {
	if (state.lastAction === "tickle") return "tickle";
	if (state.lastAction === "harvest") return "harvest";
	if (state.lastAction === "pack") return "pack";
	if (["return", "near-discovery"].includes(state.lastAction)) return "return";
	if (state.lastAction === "plant") return "plant";
	return null;
}

/**
 * Pure bridge from reducer facts to the authored Rive Data Binding contract.
 * Rive never owns progression, timers, rewards, or persistence.
 */
export function homegrownRiveModel(state) {
	const [bedOneState, bedTwoState, bedThreeState] = bedStates(state);
	const latest = state.trace.at(-1);
	const developed = state.stage === STAGES.DEVELOPED;
	const satchelEquipped = [
		STAGES.PACKED,
		STAGES.ADVENTURE,
		STAGES.GLOWROOT_RETURNED,
		STAGES.NEAR_DISCOVERY,
	].includes(state.stage);

	return {
		viewModel: {
			rosieMood:
				state.lastAction === "tickle" || developed ? "happy" : "content",
			rosieAction: rosieAction(state),
			satchelEquipped,
			bedOneState,
			bedTwoState,
			bedThreeState,
			hedgehogVisible: developed,
			frogVisible: developed,
			mothsVisible:
				state.stage === STAGES.ADVENTURE ||
				(developed && state.nextPlanting === "moonberries"),
			hedgeCrossingOpen: developed,
			hedgeBellEarned: developed,
			reduceMotion: Boolean(state.reduceMotion),
		},
		trigger: riveTrigger(state),
		triggerNonce: latest
			? `${latest.at}:${latest.kind}:${latest.detail}`
			: "initial",
	};
}
