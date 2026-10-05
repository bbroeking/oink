// The product shot's fit (the shop item sheet, polish pass 2026-10-04).
//
// The sheet drew the 300pt pig stage at 1:1, pinned to the floor of a frame
// only ~60pt taller than the stage, so a tall hat (the Wizard Hat's tip) ran
// past the frame's top edge and was cut, and on a 375pt phone the 300pt stage
// was wider than the ~283pt frame and lost the pig's sides. The 2026-07-16
// ruling makes the preview a product shot: the cosmetic must read exactly, and
// a cut-off tip is the opposite of that.
//
// The fit is the renderer's own geometry: each worn item's box comes from
// `resolveSlot` (PigStage's math, in canvas points), the stage plus every box
// that overhangs it is fitted into the frame, the pig stays centred and stands
// on the frame's floor, and nothing ever scales UP (a short item keeps the pig
// at full size).

/** An overlay box in canvas points, as `resolveSlot` returns it. */
export interface CanvasBox {
	left: number;
	/** Distance from the canvas floor to the box's bottom edge. */
	bottom: number;
	width: number;
	height: number;
}

export interface StageFit {
	/** Applied to the canvas about its centre (React Native's transform origin). */
	scale: number;
	/** The fitted box the canvas is drawn inside, in screen points. */
	width: number;
	height: number;
	/** Where the canvas View sits inside that box, before its scale. */
	canvasLeft: number;
	canvasTop: number;
}

/**
 * Fit a `canvas`-square stage and the boxes that overhang it into a frame of
 * `frameW` x `frameH`, leaving `margin` clear at the top and both sides (the
 * floor is the frame's own bottom edge). The canvas is kept centred, so the
 * box is symmetric about the canvas's middle even when only one side
 * overhangs (a held item off the right hoof).
 */
export function fitStage(
	boxes: readonly CanvasBox[],
	canvas: number,
	frameW: number,
	frameH: number,
	margin: number,
): StageFit {
	let top = 0;
	let bottom = canvas;
	let left = 0;
	let right = canvas;
	for (const box of boxes) {
		top = Math.min(top, canvas - box.bottom - box.height);
		bottom = Math.max(bottom, canvas - box.bottom);
		left = Math.min(left, box.left);
		right = Math.max(right, box.left + box.width);
	}
	const half = canvas / 2;
	const halfW = Math.max(half - left, right - half);
	const boxW = halfW * 2;
	const boxH = bottom - top;
	const availW = Math.max(0, frameW - margin * 2);
	const availH = Math.max(0, frameH - margin);
	const scale = Math.max(0, Math.min(1, availW / boxW, availH / boxH));
	return {
		scale,
		width: boxW * scale,
		height: boxH * scale,
		// A View scales about its own centre, so the canvas's origin lands at
		// `left + half * (1 - scale)`; solve for the `left` that puts it at the
		// fitted box's (halfW - half, -top), scaled.
		canvasLeft: halfW * scale - half,
		canvasTop: half * scale - half - top * scale,
	};
}
