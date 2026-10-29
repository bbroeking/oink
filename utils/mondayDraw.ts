// The Monday drum — typed wrappers over the two RPCs plus the pure rules the
// sheet and the Draw panel need synchronously (the "1 in N", the verdict).
//
// Spec: docs/design/2026-09-21-season-page-rewrite.md §2 ("The drum — Monday's
// randomization"). One ball per submitted dig in the week (cap = the snout's
// own feeding windows, 21 on the default schedule); on Monday the server rolls
// the tier table once PER BALL and pays the best tier rolled. The whole
// mechanism is best-of-N: no streak, no herd flag, no rank, no other pig.
//
// SERVER CONFIG OVER CONSTANTS: the tier amounts and weights ride on every
// state payload (`tiers`). MONDAY_DRAW_TUNING is the compiled fallback for a
// pre-push server and MUST mirror the app_settings.monday_draw row. All
// numbers are tuning placeholders.
//
// STALE SERVER: the parser also reads the pre-drum payload (mondays_since_rare
// / next_rare_odds_one_in / catchup, no balls) and maps what exists, so a
// client that ships ahead of the migration still renders a sheet rather than
// an empty one. What it cannot know (the ball counts) it says it cannot know
// (`cap: 0` — the copy then drops the "of N").
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

export interface MondayDrawTuning {
	tiers: MondayDrawTierSpec[];
}

/** Compiled fallback — mirrors app_settings.monday_draw (placeholders). */
export const MONDAY_DRAW_TUNING: MondayDrawTuning = {
	tiers: [
		{ tier: "common", amount: 20, weight: 60 },
		{ tier: "good", amount: 60, weight: 28 },
		{ tier: "rare", amount: 150, weight: 10 },
		{ tier: "jackpot", amount: 400, weight: 2 },
	],
};

