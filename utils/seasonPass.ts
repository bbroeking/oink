// Season Pass — the PURE derivation module for the season tab. No React, no
// fetch: every function here is a plain map over the season_state RPC shape, so
// the tier math (which reward is next, which tiers are ready, the claimed/tier
// index maps) is unit-testable and can't drift between the screen and the hook.
//
// hooks/useSeason owns the fetch + the memoized calls into here; app/(tabs)/
// season.tsx keeps the rendering. The explanatory comments below document real
// product rules (premium-under-glass, the prestige/Wallow track, the YOUR TAKE
// next-reward pick) — they moved with the code they explain.

// ── The season_state RPC shape ──────────────────────────────────────────────

export interface SeasonRow {
	id: string;
	name: string;
	starts_at: string;
	ends_at: string;
	total_tiers: number;
	xp_per_tier: number;
	premium_price_cents: number;
	premium_plus_price_cents: number;
}

// reward_value shape varies per reward_type — Supabase jsonb. Legacy seeds used
// category-specific keys (bg_id, aura_id, cape_id); the 20260514020000 migration
// normalized those to hat_id but the type still accepts the legacy keys for
// un-migrated rows.
export type RewardValue = {
	hat_id?: string;
	bg_id?: string;
	aura_id?: string;
	cape_id?: string;
	count?: number;
	amount?: number;
	title?: string;
} | null;

export interface TierRow {
	tier: number;
	track: "free" | "premium";
	reward_type: string;
	reward_value: RewardValue;
	display_label: string;
}

export interface ClaimRow {
	tier: number;
	track: "free" | "premium";
}

export interface SeasonState {
	active: boolean;
	season?: SeasonRow;
	tiers?: TierRow[];
	xp?: number;
	current_tier?: number;
	premium_unlocked?: boolean;
	wallow_count?: number;
	season_wallow_count?: number;
	can_wallow?: boolean;
	wallow_power_level?: number;
	wallow_regen_percent?: number;
	wallow_next_regen_percent?: number;
	wallow_regen_seconds?: number;
	wallow_next_regen_seconds?: number;
	wallow_tiers?: TierRow[];
	wallow_claims?: ClaimRow[];
	claims?: ClaimRow[];
}

// The tier index — each tier number to its (up to two) track rewards.
export type TiersByNumber = Record<number, { free?: TierRow; premium?: TierRow }>;

// The next-unclaimed-reward preview the YOUR TAKE strip renders. Kept here (not
// on the component) so the pure pick + the strip's prop type share one source.
export interface NextReward {
	reward_type: string;
	reward_value: {
		hat_id?: string;
		bg_id?: string;
		aura_id?: string;
		cape_id?: string;
		amount?: number;
	} | null;
	/** true when the tier is already reached — the reward is claimable now. */
	ready: boolean;
	/** XP still to earn before the reward unlocks (0 when ready). */
	xpAway: number;
	display_label: string;
}

// A tier's visual/claim state on a track.
export type TierState = "claimed" | "ready" | "locked";

// ── Keyed maps/sets from state ──────────────────────────────────────────────

// Claimed tiers as a `${tier}:${track}` set for O(1) membership.
export function claimedSet(claims: ClaimRow[] | undefined): Set<string> {
	const s = new Set<string>();
	(claims ?? []).forEach((c) => s.add(`${c.tier}:${c.track}`));
	return s;
}

// The tier index for the regular pass tracks.
export function tiersByNumber(tiers: TierRow[] | undefined): TiersByNumber {
	const map: TiersByNumber = {};
	(tiers ?? []).forEach((t) => {
		if (!map[t.tier]) map[t.tier] = {};
		map[t.tier][t.track] = t;
	});
	return map;
}

// Wallow (prestige) claims. The prestige path is single-track, so its claims key
// on `${tier}:free` regardless of the row's declared track.
export function wallowClaimedSet(claims: ClaimRow[] | undefined): Set<string> {
	const s = new Set<string>();
	(claims ?? []).forEach((c) => s.add(`${c.tier}:free`));
	return s;
}

// The prestige tier index — every wallow row is forced onto the free track so it
// shares the free-track rendering + claim path.
export function wallowTiersByNumber(tiers: TierRow[] | undefined): TiersByNumber {
	const map: TiersByNumber = {};
	(tiers ?? []).forEach((t) => {
		map[t.tier] = { free: { ...t, track: "free" } };
	});
	return map;
}

