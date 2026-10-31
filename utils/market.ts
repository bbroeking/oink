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
	id: string;
	you: boolean;
	/** Named only for you and your friends; "a pig" otherwise. */
	name: string | null;
	pigId: string | null;
	friend: boolean;
}

export interface MarketOffer {
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
	/** counter | crossed | listing | wanted */
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

export type NoticeKind = "filled" | "crossed" | "expired" | "lapsed" | "swapped" | "for_you";

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

const NOTICE_KINDS: readonly NoticeKind[] = ["filled", "crossed", "expired", "lapsed", "swapped", "for_you"];

function compact<T>(xs: (T | null)[]): T[] {
	return xs.filter((x): x is T => x != null);
}

export function toMarketState(raw: Raw): MarketState {
	const me = obj(raw.me);
	const holdings: Partial<Record<SatchelFindId, Holding>> = {};
	for (const [k, v] of Object.entries(obj(me.holdings))) {
		if (!isSatchelFindId(k)) continue;
		const h = obj(v);
		holdings[k] = {
			held: Math.max(0, int(h.held)),
			paid: Math.max(0, int(h.paid)),
			paidUnits: Math.max(0, int(h.paid_units)),
			onOffer: Math.max(0, int(h.on_offer)),
		};
	}
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
	return board.map((c) => ({
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

/** A pig's name as a sentence wants it: "you", "Maya", "a pig". */
export function pigName(p: MarketPig | null | undefined): string {
	if (!p) return "a pig";
	if (p.you) return "you";
	return p.name ?? "a pig";
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export async function fetchMarketState(): Promise<RpcResult<{ state: MarketState }>> {
	const r = await rpcAction<Raw>("market_state");
	if (!r.ok) return r as RpcResult<{ state: MarketState }>;
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
			 *  not_a_friend · bad_price · bad_want · counter_limit · closed · network … */
			reason: string;
			now: number | null;
			ready: number | null;
			needed: number | null;
			held: number | null;
			setSize: number | null;
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
