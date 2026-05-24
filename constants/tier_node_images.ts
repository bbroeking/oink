// Custom art-per-tier registry for the vertical-list season pass.
//
// Each season has up to ~30 tiers; the design wants a bespoke
// illustration in the node circle for each one (e.g. a hand-drawn
// daisy crown for tier 8, a wand for tier 10). Art is batch-
// authored via the ChatGPT pipeline and dropped into
// assets/images/tier-nodes/<season_key>/tier-N.png.
//
// Until each tier has art, the node falls back to the existing
// StoneThumb logic (cosmetic art via HAT_IMAGES, generic Icon
// glyph otherwise). The fallback path means the screen never
// renders a missing-image placeholder — art lands one tier at a
// time without blocking the redesign.
//
// Metro requires require() literals — no dynamic string interp —
// so each tier entry must be enumerated. Empty registry today;
// each authored sprite gets added explicitly here.

type TierKey = `${string}/tier-${number}`;

export const TIER_NODE_IMAGES: Partial<Record<TierKey, number>> = {
	// Example shape, uncomment + add as art lands:
	// "snout_season_1/tier-1":  require("../assets/images/tier-nodes/snout_season_1/tier-1.png"),
	// "snout_season_1/tier-8":  require("../assets/images/tier-nodes/snout_season_1/tier-8.png"),
};

export function tierNodeImage(
	seasonKey: string,
	tier: number
): number | undefined {
	return TIER_NODE_IMAGES[`${seasonKey}/tier-${tier}` as TierKey];
}
