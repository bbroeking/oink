// Home stats — the Barn screen's core data slice. Owns the `stats`
// object (counter, balance, cap, equipped cosmetics, season tier)
// + the `home_stats` RPC fetch + the dev-mode multi-query fallback.
//
// Surfaces a tiny `refresh()` that other Barn hooks call after their
// own mutations (stipend claim, pass-event mark, lucky bonus, tickle
// increment) so the Barn UI stays in sync with the latest server
// state in one place.
//
// Alignment state still lives in Barn itself; this hook calls the
// optional callback when the fallback path reads alignment_score
// off the profile (dev-sim parity pre-migration). In production the
// primary home_stats RPC doesn't surface alignment_score, so Barn
// also calls setAlignment from its own checkAlignment flow on focus.
// Active-effects state is now owned by useActiveEffects in Barn,
// not routed through this hook.

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { log } from "@/utils/log";
import { alignmentLabel, type AlignmentLabel } from "@/utils/alignment";

export interface EquipSlot {
	id: string;
	category: string | null;
	emoji: string | null;
}

export interface Stats {
	counter: number;
	ticklesEarned: number;
	itemCount: number;
	cap: number;
	nextRegenSeconds: number | null;
	// Five independently-equipped slots: hat, aura, background, held,
	// tickle particle. See migrations 20260514000000 + 20260519000000.
	happiness: number;
	activeHat: EquipSlot | null;
	activeGlasses: EquipSlot | null;
	activeMask: EquipSlot | null;
	activeNeck: EquipSlot | null;
	activeAura: EquipSlot | null;
	activeBackground: EquipSlot | null;
	activeHeld: EquipSlot | null;
	activeTickleParticle: EquipSlot | null;
	activeFlag: EquipSlot | null;
	currentTier: number;
	totalTiers: number;
}

const INITIAL_STATS: Stats = {
	counter: 0,
	ticklesEarned: 0,
	itemCount: 0,
	cap: 25,
	nextRegenSeconds: null,
	happiness: 50,
	activeHat: null,
	activeGlasses: null,
	activeMask: null,
	activeNeck: null,
	activeAura: null,
	activeBackground: null,
	activeHeld: null,
	activeTickleParticle: null,
	activeFlag: null,
	currentTier: 1,
	totalTiers: 30,
};

export interface UseHomeStatsOptions {
	// Fired by the multi-query fallback path when alignment_score is
	// fetched from the profile. The primary home_stats RPC path does
	// not currently surface alignment_score, so this only fires on
	// dev sims pre-migration. Optional — Barn passes `setAlignment`.
	onAlignmentLoaded?: (label: AlignmentLabel) => void;
}

export interface UseHomeStats {
	stats: Stats;
	statsLoaded: boolean;
	refresh: () => Promise<void>;
}

type SlotBlob = {
	category?: string | null;
	emoji?: string | null;
} | null;

function toSlot(id: string | null, meta: SlotBlob): EquipSlot | null {
	return id
		? { id, category: meta?.category ?? null, emoji: meta?.emoji ?? null }
		: null;
}

