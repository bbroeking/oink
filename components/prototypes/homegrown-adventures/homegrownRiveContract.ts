export type RosieMood = "content" | "happy" | "sad";
export type RosieAction = "idle" | "tickle" | "notice" | "harvest" | "pack" | "return";
export type BedState = "empty" | "sprout" | "growing" | "ready";

/**
 * Data Binding contract for the authored web scene. The reducer owns these
 * facts; a future .riv View Model mirrors them and emits intent triggers only.
 */
export interface HomegrownRiveViewModel {
	rosieMood: RosieMood;
	rosieAction: RosieAction;
	satchelEquipped: boolean;
	bedOneState: BedState;
	bedTwoState: BedState;
	bedThreeState: BedState;
	hedgehogVisible: boolean;
	frogVisible: boolean;
	mothsVisible: boolean;
	hedgeCrossingOpen: boolean;
	hedgeBellEarned: boolean;
	reduceMotion: boolean;
}

export const HOMEGROWN_RIVE_TRIGGERS = Object.freeze([
	"tickle",
	"harvest",
	"pack",
	"return",
	"plant",
] as const);

export type HomegrownRiveTrigger = (typeof HOMEGROWN_RIVE_TRIGGERS)[number];

export const HOMEGROWN_RIVE_NAMES = Object.freeze({
	artboard: "Homegrown Adventures",
	stateMachine: "Homegrown Adventures State Machine",
	viewModel: "Homegrown Adventures View Model",
	viewModelInstance: "Browser Prototype",
});
