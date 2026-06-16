// Sounder Mud Fights — client mirror of the server constants.
//
// These MUST match the values baked into supabase/migrations/
// 20260647000000_mud_fights.sql (Postgres has no shared module
// constants, so the server inlines them in each RPC). If you change a
// value here, change it there too — or wire up the optional
// `mud_fight_const()` SQL function (P3) so there's one source of truth.

export const DAILY_ALLOTMENT = 20; // flat mud-slings per member per UTC day, use-or-lose
export const WAR_LENGTH_DAYS = 5; // active war window, stamped at accept
export const QUORUM = 2; // min active members for a crew's score to count
export const CREW_CAP = 5; // max members per Sounder
export const BOT_DAILY_PACE = 12; // house "ghost crew" synthetic per-day score
export const HOUSE_BONUS = 25; // flat snout bonus for beating the house (no loser pot)
export const BUFF_HOURS = 72; // war-winner regen buff duration
export const BUFF_MULT = 0.85; // war-winner regen multiplier (faster regen)

// The seeded house-bot crew. Used by challenge_house(); surfaced as
// "The Mudlarks" in the war screen.
export const BOT_CREW_ID = "00000000-0000-0000-0000-0000000000b0";
export const BOT_CREW_NAME = "The Mudlarks";

// The 25 war-exclusive cosmetics (seeded cost=0 in 20260650, flagged
// war_exclusive in 20260660). Source of truth for the "War Spoils" rewards
// display + the grant pool. Keep in sync with the 20260650 seed.
export const WAR_SPOILS_IDS = [
	"muddy_cap", "slop_bucket_hat", "reed_hat", "bog_helmet", "swamp_crown",
	"slop_bucket", "mud_shovel", "mud_pie", "golden_truffle", "crew_pennant",
	"mud_splatter_aura", "swamp_bubble_aura", "firefly_aura", "golden_bog_aura", "heirloom_mire_aura",
	"mud_pit_bg", "reed_marsh_bg", "mud_derby_bg", "bog_dusk_bg", "golden_mire_bg", "festival_night_bg",
	"rosette_cap", "prize_sash", "festival_pennant", "confetti_aura",
] as const;
