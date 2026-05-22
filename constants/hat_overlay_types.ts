// Shared overlay positioning type. Lives in its own module so both
// `hats.ts` and the auto-generated `hat_overlays.generated.ts` can
// depend on it without forming a circular import.
//
// `bottom`/`left` define the item's REST position on the 300×300 pig
// card — i.e., where the item sits when the pig is in its idle pose.
// During animation, the per-frame anchor system shifts the item by
// the delta of its anchor's position from rest, so different items
// follow different body parts (hats follow the head, glasses follow
// the eyes, held items follow the hand).
export interface HatOverlay {
	bottom: number;
	left: number;
	width: number;
	height: number;
	// Optional per-item override. When unset, the item inherits from
	// its category's default anchor (see CATEGORY_ANCHORS in hats.ts).
	anchor?: AnchorName;
	// Optional per-item z-order override. When set, takes precedence over
	// the category default in Z_BEHIND_PIG. Use this for items whose
	// category is "in-front" (like a held wand) but should specifically
	// render BEHIND the pig (so the body partially occludes it for depth).
	// undefined = fall back to category default.
	behind?: boolean;
	// Per-animation overrides: when the pig is playing a specific
	// animation, fields in perAnim[anim] override the base. Use this
	// when the per-frame anchor system can't follow the pig's body
	// well enough (e.g. SAD has the pig sitting compactly — its head
	// is in a totally different spot, so a hat needs its own position
	// for that pose rather than just a delta from idle).
	//
	// Fields are merged shallowly: any field NOT in the per-anim entry
	// inherits from the base. To unset behind specifically for one
	// animation, set `behind: false` in that animation's override.
	perAnim?: Partial<Record<PigAnimationKey, Partial<HatOverlay>>>;
}

// Anchor-RELATIVE placement spec. The future of item positioning —
// everything is a fraction, so the item scales correctly when the pig
// renders at different sizes on different screens (the absolute
// `bottom`/`left` model above breaks across screen sizes).
//
//   pivot     — the attach point ON THE ITEM, as a 0..1 fraction of
//               the item's own box. (0.5,1.0) = bottom-centre.
//   widthFrac — the item's width as a fraction of the pig's size.
//               Height is derived from the PNG's intrinsic aspect.
//   anchor    — which pig anchor the pivot snaps onto (defaults to the
//               item category's anchor).
//
// At render the item is sized + positioned so its pivot point lands
// exactly on the resolved pig anchor — see SwipeElement.
export interface RelSpec {
	pivot: { x: number; y: number };
	widthFrac: number;
	anchor?: AnchorName;
	// Render behind the pig (true) or in front (false/undefined).
	// Set per-item in the /item-anchor tool.
	behind?: boolean;
}

// Re-export so this module is the single source of truth for both
// PigAnimationKey and HatOverlay. Imported here by hats.ts to keep
// the union narrow.
export type PigAnimationKey =
	| "idle"
	| "walk"
	| "jump"
	| "happy"
	| "sad"
	| "surprise"
	| "wave";

// Named pig anatomy points. Adding a new one is cheap — define it in
// PIG_FRAME_ANCHORS for each frame, then any item can attach to it.
//
// `eyes` and `feet` are VIRTUAL anchors: they're not stored per-frame,
// they're computed at lookup time as the midpoint of the corresponding
// L/R pair. Items that target `eyes` (default glasses anchor) get the
// midpoint automatically; items needing single-side precision (monocle,
// single-leg cuffs) target `eye_r` / `leg_l` etc. directly via
// HatOverlay.anchor.
export type AnchorName =
	| "head"
	| "eye_l"
	| "eye_r"
	| "eyes"
	| "snout"
	| "mouth"
	| "neck"
	| "body"
	| "hand_l"
	| "hand_r"
	| "leg_l"
	| "leg_r"
	| "feet";

export interface Anchor {
	x: number; // px from left of 300×300 card
	y: number; // px from top of 300×300 card
}
