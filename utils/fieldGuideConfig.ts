// Field Guide value-line numbers — SERVER-CONFIG-FED, compiled fallback (spec 16).
//
// WHY (founder rule, standing): the Field Guide's value lines must show REAL
// numbers, so the guide can never lie after a rebalance. Every tunable a value
// line prints — wrap base + ceiling, the daily-lucky payout + count, the
// Exchange floor price, the Trough seed share — reads from server config with a
// compiled fallback, the exact pattern as utils/feedingConfig.ts. Feeding-window
// geometry is NOT duplicated here: entry #8 computes live from feedingSchedule()
// via feedingWindowsLine() below, so a window shift self-updates the entry.
//
// The compiled defaults are sourced from the server surfaces that OWN each
// number today (documented per field). A future rebalance = one UPDATE to the
// app_settings.field_guide_numbers row; clients follow on their next fetch.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily inside refresh() so
// importing this module stays pure (mirrors feedingConfig).

import { EXCHANGE_PRICES } from "@/constants/dig";
import { feedingSchedule } from "@/utils/feedingConfig";

export interface FieldGuideNumbers {
	/** Regen-wrap base duration per wrap, hours (mud_wrap / warm_tea). */
	wrapBaseHours: number;
	/** Banked-wrap duration ceiling, hours. */
	wrapCeilingHours: number;
	/** Lucky numbers hiding in the herd's daily counter. */
	luckyDailyCount: number;
	/** Tickles paid on a daily-lucky-number hit. */
	luckyPayout: number;
	/** Cheapest Exchange cosmetic, in Golden Truffles. */
	exchangeMinPrice: number;
	/** Share of a Trough the opener seeds, as a whole percent. */
	troughSeedPct: number;
}

// Compiled fallback — the numbers the server owns today:
//   • wrap base 3h / ceiling 12h — migration 20260750 (mud-wrap stacking).
//   • lucky payout +5 / 3 daily numbers — the daily-lucky lane in
//     20260683 (referral_reward_ladder: counter+5) + roll_lucky_numbers().
//   • Exchange floor — the cheapest EXCHANGE_PRICES tier (muddy, 25).
//   • Trough seed 10% — spec 15 (the opener seeds the first tenth, no kickback).
export const DEFAULT_FIELD_GUIDE_NUMBERS: FieldGuideNumbers = Object.freeze({
	wrapBaseHours: 3,
	wrapCeilingHours: 12,
	luckyDailyCount: 3,
	luckyPayout: 5,
	exchangeMinPrice: Math.min(...Object.values(EXCHANGE_PRICES)),
	troughSeedPct: 10,
});

let current: FieldGuideNumbers = DEFAULT_FIELD_GUIDE_NUMBERS;

/** The live numbers the value lines read (module-level, no context). */
export function fieldGuideNumbers(): FieldGuideNumbers {
	return current;
}

function posInt(v: unknown, fallback: number): number {
	const n = typeof v === "number" ? Math.floor(v) : NaN;
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Clamp-validate a server row (the app_settings.field_guide_numbers shape,
 * snake_case) against the compiled defaults — any missing/out-of-bounds field
 * keeps its default, so a partial or malformed row can never blank a value line.
 * Exported as the test seam.
 */
export function sanitizeFieldGuideNumbers(raw: unknown): FieldGuideNumbers {
	if (raw == null || typeof raw !== "object") return DEFAULT_FIELD_GUIDE_NUMBERS;
	const r = raw as Record<string, unknown>;
	const d = DEFAULT_FIELD_GUIDE_NUMBERS;
	return {
		wrapBaseHours: posInt(r.wrap_base_hours, d.wrapBaseHours),
		wrapCeilingHours: posInt(r.wrap_ceiling_hours, d.wrapCeilingHours),
		luckyDailyCount: posInt(r.lucky_daily_count, d.luckyDailyCount),
		luckyPayout: posInt(r.lucky_payout, d.luckyPayout),
		exchangeMinPrice: posInt(r.exchange_min_price, d.exchangeMinPrice),
		troughSeedPct: posInt(r.trough_seed_pct, d.troughSeedPct),
	};
}

/** Install a sanitized set. Returns whether anything moved. Test seam. */
export function applyFieldGuideNumbers(next: FieldGuideNumbers): boolean {
	const changed =
		next.wrapBaseHours !== current.wrapBaseHours ||
		next.wrapCeilingHours !== current.wrapCeilingHours ||
		next.luckyDailyCount !== current.luckyDailyCount ||
		next.luckyPayout !== current.luckyPayout ||
		next.exchangeMinPrice !== current.exchangeMinPrice ||
		next.troughSeedPct !== current.troughSeedPct;
	if (changed) current = next;
	return changed;
}

/**
 * Fetch the server numbers (app_setting RPC) and install them. Fail-soft: a
 * missing RPC / null row / offline keeps the compiled fallback. Called on the
 * shelf mount and before a reveal presents, so a printed number is never stale.
 */
export async function refreshFieldGuideNumbers(): Promise<boolean> {
	try {
		const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
		const raw = await rpc<Record<string, unknown>>("app_setting", {
			p_key: "field_guide_numbers",
		});
		if (!raw) return false; // rpc missing / null row — keep the fallback
		return applyFieldGuideNumbers(sanitizeFieldGuideNumbers(raw));
	} catch {
		return false;
	}
}

/**
 * Entry #8's value line — COMPUTED live from feedingSchedule() so a window
 * shift (the +2h flip lesson) self-updates the guide with no rebuild. Never a
 * hard-coded "three feedings a day": both the count and the open span are
 * derived from the current schedule geometry.
 */
export function feedingWindowsLine(): string {
	const { windowSecs, openSecs } = feedingSchedule();
	const perDay = Math.max(1, Math.round(86400 / windowSecs));
	const openHours = openSecs / 3600;
	const openLabel = Number.isInteger(openHours)
		? `${openHours}h`
		: `${openHours.toFixed(1)}h`;
	return `${perDay} feedings a day — each open only its first ${openLabel}.`;
}

/** Test seam: back to the compiled defaults. */
export function resetFieldGuideNumbersForTests(): void {
	current = DEFAULT_FIELD_GUIDE_NUMBERS;
}
