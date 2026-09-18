import { resolveSlot } from "../components/ui/PigStage";
import { PIG_CANVAS } from "../constants/hats";
import type { RelSpec } from "../constants/hat_overlay_types";

// A per-pose override is the studio's answer to a silhouette that changes when
// the pig turns (a side sprite) and to one-eyed items on the turn. The base
// spec stays the front truth; only the named animation family moves.
const SLOT = { id: "cowboy", category: "hat", emoji: null };
const BASE: RelSpec = {
	pivot: { x: 0.5, y: 0.86 },
	widthFrac: 0.42,
	anchor: "head",
	behind: false,
};
const PLAIN: Record<string, RelSpec> = { cowboy: BASE };

describe("per-pose RelSpec overrides", () => {
	it("moves the item on the pose it overrides and leaves the others alone", () => {
		const overridden: Record<string, RelSpec> = {
			cowboy: {
				...BASE,
				perAnim: {
					face: {
						pivot: { x: 0.2, y: 0.4 },
						widthFrac: 0.6,
						anchor: "head",
						behind: false,
					},
				},
			},
		};

		const faceBase = resolveSlot(SLOT, "face", 0, PLAIN)?.overlay;
		const faceOver = resolveSlot(SLOT, "face", 0, overridden)?.overlay;
		expect(faceBase?.width).toBeCloseTo(0.42 * PIG_CANVAS, 5);
		// A head item on the turned families keeps scale 1, so widthFrac is the
		// whole story: the override's width is what ships.
		expect(faceOver?.width).toBeCloseTo(0.6 * PIG_CANVAS, 5);
		expect(faceOver?.left).not.toBeCloseTo(faceBase?.left ?? 0, 3);

		// …and every other pose still resolves from the base spec.
		expect(resolveSlot(SLOT, "idle", 0, overridden)?.overlay).toEqual(
			resolveSlot(SLOT, "idle", 0, PLAIN)?.overlay,
		);
		expect(resolveSlot(SLOT, "wave", 2, overridden)?.overlay).toEqual(
			resolveSlot(SLOT, "wave", 2, PLAIN)?.overlay,
		);
	});

	it("resolves the render-only sit variant through happy's override", () => {
		const overridden: Record<string, RelSpec> = {
			cowboy: { ...BASE, perAnim: { happy: { widthFrac: 0.7 } } },
		};

		const sit = resolveSlot(SLOT, "sit", 0, overridden)?.overlay;
		const happy = resolveSlot(SLOT, "happy", 0, overridden)?.overlay;
		const sitBase = resolveSlot(SLOT, "sit", 0, PLAIN)?.overlay;
		expect(sit).toEqual(happy);
		expect(sit?.width).toBeCloseTo(
			((sitBase?.width ?? 0) * 0.7) / 0.42,
			5,
		);
	});

	it("merges a partial override over the base spec", () => {
		const overridden: Record<string, RelSpec> = {
			cowboy: { ...BASE, perAnim: { face: { anchor: "snout" } } },
		};

		const overlay = resolveSlot(SLOT, "face", 0, overridden)?.overlay;
		expect(overlay?.anchor).toBe("snout");
		// pivot / widthFrac / behind came from the base, untouched.
		expect(overlay?.width).toBeCloseTo(0.42 * PIG_CANVAS, 5);
		expect(overlay?.behind).toBe(false);
		expect(overlay?.left).not.toBeCloseTo(
			resolveSlot(SLOT, "face", 0, PLAIN)?.overlay?.left ?? 0,
			3,
		);
	});
});
