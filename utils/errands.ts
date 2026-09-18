// The Errand — the read path, the write RPCs, and the pure rules.
//
// Brief: docs/pig-errands-build-brief.md; spec: docs/pig-errands-spec.md.
// Server-authoritative: the roll, the return time, the board and the day's
// gate all live on the server; this module is the typed wrapper plus the
// pure rules a screen needs synchronously (how long a pig is out, what the
// ticket says, what the homecoming card reads).
//
// Tuning is a config cell (utils/configCell): the binary boots on
// constants/errands' ERRAND_TUNING and refreshes from
// app_setting('errand_tuning'). FAIL-SOFT — an un-pushed server, a missing
// row or a malformed value keeps whatever we have, per FIELD, never per
// document.
//
// DEPENDENCY NOTE: the rpc chain is require()d lazily INSIDE the async paths
// (the config cell's own idiom), never at module scope, so the pure rules
// stay native-free for the unit suites.
import {
	ERRAND_TUNING,
	ERRAND_STATUSES,
	type ErrandPigStats,
	type ErrandPip,
	type ErrandRow,
	type ErrandStatus,
	type ErrandTuning,
} from "@/constants/errands";
import { isSatchelFindId, satchelFind, type SatchelFindId } from "@/constants/satchel";
import { createConfigCell } from "@/utils/configCell";
import { PIG_IDS, isPigId, pigDefinition, pigPronouns, type PigId } from "@/utils/pigs";
import type { RewardItem } from "@/utils/rewardReturn";
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

function pip(v: unknown, fallback: ErrandPip): ErrandPip {
	return v === 1 || v === 2 || v === 3 ? v : fallback;
}

function weights(v: unknown, fallback: [number, number, number]): [number, number, number] {
	if (!Array.isArray(v) || v.length !== 3) return fallback;
	const out = v.map((w, i) => num(w, fallback[i], 0, 1000));
	return [out[0], out[1], out[2]];
}

function pigStats(raw: unknown, fallback: ErrandPigStats): ErrandPigStats {
	const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
	const family = r.family;
	return {
		nose: pip(r.nose, fallback.nose),
		trot: pip(r.trot, fallback.trot),
		pockets: pip(r.pockets, fallback.pockets),
		glint: pip(r.glint, fallback.glint),
		family:
			family === "brook" || family === "hedge" || family === "meadow" || family === "lost"
				? family
				: null,
	};
}

/**
 * Sanitize the SERVER row ({enabled, duration_hours, target_odds_pts,
 * nose_bonus_pts, anything_weights, distracted_pts, board_cap, pigs}) into an
 * ErrandTuning. Fills per-field defaults rather than rejecting, so a partial
 * row still installs the fields it has.
 */
export function sanitizeErrandTuning(raw: unknown): ErrandTuning | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const d = (r.duration_hours ?? {}) as Record<string, unknown>;
	const o = (r.target_odds_pts ?? {}) as Record<string, unknown>;
	const n = (r.nose_bonus_pts ?? {}) as Record<string, unknown>;
	const a = (r.anything_weights ?? {}) as Record<string, unknown>;
	const p = (r.pigs ?? {}) as Record<string, unknown>;
	const F = ERRAND_TUNING;
	const pigs = {} as Record<PigId, ErrandPigStats>;
	for (const id of PIG_IDS) pigs[id] = pigStats(p[id], F.pigs[id]);
	return {
		enabled: r.enabled === true,
		durationHours: {
			trot1: num(d.trot1, F.durationHours.trot1, 0.05, 48),
			trot2: num(d.trot2, F.durationHours.trot2, 0.05, 48),
			trot3: num(d.trot3, F.durationHours.trot3, 0.05, 48),
		},
		targetOddsPts: {
			common: num(o.common, F.targetOddsPts.common, 0, 100),
			uncommon: num(o.uncommon, F.targetOddsPts.uncommon, 0, 100),
			rare: num(o.rare, F.targetOddsPts.rare, 0, 100),
		},
		noseBonusPts: {
			1: num(n["1"], F.noseBonusPts[1], 0, 100),
			2: num(n["2"], F.noseBonusPts[2], 0, 100),
			3: num(n["3"], F.noseBonusPts[3], 0, 100),
		},
		anythingWeights: {
			glint1: weights(a.glint1, F.anythingWeights.glint1),
			glint2: weights(a.glint2, F.anythingWeights.glint2),
			glint3: weights(a.glint3, F.anythingWeights.glint3),
		},
		distractedPts: num(r.distracted_pts, F.distractedPts, 0, 100),
		boardCap: Math.floor(num(r.board_cap, F.boardCap, 1, 50)),
		pigs,
	};
}

