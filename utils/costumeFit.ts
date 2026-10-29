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
// pig. Each (costume, pig) pair is a complete sprite set of that pig wearing
// it, drawn on the pig's own 370x383 canvas with the same scale, camera and
// baseline, generated into constants/costumeFrames.generated.ts
// (scripts/gen_costume_frames.mjs) as costume id -> pig id -> frames. The
// renderer draws the skin's frame IN PLACE OF the pig's for the same pose, so
// nothing can shift against the body. A skin carries six families (idle,
// happy, surprise front; face, face_sit turned; walk side), four frames each;
// every other family the pig plays resolves inside the skin
// (costumeSkinSource), and never back to the bare pig mid-animation.
//
// PIGS (founder, 2026-10-29: "make it so the costumes fit all of the pigs"):
// the skin drawn is the DRAWN pig's own, the effective pig pig_roster()
// resolves (a lapsed member's stored companion is Rosie). A pair with no
// complete skin in this binary is not wearable on that pig: the pig is drawn
// in its ordinary outfit, never in another pig's skin, the Closet tile says
// so, and an equip tap is stopped with a toast (utils/costumeCopy.ts). The
// server checks ownership only (20261029280000_costumes_all_pigs.sql).
//
// AVAILABILITY: a costume with no complete skin for ANY pig in this binary is
// not available: not shown in the Closet or on the stall, not equippable.

import { COSTUME_FRAMES } from "@/constants/costumeFrames.generated";
import { COSTUME_NAMES } from "@/constants/costumes";
import { PIG_IDS, type PigId } from "@/utils/pigs";

export const COSTUME_CATEGORY = "costume";

/** The pig drawn when a caller names none (every surface's default pig). */
export const DEFAULT_COSTUME_PIG: PigId = "rosie";

export type CostumeSkin = Readonly<Record<string, number>>;
/** The generated manifest's shape: costume id -> pig id -> skin. */
export type CostumeSkins = Readonly<Record<string, Readonly<Record<string, CostumeSkin>>>>;

const own = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

export function isCostumeCategory(category: string | null | undefined): boolean {
	return category === COSTUME_CATEGORY;
}

/**
 * The skin to draw for this pig, or null to draw the pig's ordinary outfit:
 * nothing worn, a costume this binary does not carry, or a (costume, pig)
 * pair with no complete skin. Never another pig's skin.
 */
export function costumeSkinFor(
	pigId: PigId | string | null | undefined,
	costumeId: string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): CostumeSkin | null {
	if (!costumeId || !own(frames, costumeId)) return null;
	const pigs = frames[costumeId];
	const pig = pigId ?? DEFAULT_COSTUME_PIG;
	return own(pigs, pig) ? pigs[pig] : null;
}

/** True when this binary carries the (costume, pig) pair's skin. */
export function costumeFitsPig(
	costumeId: string | null | undefined,
	pigId: PigId | string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): boolean {
	return costumeSkinFor(pigId, costumeId, frames) !== null;
}

/** The pigs a costume is drawn for in this binary, in roster order. */
export function costumePigs(
	costumeId: string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): PigId[] {
	return PIG_IDS.filter((pig) => costumeFitsPig(costumeId, pig, frames));
}

/** True for a costume this binary carries a complete skin for, on any pig. */
export function isCostumeAvailable(
	id: string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): boolean {
	return costumePigs(id, frames).length > 0;
}

/** @deprecated name kept for callers: a "known" costume is an available one. */
export const isKnownCostumeId = (id: string | null | undefined) => isCostumeAvailable(id);

/**
 * The pig a costume preview is drawn on: the viewer's own pig when the pair
 * exists, else the first pig the costume fits (Rosie, for the Halloween set).
 * Null for a costume with no skin at all.
 */
export function costumePreviewPig(
	costumeId: string | null | undefined,
	viewerPigId: PigId | string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): PigId | null {
	const pigs = costumePigs(costumeId, frames);
	const viewer = viewerPigId ?? DEFAULT_COSTUME_PIG;
	return pigs.find((pig) => pig === viewer) ?? pigs[0] ?? null;
}

/** A pig's costume tile and icon art: its skin's front rest frame, or null. */
export function costumeThumbnailFor(
	pigId: PigId | string | null | undefined,
	costumeId: string | null | undefined,
	frames: CostumeSkins = COSTUME_FRAMES,
): number | null {
	return costumeSkinFor(pigId, costumeId, frames)?.idle_1 ?? null;
}

/**
 * Which pigs a set of costumes covers: `all` fit every one of them, `some`
 * fit at least one but not all (roster order). What the copy reads from.
 */
export function costumeCoverage(
	costumeIds: readonly string[],
	frames: CostumeSkins = COSTUME_FRAMES,
): { all: PigId[]; some: PigId[] } {
	const ids = costumeIds.filter((id) => isCostumeAvailable(id, frames));
	const all: PigId[] = [];
	const some: PigId[] = [];
	if (ids.length === 0) return { all, some };
	for (const pig of PIG_IDS) {
		const fits = ids.filter((id) => costumeFitsPig(id, pig, frames)).length;
		if (fits === ids.length) all.push(pig);
		else if (fits > 0) some.push(pig);
	}
	return { all, some };
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
