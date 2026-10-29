// The Ghost Sheep Trader — the read path, the sale RPCs, and the pure rules.
//
// Server-authoritative (20260917170000_ghost_sheep_trader.sql): when he is
// here, until when, what he fancies, what each rarity pays and how many finds
// he still takes this visit all come off `trader_status()`; a sale is
// `trade_with_trader(item_id, nonce)`. The tuning rides on the status answer,
// so there is no config cell — the compiled fallback (constants/trader) only
// fills a field the server left out.
//
// Sets and trade-ups (20261029210000_trader_sets_and_trade_ups.sql): the sale
// that completes a pair of one find within a visit pays half again (judged
// server-side; `visit.unpaired` lets the sheet price it honestly), and
// `trade_up_with_trader(find_id, nonce)` turns three alike into one find of
// the next rarity (`visit.trade_ups` names his pick). A server without the
// feature answers neither key, and the sheet stays the single-find sheet.
//
// FAIL-SOFT: an un-pushed server (trader_status missing) reads as "not here",
// and no surface draws him. The yard never shows a broken sheep.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily INSIDE the async paths
// (the config-cell idiom), so the pure rules here can be imported by tests
// without dragging native modules in.
import { isSatchelFindId, satchelFind, type FindRarity, type SatchelFindId } from "@/constants/satchel";
import { TRADER_TUNING, nextRarity, traderHandPay, traderPrice, type TraderTuning } from "@/constants/trader";
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
	/** Finds one sale into a pair this visit: the next one completes it. */
	unpaired: SatchelFindId[];
	/** His trade-up pick, by the rarity three alike come FROM. Only once he
	 *  is here, and empty when trade-ups are off. */
	tradeUps: Partial<Record<FindRarity, SatchelFindId>>;
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
		// A server that never heard of sets answers no pair key: no pairs then,
		// whatever the compiled fallback says (the sheet must never promise a
		// bonus the server will not pay).
		pairMultiplier:
			"pair_multiplier" in raw ? Math.max(1, num(raw.pair_multiplier, TRADER_TUNING.pairMultiplier)) : 1,
		tradeUp: raw.trade_up === true,
		tradeUpCount: Math.max(2, Math.floor(num(raw.trade_up_count, TRADER_TUNING.tradeUpCount))),
	};
}

function toFindIds(raw: unknown): SatchelFindId[] {
	return Array.isArray(raw) ? raw.filter(isSatchelFindId) : [];
}

function toTradeUps(raw: unknown): Partial<Record<FindRarity, SatchelFindId>> {
	const out: Partial<Record<FindRarity, SatchelFindId>> = {};
	if (!raw || typeof raw !== "object") return out;
	const o = raw as Record<string, unknown>;
	for (const r of ["common", "uncommon"] as const) {
		const id = o[r];
		if (isSatchelFindId(id)) out[r] = id;
	}
	return out;
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
		unpaired: toFindIds(v.unpaired),
		tradeUps: toTradeUps(v.trade_ups),
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
	/** This sale completed a pair of one find within the visit; `pairBonus`
	 *  (already inside `tickles`) is the half-again. */
	pair: boolean;
	pairBonus: number;
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
		pair: r.pair === true,
		pairBonus: Math.max(0, Math.floor(num(r.pair_bonus, 0))),
		before: Math.max(0, Math.floor(num(r.before, 0))),
		after: Math.max(0, Math.floor(num(r.after, 0))),
		findsLeft: Math.max(0, Math.floor(num(r.finds_left, 0))),
		visitTickles: Math.max(0, Math.floor(num(r.visit_tickles, 0))),
		bag: toBag(r.bag),
	};
}

export interface TraderTradeUp {
	/** The server had already recorded this nonce — the same receipt, again. */
	replay: boolean;
	gaveFindId: SatchelFindId;
	/** How many went into his satchel (three). */
	count: number;
	gotFindId: SatchelFindId;
	gotItemId: number;
	/** No find of that kind sat in the bag before. */
	newToBag: boolean;
	findsLeft: number;
	visitTickles: number;
	/** The WHOLE bag after the trade-up — never a count to trim by. */
	bag: SatchelItem[];
}

