import fs from "node:fs";
import path from "node:path";
import { resolveSlot } from "../components/ui/PigStage";
import { HAT_REL, PIG_CANVAS, resolveAnchor } from "../constants/hats";

describe("reported cosmetic placement contracts", () => {
	it("keeps the Watering Can Cap in the hat catalog and on the head rig", () => {
		const catalog = fs.readFileSync(
			path.join(
				__dirname,
				"..",
				"supabase",
				"migrations",
				"20260690000000_seed_members_catalog.sql",
			),
			"utf8",
		);
		expect(catalog).toMatch(
			/\('watering_can_hat', 'Watering Can Cap'.*'hat'/,
		);
		expect(HAT_REL.watering_can_hat).toMatchObject({
			anchor: "head",
			pivot: { x: 0.5, y: 0.86 },
			widthFrac: 0.42,
		});

		for (const animation of ["idle", "happy", "wave"] as const) {
			const rendered = resolveSlot(
				{ id: "watering_can_hat", category: "hat", emoji: null },
				animation,
				0,
			);
			expect(rendered?.overlay?.anchor).toBe("head");
		}
	});

	it("keeps the Tiny Umbrella handheld at about one-third of Rosie width", () => {
		expect(HAT_REL.tiny_umbrella).toMatchObject({
			anchor: "hand_r",
			pivot: { x: 0, y: 0.7 },
			widthFrac: 0.33,
		});

		for (const animation of ["idle", "happy", "wave"] as const) {
			const rendered = resolveSlot(
				{ id: "tiny_umbrella", category: "held", emoji: null },
				animation,
				0,
			);
			expect(rendered?.overlay?.anchor).toBe("hand_r");
			expect(rendered?.overlay?.width).toBeCloseTo(0.33 * PIG_CANVAS, 5);
			// Its box starts at the animated hand and extends outward rather than
			// back across her eyes and torso.
			expect(rendered?.overlay?.left).toBeCloseTo(
				resolveAnchor(animation, 0, "hand_r").x,
				5,
			);
		}
	});
});
