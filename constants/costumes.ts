// Halloween 2026 full costumes: names and tile art.
//
// A costume is drawn as a whole skin of Rosie wearing it (the skin swap,
// utils/costumeFit.ts), generated into costumeFrames.generated.ts. Its tile
// in the Closet, the Pop-up Stall and every catalog grid is that skin's
// front rest frame (idle_1), spread into HAT_IMAGES so every grid that
// resolves art by id finds it. A costume without a complete skin has no tile,
// which is also what keeps it off the Closet and the stall in this binary.
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

export const COSTUME_THUMBNAILS: Record<string, number> = Object.fromEntries(
	Object.entries(COSTUME_FRAMES).flatMap(([id, frames]) =>
		frames.idle_1 !== undefined ? [[id, frames.idle_1]] : [],
	),
);