// Prestige mode — the player has Wallowed at least once this season, so the pass
// shows the sparse prestige path instead of the regular tracks.
export function prestigeMode(state: SeasonState | null): boolean {
	return (state?.season_wallow_count ?? 0) > 0;
}

// ── Derived selections ──────────────────────────────────────────────────────

// Per-track claimed/ready/locked tally for the stats pills.
export function tierStatsFor(
	rewardTiers: number[],
	currentTier: number,
	claimed: Set<string>,
	track: "free" | "premium"
): { claimed: number; ready: number; locked: number } {
	let claimedN = 0,
		ready = 0,
		locked = 0;
	for (const t of rewardTiers) {
		if (claimed.has(`${t}:${track}`)) claimedN++;
		else if (t <= currentTier) ready++;
		else locked++;
	}
	return { claimed: claimedN, ready, locked };
}

// YOUR TAKE — the next unclaimed reward for the strip's pass cell. Picks the
// lowest tier whose reward on the SHOWN track is still unclaimed; the shown
// track is premium only for members, so a non-premium player is never shown a
// reward they can't claim (falls back to the free next). READY when the tier is
// already reached (0 XP away); otherwise XP-away = the cumulative XP to reach
// that tier minus what's earned.
export function nextReward(
	state: SeasonState | null,
	maps: {
		prestige: boolean;
		tiersByNumber: TiersByNumber;
		claimedSet: Set<string>;
		wallowTiersByNumber: TiersByNumber;
		wallowClaimedSet: Set<string>;
	}
): NextReward | null {
	if (!state?.active || !state.season) return null;
	const total = state.season.total_tiers;
	const xpPer = state.season.xp_per_tier || 1;
	const xp = state.xp ?? 0;
	const curTier = state.current_tier ?? 1;
	const track: "free" | "premium" = maps.prestige
		? "free"
		: state.premium_unlocked ? "premium" : "free";
	const source = maps.prestige ? maps.wallowTiersByNumber : maps.tiersByNumber;
	const claims = maps.prestige ? maps.wallowClaimedSet : maps.claimedSet;
	for (let t = 1; t <= total; t++) {
		const reward = source[t]?.[track] ?? source[t]?.free;
		if (!reward) continue;
		// A tier's premium reward is gated for non-members — skip it so the
		// strip never advertises something un-claimable, and fall to free.
		const shown =
			track === "premium" && source[t]?.premium
				? source[t].premium!
				: source[t]?.free ?? reward;
		if (claims.has(`${t}:${shown.track}`)) continue;
		const ready = t <= curTier;
		const xpAway = ready ? 0 : Math.max(0, (t - 1) * xpPer - xp);
		return {
			reward_type: shown.reward_type,
			reward_value: shown.reward_value,
			display_label: shown.display_label,
			ready,
			xpAway,
		};
	}
	return null;
}

// The track whose rewards the pass list is showing. Prestige is single-track
// (free); otherwise the browsed tab, but only when the season actually seeds a
// premium track (else the free list stands alone).
export function shownTrack(
	state: SeasonState | null,
	passTrack: "free" | "premium",
	prestige: boolean
): "free" | "premium" {
	if (prestige) return "free";
	const hasPremium = (state?.tiers ?? []).some((r) => r.track === "premium");
	return hasPremium ? passTrack : "free";
}

// The tiers that are READY to claim on the shown track — reached (t ≤ current),
// not yet claimed, and carrying a reward. Lifted so the "claim all" affordance
// can appear when ≥1 waits and the sweep can iterate the same list.
export function readyTiers(
	state: SeasonState | null,
	opts: {
		prestige: boolean;
		shownTrack: "free" | "premium";
		tiersByNumber: TiersByNumber;
		claimedSet: Set<string>;
		wallowTiersByNumber: TiersByNumber;
		wallowClaimedSet: Set<string>;
	}
): number[] {
	const cur = state?.current_tier ?? 1;
	const total = state?.season?.total_tiers ?? 0;
	// Premium track under glass for non-members — nothing is claimable there.
	if (!opts.prestige && opts.shownTrack === "premium" && !state?.premium_unlocked) return [];
	const source = opts.prestige ? opts.wallowTiersByNumber : opts.tiersByNumber;
	const claims = opts.prestige ? opts.wallowClaimedSet : opts.claimedSet;
	const out: number[] = [];
	for (let t = 1; t <= total; t++) {
		if (t > cur) continue;
		if (claims.has(`${t}:${opts.shownTrack}`)) continue;
		if (!source[t]?.[opts.shownTrack]) continue;
		out.push(t);
	}
	return out;
}
