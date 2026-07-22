// Pure-logic tests for the season-pass derivations (utils/seasonPass). These pin
// the tier math the season tab renders: the claimed/tier index shaping, the YOUR
// TAKE next-reward pick (premium member vs free player vs prestige, the
// premium-gated-falls-to-free rule, ready vs xpAway), the claim-all readyTiers
// eligibility (claims, current tier, premium-under-glass), and the stats tally.
// The module is pure (no React, no fetch), so no mocks are needed.

import {
	SeasonState,
	TierRow,
	claimedSet,
	nextReward,
	prestigeMode,
	readyTiers,
	shownTrack,
	tierStatsFor,
	tiersByNumber,
	wallowClaimedSet,
	wallowTiersByNumber,
} from "@/utils/seasonPass";

// ── Fixtures ────────────────────────────────────────────────────────────────

const row = (
	tier: number,
	track: "free" | "premium",
	reward_type: string,
	reward_value: TierRow["reward_value"] = null,
	display_label = `${track} t${tier}`
): TierRow => ({ tier, track, reward_type, reward_value, display_label });

// A 3-tier season, xp_per_tier 100. Free track on every tier; premium reward on
// tiers 1 + 2 only (tier 3 is free-only).
const TIERS: TierRow[] = [
	row(1, "free", "tickles", { amount: 50 }),
	row(1, "premium", "hat", { hat_id: "muddy_cap" }),
	row(2, "free", "hat", { hat_id: "reed_hat" }),
	row(2, "premium", "aura", { aura_id: "firefly_aura" }),
	row(3, "free", "title", { title: "Baron" }),
];

const baseState = (over: Partial<SeasonState> = {}): SeasonState => ({
	active: true,
	season: {
		id: "s1",
		name: "Season 1",
		starts_at: "",
		ends_at: "",
		total_tiers: 3,
		xp_per_tier: 100,
		premium_price_cents: 0,
		premium_plus_price_cents: 0,
	},
	tiers: TIERS,
	xp: 50,
	current_tier: 1,
	premium_unlocked: false,
	claims: [],
	...over,
});

const mapsFor = (s: SeasonState) => ({
	prestige: prestigeMode(s),
	tiersByNumber: tiersByNumber(s.tiers),
	claimedSet: claimedSet(s.claims),
	wallowTiersByNumber: wallowTiersByNumber(s.wallow_tiers),
	wallowClaimedSet: wallowClaimedSet(s.wallow_claims),
});

// ── Keyed maps/sets ─────────────────────────────────────────────────────────

describe("claimedSet / tiersByNumber shaping", () => {
	it("keys claimed tiers by `${tier}:${track}`", () => {
		const s = claimedSet([
			{ tier: 1, track: "free" },
			{ tier: 2, track: "premium" },
		]);
		expect(s.has("1:free")).toBe(true);
		expect(s.has("2:premium")).toBe(true);
		expect(s.has("2:free")).toBe(false);
		expect(s.size).toBe(2);
	});

	it("indexes tiers by number with up to two tracks each", () => {
		const map = tiersByNumber(TIERS);
		expect(map[1].free?.reward_type).toBe("tickles");
		expect(map[1].premium?.reward_type).toBe("hat");
		expect(map[2].premium?.reward_type).toBe("aura");
		expect(map[3].free?.reward_type).toBe("title");
		expect(map[3].premium).toBeUndefined();
	});

	it("empty/undefined inputs shape to empty containers", () => {
		expect(claimedSet(undefined).size).toBe(0);
		expect(Object.keys(tiersByNumber(undefined))).toHaveLength(0);
	});

	it("wallow claims force the free key; wallow tiers force the free track", () => {
		expect(wallowClaimedSet([{ tier: 1, track: "premium" }]).has("1:free")).toBe(true);
		const map = wallowTiersByNumber([row(1, "premium", "tickles", { amount: 10 })]);
		expect(map[1].free?.track).toBe("free");
		expect(map[1].free?.reward_type).toBe("tickles");
	});
});

describe("prestigeMode", () => {
	it("is true once the player has Wallowed this season", () => {
		expect(prestigeMode(baseState({ season_wallow_count: 2 }))).toBe(true);
	});
	it("is false at zero / undefined / null", () => {
		expect(prestigeMode(baseState({ season_wallow_count: 0 }))).toBe(false);
		expect(prestigeMode(baseState())).toBe(false);
		expect(prestigeMode(null)).toBe(false);
	});
});

// ── nextReward (YOUR TAKE pick) ─────────────────────────────────────────────

