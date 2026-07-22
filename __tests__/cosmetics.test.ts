// Locks the pure equip rule (utils/cosmetics computeEquip): column routing per
// category, the Face-slot exclusivity invariant in BOTH directions (glasses
// clears mask, mask clears glasses), and that non-face categories never touch a
// sibling column. The equip write itself (equipCosmetic) is a thin supabase
// effect over this rule and isn't exercised here.

import { computeEquip } from "../utils/cosmetics";

const EMPTY: Record<string, string | null> = {};

describe("computeEquip — column routing", () => {
	it("routes a hat to active_hat_id", () => {
		const { update } = computeEquip("hat", "tophat", EMPTY);
		expect(update).toEqual({ active_hat_id: "tophat" });
	});

	it("routes bows to the head column (active_hat_id) too", () => {
		const { update } = computeEquip("bow", "red_bow", EMPTY);
		expect(update).toEqual({ active_hat_id: "red_bow" });
	});

	it("routes an aura / background / held to their own columns", () => {
		expect(computeEquip("aura", "halo", EMPTY).update).toEqual({ active_aura_id: "halo" });
		expect(computeEquip("background", "meadow", EMPTY).update).toEqual({
			active_background_id: "meadow",
		});
		expect(computeEquip("held", "wand", EMPTY).update).toEqual({ active_held_id: "wand" });
	});

	it("routes glasses + masks to their SEPARATE columns (not the shared Face slot column)", () => {
		expect(computeEquip("glasses", "shades", EMPTY).update.active_glasses_id).toBe("shades");
		expect(computeEquip("mask", "fox", EMPTY).update.active_mask_id).toBe("fox");
	});

	it("falls back to the head column for an unknown/undefined category", () => {
		expect(computeEquip(undefined, "mystery", EMPTY).update).toEqual({ active_hat_id: "mystery" });
		expect(computeEquip(null, "mystery", EMPTY).update).toEqual({ active_hat_id: "mystery" });
	});
});

describe("computeEquip — Face-slot exclusivity", () => {
	it("equipping glasses clears any equipped mask", () => {
		const { update, activeIds } = computeEquip("glasses", "shades", {
			active_mask_id: "fox",
			active_hat_id: "tophat",
		});
		expect(update).toEqual({ active_glasses_id: "shades", active_mask_id: null });
		// Resulting set: glasses on, mask cleared, hat untouched.
		expect(activeIds).toEqual({
			active_hat_id: "tophat",
			active_glasses_id: "shades",
			active_mask_id: null,
		});
	});

	it("equipping a mask clears any equipped glasses (other direction)", () => {
		const { update, activeIds } = computeEquip("mask", "fox", {
			active_glasses_id: "shades",
		});
		expect(update).toEqual({ active_mask_id: "fox", active_glasses_id: null });
		expect(activeIds).toEqual({ active_glasses_id: null, active_mask_id: "fox" });
	});

	it("unequipping glasses (null) leaves the mask sibling alone", () => {
		const { update } = computeEquip("glasses", null, { active_mask_id: "fox" });
		expect(update).toEqual({ active_glasses_id: null });
		expect(update).not.toHaveProperty("active_mask_id");
	});

	it("unequipping a mask (null) leaves the glasses sibling alone", () => {
		const { update } = computeEquip("mask", null, { active_glasses_id: "shades" });
		expect(update).toEqual({ active_mask_id: null });
		expect(update).not.toHaveProperty("active_glasses_id");
	});
});

describe("computeEquip — non-face categories never touch a sibling", () => {
	it("equipping a hat writes only its own column", () => {
		const { update, activeIds } = computeEquip("hat", "tophat", {
			active_mask_id: "fox",
			active_glasses_id: "shades",
			active_aura_id: "halo",
		});
		expect(update).toEqual({ active_hat_id: "tophat" });
		// Every prior slot survives — only the hat column changes.
		expect(activeIds).toEqual({
			active_mask_id: "fox",
			active_glasses_id: "shades",
			active_aura_id: "halo",
			active_hat_id: "tophat",
		});
	});

	it("does not mutate the passed-in activeIds map", () => {
		const current = { active_mask_id: "fox" };
		computeEquip("glasses", "shades", current);
		expect(current).toEqual({ active_mask_id: "fox" });
	});
});
