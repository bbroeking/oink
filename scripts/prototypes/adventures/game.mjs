export const ADVENTURE_STORAGE_KEY = "ttp.adventure-clickthrough.v1";

export const STEPS = Object.freeze([
	Object.freeze({ id: "invitation", label: "Invitation" }),
	Object.freeze({ id: "prepare", label: "Prepare" }),
	Object.freeze({ id: "journey", label: "Journey" }),
	Object.freeze({ id: "return", label: "Welcome Home" }),
	Object.freeze({ id: "reflect", label: "Replay" }),
]);

export const OPTIONS = Object.freeze({
	destination: Object.freeze([
		Object.freeze({
			id: "clover-verge",
			name: "Clover Verge",
			detail: "After rain · puddle light · a humming fencepost",
		}),
	]),
	tool: Object.freeze([
		Object.freeze({
			id: "wooden-spoon",
			name: "Wooden Spoon",
			detail: "Pry, tap, and listen without hurting small things",
		}),
		Object.freeze({
			id: "lantern",
			name: "Lantern",
			detail: "Notice paths and creatures that only answer light",
		}),
	]),
	pack: Object.freeze([
		Object.freeze({
			id: "wicker-basket",
			name: "Wicker Basket",
			detail: "Carry sturdy Finds Home in the open air",
		}),
		Object.freeze({
			id: "dry-bag",
			name: "Dry Bag",
			detail: "Preserve wet, fragile Finds on the walk Home",
		}),
	]),
	intention: Object.freeze([
		Object.freeze({
			id: "something-strange",
			name: "Look for something strange",
			detail: "Rosie follows the detail that does not quite belong",
		}),
		Object.freeze({
			id: "something-for-home",
			name: "Bring something for Home",
			detail: "Rosie favors a Find that can live near the Barn",
		}),
	]),
	trip: Object.freeze([
		Object.freeze({
			id: "poke-around",
			name: "Poke Around",
			detail: "A short wander near the familiar path",
		}),
		Object.freeze({
			id: "good-wander",
			name: "Good Wander",
			detail: "Stay long enough for the Verge to change",
		}),
	]),
});

export const ACTIONS = Object.freeze({
	CHOOSE: "choose",
	NEXT: "next",
	BACK: "back",
	RESET: "reset",
	SET_REDUCED_MOTION: "set-reduced-motion",
	SET_VERDICT: "set-verdict",
});

export function createInitialAdventureState({ reduceMotion = false } = {}) {
	return {
		version: 1,
		step: 0,
		destination: "clover-verge",
		tool: "wooden-spoon",
		pack: "wicker-basket",
		intention: "something-strange",
		trip: "poke-around",
		ticklesBefore: 120,
		ticklesEarned: 0,
		reduceMotion,
		verdict: {
			pull: null,
			resend: null,
		},
		trace: ["Opened the Adventure invitation"],
	};
}

function hasOption(kind, value) {
	return OPTIONS[kind]?.some((option) => option.id === value) ?? false;
}

function addTrace(state, line) {
	if (state.trace[state.trace.length - 1] === line) return state.trace;
	return [...state.trace, line];
}

export function adventureReducer(state, action) {
	switch (action.type) {
		case ACTIONS.CHOOSE: {
			if (!hasOption(action.kind, action.value)) return state;
			const choice = optionFor(action.kind, action.value);
			return {
				...state,
				[action.kind]: action.value,
				trace: addTrace(state, `Chose ${action.kind}: ${choice.name}`),
			};
		}
		case ACTIONS.NEXT: {
			const nextStep = Math.min(STEPS.length - 1, state.step + 1);
			if (nextStep === state.step) return state;
			return {
				...state,
				step: nextStep,
				ticklesEarned: nextStep >= 3 ? 20 : state.ticklesEarned,
				trace: addTrace(state, `Reached ${STEPS[nextStep].label}`),
			};
		}
		case ACTIONS.BACK: {
			const previousStep = Math.max(0, state.step - 1);
			if (previousStep === state.step) return state;
			return { ...state, step: previousStep };
		}
		case ACTIONS.SET_REDUCED_MOTION:
			return { ...state, reduceMotion: Boolean(action.value) };
		case ACTIONS.SET_VERDICT: {
			if (!Object.hasOwn(state.verdict, action.kind)) return state;
			return {
				...state,
				verdict: { ...state.verdict, [action.kind]: action.value },
				trace: addTrace(state, `Answered ${action.kind}: ${action.value}`),
			};
		}
		case ACTIONS.RESET:
			return createInitialAdventureState({ reduceMotion: state.reduceMotion });
		default:
			return state;
	}
}

