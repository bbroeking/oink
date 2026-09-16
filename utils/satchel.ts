// The Satchel — the read path, the write RPCs, and the pure rules.
//
// Spec: docs/satchel-spec.md, plus the swap's wire contract in
// docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md §12.
// Server-authoritative: the bag, every pig's wish, the offer options and the
// swap ledger all live on the server; this module is the typed wrapper plus
// the pure rules a screen needs synchronously (does this find match that
// wish, what does the receipt say, what does a refusal read as).
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
		options: Math.floor(num(r.options, SATCHEL_TUNING.options, 0, 6)),
		paidSwapsPerPairPerDay: Math.floor(
			num(r.paid_swaps_per_pair_per_day, SATCHEL_TUNING.paidSwapsPerPairPerDay, 0, 100),
		),
		paidSwapsPerPigPerDay: Math.floor(
			num(r.paid_swaps_per_pig_per_day, SATCHEL_TUNING.paidSwapsPerPigPerDay, 0, 500),
		),
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
		a.options === b.options &&
		a.paidSwapsPerPairPerDay === b.paidSwapsPerPairPerDay &&
		a.paidSwapsPerPigPerDay === b.paidSwapsPerPigPerDay &&
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

/** Where a bag row came from. `migrated_shelf` is the retired shelf, folded
 *  into the bag by the swaps migration. Absent on a pre-swaps server. */
export type SatchelItemSource = "dig" | "swap" | "gift" | "migrated_shelf";

const SOURCES: ReadonlySet<string> = new Set<SatchelItemSource>([
	"dig",
	"swap",
	"gift",
	"migrated_shelf",
]);

function toSource(v: unknown): SatchelItemSource | undefined {
	return typeof v === "string" && SOURCES.has(v) ? (v as SatchelItemSource) : undefined;
}

/** True for a find that arrived from a friend rather than out of the mud. */
export function cameFromAFriend(source: SatchelItemSource | undefined): boolean {
	return source === "swap" || source === "gift" || source === "migrated_shelf";
}

export interface SatchelItem {
	id: number;
	find_id: SatchelFindId;
	source?: SatchelItemSource;
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
	/** Up to `options` finds the host's bag can spare, chosen by the server
	 *  (`_wish_options`): a pure function of (wish_no, the host's LIVE bag) — the
	 *  same three on every read until the host's bag changes, which is what
	 *  `option_gone` answers. Empty = gift only. */
	options: SatchelFindId[];
	/** The per-pair-per-UTC-day gate is already spent with this friend. */
	swapped_today: boolean;
}

export interface SatchelState {
	cap: number;
	items: SatchelItem[];
	/** Every find the player has ever carried — the silhouettes lift for these. */
	met: SatchelFindId[];
	wish: PigWish | null;
	/** Always empty since the swaps migration folded the shelf into the bag;
	 *  kept one build so a pre-swaps server still parses. */
	shelf: { find_id: SatchelFindId; count: number }[];
	/** @deprecated the old name for `swapsGiven`; kept one build. */
	deliveries: number;
	swapsGiven: number;
	swapsReceived: number;
	/** Swaps left today that still pay tickles, or null when unknown. */
	paidLeftToday: number | null;
	keepsakes: number[];
}