function tuningEquals(a: ErrandTuning, b: ErrandTuning): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

const tuningCell = createConfigCell<ErrandTuning>({
	key: "errand_tuning",
	fallback: ERRAND_TUNING,
	sanitize: sanitizeErrandTuning,
	equals: tuningEquals,
	cacheKey: "errand_tuning_cache_v1",
	minRefreshMs: 5000,
});

/** The live tuning — the compiled fallback until the server answers. */
export const errandTuning = tuningCell.read;
export const refreshErrandTuning = tuningCell.refresh;
export const hydrateErrandTuning = tuningCell.hydrate;
export const ensureErrandTuningFresh = tuningCell.ensureFresh;
export const __applyErrandTuningForTests = tuningCell.apply;
export const __resetErrandTuningForTests = tuningCell.resetForTests;

// ── Pure rules ───────────────────────────────────────────────────────────────

const HOUR_MS = 3_600_000;

/** How long this pig is out, from its trot pip. */
export function errandDurationMs(pig: PigId, tuning: ErrandTuning = errandTuning()): number {
	const trot = tuning.pigs[pig]?.trot ?? 2;
	const hours =
		trot === 1 ? tuning.durationHours.trot1 : trot === 3 ? tuning.durationHours.trot3 : tuning.durationHours.trot2;
	return Math.round(hours * HOUR_MS);
}

/** "about 4h" / "about 30 min" — the hand line on the card before a send. */
export function errandDurationLabel(pig: PigId, tuning: ErrandTuning = errandTuning()): string {
	const ms = errandDurationMs(pig, tuning);
	const mins = Math.round(ms / 60_000);
	if (mins < 60) return `about ${mins} min`;
	const hours = ms / HOUR_MS;
	const whole = Math.round(hours * 2) / 2;
	return `about ${Number.isInteger(whole) ? whole : whole.toFixed(1)}h`;
}

/** "7:40pm" in the device's local time. Hand-rolled so the unit suites need
 *  no Intl data; the app never needs seconds. */
export function clockLabel(at: Date): string {
	const h24 = at.getHours();
	const m = at.getMinutes();
	const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
	return `${h12}:${m < 10 ? "0" : ""}${m}${h24 < 12 ? "am" : "pm"}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "back by 7:40pm" today, "back tomorrow 7:40am" across midnight, "back
 *  Friday 7:40am" further out, "back any minute" once the time has passed. */
export function backByLabel(endsAtIso: string, nowMs = Date.now()): string {
	const t = Date.parse(endsAtIso);
	if (!Number.isFinite(t)) return "back soon";
	if (t <= nowMs) return "back any minute";
	const end = new Date(t);
	const now = new Date(nowMs);
	if (sameLocalDay(end, now)) return `back by ${clockLabel(end)}`;
	const tomorrow = new Date(nowMs + 24 * HOUR_MS);
	if (sameLocalDay(end, tomorrow)) return `back tomorrow ${clockLabel(end)}`;
	const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][end.getDay()];
	return `back ${day} ${clockLabel(end)}`;
}

/** The short form for a fan row or a friend row: "back by 7:40pm" → "back ~7:40pm". */
export function backAboutLabel(endsAtIso: string, nowMs = Date.now()): string {
	return backByLabel(endsAtIso, nowMs).replace(/^back (by|tomorrow) /, "back ~");
}

/** Who the errand is for, as the ticket and the pin read it. */
export interface ErrandFriend {
	/** The friend's name, as the Friends list shows it. */
	name: string;
	/** Their pig's name ("Pickles"). */
	pigName?: string;
}

/** "looking for a blue feather · for Maya's Pickles" / "looking for a blue
 *  feather · for your pig" / "looking for anything". */
export function targetLabel(row: Pick<ErrandRow, "target_find_id" | "for_user_id">, friend?: ErrandFriend | null): string {
	if (!row.target_find_id) return "looking for anything";
	const thing = satchelFind(row.target_find_id)?.withArticle ?? "a find";
	if (row.for_user_id) {
		const who = friend ? (friend.pigName ? `${friend.name}'s ${friend.pigName}` : friend.name) : "a friend";
		return `looking for ${thing} · for ${who}`;
	}
	return `looking for ${thing} · for your pig`;
}

