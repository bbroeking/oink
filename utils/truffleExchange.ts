// Truffle Exchange — pure client mirrors of the server's weekly rotation
// (supabase/migrations/20260704300000_truffle_exchange.sql). The SERVER owns
// the real stock: exchange_rotation() returns it and redeem_war_cosmetic()
// re-derives it. These mirrors exist for tests and for the display-only
// preview when the RPC isn't deployed yet — they must never gate a purchase.

import { EXCHANGE_TIERS, EXCHANGE_PRICES, type ExchangeTier } from "@/constants/dig";

// tier lookup for a war-spoil id (null for non-exchange items).
export function tierForId(id: string): ExchangeTier | null {
	for (const tier of Object.keys(EXCHANGE_TIERS) as ExchangeTier[]) {
		if (EXCHANGE_TIERS[tier].includes(id)) return tier;
	}
	return null;
}

export function priceForId(id: string): number | null {
	const tier = tierForId(id);
	return tier ? EXCHANGE_PRICES[tier] : null;
}

// The 4-slot pick, mirroring exchange_week_stock()'s modular arithmetic.
// `seed` is the server's abs(hashtext('exchange:'||week)) — hashtext is not
// reproducible in JS, so callers pass any integer for previews/tests; parity
// of the ISO week number picks the marquee tier (even → champion, odd →
// heirloom), exactly like the SQL.
export function pickRotation(seed: number, isoWeekNumber: number): string[] {
	const s = Math.abs(Math.floor(seed));
	const marqueePool =
		isoWeekNumber % 2 === 0 ? EXCHANGE_TIERS.champion : EXCHANGE_TIERS.heirloom;
	return [
		EXCHANGE_TIERS.muddy[s % 5],
		EXCHANGE_TIERS.caked[Math.floor(s / 7) % 5],
		EXCHANGE_TIERS.prize[Math.floor(s / 49) % 7],
		marqueePool[Math.floor(s / 343) % marqueePool.length],
	];
}

// ISO-week helpers (UTC), mirroring to_char(..., 'IYYY-IW') and the
// date_trunc('week') restock boundary (Monday 00:00 UTC).
export function isoWeekInfo(d: Date = new Date()): {
	key: string;
	weekNumber: number;
	restockAt: Date;
} {
	// ISO week number: Thursday of the current week decides the ISO year.
	const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
	const dayNum = utc.getUTCDay() || 7; // Mon=1 … Sun=7
	const thursday = new Date(utc);
	thursday.setUTCDate(utc.getUTCDate() + 4 - dayNum);
	const isoYear = thursday.getUTCFullYear();
	const yearStart = new Date(Date.UTC(isoYear, 0, 1));
	const weekNumber = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
	const monday = new Date(utc);
	monday.setUTCDate(utc.getUTCDate() - (dayNum - 1));
	const restockAt = new Date(monday);
	restockAt.setUTCDate(monday.getUTCDate() + 7);
	return {
		key: `${isoYear}-${String(weekNumber).padStart(2, "0")}`,
		weekNumber,
		restockAt,
	};
}

// "restocks in Nd" whisper.
export function restockWhisper(restockAt: Date, now: Date = new Date()): string {
	const ms = restockAt.getTime() - now.getTime();
	if (ms <= 0) return "restocking now";
	const days = Math.floor(ms / 86400000);
	if (days >= 1) return `restocks in ${days}d`;
	const hours = Math.max(1, Math.floor(ms / 3600000));
	return `restocks in ${hours}h`;
}
