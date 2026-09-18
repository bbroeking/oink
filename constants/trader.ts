// The Ghost Sheep Trader — the compiled tuning FALLBACK and the pure rules.
//
// A hooded wandering trader who turns up at the hedge at random times (server-
// rolled visits, migration 20260917170000_ghost_sheep_trader.sql) and takes
// finds out of the Satchel for applied tickles — the same score-not-bank number
// a dig find pays. The server owns every number here (app_settings.trader_tuning,
// read through utils/trader's config cell); this file is only what the binary
// boots on, plus the price rule the sheet needs synchronously.
import type { FindRarity, SatchelFindDef } from "@/constants/satchel";

export interface TraderTuning {
	/** Tickles per find handed over, by rarity. */
	prices: Record<FindRarity, number>;
	/** What the find he fancies pays, as a multiple of its price. */
	wantMultiplier: number;
	/** How many finds he takes in one visit. */
	findsPerVisit: number;
}

export const TRADER_TUNING: Readonly<TraderTuning> = Object.freeze({
	prices: { common: 3, uncommon: 8, rare: 20 },
	wantMultiplier: 2,
	findsPerVisit: 6,
});

/** What one find pays right now — doubled (well, ×multiplier) when it is the
 *  one he fancies. Floored like the server's FLOOR(price * mult). */
export function traderPrice(
	find: Pick<SatchelFindDef, "id" | "rarity">,
	tuning: TraderTuning,
	wantFindId: string | null,
): number {
	const base = Math.max(0, tuning.prices[find.rarity] ?? 0);
	return find.id === wantFindId ? Math.floor(base * Math.max(1, tuning.wantMultiplier)) : base;
}
