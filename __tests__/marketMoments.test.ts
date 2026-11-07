// Bullion's Market onboarding pieces from the round-4 design: the fan row's
// "new here?", the quiet price wandering home, and the first sale that beats
// the counter ("Nice selling.").
import { MARKET_MOMENT_KEYS, MARKET_ONBOARDED_KEY, QUIET_TICKS, wanderingHome } from "@/constants/market";
import { quietMoment, soldHighMoment } from "@/components/market/marketCopy";
import { marketFanLine, type MarketPig, type MarketPing, type MarketTrade } from "@/utils/market";

const ping = (over: Partial<MarketPing> = {}): MarketPing => ({ open: true, notices: 0, forYou: 0, listings: 0, ...over });

const pig = (over: Partial<MarketPig> = {}): MarketPig => ({ id: "p", you: false, name: null, pigId: null, friend: false, ...over });

function trade(over: Partial<MarketTrade> = {}): MarketTrade {
	return {
		id: 1, kind: "pig", side: null, how: "listing", findId: "pinecone", qty: 4, price: 14,
		sellerId: "me", buyerId: "maya", seller: pig({ id: "me", you: true }), buyer: pig({ id: "maya", name: "Maya", friend: true }),
		from: 12, to: 12.7, bid: 9, ask: 15, cost: null, dug: 4, listed: 14,
		wantFindId: null, wantQty: null, giveVal: null, wantVal: null, who: null, dir: null, tick: 1, at: "2026-11-02T12:00:00Z",
		...over,
	};
}

// A day of ticks ending at `now`, `quiet` of them since the last move.
const spark = (points: number[]) => points.map((p, t) => ({ t, p }));

describe("the fan row's new here?", () => {
	it("shows until onboarding is done, under offers and news but over listings", () => {
		expect(marketFanLine(ping(), true)).toBe("new here? · buy, sell, swap");
		expect(marketFanLine(ping(), false)).toBe("buy, sell, swap");
		expect(marketFanLine(ping({ forYou: 1 }), true)).toBe("an offer for you");
		expect(marketFanLine(ping({ notices: 2 }), true)).toBe("news on 2 listings");
		expect(marketFanLine(ping({ listings: 1 }), true)).toBe("new here? · buy, sell, swap");
		expect(marketFanLine(ping({ listings: 1 }))).toBe("one listing pinned up");
	});

	it("keeps the storage keys the market first shipped with", () => {
		expect(MARKET_ONBOARDED_KEY).toBe("ttp.market.onboarded");
		expect(MARKET_MOMENT_KEYS.moved).toBe("ttp.market.moment.moved");
		expect(new Set(Object.values(MARKET_MOMENT_KEYS)).size).toBe(3);
	});
});

describe("a price wandering home", () => {
	const usual = 12;
	const drifting = spark([13.4, 13.3, 13.2, 13.1, 13.0, 12.9, 12.8, 12.7]);

	it("is quiet, still away from home, and closer than it was", () => {
		expect(wanderingHome({ usual, price: 12.7, quietFor: QUIET_TICKS, spark: drifting })).toBe(true);
	});
	it("not while trades are still moving it", () => {
		expect(wanderingHome({ usual, price: 12.7, quietFor: QUIET_TICKS - 1, spark: drifting })).toBe(false);
	});
	it("not once it is home (within 2% of usual)", () => {
		expect(wanderingHome({ usual, price: 12.2, quietFor: 10, spark: spark([12.6, 12.5, 12.4, 12.4, 12.3, 12.3, 12.2, 12.2]) })).toBe(false);
	});
	it("not when it has wandered further away", () => {
		expect(wanderingHome({ usual, price: 13.4, quietFor: 10, spark: spark([12.7, 12.8, 12.9, 13.0, 13.1, 13.2, 13.3, 13.4]) })).toBe(false);
	});
	it("not without a long enough line to judge", () => {
		expect(wanderingHome({ usual, price: 12.7, quietFor: 10, spark: spark([13, 12.7]) })).toBe(false);
	});

	it("says so in Bullion's words", () => {
		const r = quietMoment("pinecone", 12.7, 12);
		expect(r.title).toBe("Nobody's traded pinecones for a while");
		expect(r.line).toContain("wandering home");
		expect(r.tone).toBe("moment");
		expect(`${r.title} ${r.line}`).not.toMatch(/—/);
	});
});

describe("nice selling", () => {
	it("plays when a pig paid you more than Bullion would have", () => {
		const r = soldHighMoment(trade());
		expect(r).not.toBeNull();
		expect(r!.title).toBe("Nice selling.");
		expect(r!.line).toBe("Maya paid 5 more than I would have.");
		expect(r!.tone).toBe("moment");
	});
	it("never for a sale at Bullion's price, a buy, a counter trade or a swap", () => {
		expect(soldHighMoment(trade({ price: 9 }))).toBeNull();
		expect(soldHighMoment(trade({ seller: pig({ id: "x" }), buyer: pig({ id: "me", you: true }) }))).toBeNull();
		expect(soldHighMoment(trade({ kind: "counter", side: "sell" }))).toBeNull();
		expect(soldHighMoment(trade({ kind: "swap", price: null }))).toBeNull();
	});
	it("names a stranger as a pig", () => {
		expect(soldHighMoment(trade({ buyer: pig({ id: "s" }) }))!.line).toBe("A pig paid 5 more than I would have.");
	});
});
