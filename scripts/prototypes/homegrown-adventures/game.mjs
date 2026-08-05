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
	CHOOSE_PURPOSE: "choose-purpose",
	PLANT_CLOVER: "plant-clover",
	ADVANCE_TIME: "advance-time",
	SETTLE: "settle",
	HARVEST_CLOVER: "harvest-clover",
	PACK_ADVENTURE: "pack-adventure",
	PACK_LIGHT: "pack-light",
	START_ADVENTURE: "start-adventure",
	WELCOME_HOME: "welcome-home",
	PLANT_GLOWROOT: "plant-glowroot",
	RETRY_PREP: "retry-prep",
	PLANT_NEXT: "plant-next",
	TOGGLE_REDUCED_MOTION: "toggle-reduced-motion",
	JUMP_TO_STATE: "jump-to-state",
	RESET: "reset",
});

const GROWTH_MS = 4 * 60 * 60 * 1000;
const ADVENTURE_MS = 6 * 60 * 60 * 1000;

function event(kind, detail, at) {
	return { kind, detail, at };
}

export function createInitialState({ now = Date.now(), reduceMotion = false } = {}) {
	return {
		version: 1,
		stage: STAGES.STARTING,
		readyToTickle: 24,
		ticklesEarned: 1119,
		hasTickled: false,
		meaningfulChangePending: false,
		changeRevealed: false,
		purpose: null,
		cloverHarvested: false,
		plantedAt: null,
		readyAt: null,
		adventureStartedAt: null,
		adventureReadyAt: null,
		adventureComplete: false,
		underprepared: false,
		glowrootKnown: false,
		fieldGuide: [],
		nextPlanting: null,
		reduceMotion,
		lastAction: "arrive",
		trace: [event("arrive", "Starting Barn", now)],
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

function jumpState(state, target, now) {
	const base = createInitialState({ now, reduceMotion: state.reduceMotion });
	const presets = {
		starting: base,
		ready: {
			...base,
			stage: STAGES.CLOVER_READY,
			hasTickled: true,
			purpose: "dusk-picnic",
			meaningfulChangePending: true,
			plantedAt: now - GROWTH_MS,
			readyAt: now,
		},
		developed: {
			...base,
			stage: STAGES.DEVELOPED,
			hasTickled: true,
			purpose: "dusk-picnic",
			cloverHarvested: true,
			glowrootKnown: true,
			changeRevealed: true,
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
			return changed(
				state,
				{
					readyToTickle: state.readyToTickle - 1,
					ticklesEarned: state.ticklesEarned + 1,
					hasTickled: true,
					changeRevealed:
						state.changeRevealed || state.meaningfulChangePending,
					meaningfulChangePending: false,
				},
				"tickle",
				state.meaningfulChangePending
					? "Rosie noticed what changed"
					: "Rosie laughed",
				now,
			);

		case ACTIONS.CHOOSE_PURPOSE:
			if (!state.hasTickled || state.stage !== STAGES.STARTING) return state;
			if (action.purpose !== "dusk-picnic") return state;
			return changed(
				state,
				{ purpose: action.purpose },
				"choose-purpose",
				"Grow for the Dusk Picnic",
				now,
			);

		case ACTIONS.PLANT_CLOVER:
			if (state.stage !== STAGES.STARTING || state.purpose !== "dusk-picnic") {
				return state;
			}
			return changed(
				state,
				{
					stage: STAGES.CLOVER_GROWING,
					plantedAt: now,
					readyAt: now + GROWTH_MS,
				},
				"plant",
				"Clover Lunch",
				now,
			);

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

		case ACTIONS.HARVEST_CLOVER:
			if (state.stage !== STAGES.CLOVER_READY || !state.changeRevealed) {
				return state;
			}
			return changed(
				state,
				{
					cloverHarvested: true,
					fieldGuide: state.fieldGuide.includes("Clover Lunch")
						? state.fieldGuide
						: [...state.fieldGuide, "Clover Lunch"],
				},
				"harvest",
				"Clover Lunch",
				now,
			);

		case ACTIONS.PACK_ADVENTURE:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			return changed(
				state,
				{ stage: STAGES.PACKED, underprepared: false },
				"pack",
				"Clover Lunch + Wooden Spoon + Wicker Basket + Bring something Home",
				now,
			);

		case ACTIONS.PACK_LIGHT:
			if (state.stage !== STAGES.CLOVER_READY || !state.cloverHarvested) {
				return state;
			}
			return changed(
				state,
				{ stage: STAGES.PACKED, underprepared: true },
				"pack",
				"Wooden Spoon + Wicker Basket; Clover Lunch left Home",
				now,
			);

		case ACTIONS.START_ADVENTURE:
			if (state.stage !== STAGES.PACKED) return state;
			return changed(
				state,
				{
					stage: STAGES.ADVENTURE,
					adventureStartedAt: now,
					adventureReadyAt: now + ADVENTURE_MS,
					adventureComplete: false,
				},
				"adventure",
				"Dusk Picnic began",
				now,
			);

		case ACTIONS.WELCOME_HOME:
			if (state.stage !== STAGES.ADVENTURE || !state.adventureComplete) {
				return state;
			}
			if (state.underprepared) {
				return changed(
					state,
					{
						stage: STAGES.NEAR_DISCOVERY,
						meaningfulChangePending: false,
						changeRevealed: true,
						fieldGuide: [...new Set([...state.fieldGuide, "Dusk Picnic", "Glowroot trail (clue)"])],
					},
					"near-discovery",
					"Rosie found the warm moth trail, but came Home kindly before the seed opened",
					now,
				);
			}
			return changed(
				state,
				{
					stage: STAGES.GLOWROOT_RETURNED,
					glowrootKnown: true,
					meaningfulChangePending: true,
					changeRevealed: false,
					fieldGuide: [...new Set([...state.fieldGuide, "Dusk Picnic", "Glowroot Seed"])],
				},
				"return",
				"Glowroot Seed — the Clover Lunch kept Rosie until the moths appeared",
				now,
			);

		case ACTIONS.PLANT_GLOWROOT:
			if (state.stage !== STAGES.GLOWROOT_RETURNED || !state.changeRevealed) {
				return state;
			}
			return changed(
				state,
				{ stage: STAGES.DEVELOPED },
				"plant",
				"Glowroot Seed changed the Barn path",
				now,
			);

		case ACTIONS.RETRY_PREP:
			if (state.stage !== STAGES.NEAR_DISCOVERY) return state;
			return changed(
				state,
				{
					stage: STAGES.CLOVER_READY,
					underprepared: false,
					adventureComplete: false,
					meaningfulChangePending: false,
					changeRevealed: true,
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

		case ACTIONS.TOGGLE_REDUCED_MOTION:
			return changed(
				state,
				{ reduceMotion: !state.reduceMotion },
				"reduce-motion",
				!state.reduceMotion ? "on" : "off",
				now,
			);

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
		return settleState({ ...createInitialState({ now, reduceMotion }), ...parsed }, now);
	} catch {
		return createInitialState({ now, reduceMotion });
	}
}

export function primaryAction(state) {
	if (!state.hasTickled) return { type: ACTIONS.TICKLE, label: "Tickle Rosie" };
	if (state.stage === STAGES.STARTING && !state.purpose) {
		return {
			type: ACTIONS.CHOOSE_PURPOSE,
			purpose: "dusk-picnic",
			label: "Grow for the Dusk Picnic",
		};
	}
	if (state.stage === STAGES.STARTING) {
		return { type: ACTIONS.PLANT_CLOVER, label: "Plant Clover Lunch" };
	}
	if (state.stage === STAGES.CLOVER_GROWING) {
		return { type: ACTIONS.ADVANCE_TIME, label: "Let the afternoon pass" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.changeRevealed) {
		return { type: ACTIONS.TICKLE, label: "Welcome Rosie" };
	}
	if (state.stage === STAGES.CLOVER_READY && !state.cloverHarvested) {
		return { type: ACTIONS.HARVEST_CLOVER, label: "Harvest Clover Lunch" };
	}
	if (state.stage === STAGES.CLOVER_READY) {
		return { type: ACTIONS.PACK_ADVENTURE, label: "Pack the Dusk Picnic" };
	}
	if (state.stage === STAGES.PACKED) {
		return { type: ACTIONS.START_ADVENTURE, label: "Send Rosie at dusk" };
	}
	if (state.stage === STAGES.ADVENTURE && !state.adventureComplete) {
		return { type: ACTIONS.ADVANCE_TIME, label: "Let dusk pass" };
	}
	if (state.stage === STAGES.ADVENTURE) {
		return { type: ACTIONS.WELCOME_HOME, label: "Welcome Rosie Home" };
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED && !state.changeRevealed) {
		return { type: ACTIONS.TICKLE, label: "Tickle Rosie to hear her story" };
	}
	if (state.stage === STAGES.GLOWROOT_RETURNED) {
		return { type: ACTIONS.PLANT_GLOWROOT, label: "Plant Glowroot" };
	}
	if (state.stage === STAGES.NEAR_DISCOVERY) {
		return { type: ACTIONS.RETRY_PREP, label: "Pack Clover and try again" };
	}
	return { type: ACTIONS.PLANT_NEXT, crop: "moonberries", label: "Grow Moonberries for the moths" };
}

export const DURATIONS = Object.freeze({ GROWTH_MS, ADVENTURE_MS });
