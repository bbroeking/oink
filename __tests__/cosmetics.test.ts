// Locks the pure equip rule (utils/cosmetics computeEquip): column routing per
// category, the Face-slot exclusivity invariant in BOTH directions (glasses
// clears mask, mask clears glasses), and that non-face categories never touch a
// sibling column. Also covers the equipCosmetic effect wrapper's server-first /
// legacy-fallback dispatch (issue #35): rpc-success uses the server's patch,
// only a missing-function outcome falls back to the direct profiles write,
// other failures fail closed, and a server refusal returns an empty no-op patch.

// Mocked at the module boundary (same style as feedingConfig.test.ts).
const mockRpcOutcome = jest.fn();
jest.mock("../utils/rpc", () => ({
	rpcOutcome: (...a: unknown[]) => mockRpcOutcome(...a),
}));

const mockEq = jest.fn();
const mockUpdate = jest.fn((..._a: unknown[]) => ({ eq: mockEq }));
const mockFrom = jest.fn((..._a: unknown[]) => ({ update: mockUpdate }));
jest.mock("../utils/supabase", () => ({
	supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { computeEquip, equipCosmetic } from "../utils/cosmetics";

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

describe("equipCosmetic — server-first dispatch (issue #35)", () => {
	const USER = "user-1";

	beforeEach(() => {
		mockRpcOutcome.mockReset();
		mockEq.mockReset().mockResolvedValue({ error: null });
		mockUpdate.mockClear();
		mockFrom.mockClear();
	});

	it("calls equip_cosmetic with the item id + category and returns the server's patch", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: true, update: { active_hat_id: "tophat" } },
		});
		const patch = await equipCosmetic(USER, "tophat", "hat");
		expect(mockRpcOutcome).toHaveBeenCalledWith("equip_cosmetic", {
			p_item_id: "tophat",
			p_category: "hat",
		});
		// Server's patch is returned verbatim — the client trusts the server answer.
		expect(patch).toEqual({ active_hat_id: "tophat" });
		// No legacy direct write on the happy path.
		expect(mockFrom).not.toHaveBeenCalled();
	});

	it("passes p_category null for an unequip (item id null)", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: true, update: { active_mask_id: null } },
		});
		const patch = await equipCosmetic(USER, null, "mask");
		expect(mockRpcOutcome).toHaveBeenCalledWith("equip_cosmetic", {
			p_item_id: null,
			p_category: "mask",
		});
		expect(patch).toEqual({ active_mask_id: null });
	});

	it("falls back to the direct profiles write only when the RPC function is missing", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: false,
			kind: "missing_function",
			error: { code: "PGRST202", message: "Could not find the function" },
		});
		const patch = await equipCosmetic(USER, "shades", "glasses");
		// The legacy write path runs: profiles.update(computeEquip patch).eq(id, user).
		expect(mockFrom).toHaveBeenCalledWith("profiles");
		expect(mockUpdate).toHaveBeenCalledWith({
			active_glasses_id: "shades",
			active_mask_id: null,
		});
		expect(mockEq).toHaveBeenCalledWith("id", USER);
		// And it returns the same computeEquip patch that was written.
		expect(patch).toEqual({ active_glasses_id: "shades", active_mask_id: null });
	});

	it.each(["network", "rpc_error"] as const)(
		"fails closed on a %s RPC failure",
		async (kind) => {
			mockRpcOutcome.mockResolvedValue({
				ok: false,
				kind,
				error: { message: "permission or transport failure" },
			});
			await expect(equipCosmetic(USER, "shades", "glasses")).rejects.toThrow(
				"equip_cosmetic failed"
			);
			expect(mockFrom).not.toHaveBeenCalled();
		}
	);

	it("surfaces a legacy direct-write failure instead of returning an optimistic patch", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: false,
			kind: "missing_function",
			error: { code: "PGRST202", message: "Could not find the function" },
		});
		mockEq.mockResolvedValue({ error: { message: "permission denied" } });
		await expect(equipCosmetic(USER, "tophat", "hat")).rejects.toThrow(
			"legacy cosmetic equip failed: permission denied"
		);
	});

	it("returns an empty no-op patch (and skips the direct write) on a server refusal", async () => {
		mockRpcOutcome.mockResolvedValue({
			ok: true,
			data: { ok: false, reason: "not_owned" },
		});
		const patch = await equipCosmetic(USER, "unowned_hat", "hat");
		expect(patch).toEqual({});
		expect(mockFrom).not.toHaveBeenCalled();
	});
});
