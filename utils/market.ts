// Bullion's Market — the read path, the trade RPCs, and the payload narrowing.
//
// Server-authoritative (20261031100000_bullions_market.sql): market_state()
// is the whole market as the caller sees it (the counter, the bank, the bag,
// the board, the tape, the notices handed over once); market_find(find) is one
// find up close. The writes — market_counter, market_post, market_take,
// market_cancel — are fail-closed {ok:false, reason} and idempotent on a
// nonce, so a double tap is one trade.
//
// FAIL-SOFT: an un-pushed server (market_state missing) answers a failed read;
// the Barn fan never draws the Market row and /market shows its empty state.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily INSIDE the async paths
// (the config-cell idiom), so the pure narrowing here is testable without
// dragging native modules in.
import { isSatchelFindId, type FindRarity, type SatchelFindId } from "@/constants/satchel";
import { MARKET_TUNING, type MarketSide, type MarketTuning, type PreviewOffer } from "@/constants/market";
import { newSwapNonce } from "@/utils/satchel";
import type { RpcResult } from "@/utils/rpc";

function rpcAction<T = Record<string, never>>(
	name: string,
	params?: Record<string, unknown>,
): Promise<RpcResult<T>> {
	const { rpcAction: call } = require("@/utils/rpc") as typeof import("@/utils/rpc");
	return call<T>(name, params);
}

export const newMarketNonce = newSwapNonce;

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface PricePoint {
	t: number;
	p: number;
}

export interface MarketFind {
	id: SatchelFindId;
	rarity: FindRarity;
	size: number;
	usual: number;
	/** P, the price per set. */
	price: number;
	/** What Bullion charges for a set. */
	ask: number;
	/** What Bullion pays for a set. */
	bid: number;
	/** The price a day ago. */
	prev: number;
	/** Ticks since a trade last moved it. */
	quietFor: number;
	/** The last day, one point a tick. */
	spark: PricePoint[];
}

export interface MarketPig {
	kind?: "bullion";
	id: string;
	you: boolean;
	/** Named only for you and your friends; "a pig" otherwise. */
	name: string | null;
	pigId: string | null;
	friend: boolean;
}

export interface MarketOffer {
	source?: "bullion";
	id: number;
	findId: SatchelFindId;
	side: MarketSide;
	price: number | null;
	qty: number;
	targetId: string | null;
	wantFindId: SatchelFindId | null;
	wantQty: number | null;
	createdAt: string;
	expiresAt: string;
	status: string;
	/** Why a listing ended, when a notice says (`target_left`: the one friend
	 *  it was offered to left the game). */
	ended?: string | null;
}

export interface BoardCard extends MarketOffer {
	poster: MarketPig;
	forYou: boolean;
	/** A wanted ad's pig has the tickles ready (null for other sides). */
	posterCoinOk: boolean | null;
}

export type TradeKind = "counter" | "pig" | "swap" | "print";

export interface MarketTrade {
	id: number;
	kind: TradeKind;
	/** counter: "buy" (a pig bought from Bullion) | "sell". */
	side: "buy" | "sell" | null;
	/** counter | board | crossed | listing | wanted */
	how: string | null;
	findId: SatchelFindId;
	qty: number;
	price: number | null;
	sellerId: string | null;
	buyerId: string | null;
	seller: MarketPig | null;
	buyer: MarketPig | null;
	from: number | null;
	to: number | null;
	bid: number | null;
	ask: number | null;
	/** The seller's cost basis (null when the set was all dug up). */
	cost: number | null;
	dug: number;
	listed: number | null;
	wantFindId: SatchelFindId | null;
	wantQty: number | null;
	giveVal: number | null;
	wantVal: number | null;
	/** A townsfolk print: who, and which way the wiggle went. */
	who: string | null;
	dir: "up" | "down" | null;
	tick: number;
	at: string;
}

export interface Holding {
	held: number;
	paid: number;
	paidUnits: number;
	onOffer: number;
}

/** `reset`: the season's fresh start ended a listing pinned before it, and a
 *  held set went with the reset bag (it never comes home). */