export interface MondayDrawState {
	/** The DRAWABLE week — the one that just ended (its Monday, YYYYMMDD). */
	week: string;
	/** The drawable week held at least one ball, so a purse exists. */
	eligible: boolean;
	drawn: boolean;
	amount: number | null;
	tier: MondayDrawTier | null;
	/** Balls in the drawable week's drum: its digs, capped at its feedings. */
	balls: number;
	/**
	 * Leftovers (Season 2): one extra ball a below-rare Monday left in this
	 * week's drum. 0 or 1, never counted in `balls`; it rolls with them (the
	 * odds below already include it). The parser always fills it (0 on a server
	 * that doesn't say); optional so a hand-built state needn't.
	 */
	leftoverBalls?: number;
	/** That week's cap — the snout's own feeding windows. 0 = the server didn't say. */
	cap: number;
	/** The tier rolled per ball, best-of-N. Null until the purse is drawn. */
	rolls: MondayDrawTier[] | null;
	/** "1 in N" for rare-or-better at the drawable week's balls; null at 0 balls. */
	purseOddsOneIn: number | null;
	/** The week in progress (its Monday, YYYYMMDD). */
	runningWeek: string;
	/** Balls minted so far this week. */
	runningBalls: number;
	/** The leftover waiting in this week's drum (0 or 1); rolls once the week holds a dig. */
	runningLeftoverBalls?: number;
	/** This week's cap. 0 = the server didn't say. */
	runningCap: number;
	/** "1 in N" for rare-or-better at max(1, runningBalls) — always a number. */
	runningOddsOneIn: number;
	/** ISO time of the next Monday 00:00 UTC, when the server says. */
	nextTurnAt: string | null;
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

function count(v: unknown, fallback = 0): number {
	return Math.max(0, Math.floor(finite(v, fallback)));
}

function obj(v: unknown): Record<string, unknown> {
	return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// ── Pure rules ───────────────────────────────────────────────────────────────

/** The chance of rare-or-better on ONE ball, straight off the weights. */
export function rarePerBall(tuning: MondayDrawTuning = MONDAY_DRAW_TUNING): number {
	let hot = 0;
	let total = 0;
	for (const t of tuning.tiers) {
		total += t.weight;
		if (RARE_OR_BETTER.has(t.tier)) hot += t.weight;
	}
	if (total <= 0) return 0;
	return Math.min(1, Math.max(0, hot / total));
}

/**
 * "1 in N" for rare-or-better with `balls` in the drum. Best-of-N: every ball
 * is an independent roll of the same table, so the chance is
 * `1 − (1 − p)^n` with `p` the per-ball chance. Printed as `1 in
 * round(1 / that)`, never below 1. Mirrors _monday_draw_odds_one_in — the
 * server clamps `n` to at least 1, so an empty drum quotes a one-ball spin.
 *
 * At the placeholder weights (p = 12/100): 1 → 8, 3 → 3, 7 → 2, 21 → 1.
 */
export function oddsOneIn(
	balls: number,
	tuning: MondayDrawTuning = MONDAY_DRAW_TUNING,
): number {
	const p = rarePerBall(tuning);
	if (p <= 0) return Number.MAX_SAFE_INTEGER;
	const n = Math.max(1, Math.floor(finite(balls, 1)));
	const chance = 1 - Math.pow(1 - p, n);
	if (chance <= 0) return Number.MAX_SAFE_INTEGER;
	return Math.max(1, Math.round(1 / chance));
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

/** `1 ball` / `7 balls` — the drum's one count, spelled the same everywhere. */
export function ballsWord(balls: number): string {
	const n = Math.max(0, Math.floor(finite(balls, 0)));
	return `${n} ${n === 1 ? "ball" : "balls"}`;
}

/**
 * ` (+1 leftover)` when a below-rare Monday left a ball in this drum, else
 * nothing. Appended to the drum's count wherever it is printed, so the
 * leftover is named instead of folded silently into the number.
 */
export function leftoverSuffix(leftover: number): string {
	const n = Math.max(0, Math.floor(finite(leftover, 0)));
	return n > 0 ? ` (+${n} leftover)` : "";
}

/**
 * The odds line the Draw panel and the draw sheet both print. Never a
 * percentage — "1 in N" is the form a player can check against the drum.
 */
export function oddsLine(oneIn: number): string {
	return `rare or better: 1 in ${Math.max(1, Math.round(finite(oneIn, 1)))}`;
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
	return {
		tiers: tiers.length === MONDAY_DRAW_TIERS.length ? tiers : MONDAY_DRAW_TUNING.tiers,
	};
}

function parseRolls(raw: unknown): MondayDrawTier[] | null {
	if (!Array.isArray(raw)) return null;
	const out: MondayDrawTier[] = [];
	for (const r of raw) if (isTier(r)) out.push(r);
	return out.length > 0 ? out : null;
}

export function parseMondayDrawState(raw: unknown): MondayDrawState {
	const s = obj(raw);
	const tuning = parseMondayDrawTuning({ tiers: s.tiers });
	const tier = isTier(s.tier) ? s.tier : null;
	const amount = typeof s.amount === "number" && Number.isFinite(s.amount) ? s.amount : null;
	const eligible = s.eligible === true;

	// A pre-drum server sends no `balls`. An eligible week held at least one
	// ball by definition, so map that much and leave the cap unknown (0), which
	// the copy reads as "don't print the `of N`".
	const balls = count(s.balls, eligible ? 1 : 0);
	const cap = count(s.cap, 0);
	const runningBalls = count(s.running_balls, 0);
	const runningCap = count(s.running_cap, 0);
	// Leftovers (Season 2): optional, capped at one ball, 0 when a server (or
	// an older one) doesn't send them. They roll beside the dug balls, so the
	// client's fallback odds count the sum; the server's odds already do.
	const leftoverBalls = Math.min(1, count(s.leftover_balls, 0));
	const runningLeftoverBalls = Math.min(1, count(s.running_leftover_balls, 0));

	const week = typeof s.week === "string" ? s.week : "";
	const purseOdds =
		balls > 0
			? Math.max(
					1,
					Math.round(finite(s.purse_odds_one_in, oddsOneIn(balls + leftoverBalls, tuning))),
				)
			: null;

	return {
		week,
		eligible,
		drawn: s.drawn === true,
		amount,
		tier,
		balls,
		leftoverBalls,
		cap,
		rolls: parseRolls(s.rolls),
		purseOddsOneIn: purseOdds,
		runningWeek: typeof s.running_week === "string" ? s.running_week : week,
		runningBalls,
		runningLeftoverBalls,
		runningCap,
		runningOddsOneIn: Math.max(
			1,
			Math.round(
				finite(s.running_odds_one_in, oddsOneIn(runningBalls + runningLeftoverBalls, tuning)),
			),
		),
		nextTurnAt: typeof s.next_turn_at === "string" ? s.next_turn_at : null,
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
 * draw_monday_purse() — the write. One purse per snout per week; a second call
 * echoes the first. The settled snapshot carries `rolls`, so the reveal can
 * drop exactly the balls that were rolled. `reason: "not_eligible"` when the
 * week held no balls.
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
