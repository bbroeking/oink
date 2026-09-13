// Compile-time character catalog. The database owns roster membership; this
// module owns presentation facts shared by cards, launch reveals, and sprites.
//
// Accent hexes live in theme.ts as PIG_ACCENT (keyed by string so the token map
// doesn't have to import the roster back) — six literals the audit found here.
// `solid` is the identity hue; PIG_ACCENT[id].tint is its pale surface
// companion for anything that needs a panel behind a portrait. [D-18]
// (2026-09-11)

import { PIG_ACCENT } from "@/constants/theme";

export const PIG_IDS = ["rosie", "copper", "pepper", "bandit", "pickles", "biscuit"] as const;

export type PigId = (typeof PIG_IDS)[number];

export interface PigDefinition {
	id: PigId;
	name: string;
	coat: string;
	accent: string;
	motif: "heart" | "leaf" | "spark" | "mask" | "pickle" | "wheat";
}

export const PIGS: readonly PigDefinition[] = [
	{
		id: "rosie",
		name: "Rosie",
		coat: "Classic pink",
		accent: PIG_ACCENT.rosie.solid,
		motif: "heart",
	},
	{
		id: "copper",
		name: "Copper",
		coat: "Rusty red",
		accent: PIG_ACCENT.copper.solid,
		motif: "leaf",
	},
	{
		id: "pepper",
		name: "Pepper",
		coat: "Black with white points",
		accent: PIG_ACCENT.pepper.solid,
		motif: "spark",
	},
	{
		id: "bandit",
		name: "Bandit",
		coat: "Black with a cream blaze",
		accent: PIG_ACCENT.bandit.solid,
		motif: "mask",
	},
	{
		id: "pickles",
		name: "Pickles",
		coat: "Pink with black spots",
		accent: PIG_ACCENT.pickles.solid,
		motif: "pickle",
	},
	{
		id: "biscuit",
		name: "Biscuit",
		coat: "Sandy with black spots",
		accent: PIG_ACCENT.biscuit.solid,
		motif: "wheat",
	},
] as const;

const BY_ID = new Map<PigId, PigDefinition>(PIGS.map((pig) => [pig.id, pig]));

export function isPigId(value: unknown): value is PigId {
	return typeof value === "string" && (PIG_IDS as readonly string[]).includes(value);
}

export function pigDefinition(id: PigId | string | null | undefined): PigDefinition {
	return (isPigId(id) && BY_ID.get(id)) || PIGS[0];
}