/** The pin's top line on the corkboard: "for Maya" / "for you" / "anything". */
export function pinKicker(row: Pick<ErrandRow, "target_find_id" | "for_user_id">, friend?: ErrandFriend | null): string {
	if (!row.target_find_id) return "anything";
	if (row.for_user_id) return `for ${friend?.name ?? "a friend"}`;
	return "for you";
}

/** The finds a return carries, as RewardReturn draws them. Ids this build
 *  cannot name are dropped: a blank coin is worse than one fewer. */
export function resultItems(row: Pick<ErrandRow, "result_find_ids">): RewardItem[] {
	return row.result_find_ids.filter(isSatchelFindId).map((id) => ({
		id,
		kind: "find" as const,
		name: satchelFind(id)?.name ?? id,
	}));
}

export interface HomecomingCopy {
	kicker: string;
	title: string;
	body: string;
	primaryLabel: string;
	secondaryLabel?: string;
	grantedLine: string;
	/** What the primary does. */
	primaryAction: "give" | "keep";
}

/**
 * The homecoming card's words for the four returns: a friend's wish found, an
 * "anything" found, empty hands, and a friend-targeted errand that came back
 * with something else (distracted — it can only be kept, the wish is not
 * filled). `bagCount` is the bag AFTER a keep, when the caller knows it.
 */
export function homecomingCopy(
	row: Pick<ErrandRow, "pig_id" | "target_find_id" | "for_user_id" | "result_find_ids">,
	friend?: ErrandFriend | null,
	bagCount?: number | null,
	tickles = 3,
): HomecomingCopy {
	const pig = pigDefinition(row.pig_id);
	const p = pigPronouns(row.pig_id);
	const items = resultItems(row);
	const first = items[0] ? satchelFind(items[0].id) : null;
	const friendName = friend?.name ?? "your friend";
	const friendPig = friend?.pigName ? `${friendName}'s ${friend.pigName}` : `${friendName}'s pig`;
	const inBag = bagCount == null ? "in your Satchel" : `in your Satchel · ${bagCount} ${bagCount === 1 ? "find" : "finds"}`;

	if (items.length === 0) {
		const target = row.target_find_id ? satchelFind(row.target_find_id)?.name : null;
		const wish = row.for_user_id ? ` ${friendName}'s wish is still open.` : "";
		return {
			kicker: "back",
			title: "muddy trotters",
			body: target
				? `${p.Subject} looked everywhere; the ${target} wasn't there today.${wish}`
				: `${p.Subject} looked everywhere and found nothing worth carrying.`,
			primaryLabel: `Ok, ${pig.name}`,
			grantedLine: "tomorrow is a new day",
			primaryAction: "keep",
		};
	}

	const hitTarget = row.target_find_id != null && items[0]?.id === row.target_find_id;
	const found = first?.withArticle ?? "something";

	if (row.for_user_id && hitTarget) {
		const tick = tickles > 0 ? ` · you both got ${tickles} tickles` : "";
		return {
			kicker: `${p.subject} found it`,
			title: found,
			body: `the one ${friendPig} is hoping for`,
			primaryLabel: `Give it to ${friendName}`,
			secondaryLabel: "Keep it",
			grantedLine: `${friendPig} has its ${first?.name ?? "find"}${tick}`,
			primaryAction: "give",
		};
	}

	if (row.for_user_id && !hitTarget) {
		const target = row.target_find_id ? satchelFind(row.target_find_id)?.name ?? "it" : "it";
		return {
			kicker: `${p.subject} got distracted`,
			title: found,
			body: `not the ${target} ${friendPig} wanted — but ${p.subject} wasn't coming home empty. Yours to keep.`,
			primaryLabel: "Keep it",
			grantedLine: inBag,
			primaryAction: "keep",
		};
	}

	return {
		kicker: `${p.subject} found ${hitTarget ? "it" : "something"}`,
		title: found,
		body: "yours to keep or give",
		primaryLabel: "Keep it",
		grantedLine: inBag,
		primaryAction: "keep",
	};
}

