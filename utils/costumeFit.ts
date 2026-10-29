// Full costumes on the live pig (Halloween 2026): the one rule every surface
// that draws a dressed pig goes through.
//
// A costume is a `category = 'costume'` hats row worn in its own profiles
// column (`active_costume_id`). While it is worn it HIDES every other worn
// item (hat, bow, glasses, mask, neck, held and aura): the saved outfit stays
// in its columns and comes back when the costume comes off. The scene behind
// the pig and the tickle particles are not worn items and stay.
//
// SKIN SWAP (founder direction, 2026-10-29): a costume is not layered over the
// pig. Each one is a complete sprite set of Rosie wearing it, drawn on her own
// 370x383 canvas with the same scale, camera and baseline, generated into
// constants/costumeFrames.generated.ts (scripts/gen_costume_frames.mjs). The
// renderer draws the skin's frame IN PLACE OF Rosie's for the same pose, so
// nothing can shift against the body. A skin carries six families (idle,
// happy, surprise front; face, face_sit turned; walk side), four frames each;
// every other family Rosie plays resolves inside the skin (costumeSkinSource),
// and never back to un-costumed Rosie mid-animation.
//
// AVAILABILITY: a costume with no complete skin in this binary is not
// available: not shown in the Closet or on the stall, not equippable, and a
// player who somehow wears one sees plain Rosie in her outfit.
//
// PIGS (v1): the skins are Rosie. On any other pig the costume is not drawn
// and the pig wears its saved outfit; the server refuses to equip a costume
// unless Rosie is the effective pig (equip_cosmetic: costume_rosie_only).

import { COSTUME_FRAMES } from "@/constants/costumeFrames.generated";
import { COSTUME_NAMES } from "@/constants/costumes";
import type { PigId } from "@/utils/pigs";

export const COSTUME_CATEGORY = "costume";

/** The only pig the v1 costume skins are drawn for. */
export const COSTUME_PIG_ID: PigId = "rosie";

export type CostumeSkin = Readonly<Record<string, number>>;

export function isCostumeCategory(category: string | null | undefined): boolean {
	return category === COSTUME_CATEGORY;
}

/** True for a costume this binary carries a complete skin for. */
export function isCostumeAvailable(
	id: string | null | undefined,
	frames: Readonly<Record<string, CostumeSkin>> = COSTUME_FRAMES,
): boolean {
	return !!id && Object.prototype.hasOwnProperty.call(frames, id);
}

/** @deprecated name kept for callers: a "known" costume is an available one. */
export const isKnownCostumeId = (id: string | null | undefined) => isCostumeAvailable(id);

/** Can this pig wear a costume at all (v1: Rosie only)? */
export function pigCanWearCostume(pigId: PigId | string | null | undefined): boolean {
	return (pigId ?? COSTUME_PIG_ID) === COSTUME_PIG_ID;
}

/**
 * The skin to draw, or null to draw the pig's ordinary outfit: nothing worn,
 * a costume this binary has no complete skin for, or a pig the skins are not
 * drawn for (v1: anything but Rosie).
 */
export function costumeSkinFor(
	pigId: PigId | string | null | undefined,
	costumeId: string | null | undefined,
	frames: Readonly<Record<string, CostumeSkin>> = COSTUME_FRAMES,
): CostumeSkin | null {
	if (!pigCanWearCostume(pigId) || !isCostumeAvailable(costumeId, frames)) return null;
	return frames[costumeId!];
}

/** The player-facing name of a costume, or null for an id this binary lacks. */
export function costumeName(id: string | null | undefined): string | null {
	return (id && COSTUME_NAMES[id]) || null;
}

// A family the skins do not draw borrows the nearest one they do: the low
// moods rest in idle, the bouncy reactions in happy, and the lounge's
// top-down poses in the seated turn.
const FAMILY_FALLBACK: Record<string, string> = {
	sad: "idle",
	tired: "idle",
	jump: "happy",
	wave: "happy",
	bounce: "happy",
	sit: "happy",
};
const LOUNGE_FRAME = /^(idle_s|sit_[nesw]|walk_[nesw])(_\d+)?$/;

function splitFrame(name: string): { family: string; n: number } | null {
	const m = /^(.*)_(\d+)$/.exec(name);
	return m ? { family: m[1], n: Number(m[2]) } : null;
}

function familySize(skin: CostumeSkin, family: string): number {
	let n = 0;
	while (skin[`${family}_${n + 1}`] !== undefined) n += 1;
	return n;
}

/**
 * The skin frame drawn for one of Rosie's frame names. Its own frame when the
 * skin has it; otherwise the same family cycled over the skin's frames (Rosie's
 * 12-frame idle plays the skin's 4 three times); otherwise the fallback
 * family at the same step; lounge poses take the seated turn's first frame.
 * Always a skin frame, never Rosie's.
 */
export function costumeSkinFrameName(skin: CostumeSkin, frameName: string): string {
	if (skin[frameName] !== undefined) return frameName;
	if (LOUNGE_FRAME.test(frameName)) return skin.face_sit_1 !== undefined ? "face_sit_1" : "idle_1";
	const parts = splitFrame(frameName);
	if (parts) {
		for (const family of [parts.family, FAMILY_FALLBACK[parts.family], "idle"]) {
			if (!family) continue;
			const size = familySize(skin, family);
			if (size > 0) return `${family}_${((parts.n - 1) % size) + 1}`;
		}
	}
	return "idle_1";
}

export function costumeSkinSource(skin: CostumeSkin, frameName: string): number {
	return skin[costumeSkinFrameName(skin, frameName)] ?? skin.idle_1;
}