export type TraderTradeUpOutcome =
	| ({ ok: true } & TraderTradeUp)
	| {
			ok: false;
			/** not_here · had_enough · not_enough · no_trade_up · bad_nonce · network … */
			reason: string;
			arrivesAt: string | null;
			/** On `not_enough` (and an unnameable pick): the live bag. */
			bag: SatchelItem[] | null;
	  };

/** Three alike for one of the next rarity (20261029210000). */
export async function tradeUpWithTrader(findId: SatchelFindId, nonce: string): Promise<TraderTradeUpOutcome> {
	const r = await rpcAction<Record<string, unknown>>("trade_up_with_trader", {
		p_find_id: findId,
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
	const got = r.got_find_id;
	if (!isSatchelFindId(got)) {
		// A find this build cannot name or draw: the bag is still the truth.
		return { ok: false, reason: "unknown_find", arrivesAt: null, bag: Array.isArray(r.bag) ? toBag(r.bag) : null };
	}
	return {
		ok: true,
		replay: r.replay === true,
		gaveFindId: isSatchelFindId(r.gave_find_id) ? r.gave_find_id : findId,
		count: Math.max(0, Math.floor(num(r.count, 3))),
		gotFindId: got,
		gotItemId: Math.floor(num(r.got_item_id, 0)),
		newToBag: r.new_to_bag === true,
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

/** One kind of find in the bag: its rows, in bag order. */
export interface BagGroup {
	findId: SatchelFindId;
	items: SatchelItem[];
}

/** The bag as one tile per find (first appearance first), each row kept so a
 *  hand-over sends real ids. A friend's find sorts last inside its group, so a
 *  hand spends dug ones first (the server's trade-up rule too). */
export function bagGroups(items: readonly SatchelItem[]): BagGroup[] {
	const byFind = new Map<SatchelFindId, SatchelItem[]>();
	for (const it of items) {
		const g = byFind.get(it.find_id);
		if (g) g.push(it);
		else byFind.set(it.find_id, [it]);
	}
	const fromFriend = (it: SatchelItem) =>
		it.source === "swap" || it.source === "gift" || it.source === "migrated_shelf" ? 1 : 0;
	return [...byFind.entries()].map(([findId, rows]) => ({
		findId,
		items: [...rows].sort((a, b) => fromFriend(a) - fromFriend(b)),
	}));
}

/** The find his three-alike trade-up hands back for this one, or null: rare
 *  (nothing above it), trade-ups off, or a pick this build cannot name. */
export function tradeUpPick(findId: SatchelFindId, status: TraderStatus): SatchelFindId | null {
	if (!status.tuning.tradeUp) return null;
	const f = satchelFind(findId);
	if (!f || nextRarity(f.rarity) == null) return null;
	return status.visit?.tradeUps[f.rarity] ?? null;
}

/** The most of one find a hand can hold right now: three when they can trade
 *  up (and he still takes three), two for a pair, else one. Never more than
 *  the bag holds or he still takes. */
export function maxHand(findId: SatchelFindId, owned: number, status: TraderStatus): number {
	const left = status.visit?.findsLeft ?? 0;
	const t = status.tuning;
	let cap = t.pairMultiplier > 1 ? 2 : 1;
	if (tradeUpPick(findId, status) && left >= t.tradeUpCount) cap = Math.max(cap, t.tradeUpCount);
	return Math.max(0, Math.min(cap, owned, left));
}

/** A hand of `count` of one find, priced: the single / the pair (with the
 *  half-again, counting one already unpaired this visit) / the trade-up. */
export type TraderHand =
	| {
			kind: "sell";
			findId: SatchelFindId;
			count: number;
			/** One find's price (the fancied one already doubled). */
			price: number;
			each: number[];
			total: number;
			/** Some sale in this hand completes a pair. */
			pair: boolean;
			/** One of this find already went this visit, unpaired. */
			openPair: boolean;
	  }
	| { kind: "tradeUp"; findId: SatchelFindId; count: number; pickId: SatchelFindId };

export function priceHand(findId: SatchelFindId, count: number, status: TraderStatus): TraderHand {
	const pick = tradeUpPick(findId, status);
	if (pick && count >= status.tuning.tradeUpCount) {
		return { kind: "tradeUp", findId, count, pickId: pick };
	}
	const price = priceFor(findId, status);
	const openPair = status.visit?.unpaired.includes(findId) ?? false;
	const { each, total } = traderHandPay(price, count, status.tuning.pairMultiplier, openPair);
	return { kind: "sell", findId, count, price, each, total, pair: each.some((p) => p > price), openPair };
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

/** The fan row's line while he is here: the deal, then the stay. */
export function traderFanLine(status: TraderStatus, minutes: number): string {
	if ((status.visit?.findsLeft ?? 0) <= 0) return "the Ghost Sheep has had enough";
	const deal = status.tuning.pairMultiplier > 1 ? " · pairs today" : "";
	return `the Ghost Sheep${deal} · ${traderStayLine(minutes)}`;
}

/** His opening line on the sheet: what he fancies, or that he has had enough.
 *  With sets on he names the new deal instead (the fancied tile says "pays
 *  double" on its own). */
export function traderGreeting(status: TraderStatus): string {
	const want = status.visit?.wantFindId ? satchelFind(status.visit.wantFindId) : null;
	if (status.visit && status.visit.findsLeft <= 0) return "Enough for one visit, little pig.";
	const pairs = status.tuning.pairMultiplier > 1;
	if (pairs && status.tuning.tradeUp) {
		return "Finds for tickles. Bring me a pair and I pay half again. Three alike and I will trade you up.";
	}
	if (pairs) return "Finds for tickles. Bring me a pair and I pay half again.";
	if (want) return `Finds for tickles. Today I fancy ${want.withArticle}. That one pays double.`;
	return "Finds for tickles, little pig. Sets. Singles. Whatever's in the bag.";
}

// The plural a hand line needs ("a pair of river pebbles"). Most finds add an
// s; the ones that do not are named here.
const PLURALS: Partial<Record<SatchelFindId, string>> = {
	wool_tuft: "tufts of wool",
	red_berries: "sprigs of red berries",
	clover: "four-leaf clovers",
	honeycomb: "honeycomb chips",
};

/** "river pebbles", "tufts of wool". */
export function findPlural(findId: SatchelFindId): string {
	return PLURALS[findId] ?? `${satchelFind(findId)?.name ?? "find"}s`;
}

/** The yard's word when he turns up while you watch. */
export function traderArrivalCopy(status: TraderStatus): { title: string; sub: string } {
	if (status.tuning.pairMultiplier > 1 && status.tuning.tradeUp) {
		return { title: "The Ghost Sheep is at the hedge", sub: "Today he fancies pairs. Three alike, he trades up." };
	}
	return { title: "A hooded stranger is at the hedge", sub: "The Ghost Sheep Trader · finds for tickles, while he stays" };
}

/** The yard's word when he packs up while you watch. */
export const TRADER_LEAVE_COPY = Object.freeze({
	title: "The Ghost Sheep wandered off",
	sub: "What is left stays yours. He is back tomorrow, some hour of his own.",
});

/** A refusal, in his voice. */
export function traderRefusalCopy(reason: string): string {
	switch (reason) {
		case "not_here":
			return "He's already wandered off.";
		case "had_enough":
			return "He's taken all he'll take this visit.";
		case "not_in_bag":
			return "That one isn't in your bag any more.";
		case "not_enough":
			return "Three alike, little pig. Count again.";
		case "no_trade_up":
			return "Nothing sits above that one.";
		case "network":
			return "The hedge is quiet. Try again in a moment.";
		default:
			return "He shook his head. Try again.";
	}
}