/** The refused give / keep, in the house voice, for a toast. */
export function errandRefusalCopy(reason: string, friendName?: string): { title: string; text?: string } {
	const theirs = friendName ? `${friendName}'s pig` : "Their pig";
	switch (reason) {
		case "wish_moved":
			return { title: `${theirs} changed its mind`, text: "Someone beat him to it. Keep it instead?" };
		case "host_bag_full":
			return { title: "Their Satchel is full", text: "Keep it, or try again later." };
		case "bag_full":
			return { title: "Your Satchel is full", text: "Make room and come back." };
		case "not_back":
			return { title: "That pig isn't back yet." };
		case "already_claimed":
			return { title: "That one's already been looked at." };
		case "errands_disabled":
			return { title: "The Pen's gate is shut for now." };
		case "pig_resting":
			return { title: "That pig is resting", text: "A Slop Club companion needs an active membership to go out." };
		case "pig_already_out":
			return { title: "That pig is already out looking." };
		case "errand_used_today":
			return { title: "One errand a day", text: "That pig's been out today. Try tomorrow." };
		case "not_friends":
			return { title: "You two aren't friends yet." };
		case "target_not_wished":
			return { title: "Their pig changed its mind", text: "Pick again from what it wants now." };
		case "not_out":
			return { title: "That pig isn't out." };
		case "not_authenticated":
			return { title: "Sign back in first." };
		default:
			return { title: "That didn't land — try again in a moment." };
	}
}

// ── Shapes ───────────────────────────────────────────────────────────────────

function toStatus(v: unknown): ErrandStatus | null {
	return typeof v === "string" && (ERRAND_STATUSES as readonly string[]).includes(v) ? (v as ErrandStatus) : null;
}

/** Narrow a raw errand row; null for a row this build cannot draw. */
export function toErrandRow(raw: unknown): ErrandRow | null {
	if (!raw || typeof raw !== "object") return null;
	const o = raw as Record<string, unknown>;
	const id = typeof o.id === "number" ? o.id : Number(o.id);
	const status = toStatus(o.status);
	if (!Number.isFinite(id) || !isPigId(o.pig_id) || !status) return null;
	const wishNo = typeof o.for_wish_no === "number" ? o.for_wish_no : Number(o.for_wish_no);
	return {
		id,
		pig_id: o.pig_id,
		target_find_id: isSatchelFindId(o.target_find_id) ? o.target_find_id : null,
		for_user_id: typeof o.for_user_id === "string" ? o.for_user_id : null,
		for_wish_no: Number.isFinite(wishNo) ? wishNo : null,
		started_at: typeof o.started_at === "string" ? o.started_at : "",
		ends_at: typeof o.ends_at === "string" ? o.ends_at : "",
		status,
		result_find_ids: (Array.isArray(o.result_find_ids) ? o.result_find_ids : []).filter(isSatchelFindId),
	};
}

export interface ErrandState {
	/** The feature flag, as the server answers it for THIS caller (is_test
	 *  accounts see it on while the flag is off). */
	enabled: boolean;
	/** The active pig's id while it is out, else null. */
	away: PigId | null;
	/** Which pigs have spent today's errand (an out row counts). */
	today: Partial<Record<PigId, boolean>>;
	out: ErrandRow[];
	/** Returns waiting on the corkboard, newest first, at most `boardCap`. */
	board: ErrandRow[];
	/** The server's tuning row, when it sent one. */
	tuning: ErrandTuning | null;
}

export const EMPTY_ERRANDS: ErrandState = Object.freeze({
	enabled: false,
	away: null,
	today: {},
	out: [],
	board: [],
	tuning: null,
}) as ErrandState;

export function toErrandState(raw: Record<string, unknown>): ErrandState {
	const today: Partial<Record<PigId, boolean>> = {};
	const t = (raw.today && typeof raw.today === "object" ? raw.today : {}) as Record<string, unknown>;
	for (const id of PIG_IDS) if (t[id] === true) today[id] = true;
	const rows = (v: unknown) => (Array.isArray(v) ? v : []).map(toErrandRow).filter((r): r is ErrandRow => r != null);
	return {
		enabled: raw.enabled === true,
		away: isPigId(raw.away) ? raw.away : null,
		today,
		out: rows(raw.out),
		board: rows(raw.board),
		tuning: sanitizeErrandTuning(raw.tuning),
	};
}

