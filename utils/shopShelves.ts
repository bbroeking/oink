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

/**
 * What a tap on a storefront card does (2026-09-17). Owned items dress the pig
 * straight from the shelf — the Closet grid's rule, brought back to the
 * store: a worn item comes off, an owned one goes on. Anything not owned
 * opens the sheet, where buying lives. (A long press on an owned card still
 * opens the sheet, to see it on the pig before deciding.)
 */
export type CardTap =
	| { kind: "equip"; itemId: string | null }
	| { kind: "preview" };

export function cardTapAction(
	itemId: string,
	state: { owned: boolean; active: boolean },
): CardTap {
	if (!state.owned) return { kind: "preview" };
	return { kind: "equip", itemId: state.active ? null : itemId };
}

/**
 * ONE card grammar (the shop-IA pass, 2026-09-17). The shelf coaster said
 * price / Wear / Wearing while the closet tile said Owned / Not owned, and the
 * same Wizard Hat was a price upstairs and a padlock downstairs. Every card in
 * the store — coaster, fallback grid card, closet tile — asks this function
 * what its foot says, so the answer can only ever be one answer.
 *
 * The rule, top to bottom: what she is wearing, what is yours, what was earned
 * rather than sold, and otherwise the price — on the sun when it is a price you
 * can pay today, muted when it is not today's shelf, not affordable, or not
 * yours to buy.
 */
export type CardTag =
	| { kind: "wearing" }
	| { kind: "wear" }
	| { kind: "seasonPass" }
	| { kind: "price"; cost: number; tone: "sun" | "muted" };

/** What a card knows about itself when it asks for its tag. */
export interface CardState {
	owned: boolean;
	active: boolean;
	/** On a shelf today — the only day it can be bought. */
	inDrop: boolean;
	canAfford: boolean;
	/** Members-only, and the player is not a member. */
	locked: boolean;
}

export function cardTag(
	item: { cost: number; members_only?: boolean | null },
	state: CardState,
): CardTag {
	if (state.active) return { kind: "wearing" };
	if (state.owned) return { kind: "wear" };
	if (item.cost <= 0) return { kind: "seasonPass" };
	return {
		kind: "price",
		cost: item.cost,
		tone:
			state.inDrop && state.canAfford && !state.locked ? "sun" : "muted",
	};
}

/**
 * The same tag as the `Tag` capsule wants to be drawn — tone, word, mark. The
 * grammar decides in `cardTag`; this says it. Kept beside it so a card never
 * re-derives "sage means worn" for itself (the three sites used to, and drifted).
 */
export function cardTagFace(tag: CardTag): {
	tone: "sage" | "sun" | "muted";
	label: string;
	icon?: "check";
	coin?: boolean;
} {
	switch (tag.kind) {
		case "wearing":
			return { tone: "sage", label: "Wearing", icon: "check" };
		case "wear":
			return { tone: "sun", label: "Wear" };
		case "seasonPass":
			return { tone: "muted", label: "Season pass" };
		case "price":
			return { tone: tag.tone, label: tag.cost.toLocaleString(), coin: true };
	}
}

/**
 * The badge on a card's shoulder, and the whole of what it means: a check for
 * something that is yours, the gold lock for a members' piece you cannot buy
 * yet. An unowned item you simply have not bought wears nothing — the lock used
 * to mean "members" upstairs and "not yours" downstairs (defect 4).
 */
export function cardBadge(
	state: Pick<CardState, "owned" | "locked">,
): "check" | "lock" | null {
	if (state.owned) return "check";
	return state.locked ? "lock" : null;
}

/** Counts in words to ten, the house voice for a count in a kicker line (the
 *  Friends allowance line's rule, 2026-09-14); a numeral past ten. */
const COUNT_WORDS = [
	"no",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
] as const;

export function countWord(n: number): string {
	const whole = Math.max(0, Math.floor(n));
	return whole < COUNT_WORDS.length ? COUNT_WORDS[whole] : whole.toLocaleString();
}

/** Can a tap buy this item right now: on a shelf today, not yours, paid for
 *  in snouts you have, and not a members' piece behind the lock. The same
 *  test that paints a card's price on the sun (`cardTag`), as a yes/no. */
export function buyableNow(
	item: { id: string; cost: number; members_only?: boolean | null },
	state: {
		owned: ReadonlySet<string>;
		buyableIds: ReadonlySet<string>;
		counter: number;
		isVip: boolean;
	},
): boolean {
	return (
		item.cost > 0 &&
		state.buyableIds.has(item.id) &&
		!state.owned.has(item.id) &&
		state.counter >= item.cost &&
		!(item.members_only && !state.isVip)
	);
}

/**
 * The Shop crown's kicker (polish pass, 2026-10-04). "★ THE SHOP" over a title
 * that says "Shop" said nothing; the page's one kicker pill now carries the
 * day. It counts the sun price tags on the page (what a tap can buy right
 * now), falls back to the size of today's shelves when nothing is in reach,
 * and never leaves the crown on a placeholder that reads as a fact: loading
 * and failure each say what they are. On a small phone, where no shelf is
 * above the fold, it is the line that says the store has stock below.
 */
export function shopKicker(state: {
	loading: boolean;
	failed: boolean;
	/** Items on today's shelves: the drop plus the members' shelf. */
	shelfCount: number;
	/** How many of those (and the counter's) a tap can buy right now. */
	inReach: number;
	/** A seasonal stall is open at the top of the wall (B1, 2026-10-29). */
	stallOpen?: boolean;
}): string {
	if (state.shelfCount === 0) {
		if (state.failed) return "can't reach the shelves";
		return state.loading ? "stocking the shelves" : "sold out till sunrise";
	}
	const day =
		state.inReach > 0
			? `${countWord(state.inReach)} you can buy today`
			: `${countWord(state.shelfCount)} on the shelves today`;
	return state.stallOpen ? `a stall is open · ${day}` : day;
}
