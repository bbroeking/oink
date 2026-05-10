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
}

// Named pig anatomy points. Adding a new one is cheap — define it in
// PIG_FRAME_ANCHORS for each frame, then any item can attach to it.
export type AnchorName =
	| "head"
	| "eyes"
	| "snout"
	| "mouth"
	| "neck"
	| "body"
	| "hand_l"
	| "hand_r"
	| "feet";

export interface Anchor {
	x: number; // px from left of 300×300 card
	y: number; // px from top of 300×300 card
}
