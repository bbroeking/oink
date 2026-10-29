// The words a full costume speaks (Halloween 2026, Claude Design canvas
// direction A, "a Costume slot": docs/design/claude-design/costumes-2026-10-29).
// One rule behind all of them: a costume hides everything worn on the pig
// (hat, bow, face, neck, held and aura; founder ruling 2026-10-29) and keeps
// it underneath, so taking it off brings the outfit back. The lines name only
// the slots that actually hold something. No em dashes (lint-enforced).

import { columnsForSlot, SLOT_LABEL, type EquipSlotKey } from "@/constants/slots";

/** The slots a worn costume covers, in Closet chip order. */
export const COSTUME_COVERED_SLOTS: readonly EquipSlotKey[] = [
	"head",
	"bow",
	"face",
	"neck",
	"held",
	"aura",
];

export function isCoveredByCostume(slot: EquipSlotKey): boolean {
	return COSTUME_COVERED_SLOTS.includes(slot);
}

/** Covered slots that hold an item right now (what waits underneath). */
export function slotsWaitingUnder(
	activeIds: Readonly<Record<string, string | null | undefined>>,
): EquipSlotKey[] {
	return COSTUME_COVERED_SLOTS.filter((slot) =>
		columnsForSlot(slot).some((column) => !!activeIds[column]),
	);
}

/** "Hat", "Hat and Bow", "Hat, Bow and Face". */
export function joinWords(words: readonly string[]): string {
	if (words.length <= 1) return words[0] ?? "";
	return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

// The lowercase noun for what a slot holds, by the worn item's own category
// where it matters (the Face slot is glasses or a mask).
const NOUN_FOR_COLUMN: Record<string, string> = {
	active_hat_id: "hat",
	active_bow_id: "bow",
	active_glasses_id: "glasses",
	active_mask_id: "mask",
	active_neck_id: "neckwear",
	active_held_id: "held piece",
	active_aura_id: "aura",
};
const PLURAL_NOUNS = new Set(["glasses"]);

/** "hat", "bow", "glasses": the worn things under a costume, in chip order. */
export function wornNounsUnder(
	activeIds: Readonly<Record<string, string | null | undefined>>,
): string[] {
	const nouns: string[] = [];
	for (const slot of COSTUME_COVERED_SLOTS) {
		const column = columnsForSlot(slot).find((c) => !!activeIds[c]);
		if (column) nouns.push(NOUN_FOR_COLUMN[column] ?? "piece");
	}
	return nouns;
}

const isPlural = (nouns: readonly string[]) =>
	nouns.length > 1 || (nouns.length === 1 && PLURAL_NOUNS.has(nouns[0]));

/** The hand line under Rosie while a costume is on. */
export function costumeOnLine(
	costumeName: string,
	activeIds: Readonly<Record<string, string | null | undefined>>,
): string {
	const waiting = slotsWaitingUnder(activeIds).map((slot) => SLOT_LABEL[slot]);
	if (waiting.length === 0) return `${costumeName} is on.`;
	const verb = waiting.length > 1 ? "wait" : "waits";
	return `${costumeName} is on. ${joinWords(waiting)} ${verb} underneath.`;
}

/** The toast when a costume comes off. */
export function costumeOffLine(
	costumeName: string,
	activeIds: Readonly<Record<string, string | null | undefined>>,
): string {
	const nouns = wornNounsUnder(activeIds);
	if (nouns.length === 0) return `${costumeName} is off.`;
	return `${costumeName} is off. Your ${joinWords(nouns)} ${isPlural(nouns) ? "are" : "is"} back.`;
}

/** The preview sheet's cover line for a costume being tried on. */
export function costumeCoverLine(
	activeIds: Readonly<Record<string, string | null | undefined>>,
): string {
	const lead = "Covers everything but her face and hooves.";
	const nouns = wornNounsUnder(activeIds);
	if (nouns.length === 0) return lead;
	return `${lead} Your ${joinWords(nouns)} ${isPlural(nouns) ? "stay" : "stays"} put underneath.`;
}

/** Rosie-only in v1: what a costume says to a player on another pig. */
export const COSTUME_FITS_ROSIE_TAG = "fits Rosie";
export const COSTUME_FITS_ROSIE_LINE =
	"Costumes are fitted to Rosie for now. Switch to Rosie to wear one.";

/**
 * Why an equip tap must not reach the server, or null to go ahead: a costume
 * put on a pig its art is not fitted to (v1: anything but Rosie). The server
 * refuses it too (equip_cosmetic: costume_rosie_only); this says why first.
 */
export function costumeEquipRefusal(
	category: string | null | undefined,
	itemId: string | null,
	pigId: string | null | undefined,
): string | null {
	if (category !== "costume" || !itemId) return null;
	return (pigId ?? "rosie") === "rosie" ? null : COSTUME_FITS_ROSIE_LINE;
}

/**
 * The take-off toast for an unequip of the costume slot, computed from the
 * outfit BEFORE the write (what comes back out from underneath), or null.
 */
export function costumeTakeOffToast(
	category: string | null | undefined,
	itemId: string | null,
	activeIds: Readonly<Record<string, string | null | undefined>>,
	nameOf: (id: string) => string | null | undefined,
): string | null {
	if (category !== "costume" || itemId) return null;
	const worn = activeIds["active_costume_id"];
	if (!worn) return null;
	return costumeOffLine(nameOf(worn) ?? "The costume", activeIds);
}
