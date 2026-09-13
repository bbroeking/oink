// Home stats — the Barn screen's core data slice. Owns the `stats`
// object (counter, balance, cap, equipped cosmetics, season tier)
// + the `home_stats` RPC fetch.
//
// Surfaces a tiny `refresh()` that other Barn hooks call after their
// own mutations (stipend claim, pass-event mark, lucky bonus, tickle
// increment) so the Barn UI stays in sync with the latest server
// state in one place.
//
// Alignment state lives in Barn itself (its checkAlignment flow on focus);
// home_stats doesn't surface alignment_score. Active-effects state is
// owned by useActiveEffects in Barn, not routed through this hook.

import { useCallback, useEffect, useRef, useState } from "react";
import { rpc } from "@/utils/rpc";
import { log } from "@/utils/log";
import { HOME_STATS_BACKOFF_MS, retryDelayMs } from "@/utils/bootRetry";
// One equipped cosmetic slot. Identical to (and fed straight into)
// PigStage's render contract, so re-use that single declaration rather
// than maintaining a parallel copy. Re-exported under the EquipSlot name
// that the rest of this hook + Stats already reference.
import type { EquippedItem as EquipSlot } from "@/components/ui/PigStage";

export type { EquipSlot };

export interface Stats {
	counter: number;
	ticklesEarned: number;
	itemCount: number;
	cap: number;
	nextRegenSeconds: number | null;
	// TRUE per-tickle regen period (server regen_secs_for: VIP, blessings,
	// curses, alignment, happiness). Null until the 20260643 RPC is live.
	regenSeconds: number | null;
	// Date.now() when this stats object was fetched — lets consumers turn
	// nextRegenSeconds into a LIVE countdown instead of a frozen snapshot.
	fetchedAtMs: number;
	// Independently-equipped cosmetic slots surfaced by home_stats().
	happiness: number;
	currentStreak: number;
	longestStreak: number;
	streakEndsAt: string | null;
	activeHat: EquipSlot | null;
	activeBow: EquipSlot | null;
	activeGlasses: EquipSlot | null;
	activeMask: EquipSlot | null;
	activeNeck: EquipSlot | null;
	activeAura: EquipSlot | null;
	activeBackground: EquipSlot | null;
	activeHeld: EquipSlot | null;
	activeTickleParticle: EquipSlot | null;
	currentTier: number;
	totalTiers: number;
}

const INITIAL_STATS: Stats = {
	counter: 0,
	ticklesEarned: 0,
	itemCount: 0,
	cap: 25,
	nextRegenSeconds: null,
	regenSeconds: null,
	fetchedAtMs: 0,
	happiness: 50,
	currentStreak: 0,
	longestStreak: 0,
	streakEndsAt: null,
	activeHat: null,
	activeBow: null,
	activeGlasses: null,
	activeMask: null,
	activeNeck: null,
	activeAura: null,
	activeBackground: null,
	activeHeld: null,
	activeTickleParticle: null,
	currentTier: 1,
	totalTiers: 30,
};

export interface UseHomeStats {
	stats: Stats;
	statsLoaded: boolean;
	// True once the boot fetch + its whole backoff schedule have failed
	// without ever loading. The Barn's retry affordance reads this so it
	// shows only on a genuine failure, not during the normal load beat.
	statsError: boolean;
	refresh: () => Promise<void>;
	// Coalesced, trailing reconciliation for repeat interactions. A tap burst
	// updates the known response fields immediately and pays for one authoritative
	// home_stats read after the burst settles instead of one read per tap.
	scheduleRefresh: () => void;
	// Apply locally-known response fields immediately, before the authoritative
	// reconciliation round-trip. Accepts a function so overlapping mutations
	// compose against the latest state instead of a stale render closure.
	applyOptimistic: (
		patch: Partial<Stats> | ((current: Stats) => Partial<Stats>)
	) => void;
}

const HOME_STATS_RECONCILE_DELAY_MS = 500;

type SlotBlob = {
	category?: string | null;
	emoji?: string | null;
} | null;

function toSlot(id: string | null, meta: SlotBlob): EquipSlot | null {
	return id
		? { id, category: meta?.category ?? null, emoji: meta?.emoji ?? null }
		: null;
}

