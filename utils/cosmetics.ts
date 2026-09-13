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
//   • equipCosmetic asks the server to apply that update.
//
// SERVER-SIDE (issue #35): equipCosmetic calls the equip_cosmetic RPC
// (20260774000000), which sources the category from the catalog, enforces
// ownership + members-only gating, and applies Face-slot exclusivity in one
// server write — then hands back the same column-patch computeEquip would.
// The RPC is the source of truth; computeEquip remains as the documented,
// unit-tested statement of the rule (and the shape callers merge optimistically).
//
// Every RPC failure — missing function, network, permission, SQL — fails closed
// rather than writing profiles.active_*_id directly and bypassing the server's
// ownership/member checks.

import { rpcOutcome } from "./rpc";
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
// unauthenticated).
interface EquipRpcResult {
	ok: boolean;
	update?: Record<string, string | null>;
	reason?: string;
}

// Effect wrapper: persist the equip via the server RPC and return the column
// patch so the caller can apply the same change optimistically to local state.
// Passing `itemId = null` unequips just the matching slot (needs `category`).
//
// Any call failure throws — there is no direct-write path around the server's
// ownership/member checks. On a server REFUSAL ({ok:false}) we return an EMPTY
// patch — a no-op merge into activeIds — so the UI simply doesn't move the item
// into the slot the server declined. Callers (shop.tsx handleEquip →
// patchActiveIds) already ignore failures, so a no-op patch is the
// least-surprising surface and keeps the client in step with the server rather
// than optimistically lying. These refusals aren't reachable in normal UI (you
// can only tap owned, visible items), so no toast is warranted.
export async function equipCosmetic(
	itemId: string | null,
	category: string | null | undefined,
): Promise<Record<string, string | null>> {
	const outcome = await rpcOutcome<EquipRpcResult>("equip_cosmetic", {
		p_item_id: itemId,
		p_category: category ?? null,
	});
	if (!outcome.ok) {
		throw new Error(`equip_cosmetic failed: ${outcome.error.message ?? outcome.kind}`);
	}
	const res = outcome.data;
	if (res == null) {
		throw new Error("equip_cosmetic failed: no data");
	}
	// Server accepted → apply its authoritative patch.
	if (res.ok && res.update) {
		return res.update;
	}
	// Server refused ({ok:false}) → no-op patch.
	return {};
}

// ---------------------------------------------------------------------------
// Accessibility composition for the two cosmetic grids.
//
// The Closet grid composed a state-aware label + hint by hand; the Shop grid
// shipped with no accessibility props at all, so every purchasable item in the
// game announced as two bare text runs [D-03, D-04]. The label/hint pair is a
// RULE, not a rendering detail — a control that spends states its cost in its
// label and its consequence in its hint (spec §3.5) — so it lives here beside
// the equip rule rather than in either screen.
// (2026-09-11)
// ---------------------------------------------------------------------------

export interface CosmeticA11ySubject {
	name: string;
	rarity?: string | null;
	/** Catalog price. `0` is the "earned, not sold" sentinel. */
	cost?: number | null;
}

export interface CosmeticA11yState {
	owned: boolean;
	/** Currently worn in its slot. */
	active: boolean;
	/** Members-only AND the viewer is not a Slop Club member. */
	locked?: boolean;
	/** The viewer's balance covers `cost`. Only meaningful when unowned. */
	canAfford?: boolean;
	/** In today's rotation. An out-of-rotation item can be previewed, not bought. */
	buyable?: boolean;
	/**
	 * What a tap does. `equip` is the Closet tile (wear / take off in place);
	 * `preview` is the Shop card (opens the buy sheet).
	 */
	action?: "preview" | "equip";
}

export interface CosmeticA11y {
	accessibilityLabel: string;
	accessibilityHint: string;
	accessibilityState: { selected: boolean; disabled: boolean };
}

/** "wearing" / "owned" / "Slop Club members only" / "not owned" — one word set. */
function ownershipWord(state: CosmeticA11yState): string {
	if (state.active) return "wearing";
	if (state.owned) return "owned";
	if (state.locked) return "Slop Club members only";
	return "not owned";
}

/**
 * The spoken name + consequence for a cosmetic tile, in both grids.
 *
 * Label: name, rarity, ownership, and — for anything still for sale — its cost.
 * Hint: what the tap will do, including why it can't be bought yet.
 */
export function cosmeticAccessibility(
	item: CosmeticA11ySubject,
	state: CosmeticA11yState,
): CosmeticA11y {
	const cost = item.cost ?? 0;
	const forSale = !state.owned && cost > 0;
	const parts = [item.name];
	if (item.rarity) parts.push(item.rarity);
	parts.push(ownershipWord(state));
	if (forSale) parts.push(`${cost.toLocaleString()} snouts`);

	const hint =
		state.action === "equip"
			? state.owned
				? state.active
					? "Removes this item from your pig"
					: "Equips this item on your pig"
				: state.locked
					? "Opens a preview; Slop Club membership is required"
					: "Opens a preview of this item"
			: state.owned
				? state.active
					? "Opens the item sheet, where you can take it off"
					: "Opens the item sheet, where you can wear it"
				: state.locked
					? "Opens a preview; Slop Club membership is required"
					: cost <= 0
						? "Opens a preview; this one is earned, not sold"
						: state.buyable === false
							? "Opens a preview; it isn't in today's shop"
							: state.canAfford === false
								? `Opens the buy sheet; you don't have ${cost.toLocaleString()} snouts yet`
								: `Opens the buy sheet; buying costs ${cost.toLocaleString()} snouts`;

	return {
		accessibilityLabel: parts.join(", "),
		accessibilityHint: hint,
		accessibilityState: { selected: state.active, disabled: false },
	};
}
