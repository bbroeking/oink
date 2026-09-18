// The Ghost Sheep Trader — the read path, the sale RPC, and the pure rules.
//
// Server-authoritative (20260917170000_ghost_sheep_trader.sql): when he is
// here, until when, what he fancies, what each rarity pays and how many finds
// he still takes this visit all come off `trader_status()`; a sale is
// `trade_with_trader(item_id, nonce)`. The tuning rides on the status answer,
// so there is no config cell — the compiled fallback (constants/trader) only
// fills a field the server left out.
//
// FAIL-SOFT: an un-pushed server (trader_status missing) reads as "not here",
// and no surface draws him. The yard never shows a broken sheep.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily INSIDE the async paths
// (the config-cell idiom), so the pure rules here can be imported by tests
// without dragging native modules in.
import { isSatchelFindId, satchelFind, type SatchelFindId } from "@/constants/satchel";
import { TRADER_TUNING, traderPrice, type TraderTuning } from "@/constants/trader";
import { newSwapNonce, toBag, type SatchelItem } from "@/utils/satchel";
import type { RpcResult } from "@/utils/rpc";

function rpcAction<T = Record<string, never>>(
	name: string,
	params?: Record<string, unknown>,
): Promise<RpcResult<T>> {
	const { rpcAction: call } = require("@/utils/rpc") as typeof import("@/utils/rpc");
	return call<T>(name, params);
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface TraderVisit {
	id: number;
	/** The pig's local day the visit belongs to (YYYY-MM-DD); one visit per day. */
	day: string;
	arrivesAt: string;
	leavesAt: string;
	/** What he fancies — only spoken once he is here; null before. */
	wantFindId: SatchelFindId | null;
	sold: number;
	/** Tickles he has paid this visit. */
	tickles: number;
	findsLeft: number;
}

export interface TraderStatus {
	present: boolean;
	/** The server's clock at the read, so the client can measure "until when"
	 *  against the same clock that rolled the visit. */
	now: string;
	visit: TraderVisit | null;
	tuning: TraderTuning;
	/** The pig has sold him something, ever — the Field Guide's silhouette lifts. */
	met: boolean;
	sales: number;
}

export const NO_TRADER: TraderStatus = Object.freeze({
	present: false,
	now: "",
	visit: null,
	tuning: TRADER_TUNING,
	met: false,
	sales: 0,
}) as TraderStatus;

function num(v: unknown, fallback: number): number {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function toTuning(raw: Record<string, unknown>): TraderTuning {
	const p = (raw.prices ?? {}) as Record<string, unknown>;
	return {
		prices: {
			common: Math.max(0, Math.floor(num(p.common, TRADER_TUNING.prices.common))),
			uncommon: Math.max(0, Math.floor(num(p.uncommon, TRADER_TUNING.prices.uncommon))),
			rare: Math.max(0, Math.floor(num(p.rare, TRADER_TUNING.prices.rare))),
		},
		wantMultiplier: Math.max(1, num(raw.want_multiplier, TRADER_TUNING.wantMultiplier)),
		findsPerVisit: Math.max(0, Math.floor(num(raw.finds_per_visit, TRADER_TUNING.findsPerVisit))),
	};
}

function toVisit(raw: unknown): TraderVisit | null {
	if (!raw || typeof raw !== "object") return null;
	const v = raw as Record<string, unknown>;
	const id = num(v.id, NaN);
	if (!Number.isFinite(id)) return null;
	return {
		id,
		day: typeof v.day === "string" ? v.day : "",
		arrivesAt: typeof v.arrives_at === "string" ? v.arrives_at : "",
		leavesAt: typeof v.leaves_at === "string" ? v.leaves_at : "",
		wantFindId: isSatchelFindId(v.want_find_id) ? v.want_find_id : null,
		sold: Math.max(0, Math.floor(num(v.sold, 0))),
		tickles: Math.max(0, Math.floor(num(v.tickles, 0))),
		findsLeft: Math.max(0, Math.floor(num(v.finds_left, 0))),
	};
}

/** Narrow a raw trader_status() payload. */
export function toTraderStatus(raw: Record<string, unknown>): TraderStatus {
	const visit = toVisit(raw.visit);
	return {
		present: raw.present === true && visit != null,
		now: typeof raw.now === "string" ? raw.now : "",
		visit,
		tuning: toTuning(raw),
		met: raw.met === true,
		sales: Math.max(0, Math.floor(num(raw.sales, 0))),
	};
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export async function fetchTraderStatus(): Promise<RpcResult<{ status: TraderStatus }>> {
	const r = await rpcAction<Record<string, unknown>>("trader_status");
	if (!r.ok) return r as RpcResult<{ status: TraderStatus }>;
	return { ok: true, status: toTraderStatus(r) };
}

/** DEV ONLY — starts a visit for the caller right now (server-gated on
 *  profiles.is_test; a normal account answers `admin_only`). Resolves the
 *  fresh status so the yard can install it without a second read. */
export async function devSummonTrader(): Promise<RpcResult<{ status: TraderStatus }>> {
	const r = await rpcAction<Record<string, unknown>>("dev_summon_trader");
	if (!r.ok) return r as RpcResult<{ status: TraderStatus }>;
	return { ok: true, status: toTraderStatus(r) };
}

export interface TraderSale {
	/** The server had already recorded this nonce — the same receipt, again. */
	replay: boolean;
	findId: SatchelFindId;
	tickles: number;
	wasWant: boolean;
	before: number;
	after: number;
	findsLeft: number;
	/** Tickles he has paid this visit, after this one. */
	visitTickles: number;
	/** The WHOLE bag after the sale — never a count to trim by. */
	bag: SatchelItem[];
}

export type TraderSaleOutcome =
	| ({ ok: true } & TraderSale)
	| {
			ok: false;
			/** not_here · had_enough · not_in_bag · bad_nonce · network … */
			reason: string;
			/** On `not_here`: when he next arrives (null when unknown). */
			arrivesAt: string | null;
			/** On `not_in_bag`: the live bag, so the tile that was tapped leaves. */
			bag: SatchelItem[] | null;
	  };

export const newTraderNonce = newSwapNonce;

export async function tradeWithTrader(itemId: number, nonce: string): Promise<TraderSaleOutcome> {
	const r = await rpcAction<Record<string, unknown>>("trade_with_trader", {
		p_item_id: itemId,
		p_nonce: nonce,
	});
	if (!r.ok) {
		return {
			ok: false,
			reason: r.reason,
			arrivesAt: typeof r.arrives_at === "string" ? r.arrives_at : null,
			bag: Array.isArray(r.bag) ? toBag(r.bag) : null,
		};
	}
	return {
		ok: true,
		replay: r.replay === true,
		findId: isSatchelFindId(r.find_id) ? r.find_id : "river_pebble",
		tickles: Math.max(0, Math.floor(num(r.tickles, 0))),
		wasWant: r.was_want === true,
		before: Math.max(0, Math.floor(num(r.before, 0))),
		after: Math.max(0, Math.floor(num(r.after, 0))),
		findsLeft: Math.max(0, Math.floor(num(r.finds_left, 0))),
		visitTickles: Math.max(0, Math.floor(num(r.visit_tickles, 0))),
		bag: toBag(r.bag),
	};
}

// ── Pure rules ───────────────────────────────────────────────────────────────

/** What a bag row would pay him right now. */
export function priceFor(itemFindId: SatchelFindId, status: TraderStatus): number {
	const f = satchelFind(itemFindId);
	if (!f) return 0;
	return traderPrice(f, status.tuning, status.visit?.wantFindId ?? null);
}

/** Whole minutes until he leaves (0 once gone), measured against the server's
 *  clock at the read plus the time elapsed since. */
export function traderMinutesLeft(status: TraderStatus, readAtMs: number, nowMs = Date.now()): number {
	if (!status.present || !status.visit?.leavesAt) return 0;
	const serverNow = Date.parse(status.now);
	const leaves = Date.parse(status.visit.leavesAt);
	if (!Number.isFinite(serverNow) || !Number.isFinite(leaves)) return 0;
	const elapsed = Math.max(0, nowMs - readAtMs);
	return Math.max(0, Math.ceil((leaves - serverNow - elapsed) / 60000));
}

/** Milliseconds until the yard should ask again: his arrival when he is on
 *  his way, his leaving when he is here; null when there is nothing to wait
 *  for (no visit known). Clamped so a stale clock never fires a tight loop. */
export function traderNextCheckMs(status: TraderStatus, readAtMs: number, nowMs = Date.now()): number | null {
	if (!status.visit) return null;
	const serverNow = Date.parse(status.now);
	const edge = Date.parse(status.present ? status.visit.leavesAt : status.visit.arrivesAt);
	if (!Number.isFinite(serverNow) || !Number.isFinite(edge)) return null;
	const elapsed = Math.max(0, nowMs - readAtMs);
	// One second past the edge so the server's clock has crossed it too.
	return Math.max(1000, edge - serverNow - elapsed + 1000);
}

/** "2h 10m left" / "a few minutes left" — the fan row's hand line. */
export function traderStayLine(minutes: number): string {
	if (minutes <= 0) return "packing up";
	if (minutes < 5) return "a few minutes left";
	if (minutes < 60) return `${minutes}m left`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m === 0 ? `${h}h left` : `${h}h ${m}m left`;
}

/** His opening line on the sheet: what he fancies, or that he has had enough. */
export function traderGreeting(status: TraderStatus): string {
	const want = status.visit?.wantFindId ? satchelFind(status.visit.wantFindId) : null;
	if (status.visit && status.visit.findsLeft <= 0) return "Enough for one visit, little pig.";
	if (want) return `Finds for tickles. Today I fancy ${want.withArticle} — that one pays double.`;
	return "Finds for tickles, little pig. Sets. Singles. Whatever's in the bag.";
}

/** A refusal, in his voice. */
export function traderRefusalCopy(reason: string): string {
	switch (reason) {
		case "not_here":
			return "He's already wandered off.";
		case "had_enough":
			return "He's taken all he'll take this visit.";
		case "not_in_bag":
			return "That one isn't in your bag any more.";
		case "network":
			return "The hedge is quiet — try again in a moment.";
		default:
			return "He shook his head. Try again.";
	}
}
