// The Satchel — the read path, the write RPCs, and the pure rules.
//
// Spec: docs/satchel-spec.md. Server-authoritative (20260915010000_satchel.sql):
// the bag, every pig's wish, the shelf and the delivery count all live on the
// server; this module is the typed wrapper plus the pure rules a screen needs
// synchronously (does this find match that wish, what does the receipt say).
//
// Tuning is a config cell (utils/configCell): the binary boots on
// constants/satchel's SATCHEL_TUNING and refreshes from
// app_setting('satchel_tuning'). FAIL-SOFT — an un-pushed server, a missing
// row or a malformed value keeps whatever we have.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily INSIDE the async paths
// (the config cell's own idiom), never at module scope. utils/snoutDeep — a
// pure reducer every dig test imports — reads satchelReceiptLine() from here,
// and a module-scope supabase import would drag native modules into every
// one of those suites.
import {
	SATCHEL_TUNING,
	isSatchelFindId,
	satchelFind,
	type SatchelFindId,
	type SatchelTuning,
} from "@/constants/satchel";
import { createConfigCell } from "@/utils/configCell";
import type { RpcResult } from "@/utils/rpc";

function rpcAction<T = Record<string, never>>(
	name: string,
	params?: Record<string, unknown>,
): Promise<RpcResult<T>> {
	const { rpcAction: call } = require("@/utils/rpc") as typeof import("@/utils/rpc");
	return call<T>(name, params);
}

// ── Tuning cell ──────────────────────────────────────────────────────────────

function num(v: unknown, fallback: number, lo: number, hi: number): number {
	const n = typeof v === "number" && Number.isFinite(v) ? v : NaN;
	if (Number.isNaN(n)) return fallback;
	return Math.min(hi, Math.max(lo, n));
}

/**
 * Sanitize the SERVER row ({cap, find_odds, wish_reroll_hours, tickles,
 * keepsake_thresholds}) into a SatchelTuning. Fills per-field defaults rather
 * than rejecting, so a partial row still installs the fields it has.
 */
export function sanitizeSatchelTuning(raw: unknown): SatchelTuning | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const odds = (r.find_odds ?? {}) as Record<string, unknown>;
	const thresholds = Array.isArray(r.keepsake_thresholds)
		? r.keepsake_thresholds
				.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t > 0)
				.map((t) => Math.floor(t))
				.sort((a, b) => a - b)
		: [];
	return {
		cap: Math.floor(num(r.cap, SATCHEL_TUNING.cap, 1, 24)),
		findOdds: {
			none: num(odds.none, SATCHEL_TUNING.findOdds.none, 0, 1),
			one: num(odds.one, SATCHEL_TUNING.findOdds.one, 0, 1),
			two: num(odds.two, SATCHEL_TUNING.findOdds.two, 0, 1),
		},
		wishRerollHours: num(r.wish_reroll_hours, SATCHEL_TUNING.wishRerollHours, 1, 24 * 14),
		tickles: Math.floor(num(r.tickles, SATCHEL_TUNING.tickles, 0, 50)),
		keepsakeThresholds: thresholds.length ? thresholds : [...SATCHEL_TUNING.keepsakeThresholds],
	};
}

function tuningEquals(a: SatchelTuning, b: SatchelTuning): boolean {
	return (
		a.cap === b.cap &&
		a.findOdds.none === b.findOdds.none &&
		a.findOdds.one === b.findOdds.one &&
		a.findOdds.two === b.findOdds.two &&
		a.wishRerollHours === b.wishRerollHours &&
		a.tickles === b.tickles &&
		a.keepsakeThresholds.length === b.keepsakeThresholds.length &&
		a.keepsakeThresholds.every((t, i) => t === b.keepsakeThresholds[i])
	);
}

const tuningCell = createConfigCell<SatchelTuning>({
	key: "satchel_tuning",
	fallback: SATCHEL_TUNING,
	sanitize: sanitizeSatchelTuning,
	equals: tuningEquals,
	cacheKey: "satchel_tuning_cache_v1",
	minRefreshMs: 5000,
});

/** The live tuning — the compiled fallback until the server answers. */
export const satchelTuning = tuningCell.read;
export const refreshSatchelTuning = tuningCell.refresh;
export const hydrateSatchelTuning = tuningCell.hydrate;
export const ensureSatchelTuningFresh = tuningCell.ensureFresh;
export const __resetSatchelTuningForTests = tuningCell.resetForTests;

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface SatchelItem {
	id: number;
	find_id: SatchelFindId;
}

