// Cosmetic equip action — the business rule behind "wear this / take it off".
//
// Split into a PURE rule (computeEquip) and a thin EFFECT (equipCosmetic):
//   • computeEquip routes the item to its profiles column (columnForCategory)
//     and enforces the Face-slot exclusivity invariant — glasses + masks share
//     one player-facing Face chip, so equipping glasses clears any mask and vice
//     versa. Unequips (itemId null) leave the sibling column alone. It returns
//     both the minimal `update` object (what to write) and the resulting
//     `activeIds` set (current merged with update) so callers can drive an
//     optimistic UI patch from the same source of truth. Pure + unit-tested
//     (__tests__/cosmetics.test.ts).
//   • equipCosmetic applies that update to profiles via supabase.
//
// DELIBERATELY CLIENT-SIDE: this writes profiles.active_*_id directly rather
// than going through a server RPC. A dedicated equip RPC was considered and
// deferred — the write is a single-column, RLS-scoped update with no
// cross-row invariant to enforce server-side, so the extra round trip and
// migration weren't worth it yet. Revisit if equip ever needs server auth
// beyond row-level security (e.g. gating members-only wears).

import { supabase } from "./supabase";
import { columnForCategory } from "@/constants/slots";

export interface EquipComputation {
	// The minimal column patch to persist (and to merge into the active-id map).
	update: Record<string, string | null>;
	// currentActiveIds with `update` applied — the post-equip active-id set.
	activeIds: Record<string, string | null>;
}

// Pure equip rule. Given the item's category, the target itemId (null to
// unequip the slot), and the caller's current active-id map, compute the
// profiles column patch + the resulting active-id set.
//
// Category routing: glasses → active_glasses_id, mask → active_mask_id,
// everything else → its slot's column (columnForCategory). Face exclusivity
// only fires on an EQUIP (itemId truthy); an unequip clears just its own column.
export function computeEquip(
	category: string | null | undefined,
	itemId: string | null,
	currentActiveIds: Record<string, string | null>,
): EquipComputation {
	// Category-precise column (glasses + masks share the Face CHIP but keep
	// separate columns — columnForCategory routes correctly).
	const column = columnForCategory(category);
	const update: Record<string, string | null> = { [column]: itemId };
	// Face exclusivity: the merged chip shows one face item at a time, so
	// equipping glasses clears any mask and vice versa. Unequips (itemId null)
	// leave the sibling alone.
	if (itemId) {
		if (category === "glasses") update.active_mask_id = null;
		if (category === "mask") update.active_glasses_id = null;
	}
	return { update, activeIds: { ...currentActiveIds, ...update } };
}

// Effect wrapper: persist the equip for `userId` and return the column patch
// so the caller can apply the same change optimistically to local state.
// Passing `itemId = null` unequips just the matching slot.
export async function equipCosmetic(
	userId: string,
	itemId: string | null,
	category: string | null | undefined,
): Promise<Record<string, string | null>> {
	const { update } = computeEquip(category, itemId, {});
	await supabase.from("profiles").update(update).eq("id", userId);
	return update;
}