export const EMPTY_SATCHEL: SatchelState = Object.freeze({
	cap: SATCHEL_TUNING.cap,
	items: [],
	met: [],
	wish: null,
	shelf: [],
	deliveries: 0,
	swapsGiven: 0,
	swapsReceived: 0,
	paidLeftToday: null,
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
/** Narrow a raw bag array (`my_satchel().items`, `swap_with_host().bag`). */
export function toBag(raw: unknown): SatchelItem[] {
	const items: SatchelItem[] = [];
	for (const it of Array.isArray(raw) ? raw : []) {
		const o = it as Record<string, unknown>;
		const id = typeof o?.id === "number" ? o.id : Number(o?.id);
		if (Number.isFinite(id) && isSatchelFindId(o.find_id)) {
			const source = toSource(o.source);
			items.push(source ? { id, find_id: o.find_id, source } : { id, find_id: o.find_id });
		}
	}
	return items;
}

export function toSatchelState(raw: Record<string, unknown>): SatchelState {
	const items = toBag(raw.items);
	const shelf: SatchelState["shelf"] = [];
	for (const s of Array.isArray(raw.shelf) ? raw.shelf : []) {
		const o = s as Record<string, unknown>;
		if (isSatchelFindId(o.find_id) && typeof o.count === "number" && o.count > 0) {
			shelf.push({ find_id: o.find_id, count: o.count });
		}
	}
	const given =
		typeof raw.swaps_given === "number"
			? raw.swaps_given
			: typeof raw.deliveries === "number"
				? raw.deliveries
				: 0;
	return {
		cap: typeof raw.cap === "number" && raw.cap > 0 ? Math.floor(raw.cap) : satchelTuning().cap,
		items,
		met: (Array.isArray(raw.met) ? raw.met : []).filter(isSatchelFindId),
		wish: toWish(raw.wish),
		shelf,
		// `swaps_given` is the swaps migration's name; `deliveries` is what a
		// pre-swaps server answers. Both fields stay populated for one build.
		deliveries: given,
		swapsGiven: given,
		swapsReceived: typeof raw.swaps_received === "number" ? raw.swaps_received : 0,
		paidLeftToday: typeof raw.paid_left_today === "number" ? raw.paid_left_today : null,
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
			wishes.push({
				...w,
				target_id: o.target_id,
				fulfilled_by_me: o.fulfilled_by_me === true,
				options: toOptions(o.options),
				swapped_today: o.swapped_today === true,
			});
		}
	}
	return { ok: true, wishes };
}

/** The host's offer list. Unknown ids (a catalog ahead of this build) are
 *  dropped rather than drawn blank — the same rule the bag follows. */
export function toOptions(raw: unknown): SatchelFindId[] {
	return (Array.isArray(raw) ? raw : []).filter(isSatchelFindId);
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

/** @deprecated The visit calls `swap_with_host` now (a gift is `p_take_find`
 *  null). Kept one build so the RPC's server-side alias has a client that
 *  still type-checks against it — delete with the T7 follow-up migration. */
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

// ── The swap ─────────────────────────────────────────────────────────────────
// Wire contract: docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md
// §12. `swap_with_host` is the ONE write the visit makes — a gift is the same
// call with `p_take_find` null. Every refusal is a named reason; nothing here
// raises, and a server without the RPC answers `network`, which the visit
// treats like any other "that didn't land".

/** A v4-SHAPED uuid from Math.random. There is no uuid library and no native
 *  crypto module in this binary, and this is an idempotency key rather than a
 *  secret: the server only asks whether it has seen this string before. */
export function newSwapNonce(): string {
	const hex = "0123456789abcdef";
	let out = "";
	for (let i = 0; i < 36; i++) {
		if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
		else if (i === 14) out += "4";
		else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
		else out += hex[Math.floor(Math.random() * 16)];
	}
	return out;
}

export interface SwapResult {
	/** The server had already recorded this nonce — the same receipt, again. */
	replay: boolean;
	gave_find_id: SatchelFindId;
	/** null = a gift (nothing taken back). */
	took_find_id: SatchelFindId | null;
	tickles: number;
	/** False when a daily paid cap is spent — the swap still happened. */
	paid: boolean;
	giver_tickled: number;
	host_tickled: number;
	swaps_given: number;
	/** The threshold a keepsake was just granted at, or null. */
	keepsake: number | null;
	next_wish: PigWish | null;
	/** The giver's WHOLE bag after the move — never a count to trim by. */
	bag: SatchelItem[];
}

export type SwapOutcome =
	| ({ ok: true } & SwapResult)
	| {
			ok: false;
			reason: string;
			/** The live wish, on `wish_changed` / `already_today` / `wrong_find` /
			 *  `host_bag_full`. */
			wish: PigWish | null;
			/** Fresh options, on `wish_changed` / `wrong_find` / `not_offered` /
			 *  `option_gone`. Null when the answer carried none. */
			options: SatchelFindId[] | null;
	  };

export async function swapWithHost(
	hostId: string,
	itemId: number,
	takeFindId: SatchelFindId | null,
	wishNo: number,
	nonce: string,
): Promise<SwapOutcome> {
	const r = await rpcAction<Record<string, unknown>>("swap_with_host", {
		p_host: hostId,
		p_item_id: itemId,
		p_take_find: takeFindId,
		p_wish_no: wishNo,
		p_nonce: nonce,
	});
	if (!r.ok) {
		return {
			ok: false,
			reason: r.reason,
			wish: toWish(r.wish),
			options: Array.isArray(r.options) ? toOptions(r.options) : null,
		};
	}
	return {
		ok: true,
		replay: r.replay === true,
		gave_find_id: isSatchelFindId(r.gave_find_id) ? r.gave_find_id : SATCHEL_FIND_FALLBACK,
		took_find_id: isSatchelFindId(r.took_find_id) ? r.took_find_id : null,
		tickles: typeof r.tickles === "number" ? r.tickles : 0,
		paid: r.paid !== false,
		giver_tickled: typeof r.giver_tickled === "number" ? r.giver_tickled : 0,
		host_tickled: typeof r.host_tickled === "number" ? r.host_tickled : 0,
		swaps_given: typeof r.swaps_given === "number" ? r.swaps_given : 0,
		keepsake: typeof r.keepsake === "number" ? r.keepsake : null,
		next_wish: toWish(r.next_wish),
		bag: toBag(r.bag),
	};
}

export interface SatchelSwapRow {
	id: number;
	/** Always from the GIVER's point of view: `gave` left their bag. */
	direction: "given" | "received";
	partner_id: string;
	partner_username: string | null;
	partner_discriminator: string | null;
	gave_find_id: SatchelFindId;
	took_find_id: SatchelFindId | null;
	tickles: number;
	created_at: string;
}

/** The last N swaps on both sides, newest first. Fail-soft: a server without
 *  the RPC answers an empty list and the Inbox draws no band. */
export async function fetchMySatchelSwaps(limit = 20): Promise<SatchelSwapRow[]> {
	const r = await rpcAction<{ swaps?: unknown }>("my_satchel_swaps", { p_limit: limit });
	if (!r.ok) return [];
	const out: SatchelSwapRow[] = [];
	for (const raw of Array.isArray(r.swaps) ? r.swaps : []) {
		const o = raw as Record<string, unknown>;
		const id = typeof o?.id === "number" ? o.id : Number(o?.id);
		if (!Number.isFinite(id) || !isSatchelFindId(o.gave_find_id)) continue;
		if (typeof o.partner_id !== "string") continue;
		out.push({
			id,
			direction: o.direction === "received" ? "received" : "given",
			partner_id: o.partner_id,
			partner_username: typeof o.partner_username === "string" ? o.partner_username : null,
			partner_discriminator:
				typeof o.partner_discriminator === "string" ? o.partner_discriminator : null,
			gave_find_id: o.gave_find_id,
			took_find_id: isSatchelFindId(o.took_find_id) ? o.took_find_id : null,
			tickles: typeof o.tickles === "number" ? o.tickles : 0,
			created_at: typeof o.created_at === "string" ? o.created_at : "",
		});
	}
	return out;
}

/** The Board's "N swapped" slice. Tries the swaps RPC, then the one-build
 *  delivery alias, so both a pushed and an un-pushed server answer. */
export async function fetchSatchelSwapsFor(
	targetIds: string[],
): Promise<Record<string, number> | null> {
	if (targetIds.length === 0) return null;
	for (const name of ["satchel_swaps_for", "satchel_deliveries_for"] as const) {
		const r = await rpcAction<{ counts?: unknown }>(name, { p_targets: targetIds });
		if (r.ok && r.counts && typeof r.counts === "object") {
			return r.counts as Record<string, number>;
		}
	}
	return null;
}

// ── Pure rules ───────────────────────────────────────────────────────────────

/** The bag items that would fulfil this wish, in bag order. */
export function matchingItems(items: SatchelItem[], wish: PigWish | null): SatchelItem[] {
	if (!wish) return [];
	return items.filter((it) => it.find_id === wish.find_id);
}

/** Whether a wish is still open for THIS visitor to swap with. The pair's
 *  one-swap-per-UTC-day gate (server `already_today`) closes it too. */
export function wishOpenForMe(wish: FriendWish | PigWish | null): boolean {
	if (!wish) return false;
	if ("swapped_today" in wish && wish.swapped_today) return false;
	if ("fulfilled_by_me" in wish && wish.fulfilled_by_me) return false;
	return true;
}

/** A friend row's wish mark: true when the bag holds what the pig wants and
 *  this visitor has not already swapped with them today. */
export function bagHasWishFor(items: SatchelItem[], wish: FriendWish | undefined): boolean {
	if (!wish || !wishOpenForMe(wish)) return false;
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

/** @deprecated Superseded by `swapLine`; kept one build beside `fulfilPigWish`.
 *  The while-away / receipt sentence for a delivery — the HOST's gain first;
 *  the giver is never "earning". */
export function deliveryLine(hostName: string, findId: SatchelFindId, tickles: number): string {
	const f = satchelFind(findId);
	const thing = f ? `the ${f.name}` : "the thing";
	const her = `${hostName}'s pig got ${thing} it was hoping for`;
	return tickles > 0 ? `${her} — you both got ${tickles} tickles.` : `${her}.`;
}

/** The swap's receipt sentence — the HOST's gain first, then what you took,
 *  then the tickles. The giver is never "earning" (docs/satchel-spec.md); a
 *  gift adds the generous tick, and a pair that has swapped past its daily
 *  paid cap is told plainly rather than shown a zero. */
export function swapLine(
	hostName: string,
	gave: SatchelFindId,
	took: SatchelFindId | null,
	tickles: number,
	paid: boolean,
): string {
	const name = (id: SatchelFindId) => satchelFind(id)?.name ?? "find";
	const her = `${hostName}'s pig got the ${name(gave)} it was hoping for`;
	const half = took ? `${her}; you took the ${name(took)}.` : `${her}; you gave it away.`;
	// Unpaid because a daily cap is spent — not because tickles are tuned to 0
	// (then the swap simply pays nothing, and the line says nothing about it).
	if (satchelTuning().tickles <= 0) return half;
	if (!paid || tickles <= 0) return `${half} (no tickles — you've swapped plenty today)`;
	return took
		? `${half} You both got ${tickles} tickles.`
		: `${half} You both got ${tickles} tickles, and a generous tick.`;
}

/** Every §12 refusal, in the house voice. A refusal is a toast (the ruling of
 *  2026-09-11: refusals are toasts, decisions are ConfirmDialog), so each one
 *  is a one-line title plus at most one sentence. */
export function swapRefusalCopy(
	reason: string,
	hostName?: string,
): { title: string; text?: string } {
	const theirs = hostName ? `${hostName}'s pig` : "Their pig";
	switch (reason) {
		case "wish_changed":
			return { title: "Their pig changed its mind", text: "See the bubble for what it wants now." };
		case "already_today":
			return {
				title: "You two swapped today — come back tomorrow",
				text: "One swap a day keeps the visit worth making.",
			};
		case "option_gone":
			return {
				title: `${theirs} changed its mind about that one`,
				text: "Pick another, or just give it.",
			};
		case "host_bag_full":
			return { title: "Their Satchel is full — try the swap instead", text: "Take one back and it fits." };
		case "wrong_find":
			return { title: "Not what they're hoping for", text: "See the bubble for what it wants now." };
		case "not_in_bag":
			return { title: "That find isn't in your Satchel." };
		case "not_friends":
			return { title: "You two aren't friends yet." };
		case "blocked":
			return { title: "That barn is closed to you." };
		case "invalid_host":
		case "host_not_found":
			return { title: "That barn isn't there any more." };
		case "not_authenticated":
			return { title: "Sign back in to swap." };
		case "bad_nonce":
			return { title: "That didn't land — try again in a moment." };
		case "not_offered":
			// The client renders exactly what friend_wishes returned, so this
			// means the server's rule and ours diverged — a bug, not a state.
			reportSwapBug(`swap_with_host refused not_offered — options diverged`);
			return { title: "That one isn't on offer", text: "Pick another, or just give it." };
		default:
			return { title: "That didn't land — try again in a moment." };
	}
}

/** Report a rule divergence to Sentry through the app's logger. Lazily
 *  required so this module stays native-free for the pure-rule suites (the
 *  same reason the rpc chain is required inside the async paths). */
function reportSwapBug(message: string): void {
	try {
		const { log } = require("@/utils/log") as typeof import("@/utils/log");
		log.error(message);
	} catch {
		// A test environment without the logger must never break the copy.
	}
}

/** Hours until a wish rerolls on its own, floored at 0. */
export function wishHoursLeft(wish: PigWish | null, nowMs = Date.now()): number {
	if (!wish?.expires_at) return 0;
	const t = Date.parse(wish.expires_at);
	if (!Number.isFinite(t)) return 0;
	return Math.max(0, Math.ceil((t - nowMs) / 3_600_000));
}
