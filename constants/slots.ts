// Equip slots — derived from anchor points (constants/hats.ts CATEGORY_OVERLAYS).
// Categories at different anchors are different slots and can be worn together;
// categories that share a body region share a slot (one at a time). This is the
// model behind the Closet "wear each slot at the same time" UX.

export type EquipSlotKey =
	| "head"
	| "eyes"
	| "face"
	| "neck"
	| "aura"
	| "held"
	| "background"
	| "flag";

// Which slot a catalog category occupies. (tickle_particle is the tap
// animation, not a worn slot, so it's intentionally absent.)
export const SLOT_FOR_CATEGORY: Record<string, EquipSlotKey> = {
	hat: "head",
	bow: "head",
	glasses: "eyes",
	mask: "face",
	scarf: "neck",
	necklace: "neck",
	aura: "aura",
	held: "held",
	background: "background",
	flag: "flag",
};

// profiles column that stores each slot's equipped item id.
export const SLOT_COLUMN: Record<EquipSlotKey, string> = {
	head: "active_hat_id",
	eyes: "active_glasses_id",
	face: "active_mask_id",
	neck: "active_neck_id",
	aura: "active_aura_id",
	held: "active_held_id",
	background: "active_background_id",
	flag: "active_flag_id",
};

// Player-facing slot labels (Closet slot chips).
export const SLOT_LABEL: Record<EquipSlotKey, string> = {
	head: "Hat",
	eyes: "Eyes",
	face: "Face",
	neck: "Neck",
	aura: "Aura",
	held: "Held",
	background: "Background",
	flag: "Flag",
};

// Order the slot chips appear in the Closet.
export const SLOT_ORDER: EquipSlotKey[] = [
	"head",
	"eyes",
	"face",
	"neck",
	"held",
	"aura",
	"background",
	"flag",
];

export function slotForCategory(category: string | null | undefined): EquipSlotKey {
	return (category && SLOT_FOR_CATEGORY[category]) || "head";
}
