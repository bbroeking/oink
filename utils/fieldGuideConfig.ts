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
// Like feedingConfig, this is now a thin DECLARATION over utils/configCell (the
// shared server-config lifecycle; build-151 "config over constants" contract).
// UNLIKE feedingConfig, this cell opts into NEITHER the AsyncStorage cache NOR
// the fetch debounce — matching today's behavior (every mount/reveal fetches, no
// cold-start cache). Both are ONE-LINE opt-ins on the createConfigCell spec
// (`cacheKey` / `minRefreshMs`) the day a value line needs them; they are left
// off deliberately, not by omission.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily inside the cell's refresh
// path so importing this module stays pure (mirrors feedingConfig).

import { EXCHANGE_PRICES } from "@/constants/dig";
import { feedingSchedule } from "@/utils/feedingConfig";
import { createConfigCell } from "@/utils/configCell";

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

function posInt(v: unknown, fallback: number): number {
	const n = typeof v === "number" ? Math.floor(v) : NaN;
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Clamp-validate a server row (the app_settings.field_guide_numbers shape,
 * snake_case) against the compiled defaults — any missing/out-of-bounds field
 * keeps its default, so a partial or malformed row can never blank a value line.
 * NEVER null (unlike sanitizeFeedingSchedule): a per-field fallback always yields
 * a complete set, so the cell's change-detection compares a full object every
 * time. Exported as the test seam.
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

const cell = createConfigCell<FieldGuideNumbers>({
	key: "field_guide_numbers",
	fallback: DEFAULT_FIELD_GUIDE_NUMBERS,
	sanitize: sanitizeFieldGuideNumbers, // never null — always a complete set
	// No cacheKey / minRefreshMs: cache-less + un-debounced, matching today.
});

/** The live numbers the value lines read (module-level, no context). */
export const fieldGuideNumbers: () => FieldGuideNumbers = cell.read;

/** Install a sanitized set. Returns whether anything moved. Test seam. */
export const applyFieldGuideNumbers: (next: FieldGuideNumbers) => boolean =
	cell.apply;

/**
 * Fetch the server numbers (app_setting RPC) and install them. Fail-soft: a
 * missing RPC / null row / offline keeps the compiled fallback. Called on the
 * shelf mount and before a reveal presents, so a printed number is never stale.
 */
export const refreshFieldGuideNumbers: () => Promise<boolean> = cell.refresh;

/**
 * Freshen-and-forget: kick a fail-soft refresh and return now. The season-tab
 * shelf mount and the reveal-present beat call this — they only need the numbers
 * up to date for the next paint, not the changed signal.
 */
export const ensureFieldGuideNumbersFresh: () => FieldGuideNumbers =
	cell.ensureFresh;

/** Test seam: back to the compiled defaults. */
export const resetFieldGuideNumbersForTests: () => void = cell.resetForTests;

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
