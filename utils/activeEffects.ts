// Receiver-side effects layer — the blessings + curses currently
// active on the caller. Backs everything that reads `my_active_effects`:
// the Barn chip strip, the Hoofprints sheet, the Inbox panel, and the
// in-game "Cleanse" flow.
//
// Pure helpers live here so they're trivially unit-testable; the
// stateful hook (useActiveEffects) composes them in `hooks/`.

import { rpc } from "./rpc";
import {
	BLESSING_META,
	CURSE_META,
	type BlessingKind,
	type CurseKind,
} from "./rituals";

export interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

// Per-effect display derivation shared by every render surface (the Barn
// chip strip + the Inbox panel both hand-rolled the identical four lines):
// whether it's a blessing, its ritual meta (icon/name/blurb — may be
// undefined for an unknown kind, so callers keep guarding with `meta?.`),
// the sender label with its blessing/curse fallback, and the avatar initial.
export function effectMeta(e: Effect) {
	const blessed = e.source === "blessing";
	const meta = blessed
		? BLESSING_META[e.kind as BlessingKind]
		: CURSE_META[e.kind as CurseKind];
	const senderName = e.sender_username ?? (blessed ? "a friend" : "someone");
	const initial = (e.sender_username ?? "?").slice(0, 1).toUpperCase();
	return { blessed, meta, senderName, initial };
}

// Fetch + cast the live effects on the caller. Always resolves with
// an array (null + error both become []), since every caller treats
// "empty" as the rest state — there's no useful distinction between
// "no effects" and "couldn't fetch effects" at the render layer.
export async function fetchActiveEffects(): Promise<Effect[]> {
	const rows = (await rpc<Effect[]>("my_active_effects")) ?? [];
	// blessings first, then curses — stable iteration order for the
	// callers that render a unified list.
	rows.sort((a, b) => (a.source < b.source ? -1 : 1));
	return rows;
}

export interface Partitioned {
	blessings: Effect[];
	curses: Effect[];
}

export function partitionBySource(effects: Effect[]): Partitioned {
	const blessings: Effect[] = [];
	const curses: Effect[] = [];
	for (const e of effects) {
		(e.source === "blessing" ? blessings : curses).push(e);
	}
	return { blessings, curses };
}

// Compact countdown formatter. `withSuffix=true` appends "left" for
// the Inbox panel ("5m left"); the chip + sheet use the bare form
// ("5m"). Returns "expiring" once the timestamp's in the past.
export function formatLeft(iso: string, withSuffix = false): string {
	const ms = new Date(iso).getTime() - Date.now();
	if (ms <= 0) return "expiring";
	const mins = Math.round(ms / 60000);
	const tail = withSuffix ? " left" : "";
	if (mins < 60) return `${mins}m${tail}`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m ? `${h}h ${m}m${tail}` : `${h}h${tail}`;
}
