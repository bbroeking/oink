// The shop item sheet's product shot is fitted, never cut (polish pass,
// 2026-10-04): a tall hat ran past the frame's top edge and a 300pt stage was
// wider than a 375pt phone's frame. `fitStage` is the whole of the geometry.

import { fitStage } from "@/utils/previewFit";

const CANVAS = 300;

/** Where a canvas point lands inside the fitted box (a centre-origin scale). */
function project(fit: ReturnType<typeof fitStage>, x: number, y: number) {
	const half = CANVAS / 2;
	return {
		x: fit.canvasLeft + half + (x - half) * fit.scale,
		y: fit.canvasTop + half + (y - half) * fit.scale,
	};
}

describe("fitStage", () => {
	it("keeps the pig at full size when nothing overhangs and the frame is roomy", () => {
		const fit = fitStage([], CANVAS, 360, 420, 8);
		expect(fit.scale).toBe(1);
		expect(fit.width).toBe(CANVAS);
		expect(fit.height).toBe(CANVAS);
		expect(fit.canvasLeft).toBe(0);
		expect(fit.canvasTop).toBe(0);
	});

	it("never scales a short item up", () => {
		expect(fitStage([], CANVAS, 900, 900, 8).scale).toBe(1);
	});

	it("brings a tall hat's tip inside the frame and keeps the pig on the floor", () => {
		// A hat whose box rises 62pt above the canvas (the Wizard Hat, 063).
		const hat = { left: 80, bottom: 150, width: 140, height: 212 };
		const frameW = 306;
		const frameH = 362;
		const fit = fitStage([hat], CANVAS, frameW, frameH, 8);
		expect(fit.scale).toBeLessThan(1);
		// The tip lands at the box's top edge, and the box clears the margin.
		expect(project(fit, 0, CANVAS - hat.bottom - hat.height).y).toBeCloseTo(0, 6);
		expect(fit.height).toBeLessThanOrEqual(frameH - 8 + 1e-9);
		// The canvas floor lands on the box's floor.
		expect(project(fit, 0, CANVAS).y).toBeCloseTo(fit.height, 6);
	});

	it("fits the stage into a frame narrower than it (a 375pt phone)", () => {
		const fit = fitStage([], CANVAS, 283, 333, 8);
		expect(fit.width).toBeLessThanOrEqual(283 - 16 + 1e-9);
		// Centred: the canvas's middle is the box's middle.
		expect(project(fit, CANVAS / 2, 0).x).toBeCloseTo(fit.width / 2, 6);
	});

	it("keeps the pig centred when only one side overhangs", () => {
		const held = { left: 240, bottom: 40, width: 100, height: 80 };
		const fit = fitStage([held], CANVAS, 300, 400, 8);
		expect(project(fit, CANVAS / 2, 0).x).toBeCloseTo(fit.width / 2, 6);
		// The held thing's far edge is inside the box.
		expect(project(fit, held.left + held.width, 0).x).toBeLessThanOrEqual(fit.width + 1e-9);
	});
});
