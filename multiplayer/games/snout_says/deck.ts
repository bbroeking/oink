// The Snout Says deck: 27 pictures every player already collects, the
// twelve Satchel finds and the fifteen Snout Deep dig things. Each carries
// two to four kinship tags.
//
// Tags are RULES DATA. They deal a kind tray (at least three tray pictures
// share a tag with the answer) and they drive the practice pig. They never
// ride in state or in a view, and nothing ever shows them to a player: a
// stranger's own associations are the game, the tags only make sure the
// tray always has something to say.
//
// Ids are the catalogs' own (constants/satchel.ts SATCHEL_FIND_IDS, the dig
// glyph names), so the board draws each picture with the art it already
// wears elsewhere. Player-facing names live with the board, not here.

export const PICTURE_TAGS = [
	"animal",
	"plant",
	"water",
	"sky",
	"food",
	"sweet",
	"metal",
	"glass",
	"wood",
	"old",
	"shiny",
	"soft",
	"round",
	"sound",
	"lucky",
	"tool",
	"warm",
	"home",
] as const;

export type PictureTag = (typeof PICTURE_TAGS)[number];

export const FIND_PICTURES = [
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

export const DIG_PICTURES = [
	"acorn",
	"apple",
	"bag",
	"boom",
	"boot",
	"bow",
	"cap",
	"charm",
	"furnishing",
	"horseshoe",
	"pouch",
	"relic",
	"scroll",
	"shimmer",
	"tea",
] as const;

export const PICTURE_IDS = [...FIND_PICTURES, ...DIG_PICTURES] as const;

export type PictureId = (typeof PICTURE_IDS)[number];

/** What each picture is about, as a pig would say it. Two to four tags. */
export const PICTURE_KIN: Readonly<Record<PictureId, readonly PictureTag[]>> = Object.freeze({
	// The finds.
	river_pebble: ["water", "round", "old"],
	blue_feather: ["animal", "sky", "soft"],
	clover: ["plant", "lucky"],
	snail_shell: ["animal", "round", "home"],
	brass_button: ["metal", "round", "shiny"],
	wool_tuft: ["animal", "soft", "warm"],
	red_berries: ["plant", "food", "sweet", "round"],
	pinecone: ["plant", "wood"],
	old_key: ["metal", "old", "home", "tool"],
	honeycomb: ["animal", "food", "sweet"],
	marble: ["glass", "round", "shiny"],
	tin_whistle: ["metal", "sound", "tool"],
	// The dig things.
	acorn: ["plant", "food", "wood", "metal"], // the clockwork acorn: its wind-up key is brass
	apple: ["plant", "food", "sweet", "round"],
	bag: ["soft", "tool", "old"], // the canvas satchel
	boom: ["sound", "round", "warm"], // the tickle boom: a lit fuse
	boot: ["old", "warm", "water"], // a puddle boot
	bow: ["soft", "sweet"],
	cap: ["metal", "round", "old"], // a bottle cap
	charm: ["lucky", "shiny", "glass"], // the heart charm
	furnishing: ["home", "warm", "metal", "old"], // the barn lantern
	horseshoe: ["metal", "lucky", "animal", "old"],
	pouch: ["soft", "lucky"], // the snout pouch, heavy with coins
	relic: ["old", "round", "lucky"], // the mossy snout stone
	scroll: ["old", "wood"], // paper comes from trees
	shimmer: ["glass", "shiny", "lucky"], // the shimmer crystal
	tea: ["water", "warm", "glass", "home"], // a glass flask of warm tea
});

const PICTURE_SET: ReadonlySet<string> = new Set(PICTURE_IDS);

export function isPictureId(value: unknown): value is PictureId {
	return typeof value === "string" && PICTURE_SET.has(value);
}

/** How many tags two pictures share. */
export function kinship(a: PictureId, b: PictureId): number {
	const theirs = PICTURE_KIN[b];
	let shared = 0;
	for (const tag of PICTURE_KIN[a]) if (theirs.includes(tag)) shared++;
	return shared;
}

/** How many of `pictures` share at least one tag with `target` (the target
 *  itself never counts). The kind-tray rule reads this. */
export function kinCount(pictures: readonly PictureId[], target: PictureId): number {
	let n = 0;
	for (const p of pictures) if (p !== target && kinship(p, target) > 0) n++;
	return n;
}
