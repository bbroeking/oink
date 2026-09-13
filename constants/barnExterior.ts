// The painted barn's layer geometry.
//
// `assets/images/barn/exterior/barn_layers.json` is the SINGLE SOURCE OF TRUTH
// for where the door leaves sit on the body — it is written by
// `scripts/habitat/slice_barn.py`, which cuts the ChatGPT master into
// `barn_body.png` (the barn with its doorway hollowed to a dark interior) and
// the two `door_leaf_*.png` halves. This module re-exports it as a typed const
// so `BarnStructure` can lay the leaves out in fractions of the body instead of
// re-measuring the art by eye. Re-run the slicer, get new numbers, and the
// sprite follows — nothing here is hand-tuned. (2026-09-12)
import BARN_LAYERS_JSON from "../assets/images/barn/exterior/barn_layers.json";

export type BarnDoorFractions = {
	/** Left edge of the doorway, as a fraction of the body's width. */
	x: number;
	/** Top edge of the doorway, as a fraction of the body's height. */
	y: number;
	/** Doorway width, as a fraction of the body's width. */
	w: number;
	/** Doorway height, as a fraction of the body's height. */
	h: number;
	/** Where the LEFT leaf ends, as a fraction of the doorway's width. */
	seam: number;
};

export type BarnExteriorLayers = {
	/** Provenance line from the slicer — which master these numbers came off. */
	source: string;
	/** The body PNG's pixel size; the aspect the sprite box is derived from. */
	bodyPx: readonly [number, number];
	door: BarnDoorFractions;
};

export const BARN_EXTERIOR_LAYERS: BarnExteriorLayers = {
	source: BARN_LAYERS_JSON.source,
	bodyPx: [BARN_LAYERS_JSON.bodyPx[0], BARN_LAYERS_JSON.bodyPx[1]],
	door: BARN_LAYERS_JSON.door,
};