describe("nextReward", () => {
	it("free player: shows the free reward at the current tier, READY, 0 XP away", () => {
		const s = baseState();
		const r = nextReward(s, mapsFor(s));
		expect(r).not.toBeNull();
		expect(r!.reward_type).toBe("tickles");
		expect(r!.ready).toBe(true);
		expect(r!.xpAway).toBe(0);
	});

	it("premium member: shows the premium reward on a tier that has one", () => {
		const s = baseState({ premium_unlocked: true });
		const r = nextReward(s, mapsFor(s));
		expect(r!.reward_type).toBe("hat");
		expect(r!.display_label).toBe("premium t1");
	});

	it("premium-gated: a non-member is never shown the premium reward — falls to free", () => {
		// Tier 1 has BOTH free + premium; a free player must see the FREE one.
		const s = baseState({ premium_unlocked: false });
		const r = nextReward(s, mapsFor(s));
		expect(r!.display_label).toBe("free t1");
		expect(r!.reward_type).toBe("tickles");
	});

	it("computes xpAway for a not-yet-reached tier (cumulative XP minus earned)", () => {
		// Claim tier 1 free so the next unclaimed free reward is tier 2. Player is at
		// tier 1 with 50 XP; tier 2 needs (2-1)*100 = 100 → 50 XP away.
		const s = baseState({ claims: [{ tier: 1, track: "free" }] });
		const r = nextReward(s, mapsFor(s));
		expect(r!.display_label).toBe("free t2");
		expect(r!.ready).toBe(false);
		expect(r!.xpAway).toBe(50);
	});

	it("prestige mode: picks off the wallow track", () => {
		const s = baseState({
			season_wallow_count: 1,
			wallow_tiers: [row(1, "free", "snouts", { count: 5 }, "wallow t1")],
			wallow_claims: [],
		});
		const r = nextReward(s, mapsFor(s));
		expect(r!.reward_type).toBe("snouts");
		expect(r!.display_label).toBe("wallow t1");
	});

	it("returns null when the season is inactive", () => {
		const s = baseState({ active: false });
		expect(nextReward(s, mapsFor(s))).toBeNull();
	});
});

// ── shownTrack ──────────────────────────────────────────────────────────────

describe("shownTrack", () => {
	it("is always free in prestige mode", () => {
		expect(shownTrack(baseState(), "premium", true)).toBe("free");
	});
	it("follows the browsed tab when the season seeds a premium track", () => {
		expect(shownTrack(baseState(), "premium", false)).toBe("premium");
		expect(shownTrack(baseState(), "free", false)).toBe("free");
	});
	it("falls back to free when there is no premium track", () => {
		const s = baseState({ tiers: [row(1, "free", "tickles", { amount: 1 })] });
		expect(shownTrack(s, "premium", false)).toBe("free");
	});
});

// ── readyTiers ──────────────────────────────────────────────────────────────

describe("readyTiers", () => {
	const opts = (s: SeasonState, track: "free" | "premium") => ({
		...mapsFor(s),
		shownTrack: track,
	});

	it("lists reached, unclaimed, reward-bearing tiers on the free track", () => {
		const s = baseState({ current_tier: 2 });
		expect(readyTiers(s, opts(s, "free"))).toEqual([1, 2]);
	});

	it("respects claims", () => {
		const s = baseState({ current_tier: 2, claims: [{ tier: 1, track: "free" }] });
		expect(readyTiers(s, opts(s, "free"))).toEqual([2]);
	});

	it("stops at the current tier", () => {
		const s = baseState({ current_tier: 1 });
		expect(readyTiers(s, opts(s, "free"))).toEqual([1]);
	});

	it("premium under glass: a non-member gets nothing claimable on premium", () => {
		const s = baseState({ current_tier: 2, premium_unlocked: false });
		expect(readyTiers(s, opts(s, "premium"))).toEqual([]);
	});

	it("premium member: reached tiers carrying a premium reward are claimable", () => {
		const s = baseState({ current_tier: 2, premium_unlocked: true });
		// Premium rewards exist on tiers 1 + 2 only.
		expect(readyTiers(s, opts(s, "premium"))).toEqual([1, 2]);
	});
});

// ── tierStatsFor ────────────────────────────────────────────────────────────

describe("tierStatsFor", () => {
	it("tallies claimed / ready / locked across a track", () => {
		const claimed = new Set<string>(["1:free"]);
		expect(tierStatsFor([1, 2, 3], 2, claimed, "free")).toEqual({
			claimed: 1,
			ready: 1,
			locked: 1,
		});
	});
});
