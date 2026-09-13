// The Truffle Patch dig + Truffle Exchange — client mirror of the server
// constants. Digging is crew-gated, purely co-op vs the Great Hungerer: a find
// mints Golden Truffles AND drains the global hunger meter.
//
// These MUST match the values baked into the supabase migrations (Postgres has
// no shared module constants, so the server inlines them in each RPC). If you
// change a value here, change it there too.

// ── Truffle Patch (the 8h feeding-window dig heartbeat) — client mirror. ──────
// The board PRNG/parity contract lives in utils/rooting.ts.
//
// SCHEDULE NOTE: the three window-geometry constants below are the compiled
// FALLBACK DEFAULTS. The live values are SERVER-AUTHORITATIVE — the
// app_settings.feeding_schedule row (migration 20260744100000), fetched and
// clamped by utils/feedingConfig.ts — so a future schedule change is one
// server UPDATE for modes the installed client understands. New modes require
// a compatible binary first. These defaults match the original seeded row and
// are used before the first fetch.
export const ROOTING_WINDOW_SECS = 28800; // 8h feedings — 3 per day
// The window anchor: boundaries sit at 02:00 / 10:00 / 18:00 UTC (epoch minus
// this offset, bucketed by 8h). Founder call 2026-07-16 — the US-Eastern sweet
// spots: the 10–14 UTC open catches the 6–10am commute, 18–22 UTC the 2–6pm
// homecoming, 02–06 UTC the 10pm–2am wind-down; the 8–10pm ET block was
// explicitly traded away. Anchored to UTC, so the schedule slides an hour
// across US DST changes — accepted. MUST match the server's window math —
// migration 20260744000000.
export const ROOTING_WINDOW_OFFSET_SECS = 7200; // +2h — windows at 02/10/18 UTC
// The patch is OPEN for the first 4h of each window (dig while he gorges),
// then GUARDED for the remaining 4h (cooldown). MUST match the server's
// patch_phase_open() — migrations 20260721000000 + 20260744000000.
export const PATCH_OPEN_SECS = 14400;

// Server-owned commuter schedules: legacy Eastern hours or three player-local
// Feedings at 08–12, 16–20 and 00–04. The database resolves civil time from the
// persisted zone; dig RPCs accept no phone offset. The client clock is for
// display and is always overruled by open_rooting()/submit_rooting().
export const DIG_TIME_ZONE = "America/New_York";
export const DIG_DAY_ANCHOR_MIN = 360; // 6:00am Eastern
export const DIG_LOCAL_DAY_ANCHOR_MIN = 480; // 8:00am in the persisted player zone
export const DIG_DAY_MIN = 1440;
export const DIG_BUCKET_STARTS = [0, 360, 660, 900] as const;
export const DIG_BUCKET_OPEN_MINS = [240, 120, 180, 120] as const;
export const DIG_WINDOWS_PER_DAY = DIG_BUCKET_STARTS.length;
export const DIG_LOCAL_BUCKET_STARTS = [0, 480, 960] as const;
export const DIG_LOCAL_BUCKET_OPEN_MINS = [240, 240, 240] as const;
export const DIG_LOCAL_WINDOWS_PER_DAY = DIG_LOCAL_BUCKET_STARTS.length;
export const DIG_LOCAL_WINDOW_ID_OFFSET = 1_000_000_000;
export const STIR_BUDGET = 20; // a session ends (gracefully) at full stir
export const STIR_RUB = 1; // quiet scratch
export const STIR_SHOVE = 3; // loud scoop
export const SHOVE_HOLD_MS = 400;
export const PATCH_COLS = 6;
export const PATCH_ROWS = 5;

// The global-meter milestones the whole barnyard crosses as it drains the
// Hungerer. MUST match the migration's milestone table (finds-denominated).
export const MILESTONE_THRESHOLDS = [150, 600, 1800];

// ── The Dig-Off, now a GLOBAL RACE — client mirror. ───────────────────────────
// Every Sounder races every other Sounder in weekly-anchored cycles (a new race
// every Mon + Thu 00:00 UTC; 3-day / 4-day alternate). Score is finds per
// digging snout; QUORUM diggers are needed to be ranked. Rank-scaled truffle
// spoils pay at cycle end. Draining is instant always — no banked pot anymore.
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
export type ExchangeTier =
  "muddy" | "caked" | "prize" | "champion" | "heirloom";

