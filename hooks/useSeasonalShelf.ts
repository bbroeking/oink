// The seasonal stall's server config (Pop-up Stall, 2026-10-29). One read of
// seasonal_shelf() on focus, parsed into a stall or null, plus a minute clock
// so the countdown and the phase (open → boarded → gone) move while the shop
// stays open. Server config over constants: the window, the title and the
// pieces all come from the `seasonal_shelves` row, and the fallback is the
// empty one, no stall, never a compiled date.
//
// The fetch rides the rpc() helper (never rejects): an old server without the
// function, a failed call or a dark shelf all read as no stall, so the store
// itself can never fail on its account.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router/react-navigation";
import { rpc } from "@/utils/rpc";
import {
	drawableShelfItems,
	parseSeasonalShelf,
	type SeasonalShelf,
	type ShelfItem,
} from "@/utils/seasonalShelf";
import { shelfPhase, type ShelfPhase } from "@/utils/shelfCountdown";

/** The clock the countdown reads ticks once a minute. */
const TICK_MS = 60_000;

export interface UseSeasonalShelf {
	/** The stall, or null when none is open or boarded (or the fetch failed). */
	shelf: SeasonalShelf | null;
	/** The pieces this binary can draw (art registered, a placeable slot). */
	items: ShelfItem[];
	/** Where the stall is at `now`: the card mounts for open and boarded. */
	phase: ShelfPhase | null;
	/** Server-corrected epoch ms, ticking once a minute. */
	now: number;
	loading: boolean;
	refresh: () => Promise<void>;
	/** A buy landed: flip the piece to owned without waiting on a refetch. */
	markOwned: (id: string) => void;
}

export function useSeasonalShelf(): UseSeasonalShelf {
	const [shelf, setShelf] = useState<SeasonalShelf | null>(null);
	const [loading, setLoading] = useState(true);
	// Server minus device clock at the last fetch: a phone set a day fast must
	// not board the stall early.
	const [skew, setSkew] = useState(0);
	const [now, setNow] = useState(() => Date.now());
	const inFlight = useRef(false);

	const refresh = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			const raw = await rpc<unknown>("seasonal_shelf");
			const next = parseSeasonalShelf(raw);
			const deviceNow = Date.now();
			const serverMs = next?.serverNow ? Date.parse(next.serverNow) : NaN;
			setSkew(Number.isFinite(serverMs) ? serverMs - deviceNow : 0);
			setNow(deviceNow);
			setShelf(next);
		} finally {
			inFlight.current = false;
			setLoading(false);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			void refresh();
		}, [refresh]),
	);

	useEffect(() => {
		if (!shelf) return;
		const t = setInterval(() => setNow(Date.now()), TICK_MS);
		return () => clearInterval(t);
	}, [shelf]);

	const markOwned = useCallback((id: string) => {
		setShelf((prev) =>
			prev
				? {
						...prev,
						items: prev.items.map((i) => (i.id === id ? { ...i, owned: true } : i)),
					}
				: prev,
		);
	}, []);

	const correctedNow = now + skew;
	const items = useMemo(() => (shelf ? drawableShelfItems(shelf.items) : []), [shelf]);
	const phase = shelf ? shelfPhase(shelf, correctedNow) : null;

	return {
		shelf,
		items,
		phase,
		now: correctedNow,
		loading,
		refresh,
		markOwned,
	};
}

/** The stall is on the wall in these phases; anything else unmounts it. */
export function stallVisible(phase: ShelfPhase | null): phase is "open" | "boarded" {
	return phase === "open" || phase === "boarded";
}
