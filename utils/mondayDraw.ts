// The Monday tickle draw — typed wrappers over the two RPCs plus the pure
// rules the sheet needs synchronously (the "1 in N", the verdict, the warming
// sentence).
//
// Spec: docs/design/season-almanac-2026-09-16/SPEC.md ("Monday draw" sheet,
// "Economy (server)"). Server: 20260916110000_monday_tickle_draw.sql. The
// draw is per snout, participation-gated (dug ≥1 feeding in the week that
// just ended), one per ISO week, rolled and minted server-side; the client
// only asks and shows.
//
// SERVER CONFIG OVER CONSTANTS: the tier amounts, base weights and catch-up
// curve ride on every state payload (`tiers`, `catchup`). MONDAY_DRAW_TUNING
// is the compiled fallback for a pre-push server and MUST mirror the
// app_settings.monday_draw row. All numbers are tuning placeholders.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily inside the async paths
// (the satchel idiom) so the pure helpers stay importable by any test without
// dragging the supabase client in.
import type { RpcResult } from "@/utils/rpc";

export type MondayDrawTier = "common" | "good" | "rare" | "jackpot";

export const MONDAY_DRAW_TIERS: readonly MondayDrawTier[] = [
	"common",
	"good",
	"rare",
	"jackpot",
] as const;

export interface MondayDrawTierSpec {
	tier: MondayDrawTier;
	amount: number;
	/** Relative base weight (not a percentage). */
	weight: number;
}

export interface MondayDrawCatchup {
	/** The streak length at which the first raise lands. */
	afterMondays: number;
	/** The raise per further Monday. */
	step: number;
	/** The ceiling multiplier. */
	cap: number;
	/** Extra steps a bottom-half herd finish adds. */
	bottomHalfStep: number;
}

export interface MondayDrawTuning {
	tiers: MondayDrawTierSpec[];
	catchup: MondayDrawCatchup;
}

/** Compiled fallback — mirrors app_settings.monday_draw (placeholders). */
export const MONDAY_DRAW_TUNING: MondayDrawTuning = {
	tiers: [
		{ tier: "common", amount: 20, weight: 60 },
		{ tier: "good", amount: 60, weight: 28 },
		{ tier: "rare", amount: 150, weight: 10 },
		{ tier: "jackpot", amount: 400, weight: 2 },
	],
	catchup: { afterMondays: 2, step: 0.5, cap: 3, bottomHalfStep: 1 },
};

export interface MondayDrawState {
	/** The race cycle_key of the week the purse is for (its Monday, YYYYMMDD). */
	week: string;
	/** Dug ≥1 feeding in that week. */
	eligible: boolean;
	drawn: boolean;
	amount: number | null;
	tier: MondayDrawTier | null;
	/** Consecutive prior draws below rare (this week's included once drawn). */
	mondaysSinceRare: number;
	herdBottomHalf: boolean;
	/** "1 in N" for rare-or-better on the next undrawn purse. */
	nextRareOddsOneIn: number;
	tuning: MondayDrawTuning;
}

export const RARE_OR_BETTER: ReadonlySet<MondayDrawTier> = new Set([
	"rare",
	"jackpot",
]);

function isTier(v: unknown): v is MondayDrawTier {
	return typeof v === "string" && (MONDAY_DRAW_TIERS as readonly string[]).includes(v);
}