export function useHomeStats(opts: UseHomeStatsOptions = {}): UseHomeStats {
	const [stats, setStats] = useState<Stats>(INITIAL_STATS);
	const [statsLoaded, setStatsLoaded] = useState(false);

	// Stash the callback in a ref so refresh's identity stays stable
	// across renders; the consumer (Barn) re-passes the setter each
	// render but we don't want to retrigger any effects keyed on
	// refresh.
	const onAlignmentLoadedRef = useRef(opts.onAlignmentLoaded);
	onAlignmentLoadedRef.current = opts.onAlignmentLoaded;

	const refresh = useCallback(async () => {
		try {
			// Single round trip via home_stats() RPC — was 3-4 sequential
			// queries (profiles + tickle_info + season_state + hats join).
			// Falls back to the multi-query path if the RPC isn't deployed
			// yet so dev sims work between code merge and `supabase db push`.
			const r = await rpc<{
				ok?: boolean;
				counter: number;
				tickles_earned: number;
				active_hat_id: string | null;
				happiness?: number;
				active_hat: SlotBlob;
				active_glasses_id?: string | null;
				active_glasses?: SlotBlob;
				active_mask_id?: string | null;
				active_mask?: SlotBlob;
				active_neck_id?: string | null;
				active_neck?: SlotBlob;
				active_aura_id: string | null;
				active_aura: SlotBlob;
				active_background_id: string | null;
				active_background: SlotBlob;
				active_held_id?: string | null;
				active_held?: SlotBlob;
				active_tickle_particle_id?: string | null;
				active_tickle_particle?: SlotBlob;
				active_flag_id?: string | null;
				active_flag?: SlotBlob;
				balance: number;
				cap: number;
				next_regen_seconds: number | null;
				current_tier: number;
				total_tiers: number;
			}>("home_stats");
			if (r && r.ok) {
				setStats({
					counter: r.counter,
					ticklesEarned: r.tickles_earned,
					itemCount: r.balance,
					cap: r.cap,
					nextRegenSeconds: r.next_regen_seconds,
					happiness: r.happiness ?? 50,
					activeHat: toSlot(r.active_hat_id, r.active_hat),
					activeGlasses: toSlot(r.active_glasses_id ?? null, r.active_glasses ?? null),
					activeMask: toSlot(r.active_mask_id ?? null, r.active_mask ?? null),
					activeNeck: toSlot(r.active_neck_id ?? null, r.active_neck ?? null),
					activeAura: toSlot(r.active_aura_id, r.active_aura),
					activeBackground: toSlot(r.active_background_id, r.active_background),
					activeHeld: toSlot(r.active_held_id ?? null, r.active_held ?? null),
					activeTickleParticle: toSlot(
						r.active_tickle_particle_id ?? null,
						r.active_tickle_particle ?? null
					),
					activeFlag: toSlot(r.active_flag_id ?? null, r.active_flag ?? null),
					currentTier: r.current_tier,
					totalTiers: r.total_tiers,
				});
				setStatsLoaded(true);
				return;
			}

			// Fallback: original multi-query path (dev parity pre-migration).
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const [profileResult, info, season] = await Promise.all([
				supabase
					.from("profiles")
					.select(
						"counter, tickles_earned, happiness, active_hat_id, active_glasses_id, active_mask_id, active_neck_id, active_aura_id, active_background_id, active_held_id, active_tickle_particle_id, active_flag_id, alignment_score"
					)
					.eq("id", user.id)
					.single(),
				rpc<{
					balance?: number;
					cap?: number;
					next_regen_seconds?: number | null;
				}>("tickle_info", { uid: user.id }),
				rpc<{
					current_tier?: number;
					season?: { total_tiers?: number };
				}>("season_state"),
			]);

			if (profileResult.error) throw profileResult.error;

			const prof = profileResult.data as {
				counter?: number;
				tickles_earned?: number;
				happiness?: number;
				active_hat_id?: string | null;
				active_glasses_id?: string | null;
				active_mask_id?: string | null;
				active_neck_id?: string | null;
				active_aura_id?: string | null;
				active_background_id?: string | null;
				active_held_id?: string | null;
				active_tickle_particle_id?: string | null;
				active_flag_id?: string | null;
				alignment_score?: number | null;
			} | null;

			onAlignmentLoadedRef.current?.(alignmentLabel(prof?.alignment_score ?? 0));

			const slotIds: (string | null)[] = [
				prof?.active_hat_id ?? null,
				prof?.active_aura_id ?? null,
				prof?.active_background_id ?? null,
				prof?.active_held_id ?? null,
				prof?.active_tickle_particle_id ?? null,
			];
			const idsToLookUp = slotIds.filter((x): x is string => !!x);
			const hatMetaById = new Map<
				string,
				{ category: string | null; emoji: string | null }
			>();
			if (idsToLookUp.length > 0) {
				const { data: rows } = await supabase
					.from("hats")
					.select("id, category, emoji")
					.in("id", idsToLookUp);
				(rows ?? []).forEach((h) =>
					hatMetaById.set(h.id, {
						category: h.category ?? null,
						emoji: h.emoji ?? null,
					})
				);
			}
			const slotFromId = (id: string | null): EquipSlot | null => {
				if (!id) return null;
				const m = hatMetaById.get(id);
				return { id, category: m?.category ?? null, emoji: m?.emoji ?? null };
			};

			setStats({
				counter: prof?.counter || 0,
				ticklesEarned: prof?.tickles_earned ?? 0,
				itemCount: info?.balance ?? 0,
				cap: info?.cap ?? 25,
				nextRegenSeconds: info?.next_regen_seconds ?? null,
				happiness: prof?.happiness ?? 50,
				activeHat: slotFromId(prof?.active_hat_id ?? null),
				activeGlasses: slotFromId(prof?.active_glasses_id ?? null),
				activeMask: slotFromId(prof?.active_mask_id ?? null),
				activeNeck: slotFromId(prof?.active_neck_id ?? null),
				activeAura: slotFromId(prof?.active_aura_id ?? null),
				activeBackground: slotFromId(prof?.active_background_id ?? null),
				activeHeld: slotFromId(prof?.active_held_id ?? null),
				activeTickleParticle: slotFromId(prof?.active_tickle_particle_id ?? null),
				activeFlag: slotFromId(prof?.active_flag_id ?? null),
				currentTier: season?.current_tier ?? 1,
				totalTiers: season?.season?.total_tiers ?? 30,
			});
			setStatsLoaded(true);
		} catch (error) {
			log.error("Error fetching stats:", error);
		}
	}, []);

	return { stats, statsLoaded, refresh };
}
