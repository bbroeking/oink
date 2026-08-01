import type {
	PigAnimation,
	PigEquipmentSelection,
} from "./pigRendererContract";
import { PIG_IDS, type PigId } from "@/utils/pigs";

export const RIVE_PIG_ARTBOARD = "pig";
export const RIVE_PIG_STATE_MACHINE = "pig";
export const RIVE_PIG_SKIN_ASSET = "pig_skin";

/**
 * Every coat is the same 370×383 alpha geometry. The Rive file references one
 * image asset named `pig_skin`; the runtime supplies the selected coat when it
 * mounts the shared mesh. This is stronger than duplicating six editor meshes:
 * there is only one topology, one weight map, and one skeleton to animate.
 */
const RIVE_PIG_SKIN_SOURCE = Object.freeze({
	rosie: require("../../assets/rive/prototype/textures/rosie.png"),
	copper: require("../../assets/rive/prototype/textures/copper.png"),
	pepper: require("../../assets/rive/prototype/textures/pepper.png"),
	bandit: require("../../assets/rive/prototype/textures/bandit.png"),
	pickles: require("../../assets/rive/prototype/textures/pickles.png"),
	biscuit: require("../../assets/rive/prototype/textures/biscuit.png"),
} satisfies Record<PigId, number>);

export const RIVE_PIG_SKIN_INDEX = Object.freeze({
	rosie: 0,
	copper: 1,
	pepper: 2,
	bandit: 3,
	pickles: 4,
	biscuit: 5,
} satisfies Record<PigId, number>);

export const RIVE_PIG_INPUTS = Object.freeze({
	skin: "skin",
	rest: "rest",
	walk: "walk",
	jump: "jump",
	happy: "happy",
	surprise: "surprise",
	wave: "wave",
	hat: "equip_hat",
	face: "equip_face",
	held: "equip_held",
} as const);

export type RivePigRestState = 0 | 1 | 2;

export interface RivePigEquipment {
	hat?: 0 | 1;
	face?: 0 | 1;
	held?: 0 | 1;
}

export const RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS = Object.freeze({
	hat: "party",
	face: "pixel_glasses",
	held: "garden_trowel_held",
} as const);

export type RivePigEquipmentSelection = PigEquipmentSelection;

export interface ResolvedRivePigEquipment {
	supported: boolean;
	equipment: RivePigEquipment;
}

export type RivePigAnimationCommand =
	| { kind: "rest"; value: RivePigRestState }
	| { kind: "trigger"; input: string };

export const RIVE_PIG_ANIMATION_COMMANDS = Object.freeze({
	idle: { kind: "rest", value: 0 },
	walk: { kind: "trigger", input: RIVE_PIG_INPUTS.walk },
	jump: { kind: "trigger", input: RIVE_PIG_INPUTS.jump },
	bounce: { kind: "trigger", input: RIVE_PIG_INPUTS.jump },
	happy: { kind: "trigger", input: RIVE_PIG_INPUTS.happy },
	sad: { kind: "rest", value: 1 },
	tired: { kind: "rest", value: 2 },
	surprise: { kind: "trigger", input: RIVE_PIG_INPUTS.surprise },
	wave: { kind: "trigger", input: RIVE_PIG_INPUTS.wave },
} satisfies Record<PigAnimation, RivePigAnimationCommand>);

export const RIVE_PIG_PROTOTYPE_ANIMATIONS = Object.freeze([
	"idle",
	"jump",
	"wave",
] as const satisfies readonly PigAnimation[]);

export function isRivePigPrototypeAnimation(
	animation: PigAnimation,
): animation is (typeof RIVE_PIG_PROTOTYPE_ANIMATIONS)[number] {
	return (RIVE_PIG_PROTOTYPE_ANIMATIONS as readonly PigAnimation[]).includes(
		animation,
	);
}

export function rivePigSkinIndex(pigId: PigId): number {
	return RIVE_PIG_SKIN_INDEX[pigId];
}

export function rivePigSkinSource(pigId: PigId): number {
	return RIVE_PIG_SKIN_SOURCE[pigId];
}

export function hasCompleteRiveSkinMap(): boolean {
	return PIG_IDS.every(
		(pigId, index) =>
			RIVE_PIG_SKIN_INDEX[pigId] === index &&
			RIVE_PIG_SKIN_SOURCE[pigId] !== undefined,
	);
}

/**
 * The spike only internalizes three representative anchored items. Any other
 * body-attached item must keep the whole stage on raster; rendering it as an
 * external overlay over continuous Rive motion would reintroduce drift.
 */
export function resolveRivePigEquipment({
	headId,
	faceId,
	heldId,
	maskId,
	neckId,
}: RivePigEquipmentSelection): ResolvedRivePigEquipment {
	const headSupported =
		headId == null || headId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.hat;
	const faceSupported =
		faceId == null || faceId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.face;
	const heldSupported =
		heldId == null || heldId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.held;
	const supported =
		headSupported &&
		faceSupported &&
		heldSupported &&
		maskId == null &&
		neckId == null;

	return {
		supported,
		equipment: {
			hat: headId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.hat ? 1 : 0,
			face: faceId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.face ? 1 : 0,
			held: heldId === RIVE_PIG_PROTOTYPE_EQUIPMENT_IDS.held ? 1 : 0,
		},
	};
}