function finite(v: unknown, fallback: number): number {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function obj(v: unknown): Record<string, unknown> {
	return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// ── Pure rules ───────────────────────────────────────────────────────────────

/**
 * The catch-up multiplier for a number of steps: LEAST(cap, 1 + step ×
 * max(0, steps − afterMondays + 1)). With the placeholders: ×1 for 0–1
 * steps, ×1.5 after two, ×2 after three, ×2.5, then capped at ×3. Mirrors
 * _monday_draw_multiplier.
 */
export function catchupMultiplier(
	steps: number,
	catchup: MondayDrawCatchup = MONDAY_DRAW_TUNING.catchup,
): number {
	const raised = Math.max(0, Math.floor(steps) - catchup.afterMondays + 1);
	return Math.min(catchup.cap, 1 + catchup.step * raised);
}

/**
 * "1 in N" for rare-or-better when the rare + jackpot weights carry
 * `multiplier`: the boosted hot weight over the boosted total, rounded to
 * the nearest whole N (never below 1). Mirrors _monday_draw_odds_one_in.
 */
export function oddsOneIn(
	weights: readonly Pick<MondayDrawTierSpec, "tier" | "weight">[],
	multiplier: number,
): number {
	let hot = 0;
	let cold = 0;
	for (const w of weights) {
		if (RARE_OR_BETTER.has(w.tier)) hot += w.weight;
		else cold += w.weight;
	}
	const boosted = hot * multiplier;
	if (boosted <= 0) return Number.MAX_SAFE_INTEGER;
	return Math.max(1, Math.round((cold + boosted) / boosted));
}

/** The verdict under the disc — one short sentence per tier. */
export function verdictFor(tier: MondayDrawTier): string {
	switch (tier) {
		case "jackpot":
			return "Jackpot.";
		case "rare":
			return "A rare purse!";
		case "good":
			return "A good purse.";
		default:
			return "A small purse.";
	}
}

const MONDAY_WORDS = [
	"No",
	"One",
	"Two",
	"Three",
	"Four",
	"Five",
	"Six",
	"Seven",
	"Eight",
	"Nine",
	"Ten",
];

function mondaysWord(n: number): string {
	return n < MONDAY_WORDS.length ? MONDAY_WORDS[n] : String(n);
}

/**
 * The warming row's sentence. Every Monday without a rare warms the next one
 * — the streak is told as a promise, never as a loss.
 */
export function warmingLine(mondaysSinceRare: number, oneIn: number): string {
	const n = Math.max(0, Math.floor(mondaysSinceRare));
	if (n === 0) {
		return `Every Monday without a rare warms the next: 1 in ${oneIn} for rare or better.`;
	}
	const mondays = n === 1 ? "One Monday" : `${mondaysWord(n)} Mondays`;
	return `${mondays} without a rare, so next Monday's warmer: 1 in ${oneIn} for rare or better.`;
}

/** The tier a purse of `amount` sits on, by the tuning table. */
export function tierForAmount(
	amount: number,
	tiers: readonly MondayDrawTierSpec[] = MONDAY_DRAW_TUNING.tiers,
): MondayDrawTier | null {
	return tiers.find((t) => t.amount === amount)?.tier ?? null;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

export function parseMondayDrawTuning(raw: unknown): MondayDrawTuning {
	const s = obj(raw);
	const tiersRaw = Array.isArray(s.tiers) ? s.tiers : [];
	const tiers: MondayDrawTierSpec[] = [];
	for (const t of tiersRaw) {
		const o = obj(t);
		if (!isTier(o.tier)) continue;
		tiers.push({
			tier: o.tier,
			amount: Math.max(0, Math.floor(finite(o.amount, 0))),
			weight: Math.max(0, finite(o.weight, 0)),
		});
	}
	const c = obj(s.catchup);
	const fb = MONDAY_DRAW_TUNING.catchup;
	return {
		tiers: tiers.length === MONDAY_DRAW_TIERS.length ? tiers : MONDAY_DRAW_TUNING.tiers,
		catchup: {
			afterMondays: Math.max(0, Math.floor(finite(c.after_mondays, fb.afterMondays))),
			step: Math.max(0, finite(c.step, fb.step)),
			cap: Math.max(1, finite(c.cap, fb.cap)),
			bottomHalfStep: Math.max(0, Math.floor(finite(c.bottom_half_step, fb.bottomHalfStep))),
		},
	};
}

export function parseMondayDrawState(raw: unknown): MondayDrawState {
	const s = obj(raw);
	const tuning = parseMondayDrawTuning({ tiers: s.tiers, catchup: s.catchup });
	const tier = isTier(s.tier) ? s.tier : null;
	const amount = typeof s.amount === "number" && Number.isFinite(s.amount) ? s.amount : null;
	const streak = Math.max(0, Math.floor(finite(s.mondays_since_rare, 0)));
	return {
		week: typeof s.week === "string" ? s.week : "",
		eligible: s.eligible === true,
		drawn: s.drawn === true,
		amount,
		tier,
		mondaysSinceRare: streak,
		herdBottomHalf: s.herd_bottom_half === true,
		nextRareOddsOneIn: Math.max(
			1,
			Math.round(
				finite(
					s.next_rare_odds_one_in,
					oddsOneIn(tuning.tiers, catchupMultiplier(streak, tuning.catchup)),
				),
			),
		),
		tuning,
	};
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

function rpcAction<T = Record<string, never>>(
	name: string,
	params?: Record<string, unknown>,
): Promise<RpcResult<T>> {
	const { rpcAction: call } = require("@/utils/rpc") as typeof import("@/utils/rpc");
	return call<T>(name, params);
}

/** monday_draw_state() — the read. `ok:false` on a pre-push server. */
export async function fetchMondayDrawState(): Promise<RpcResult<{ state: MondayDrawState }>> {
	const r = await rpcAction<Record<string, unknown>>("monday_draw_state");
	if (!r.ok) return { ok: false, reason: r.reason };
	return { ok: true, state: parseMondayDrawState(r) };
}

/**
 * draw_monday_purse() — the write. One purse per snout per week; a second
 * call echoes the first. `reason: "not_eligible"` when the snout didn't dig.
 */
export async function drawMondayPurse(): Promise<RpcResult<{ state: MondayDrawState }>> {
	const r = await rpcAction<Record<string, unknown>>("draw_monday_purse");
	if (!r.ok) {
		// A server refusal (not_eligible) still carries the honest snapshot —
		// keep it so the sheet settles without a refetch. A transport failure
		// carries nothing, and must not be mistaken for "didn't dig".
		const carried = typeof r.week === "string";
		return carried
			? { ok: false, reason: r.reason, state: parseMondayDrawState(r) }
			: { ok: false, reason: r.reason };
	}
	return { ok: true, state: parseMondayDrawState(r) };
}
