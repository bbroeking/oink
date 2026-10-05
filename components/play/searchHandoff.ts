// A search asked for somewhere else and run by the hub: the result sheet's
// "Find another pig" (and a practice table's "Find a real pig") leaves the
// table, hands the search here and opens Play together, which takes it on
// focus and starts looking with its table-found watcher already armed. The
// hub owns searching because it is the one screen that opens a found table;
// joining the queue from a table that is about to close could find a match
// with nobody watching for it.

import type { GameId, Pace } from "@/multiplayer/types";

export interface HandedOffSearch {
	games: GameId[];
	pace: Pace;
}

let pending: HandedOffSearch | null = null;

export function handOffSearch(games: GameId[], pace: Pace): void {
	pending = { games: [...games], pace };
}

/** The search waiting for the hub, once (null when there is none). */
export function takeHandedOffSearch(): HandedOffSearch | null {
	const next = pending;
	pending = null;
	return next;
}
