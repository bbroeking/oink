// Bullion's Market — the compiled tuning FALLBACK and the pure rules.
//
// Server-authoritative (20261031100000_bullions_market.sql): market_state()
// answers every number below on `tuning`, plus each find's live price and
// Bullion's two prices. These rules exist so a sheet can say what a tap WILL
// do before it is tapped ("the price goes 12.1 → 11.7"), exactly as the
// server will do it; the server re-judges every trade and is the only writer.
//
// The rules (the prototype's engine, round 4, verbatim):
//   U (the usual price of a set) = the Ghost Sheep's price for one find x the
//   set size. P (the price) lives in [0.85 U, 1.15 U]. Bullion sells at
//   max(U + 1, ceil(1.2 P)) and buys at min(U, floor(0.8 P)). A set at the
//   counter moves P 3% of U; a pig sale moves it a third of the way to what
//   was paid; a swap moves nothing.
import type { FindRarity } from "@/constants/satchel";

export type MarketSide = "sell" | "buy" | "swap";

export interface MarketPriceRules {
	lo: number;
	hi: number;
	sellFactor: number;
	buyFactor: number;
	impact: number;
	pigPull: number;
	wiggle: number;
	home: number;
}

export interface MarketTuning {
	setSize: Record<FindRarity, number>;
	/** The Ghost Sheep's price for one find, by rarity. */
	base: Record<FindRarity, number>;
	price: MarketPriceRules;
	/** A listing's price per set runs 1 .. listMultiple x the usual price. */
	listMultiple: number;
	openOffers: number;
	dailyPosts: number;
	offerHours: number;
	tickMinutes: number;
	/** Per-pig daily counter caps; null = off (the default). */
	counterCaps: { sell: number; buy: number } | null;
}

export const MARKET_TUNING: Readonly<MarketTuning> = Object.freeze({
	setSize: { common: 4, uncommon: 3, rare: 3 },
	base: { common: 3, uncommon: 8, rare: 20 },
	price: {
		lo: 0.85,
		hi: 1.15,
		sellFactor: 1.2,
		buyFactor: 0.8,
		impact: 0.03,
		pigPull: 1 / 3,
		wiggle: 0.01,
		home: 0.05,
	},
	listMultiple: 3,
	openOffers: 4,
	dailyPosts: 30,
	offerHours: 24,
	tickMinutes: 30,
	counterCaps: null,
});

const EPS = 1e-9;

export function setSizeFor(rarity: FindRarity, t: MarketTuning = MARKET_TUNING): number {
	return t.setSize[rarity];
}

/** The usual price of a set. */
export function usualFor(rarity: FindRarity, t: MarketTuning = MARKET_TUNING): number {
	return t.base[rarity] * t.setSize[rarity];
}

export function priceLo(u: number, t: MarketTuning = MARKET_TUNING): number {
	return t.price.lo * u;
}

export function priceHi(u: number, t: MarketTuning = MARKET_TUNING): number {
	return t.price.hi * u;
}

export function clampPrice(u: number, p: number, t: MarketTuning = MARKET_TUNING): number {
	return Math.max(priceLo(u, t), Math.min(priceHi(u, t), p));
}

/** What Bullion charges for a set at price P (never below the usual price + 1). */
export function askAt(u: number, p: number, t: MarketTuning = MARKET_TUNING): number {
	return Math.max(u + 1, Math.ceil(t.price.sellFactor * p - EPS));
}

/** What Bullion pays for a set at price P (never above the usual price). */
export function bidAt(u: number, p: number, t: MarketTuning = MARKET_TUNING): number {
	return Math.min(u, Math.floor(t.price.buyFactor * p + EPS));
}

/** A listing's price range, per set. */
export function listBand(u: number, t: MarketTuning = MARKET_TUNING): { min: number; max: number } {
	return { min: 1, max: t.listMultiple * u };
}

/** Where a counter trade sends the price. */
export function counterMove(u: number, p: number, side: "buy" | "sell", t: MarketTuning = MARKET_TUNING): number {
	return clampPrice(u, p + (side === "buy" ? 1 : -1) * t.price.impact * u, t);
}

/** Where a pig-to-pig sale at `paid` sends the price. */
export function pigMove(u: number, p: number, paid: number, t: MarketTuning = MARKET_TUNING): number {
	return clampPrice(u, p + (paid - p) * t.price.pigPull, t);
}

/** The slider's range on the post sheet: a quarter of U either side of his prices. */
export function postRange(u: number, bid: number, ask: number): { min: number; max: number } {
	const w = Math.max(3, Math.round(u * 0.25));
	return { min: Math.max(1, bid - w), max: ask + w };
}

/** Halfway between Bullion's prices — where a listing beats him both ways. */
export function middle(bid: number, ask: number): number {
	return Math.round((bid + ask) / 2);
}