export function optionFor(kind, value) {
	return OPTIONS[kind]?.find((option) => option.id === value) ?? null;
}

export function resolveAdventure(state) {
	if (state.trip === "good-wander" && state.tool === "wooden-spoon") {
		return {
			kind: "Wonder",
			name: "The Hedge Bell",
			story:
				"Rosie tapped the hollow fencepost with the Wooden Spoon and waited. Near dusk, something beneath the hedge answered with one small bell note.",
			cause: "The longer wander gave the fencepost time to answer; the Spoon let Rosie listen without breaking the hiding place.",
			trace: "The Hedge Bell now hangs beside the Barn door.",
			next: "Would the Bell answer differently after rain, or if Rosie carried a light?",
		};
	}

	if (state.pack === "dry-bag") {
		return {
			kind: "Discovery",
			name: "Creek Glass",
			story:
				"The puddle held a blue-green shard that looked like a piece of sky. Rosie sealed it in the Dry Bag before the rain-light could dissolve.",
			cause: "The Dry Bag preserved a wet, fragile Find that the open Wicker Basket could only remember as a clue.",
			trace: "Creek Glass rests on Rosie's Adventure shelf.",
			next: "What else appears only while Clover Verge is wet?",
		};
	}

	if (state.tool === "lantern" && state.intention === "something-strange") {
		return {
			kind: "Observation",
			name: "The Clover Beetle's Route",
			story:
				"The Lantern made a warm moon beneath the hedge. A green beetle crossed the light carrying a clover husk like a parcel.",
			cause: "The Lantern revealed a night path, and Rosie's strange-things intention kept her watching instead of collecting.",
			trace: "A beetle route is sketched in Rosie's Field Guide.",
			next: "Where does the tiny courier go when nobody lights the path?",
		};
	}

	return {
		kind: "Curio + clue",
		name: "The Blue Button",
		story:
			"Rosie found a blue button beside Rain-Glass Puddle. The Basket brought the button Home, but a glimmer in the puddle vanished through its weave.",
		cause: "The Wicker Basket carried the sturdy Curio and taught Rosie that the glimmer needs something waterproof.",
		trace: "The Blue Button sits on the Barn shelf; Rain-Glass Puddle is marked for another visit.",
		next: "What would come Home if Rosie changed only the Pack?",
	};
}

export function adventureTrace(state) {
	const outcome = resolveAdventure(state);
	return [
		"Tickle the Pig — Adventure-only prototype",
		`Destination: ${optionFor("destination", state.destination)?.name}`,
		`Tool: ${optionFor("tool", state.tool)?.name}`,
		`Pack: ${optionFor("pack", state.pack)?.name}`,
		`Intention: ${optionFor("intention", state.intention)?.name}`,
		`Trip: ${optionFor("trip", state.trip)?.name}`,
		`Return: ${outcome.kind} — ${outcome.name}`,
		`Home trace: ${outcome.trace}`,
		`Fixed homecoming reward: +${state.ticklesEarned} tickles`,
		`Primary pull: ${state.verdict.pull ?? "unanswered"}`,
		`Would resend: ${state.verdict.resend ?? "unanswered"}`,
	].join("\n");
}

export function serializeAdventureState(state) {
	return JSON.stringify(state);
}

export function deserializeAdventureState(raw, { reduceMotion = false } = {}) {
	if (!raw) return createInitialAdventureState({ reduceMotion });
	try {
		const parsed = JSON.parse(raw);
		const initial = createInitialAdventureState({ reduceMotion });
		if (parsed?.version !== initial.version) return initial;
		return {
			...initial,
			...parsed,
			step: Math.max(0, Math.min(STEPS.length - 1, Number(parsed.step) || 0)),
			reduceMotion,
			verdict: { ...initial.verdict, ...parsed.verdict },
			trace: Array.isArray(parsed.trace) ? parsed.trace.slice(-30) : initial.trace,
		};
	} catch {
		return createInitialAdventureState({ reduceMotion });
	}
}
