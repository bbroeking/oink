// When a search the player is running finds a table, open it.
//
// The play server answers a match with two frames that may land in either
// order: the queue going idle and the new table's first snapshot (which puts a
// new row in "Your tables"). So the hub WATCHES: from the moment a search is
// started here (arm) or seen running (the resumed queue), it remembers the
// tables it already knew, and the first table that was not among them opens.
// The watch outlives the search by a short grace for the second frame, and a
// cancelled search disarms it, so an unrelated table can never yank the
// player somewhere they did not ask to go. A table another screen claimed
// (tableClaims: an invite it is accepting) is left for that screen to open.
//
// Only while the hub is mounted: a search started here and left running when
// the player backs out of the hub is stopped by the hub itself (PlayHub), so
// a stranger is never matched with a pig who is not there to sit down.

import { useCallback, useEffect, useRef } from "react";
import type { RoomSummary } from "@/multiplayer/protocol";
import { TABLE_WATCH_GRACE_MS } from "./layout";
import { isTableClaimed } from "./tableClaims";

interface Watch {
	known: Set<string>;
	/** Wall-clock ms the watch lapses; null while the search is running. */
	until: number | null;
}

export interface TableFound {
	/** Start watching now (a search or an accept is about to be sent). */
	arm: () => void;
	/** Stop watching (the player cancelled). */
	disarm: () => void;
}

export function useTableFound(games: readonly RoomSummary[], searching: boolean, onFound: (roomId: string) => void): TableFound {
	const watch = useRef<Watch | null>(null);
	const latest = useRef(games);
	useEffect(() => {
		latest.current = games;
	});

	const arm = useCallback(() => {
		watch.current = { known: new Set(latest.current.map((g) => g.roomId)), until: Date.now() + TABLE_WATCH_GRACE_MS };
	}, []);
	const disarm = useCallback(() => {
		watch.current = null;
	}, []);

	useEffect(() => {
		const now = Date.now();
		let w = watch.current;
		if (searching) {
			if (!w) {
				// A search seen running (resumed from the server): what is on
				// the list right now is not what it will find.
				watch.current = { known: new Set(games.map((g) => g.roomId)), until: null };
				return;
			}
			w.until = null;
		} else if (w && w.until === null) {
			w.until = now + TABLE_WATCH_GRACE_MS;
		}
		w = watch.current;
		if (!w) return;
		if (w.until !== null && now > w.until) {
			watch.current = null;
			return;
		}
		const known = w.known;
		// A table another screen claimed (an accepted invite) is that screen's
		// to open: it counts as known from here on.
		for (const g of games) if (!known.has(g.roomId) && isTableClaimed(g.roomId, now)) known.add(g.roomId);
		const fresh = games.find((g) => !known.has(g.roomId) && g.phase !== "ended");
		if (fresh) {
			watch.current = null;
			onFound(fresh.roomId);
		}
	}, [games, searching, onFound]);

	return { arm, disarm };
}
