// Full costumes on the live pig (Halloween 2026): the one rule every surface
// that draws a dressed pig goes through.
//
// A costume is a `category = 'costume'` hats row worn in its own profiles
// column (`active_costume_id`). While it is worn it HIDES every other worn
// item (hat, bow, glasses, mask, neck, aura, held): the saved outfit stays in
// its columns and comes back when the costume comes off. The scene behind the
// pig and the tickle particles are not worn items and stay.
//
// FIT (2026-10-29): the art is a hood and a romper painted over Rosie's front
// idle (features/cards/data/costumeFits.ts). The hood rides Rosie's measured
// head attachment per source frame (constants/pigAttachmentFrames.generated
// .ts), relative to idle_1, the frame it was painted on; the romper sits where
// it was painted. That holds on the FRONT families whose body stays planted
// (idle, the seated rest, happy, surprise, walk). It does not hold on the
// three-quarter turn, the sad tilt, the tired slump, the jump crouch or the
// wave (her body shrinks and leans under a romper that stays put), so the rule
// is: while costumed the pig plays front families only. The turn shows the
// front rest (still mirrored toward a friend), sad and tired show the front
// rest, and a jump or a wave plays as happy. Checked frame by frame in
// docs/design/halloween-2026/costume-contact-poses.png.
//
// PIGS (v1): the art is fitted to Rosie only. On any other pig the costume is
// not drawn and the pig wears its saved outfit; the server refuses to equip a
// costume unless Rosie is the active pig (equip_cosmetic: costume_rosie_only).

import { PIG_ATTACHMENT_FRAMES } from "@/constants/pigAttachmentFrames.generated";
import {
	ROSIE_COSTUME_FIT_BY_ID,
	type RosieCostumeFit,
} from "@/features/cards/data/costumeFits";
import type { PigAnimation, PigReaction } from "@/components/ui/pigRendererContract";
import type { PigId } from "@/utils/pigs";

export const COSTUME_CATEGORY = "costume";

/** The only pig the v1 costume art is fitted to. */
export const COSTUME_PIG_ID: PigId = "rosie";

/** Size of the source-frame box the costume art was painted against. */
const SOURCE_SIZE = 300;
/** Where that box sat on the 360px fitting stage the hood/romper boxes use. */
const FIT_PIG_LEFT = 30;
const FIT_PIG_TOP = 60;
const ROSIE_FRAMES = PIG_ATTACHMENT_FRAMES.rosie;
const REFERENCE_CROWN = ROSIE_FRAMES.idle_1;

export function isCostumeCategory(category: string | null | undefined): boolean {
	return category === COSTUME_CATEGORY;
}

/** True for a costume id this binary carries fitted art for. */
export function isKnownCostumeId(id: string | null | undefined): boolean {
	return !!id && ROSIE_COSTUME_FIT_BY_ID.has(id);
}

/**
 * The fitted costume to draw, or null to draw the pig's ordinary outfit:
 * nothing worn, an id this binary has no art for, or a pig the art does not
 * fit (v1: anything but Rosie).
 */
export function costumeFitFor(
	pigId: PigId | string | null | undefined,
	costumeId: string | null | undefined,
): RosieCostumeFit | null {
	if (!costumeId || (pigId ?? COSTUME_PIG_ID) !== COSTUME_PIG_ID) return null;
	return ROSIE_COSTUME_FIT_BY_ID.get(costumeId) ?? null;
}

/** Can this pig wear a costume at all (v1: Rosie only)? */
export function pigCanWearCostume(pigId: PigId | string | null | undefined): boolean {
	return (pigId ?? COSTUME_PIG_ID) === COSTUME_PIG_ID;
}

// Every family a costume fits as painted maps to itself; the rest fall back to
// the front pose that keeps the moment's meaning closest.
const COSTUME_ANIMATION: Partial<Record<PigAnimation, PigAnimation>> = {
	idle: "idle",
	sit: "sit",
	happy: "happy",
	surprise: "surprise",
	walk: "walk",
	wave: "happy",
	face: "idle",
	face_sit: "sit",
	sad: "idle",
	tired: "idle",
	jump: "happy",
	bounce: "happy",
};

/** The animation a costumed pig plays in place of `animation`. */
export function costumeAnimation(animation: PigAnimation): PigAnimation {
	return COSTUME_ANIMATION[animation] ?? "idle";
}

/** A reaction replayed through the same front-only rule (jump plays as happy). */
export function costumeReaction(reaction: PigReaction | null): PigReaction | null {
	if (!reaction) return null;
	const kind = costumeAnimation(reaction.kind);
	return kind === reaction.kind ? reaction : { ...reaction, kind: kind as PigReaction["kind"] };
}

export interface CostumeLayerBox {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface CostumeHoodPlacement extends CostumeLayerBox {
	/** Degrees, about the head attachment point (layer centre-relative below). */
	rotate: number;
	scale: number;
	/** The head attachment point, relative to the layer box's own centre. */
	pivotX: number;
	pivotY: number;
}

export interface CostumeLayout {
	hood: CostumeHoodPlacement;
	romper: CostumeLayerBox;
}

/**
 * Where the costume's two layers sit on a `canvas`-sized pig stage (the pig
 * drawn `contain` into a canvas x canvas box at 0,0) for one source frame.
 * Frames without a measurement (a family the rule above never plays) use the
 * reference frame, so a costume is never placed off a missing table entry.
 */
export function costumeLayout(
	fit: RosieCostumeFit,
	frameName: string | undefined,
	canvas: number = SOURCE_SIZE,
): CostumeLayout {
	const k = canvas / SOURCE_SIZE;
	const crown =
		(frameName ? ROSIE_FRAMES[frameName as keyof typeof ROSIE_FRAMES] : undefined) ??
		REFERENCE_CROWN;
	const hoodLeft = fit.hood.left - FIT_PIG_LEFT + crown.x - REFERENCE_CROWN.x;
	const hoodTop = fit.hood.top - FIT_PIG_TOP + crown.y - REFERENCE_CROWN.y;
	// The pivot is the reference crown, in the hood box's own coordinates.
	const pivotX = FIT_PIG_LEFT + REFERENCE_CROWN.x - fit.hood.left;
	const pivotY = FIT_PIG_TOP + REFERENCE_CROWN.y - fit.hood.top;
	return {
		hood: {
			left: hoodLeft * k,
			top: hoodTop * k,
			width: fit.hood.width * k,
			height: fit.hood.height * k,
			rotate: crown.rotation - REFERENCE_CROWN.rotation,
			scale: crown.scale / REFERENCE_CROWN.scale,
			pivotX: (pivotX - fit.hood.width / 2) * k,
			pivotY: (pivotY - fit.hood.height / 2) * k,
		},
		romper: {
			left: (fit.romper.left - FIT_PIG_LEFT) * k,
			top: (fit.romper.top - FIT_PIG_TOP) * k,
			width: fit.romper.width * k,
			height: fit.romper.height * k,
		},
	};
}

/**
 * RN transform for the hood: rotate and scale about the head attachment point.
 * Built from translations around the default (centre) origin so it behaves the
 * same on native, web and in tests without `transformOrigin`.
 */
export function costumeHoodTransform(hood: CostumeHoodPlacement) {
	return [
		{ translateX: hood.pivotX },
		{ translateY: hood.pivotY },
		{ rotate: `${hood.rotate}deg` },
		{ scale: hood.scale },
		{ translateX: -hood.pivotX },
		{ translateY: -hood.pivotY },
	];
}