export function useHomeStats(): UseHomeStats {
	const [stats, setStats] = useState<Stats>(INITIAL_STATS);
	const [statsLoaded, setStatsLoaded] = useState(false);
	const [statsError, setStatsError] = useState(false);


	// Backoff-retry bookkeeping for a failed boot fetch. Without this a
	// transient network blip at launch left statsLoaded false / itemCount 0,
	// which the Barn reads as "Out of tickles!" until a force-quit — the
	// offline soft-lock (spec 03 / issue #5).
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const retryAttemptRef = useRef(0);
	const mountedRef = useRef(true);
	const scheduleRetryRef = useRef<() => void>(() => {});

	const clearRetry = useCallback(() => {
		if (retryTimerRef.current != null) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
	}, []);
	const clearScheduledRefresh = useCallback(() => {
		if (reconcileTimerRef.current != null) {
			clearTimeout(reconcileTimerRef.current);
			reconcileTimerRef.current = null;
		}
	}, []);

	// One fetch attempt. Returns true on success (stats hydrated), false on
	// any failure so the caller can decide whether to schedule a retry.
	const doFetch = useCallback(async (): Promise<boolean> => {
		try {
			// Single round trip via home_stats() RPC — was 3-4 sequential
			// queries (profiles + tickle_info + season_state + hats join).
			const r = await rpc<{
				ok?: boolean;
				counter: number;
				tickles_earned: number;
				active_hat_id: string | null;
				happiness?: number;
				active_hat: SlotBlob;
				active_bow_id?: string | null;
				active_bow?: SlotBlob;
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
				balance: number;
				cap: number;
				next_regen_seconds: number | null;
				regen_seconds?: number;
				current_streak?: number;
				longest_streak?: number;
				streak_ends_at?: string | null;
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
					regenSeconds: r.regen_seconds ?? null,
					fetchedAtMs: Date.now(),
					happiness: r.happiness ?? 50,
					currentStreak: r.current_streak ?? 0,
					longestStreak: r.longest_streak ?? 0,
					streakEndsAt: r.streak_ends_at ?? null,
					activeHat: toSlot(r.active_hat_id, r.active_hat),
					activeBow: toSlot(r.active_bow_id ?? null, r.active_bow ?? null),
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
					currentTier: r.current_tier,
					totalTiers: r.total_tiers,
				});
				setStatsLoaded(true);
				setStatsError(false);
				return true;
			}

			throw new Error("home_stats returned no data");
		} catch (error) {
			log.error("Error fetching stats:", error);
			return false;
		}
	}, []);

	// Schedule the next backoff retry, or — once the schedule is exhausted —
	// surface the visible retry affordance (statsError). No-op if stats have
	// meanwhile loaded or the hook unmounted.
	const scheduleRetry = useCallback(() => {
		if (!mountedRef.current) return;
		const delay = retryDelayMs(retryAttemptRef.current, HOME_STATS_BACKOFF_MS);
		if (delay == null) {
			setStatsError(true);
			return;
		}
		retryAttemptRef.current += 1;
		clearRetry();
		retryTimerRef.current = setTimeout(async () => {
			retryTimerRef.current = null;
			if (!mountedRef.current) return;
			const ok = await doFetch();
			if (!ok) scheduleRetryRef.current();
		}, delay);
	}, [doFetch, clearRetry]);
	scheduleRetryRef.current = scheduleRetry;

	// Public refresh — a fresh trigger (boot focus, mutation resync, cross-tree
	// bump). Resets the backoff so each new trigger gets the full retry budget,
	// then kicks off the schedule on failure.
	const refresh = useCallback(async () => {
		clearScheduledRefresh();
		retryAttemptRef.current = 0;
		setStatsError(false);
		clearRetry();
		const ok = await doFetch();
		if (!ok) scheduleRetry();
	}, [doFetch, scheduleRetry, clearRetry, clearScheduledRefresh]);

	const scheduleRefresh = useCallback(() => {
		clearScheduledRefresh();
		reconcileTimerRef.current = setTimeout(() => {
			reconcileTimerRef.current = null;
			void refresh();
		}, HOME_STATS_RECONCILE_DELAY_MS);
	}, [clearScheduledRefresh, refresh]);

	// Cancel any pending retry on unmount.
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
			clearRetry();
			clearScheduledRefresh();
		};
	}, [clearRetry, clearScheduledRefresh]);

	// Optimistic patch — merge a locally-known change into stats now so the UI
	// reflects it before the refetch lands. The next refresh() overwrites the
	// whole object, reconciling against the server.
	const applyOptimistic = useCallback(
		(patch: Partial<Stats> | ((current: Stats) => Partial<Stats>)) => {
			setStats((prev) => ({
				...prev,
				...(typeof patch === "function" ? patch(prev) : patch),
			}));
		},
		[],
	);

	return {
		stats,
		statsLoaded,
		statsError,
		refresh,
		scheduleRefresh,
		applyOptimistic,
	};
}
