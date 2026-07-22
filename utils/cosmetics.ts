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
// SERVER-SIDE NOW (issue #35): equipCosmetic calls the equip_cosmetic RPC
// (20260774000000), which sources the category from the catalog, enforces
// ownership + members-only gating, and applies Face-slot exclusivity in one
// server write — then hands back the same column-patch computeEquip would.
// The RPC is the source of truth; computeEquip stays as (a) the shape/rule
// documentation and (b) the fallback rule when the RPC is unreachable.
//
// FALLBACK: on an rpc() null (un-migrated env — the function isn't deployed —
// or a transient transport blip) equipCosmetic drops to the LEGACY direct
// profiles.active_*_id write (equipCosmeticLegacy) so shipped/offline builds
// keep working. That RLS write path is deliberately still live server-side
// (the migration does NOT revoke it).

import { supabase } from "./supabase";
import { rpc } from "./rpc";
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

// Shape the equip_cosmetic RPC returns: {ok:true, update} on success, or
// {ok:false, reason} on a refusal (not_owned / no_such_item / bad_category /
// unauthenticated). rpc() returns null instead when the call itself failed
// (function undeployed → PGRST202, or a transport blip).
interface EquipRpcResult {
	ok: boolean;
	update?: Record<string, string | null>;
	reason?: string;
}

// Effect wrapper: persist the equip for `userId` and return the column patch
// so the caller can apply the same change optimistically to local state.
// Passing `itemId = null` unequips just the matching slot (needs `category`).
//
// Preferred path: the server RPC, which returns the authoritative column-patch.
// On rpc() null (undeployed / transport blip) we fall back to the legacy direct
// write. On a server REFUSAL ({ok:false}) we return an EMPTY patch — a no-op
// merge into activeIds — so the UI simply doesn't move the item into the slot
// the server declined. Callers (shop.tsx handleEquip → patchActiveIds) already
// ignore failures, so a no-op patch is the least-surprising surface and keeps
// the client in step with the server rather than optimistically lying. These
// refusals aren't reachable in normal UI (you can only tap owned, visible
// items), so no toast is warranted.
export async function equipCosmetic(
	userId: string,
	itemId: string | null,
	category: string | null | undefined,
): Promise<Record<string, string | null>> {
	const res = await rpc<EquipRpcResult>("equip_cosmetic", {
		p_item_id: itemId,
		p_category: category ?? null,
	});
	// rpc null → function undeployed or transport blip → legacy direct write.
	if (res == null) {
		return equipCosmeticLegacy(userId, itemId, category);
	}
	// Server accepted → apply its authoritative patch.
	if (res.ok && res.update) {
		return res.update;
	}
	// Server refused ({ok:false}) → no-op patch.
	return {};
}

// LEGACY fallback: the pre-#35 client-side direct write. Kept only for the
// undeployed/offline path in equipCosmetic — the server RPC is the real rule.
// Uses computeEquip so the fallback obeys the same routing + exclusivity.
async function equipCosmeticLegacy(
	userId: string,
	itemId: string | null,
	category: string | null | undefined,
): Promise<Record<string, string | null>> {
	const { update } = computeEquip(category, itemId, {});
	await supabase.from("profiles").update(update).eq("id", userId);
	return update;
}
