// Sounder Mud Fights — client mirror of the server constants.
//
// These MUST match the values baked into supabase/migrations/
// 20260647000000_mud_fights.sql (Postgres has no shared module
// constants, so the server inlines them in each RPC). If you change a
// value here, change it there too — or wire up the optional
// `mud_fight_const()` SQL function (P3) so there's one source of truth.

export const DAILY_ALLOTMENT = 20; // legacy tap model (sling_mud fallback); superseded by the throw budget below

// Throw-minigame budget (Phase 1a — throw_mud). A daily budget of THROWS_PER_DAY
// throws, each worth at most PER_THROW_MAX mud (band whiff/weak/good/perfect ->
// 0/1/2/3); daily ceiling = THROWS_PER_DAY * PER_THROW_MAX = 21. MUST match the
// values inlined in throw_mud()/war_state() in 20260665.
export const THROWS_PER_DAY = 7;
export const PER_THROW_MAX = 3;
export const DAILY_MUD_CAP = THROWS_PER_DAY * PER_THROW_MAX; // 21

export const WAR_LENGTH_DAYS = 5; // active war window, stamped at accept (legacy per-capita wars)
export const WAR_LENGTH_DAYS_FRONTS = 7; // fronts-enabled wars run 7 days (MUST match challenge_house/accept_challenge in 20260667)
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

// ── Fronts (Phase 1c) — client mirror. MUST match 20260667000000_mud_war_fronts.sql.
export const FRONT_SCALE = 4;       // coord_notch = clamp(round(front_margin/FRONT_SCALE), -2, 2)
export const PER_FRONT_CAP = 12;    // per-member-per-front contribution cap at fold
export const FRONTS_PER_DAY = 3;    // V = [5,4,3]
export const MAX_NOTCH_FRONTS = 5;  // total daily notch clamp when fronts on (base ±4 + coord ±2)

// Player-facing names for the 6-front deck (front_key -> label).
export const FRONT_NAMES: Record<string, string> = {
	truffle: "Truffle Field",
	bridge: "Bog Bridge",
	gate: "Village Gate",
	sowpen: "Sow Pen",
	reed: "Reed Marsh",
	wallow: "Hog Wallow",
};

// The fuzzy hold-pressure hint shown on each front (exact P is hidden until fold).
export const P_BAND_LABEL: Record<string, string> = {
	light: "Lightly held",
	medium: "Held",
	heavy: "Heavily held",
};

// ── Rhythm (Songs of the Bog, Phase 1d) — client mirror.
// MUST match 20260668000000_mud_war_rhythm.sql. The HOLD run is a short conveyor
// of goblins; you TAP as each scored one crosses the strike line, sending an array
// of up to NOTES_PER_RUN band enums (whiff/weak/good/perfect). The server owns the
// band->mud map (same CASE throw_mud uses) + the per-day RUN budget. Every value
// here that isn't a wire band is COSMETIC — only the band classification leaves.
export const NOTES_PER_RUN = 3; // submit_run caps the scored note count at 3
export const RUN_LENGTH_MS = 12000; // a Hold run is ~12s
export const RUNS_PER_DAY = 2; // baseline daily runs (+1 per access token)
// Timing windows: |dt| from a note's ideal time in ms -> band (temporal classify).
export const PERFECT_WINDOW_MS = 45;
export const GOOD_WINDOW_MS = 90;
export const WEAK_WINDOW_MS = 150; // beyond this -> whiff (a leak)

// The PLAYABLE song's difficulty = the defended area's PUBLIC p_band (decision B):
// light -> easy, medium -> med, heavy -> hard. The opponent's DEPLOYED difficulty
// is a hidden hold-pressure, revealed only in the post-day recap (attackingMe).
// Local mirror of utils/mudWars' PBand — kept here (not imported) so this
// constants module stays dependency-free, matching the rest of the file.
export type PBand = "light" | "medium" | "heavy";
export type Difficulty = "easy" | "med" | "hard";
export const P_BAND_TO_DIFFICULTY: Record<PBand, Difficulty> = {
	light: "easy",
	medium: "med",
	heavy: "hard",
};
export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
	easy: "Easy",
	med: "Medium",
	hard: "Hard",
};

export const ATTEMPT_TOKEN_CAP = 1; // grant_war_access caps a recipient at 1 token/Hold day
export const WAR_COOLDOWN_HOURS = 24; // crews.next_war_at win-trade cooldown
export const BUILD_DAYS = 2; // Tend phase (days 1-2), build via the toss
export const WAR_DAYS = 5; // Hold phase (days 3-7), defend via rhythm runs

// Weekly siege modifier labels (display-only in v1; gameplay effects are a follow-up).
export const WEEKLY_MODIFIER_LABEL: Record<string, string> = {
	none: "",
	marquee_double: "Marquee front pays double",
	fogged_gold: "Fogged gold — perfect zone hidden",
	warboss_week: "Warboss Week",
};

export function frontName(key: string): string {
	return FRONT_NAMES[key] ?? key;
}

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
