// Client-side metadata + daily-rotation logic for the blessing / curse
// rituals. The rotation MUST match the SQL daily_blessing_kind /
// daily_curse_kind functions exactly (EXTRACT(DOY) % 4) or the UI will
// offer a different kind than the server will accept.
//
// Season 1 swaps in a new blessing set (same mechanics, Hunger fiction):
// the server rolls the S1 pool when the world_boss GLOBAL flag is on, so
// callers pass the same flag here (per-user dev overrides can preview the
// S1 art but the server's cast follows the global — cosmetic-only skew).

export type BlessingKind =
	| "warm_tea"
	| "sun_beam"
	| "halo_kiss"
	| "bountiful_snouts"
	| "mud_wrap"
	| "glimmer_truffle"
	| "snoot_boop"
	| "trough_bounty"
	// System-granted (never in the daily rotation): the crew-wide Chorus
	// glow — 3+ crewmates casting within 30 min.
	| "chorus_glow";

export type CurseKind =
	| "sluggish_snout"
	| "phantom_itch"
	| "goblin_whisper"
	| "coin_pinch";

export type RitualMode = "bless" | "curse";

// Rotation order — index 0..3 picked by (dayOfYear % 4).
export const BLESSING_ROTATION: BlessingKind[] = [
	"warm_tea",
	"sun_beam",
	"halo_kiss",
	"bountiful_snouts",
];
// Season-1 set — mechanical analogs in the same rotation slots
// (regen / lucky / +tickles / +snouts), so the day's MECHANIC is
// identical across seasons and only the fiction changes.
export const BLESSING_ROTATION_S1: BlessingKind[] = [
	"mud_wrap",
	"glimmer_truffle",
	"snoot_boop",
	"trough_bounty",
];
export const CURSE_ROTATION: CurseKind[] = [
	"sluggish_snout",
	"phantom_itch",
	"goblin_whisper",
	"coin_pinch",
];

interface RitualMeta {
	name: string;
	// require()'d art asset — the only rendered ritual icon.
	icon: number;
	blurb: string;
}

export const BLESSING_META: Record<BlessingKind, RitualMeta> = {
	warm_tea: {
		name: "Warm Tea",
		icon: require("../assets/images/emoji/warm-tea.png"),
		blurb: "Tickle regen runs at double speed for a few hours.",
	},
	sun_beam: {
		name: "Sun Beam",
		icon: require("../assets/images/emoji/sun-beam.png"),
		blurb: "A big Lucky-Pig boost — pops on the next lucky pig.",
	},
	halo_kiss: {
		name: "Halo Kiss",
		icon: require("../assets/images/emoji/halo-kiss.png"),
		blurb: "+5 tickles, right now.",
	},
	bountiful_snouts: {
		name: "Bountiful Snouts",
		icon: require("../assets/images/emoji/bountiful-snouts.png"),
		blurb: "+5 snouts, right now.",
	},
	// ── Season 1 set — icons are S0 stand-ins until the icon-gen art
	//    pass lands (mud-wrap / glimmer-truffle / snoot-boop /
	//    trough-bounty pngs). ──
	mud_wrap: {
		name: "Mud Wrap",
		icon: require("../assets/images/emoji/warm-tea.png"),
		blurb: "A warm mud wrap — tickle regen runs double speed for a few hours.",
	},
	glimmer_truffle: {
		name: "Glimmer Truffle",
		icon: require("../assets/images/emoji/sun-beam.png"),
		blurb: "A glimmering truffle — pops on your next lucky pig.",
	},
	snoot_boop: {
		name: "Snoot Boop",
		icon: require("../assets/images/emoji/halo-kiss.png"),
		blurb: "+5 tickles, right now.",
	},
	trough_bounty: {
		name: "Trough Bounty",
		icon: require("../assets/images/emoji/bountiful-snouts.png"),
		blurb: "+5 snouts, right now.",
	},
	chorus_glow: {
		name: "Chorus Glow",
		icon: require("../assets/images/emoji/blessed.png"),
		blurb: "The Sounder sang together — regen runs double for the hour.",
	},
};

export const CURSE_META: Record<CurseKind, RitualMeta> = {
	sluggish_snout: {
		name: "Sluggish Snout",
		icon: require("../assets/images/emoji/sluggish-snout.png"),
		blurb: "Tickle regen runs at half speed for a few hours.",
	},
	phantom_itch: {
		name: "Phantom Itch",
		icon: require("../assets/images/emoji/phantom-itch.png"),
		blurb: "1 in 3 taps slip off — for a few hours.",
	},
	goblin_whisper: {
		name: "Goblin Whisper",
		icon: require("../assets/images/emoji/goblin-whisper.png"),
		blurb: "A green haze hangs over the Barn — spooky, but harmless.",
	},
	coin_pinch: {
		name: "Coin Pinch",
		icon: require("../assets/images/emoji/coin-pinch.png"),
		blurb: "Snips 1–3 snouts on the spot (max 10/day).",
	},
};

// Day-of-year, 1-366, in UTC — matches Postgres EXTRACT(DOY FROM ...).
export function dayOfYearUTC(d: Date = new Date()): number {
	const start = Date.UTC(d.getUTCFullYear(), 0, 0);
	const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	return Math.floor((now - start) / 86_400_000);
}

export function dailyBlessingKind(d: Date = new Date(), s1 = false): BlessingKind {
	return (s1 ? BLESSING_ROTATION_S1 : BLESSING_ROTATION)[dayOfYearUTC(d) % 4];
}

export function dailyCurseKind(d: Date = new Date()): CurseKind {
	return CURSE_ROTATION[dayOfYearUTC(d) % 4];
}

// Unified accessor used by RitualPicker so it doesn't branch on mode
// at every call site. `s1` mirrors the server's world_boss GLOBAL.
export function dailyRitual(mode: RitualMode, d: Date = new Date(), s1 = false) {
	if (mode === "bless") {
		const kind = dailyBlessingKind(d, s1);
		return { kind, ...BLESSING_META[kind] };
	}
	const kind = dailyCurseKind(d);
	return { kind, ...CURSE_META[kind] };
}
