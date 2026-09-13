import { resolveSlot } from "../components/ui/PigStage";
import { PIG_ANIMATION_SPECS } from "../components/ui/pigRendererContract";
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

	it.each([
		["cowboy", "pink_bow"],
		["party", "ribbon_bow"],
		["tophat", "hair_bow"],
	] as const)("keeps representative %s + %s artwork from colliding across animations", (hatId, bowId) => {
		for (const animation of ["idle", "happy", "jump", "wave"] as const) {
			for (let frame = 0; frame < PIG_ANIMATION_SPECS[animation].frames.length; frame += 1) {
				const hat = resolveSlot(
					{ id: hatId, category: "hat", emoji: null },
					animation,
					frame,
				)?.overlay;
				const bow = resolveSlot(
					{ id: bowId, category: "bow", emoji: null },
					animation,
					frame,
				)?.overlay;
				if (!hat || !bow) {
					throw new Error("representative wearable overlay is unavailable");
				}

				const hatBottomEdge = PIG_CANVAS - hat.bottom;
				const bowTopEdge = PIG_CANVAS - bow.bottom - bow.height;
				expect(hat.anchor).toBe("head");
				expect(bow.anchor).toBe("neck");
				expect(hatBottomEdge).toBeLessThan(bowTopEdge);
			}
		}
	});
});
