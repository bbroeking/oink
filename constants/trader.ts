// The Ghost Sheep Trader — the compiled tuning FALLBACK and the pure rules.
//
// A hooded wandering trader who turns up at the hedge at random times (server-
// rolled visits, migration 20260917170000_ghost_sheep_trader.sql) and takes
// finds out of the Satchel for applied tickles — the same score-not-bank number
// a dig find pays. The server owns every number here (app_settings.trader_tuning,
// read through utils/trader's config cell); this file is only what the binary
// boots on, plus the price rules the sheet needs synchronously.
//
// Sets and trade-ups (2026-10-29, 20261029210000_trader_sets_and_trade_ups.sql):
// a PAIR of one find handed over within a visit pays half again (the server
// judges it over the visit's ledger), and THREE ALIKE trade up one rarity (his
// seeded pick; rare has no trade-up). His bag grows from six a visit to nine.
//
// Found, not bought (the 2026-11 balance pass): his x2 for the find he fancies
// pays only on a bag row with no market cost basis. Dug, given, swapped,
// errand and trade-up finds still double; a bought one pays the plain price.
// The pair bonus is unchanged, and each sale's price inside it already carries
// its own x2 (or not).
import type { FindRarity, SatchelFindDef } from "@/constants/satchel";

export interface TraderTuning {
	/** Tickles per find handed over, by rarity. */
	prices: Record<FindRarity, number>;
	/** What the find he fancies pays, as a multiple of its price. */
	wantMultiplier: number;
	/** How many finds he takes in one visit (a trade-up's three count). */
	findsPerVisit: number;
	/** What two of one find within a visit pay together, as a multiple of
	 *  their two prices. 1 = no pairs (a server without the feature). */
	pairMultiplier: number;
	/** Three alike trade up one rarity. False on a server without the feature. */
	tradeUp: boolean;
	/** How many alike a trade-up takes. */
	tradeUpCount: number;
}

export const TRADER_TUNING: Readonly<TraderTuning> = Object.freeze({
	prices: { common: 3, uncommon: 8, rare: 20 },
	wantMultiplier: 2,
	findsPerVisit: 9,
	pairMultiplier: 1.5,
	tradeUp: true,
	tradeUpCount: 3,
});

/** What one find pays right now — doubled (well, ×multiplier) when it is the
 *  one he fancies and it was not bought. Floored like the server's
 *  FLOOR(price * mult). */
export function traderPrice(
	find: Pick<SatchelFindDef, "id" | "rarity">,
	tuning: TraderTuning,
	wantFindId: string | null,
	bought = false,
): number {
	const base = Math.max(0, tuning.prices[find.rarity] ?? 0);
	return find.id === wantFindId && !bought ? Math.floor(base * Math.max(1, tuning.wantMultiplier)) : base;
}

/** The half-again on the sale that completes a pair: the server's
 *  FLOOR((unpaired price + this price) × (pair_multiplier − 1)). */
export function traderPairBonus(unpairedPrice: number, price: number, pairMultiplier: number): number {
	if (!(pairMultiplier > 1)) return 0;
	return Math.max(0, Math.floor((unpairedPrice + price) * (pairMultiplier - 1)));
}

/**
 * What handing a hand of one find over, one after another, pays — the
 * server's pair rule replayed: a sale that finds one of the same find already
 * unpaired this visit completes the pair and carries the bonus. `prices` is
 * each row's own price in hand order (a bought row of his fancy is not
 * doubled); `openPaid` is what the open unpaired sale of this find paid
 * earlier in the visit, or null when none is open. Returns each sale's pay
 * and the total.
 */
export function traderHandPay(
	prices: readonly number[],
	pairMultiplier: number,
	openPaid: number | null,
): { each: number[]; total: number } {
	const each: number[] = [];
	let unpaired: number | null = openPaid;
	for (const price of prices) {
		if (unpaired != null && pairMultiplier > 1) {
			each.push(price + traderPairBonus(unpaired, price, pairMultiplier));
			unpaired = null;
		} else {
			each.push(price);
			unpaired = price;
		}
	}
	return { each, total: each.reduce((a, b) => a + b, 0) };
}

/** The rarity a trade-up lands on; null above rare (nothing sits above it). */
export function nextRarity(r: FindRarity): FindRarity | null {
	if (r === "common") return "uncommon";
	if (r === "uncommon") return "rare";
	return null;
}
