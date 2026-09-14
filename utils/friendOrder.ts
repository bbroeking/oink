// The Friends list's one order.
//
// The list used to sort inline with a bare `localeCompare`, which put "pig10"
// before "pig2" (string order), "Beta" before "alpha" (code-point order), and
// left two friends with the same username free to swap places between renders —
// `Array.prototype.sort` is stable, but the ARRAY it sorts arrives from a
// PostgREST `in (...)` read whose row order is not promised, so "stable" only
// means "stable given the same input". A comparator with no ties has no such
// caveat, which is why the tie-breakers below run all the way down to the id.
//
// Pure, and exported on its own so the rules can be tested without mounting a
// list. `FriendsList`'s `sorted` memo is its only caller. (2026-09-14)

/**
 * The fields the order reads. Deliberately structural rather than `Profile`:
 * the comparator wants a name, a code and an id, and nothing else.
 */
export interface OrderableFriend {
	id: string;
	username?: string | null;
	discriminator?: string | null;
}

/**
 * Case- and accent-insensitive, with digit runs compared as numbers — so
 * "alpha" < "Beta" (letters, not code points) and "pig2" < "pig10" (two, not
 * the character "2"). `undefined` locale is the device's own.
 */
const COLLATION: Intl.CollatorOptions = {
	sensitivity: "base",
	numeric: true,
};

/** The name the list shows, trimmed — a name is not its whitespace. */
function nameOf(friend: OrderableFriend): string {
	return (friend.username ?? "").trim();
}

function codeOf(friend: OrderableFriend): string {
	return (friend.discriminator ?? "").trim();
}

/**
 * Favourites first; then by name; then by friend code; then by id. Every step
 * is total, so the last one can never tie and the list can never reorder itself
 * under the thumb.
 *
 * A friend with no username sorts LAST within its group: there is nothing to
 * alphabetise, and a blank line at the top reads as a broken list.
 */
export function compareFriends(
	a: OrderableFriend,
	b: OrderableFriend,
	favorites: ReadonlySet<string>
): number {
	const pinnedA = favorites.has(a.id) ? 0 : 1;
	const pinnedB = favorites.has(b.id) ? 0 : 1;
	if (pinnedA !== pinnedB) return pinnedA - pinnedB;

	const nameA = nameOf(a);
	const nameB = nameOf(b);
	if (!nameA !== !nameB) return nameA ? -1 : 1;
	if (nameA && nameB) {
		const byName = nameA.localeCompare(nameB, undefined, COLLATION);
		if (byName !== 0) return byName;
	}

	const codeA = codeOf(a);
	const codeB = codeOf(b);
	const byCode = codeA.localeCompare(codeB, undefined, COLLATION);
	if (byCode !== 0) return byCode;

	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The whole list in that order — a copy, never the caller's array. */
export function sortFriends<T extends OrderableFriend>(
	friends: readonly T[],
	favorites: ReadonlySet<string>
): T[] {
	return [...friends].sort((a, b) => compareFriends(a, b, favorites));
}
