// The words a full costume speaks (Halloween 2026, Claude Design canvas
// direction A, "a Costume slot": docs/design/claude-design/costumes-2026-10-29).
// One rule behind all of them: a costume hides everything worn on the pig
// (hat, bow, face, neck, held and aura; founder ruling 2026-10-29) and keeps
// it underneath, so taking it off brings the outfit back. The lines name only
// the slots that actually hold something. No em dashes (lint-enforced).
//
// Which pigs a costume fits is read from the skin manifest
// (utils/costumeFit.ts), never written into a line: a partial set names the
// pigs it has, and a full set says every pig can wear one.

import { columnsForSlot, SLOT_LABEL, type EquipSlotKey } from "@/constants/slots";
import {
	costumeCoverage,
	costumeFitsPig,
	costumeName,
	costumePigs,
	DEFAULT_COSTUME_PIG,
	isCostumeAvailable,
} from "@/utils/costumeFit";
import { PIG_IDS, pigDefinition, pigPronouns, type PigId } from "@/utils/pigs";

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

/** The preview sheet's cover line for a costume being tried on (on `pigId`). */
export function costumeCoverLine(
	activeIds: Readonly<Record<string, string | null | undefined>>,
	pigId: PigId | string | null | undefined = DEFAULT_COSTUME_PIG,
): string {
	const lead = `Covers everything but ${pigPronouns(pigId).possessive} face and hooves.`;
	const nouns = wornNounsUnder(activeIds);
	if (nouns.length === 0) return lead;
	return `${lead} Your ${joinWords(nouns)} ${isPlural(nouns) ? "stay" : "stays"} put underneath.`;
}

const pigName = (id: PigId | string | null | undefined) =>
	pigDefinition(id ?? DEFAULT_COSTUME_PIG).name;
const pigNames = (ids: readonly PigId[]) => ids.map((id) => pigDefinition(id).name);

/** A costume this binary has no skin for (never offered; a stale tap). */
export const COSTUME_NOT_READY_LINE = "This costume arrives in a later update.";

/**
 * The corner tag on a costume tile: "costume" when it fits the pig in the
 * Closet, otherwise what it fits instead ("fits Rosie" while one pig has it,
 * "not for Pepper" once several do).
 */
export function costumeTileTag(
	costumeId: string,
	pigId: PigId | string | null | undefined,
): string {
	if (costumeFitsPig(costumeId, pigId)) return "costume";
	const pigs = costumePigs(costumeId);
	if (pigs.length === 1) return `fits ${pigName(pigs[0])}`;
	return `not for ${pigName(pigId)}`;
}

/**
 * Why a costume will not go on this pig: its skin is not drawn for it yet,
 * and which pigs can wear it ("Switch to Rosie" while she is the only one).
 */
export function costumeNotFittedLine(
	costumeId: string,
	pigId: PigId | string | null | undefined,
): string {
	const pigs = costumePigs(costumeId).filter((pig) => pig !== (pigId ?? DEFAULT_COSTUME_PIG));
	if (pigs.length === 0) return COSTUME_NOT_READY_LINE;
	const lead = `${costumeName(costumeId) ?? "This costume"} isn't sewn for ${pigName(pigId)} yet.`;
	if (pigs.length === 1) return `${lead} Switch to ${pigName(pigs[0])} to wear it.`;
	return `${lead} ${joinWords(pigNames(pigs))} can wear it.`;
}

/**
 * Why an equip tap must not reach the server, or null to go ahead: a costume
 * this binary has no skin for, or one put on a pig whose skin is not in this
 * binary. The server checks ownership only, so this is the pig rule.
 */
export function costumeEquipRefusal(
	category: string | null | undefined,
	itemId: string | null,
	pigId: string | null | undefined,
): string | null {
	if (category !== "costume" || !itemId) return null;
	if (!isCostumeAvailable(itemId)) return COSTUME_NOT_READY_LINE;
	return costumeFitsPig(itemId, pigId) ? null : costumeNotFittedLine(itemId, pigId);
}

/**
 * The equip handlers' one gate (Shop Closet, the stall page): a costume tap
 * that must not reach the server raises a short info toast and returns true.
 */
export function stopCostumeEquip(
	category: string | null | undefined,
	itemId: string | null,
	pigId: string | null | undefined,
	toast: (t: { tone: "info"; title: string }) => void,
): boolean {
	const refusal = costumeEquipRefusal(category, itemId, pigId);
	if (refusal) toast({ tone: "info", title: refusal });
	return refusal !== null;
}

/** True when only Rosie wears the set (the copy then speaks about her). */
export function costumesRosieOnly(costumeIds: readonly string[]): boolean {
	const { all, some } = costumeCoverage(costumeIds);
	return all.length === 1 && all[0] === "rosie" && some.length === 0;
}

/**
 * One sentence on which pigs a set of costumes fits, read from the skins this
 * binary carries: every pig, a named few, or Rosie alone.
 */
export function costumeCoverageLine(costumeIds: readonly string[]): string {
	const { all, some } = costumeCoverage(costumeIds);
	if (all.length === PIG_IDS.length) return "Every pig in the herd can wear one.";
	if (all.length === 0) return "Each costume says which pigs it fits.";
	if (costumesRosieOnly(costumeIds)) return "Rosie only for now: a companion pig swaps to her first.";
	const lead = `Fitted to ${joinWords(pigNames(all))} for now.`;
	return some.length > 0 ? `${lead} Some fit ${joinWords(pigNames(some))} too.` : lead;
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
