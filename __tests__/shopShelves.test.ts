// The storefront's shelves (Storefront build 2): the drop laid out three to a
// shelf with a short last shelf, and the members' shelf as a daily pick that
// every member sees alike and that rolls with the shelves at UTC midnight.

import {
	buyableNow,
	cardBadge,
	cardTag,
	cardTapAction,
	chunkShelves,
	countWord,
	dailyPick,
	dropDateKey,
	shopKicker,
} from "@/utils/shopShelves";

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

describe("cardTapAction", () => {
	it("opens the sheet for anything not owned", () => {
		expect(cardTapAction("cowboy", { owned: false, active: false })).toEqual({ kind: "preview" });
	});
	it("wears an owned item and takes off a worn one", () => {
		expect(cardTapAction("cowboy", { owned: true, active: false })).toEqual({ kind: "equip", itemId: "cowboy" });
		expect(cardTapAction("cowboy", { owned: true, active: true })).toEqual({ kind: "equip", itemId: null });
	});
});

// ONE card grammar (the shop-IA pass, 2026-09-17). The coaster said price /
// Wear / Wearing and the closet tile said Owned / Not owned, so the same hat
// was a price upstairs and a padlock downstairs. Both ask these two now.
describe("cardTag", () => {
	const hat = { cost: 349 };
	const rest = { inDrop: true, canAfford: true, locked: false };

	it("says what she is wearing before anything else", () => {
		expect(cardTag(hat, { ...rest, owned: true, active: true })).toEqual({
			kind: "wearing",
		});
	});

	it("offers to wear what is already yours", () => {
		expect(cardTag(hat, { ...rest, owned: true, active: false })).toEqual({
			kind: "wear",
		});
	});

	it("names a free item as earned, never sold", () => {
		expect(
			cardTag({ cost: 0 }, { ...rest, owned: false, active: false }),
		).toEqual({ kind: "seasonPass" });
	});

	it("puts an affordable price on today's shelf in the sun", () => {
		expect(cardTag(hat, { ...rest, owned: false, active: false })).toEqual({
			kind: "price",
			cost: 349,
			tone: "sun",
		});
	});

	it("mutes a price you cannot meet, and one that is not today's", () => {
		expect(
			cardTag(hat, { ...rest, canAfford: false, owned: false, active: false }),
		).toEqual({ kind: "price", cost: 349, tone: "muted" });
		expect(
			cardTag(hat, { ...rest, inDrop: false, owned: false, active: false }),
		).toEqual({ kind: "price", cost: 349, tone: "muted" });
	});

	it("mutes a members' piece for a non-member and lights it for a member", () => {
		const members = { cost: 900, members_only: true };
		expect(
			cardTag(members, { ...rest, locked: true, owned: false, active: false }),
		).toEqual({ kind: "price", cost: 900, tone: "muted" });
		expect(
			cardTag(members, { ...rest, owned: false, active: false }),
		).toEqual({ kind: "price", cost: 900, tone: "sun" });
	});
});

describe("cardBadge", () => {
	it("checks what is yours", () => {
		expect(cardBadge({ owned: true, locked: false })).toBe("check");
		expect(cardBadge({ owned: true, locked: true })).toBe("check");
	});

	it("locks members' pieces only, and badges nothing else", () => {
		expect(cardBadge({ owned: false, locked: true })).toBe("lock");
		expect(cardBadge({ owned: false, locked: false })).toBeNull();
	});
});

// The crown's kicker carries the day (polish pass, 2026-10-04): "★ THE SHOP"
// over "Shop" said nothing twice.
describe("countWord", () => {
	it("speaks counts in words to ten, then numerals", () => {
		expect(countWord(0)).toBe("no");
		expect(countWord(3)).toBe("three");
		expect(countWord(10)).toBe("ten");
		expect(countWord(11)).toBe("11");
	});
});

describe("buyableNow", () => {
	const state = {
		owned: new Set(["owned"]),
		buyableIds: new Set(["drop", "owned", "pricey", "members"]),
		counter: 500,
		isVip: false,
	};

	it("is a sun price tag: on a shelf today, not yours, affordable, not locked", () => {
		expect(buyableNow({ id: "drop", cost: 200 }, state)).toBe(true);
		expect(buyableNow({ id: "owned", cost: 200 }, state)).toBe(false);
		expect(buyableNow({ id: "pricey", cost: 900 }, state)).toBe(false);
		expect(buyableNow({ id: "members", cost: 200, members_only: true }, state)).toBe(false);
		expect(buyableNow({ id: "members", cost: 200, members_only: true }, { ...state, isVip: true })).toBe(true);
		expect(buyableNow({ id: "elsewhere", cost: 200 }, state)).toBe(false);
		expect(buyableNow({ id: "drop", cost: 0 }, state)).toBe(false);
	});
});

describe("shopKicker", () => {
	it("counts what a tap can buy right now", () => {
		expect(shopKicker({ loading: false, failed: false, shelfCount: 11, inReach: 3 })).toBe(
			"three you can buy today",
		);
		expect(shopKicker({ loading: false, failed: false, shelfCount: 11, inReach: 1 })).toBe(
			"one you can buy today",
		);
	});

	it("falls back to the size of the shelves when nothing is in reach", () => {
		expect(shopKicker({ loading: false, failed: false, shelfCount: 11, inReach: 0 })).toBe(
			"11 on the shelves today",
		);
	});

	it("never states a fact it does not have", () => {
		expect(shopKicker({ loading: true, failed: false, shelfCount: 0, inReach: 0 })).toBe(
			"stocking the shelves",
		);
		expect(shopKicker({ loading: false, failed: false, shelfCount: 0, inReach: 0 })).toBe(
			"sold out till sunrise",
		);
		expect(shopKicker({ loading: false, failed: true, shelfCount: 0, inReach: 0 })).toBe(
			"can't reach the shelves",
		);
	});
});

describe("shopKicker with a stall open (Pop-up Stall B1, 2026-10-29)", () => {
	it("leads with the stall and keeps the day's count", () => {
		expect(
			shopKicker({ loading: false, failed: false, shelfCount: 11, inReach: 3, stallOpen: true }),
		).toBe("a stall is open · three you can buy today");
		expect(
			shopKicker({ loading: false, failed: false, shelfCount: 11, inReach: 0, stallOpen: true }),
		).toBe("a stall is open · 11 on the shelves today");
	});

	it("never claims a stall over an empty or failed store", () => {
		expect(
			shopKicker({ loading: true, failed: false, shelfCount: 0, inReach: 0, stallOpen: true }),
		).toBe("stocking the shelves");
	});
});
