// Pool integrity for the Season 1 relic pool. These pin the client mirror so it
// can't silently drift from the migration's unique_pool() (ids + weights) — a
// mismatch would render a relic the server can't award, or vice-versa.

import {
	UNIQUE_POOL,
	UNIQUE_IMAGES,
	UNIQUE_RARITY_WEIGHT,
	UNIQUE_BY_ID,
	UNIQUE_SPAWN_CHANCE,
	type UniqueRarity,
} from "../constants/uniques";

describe("UNIQUE_POOL integrity", () => {
	test("exactly 12 relics, all ids unique", () => {
		expect(UNIQUE_POOL).toHaveLength(12);
		const ids = UNIQUE_POOL.map((u) => u.id);
		expect(new Set(ids).size).toBe(12);
	});

	test("every relic has a name + story + valid rarity", () => {
		const rarities: UniqueRarity[] = [
			"common",
			"uncommon",
			"rare",
			"heirloom",
		];
		for (const u of UNIQUE_POOL) {
			expect(u.name.length).toBeGreaterThan(0);
			expect(u.story.length).toBeGreaterThan(0);
			expect(rarities).toContain(u.rarity);
		}
	});

	test("every relic has a bundled image", () => {
		for (const u of UNIQUE_POOL) {
			expect(UNIQUE_IMAGES[u.id]).toBeDefined();
		}
		// No orphan images (an image without a pool entry).
		expect(Object.keys(UNIQUE_IMAGES).sort()).toEqual(
			UNIQUE_POOL.map((u) => u.id).sort()
		);
	});

	test("the rarity → weight map covers every rarity present", () => {
		for (const u of UNIQUE_POOL) {
			expect(UNIQUE_RARITY_WEIGHT[u.rarity]).toBeGreaterThan(0);
		}
		// The documented weights (MUST match the migration's unique_pool()).
		expect(UNIQUE_RARITY_WEIGHT).toEqual({
			common: 6,
			uncommon: 3,
			rare: 1.5,
			heirloom: 0.5,
		});
	});

	test("UNIQUE_BY_ID resolves every relic", () => {
		for (const u of UNIQUE_POOL) {
			expect(UNIQUE_BY_ID[u.id]).toEqual(u);
		}
	});

	test("spawn chance mirror is ~2 in 5", () => {
		expect(UNIQUE_SPAWN_CHANCE).toBe(0.4);
	});
});
