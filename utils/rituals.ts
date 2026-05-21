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
	blurb: string;
}

export const BLESSING_META: Record<BlessingKind, RitualMeta> = {
	warm_tea: {
		name: "Warm Tea",
		emoji: "☕",
		blurb: "2× tickle regen for an hour.",
	},
	sun_beam: {
		name: "Sun Beam",
		emoji: "🌞",
		blurb: "Their next Lucky Pig doubles.",
	},
	halo_kiss: {
		name: "Halo Kiss",
		emoji: "😇",
		blurb: "A faint halo glow for six hours.",
	},
	bountiful_snouts: {
		name: "Bountiful Snouts",
		emoji: "🪙",
		blurb: "+5 snouts, right now.",
	},
};

export const CURSE_META: Record<CurseKind, RitualMeta> = {
	sluggish_snout: {
		name: "Sluggish Snout",
		emoji: "🐌",
		blurb: "Half tickle regen for an hour.",
	},
	phantom_itch: {
		name: "Phantom Itch",
		emoji: "✨",
		blurb: "Their next 3 taps count half.",
	},
	goblin_whisper: {
		name: "Goblin Whisper",
		emoji: "🟢",
		blurb: "A green miasma cloud for four hours.",
	},
	coin_pinch: {
		name: "Coin Pinch",
		emoji: "🤏",
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