export type NoticeKind = "filled" | "crossed" | "expired" | "lapsed" | "swapped" | "for_you" | "reset";

export interface MarketNotice {
	id: number;
	kind: NoticeKind;
	offer: MarketOffer | null;
	trade: MarketTrade | null;
}

export interface MarketFriend {
	id: string;
	name: string;
	pigId: string | null;
}

export interface MarketMe {
	id: string;
	/** Tickles ready (the bank). */
	coin: number;
	cap: number;
	spent: number;
	tookIn: number;
	postsToday: number;
	/** Sets bought off Bullion's daily shelf today (tuning.bullionBoard.perPig caps it). */
	shelfToday: number;
	holdings: Partial<Record<SatchelFindId, Holding>>;
	offers: MarketOffer[];
}

export interface MarketState {
	now: string;
	tick: number;
	tuning: MarketTuning;
	finds: MarketFind[];
	me: MarketMe;
	board: BoardCard[];
	tape: MarketTrade[];
	notices: MarketNotice[];
	friends: MarketFriend[];
	yesterday: { findId: SatchelFindId; sets: number; lo: number; hi: number } | null;
}

/**
 * The market with its switch off: nothing trades, but your own listings stay
 * in reach so you can take them down (market_cancel ignores the switch). An
 * older server answers a bare {ok:false, reason:'closed'}: no listings then.
 */
export interface MarketClosed {
	now: string;
	tick: number;
	me: { id: string; offers: MarketOffer[]; holdings: Partial<Record<SatchelFindId, Holding>> };
}

export interface MarketFindView {
	findId: SatchelFindId;
	tick: number;
	hist: PricePoint[];
	marks: { t: number; kind: TradeKind; price: number }[];
	recent: MarketTrade[];
	today: { counterBuys: number; counterSells: number; pigSales: number; swaps: number; prints: number };
}

// ── Narrowing ────────────────────────────────────────────────────────────────

type Raw = Record<string, unknown>;

function obj(v: unknown): Raw {
	return v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};
}

function arr(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}

