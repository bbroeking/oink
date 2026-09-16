// The storefront's shelves (Storefront build 2, SKILL.md 2026-09-16). Pure
// helpers for two things the scene needs that the catalog does not carry:
//
//   · today's drop laid out THREE to a shelf, the way the board draws it — a
//     short last shelf is a short shelf, never a dangling card (that rule is
//     the 2-col grid's, which still trims to an even count for its own sake);
//   · the members' shelf under the Slop Club sign: a daily pick of a few
//     members-only pieces, chosen the way daily_shop() chooses the drop —
//     deterministically from the id and the UTC date, so every member in a
//     sounder sees the same shelf and it rolls with the shelves at midnight.

/** Lay items out in shelves of `perShelf`; the last shelf may run short. */
export function chunkShelves<T>(
	items: readonly T[],
	perShelf: number,
): T[][] {
	const size = Math.max(1, Math.floor(perShelf));
	const shelves: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		shelves.push(items.slice(i, i + size));
	}
	return shelves;
}

/** The UTC calendar day the shop rolls on, as `YYYY-MM-DD`. */
export function dropDateKey(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

// FNV-1a over the UTF-16 code units — small, stable across platforms, and
// spread well enough that neighbouring ids land on different days. It is a
// shelf order, not a security property.
function hash32(input: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h >>> 0;
}

/**
 * Pick `count` items for a given day. Stable for the (items, dateKey) pair:
 * the same ids come back in the same order on every device that day, and a
 * different set tomorrow. Fewer items than `count` returns them all.
 */
export function dailyPick<T extends { id: string }>(
	items: readonly T[],
	dateKey: string,
	count: number,
): T[] {
	if (count <= 0 || items.length === 0) return [];
	return items
		.map((item) => ({ item, key: hash32(`${item.id}|${dateKey}`) }))
		.sort((a, b) => a.key - b.key || a.item.id.localeCompare(b.item.id))
		.slice(0, count)
		.map((entry) => entry.item);
}
