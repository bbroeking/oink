// The storefront's shelves (Storefront build 2): the drop laid out three to a
// shelf with a short last shelf, and the members' shelf as a daily pick that
// every member sees alike and that rolls with the shelves at UTC midnight.

import { chunkShelves, dailyPick, dropDateKey } from "@/utils/shopShelves";

describe("chunkShelves", () => {
	it("lays eight items out as 3 · 3 · 2", () => {
		const shelves = chunkShelves([1, 2, 3, 4, 5, 6, 7, 8], 3);
		expect(shelves).toEqual([
			[1, 2, 3],
			[4, 5, 6],
			[7, 8],
		]);
	});

	it("gives an empty drop no shelves at all", () => {
		expect(chunkShelves([], 3)).toEqual([]);
	});

	it("never builds a shelf narrower than one item", () => {
		expect(chunkShelves([1, 2], 0)).toEqual([[1], [2]]);
	});
});

describe("dropDateKey", () => {
	it("is the UTC calendar day, not the device's", () => {
		expect(dropDateKey(new Date("2026-09-16T23:30:00-05:00"))).toBe(
			"2026-09-17",
		);
	});
});

describe("dailyPick", () => {
	const catalog = Array.from({ length: 12 }, (_, i) => ({
		id: `members_${i}`,
	}));

	it("returns the same pick, in the same order, for the same day", () => {
		const a = dailyPick(catalog, "2026-09-16", 3);
		const b = dailyPick([...catalog].reverse(), "2026-09-16", 3);
		expect(a).toHaveLength(3);
		expect(a).toEqual(b);
	});

	it("rolls to a different shelf on another day", () => {
		const days = new Set(
			["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19"].map((d) =>
				dailyPick(catalog, d, 3)
					.map((i) => i.id)
					.join(","),
			),
		);
		expect(days.size).toBeGreaterThan(1);
	});

	it("hands back the whole catalog when it is smaller than the shelf", () => {
		expect(dailyPick(catalog.slice(0, 2), "2026-09-16", 3)).toHaveLength(2);
		expect(dailyPick([], "2026-09-16", 3)).toEqual([]);
		expect(dailyPick(catalog, "2026-09-16", 0)).toEqual([]);
	});
});
