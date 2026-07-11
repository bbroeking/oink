// The Season 1 unique relic pool — one-tile "uniques" the server may bury on a
// board (~2 in 5), rarity-weighted. First catch lights the relic's entry in the
// Burrow Book; dupes bump a found-count. See SKILL.md decision log (2026-07-11).
//
// CLIENT MIRROR. The authoritative pool + weights + spawn roll live server-side
// (supabase/migrations/20260728000000_patch_uniques.sql). The ids + weights here
// MUST match that migration's unique_pool() VALUES table exactly, or a client
// would render a relic the server can't award (or vice-versa).

export type UniqueRarity = "common" | "uncommon" | "rare" | "heirloom";

export interface UniqueDef {
	id: string;
	name: string;
	story: string;
	rarity: UniqueRarity;
}

// The 12 Season 1 relics. Stories are short, warm-fiction one-liners (player copy).
export const UNIQUE_POOL: readonly UniqueDef[] = [
	{ id: "old_boot", name: "The Old Boot", story: "His old boot. Why.", rarity: "common" },
	{ id: "licked_wrapper", name: "The Licked-Clean Wrapper", story: "Licked clean. Kept anyway.", rarity: "common" },
	{ id: "fossil_acorn", name: "The Fossilized Acorn", story: "An acorn that waited too long.", rarity: "common" },
	{ id: "brass_cowbell", name: "The Brass Cowbell", story: "Rings once a year, they say.", rarity: "uncommon" },
	{ id: "milk_tooth", name: "The Milk Tooth", story: "Some piglet's first tooth, kept safe.", rarity: "uncommon" },
	{ id: "jam_letter", name: "The Jam-Sealed Letter", story: "A love letter, sealed with jam.", rarity: "uncommon" },
	{ id: "glass_eye", name: "The Glass Eye", story: "A doll's eye. Still winking.", rarity: "uncommon" },
	{ id: "music_box_heart", name: "The Music-Box Heart", story: "Still plays three notes.", rarity: "rare" },
	{ id: "tiny_crown", name: "The Tiny Crown", story: "A crown for a very small king.", rarity: "rare" },
	{ id: "petrified_tickle", name: "The Petrified Tickle", story: "A laugh, fossilized mid-giggle.", rarity: "rare" },
	{ id: "first_truffle", name: "The First Truffle", story: "The one that started his hunger.", rarity: "heirloom" },
	{ id: "thin_portrait", name: "The Thin Portrait", story: "A locket: a thin young pig, smiling.", rarity: "heirloom" },
] as const;

// Bundled art per relic — placeholders until the ImageGen pass drops real
// sprites in at the SAME filenames (no code change then).
export const UNIQUE_IMAGES: Record<string, number> = {
	old_boot: require("../assets/images/uniques/old_boot.png"),
	licked_wrapper: require("../assets/images/uniques/licked_wrapper.png"),
	fossil_acorn: require("../assets/images/uniques/fossil_acorn.png"),
	brass_cowbell: require("../assets/images/uniques/brass_cowbell.png"),
	milk_tooth: require("../assets/images/uniques/milk_tooth.png"),
	jam_letter: require("../assets/images/uniques/jam_letter.png"),
	glass_eye: require("../assets/images/uniques/glass_eye.png"),
	music_box_heart: require("../assets/images/uniques/music_box_heart.png"),
	tiny_crown: require("../assets/images/uniques/tiny_crown.png"),
	petrified_tickle: require("../assets/images/uniques/petrified_tickle.png"),
	first_truffle: require("../assets/images/uniques/first_truffle.png"),
	thin_portrait: require("../assets/images/uniques/thin_portrait.png"),
};

// Documentation-only mirror of the server's rarity → spawn weight. The weighted
// pick itself is server-side; this exists so the client pool + the migration
// stay legibly in sync (and for the pool-integrity test). MUST match the
// migration's unique_pool() weights.
export const UNIQUE_RARITY_WEIGHT: Record<UniqueRarity, number> = {
	common: 6,
	uncommon: 3,
	rare: 1.5,
	heirloom: 0.5,
};

// Documentation mirror: the chance a board carries a unique at all (~2 in 5).
// The roll (`random() < UNIQUE_SPAWN_CHANCE`) happens server-side in open_rooting.
export const UNIQUE_SPAWN_CHANCE = 0.4;

// Lookup by id (name/story for reveal chips + the end card).
export const UNIQUE_BY_ID: Record<string, UniqueDef> = Object.fromEntries(
	UNIQUE_POOL.map((u) => [u.id, u])
);