function num(v: unknown, fallback: number): number {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function numOrNull(v: unknown): number | null {
	return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function int(v: unknown, fallback = 0): number {
	return Math.floor(num(v, fallback));
}

function str(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
	return typeof v === "string" && v.length > 0 ? v : null;
}

function findOrNull(v: unknown): SatchelFindId | null {
	return isSatchelFindId(v) ? v : null;
}

const RARITIES: readonly FindRarity[] = ["common", "uncommon", "rare"];

function byRarity(raw: unknown, fallback: Record<FindRarity, number>): Record<FindRarity, number> {
	const o = obj(raw);
	return {
		common: Math.max(1, int(o.common, fallback.common)),
		uncommon: Math.max(1, int(o.uncommon, fallback.uncommon)),
		rare: Math.max(1, int(o.rare, fallback.rare)),
	};
}

export function toMarketTuning(raw: unknown): MarketTuning {
	const o = obj(raw);
	const p = obj(o.price);
	const f = MARKET_TUNING.price;
	const caps = obj(o.counter_caps);
	const shelf = obj(o.bullion_board);
	return {
		setSize: byRarity(o.set_size, MARKET_TUNING.setSize),
		base: byRarity(o.base, MARKET_TUNING.base),
		price: {
			lo: num(p.lo, f.lo),
			hi: num(p.hi, f.hi),
			sellFactor: num(p.sell_factor, f.sellFactor),
			buyFactor: num(p.buy_factor, f.buyFactor),
			impact: num(p.impact, f.impact),
			pigPull: num(p.pig_pull, f.pigPull),
			wiggle: num(p.wiggle, f.wiggle),
			home: num(p.home, f.home),
		},
		listMultiple: Math.max(1, int(o.list_multiple, MARKET_TUNING.listMultiple)),
		openOffers: Math.max(1, int(o.open_offers, MARKET_TUNING.openOffers)),
		dailyPosts: Math.max(1, int(o.daily_posts, MARKET_TUNING.dailyPosts)),
		offerHours: Math.max(1, int(o.offer_hours, MARKET_TUNING.offerHours)),
		tickMinutes: Math.max(1, int(o.tick_minutes, MARKET_TUNING.tickMinutes)),
		counterCaps:
			typeof caps.sell === "number" && typeof caps.buy === "number" ? { sell: caps.sell, buy: caps.buy } : null,
		bullionBoard: {
			dailyListings: Math.max(0, int(shelf.daily_listings, MARKET_TUNING.bullionBoard.dailyListings)),
			// An explicit null is "no limit"; a missing key is the default.
			perPig: shelf.per_pig === null ? null : Math.max(0, int(shelf.per_pig, MARKET_TUNING.bullionBoard.perPig ?? 1)),
		},
	};
}

function toPoints(raw: unknown): PricePoint[] {
	const out: PricePoint[] = [];
	for (const x of arr(raw)) {
		if (Array.isArray(x) && typeof x[0] === "number" && typeof x[1] === "number") out.push({ t: x[0], p: x[1] });
	}
	return out;
}

function toFind(raw: unknown): MarketFind | null {
	const o = obj(raw);
	const id = findOrNull(o.id);
	if (!id) return null;
	const rarity = RARITIES.includes(o.rarity as FindRarity) ? (o.rarity as FindRarity) : "common";
	const price = num(o.price, 0);
	return {
		id,
		rarity,
		size: Math.max(1, int(o.size, MARKET_TUNING.setSize[rarity])),
		usual: Math.max(1, int(o.usual, 1)),
		price,
		ask: int(o.ask, 0),
		bid: int(o.bid, 0),
		prev: num(o.prev, price),
		quietFor: Math.max(0, int(o.quiet_for, 0)),
		spark: toPoints(o.spark),
	};
}

export function toMarketPig(raw: unknown): MarketPig | null {
	const o = obj(raw);
	const id = strOrNull(o.id);
	if (!id) return null;
	return {
		id,
		...(o.kind === "bullion" ? { kind: "bullion" as const } : {}),
		you: o.you === true,
		name: strOrNull(o.name),
		pigId: strOrNull(o.pig_id),
		friend: o.friend === true,
	};
}

const SIDES: readonly MarketSide[] = ["sell", "buy", "swap"];

export function toMarketOffer(raw: unknown): MarketOffer | null {
	const o = obj(raw);
	const id = numOrNull(o.id);
	const findId = findOrNull(o.find_id);
	if (id == null || !findId || !SIDES.includes(o.side as MarketSide)) return null;
	return {
		id,
		...(o.source === "bullion" ? { source: "bullion" as const } : {}),
		findId,
		side: o.side as MarketSide,
		price: numOrNull(o.price),
		qty: Math.max(1, int(o.qty, 1)),
		targetId: strOrNull(o.target_id),
		wantFindId: findOrNull(o.want_find_id),
		wantQty: numOrNull(o.want_qty),
		createdAt: str(o.created_at),
		expiresAt: str(o.expires_at),
		status: str(o.status) || "open",
		ended: strOrNull(o.ended),
	};
}

function toCard(raw: unknown): BoardCard | null {
	const offer = toMarketOffer(raw);
	if (!offer) return null;
	const o = obj(raw);
	const poster = toMarketPig(o.poster) ?? { id: "", you: false, name: null, pigId: null, friend: false };
	return {
		...offer,
		poster,
		forYou: o.for_you === true,
		posterCoinOk: typeof o.poster_coin_ok === "boolean" ? o.poster_coin_ok : null,
	};
}

const KINDS: readonly TradeKind[] = ["counter", "pig", "swap", "print"];

export function toMarketTrade(raw: unknown): MarketTrade | null {
	const o = obj(raw);
	const id = numOrNull(o.id);
	const findId = findOrNull(o.find_id);
	if (id == null || !findId || !KINDS.includes(o.kind as TradeKind)) return null;
	return {
		id,
		kind: o.kind as TradeKind,
		side: o.side === "buy" || o.side === "sell" ? o.side : null,
		how: strOrNull(o.how),
		findId,
		qty: Math.max(1, int(o.qty, 1)),
		price: numOrNull(o.price),
		sellerId: strOrNull(o.seller_id),
		buyerId: strOrNull(o.buyer_id),
		seller: toMarketPig(o.seller),
		buyer: toMarketPig(o.buyer),
		from: numOrNull(o.from),
		to: numOrNull(o.to),
		bid: numOrNull(o.bid),
		ask: numOrNull(o.ask),
		cost: numOrNull(o.cost),
		dug: Math.max(0, int(o.dug, 0)),
		listed: numOrNull(o.listed),
		wantFindId: findOrNull(o.want_find_id),
		wantQty: numOrNull(o.want_qty),
		giveVal: numOrNull(o.give_val),
		wantVal: numOrNull(o.want_val),
		who: strOrNull(o.who),
		dir: o.dir === "up" || o.dir === "down" ? o.dir : null,
		tick: int(o.tick, 0),
		at: str(o.at),
	};
}

const NOTICE_KINDS: readonly NoticeKind[] = ["filled", "crossed", "expired", "lapsed", "swapped", "for_you", "reset"];

function compact<T>(xs: (T | null)[]): T[] {
	return xs.filter((x): x is T => x != null);
}

function toHoldings(raw: unknown): Partial<Record<SatchelFindId, Holding>> {
	const holdings: Partial<Record<SatchelFindId, Holding>> = {};
	for (const [k, v] of Object.entries(obj(raw))) {
		if (!isSatchelFindId(k)) continue;
		const h = obj(v);
		holdings[k] = {
			held: Math.max(0, int(h.held)),
			paid: Math.max(0, int(h.paid)),
			paidUnits: Math.max(0, int(h.paid_units)),
			onOffer: Math.max(0, int(h.on_offer)),
		};
	}
	return holdings;
}

/** A closed market's answer: your own open listings (and bag), nothing else. */
export function toMarketClosed(raw: Raw): MarketClosed {
	const me = obj(raw.me);
	return {
		now: str(raw.now),
		tick: int(raw.tick, 0),
		me: {
			id: str(me.id),
			offers: compact(arr(me.offers).map(toMarketOffer)).filter((o) => o.status === "open"),
			holdings: toHoldings(me.holdings),
		},
	};
}

export function toMarketState(raw: Raw): MarketState {
	const me = obj(raw.me);
	const holdings = toHoldings(me.holdings);
	const y = obj(raw.yesterday);
	const yFind = findOrNull(y.find_id);
	return {
		now: str(raw.now),
		tick: int(raw.tick, 0),
		tuning: toMarketTuning(raw.tuning),
		finds: compact(arr(raw.finds).map(toFind)),
		me: {
			id: str(me.id),
			coin: Math.max(0, int(me.coin)),
			cap: Math.max(1, int(me.cap, 25)),
			spent: Math.max(0, int(me.spent)),
			tookIn: Math.max(0, int(me.took_in)),
			postsToday: Math.max(0, int(me.posts_today)),
			shelfToday: Math.max(0, int(me.shelf_today)),
			holdings,
			offers: compact(arr(me.offers).map(toMarketOffer)),
		},
		board: compact(arr(raw.board).map(toCard)),
		tape: compact(arr(raw.tape).map(toMarketTrade)),
		notices: compact(
			arr(raw.notices).map((n) => {
				const o = obj(n);
				const id = numOrNull(o.id);
				if (id == null || !NOTICE_KINDS.includes(o.kind as NoticeKind)) return null;
				return { id, kind: o.kind as NoticeKind, offer: toMarketOffer(o.offer), trade: toMarketTrade(o.trade) };
			}),
		),
		friends: compact(
			arr(raw.friends).map((f) => {
				const o = obj(f);
				const id = strOrNull(o.id);
				return id ? { id, name: str(o.name) || "a friend", pigId: strOrNull(o.pig_id) } : null;
			}),
		),
		yesterday: yFind
			? { findId: yFind, sets: int(y.sets), lo: num(y.lo, 0), hi: num(y.hi, 0) }
			: null,
	};
}

export function toMarketFindView(raw: Raw): MarketFindView {
	const today = obj(raw.today);
	return {
		findId: findOrNull(raw.find_id) ?? "river_pebble",
		tick: int(raw.tick, 0),
		hist: toPoints(raw.hist),
		marks: compact(
			arr(raw.marks).map((m) =>
				Array.isArray(m) && typeof m[0] === "number" && KINDS.includes(m[1] as TradeKind) && typeof m[2] === "number"
					? { t: m[0], kind: m[1] as TradeKind, price: m[2] }
					: null,
			),
		),
		recent: compact(arr(raw.recent).map(toMarketTrade)),
		today: {
			counterBuys: int(today.counter_buys),
			counterSells: int(today.counter_sells),
			pigSales: int(today.pig_sales),
			swaps: int(today.swaps),
			prints: int(today.prints),
		},
	};
}

// ── Derived reads ────────────────────────────────────────────────────────────

export const EMPTY_HOLDING: Holding = Object.freeze({ held: 0, paid: 0, paidUnits: 0, onOffer: 0 }) as Holding;

export function holdingOf(state: MarketState, id: SatchelFindId): Holding {
	return state.me.holdings[id] ?? EMPTY_HOLDING;
}

export function setsOf(h: Holding, size: number): { sets: number; spare: number } {
	return { sets: Math.floor(h.held / size), spare: h.held % size };
}

export function findOf(state: MarketState, id: SatchelFindId): MarketFind | null {
	return state.finds.find((f) => f.id === id) ?? null;
}

/** The board as previewList reads it. */
export function previewBoard(board: readonly BoardCard[]): PreviewOffer[] {
	return board.filter((c) => c.source !== "bullion").map((c) => ({
		id: c.id,
		side: c.side,
		findId: c.findId,
		price: c.price,
		posterId: c.poster.id,
		payable: c.side !== "buy" || c.posterCoinOk !== false,
	}));
}

/** The cheapest for-sale listing and the best payable wanted ad for a find. */
export function boardBest(board: readonly BoardCard[], id: SatchelFindId): { sale: BoardCard | null; wanted: BoardCard | null } {
	let sale: BoardCard | null = null;
	let wanted: BoardCard | null = null;
	for (const c of board) {
		if (c.findId !== id || c.price == null) continue;
		if (c.side === "sell" && (!sale || c.price < (sale.price as number) || (c.price === sale.price && c.id < sale.id))) sale = c;
		if (c.side === "buy" && c.posterCoinOk !== false && (!wanted || c.price > (wanted.price as number) || (c.price === wanted.price && c.id < wanted.id))) wanted = c;
	}
	return { sale, wanted };
}

/** Has this pig had its share of Bullion's daily shelf today? */
export function shelfDone(state: Pick<MarketState, "me" | "tuning">): boolean {
	const per = state.tuning.bullionBoard.perPig;
	return per != null && state.me.shelfToday >= per;
}

/** The listings this pig could take now: Bullion's shelf drops out once the
 *  pig has had its share today (his cards stay on the board, asleep). */
export function takeableBoard(state: Pick<MarketState, "me" | "tuning" | "board">): BoardCard[] {
	return shelfDone(state) ? state.board.filter((c) => c.source !== "bullion") : state.board;
}

/** A pig's name as a sentence wants it: "you", "Maya", "a pig". */
export function pigName(p: MarketPig | null | undefined): string {
	if (!p) return "a pig";
	if (p.kind === "bullion") return "Bullion";
	if (p.you) return "you";
	return p.name ?? "a pig";
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export type MarketStateResult =
	| { ok: true; state: MarketState }
	/** `closed`: the switch is off (with your own listings, so you can take them down). */
	| { ok: false; reason: string; closed: MarketClosed | null };

export async function fetchMarketState(): Promise<MarketStateResult> {
	const r = await rpcAction<Raw>("market_state");
	if (!r.ok) return { ok: false, reason: r.reason, closed: r.reason === "closed" ? toMarketClosed(r as Raw) : null };
	return { ok: true, state: toMarketState(r) };
}

export async function fetchMarketFind(id: SatchelFindId): Promise<RpcResult<{ view: MarketFindView }>> {
	const r = await rpcAction<Raw>("market_find", { p_find: id });
	if (!r.ok) return r as RpcResult<{ view: MarketFindView }>;
	return { ok: true, view: toMarketFindView(r) };
}

/** A write's answer: the trade (when one happened), the listing (when one was
 *  pinned), and the refusal's numbers. */
export type MarketOutcome =
	| {
			ok: true;
			replay: boolean;
			filled: boolean;
			via: "pig" | "counter" | null;
			trade: MarketTrade | null;
			offer: MarketOffer | null;
			coin: number | null;
	  }
	| {
			ok: false;
			/** price_moved · not_enough_tickles · not_a_set · too_many_offers ·
			 *  too_many_today · not_found · own_offer · lapsed · not_enough ·
			 *  not_a_friend · bad_price · bad_want · counter_limit · shelf_limit · closed ·
			 *  network · no_data · timeout (the last three: no answer came back,
			 *  see isIndefinite) … */
			reason: string;
			now: number | null;
			ready: number | null;
			needed: number | null;
			held: number | null;
			setSize: number | null;
			/** shelf_limit: Bullion's shelf sets one pig may buy a day. */
			limit?: number | null;
	  };

export function toMarketOutcome(r: RpcResult<Raw>): MarketOutcome {
	const o = r as Raw;
	if (!r.ok) {
		return {
			ok: false,
			reason: r.reason,
			now: numOrNull(o.now),
			ready: numOrNull(o.ready),
			needed: numOrNull(o.needed),
			held: numOrNull(o.held),
			setSize: numOrNull(o.set_size),
			limit: numOrNull(o.limit),
		};
	}
	const trade = toMarketTrade(o.trade);
	return {
		ok: true,
		replay: o.replay === true,
		filled: o.filled === true || (o.filled == null && trade != null),
		via: o.via === "pig" || o.via === "counter" ? o.via : null,
		trade,
		offer: toMarketOffer(o.offer),
		coin: numOrNull(o.coin),
	};
}

// ── A lost answer ────────────────────────────────────────────────────────────
// A write that never heard back (the connection dropped, the answer was empty,
// or it ran past its timeout) MAY have traded on the server. Its nonce stays
// with that exact target until a definite answer arrives, so the retry, even
// after closing and reopening the sheet, replays the original instead of
// trading twice. A definite answer (ok, or any refusal the server gave) frees
// it: the next trade on that target is a new trade with a fresh nonce.

const INDEFINITE: ReadonlySet<string> = new Set(["network", "no_data", "timeout"]);

/** Did this answer fail to come back (so the write may or may not have happened)? */
export function isIndefinite(res: { ok: boolean; reason?: string | null }): boolean {
	return !res.ok && INDEFINITE.has(res.reason ?? "");
}

/** The outcome a write wears when it runs past its timeout. */
export const MARKET_TIMED_OUT: Extract<MarketOutcome, { ok: false }> = Object.freeze({
	ok: false as const,
	reason: "timeout",
	now: null,
	ready: null,
	needed: null,
	held: null,
	setSize: null,
});

/** One exact trade: the same find, side and price (or listing and limit). */
export type MarketWriteTarget =
	| { via: "counter"; findId: SatchelFindId; side: "buy" | "sell"; limit: number | null }
	| { via: "take"; offerId: number; limit: number | null }
	| { via: "post"; spec: PostSpec };

export function marketWriteKey(t: MarketWriteTarget): string {
	const v = (x: unknown) => (x == null ? "-" : String(x));
	if (t.via === "counter") return `counter:${t.findId}:${t.side}:${v(t.limit)}`;
	if (t.via === "take") return `take:${t.offerId}:${v(t.limit)}`;
	const s = t.spec;
	return s.side === "swap"
		? `post:swap:${s.findId}:${v(s.wantFindId)}:${v(s.wantQty)}:${v(s.targetId)}`
		: `post:${s.side}:${s.findId}:${v(s.price)}:${v(s.targetId)}`;
}

export interface MarketNonceBook {
	/** The nonce for this exact target: the one still waiting on an answer
	 *  (in flight, or lost), else a fresh one. */
	nonceFor: (key: string) => string;
	/** A write for `key` answered. A definite answer frees its nonce; a lost
	 *  one keeps it (and marks the target lost). */
	settle: (key: string, res: { ok: boolean; reason?: string | null }) => void;
	/** This target's last write never heard back. */
	isLost: (key: string) => boolean;
}

export function createNonceBook(mint: () => string = newMarketNonce): MarketNonceBook {
	const open = new Map<string, string>();
	const lost = new Set<string>();
	return {
		nonceFor(key) {
			const had = open.get(key);
			if (had) return had;
			const n = mint();
			open.set(key, n);
			return n;
		},
		settle(key, res) {
			if (isIndefinite(res)) {
				if (open.has(key)) lost.add(key);
				return;
			}
			open.delete(key);
			lost.delete(key);
		},
		isLost: (key) => lost.has(key),
	};
}

/** `p`, or `fallback` once `ms` pass (or if `p` rejects). `p` keeps running:
 *  a caller that still wants its late answer holds on to `p` itself. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
	return new Promise<T>((resolve) => {
		const t = setTimeout(() => resolve(fallback), ms);
		p.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			() => {
				clearTimeout(t);
				resolve(fallback);
			},
		);
	});
}

export async function marketCounter(
	findId: SatchelFindId,
	side: "buy" | "sell",
	limit: number | null,
	nonce: string,
): Promise<MarketOutcome> {
	return toMarketOutcome(
		await rpcAction<Raw>("market_counter", { p_find: findId, p_side: side, p_limit: limit, p_nonce: nonce }),
	);
}

export interface PostSpec {
	side: MarketSide;
	findId: SatchelFindId;
	/** Per set (sell / buy). */
	price?: number | null;
	wantFindId?: SatchelFindId | null;
	wantQty?: number | null;
	/** One friend, or null for everyone. */
	targetId?: string | null;
}

export async function marketPost(spec: PostSpec, nonce: string): Promise<MarketOutcome> {
	return toMarketOutcome(
		await rpcAction<Raw>("market_post", {
			p_side: spec.side,
			p_find: spec.findId,
			p_price: spec.side === "swap" ? null : (spec.price ?? null),
			p_want_find: spec.side === "swap" ? (spec.wantFindId ?? null) : null,
			p_want_qty: spec.side === "swap" ? (spec.wantQty ?? null) : null,
			p_target: spec.targetId ?? null,
			p_nonce: nonce,
		}),
	);
}

export async function marketTake(offerId: number, limit: number | null, nonce: string): Promise<MarketOutcome> {
	return toMarketOutcome(await rpcAction<Raw>("market_take", { p_offer_id: offerId, p_limit: limit, p_nonce: nonce }));
}

export async function marketCancel(offerId: number): Promise<{ ok: boolean; reason: string | null }> {
	const r = await rpcAction<Raw>("market_cancel", { p_offer_id: offerId });
	return r.ok ? { ok: true, reason: null } : { ok: false, reason: r.reason };
}

export interface MarketPing {
	open: boolean;
	/** Notices waiting to be handed over (your listings filled, crossed …). */
	notices: number;
	/** Open listings a friend sent to just you. */
	forYou: number;
	/** Your own open listings. */
	listings: number;
}

/** The Barn fan's peek: read-only, never hands a notice over. */
export async function fetchMarketPing(): Promise<MarketPing | null> {
	const r = await rpcAction<Raw>("market_ping");
	if (!r.ok) return null;
	const o = r as Raw;
	return {
		open: o.open !== false,
		notices: Math.max(0, int(o.notices)),
		forYou: Math.max(0, int(o.for_you)),
		listings: Math.max(0, int(o.listings)),
	};
}

/** The fan row's hand line. */
export function marketFanLine(p: MarketPing, newHere = false): string {
	if (p.forYou > 0) return p.forYou === 1 ? "an offer for you" : `${p.forYou} offers for you`;
	if (p.notices > 0) return p.notices === 1 ? "news on your listing" : `news on ${p.notices} listings`;
	// Until this device has been through Bullion's three cards.
	if (newHere) return "new here? · buy, sell, swap";
	if (p.listings > 0) return p.listings === 1 ? "one listing pinned up" : `${p.listings} listings pinned up`;
	return "buy, sell, swap";
}
