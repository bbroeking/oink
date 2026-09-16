// The Barn Draw — typed wrappers over the two read RPCs plus the one pure rule
// the client needs synchronously (which collection is featured this week).
//
// Ratified 2026-09-16. Design: docs/design/2026-09-16-barn-prize-draw.md, with
// the founder's ratification correction: there is no "everyone's draw" layer.
// Server: 20260916120000_barn_draw_and_trough_quarter_reward.sql. Two prizes
// land, both furnishings out of the catalog:
//   • the HERD PRIZE — every Monday, when the race cycle resolves, each crew
//     draws one winner among the members who dug that week, off a seed
//     committed a week in advance (herd_prize_state → `week.seed_hash` before,
//     `last.seed` after, so a player can recompute the draw by hand);
//   • the TROUGH GIVER'S REWARD — reaching a quarter of a friend's Trough
//     draws one design from the week's featured collection, once a week.
//
// SERVER CONFIG OVER CONSTANTS: the tier weights live in app_settings.barn_draw.
// BARN_DRAW_TUNING is the compiled fallback for a pre-push server and MUST
// mirror that row.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily inside the async paths
// (the mondayDraw/satchel idiom) so the pure helpers stay importable by any
// test without dragging the supabase client in.
import type { RpcResult } from "@/utils/rpc";

export type BarnDrawTier = "common" | "uncommon" | "rare";

export const BARN_DRAW_TIERS: readonly BarnDrawTier[] = [
	"common",
	"uncommon",
	"rare",
] as const;

export interface BarnDrawTierSpec {
	tier: BarnDrawTier;
	/** Relative weight (not a percentage). */
	weight: number;
}

export interface BarnDrawTuning {
	tiers: BarnDrawTierSpec[];
}

/** Compiled fallback — mirrors app_settings.barn_draw. */
export const BARN_DRAW_TUNING: BarnDrawTuning = {
	tiers: [
		{ tier: "common", weight: 60 },
		{ tier: "uncommon", weight: 28 },
		{ tier: "rare", weight: 12 },
	],
};

// ── The featured-collection rotation ─────────────────────────────────────────

/** The Monday the rotation starts from: collection position 1. */
export const FEATURED_COLLECTION_EPOCH = "2026-09-14";
/** Collections on the ladder (habitat_collections, ordered by display_order). */
export const FEATURED_COLLECTION_COUNT = 10;

const EPOCH_MS = Date.UTC(2026, 8, 14); // 2026-09-14, a Monday
const DAY_MS = 86_400_000;

/**
 * The 0-based position of the week's featured collection on the display_order
 * ladder, for a race cycle_key ("YYYYMMDD", always a Monday). The server's
 * _barn_featured_collection() uses the 1-based position, so this + 1 is the
 * row it picks.
 *
 * Mirrors the server exactly: weeks = (cycleKey − 2026-09-14) / 7, then the
 * SAFE modulo ((w % n) + n) % n so a pre-epoch week wraps to the top of the
 * ladder instead of going negative. Math.trunc — not Math.floor — because
 * Postgres' integer division truncates toward zero; both agree for every real
 * cycle_key (the epoch and every cycle_key are Mondays, so the day difference
 * is always a whole number of weeks), and truncating keeps them agreeing if a
 * malformed key ever slips through.
 */
export function featuredCollectionIndex(cycleKey: string): number {
	const n = FEATURED_COLLECTION_COUNT;
	if (!/^\d{8}$/.test(cycleKey)) return 0;
	const y = Number(cycleKey.slice(0, 4));
	const m = Number(cycleKey.slice(4, 6));
	const d = Number(cycleKey.slice(6, 8));
	const ms = Date.UTC(y, m - 1, d);
	if (!Number.isFinite(ms)) return 0;
	const weeks = Math.trunc((ms - EPOCH_MS) / DAY_MS / 7);
	return ((weeks % n) + n) % n;
}

// ── Payload shapes ───────────────────────────────────────────────────────────

export type BarnPrizeKind = "habitat" | "tickles";

export interface HerdPrizeWeek {
	/** The cycle now being run — the week the sealed seed belongs to. */
	cycleKey: string;
	/** sha256 of the sealed seed, publishable before the draw. */
	seedHash: string | null;
}

export interface HerdPrizeDraw {
	cycleKey: string;
	/** Readable once the week has drawn — recompute the winner from it. */
	seed: string | null;
	crewId: string | null;
	winnerUserId: string | null;
	winnerName: string | null;
	kind: BarnPrizeKind | null;
	itemId: string | null;
	itemName: string | null;
	amount: number;
	/** The user ids the draw ran over, in winner-key order. */
	entrants: string[];
}

