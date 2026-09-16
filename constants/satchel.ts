// The Satchel — the compiled catalog and the tuning FALLBACK.
//
// Spec: docs/satchel-spec.md. The server owns every number in SATCHEL_TUNING
// (app_settings.satchel_tuning, read through utils/satchel's config cell);
// this file is only what the binary boots on. The catalog ids MUST match the
// migration's satchel_finds rows (20260915010000_satchel.sql) — a find the
// server can roll that the client cannot name or draw is a blank square.
//
// Rarity lives in Collect (the catalog order, the silhouettes) and NEVER in
// the payout: `tickles` is one flat number. That is the "giving, not earning"
// spine (docs/barn-visiting-design.md) written into the shape.

export const SATCHEL_FIND_IDS = [
	"river_pebble",
	"blue_feather",
	"clover",
	"snail_shell",
	"brass_button",
	"wool_tuft",
	"red_berries",
	"pinecone",
	"old_key",
	"honeycomb",
	"marble",
	"tin_whistle",
] as const;

export type SatchelFindId = (typeof SATCHEL_FIND_IDS)[number];
export type FindRarity = "common" | "uncommon" | "rare";

export interface SatchelFindDef {
	id: SatchelFindId;
	/** The player-facing name, lower-case: it sits inside sentences. */
	name: string;
	/** With its article, for "hoping for a …" lines. */
	withArticle: string;
	rarity: FindRarity;
}

export const SATCHEL_FINDS: readonly SatchelFindDef[] = [
	{ id: "river_pebble", name: "river pebble", withArticle: "a river pebble", rarity: "common" },
	{ id: "blue_feather", name: "blue feather", withArticle: "a blue feather", rarity: "common" },
	{ id: "clover", name: "four-leaf clover", withArticle: "a four-leaf clover", rarity: "common" },
	{ id: "snail_shell", name: "snail shell", withArticle: "a snail shell", rarity: "common" },
	{ id: "brass_button", name: "brass button", withArticle: "a brass button", rarity: "common" },
	{ id: "wool_tuft", name: "tuft of wool", withArticle: "a tuft of wool", rarity: "common" },
	{ id: "red_berries", name: "red berries", withArticle: "some red berries", rarity: "common" },
	{ id: "pinecone", name: "pinecone", withArticle: "a pinecone", rarity: "common" },
	{ id: "old_key", name: "old key", withArticle: "an old key", rarity: "uncommon" },
	{ id: "honeycomb", name: "honeycomb chip", withArticle: "a chip of honeycomb", rarity: "uncommon" },
	{ id: "marble", name: "glass marble", withArticle: "a glass marble", rarity: "uncommon" },
	{ id: "tin_whistle", name: "tin whistle", withArticle: "a tin whistle", rarity: "rare" },
];

const FIND_SET: ReadonlySet<string> = new Set(SATCHEL_FIND_IDS);
const BY_ID: ReadonlyMap<string, SatchelFindDef> = new Map(SATCHEL_FINDS.map((f) => [f.id, f]));

export function isSatchelFindId(v: unknown): v is SatchelFindId {
	return typeof v === "string" && FIND_SET.has(v);
}

/** The catalog row, or null for an id this build cannot name. */
export function satchelFind(id: string): SatchelFindDef | null {
	return BY_ID.get(id) ?? null;
}

export interface SatchelTuning {
	/** How many finds the bag holds. */
	cap: number;
	/** Odds a submitted Dig rolls 0 / 1 / 2 finds (sum ≈ 1). */
	findOdds: { none: number; one: number; two: number };
	/** How long a wish stands before it rerolls on its own. */
	wishRerollHours: number;
	/** Tickles each pig gets on a swap — FLAT, whatever the find's rarity. */
	tickles: number;
	/** Swap counts that grant a keepsake, ascending. */
	keepsakeThresholds: number[];
	/** How many finds a host's bag can spare in one offer tray (server-chosen). */
	options: number;
	/** Swaps between one pair that still pay tickles, per UTC day. */
	paidSwapsPerPairPerDay: number;
	/** Swaps one pig can be paid for across every pair, per UTC day. */
	paidSwapsPerPigPerDay: number;
}

export const SATCHEL_TUNING: Readonly<SatchelTuning> = Object.freeze({
	cap: 6,
	findOdds: { none: 0.3, one: 0.5, two: 0.2 },
	wishRerollHours: 48,
	tickles: 3,
	keepsakeThresholds: [10, 50, 100],
	options: 3,
	paidSwapsPerPairPerDay: 3,
	paidSwapsPerPigPerDay: 10,
});