// ── Words ────────────────────────────────────────────────────────────────────

/** One decimal, no trailing ".0": 12, 12.4. */
export function fmtPrice(p: number): string {
	const r = Math.round(p * 10) / 10;
	return r % 1 === 0 ? String(r) : r.toFixed(1);
}

export interface VsPrice {
	diff: number;
	word: string;
	short: string;
}

/** How a price per set compares to the price: "3 under the price", "2 over". */
export function vsPrice(price: number, p: number): VsPrice {
	const d = Math.round(price - p);
	if (d > 0) return { diff: d, word: `${d} over the price`, short: `${d} over` };
	if (d < 0) return { diff: d, word: `${-d} under the price`, short: `${-d} under` };
	return { diff: 0, word: "at the price", short: "at the price" };
}

/** "up 3" / "down 2" / "even". */
export function gainWord(g: number): string {
	const r = Math.round(g);
	if (r > 0) return `up ${r}`;
	if (r < 0) return `down ${-r}`;
	return "even";
}

/** "3 each" / "about 3 each". */
export function eachWord(total: number, size: number): string {
	if (total % size === 0) return `${total / size} each`;
	return `about ${Math.round(total / size)} each`;
}

export type Trend = "up" | "down" | "flat";

/** "up 0.4" / "down 1.2" / "steady", for a change since yesterday. */
export function changeWords(c: number): { trend: Trend; word: string } {
	const a = Math.round(Math.abs(c) * 10) / 10;
	if (a < 0.05) return { trend: "flat", word: "steady" };
	return c > 0 ? { trend: "up", word: `up ${fmtPrice(a)}` } : { trend: "down", word: `down ${fmtPrice(a)}` };
}

export interface HoldingCounts {
	held: number;
	size: number;
}

/** "none in your bag" / "you have 2 of 4" / "you have 1 set + 2". */
export function haveWords(h: HoldingCounts): string {
	if (!h.held) return "none in your bag";
	const sets = Math.floor(h.held / h.size);
	const spare = h.held % h.size;
	if (!sets) return `you have ${h.held} of ${h.size}`;
	return `you have ${sets} ${sets === 1 ? "set" : "sets"}${spare ? ` + ${spare}` : ""}`;
}

/** Hours left on a listing, in the board's words. */
export function hoursLeftWord(expiresAtMs: number, nowMs: number): string {
	const h = (expiresAtMs - nowMs) / 3_600_000;
	return h >= 1 ? `${Math.round(h)} h left` : "under an hour left";
}

// ── What a listing would do right now ────────────────────────────────────────

/** A listing on the board, as far as the preview needs it. */
export interface PreviewOffer {
	id: number;
	side: MarketSide;
	findId: string;
	price: number | null;
	posterId: string;
	/** A wanted ad's pig can still pay it. */
	payable: boolean;
}

export type ListPreview =
	| { fills: "pig"; at: number; offer: PreviewOffer }
	| { fills: "counter"; at: number }
	| { fills: null; sits: boolean };

/**
 * What posting a sell or wanted listing at `price` would do against the board
 * the viewer can see and Bullion's prices: sell to (or buy from) a pig at
 * once, cross with the counter at HIS price, or rest (and whether it would
 * just sit, priced past his counter). Mirrors market_post: the better of the
 * best pig and the counter, a tie to the pig; `target` limits the pig to one
 * friend.
 */
export function previewList(
	side: "sell" | "buy",
	findId: string,
	price: number,
	bid: number,
	ask: number,
	board: readonly PreviewOffer[],
	target: string | null = null,
): ListPreview {
	const mine = board.filter((o) => o.findId === findId && (!target || o.posterId === target) && o.price != null);
	if (side === "sell") {
		const w = mine
			.filter((o) => o.side === "buy" && o.payable && (o.price as number) >= price)
			.sort((a, b) => (b.price as number) - (a.price as number) || a.id - b.id)[0];
		if (w && ((w.price as number) >= bid || price > bid)) return { fills: "pig", at: w.price as number, offer: w };
		if (price <= bid) return { fills: "counter", at: bid };
		return { fills: null, sits: price >= ask };
	}
	const s = mine
		.filter((o) => o.side === "sell" && (o.price as number) <= price)
		.sort((a, b) => (a.price as number) - (b.price as number) || a.id - b.id)[0];
	if (s && ((s.price as number) <= ask || price < ask)) return { fills: "pig", at: s.price as number, offer: s };
	if (price >= ask) return { fills: "counter", at: ask };
	return { fills: null, sits: price <= bid };
}

/** A swap's verdict at today's prices: what you give vs what you ask. */
export function swapVerdict(giveVal: number, wantVal: number): "asking_more" | "giving_more" | "fair" {
	if (wantVal > giveVal * 1.1) return "asking_more";
	if (wantVal < giveVal * 0.9) return "giving_more";
	return "fair";
}
