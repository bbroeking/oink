/* eslint-disable @typescript-eslint/no-require-imports */
// Halloween 2026 full costumes: the tile art the Closet, the Pop-up Stall and
// every catalog grid show for a `category = 'costume'` hats row. A costume has
// no single overlay picture (it is a hood and a romper fitted to Rosie, see
// features/cards/data/costumeFits.ts and utils/costumeFit.ts), so its tile is
// Rosie wearing it, front idle, composited from those same two layers.
// Spread into HAT_IMAGES so every grid that already resolves art by id finds
// it; PigStage never resolves a costume through HAT_IMAGES (the costume slot
// draws the fitted layers instead).
export const COSTUME_THUMBNAILS: Record<string, number> = {
	halloween_2026_hollow_jack_costume: require("../assets/images/costumes/hollow-jack/rosie-thumb-v1.png"),
	halloween_2026_count_snout_costume: require("../assets/images/costumes/count-snout/rosie-thumb-v1.png"),
	halloween_2026_moonpuff_costume: require("../assets/images/costumes/moonpuff/rosie-thumb-v1.png"),
	halloween_2026_little_reaper_costume: require("../assets/images/costumes/little-reaper/rosie-thumb-v1.png"),
	halloween_2026_patchwork_pal_costume: require("../assets/images/costumes/patchwork-pal/rosie-thumb-v1.png"),
	halloween_2026_candy_corn_costume: require("../assets/images/costumes/candy-corn/rosie-thumb-v1.png"),
	halloween_2026_linen_lurker_costume: require("../assets/images/costumes/linen-lurker/rosie-thumb-v1.png"),
	halloween_2026_starspell_costume: require("../assets/images/costumes/starspell/rosie-thumb-v1.png"),
	halloween_2026_bat_nap_costume: require("../assets/images/costumes/bat-nap/rosie-thumb-v1.png"),
	halloween_2026_little_imp_costume: require("../assets/images/costumes/little-imp/rosie-thumb-v1.png"),
	halloween_2026_marshmallow_boo_costume: require("../assets/images/costumes/marshmallow-boo/rosie-thumb-v1.png"),
};
