// Tables a screen is about to open itself. Accepting an invite answers in
// three frames (the queue going idle, the table's first snapshot, then the
// ack carrying its id), so a hub that is watching a search for a fresh table
// would see the accepted table first and open it, and the screen that
// accepted would open it again on the ack: two tables stacked. A screen that
// knows the table it is about to sit at (an invite carries its room id)
// claims it first, and the hub's watcher (useTableFound) treats a claimed
// table as one it already knew. Claims lapse on their own.

import { TABLE_WATCH_GRACE_MS } from "./layout";

const claims = new Map<string, number>();

/** This screen will open `roomId` itself. */
export function claimTable(roomId: string | null | undefined, now: number = Date.now()): void {
	if (!roomId) return;
	claims.set(roomId, now + TABLE_WATCH_GRACE_MS);
	for (const [id, until] of claims) if (until <= now) claims.delete(id);
}

export function isTableClaimed(roomId: string, now: number = Date.now()): boolean {
	const until = claims.get(roomId);
	return until !== undefined && until > now;
}

/** Test seam. */
export function resetTableClaimsForTests(): void {
	claims.clear();
}
