// Where a link into the Shop lands (the hero fitting room, 2026-09-17; the
// shop-IA pass, same day).
//
// The Closet stopped being a room that morning: the store is ONE scroll — the
// fitting room, the doorway, the shelves, the counter, then the catalog — so
// every link that used to open the wardrobe now lands on the store and scrolls
// down to it instead of switching views. By the afternoon the Pen had stopped
// being a room too: it is a pushed route (`app/pen.tsx`), like Furnish, so a
// link asking for it is a REDIRECT rather than a view. The Shop tab has one
// room now, and this is the only place that knows it.
//
// Pure, so the param→state rule is testable without mounting the screen.

export interface ShopNavTarget {
	/** Leave the Shop tab entirely for this route. */
	redirect?: "/pen";
	/** Whether to scroll the store's one list down to the catalog. */
	scrollToCloset: boolean;
}

/**
 * Resolve `?view=`/`?filter=` into where the Shop should land. Returns `null`
 * when the params say nothing — the caller leaves its state alone (and must
 * not clear the URL, or an unrelated param would be eaten).
 *
 * The rules, in one place:
 *   · `view=wardrobe` / `view=browse` → the store, scrolled to the catalog
 *     (both are old links to rooms that no longer exist);
 *   · `filter=prestige` → the catalog, scrolled to. The prestige-only filter
 *     was cut 2026-09-22 (the regalia's one home is the rank sheet), so an old
 *     link simply opens the closet;
 *   · `view=pen` → out to `/pen` (Account and the paywall still send it);
 *   · `view=daily` / `view=trough` → the store's front (the Trough moved to
 *     the Barn button's fan, 2026-09-17).
 */
export function resolveShopParams(params: {
	view?: string;
	filter?: string;
}): ShopNavTarget | null {
	const prestige = params.filter === "prestige";
	switch (params.view) {
		case "wardrobe":
		case "browse":
			return { scrollToCloset: true };
		case "pen":
			return { redirect: "/pen", scrollToCloset: false };
		case "daily":
		case "trough":
			return { scrollToCloset: false };
		default:
			if (prestige) return { scrollToCloset: true };
			return null;
	}
}
