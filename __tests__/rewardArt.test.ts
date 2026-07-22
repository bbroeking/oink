// Pure-logic tests for the ONE reward-art resolver (utils/rewardArt). The shape
// resolution — id-coalesce, the wearable reward_type set, and reward_type →
// art-source kind — is pure and unit-testable; only rendering stays in the
// components. HAT_IMAGES is mocked to a tiny known map so the branch logic (which
// consults it to decide image-vs-fallback) is deterministic and independent of
// the real art bundle.

jest.mock("@/constants/hats", () => ({
	HAT_IMAGES: {
		golden_truffle: 100,
		muddy_cap: 200,
		swamp_crown: 300,
	},
}));

import {
	resolveRewardArt,
	rewardItemId,
	cosmeticImage,
	cosmeticName,
	WEARABLE_REWARD_TYPES,
} from "@/utils/rewardArt";

describe("rewardItemId (id-coalesce)", () => {
	it("prefers hat_id", () => {
		expect(
			rewardItemId({ hat_id: "a", bg_id: "b", aura_id: "c", cape_id: "d" })
		).toBe("a");
	});

	it("falls back to legacy keys in order for un-migrated rows", () => {
		expect(rewardItemId({ bg_id: "b" })).toBe("b");
		expect(rewardItemId({ aura_id: "c" })).toBe("c");
		expect(rewardItemId({ cape_id: "d" })).toBe("d");
	});

	it("is null when the value carries no id (or is null)", () => {
		expect(rewardItemId({ amount: 5 })).toBeNull();
		expect(rewardItemId(null)).toBeNull();
		expect(rewardItemId(undefined)).toBeNull();
	});
});

describe("WEARABLE_REWARD_TYPES", () => {
	it("holds the full hats-table set including the legacy categories", () => {
		for (const t of [
			"hat", "background", "aura", "cape", "scarf",
			"mask", "necklace", "glasses", "bow", "held",
		]) {
			expect(WEARABLE_REWARD_TYPES.has(t)).toBe(true);
		}
	});

	it("excludes non-wearable reward types", () => {
		expect(WEARABLE_REWARD_TYPES.has("tickles")).toBe(false);
		expect(WEARABLE_REWARD_TYPES.has("golden_truffle")).toBe(false);
		expect(WEARABLE_REWARD_TYPES.has("mystery_box")).toBe(false);
	});
});

describe("resolveRewardArt", () => {
	it("maps currency types to their own kinds", () => {
		expect(resolveRewardArt({ reward_type: "tickles", reward_value: { amount: 50 } }))
			.toEqual({ kind: "tickles" });
		expect(resolveRewardArt({ reward_type: "snouts", reward_value: { count: 3 } }))
			.toEqual({ kind: "snouts" });
	});

	it("resolves golden_truffle to its bundled sprite, distinct from wearable art", () => {
		expect(
			resolveRewardArt({ reward_type: "golden_truffle", reward_value: null })
		).toEqual({ kind: "goldenTruffle", source: 100 });
	});

	it("resolves a wearable with bundled art to an image source", () => {
		expect(
			resolveRewardArt({ reward_type: "hat", reward_value: { hat_id: "muddy_cap" } })
		).toEqual({ kind: "image", source: 200 });
	});

	it("resolves a legacy background/aura/cape id through the image branch when art exists", () => {
		expect(
			resolveRewardArt({ reward_type: "background", reward_value: { bg_id: "swamp_crown" } })
		).toEqual({ kind: "image", source: 300 });
	});

	it("falls to the art-less legacy glyph when a background/aura/cape carries no bundled art", () => {
		expect(resolveRewardArt({ reward_type: "background", reward_value: null }))
			.toEqual({ kind: "legacyBackground" });
		expect(resolveRewardArt({ reward_type: "aura", reward_value: { aura_id: "unknown" } }))
			.toEqual({ kind: "legacyAura" });
		expect(resolveRewardArt({ reward_type: "cape", reward_value: null }))
			.toEqual({ kind: "legacyCape" });
	});

	it("maps title / boost / special types to their own kinds", () => {
		expect(resolveRewardArt({ reward_type: "title", reward_value: { title: "Baron" } }))
			.toEqual({ kind: "title" });
		expect(resolveRewardArt({ reward_type: "boost", reward_value: null }))
			.toEqual({ kind: "boost" });
		for (const t of ["mystery_box", "cap_increase", "pig_skin"]) {
			expect(resolveRewardArt({ reward_type: t, reward_value: null }))
				.toEqual({ kind: "special" });
		}
	});

	it("falls back to a plain star for an unknown type or missing art", () => {
		expect(resolveRewardArt({ reward_type: "mystery_flavor", reward_value: null }))
			.toEqual({ kind: "fallback" });
		// A wearable whose id isn't bundled falls through to the fallback star.
		expect(resolveRewardArt({ reward_type: "hat", reward_value: { hat_id: "not_bundled" } }))
			.toEqual({ kind: "fallback" });
	});
});

describe("cosmeticImage", () => {
	it("returns the bundled sprite for a known id, undefined otherwise", () => {
		expect(cosmeticImage("muddy_cap")).toBe(200);
		expect(cosmeticImage("not_bundled")).toBeUndefined();
	});
});

describe("cosmeticName", () => {
	it("title-cases an underscore slug", () => {
		expect(cosmeticName("mud_derby_bg")).toBe("Mud Derby Bg");
		expect(cosmeticName("swamp_crown")).toBe("Swamp Crown");
	});

	it("drops empty segments from stray underscores", () => {
		expect(cosmeticName("__firefly__aura_")).toBe("Firefly Aura");
	});
});