export interface PigWish {
	find_id: SatchelFindId;
	wish_no: number;
	rolled_at?: string;
	expires_at: string;
	owner_rerolled?: boolean;
}

export interface FriendWish extends PigWish {
	target_id: string;
	fulfilled_by_me: boolean;
}

export interface SatchelState {
	cap: number;
	items: SatchelItem[];
	/** Every find the player has ever carried — the silhouettes lift for these. */
	met: SatchelFindId[];
	wish: PigWish | null;
	shelf: { find_id: SatchelFindId; count: number }[];
	deliveries: number;
	keepsakes: number[];
}

export const EMPTY_SATCHEL: SatchelState = Object.freeze({
	cap: SATCHEL_TUNING.cap,
	items: [],
	met: [],
	wish: null,
	shelf: [],
	deliveries: 0,
	keepsakes: [],
}) as SatchelState;

function toWish(raw: unknown): PigWish | null {
	if (!raw || typeof raw !== "object") return null;
	const w = raw as Record<string, unknown>;
	if (!isSatchelFindId(w.find_id)) return null;
	const wishNo = typeof w.wish_no === "number" ? w.wish_no : Number(w.wish_no);
	if (!Number.isFinite(wishNo)) return null;
	return {
		find_id: w.find_id,
		wish_no: wishNo,
		rolled_at: typeof w.rolled_at === "string" ? w.rolled_at : undefined,
		expires_at: typeof w.expires_at === "string" ? w.expires_at : "",
		owner_rerolled: w.owner_rerolled === true,
	};
}

/** Narrow a raw my_satchel() payload; unknown find ids (a catalog ahead of
 *  this build) are dropped rather than drawn blank. */