// ── RPCs ─────────────────────────────────────────────────────────────────────

export async function fetchPigErrands(): Promise<RpcResult<{ state: ErrandState }>> {
	const r = await rpcAction<Record<string, unknown>>("pig_errands");
	if (!r.ok) return { ok: false, reason: r.reason };
	const state = toErrandState(r as Record<string, unknown>);
	if (state.tuning) tuningCell.apply(state.tuning);
	return { ok: true, state };
}

export type SendOutcome =
	| { ok: true; replay: boolean; errand: ErrandRow }
	| { ok: false; reason: string; wish: SatchelFindId | null };

export async function sendPig(
	pig: PigId,
	target: SatchelFindId | null,
	forUserId: string | null,
	nonce: string,
): Promise<SendOutcome> {
	const r = await rpcAction<Record<string, unknown>>("send_pig", {
		p_pig: pig,
		p_target: target,
		p_for: forUserId,
		p_nonce: nonce,
	});
	if (!r.ok) {
		return { ok: false, reason: r.reason, wish: isSatchelFindId(r.wish) ? r.wish : null };
	}
	const errand = toErrandRow(r.errand);
	if (!errand) return { ok: false, reason: "no_data", wish: null };
	return { ok: true, replay: r.replay === true, errand };
}

export type ClaimOutcome =
	| { ok: true; replay: boolean; action: "give" | "keep"; status: ErrandStatus; tickles: number; bagCount: number | null }
	| { ok: false; reason: string; wish: SatchelFindId | null; status: ErrandStatus | null };

export async function claimErrand(id: number, action: "give" | "keep", nonce: string): Promise<ClaimOutcome> {
	const r = await rpcAction<Record<string, unknown>>("claim_errand", {
		p_id: id,
		p_action: action,
		p_nonce: nonce,
	});
	if (!r.ok) {
		return {
			ok: false,
			reason: r.reason,
			wish: isSatchelFindId(r.wish) ? r.wish : null,
			status: toStatus(r.status),
		};
	}
	return {
		ok: true,
		replay: r.replay === true,
		action: r.action === "give" ? "give" : "keep",
		status: toStatus(r.status) ?? (action === "give" ? "given" : "kept"),
		tickles: typeof r.tickles === "number" ? r.tickles : 0,
		bagCount: typeof r.bag_count === "number" ? r.bag_count : null,
	};
}

export async function recallPig(id: number): Promise<RpcResult<{ errand: ErrandRow }>> {
	const r = await rpcAction<Record<string, unknown>>("recall_pig", { p_id: id });
	if (!r.ok) return { ok: false, reason: r.reason };
	const errand = toErrandRow(r.errand);
	if (!errand) return { ok: false, reason: "no_data" };
	return { ok: true, errand };
}

/** DEV ONLY — bring an out pig home now (server-gated on is_test). */
export async function devSummonReturn(id: number): Promise<RpcResult<{ errand: ErrandRow }>> {
	const r = await rpcAction<Record<string, unknown>>("dev_summon_return", { p_id: id });
	if (!r.ok) return { ok: false, reason: r.reason };
	const errand = toErrandRow(r.errand);
	if (!errand) return { ok: false, reason: "no_data" };
	return { ok: true, errand };
}

/** A host's away pig, for the visit screen: {away, ends_at} or nulls. */
export async function fetchHostPigAway(
	hostId: string,
): Promise<{ away: PigId | null; endsAt: string | null }> {
	const r = await rpcAction<{ away?: unknown; ends_at?: unknown }>("host_pig_away", { p_host: hostId });
	if (!r.ok) return { away: null, endsAt: null };
	return {
		away: isPigId(r.away) ? r.away : null,
		endsAt: typeof r.ends_at === "string" ? r.ends_at : null,
	};
}

/** A v4-SHAPED uuid from Math.random — an idempotency key, not a secret
 *  (the same reasoning as utils/satchel's newSwapNonce). */
export function newErrandNonce(): string {
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
