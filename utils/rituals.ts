// Client-side metadata + daily-rotation logic for the Season 1
// blessing / curse rituals. The rotation MUST match the SQL
// daily_blessing_kind / daily_curse_kind functions exactly
// (EXTRACT(DOY) % 4) or the UI will offer a different kind than
// the server will accept.

export type BlessingKind =
	| "warm_tea"
	| "sun_beam"
	| "halo_kiss"
	| "bountiful_snouts";

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
export const CURSE_ROTATION: CurseKind[] = [
	"sluggish_snout",
	"phantom_itch",
	"goblin_whisper",
	"coin_pinch",
];

interface RitualMeta {
	name: string;
	emoji: string;
	// require()'d art asset — the real icon, replaces the emoji.
	icon: number;
	blurb: string;
}

export const BLESSING_META: Record<BlessingKind, RitualMeta> = {
	warm_tea: {
		name: "Warm Tea",
		emoji: "☕",
		icon: require("../assets/images/emoji/warm-tea.png"),
		blurb: "2× tickle regen for an hour.",
	},
	sun_beam: {
		name: "Sun Beam",
		emoji: "🌞",
		icon: require("../assets/images/emoji/sun-beam.png"),
		blurb: "Huge Lucky Pig boost — burns off when one fires.",
	},
	halo_kiss: {
		name: "Halo Kiss",
		emoji: "😇",
		icon: require("../assets/images/emoji/halo-kiss.png"),
		blurb: "+5 tickles, right now.",
	},
	bountiful_snouts: {
		name: "Bountiful Snouts",
		emoji: "🪙",
		icon: require("../assets/images/emoji/bountiful-snouts.png"),
		blurb: "+5 snouts, right now.",
	},
};

export const CURSE_META: Record<CurseKind, RitualMeta> = {
	sluggish_snout: {
		name: "Sluggish Snout",
		emoji: "🐌",
		icon: require("../assets/images/emoji/sluggish-snout.png"),
		blurb: "Half tickle regen for an hour.",
	},
	phantom_itch: {
		name: "Phantom Itch",
		emoji: "✨",
		icon: require("../assets/images/emoji/phantom-itch.png"),
		blurb: "1-in-3 taps slip — for 24h.",
	},
	goblin_whisper: {
		name: "Goblin Whisper",
		emoji: "🟢",
		icon: require("../assets/images/emoji/goblin-whisper.png"),
		blurb: "A green miasma cloud for four hours.",
	},
	coin_pinch: {
		name: "Coin Pinch",
		emoji: "🤏",
		icon: require("../assets/images/emoji/coin-pinch.png"),
		blurb: "Snips up to 3 snouts (capped per day).",
	},
};

// Day-of-year, 1-366, in UTC — matches Postgres EXTRACT(DOY FROM ...).
export function dayOfYearUTC(d: Date = new Date()): number {
	const start = Date.UTC(d.getUTCFullYear(), 0, 0);
	const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	return Math.floor((now - start) / 86_400_000);
}

export function dailyBlessingKind(d: Date = new Date()): BlessingKind {
	return BLESSING_ROTATION[dayOfYearUTC(d) % 4];
}

export function dailyCurseKind(d: Date = new Date()): CurseKind {
	return CURSE_ROTATION[dayOfYearUTC(d) % 4];
}

// Unified accessor used by RitualPicker so it doesn't branch on mode
// at every call site.
export function dailyRitual(mode: RitualMode, d: Date = new Date()) {
	if (mode === "bless") {
		const kind = dailyBlessingKind(d);
		return { kind, ...BLESSING_META[kind] };
	}
	const kind = dailyCurseKind(d);
	return { kind, ...CURSE_META[kind] };
}