export function toSatchelState(raw: Record<string, unknown>): SatchelState {
	const items: SatchelItem[] = [];
	for (const it of Array.isArray(raw.items) ? raw.items : []) {
		const o = it as Record<string, unknown>;
		const id = typeof o.id === "number" ? o.id : Number(o.id);
		if (Number.isFinite(id) && isSatchelFindId(o.find_id)) items.push({ id, find_id: o.find_id });
	}
	const shelf: SatchelState["shelf"] = [];
	for (const s of Array.isArray(raw.shelf) ? raw.shelf : []) {
		const o = s as Record<string, unknown>;
		if (isSatchelFindId(o.find_id) && typeof o.count === "number" && o.count > 0) {
			shelf.push({ find_id: o.find_id, count: o.count });
		}
	}
	return {
		cap: typeof raw.cap === "number" && raw.cap > 0 ? Math.floor(raw.cap) : satchelTuning().cap,
		items,
		met: (Array.isArray(raw.met) ? raw.met : []).filter(isSatchelFindId),
		wish: toWish(raw.wish),
		shelf,
		deliveries: typeof raw.deliveries === "number" ? raw.deliveries : 0,
		keepsakes: (Array.isArray(raw.keepsakes) ? raw.keepsakes : []).filter(
			(k): k is number => typeof k === "number",
		),
	};
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export async function fetchMySatchel(): Promise<RpcResult<{ state: SatchelState }>> {
	const r = await rpcAction<Record<string, unknown>>("my_satchel");
	if (!r.ok) return r as RpcResult<{ state: SatchelState }>;
	return { ok: true, state: toSatchelState(r as Record<string, unknown>) };
}

export async function tossFind(itemId: number): Promise<RpcResult<{ count: number }>> {
	return rpcAction<{ count: number }>("toss_find", { p_item_id: itemId });
}

export async function rerollMyWish(): Promise<RpcResult<{ wish: PigWish | null }>> {
	const r = await rpcAction<{ wish?: unknown }>("reroll_my_wish");
	if (!r.ok) return { ok: false, reason: r.reason, wish: toWish(r.wish) };
	return { ok: true, wish: toWish(r.wish) };
}

export async function fetchFriendWishes(
	targetIds: string[],
): Promise<RpcResult<{ wishes: FriendWish[] }>> {
	if (targetIds.length === 0) return { ok: true, wishes: [] };
	const r = await rpcAction<{ wishes?: unknown }>("friend_wishes", { p_targets: targetIds });
	if (!r.ok) return { ok: false, reason: r.reason };
	const wishes: FriendWish[] = [];
	for (const raw of Array.isArray(r.wishes) ? r.wishes : []) {
		const w = toWish(raw);
		const o = raw as Record<string, unknown>;
		if (w && typeof o.target_id === "string") {
			wishes.push({ ...w, target_id: o.target_id, fulfilled_by_me: o.fulfilled_by_me === true });
		}
	}
	return { ok: true, wishes };
}

export interface FulfilResult {
	find_id: SatchelFindId;
	tickles: number;
	giver_tickled: number;
	host_tickled: number;
	deliveries: number;
	/** The threshold a keepsake was just granted at, or null. */
	keepsake: number | null;
	next_wish: PigWish | null;
	bag_count: number;
}

export async function fulfilPigWish(
	hostId: string,
	itemId: number,
): Promise<RpcResult<FulfilResult>> {
	const r = await rpcAction<Record<string, unknown>>("fulfil_pig_wish", {
		p_host: hostId,
		p_item_id: itemId,
	});
	if (!r.ok) {
		return { ok: false, reason: r.reason, next_wish: toWish(r.wish) };
	}
	return {
		ok: true,
		find_id: isSatchelFindId(r.find_id) ? r.find_id : SATCHEL_FIND_FALLBACK,
		tickles: typeof r.tickles === "number" ? r.tickles : satchelTuning().tickles,
		giver_tickled: typeof r.giver_tickled === "number" ? r.giver_tickled : 0,
		host_tickled: typeof r.host_tickled === "number" ? r.host_tickled : 0,
		deliveries: typeof r.deliveries === "number" ? r.deliveries : 0,
		keepsake: typeof r.keepsake === "number" ? r.keepsake : null,
		next_wish: toWish(r.next_wish),
		bag_count: typeof r.bag_count === "number" ? r.bag_count : 0,
	};
}
const SATCHEL_FIND_FALLBACK: SatchelFindId = "river_pebble";

// ── Pure rules ───────────────────────────────────────────────────────────────

/** The bag items that would fulfil this wish, in bag order. */
export function matchingItems(items: SatchelItem[], wish: PigWish | null): SatchelItem[] {
	if (!wish) return [];
	return items.filter((it) => it.find_id === wish.find_id);
}

/** Whether a wish is still open for THIS visitor to fulfil. */
export function wishOpenForMe(wish: FriendWish | PigWish | null): boolean {
	if (!wish) return false;
	if ("fulfilled_by_me" in wish && wish.fulfilled_by_me) return false;
	return true;
}

/** A friend row's wish mark: true when the bag holds what the pig wants and
 *  this visitor has not already brought it. */
export function bagHasWishFor(items: SatchelItem[], wish: FriendWish | undefined): boolean {
	if (!wish || wish.fulfilled_by_me) return false;
	return items.some((it) => it.find_id === wish.find_id);
}

/** The receipt's satchel line. `found`/`lost` are catalog ids the server
 *  rolled; `lost` is what stayed in the mud because the bag was full. */
export function satchelReceiptLine(
	satchel: { found?: unknown; lost?: unknown; count?: unknown; cap?: unknown } | null | undefined,
): string | null {
	if (!satchel) return null;
	const found = (Array.isArray(satchel.found) ? satchel.found : []).filter(isSatchelFindId);
	const lost = (Array.isArray(satchel.lost) ? satchel.lost : []).filter(isSatchelFindId);
	if (found.length === 0 && lost.length === 0) return null;
	const name = (id: SatchelFindId) => satchelFind(id)?.withArticle ?? id;
	if (found.length === 0) {
		return `Satchel's full — ${joinNames(lost.map(name))} stayed in the mud.`;
	}
	const heavier = `your Satchel got heavier: ${joinNames(found.map(name))}.`;
	if (lost.length === 0) return heavier;
	return `${heavier} Satchel's full — ${joinNames(lost.map(name))} stayed in the mud.`;
}

function joinNames(names: string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The while-away / receipt sentence for a delivery — the HOST's gain first;
 *  the giver is never "earning". */
export function deliveryLine(hostName: string, findId: SatchelFindId, tickles: number): string {
	const f = satchelFind(findId);
	const thing = f ? `the ${f.name}` : "the thing";
	const her = `${hostName}'s pig got ${thing} it was hoping for`;
	return tickles > 0 ? `${her} — you both got ${tickles} tickles.` : `${her}.`;
}

/** Hours until a wish rerolls on its own, floored at 0. */
export function wishHoursLeft(wish: PigWish | null, nowMs = Date.now()): number {
	if (!wish?.expires_at) return 0;
	const t = Date.parse(wish.expires_at);
	if (!Number.isFinite(t)) return 0;
	return Math.max(0, Math.ceil((t - nowMs) / 3_600_000));
}
