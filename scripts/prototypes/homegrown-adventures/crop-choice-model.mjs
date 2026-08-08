// PROTOTYPE — pure state model for one question:
// should the remembered Farm offer equivalent Adventure crops, a purposeful
// crop versus a stockpile detour, or two beds planned in parallel?

export const POLICIES = Object.freeze({
	equivalent: "Two Adventure crops",
	detour: "Purpose or stockpile",
	parallel: "Plan two beds",
});

const CROPS = Object.freeze({
	clover: Object.freeze({ duration: 4, compostDuration: 2, baseYield: 3, output: "cloverLunch" }),
	moonberry: Object.freeze({ duration: 8, compostDuration: 6, baseYield: 4, output: "moonberries" }),
});

export function createCropChoiceState(policy = "detour") {
	if (!POLICIES[policy]) throw new Error(`Unknown policy: ${policy}`);
	return {
		policy,
		step: "choose",
		purpose: "Stay for the lights beyond the open gate",
		purposeReady: false,
		selected: [],
		compost: false,
		growthHours: 0,
		stock: {
			cloverSeed: 2,
			moonberrySeed: 1,
			compost: 2,
			cloverLunch: 0,
			moonberries: 0,
			moonberryTart: 0,
		},
		lastResult: "Glowroot opened the route. Choose what the Farm does next.",
	};
}

function seedKey(crop) {
	return `${crop}Seed`;
}

export function cropChoiceReducer(state, action) {
	if (action.type === "reset") return createCropChoiceState(state.policy);
	if (action.type === "policy") return createCropChoiceState(action.policy);

	if (action.type === "choose") {
		const crop = action.crop;
		if (!CROPS[crop] || state.step !== "choose" || state.stock[seedKey(crop)] < 1) return state;
		if (state.policy === "parallel") {
			const selected = state.selected.includes(crop)
				? state.selected.filter((item) => item !== crop)
				: [...state.selected, crop];
			return { ...state, selected, lastResult: selected.length ? `Beds planned: ${selected.join(" + ")}` : "No beds planned" };
		}
		return { ...state, selected: [crop], step: "prepare", compost: false, lastResult: `${crop} selected` };
	}

	if (action.type === "compost") {
		if (!["prepare", "choose"].includes(state.step) || state.stock.compost < 1 || state.selected.length < 1) return state;
		return { ...state, compost: !state.compost, lastResult: state.compost ? "Compost saved" : "Compost added" };
	}

	if (action.type === "grow") {
		if ((state.policy === "parallel" ? state.step !== "choose" : state.step !== "prepare") || state.selected.length < 1) return state;
		const stock = { ...state.stock };
		for (const crop of state.selected) stock[seedKey(crop)] -= 1;
		if (state.compost) stock.compost -= 1;
		const growthHours = Math.max(...state.selected.map((crop) => state.compost ? CROPS[crop].compostDuration : CROPS[crop].duration));
		return { ...state, step: "ready", stock, growthHours, lastResult: `${state.selected.join(" + ")} ready after ${growthHours}h; nothing spoils` };
	}

	if (action.type === "harvest") {
		if (state.step !== "ready") return state;
		const stock = { ...state.stock };
		for (const crop of state.selected) {
			const rule = CROPS[crop];
			if (state.policy === "equivalent" && crop === "moonberry") stock.moonberryTart += 2;
			else stock[rule.output] += rule.baseYield + (state.compost ? 1 : 0);
		}
		const grewClover = state.selected.includes("clover");
		const purposeReady = grewClover || (state.policy === "equivalent" && state.selected.includes("moonberry"));
		return {
			...state,
			step: purposeReady ? "bag" : "choose",
			purposeReady,
			selected: [],
			compost: false,
			growthHours: 0,
			stock,
			lastResult: purposeReady
				? "Adventure provision ready; open Rosie's Bag"
				: "Moonberries stocked; the gate-light purpose is still waiting",
		};
	}

	return state;
}

export function describeCropChoices(state) {
	if (state.policy === "equivalent") {
		return [
			"Clover · 4h · 3 Lunches · stays for nightfall",
			"Moonberry · 8h · 2 Tarts · reveals reflected light",
		];
	}
	if (state.policy === "detour") {
		return [
			"Clover · 4h · 3 Lunches · advances today's Adventure",
			"Moonberry · 8h · 4 berries · builds Farm stock, then choose again",
		];
	}
	return [
		"Plan Clover in Bed 1 and/or Moonberry in Bed 2",
		"The longest crop owns the shared wait; harvest both together",
	];
}