export interface HerdPrizeState {
	week: HerdPrizeWeek;
	/** The caller's crew's last draw, or null (crewless, or never drawn). */
	last: HerdPrizeDraw | null;
}

export interface BarnPrize {
	kind: BarnPrizeKind;
	itemId: string | null;
	itemName: string | null;
	amount: number;
}

export interface TroughRewardState {
	/** The CURRENT race cycle — the week being lived, not the ended one. */
	cycleKey: string;
	/** This week's one giver reward is already drawn. */
	taken: boolean;
	reward: BarnPrize | null;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function obj(v: unknown): Record<string, unknown> {
	return v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | null {
	return typeof v === "string" && v.length > 0 ? v : null;
}

function num(v: unknown, fallback = 0): number {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function isTier(v: unknown): v is BarnDrawTier {
	return typeof v === "string" && (BARN_DRAW_TIERS as readonly string[]).includes(v);
}

function isKind(v: unknown): v is BarnPrizeKind {
	return v === "habitat" || v === "tickles";
}

export function parseBarnDrawTuning(raw: unknown): BarnDrawTuning {
	const tiersRaw = Array.isArray(obj(raw).tiers) ? (obj(raw).tiers as unknown[]) : [];
	const tiers: BarnDrawTierSpec[] = [];
	for (const t of tiersRaw) {
		const o = obj(t);
		if (!isTier(o.tier)) continue;
		tiers.push({ tier: o.tier, weight: Math.max(0, num(o.weight)) });
	}
	return { tiers: tiers.length === BARN_DRAW_TIERS.length ? tiers : BARN_DRAW_TUNING.tiers };
}

export function parseBarnPrize(raw: unknown): BarnPrize | null {
	const o = obj(raw);
	if (!isKind(o.kind)) return null;
	return {
		kind: o.kind,
		itemId: str(o.item_id),
		itemName: str(o.item_name),
		amount: Math.max(0, Math.floor(num(o.amount))),
	};
}

export function parseHerdPrizeState(raw: unknown): HerdPrizeState {
	const s = obj(raw);
	const w = obj(s.week);
	const l = s.last == null ? null : obj(s.last);
	return {
		week: { cycleKey: str(w.cycle_key) ?? "", seedHash: str(w.seed_hash) },
		last:
			l == null || str(l.cycle_key) == null
				? null
				: {
						cycleKey: str(l.cycle_key) ?? "",
						seed: str(l.seed),
						crewId: str(l.crew_id),
						winnerUserId: str(l.winner_user_id),
						winnerName: str(l.winner_name),
						kind: isKind(l.kind) ? l.kind : null,
						itemId: str(l.item_id),
						itemName: str(l.item_name),
						amount: Math.max(0, Math.floor(num(l.amount))),
						entrants: Array.isArray(l.entrants)
							? (l.entrants as unknown[]).filter(
									(e): e is string => typeof e === "string",
								)
							: [],
					},
	};
}

export function parseTroughRewardState(raw: unknown): TroughRewardState {
	const s = obj(raw);
	return {
		cycleKey: str(s.cycle_key) ?? "",
		taken: s.taken === true,
		reward: parseBarnPrize(s.reward),
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

/** herd_prize_state() — the caller's crew's draw. `ok:false` pre-push. */
export async function fetchHerdPrizeState(): Promise<RpcResult<{ state: HerdPrizeState }>> {
	const r = await rpcAction<Record<string, unknown>>("herd_prize_state");
	if (!r.ok) return { ok: false, reason: r.reason };
	return { ok: true, state: parseHerdPrizeState(r) };
}

/** trough_reward_state() — has this week's giver reward been drawn yet? */
export async function fetchTroughRewardState(): Promise<RpcResult<{ state: TroughRewardState }>> {
	const r = await rpcAction<Record<string, unknown>>("trough_reward_state");
	if (!r.ok) return { ok: false, reason: r.reason };
	return { ok: true, state: parseTroughRewardState(r) };
}

/**
 * The Race panel's Barn Draw row, in one line. Before a crew has ever drawn,
 * the rule; after, the last result — mine as "you", a crewmate's by name; a
 * purse (the winner owned every design) says so. Never names who slept.
 */
export function herdPrizeLine(state: HerdPrizeState, uid?: string | null): string {
	const last = state.last;
	if (!last || !last.kind) return "one furnishing per herd, every Monday · dig once to be in";
	const mine = !!uid && last.winnerUserId === uid;
	const who = mine ? "you" : (last.winnerName ?? "a crewmate");
	if (last.kind === "tickles") return `${who} drew a purse of ${last.amount} tickles last Monday`;
	return `${who} drew the ${last.itemName ?? "new design"} last Monday`;
}
