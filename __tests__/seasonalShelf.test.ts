import {
	drawableShelfItems,
	heroItem,
	parseSeasonalShelf,
	stallBuyCopy,
	stallLanes,
	type ShelfItem,
} from "@/utils/seasonalShelf";
import { DAY_MS } from "@/utils/shelfCountdown";

const raw = {
	key: "halloween_2026",
	title: "Spooky Snouts",
	kicker: null,
	opens_at: "2026-10-30T00:00:00+00:00",
	closes_at: "2026-11-10T00:00:00+00:00",
	status: "open",
	backdrop_hat_id: "lantern_porch_bg",
	theme: { back_line: "back next October" },
	now: "2026-11-01T00:00:00+00:00",
	item_count: 3,
	owned_count: 1,
	items: [
		{ id: "moonbrew_witch_hat", name: "Moonbrew Witch Hat", cost: 1600, rarity: "epic", category: "hat", shelf_lane: "new", owned: false },
		{ id: "skull_mask", name: "Skull Mask", cost: 450, rarity: "rare", category: "mask", shelf_lane: "returning", owned: true },
		{ id: "bad_row", name: "No lane", cost: 10 },
	],
};

describe("parseSeasonalShelf", () => {
	it("reads the seasonal_shelf() payload", () => {
		const shelf = parseSeasonalShelf(raw);
		expect(shelf).not.toBeNull();
		expect(shelf!.key).toBe("halloween_2026");
		expect(shelf!.status).toBe("open");
		expect(shelf!.closesAt).toBe(raw.closes_at);
		expect(shelf!.backdropHatId).toBe("lantern_porch_bg");
		expect(shelf!.theme.back_line).toBe("back next October");
		// The row without a lane is dropped, the rest keep their lane + owned.
		expect(shelf!.items.map((i) => [i.id, i.shelf_lane, i.owned])).toEqual([
			["moonbrew_witch_hat", "new", false],
			["skull_mask", "returning", true],
		]);
	});

	it("reads anything else as no stall", () => {
		expect(parseSeasonalShelf(null)).toBeNull();
		expect(parseSeasonalShelf(undefined)).toBeNull();
		expect(parseSeasonalShelf([])).toBeNull();
		expect(parseSeasonalShelf({ ...raw, status: "dark" })).toBeNull();
		expect(parseSeasonalShelf({ ...raw, key: "" })).toBeNull();
		expect(parseSeasonalShelf({ ...raw, items: "nope" })!.items).toEqual([]);
	});
});

const piece = (id: string, lane: ShelfItem["shelf_lane"], over: Partial<ShelfItem> = {}): ShelfItem => ({
	id,
	name: id,
	cost: 100,
	display_order: 0,
	emoji: null,
	image_path: null,
	category: "hat",
	shelf_lane: lane,
	owned: false,
	...over,
});

describe("drawableShelfItems", () => {
	it("hides pieces whose art this binary lacks, and unplaceable slots", () => {
		const art = { a: 1, c: 1 };
		const items = [piece("a", "new"), piece("b", "new"), piece("c", "new", { category: "scarf" })];
		expect(drawableShelfItems(items, art, {}).map((i) => i.id)).toEqual(["a"]);
		expect(drawableShelfItems(items, {}, { b: 1 }).map((i) => i.id)).toEqual(["b"]);
	});
});

describe("stallLanes", () => {
	it("splits New · Back · Yours, owned from the row or the closet", () => {
		const items = [
			piece("n1", "new", { owned: true }),
			piece("n2", "new"),
			piece("r1", "returning"),
			piece("r2", "returning"),
		];
		const lanes = stallLanes(items, new Set(["r2"]));
		expect(lanes.new.map((i) => i.id)).toEqual(["n1", "n2"]);
		expect(lanes.back.map((i) => i.id)).toEqual(["r1", "r2"]);
		expect(lanes.yours.map((i) => i.id)).toEqual(["n1", "r2"]);
	});
});

describe("stallBuyCopy", () => {
	it("names the price, the window and what is left", () => {
		const now = Date.parse("2026-11-03T12:00:00Z");
		const copy = stallBuyCopy(
			{ name: "Moonbrew Witch Hat", cost: 1200 },
			1840,
			new Date(now + 6 * DAY_MS).toISOString(),
			now,
		);
		expect(copy).toEqual({
			kicker: "1,200 snouts · leaves in 6 days",
			title: "Buy the Moonbrew Witch Hat?",
			body: "It goes in your closet for keeps. You will have 640 snouts left.",
			confirmLabel: "Buy · 1,200",
		});
		expect(JSON.stringify(copy)).not.toMatch(/—/);
	});

	it("drops the window once it has closed", () => {
		const copy = stallBuyCopy({ name: "Cap", cost: 10 }, 5, "2026-01-01T00:00:00Z", Date.now());
		expect(copy.kicker).toBe("10 snouts");
		expect(copy.body).toContain("0 snouts left");
	});
});

describe("heroItem", () => {
	it("wears the theme's pick, else the first new non-background piece", () => {
		const items = [piece("bg", "new", { category: "background" }), piece("hat", "new"), piece("r", "returning")];
		expect(heroItem({ items, theme: {} }, items)!.id).toBe("hat");
		expect(heroItem({ items, theme: { hero_item_id: "r" } }, items)!.id).toBe("r");
		expect(heroItem({ items, theme: { hero_item_id: "missing" } }, items)!.id).toBe("hat");
		expect(heroItem({ items: [], theme: {} }, [])).toBeNull();
	});
});
