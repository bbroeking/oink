// The Truffle Patch dig + Truffle Exchange — client mirror of the server
// constants. Digging is crew-gated, purely co-op vs the Great Hungerer: a find
// mints Golden Truffles AND drains the global hunger meter.
//
// These MUST match the values baked into the supabase migrations (Postgres has
// no shared module constants, so the server inlines them in each RPC). If you
// change a value here, change it there too.

// ── Truffle Patch — the LOCAL-time "commuter" feeding schedule — client mirror. ─
// The board PRNG/parity contract lives in utils/rooting.ts.
//
// The patch runs on the player's PHONE-LOCAL clock (not UTC), so everyone gets
// the same friendly hours wherever they are. The day is anchored at 6:00am local
// and tiled into four non-uniform windows ("buckets"). Each bucket is OPEN
// (diggable) for a span at its START, then GORGES (guarded) until the next bucket
// — so the long overnight stretch (11pm→6am) is one big sleep-time gorge:
//
//   morning    6:00–10:00a  (open 4h)   then gorge to 12:00p
//   lunch     12:00– 2:00p  (open 2h)   then gorge to  5:00p
//   evening    5:00– 8:00p  (open 3h)   then gorge to  9:00p
//   wind-down  9:00–11:00p  (open 2h)   then OVERNIGHT gorge to 6:00a
//
// A window index is `digDay * DIG_WINDOWS_PER_DAY + bucket` — one dig per bucket
// (up to 4/day). These values MUST match the server's schedule helpers in
// migration 20260740000000_dig_schedule_commuter_local.sql. If you change one,
// change both.
export const DIG_DAY_ANCHOR_MIN = 360;   // 6:00am local — where the dig-day starts
export const DIG_DAY_MIN = 1440;         // minutes in a day
// Each bucket's START (minutes from the 6am anchor) and its OPEN duration (min).
// Bucket b is open while (m - START[b]) < OPEN[b]; guarded until START[b+1].
export const DIG_BUCKET_STARTS = [0, 360, 660, 900] as const;    // 6a, 12p, 5p, 9p
export const DIG_BUCKET_OPEN_MINS = [240, 120, 180, 120] as const; // 4h, 2h, 3h, 2h
export const DIG_WINDOWS_PER_DAY = DIG_BUCKET_STARTS.length;        // 4
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
