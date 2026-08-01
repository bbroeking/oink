// Compile-time character catalog. The database owns roster membership; this
// module owns presentation facts shared by cards, launch reveals, and sprites.

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
		accent: "#F8A8B3",
		motif: "heart",
	},
	{
		id: "copper",
		name: "Copper",
		coat: "Rusty red",
		accent: "#C66A45",
		motif: "leaf",
	},
	{
		id: "pepper",
		name: "Pepper",
		coat: "Black with white points",
		accent: "#646269",
		motif: "spark",
	},
	{
		id: "bandit",
		name: "Bandit",
		coat: "Black with a cream blaze",
		accent: "#4B4A50",
		motif: "mask",
	},
	{
		id: "pickles",
		name: "Pickles",
		coat: "Pink with black spots",
		accent: "#E88FA3",
		motif: "pickle",
	},
	{
		id: "biscuit",
		name: "Biscuit",
		coat: "Sandy with black spots",
		accent: "#D8A36E",
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
