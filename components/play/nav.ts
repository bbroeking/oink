// Where the Play screens go. One module so every door, row and sheet opens a
// table the same way, and so a test can swap the whole router with one mock.
//
//   openTable(roomId)  push the table (a found match, a row, an accepted invite)
//   enterTable(roomId) replace the current screen with the table (the invite
//                      landing: back from the table should not reopen the
//                      invite it came from)
//   openHub()          back to Play together: dismissed down to it when it
//                      is in the stack, otherwise it replaces this screen
//   openWins()         the wins board
//   leaveScreen()      back where the player came from, or the hub when the
//                      screen was opened cold (a push, a link)
//   leaveToHome()      back where the player came from, or home (the Barn)
//                      when opened cold: an invite turned down from a push
//                      should not land anywhere it did not come from
//
// One screen per table. Two ways to the same table can fire together: a
// search's watcher and the invite that made the table, the share sheet
// closing while the "Your tables" row under it is tapped, a row tapped twice.
// Pushed twice, the table stacks two copies of itself, and leaving the top
// one uncovers the same table again, "packed up" (the 2026-10-04 run, A-07j).
// So a table already on the stack (its match screen holds it there while
// mounted, holdTableOnStack) or pushed a moment ago is never pushed again:
// openTable does nothing, and enterTable goes back to it.

import { router } from "expo-router";
import { TABLE_OPEN_SETTLE_MS } from "./layout";

const onStack = new Map<string, number>();
let pending: { roomId: string; at: number } | null = null;

/** True while a match screen holds `roomId`, or it was pushed a moment ago
 *  and its screen has not mounted yet. */
export function isTableOpen(roomId: string, now: number = Date.now()): boolean {
	if ((onStack.get(roomId) ?? 0) > 0) return true;
	return pending !== null && pending.roomId === roomId && now - pending.at < TABLE_OPEN_SETTLE_MS;
}

/** The match screen holds its table on the stack while it is mounted.
 *  Returns the release, for the screen's effect cleanup. */
export function holdTableOnStack(roomId: string): () => void {
	onStack.set(roomId, (onStack.get(roomId) ?? 0) + 1);
	if (pending?.roomId === roomId) pending = null;
	return () => {
		const left = (onStack.get(roomId) ?? 1) - 1;
		if (left > 0) onStack.set(roomId, left);
		else onStack.delete(roomId);
	};
}

/** Test seam. */
export function resetTableNavForTests(): void {
	onStack.clear();
	pending = null;
}

function tableHref(roomId: string) {
	return { pathname: "/match/[roomId]", params: { roomId } } as const;
}

export function openTable(roomId: string): void {
	if (isTableOpen(roomId)) return;
	pending = { roomId, at: Date.now() };
	router.push(tableHref(roomId));
}

export function enterTable(roomId: string): void {
	if (isTableOpen(roomId)) {
		// Already on the stack under this screen: back down to it.
		router.dismissTo(tableHref(roomId));
		return;
	}
	pending = { roomId, at: Date.now() };
	router.replace(tableHref(roomId));
}

export function openHub(): void {
	router.dismissTo("/play");
}

export function openWins(): void {
	router.push("/play/wins");
}

export function leaveScreen(): void {
	if (router.canGoBack()) router.back();
	else router.replace("/play");
}

export function leaveToHome(): void {
	if (router.canGoBack()) router.back();
	else router.replace("/");
}
