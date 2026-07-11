// The Truffle Patch dig + Truffle Exchange — client mirror of the server
// constants. Digging is crew-gated, purely co-op vs the Great Hungerer: a find
// mints Golden Truffles AND drains the global hunger meter.
//
// These MUST match the values baked into the supabase migrations (Postgres has
// no shared module constants, so the server inlines them in each RPC). If you
// change a value here, change it there too.

// ── Truffle Patch (the 8h feeding-window dig heartbeat) — client mirror. ──────
// The board PRNG/parity contract lives in utils/rooting.ts.
export const ROOTING_WINDOW_SECS = 28800; // 8h feedings — 3 per day
// The patch is OPEN for the first 4h of each window (dig while he gorges),
// then GUARDED for the remaining 4h (cooldown). MUST match the server's
// patch_phase_open() — migration 20260721000000.
export const PATCH_OPEN_SECS = 14400;
export const STIR_BUDGET = 20;  // a session ends (gracefully) at full stir
export const STIR_RUB = 1;      // quiet scratch
export const STIR_SHOVE = 3;    // loud scoop
export const SHOVE_HOLD_MS = 400;
export const PATCH_COLS = 6;
export const PATCH_ROWS = 5;
export const TRUFFLE_POUCH_CAP = 999; // golden_truffles hard cap (never lossy)

// The global-meter milestones the whole barnyard crosses as it drains the
// Hungerer. MUST match the migration's milestone table (finds-denominated).
export const MILESTONE_THRESHOLDS = [150, 600, 1800];

// ── The Dig-Off, now a GLOBAL RACE — client mirror. ───────────────────────────
// Every Sounder races every other Sounder in weekly-anchored cycles (a new race
// every Mon + Thu 00:00 UTC; 3-day / 4-day alternate). Score is finds per
// digging snout; QUORUM diggers are needed to be ranked. Rank-scaled truffle
// spoils pay at cycle end. Draining is instant always — no banked pot anymore.
export const RACE_QUORUM = 2;

// Rank-scaled truffle payout per crew member at cycle end. Keys 1/2/3 are the
// podium; `topHalf` covers every other ranked crew in the top 50%; `ranked` is
// the floor for any remaining ranked crew.
// MUST match supabase/migrations/20260719000000.
export const RACE_TRUFFLE_TABLE = {
	1: 6,
	2: 5,
	3: 4,
	topHalf: 3,
	ranked: 2,
} as const;

// ── The Truffle Exchange (Season 1 P4) — client mirror. ──────────────────────
// MUST MATCH supabase/migrations/20260704300000_truffle_exchange.sql:
// exchange_week_stock()'s tier arrays (alphabetic within tier) + token_cost
// prices + the milestone table in mint_mud_milestones().
export type ExchangeTier = "muddy" | "caked" | "prize" | "champion" | "heirloom";

export const EXCHANGE_TIERS: Record<ExchangeTier, readonly string[]> = {
	muddy: ["mud_pit_bg", "mud_shovel", "mud_splatter_aura", "muddy_cap", "slop_bucket"],
	caked: ["mud_pie", "reed_hat", "reed_marsh_bg", "slop_bucket_hat", "swamp_bubble_aura"],
	prize: ["bog_helmet", "crew_pennant", "firefly_aura", "golden_truffle", "mud_derby_bg", "prize_sash", "rosette_cap"],
	champion: ["bog_dusk_bg", "confetti_aura", "festival_pennant", "golden_bog_aura", "swamp_crown"],
	heirloom: ["festival_night_bg", "golden_mire_bg", "heirloom_mire_aura"],
};

export const EXCHANGE_PRICES: Record<ExchangeTier, number> = {
	muddy: 25,
	caked: 60,
	prize: 120,
	champion: 250,
	heirloom: 500,
};

// Tier names relabel the shipped hats.rarity values (spec §5).
export const RARITY_TO_TIER: Record<string, ExchangeTier> = {
	common: "muddy",
	uncommon: "caked",
	rare: "prize",
	epic: "champion",
	legendary: "heirloom",
};

export const EXCHANGE_TIER_LABEL: Record<ExchangeTier, string> = {
	muddy: "Muddy",
	caked: "Caked",
	prize: "Prize",
	champion: "Champion",
	heirloom: "Heirloom",
};

// In-week personal milestone mints (cross threshold → truffles).
export const TRUFFLE_MILESTONES: ReadonlyArray<readonly [number, number]> = [
	[10, 5],
	[25, 10],
	[50, 15],
];

// The pool of exclusive cosmetics surfaced in the Exchange + the rewards
// catalog. Sourced from the seeded cost=0 items (unbuyable with snouts).
export const EXCHANGE_ITEM_IDS = [
	"muddy_cap", "slop_bucket_hat", "reed_hat", "bog_helmet", "swamp_crown",
	"slop_bucket", "mud_shovel", "mud_pie", "golden_truffle", "crew_pennant",
	"mud_splatter_aura", "swamp_bubble_aura", "firefly_aura", "golden_bog_aura", "heirloom_mire_aura",
	"mud_pit_bg", "reed_marsh_bg", "mud_derby_bg", "bog_dusk_bg", "golden_mire_bg", "festival_night_bg",
	"rosette_cap", "prize_sash", "festival_pennant", "confetti_aura",
] as const;
