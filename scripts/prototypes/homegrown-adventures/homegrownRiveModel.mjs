import { STAGES } from "./game.mjs";

const EMPTY_BEDS = Object.freeze(["empty", "empty", "empty"]);

export const CLOVER_LUSH_THRESHOLD = 0.45;

function cropGrowthState(state, now) {
	if (
		state.plantedAt === null ||
		state.readyAt === null ||
		state.readyAt <= state.plantedAt
	) {
		return "sprout";
	}

	const progress = (now - state.plantedAt) / (state.readyAt - state.plantedAt);
	return progress >= CLOVER_LUSH_THRESHOLD ? "growing" : "sprout";
}

function bedStates(state, now) {
	const rememberedBedTwo =
		state.glowrootPlanted && state.nextPlanting === "moonberries"
			? "sprout"
			: "empty";
	const rememberedBedThree = state.glowrootPlanted ? "sprout" : "empty";
	if (state.stage === STAGES.CLOVER_GROWING) {
		const growthState = cropGrowthState(state, now);
		return state.selectedCrop === "moonberries"
			? ["empty", growthState, rememberedBedThree]
			: [growthState, rememberedBedTwo, rememberedBedThree];
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return state.selectedCrop === "moonberries"
			? ["empty", "ready", rememberedBedThree]
			: ["ready", rememberedBedTwo, rememberedBedThree];
	}
	if (state.stage === STAGES.CLOVER_READY && state.cloverHarvested && state.selectedCrop === "moonberries") {
		return ["empty", "sprout", rememberedBedThree];
	}
	if (state.stage === STAGES.DEVELOPED) {
		return [
			"empty",
			rememberedBedTwo,
			"sprout",
		];
	}
	if (state.glowrootPlanted) {
		return ["empty", rememberedBedTwo, rememberedBedThree];
	}
	return EMPTY_BEDS;
}

function rosieAction(state) {
	const latest = state.trace.at(-1);
	if (state.lastAction === "tickle") {
		return latest?.detail === "Rosie noticed what changed" ? "notice" : "tickle";
	}
	if (state.lastAction === "harvest") return "harvest";
	if (["pack", "choose-bag-item"].includes(state.lastAction)) return "pack";
	if (["return", "near-discovery"].includes(state.lastAction)) return "return";
	return "idle";
}

function riveTrigger(state) {
	if (state.lastAction === "tickle") return "tickle";
	if (state.lastAction === "harvest") return "harvest";
	if (state.lastAction === "pack") return "pack";
	if (state.lastAction === "choose-bag-item") return "adventure-attention";
	if (state.lastAction === "adventure") return "departure";
	if (["return", "near-discovery"].includes(state.lastAction)) return "return";
	if (state.lastAction === "plant") {
		if (state.glowrootPlanted) return "plant-glowroot";
		return state.compostApplied ? "plant-composted" : "plant";
	}
	return null;
}

/**
 * Pure bridge from reducer facts to the authored Rive Data Binding contract.
 * Rive never owns progression, timers, rewards, or persistence.
 */
export function homegrownRiveModel(state, now = Date.now()) {
	const [bedOneState, bedTwoState, bedThreeState] = bedStates(state, now);
	const latest = state.trace.at(-1);
	const developed = state.stage === STAGES.DEVELOPED || Boolean(state.glowrootPlanted);
	const satchelEquipped = [
		STAGES.PACKED,
		STAGES.ADVENTURE,
		STAGES.GLOWROOT_RETURNED,
		STAGES.NEAR_DISCOVERY,
	].includes(state.stage);

	return {
		bagReceive:
			state.lastAction === "choose-bag-item"
				? state.lastBagSelection ?? null
				: null,
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
