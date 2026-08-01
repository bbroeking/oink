import { resolveSlot } from "../components/ui/PigStage";
import { HAT_REL, PIG_CANVAS, resolveAnchor } from "../constants/hats";

describe("Rosie wearable pose rig", () => {
	it("rotates and scales a head item with Rosie's animated face", () => {
		const slot = { id: "cowboy", category: "hat", emoji: null };
		const idle = resolveSlot(slot, "idle", 0);
		const wave = resolveSlot(slot, "wave", 0);

		expect(idle?.overlay).not.toBeNull();
		expect(wave?.overlay).not.toBeNull();
		expect(wave?.overlay?.rotate).not.toBe(idle?.overlay?.rotate);
		expect(wave?.overlay?.width).toBeLessThan(idle?.overlay?.width ?? 0);
	});

	it("keeps fixed-canvas backgrounds out of the wearable pose rig", () => {
		const idle = resolveSlot(
			{ id: "homestead_barn", category: "background", emoji: null },
			"idle",
			0,
		);
		const wave = resolveSlot(
			{ id: "homestead_barn", category: "background", emoji: null },
			"wave",
			0,
		);

		expect(wave?.overlay).toEqual(idle?.overlay);
	});

	it("keeps the item's authored pivot pinned to the anatomy after rotation", () => {
		const slot = resolveSlot(
			{ id: "cowboy", category: "hat", emoji: null },
			"wave",
			0,
		);
		const overlay = slot?.overlay;
		const rel = HAT_REL.cowboy;
		expect(overlay?.rotate).toBeDefined();
		expect(rel).toBeDefined();
		if (!overlay || !rel) throw new Error("cowboy overlay is unavailable");

		const angle = ((overlay.rotate ?? 0) * Math.PI) / 180;
		const pivotX = rel.pivot.x * overlay.width;
		const pivotY = rel.pivot.y * overlay.height;
		const centerX = overlay.width / 2;
		const centerY = overlay.height / 2;
		const rotatedPivotX =
			centerX +
			(pivotX - centerX) * Math.cos(angle) -
			(pivotY - centerY) * Math.sin(angle);
		const rotatedPivotY =
			centerY +
			(pivotX - centerX) * Math.sin(angle) +
			(pivotY - centerY) * Math.cos(angle);
		const top = PIG_CANVAS - overlay.bottom - overlay.height;
		const anchor = resolveAnchor("wave", 0, "head");

		expect(overlay.left + rotatedPivotX).toBeCloseTo(anchor.x, 5);
		expect(top + rotatedPivotY).toBeCloseTo(anchor.y, 5);
	});
});
