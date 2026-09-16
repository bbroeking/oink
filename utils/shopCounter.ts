// The sounder at the counter — the Shop's second inventory (Storefront build 2,
// SKILL.md 2026-09-16). `sounder_counter_buys()` lists what the caller's
// crewmates put on today; this module parses that payload defensively (the
// race parsers' habit: a malformed row is dropped, never thrown), resolves each
// row against the catalog the screen already holds, and derives the id-set
// that makes those items buyable alongside today's drop.
//
// A counter item is bought through the SAME buy_hat RPC as a shelf item;
// buy_hat gates on price / pass_exclusive / members_only / ownership only, so
// the client's "today only" gate is what widens: `buyableIds(daily, counter)`.

import type { HatRow } from "@/constants/hats";
import { isPigId, type PigId } from "@/utils/pigs";

/** One crewmate's acquisition today, as the server reports it. */
export interface CounterBuyRow {
	userId: string;
	username: string | null;
	pigId: PigId;
	hatId: string;
	acquiredAt: string;
}

/** A counter row joined to its catalog item — what the screen renders. */
export interface CounterBuy extends CounterBuyRow {
	item: HatRow;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Parse the raw RPC payload. Anything that is not an array of well-formed
 * rows collapses to `[]` — an unpushed function (PGRST202 → null), a numeric
 * stub, or a row missing its ids all read as "nobody at the counter".
 */
export function parseCounterBuys(data: unknown): CounterBuyRow[] {
	if (!Array.isArray(data)) return [];
	const rows: CounterBuyRow[] = [];
	for (const raw of data) {
		if (!isRecord(raw)) continue;
		const userId = raw.user_id;
		const hatId = raw.hat_id;
		if (typeof userId !== "string" || !userId) continue;
		if (typeof hatId !== "string" || !hatId) continue;
		const username = typeof raw.username === "string" ? raw.username : null;
		const pigId = isPigId(raw.pig_id) ? raw.pig_id : "rosie";
		const acquiredAt =
			typeof raw.acquired_at === "string" ? raw.acquired_at : "";
		rows.push({ userId, username, pigId, hatId, acquiredAt });
	}
	return rows;
}

/**
 * Join counter rows to the catalog. A row whose item the catalog does not
 * carry (hidden category, unknown id) is dropped: the counter only shows what
 * the shop can actually sell. Order is the server's (newest first).
 */
export function resolveCounterBuys(
	rows: readonly CounterBuyRow[],
	catalog: readonly HatRow[],
): CounterBuy[] {
	const byId = new Map(catalog.map((h) => [h.id, h] as const));
	const out: CounterBuy[] = [];
	for (const row of rows) {
		const item = byId.get(row.hatId);
		if (!item) continue;
		out.push({ ...row, item });
	}
	return out;
}

/** Today's drop ∪ the counter: the ids the screen will let you buy. */
export function buyableIds(
	daily: readonly HatRow[],
	counter: readonly CounterBuy[],
): Set<string> {
	const ids = new Set(daily.map((d) => d.id));
	for (const buy of counter) ids.add(buy.item.id);
	return ids;
}

/** The hand tag on a counter card: "Jen · Top Hat". */
export function counterTag(buy: Pick<CounterBuy, "username" | "item">): string {
	return `${buy.username ?? "a sounder pig"} · ${buy.item.name}`;
}
