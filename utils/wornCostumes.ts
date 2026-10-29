// Read which full costume a pig is wearing (profiles.active_costume_id,
// migration 20261029240000_halloween_costumes.sql).
//
// FAIL-SOFT ON PURPOSE: this binary can reach a server that does not have the
// column yet. Every outfit query that already exists keeps its own select
// list untouched, and the costume is fetched here on the side, so an unpushed
// column means "no costume" instead of a failed Barn, visit or Closet load.

import { supabase } from "@/utils/supabase";
import type { EquippedItem } from "@/components/ui/PigStage";
import { COSTUME_CATEGORY, isKnownCostumeId } from "@/utils/costumeFit";

/** The {id, category, emoji} slot PigStage draws, for a worn costume id. */
export function costumeSlot(id: string | null | undefined): EquippedItem | null {
	return id && isKnownCostumeId(id) ? { id, category: COSTUME_CATEGORY, emoji: null } : null;
}

/** Worn costume id per user id; users without one (or any failure) are absent. */
export async function fetchWornCostumes(
	userIds: readonly string[],
): Promise<Record<string, string>> {
	const ids = [...new Set(userIds.filter(Boolean))];
	if (ids.length === 0) return {};
	try {
		const { data, error } = await supabase
			.from("profiles")
			.select("id, active_costume_id")
			.in("id", ids)
			.returns<{ id: string; active_costume_id: string | null }[]>();
		if (error || !data) return {};
		const out: Record<string, string> = {};
		for (const row of data) {
			if (row.active_costume_id) out[row.id] = row.active_costume_id;
		}
		return out;
	} catch {
		return {};
	}
}

/** One pig's worn costume id, or null (including on any failure). */
export async function fetchWornCostume(userId: string | null | undefined): Promise<string | null> {
	if (!userId) return null;
	const map = await fetchWornCostumes([userId]);
	return map[userId] ?? null;
}
