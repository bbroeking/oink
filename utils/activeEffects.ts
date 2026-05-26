// Receiver-side effects layer — the blessings + curses currently
// active on the caller. Backs everything that reads `my_active_effects`:
// the Barn chip strip, the Hoofprints sheet, the Inbox panel, and the
// in-game "Cleanse" flow.
//
// Pure helpers live here so they're trivially unit-testable; the
// stateful hook (useActiveEffects) composes them in `hooks/`.

import { supabase } from "./supabase";

export interface Effect {
	source: "blessing" | "curse";
	kind: string;
	expires_at: string;
	sender_id: string | null;
	sender_username: string | null;
}

// Fetch + cast the live effects on the caller. Always resolves with
// an array (null + error both become []), since every caller treats
// "empty" as the rest state — there's no useful distinction between
// "no effects" and "couldn't fetch effects" at the render layer.
export async function fetchActiveEffects(): Promise<Effect[]> {
	const { data } = await supabase.rpc("my_active_effects");
	const rows = (data as Effect[] | null) ?? [];
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
