// The Burrow Book data layer — reads the caller's own unique relic catches from
// user_uniques (RLS: own rows only). Feature-dark by design: if the table isn't
// migrated yet (or the read errors for any reason), we return null and the
// Burrow Book renders every entry as undiscovered — never an error surface.

import { supabase } from "@/utils/supabase";

export interface MyUnique {
	found_count: number;
	first_found_at: string;
	// The best gild this relic was ever caught at (0 = never gilded). Drives the
	// ★ count on the discovered Burrow Book entry ("The One That Got Away").
	best_gild: number;
}

/**
 * The caller's discovered relics, keyed by unique_id. null → feature-dark (table
 * absent or read failed) → the Book shows everything undiscovered.
 */
export async function fetchMyUniques(): Promise<Record<
	string,
	MyUnique
> | null> {
	try {
		const { data, error } = await supabase
			.from("user_uniques")
			.select("unique_id, found_count, first_found_at, best_gild");
		if (error || !data) return null;
		const out: Record<string, MyUnique> = {};
		for (const row of data as {
			unique_id: string;
			found_count: number;
			first_found_at: string;
			best_gild?: number | null;
		}[]) {
			out[row.unique_id] = {
				found_count: row.found_count,
				first_found_at: row.first_found_at,
				// Absent (pre-carryover DB) → 0 → no ★ on the entry (feature-dark).
				best_gild: row.best_gild ?? 0,
			};
		}
		return out;
	} catch {
		return null; // any failure → dark, not an error
	}
}
