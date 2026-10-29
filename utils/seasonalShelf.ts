// The seasonal stall's data (Pop-up Stall, 2026-10-29; SKILL.md "a set is
// data"). A stall is a `seasonal_shelves` row plus the hats tagged with its
// key, read through seasonal_shelf() (20261029220000). This module parses that
// payload defensively (an unpushed function, a null, a half row all read as
// "no stall") and holds the pure rules the stall's screens share: which pieces
// can be drawn, the New · Back · Yours lanes, and the buy confirm's words.

import {
	HAT_IMAGES,
	HAT_THUMBNAILS_256,
	HIDDEN_CATEGORIES,
	type HatRow,
	type Rarity,
} from "@/constants/hats";
import { leavingLabel } from "@/utils/shelfCountdown";

export type ShelfLane = "new" | "returning";

/** A piece on the stall: a catalog row plus its lane and whether it is yours. */
export interface ShelfItem extends HatRow {
	shelf_lane: ShelfLane;
	owned: boolean;
}

/** The shelf's look, from its `theme` jsonb. Every key optional. */
export interface ShelfTheme {
	/** The boarded sign's promise, e.g. "back next October". */
	back_line?: string;
	/** The piece Rosie wears on the card and the stall's stage. */
	hero_item_id?: string;
}

export interface SeasonalShelf {
	key: string;
	title: string;
	kicker: string | null;
	opensAt: string | null;
	closesAt: string | null;
	/** The server's phase at fetch time; the client re-derives it per tick. */
	status: "open" | "boarded";
	backdropHatId: string | null;
	theme: ShelfTheme;
	/** Server clock at fetch, for the skew correction. */
	serverNow: string | null;
	items: ShelfItem[];
}

function str(v: unknown): string | null {
	return typeof v === "string" && v.length > 0 ? v : null;
}

function parseItem(raw: unknown): ShelfItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id);
	const lane = r.shelf_lane;
	if (!id || (lane !== "new" && lane !== "returning")) return null;
	return {
		id,
		name: str(r.name) ?? id,
		cost: typeof r.cost === "number" ? r.cost : 0,
		display_order: typeof r.display_order === "number" ? r.display_order : 0,
		emoji: str(r.emoji),
		image_path: str(r.image_path),
		category: str(r.category) ?? undefined,
		rarity: (str(r.rarity) as Rarity | null) ?? undefined,
		description: str(r.description),
		pass_exclusive: r.pass_exclusive === true,
		members_only: r.members_only === true,
		shelf_lane: lane,
		owned: r.owned === true,
	};
}

/**
 * seasonal_shelf()'s jsonb → a stall, or null for "no stall today" (no open
 * or boarded shelf, an old server without the function, a malformed row).
 */
export function parseSeasonalShelf(raw: unknown): SeasonalShelf | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const r = raw as Record<string, unknown>;
	const key = str(r.key);
	const title = str(r.title);
	const status = r.status;
	if (!key || !title || (status !== "open" && status !== "boarded")) return null;
	const theme =
		r.theme && typeof r.theme === "object" && !Array.isArray(r.theme)
			? (r.theme as ShelfTheme)
			: {};
	const items = Array.isArray(r.items)
		? r.items.map(parseItem).filter((i): i is ShelfItem => i !== null)
		: [];
	return {
		key,
		title,
		kicker: str(r.kicker),
		opensAt: str(r.opens_at),
		closesAt: str(r.closes_at),
		status,
		backdropHatId: str(r.backdrop_hat_id),
		theme,
		serverNow: str(r.now),
		items,
	};
}

/**
 * The pieces the stall can draw: art registered in this binary and a slot the
 * renderer places (the catalog's `filterPlaceable` rule). A piece whose art
 * ships in a later build stays off the stall rather than drawing a blank card.
 */
export function drawableShelfItems<T extends Pick<HatRow, "id" | "category">>(
	items: readonly T[],
	art: Record<string, unknown> = HAT_IMAGES,
	thumbs: Partial<Record<string, unknown>> = HAT_THUMBNAILS_256,
): T[] {
	return items.filter(
		(i) =>
			(!!art[i.id] || !!thumbs[i.id]) &&
			!(i.category && HIDDEN_CATEGORIES.has(i.category)),
	);
}

export type StallLane = "new" | "back" | "yours";

/** New · Back · Yours: the stall's three segments, and their counts. */
export function stallLanes(
	items: readonly ShelfItem[],
	owned: ReadonlySet<string>,
): Record<StallLane, ShelfItem[]> {
	const isOwned = (i: ShelfItem) => i.owned || owned.has(i.id);
	return {
		new: items.filter((i) => i.shelf_lane === "new"),
		back: items.filter((i) => i.shelf_lane === "returning"),
		yours: items.filter(isOwned),
	};
}

/**
 * The buy confirm (B4): a kicker naming the price and the window, a question,
 * and what is left after. One ConfirmDialog, the stall's only new decision.
 */
export function stallBuyCopy(
	item: { name: string; cost: number },
	balance: number,
	closesAt: string | null,
	now: number,
): { kicker: string; title: string; body: string; confirmLabel: string } {
	const price = `${item.cost.toLocaleString()} snouts`;
	const leaves = leavingLabel(closesAt, now, "leaves");
	const left = Math.max(0, balance - item.cost).toLocaleString();
	return {
		kicker: leaves ? `${price} · ${leaves}` : price,
		title: `Buy the ${item.name}?`,
		body: `It goes in your closet for keeps. You will have ${left} snouts left.`,
		confirmLabel: `Buy · ${item.cost.toLocaleString()}`,
	};
}

/** The piece Rosie wears on the card: the theme's pick, else the first new
 *  piece with art, else nothing. */
export function heroItem(
	shelf: Pick<SeasonalShelf, "items" | "theme">,
	drawable: readonly ShelfItem[],
): ShelfItem | null {
	const pick = shelf.theme.hero_item_id;
	if (pick) {
		const found = drawable.find((i) => i.id === pick);
		if (found) return found;
	}
	return (
		drawable.find((i) => i.shelf_lane === "new" && i.category !== "background") ??
		null
	);
}
