// The sounder at the counter (Storefront build 2): the parse → resolve →
// buyable chain behind hooks/useShopCatalog's sixth fetch. The parser must
// read anything that is not a well-formed row list as an empty counter (an
// unpushed RPC hands rpc() a null; the lifecycle test's stub hands it a
// number), the resolver must drop what the catalog can't sell, and the buy
// gate must be the union of the drop and the counter.

import type { HatRow } from "@/constants/hats";
import {
	buyableIds,
	counterTag,
	parseCounterBuys,
	resolveCounterBuys,
} from "@/utils/shopCounter";

const hat = (id: string, extra: Partial<HatRow> = {}): HatRow => ({
	id,
	name: id.replace(/_/g, " "),
	cost: 200,
	display_order: 1,
	emoji: null,
	image_path: null,
	category: "hat",
	...extra,
});

const row = (over: Record<string, unknown> = {}) => ({
	user_id: "jen",
	username: "Jen",
	pig_id: "copper",
	hat_id: "top_hat",
	acquired_at: "2026-09-16T09:00:00Z",
	...over,
});

describe("parseCounterBuys", () => {
	it("reads nothing from null, a number, or a bare object", () => {
		expect(parseCounterBuys(null)).toEqual([]);
		expect(parseCounterBuys(300)).toEqual([]);
		expect(parseCounterBuys({ user_id: "jen" })).toEqual([]);
	});

	it("keeps well-formed rows in server order and drops rows missing an id", () => {
		const rows = parseCounterBuys([
			row(),
			row({ user_id: "sam", hat_id: "halo" }),
			row({ hat_id: "" }),
			row({ user_id: 7 }),
			"junk",
		]);
		expect(rows.map((r) => r.hatId)).toEqual(["top_hat", "halo"]);
		expect(rows[0]).toEqual({
			userId: "jen",
			username: "Jen",
			pigId: "copper",
			hatId: "top_hat",
			acquiredAt: "2026-09-16T09:00:00Z",
		});
	});

	it("falls back to Rosie for an unknown pig and to no name for a null one", () => {
		const [r] = parseCounterBuys([row({ pig_id: "dragon", username: null })]);
		expect(r.pigId).toBe("rosie");
		expect(r.username).toBeNull();
	});
});

describe("resolveCounterBuys + buyableIds", () => {
	const catalog = [hat("top_hat"), hat("halo", { cost: 1800 })];

	it("joins rows to their catalog item and drops what the shop can't sell", () => {
		const buys = resolveCounterBuys(
			parseCounterBuys([row(), row({ user_id: "sam", hat_id: "scarf_red" })]),
			catalog,
		);
		expect(buys).toHaveLength(1);
		expect(buys[0].item.id).toBe("top_hat");
		expect(buys[0].username).toBe("Jen");
	});

	it("the buy gate is today's drop plus the counter", () => {
		const daily = [hat("beanie")];
		const buys = resolveCounterBuys(parseCounterBuys([row()]), catalog);
		const ids = buyableIds(daily, buys);
		expect(ids.has("beanie")).toBe(true);
		expect(ids.has("top_hat")).toBe(true);
		expect(ids.has("halo")).toBe(false);
	});

	it("tags in the hand voice, with a stand-in for a nameless pig", () => {
		expect(counterTag({ username: "Jen", item: hat("top_hat") })).toBe(
			"Jen · top hat",
		);
		expect(counterTag({ username: null, item: hat("halo") })).toBe(
			"a sounder pig · halo",
		);
	});
});
