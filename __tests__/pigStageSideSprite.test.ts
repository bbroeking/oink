// A turned pig wears an item's SIDE sprite when one exists; otherwise the
// front sprite, as before. A forced ritual image always wins. (2026-09-15)

jest.mock("../constants/hat_side.generated", () => ({
	// `cowboy` has side art in this test; `wizard` does not.
	HAT_SIDE_IMAGES: { cowboy: 4242 },
}));

import { resolveSlot } from "../components/ui/PigStage";
import { HAT_IMAGES, HAT_REL, PIG_CANVAS, resolveWearablePose } from "../constants/hats";

const cowboy = { id: "cowboy", category: "hat", emoji: null };
const wizard = { id: "wizard", category: "hat", emoji: null };

describe("side sprites on a turned pig", () => {
	test("the face families take the side sprite", () => {
		expect(resolveSlot(cowboy, "face", 0)?.imageSrc).toBe(4242);
		expect(resolveSlot(cowboy, "face_sit", 0)?.imageSrc).toBe(4242);
	});
	test("front families keep the front sprite", () => {
		expect(resolveSlot(cowboy, "idle", 0)?.imageSrc).toBe(HAT_IMAGES.cowboy);
		expect(resolveSlot(cowboy, "sit", 0)?.imageSrc).toBe(HAT_IMAGES.cowboy);
		expect(resolveSlot(cowboy, "happy", 0)?.imageSrc).toBe(HAT_IMAGES.cowboy);
	});
	test("an item without side art falls back to its front sprite when turned", () => {
		expect(resolveSlot(wizard, "face", 0)?.imageSrc).toBe(HAT_IMAGES.wizard);
	});
	test("a forced ritual image wins over the side sprite", () => {
		expect(resolveSlot({ ...cowboy, imageSrc: 7 }, "face", 0)?.imageSrc).toBe(7);
	});
	test("the side sprite keeps the item's placement (same RelSpec, face anchors)", () => {
		const front = resolveSlot(cowboy, "idle", 0);
		const side = resolveSlot(cowboy, "face", 0);
		expect(side?.overlay).toBeTruthy();
		// Same RelSpec on both: widthFrac x canvas, times the pose family's
		// measured head scale (2026-10-14 attachment audit: constant within a
		// family, measured per family, so the turn is not the front's width).
		const widthFrac = HAT_REL.cowboy.widthFrac;
		const idleScale = resolveWearablePose("idle", 0, "head").scale;
		const faceScale = resolveWearablePose("face", 0, "head").scale;
		expect(front?.overlay?.width).toBeCloseTo(widthFrac * PIG_CANVAS * idleScale, 6);
		expect(side?.overlay?.width).toBeCloseTo(widthFrac * PIG_CANVAS * faceScale, 6);
	});
});