export const EXCHANGE_TIERS: Record<ExchangeTier, readonly string[]> = {
  muddy: [
    "mud_pit_bg",
    "mud_shovel",
    "mud_splatter_aura",
    "muddy_cap",
    "slop_bucket",
  ],
  caked: [
    "mud_pie",
    "reed_hat",
    "reed_marsh_bg",
    "slop_bucket_hat",
    "swamp_bubble_aura",
  ],
  prize: [
    "bog_helmet",
    "crew_pennant",
    "firefly_aura",
    "golden_truffle",
    "mud_derby_bg",
    "prize_sash",
    "rosette_cap",
  ],
  champion: [
    "bog_dusk_bg",
    "confetti_aura",
    "festival_pennant",
    "golden_bog_aura",
    "swamp_crown",
  ],
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
  "muddy_cap",
  "slop_bucket_hat",
  "reed_hat",
  "bog_helmet",
  "swamp_crown",
  "slop_bucket",
  "mud_shovel",
  "mud_pie",
  "golden_truffle",
  "crew_pennant",
  "mud_splatter_aura",
  "swamp_bubble_aura",
  "firefly_aura",
  "golden_bog_aura",
  "heirloom_mire_aura",
  "mud_pit_bg",
  "reed_marsh_bg",
  "mud_derby_bg",
  "bog_dusk_bg",
  "golden_mire_bg",
  "festival_night_bg",
  "rosette_cap",
  "prize_sash",
  "festival_pennant",
  "confetti_aura",
] as const;

// ── Snout Deep (the press-your-luck dig with a nose) — client mirror. ────────
// Spec: docs/dig-redesign/a-snout-deep-spec.md. The patch is three layers
// (topsoil · mud · the root), each PATCH_COLS × PATCH_ROWS, every tile
// TILE_DEPTH deep so a rub half-clears and shows the silhouette. No stir
// budget: the cost of an action is noise — its chance of waking the Great
// Hungerer. MUST match the server once `submit_rooting_deep` lands (§6).
export const PATCH_LAYERS = 3;
export const TILE_DEPTH = 2;
// The dig ends as a tie on its 45th action (a wake on the 45th still wins).
export const SNOUT_DEEP_ACTION_CAP = 45;

export type SnoutDeepVerb = "sniff" | "rub" | "shove";
export type SnoutDeepLayer = 0 | 1 | 2;

// The wake die: every non-no-op action draws one nextInt(WAKE_DIE) from the
// seed's wake stream and wakes him when the draw is BELOW the threshold.
export const WAKE_DIE = 120;
// Wake thresholds in 120ths, by layer then verb (spec §1.4). Sniffs never
// wake him in topsoil or the mud — the nose is the mechanic those layers
// teach, so it must be safe there. Mud rub = 1 in 20 · shove = 1 in 6 · root
// sniff ≈ 1 in 17 · rub = 1 in 8 · shove = 1 in 3.
export const WAKE_TABLE: Readonly<
  Record<SnoutDeepLayer, Readonly<Record<SnoutDeepVerb, number>>>
> = {
  0: { sniff: 0, rub: 0, shove: 10 },
  1: { sniff: 0, rub: 6, shove: 20 },
  2: { sniff: 7, rub: 15, shove: 40 },
};
// Co-op (a crewmate submitted this Feeding) halves the ROOT's sniff and rub
// thresholds — integer floor + 1, so 7 → 4 and 15 → 8. Shove is unchanged,
// and nothing else in the game changes with co-op (§1.4).
export const WAKE_COOP_LAYER: SnoutDeepLayer = 2;
export const WAKE_COOP_VERBS: readonly SnoutDeepVerb[] = ["sniff", "rub"];

// What can be buried. Food is truffles, only — loose until banked, his if he
// wakes. Everything else is a thing: yours the moment its last tile clears.
// Stones are inert (never a find, never scent).
export type DigFindKind =
  | "truffle_d"
  | "truffle_l"
  | "boom"
  | "pouch"
  | "apple"
  | "junk"
  | "shimmer"
  | "acorn"
  | "tea"
  | "scroll"
  | "relic"
  | "furnishing"
  | "bow"
  | "charm"
  | "stone";
export const DIG_FOOD_KINDS: readonly DigFindKind[] = ["truffle_d", "truffle_l"];
export function isDigFood(kind: DigFindKind): boolean {
  return DIG_FOOD_KINDS.includes(kind);
}

// Per-layer find odds (spec §2), as [numerator, denominator] "n in d". The
// live values are server config (`app_settings.dig_finds`); these are the
// compiled fallbacks. A find with no entry is always present (the truffles,
// the Boom, the junk keepsake, the stones — see DIG_LAYER_STONES).
export const DIG_FINDS: Readonly<
  Partial<Record<DigFindKind, readonly [number, number]>>
> = {
  pouch: [1, 2],
  apple: [1, 3],
  shimmer: [1, 2],
  acorn: [1, 2],
  tea: [1, 3],
  scroll: [1, 3],
  relic: [2, 5],
  furnishing: [1, 4],
  bow: [1, 12],
  charm: [1, 3],
};
// Stones per layer: 3 in topsoil, 2 in the mud, 1 at the root.
export const DIG_LAYER_STONES: Readonly<Record<SnoutDeepLayer, number>> = {
  0: 3,
  1: 2,
  2: 1,
};
// The three shelf keepsakes the topsoil junk can be (one per board).
export const DIG_JUNK_VARIANTS = ["boot", "horseshoe", "cap"] as const;
export type DigJunkVariant = (typeof DIG_JUNK_VARIANTS)[number];
