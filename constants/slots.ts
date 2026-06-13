// Equip slots — derived from anchor points (constants/hats.ts CATEGORY_OVERLAYS).
// Categories at different anchors are different slots and can be worn together;
// categories that share a body region share a slot (one at a time). This is the
// model behind the Closet "wear each slot at the same time" UX.

export type EquipSlotKey =
	| "head"
	| "eyes" // legacy — merged into "face" (kept for back-compat readers)
	| "face"
	| "neck"
	| "aura"
	| "held"
	| "tickle"
	| "background"
	| "flag";

// Which slot a catalog category occupies. Glasses + masks share ONE
// player-facing "Face" slot (the old separate Eyes chip read as clutter);
// they still persist to their own profile columns — see columnForCategory.
// tickle_particle gets a real chip too (it has a column + closet section).
export const SLOT_FOR_CATEGORY: Record<string, EquipSlotKey> = {
	hat: "head",
	bow: "head",
	glasses: "face",
	mask: "face",
	scarf: "neck",
	necklace: "neck",
	aura: "aura",
	held: "held",
	background: "background",
	flag: "flag",
	tickle_particle: "tickle",
};

// profiles column that stores each slot's equipped item id.
export const SLOT_COLUMN: Record<EquipSlotKey, string> = {
	head: "active_hat_id",
	eyes: "active_glasses_id",
	face: "active_mask_id",
	neck: "active_neck_id",
	aura: "active_aura_id",
	held: "active_held_id",
	tickle: "active_tickle_particle_id",
	background: "active_background_id",
	flag: "active_flag_id",
};

// Player-facing slot labels (Closet slot chips).
export const SLOT_LABEL: Record<EquipSlotKey, string> = {
	head: "Hat",
	eyes: "Eyes",
	face: "Face",
	neck: "Neck",
	tickle: "Tickles",
	aura: "Aura",
	held: "Held",
	background: "Background",
	flag: "Flag",
};

// Order the slot chips appear in the Closet.
export const SLOT_ORDER: EquipSlotKey[] = [
	"head",
	"face",
	"neck",
	"held",
	"tickle",
	"aura",
	"background",
	"flag",
];

export function slotForCategory(category: string | null | undefined): EquipSlotKey {
	return (category && SLOT_FOR_CATEGORY[category]) || "head";
}

// Category-precise persistence column. Needed because glasses + masks share
// the "face" SLOT (one chip) but keep SEPARATE profile columns — routing a
// glasses equip through SLOT_COLUMN[slotForCategory] would write the mask
// column. Everything else falls through to its slot's column.
export function columnForCategory(category: string | null | undefined): string {
	if (category === "glasses") return "active_glasses_id";
	if (category === "mask") return "active_mask_id";
	return SLOT_COLUMN[slotForCategory(category)];
}

// All columns a slot chip reads (face shows mask ?? glasses; ✕ may need both).
export function columnsForSlot(slot: EquipSlotKey): string[] {
	if (slot === "face") return ["active_mask_id", "active_glasses_id"];
	return [SLOT_COLUMN[slot]];
}
