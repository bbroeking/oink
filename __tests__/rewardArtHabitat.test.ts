// The 'habitat' reward (a Barn furnishing as a season-pass tier,
// 20260916100000) resolves its art through the HABITAT catalog rather than
// HAT_IMAGES, and the ladder pill vocabulary (rewardKind) puts it under
// `barn`. The catalog is mocked to a two-item map so the branch logic — known
// id → catalog art, unknown id → the Barn's missing-item art — is deterministic.

jest.mock("@/constants/hats", () => ({
	HAT_IMAGES: {
		muddy_cap: 200,
		// A HAT that shares a slug with a furnishing: the habitat branch must
		// never reach for it.
		firefly_lantern: 999,
	},
}));

jest.mock("@/constants/habitat", () => {
	const MISSING = 7;
	const ASSETS: Record<string, number> = { firefly_lantern: 501, hay_bale: 502 };
	return {
		HABITAT_CATALOG_BY_ID: {
			firefly_lantern: { id: "firefly_lantern", assetKey: "firefly_lantern", category: "ceiling_decor" },
			hay_bale: { id: "hay_bale", assetKey: "hay_bale", category: "floor_decor" },
		},
		habitatItemAsset: (key: string) => ASSETS[key] ?? MISSING,
	};
});

import {
	resolveRewardArt,
	rewardHabitatItemId,
	rewardItemId,
	rewardKind,
} from "@/utils/rewardArt";

describe("rewardHabitatItemId", () => {
	it("reads item_id only for a habitat reward", () => {
		expect(rewardHabitatItemId({ reward_type: "habitat", reward_value: { item_id: "hay_bale" } })).toBe("hay_bale");
		expect(rewardHabitatItemId({ reward_type: "hat", reward_value: { item_id: "hay_bale" } })).toBeNull();
		expect(rewardHabitatItemId({ reward_type: "habitat", reward_value: { item_id: "" } })).toBeNull();
		expect(rewardHabitatItemId({ reward_type: "habitat", reward_value: null })).toBeNull();
	});

	it("never leaks into the hats-table id coalesce", () => {
		expect(rewardItemId({ item_id: "hay_bale" })).toBeNull();
	});
});

describe("resolveRewardArt · habitat", () => {
	it("draws a known furnishing from the Barn catalog, not HAT_IMAGES", () => {
		expect(
			resolveRewardArt({ reward_type: "habitat", reward_value: { item_id: "firefly_lantern" } })
		).toEqual({ kind: "habitat", source: 501 });
	});

	it("falls back to the Barn's missing-item art for an id the bundle doesn't know", () => {
		expect(
			resolveRewardArt({ reward_type: "habitat", reward_value: { item_id: "not_in_catalog" } })
		).toEqual({ kind: "habitat", source: 7 });
		expect(resolveRewardArt({ reward_type: "habitat", reward_value: null })).toEqual({
			kind: "habitat",
			source: 7,
		});
	});

	it("leaves the wearable path untouched", () => {
		expect(resolveRewardArt({ reward_type: "hat", reward_value: { hat_id: "muddy_cap" } })).toEqual({
			kind: "image",
			source: 200,
		});
	});
});

describe("rewardKind (the ladder pill)", () => {
	const kind = (reward_type: string) => rewardKind({ reward_type, reward_value: null });

	it("maps every reward_type onto the six pill words", () => {
		expect(kind("habitat")).toBe("barn");
		expect(kind("title")).toBe("title");
		expect(kind("tickles")).toBe("tickles");
		expect(kind("snouts")).toBe("tickles");
		expect(kind("mystery_box")).toBe("mystery");
		for (const wear of ["hat", "background", "aura", "cape", "scarf", "mask", "necklace", "glasses", "bow", "held"]) {
			expect(kind(wear)).toBe("wear");
		}
		for (const beat of ["motes", "golden_truffle", "boost", "cap_increase", "pig_skin", "something_new"]) {
			expect(kind(beat)).toBe("milestone");
		}
	});
});
