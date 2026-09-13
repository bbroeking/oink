// Locks the pure equip rule (utils/cosmetics computeEquip): column routing per
// category, the Face-slot exclusivity invariant in BOTH directions (glasses
// clears mask, mask clears glasses), and that non-face categories never touch a
// sibling column. Also covers the equipCosmetic effect wrapper's server-only
// dispatch (issue #35): rpc-success uses the server's patch, EVERY rpc failure
// fails closed (no direct profiles write exists to fall back to), and a server
// refusal returns an empty no-op patch.

// Mocked at the module boundary (same style as feedingConfig.test.ts).
const mockRpcOutcome = jest.fn();
jest.mock("../utils/rpc", () => ({
	rpcOutcome: (...a: unknown[]) => mockRpcOutcome(...a),
}));

import {
	computeEquip,
	cosmeticAccessibility,
	equipCosmetic,
} from "../utils/cosmetics";

const EMPTY: Record<string, string | null> = {};

describe("computeEquip — column routing", () => {
	it("routes a hat to active_hat_id", () => {
		const { update } = computeEquip("hat", "tophat", EMPTY);
		expect(update).toEqual({ active_hat_id: "tophat" });
	});

	it("routes bows to their independent active_bow_id column", () => {
		const { update } = computeEquip("bow", "red_bow", EMPTY);
		expect(update).toEqual({ active_bow_id: "red_bow" });
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
	it("equipping a bow leaves the current hat in place", () => {
		const { update, activeIds } = computeEquip("bow", "red_bow", {
			active_hat_id: "tophat",
		});
		expect(update).toEqual({ active_bow_id: "red_bow" });
		expect(activeIds).toEqual({
			active_hat_id: "tophat",
			active_bow_id: "red_bow",
		});
	});

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

describe("equipCosmetic — server-only dispatch (issue #35)", () => {
	beforeEach(() => {
		mockRpcOutcome.mockReset();
	});

	it("calls equip_cosmetic with the item id + category and returns the server's patch", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: true, update: { active_hat_id: "tophat" } },
		});
		const patch = await equipCosmetic("tophat", "hat");
		expect(mockRpcOutcome).toHaveBeenCalledWith("equip_cosmetic", {
			p_item_id: "tophat",
			p_category: "hat",
		});
		// Server's patch is returned verbatim — the client trusts the server answer.
		expect(patch).toEqual({ active_hat_id: "tophat" });
	});

	it("passes p_category null for an unequip (item id null)", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: true, update: { active_mask_id: null } },
		});
		const patch = await equipCosmetic(null, "mask");
		expect(mockRpcOutcome).toHaveBeenCalledWith("equip_cosmetic", {
			p_item_id: null,
			p_category: "mask",
		});
		expect(patch).toEqual({ active_mask_id: null });
	});

	it.each(["network", "rpc_error", "missing_function"] as const)(
		"fails closed on a %s RPC failure",
		async (kind) => {
			mockRpcOutcome.mockResolvedValue({
				ok: false,
				kind,
				error: { message: "permission or transport failure" },
			});
			await expect(equipCosmetic("shades", "glasses")).rejects.toThrow(
				"equip_cosmetic failed"
			);
		}
	);

	it("throws when the RPC succeeds but hands back no data", async () => {
		mockRpcOutcome.mockResolvedValue({ ok: true, data: null });
		await expect(equipCosmetic("tophat", "hat")).rejects.toThrow(
			"equip_cosmetic failed: no data"
		);
	});

	it("returns an empty no-op patch on a server refusal", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: false, reason: "not_owned" },
		});
		const patch = await equipCosmetic("unowned_hat", "hat");
		expect(patch).toEqual({});
	});
});

// The shared label/hint pair both cosmetic grids speak [D-03, D-04]. A control
// that spends states its cost in its label and its consequence in its hint.
describe("cosmeticAccessibility", () => {
	const TOPHAT = { name: "Top Hat", rarity: "rare", cost: 1200 };

	it("names the item, its rarity, its state and — while it is for sale — its cost", () => {
		const a11y = cosmeticAccessibility(TOPHAT, {
			owned: false,
			active: false,
			canAfford: true,
			action: "preview",
		});
		expect(a11y.accessibilityLabel).toBe("Top Hat, rare, not owned, 1,200 snouts");
		expect(a11y.accessibilityHint).toContain("1,200 snouts");
		expect(a11y.accessibilityState).toEqual({ selected: false, disabled: false });
	});

	it("drops the price once the item is owned, and marks a worn item selected", () => {
		const a11y = cosmeticAccessibility(TOPHAT, {
			owned: true,
			active: true,
			action: "preview",
		});
		expect(a11y.accessibilityLabel).toBe("Top Hat, rare, wearing");
		expect(a11y.accessibilityState.selected).toBe(true);
	});

	it("says why an item cannot be bought yet", () => {
		expect(
			cosmeticAccessibility(TOPHAT, {
				owned: false,
				active: false,
				canAfford: false,
				action: "preview",
			}).accessibilityHint,
		).toContain("don't have");
		expect(
			cosmeticAccessibility(TOPHAT, {
				owned: false,
				active: false,
				buyable: false,
				action: "preview",
			}).accessibilityHint,
		).toContain("today's shop");
		expect(
			cosmeticAccessibility({ ...TOPHAT, cost: 0 }, {
				owned: false,
				active: false,
				action: "preview",
			}).accessibilityHint,
		).toContain("earned, not sold");
	});

	it("announces the members gate rather than a bare 'not owned'", () => {
		const a11y = cosmeticAccessibility(TOPHAT, {
			owned: false,
			active: false,
			locked: true,
			action: "preview",
		});
		expect(a11y.accessibilityLabel).toContain("Slop Club members only");
		expect(a11y.accessibilityHint).toContain("membership is required");
	});

	it("states the equip consequence for the Closet's in-place tiles", () => {
		expect(
			cosmeticAccessibility(TOPHAT, { owned: true, active: false, action: "equip" })
				.accessibilityHint,
		).toBe("Equips this item on your pig");
		expect(
			cosmeticAccessibility(TOPHAT, { owned: true, active: true, action: "equip" })
				.accessibilityHint,
		).toBe("Removes this item from your pig");
	});
});
