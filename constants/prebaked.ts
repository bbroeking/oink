// Pre-baked sprite overrides for hero / legendary items.
//
// 99% of items render via the compositional overlay system (a small
// PNG layered onto the pig sprite, anchored to a body part). For items
// where placement perfection matters more than the cost of new art —
// epic/legendary cosmetics, marketing centerpieces — you can bake the
// pig+item together as their own multi-frame strip.
//
// When an item ID appears in ITEM_PREBAKED, equipping it makes the
// SpritePig render the listed frames INSTEAD of the default Rosie
// frames, and SwipeElement skips the overlay step. Mix-and-match with
// other accessories is not supported on a prebaked item — the prebaked
// art wins.
//
// To add a prebaked item:
//   1. Generate a 4-frame strip of the pig wearing the item
//      (use docs/openai-prebaked-prompts.md for prompt templates).
//   2. Slice into 4 PNGs and drop into:
//        assets/images/sprites/prebaked/<item_id>/<anim>_<n>.png
//   3. Add a require(...) entry to FRAMES in components/ui/SpritePig.tsx
//      using key prebaked_<item_id>_<anim>_<n>.
//   4. Add an entry below mapping item id -> animation -> frame keys.
//
// Animations not listed in PrebakedFrames fall back to the standard
// (non-prebaked) Rosie frames, so a ring-only legendary item that only
// has bespoke `idle` art still walks/jumps with the default pig.
export interface PrebakedFrames {
	idle?: string[];
	walk?: string[];
	jump?: string[];
	happy?: string[];
	sad?: string[];
	surprise?: string[];
	wave?: string[];
}

export const ITEM_PREBAKED: Record<string, PrebakedFrames> = {
	// Uncomment + populate when prebaked art lands. Example:
	// crown: {
	//   idle: [
	//     "prebaked_crown_idle_1",
	//     "prebaked_crown_idle_2",
	//     "prebaked_crown_idle_3",
	//     "prebaked_crown_idle_4",
	//   ],
	// },
};

export function isPrebaked(itemId: string | null | undefined): boolean {
	return !!itemId && itemId in ITEM_PREBAKED;
}
