// A pig's look at a matchmade table. The server snapshots each seat's look
// as a PigLook (which pig, the item id worn in each slot, the public Wallow
// rank) when the seat is taken; this module turns that into PigStage props,
// and builds the player's own PlayerCard from their profile for Practice and
// optimistic UI.
//
// Resolution matches the other surfaces that draw a friend's pig: the art
// comes from the item id (PigStage looks it up in HAT_IMAGES / HAT_REL), the
// category comes from the slot the server put it in (as PigAvatar does for a
// hat or a bow), and only a Slop Club member shows a companion pig; everyone
// else is Rosie (BarnVisitModal, useFriendWishTargets).

import type { EquippedItem } from "@/components/ui/PigStage";
import type { PigLook, PlayerCard } from "@/multiplayer/protocol";
import { isPigId, type PigId } from "@/utils/pigs";
import { supabase } from "@/utils/supabase";

export type LookSlot = "hat" | "bow" | "glasses" | "mask" | "neck" | "held" | "aura";

export const LOOK_SLOTS: readonly LookSlot[] = ["hat", "bow", "glasses", "mask", "neck", "held", "aura"];

/** The catalog category each look slot carries. The neck slot holds the
 *  shown neck category (necklace: the Marsh Wreath, the Founder's Mud
 *  Ribbon); every neck piece is placed by its own RelSpec on the `neck`
 *  anchor, so a scarf there renders identically. */
export const LOOK_SLOT_CATEGORY: Readonly<Record<LookSlot, string>> = Object.freeze({
	hat: "hat",
	bow: "bow",
	glasses: "glasses",
	mask: "mask",
	neck: "necklace",
	held: "held",
	aura: "aura",
});

/** The PigStage props for one seat's pig. Spread straight onto PigStage. */
export interface PigStageLookProps {
	pigId: PigId;
	equipped: EquippedItem | null;
	equippedBow: EquippedItem | null;
	equippedGlasses: EquippedItem | null;
	equippedMask: EquippedItem | null;
	equippedNeck: EquippedItem | null;
	equippedHeld: EquippedItem | null;
	equippedAura: EquippedItem | null;
	prestigeLevel: number;
}

function cleanId(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 && value.length <= 64 ? value : null;
}

/** One worn item as PigStage's EquippedItem (null for an empty slot). Pass
 *  `category` when the exact catalog category is known (e.g. from a `hats`
 *  join); otherwise the slot's category stands in. */
export function equippedItemForSlot(slot: LookSlot, itemId: string | null | undefined, category?: string | null): EquippedItem | null {
	const id = cleanId(itemId);
	if (!id) return null;
	return { id, category: category ?? LOOK_SLOT_CATEGORY[slot], emoji: null };
}

export const PLAIN_LOOK: PigLook = Object.freeze({
	pigId: "rosie",
	hat: null,
	bow: null,
	glasses: null,
	mask: null,
	neck: null,
	held: null,
	aura: null,
	wallow: 0,
});

/** PigLook → PigStage props. A missing look, an unknown pig id or a bad
 *  slot value degrades to Rosie with that slot empty, never a crash. */
export function pigStagePropsForLook(look: PigLook | null | undefined, categories?: Readonly<Record<string, string | null>>): PigStageLookProps {
	const l = look ?? PLAIN_LOOK;
	const item = (slot: LookSlot) => {
		const id = cleanId(l[slot]);
		return equippedItemForSlot(slot, id, id ? categories?.[id] : undefined);
	};
	const wallow = typeof l.wallow === "number" && Number.isFinite(l.wallow) ? Math.max(0, Math.floor(l.wallow)) : 0;
	return {
		pigId: isPigId(l.pigId) ? l.pigId : "rosie",
		equipped: item("hat"),
		equippedBow: item("bow"),
		equippedGlasses: item("glasses"),
		equippedMask: item("mask"),
		equippedNeck: item("neck"),
		equippedHeld: item("held"),
		equippedAura: item("aura"),
		prestigeLevel: wallow,
	};
}

/** The profile columns a look is built from (a `profiles` row). */
export interface LookProfileRow {
	username?: string | null;
	active_pig_id?: string | null;
	is_vip?: boolean | null;
	active_hat_id?: string | null;
	active_bow_id?: string | null;
	active_glasses_id?: string | null;
	active_mask_id?: string | null;
	active_neck_id?: string | null;
	active_held_id?: string | null;
	active_aura_id?: string | null;
	wallow_count?: number | null;
}

/** The select list for LookProfileRow. */
export const LOOK_PROFILE_SELECT =
	"username, active_pig_id, is_vip, active_hat_id, active_bow_id, active_glasses_id, active_mask_id, active_neck_id, active_held_id, active_aura_id, wallow_count";

/** A profile row as the PigLook the server would snapshot for it. */
export function lookFromProfile(row: LookProfileRow | null | undefined): PigLook {
	if (!row) return PLAIN_LOOK;
	const wallow = typeof row.wallow_count === "number" && Number.isFinite(row.wallow_count) ? Math.max(0, Math.floor(row.wallow_count)) : 0;
	return {
		pigId: row.is_vip && isPigId(row.active_pig_id) ? row.active_pig_id : "rosie",
		hat: cleanId(row.active_hat_id),
		bow: cleanId(row.active_bow_id),
		glasses: cleanId(row.active_glasses_id),
		mask: cleanId(row.active_mask_id),
		neck: cleanId(row.active_neck_id),
		held: cleanId(row.active_held_id),
		aura: cleanId(row.active_aura_id),
		wallow,
	};
}

/** A pig with no name yet still gets a warm label. */
export const UNNAMED_PIG = "A pig";

export function playerCardFromProfile(userId: string, row: LookProfileRow | null | undefined): PlayerCard {
	const name = typeof row?.username === "string" && row.username.trim().length > 0 ? row.username.trim() : UNNAMED_PIG;
	return { userId, name, look: lookFromProfile(row) };
}

/**
 * The signed-in player's own card, read from their profile. Null when there
 * is no session; a failed read still returns a card (the fallback name and a
 * plain look) so Practice never blocks on the network.
 */
export async function fetchMyPlayerCard(fallbackName?: string | null): Promise<PlayerCard | null> {
	const { data: auth } = await supabase.auth.getSession();
	const userId = auth.session?.user.id;
	if (!userId) return null;
	const { data } = await supabase.from("profiles").select(LOOK_PROFILE_SELECT).eq("id", userId).maybeSingle();
	const row = (data ?? null) as LookProfileRow | null;
	const card = playerCardFromProfile(userId, row);
	return row?.username ? card : { ...card, name: fallbackName?.trim() || card.name };
}
