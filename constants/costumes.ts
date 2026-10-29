// Halloween 2026 full costumes: names and tile art.
//
// A costume is drawn as a whole skin of the pig wearing it, one per (costume,
// pig) pair (the skin swap, utils/costumeFit.ts), generated into
// costumeFrames.generated.ts. Its catalog tile in the Pop-up Stall and every
// grid is a skin's front rest frame (idle_1): Rosie's, else the first pig the
// costume fits, spread into HAT_IMAGES so every grid that resolves art by id
// finds it (the Closet shows the viewer's own pig's skin when it has one). A
// costume with no complete skin for any pig has no tile, which is also what
// keeps it off the Closet and the stall in this binary.
import { COSTUME_FRAMES } from "./costumeFrames.generated";

/** Player-facing names (docs/design/halloween-2026/content.json). */
export const COSTUME_NAMES: Readonly<Record<string, string>> = {
	halloween_2026_hollow_jack_costume: "Hollow Jack",
	halloween_2026_count_snout_costume: "Count Snout",
	halloween_2026_moonpuff_costume: "Moonpuff",
	halloween_2026_little_reaper_costume: "Little Reaper",
	halloween_2026_patchwork_pal_costume: "Patchwork Pal",
	halloween_2026_candy_corn_costume: "Candy Corn",
	halloween_2026_linen_lurker_costume: "Linen Lurker",
	halloween_2026_starspell_costume: "Starspell",
	halloween_2026_bat_nap_costume: "Bat Nap",
	halloween_2026_little_imp_costume: "Little Imp",
	halloween_2026_marshmallow_boo_costume: "Marshmallow Boo",
};

/** The pig whose skin is a costume's catalog tile, when it has one. */
const TILE_PIG = "rosie";

export const COSTUME_THUMBNAILS: Record<string, number> = Object.fromEntries(
	Object.entries(COSTUME_FRAMES).flatMap(([id, pigs]) => {
		const skin = pigs[TILE_PIG] ?? Object.values(pigs)[0];
		return skin?.idle_1 !== undefined ? [[id, skin.idle_1]] : [];
	}),
);
