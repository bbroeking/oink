// Client-side metadata + daily-rotation logic for the blessing / curse
// rituals.
//
// THE ROTATION IS WEEKDAY-LOCKED (2026-09-14, weekday-rituals plan). The ISO
// weekday of the UTC date picks the day's pair — Monday is always Cloud Nine
// and Pickle Brine, Friday is always Golden Hour and Bacon Bits — so days earn
// reputations. `BLESSING_ROTATION` / `CURSE_ROTATION` MUST match the SQL
// daily_blessing_kind / daily_curse_kind arrays exactly (both index
// EXTRACT(ISODOW FROM now() AT TIME ZONE 'UTC')) or the UI would offer a kind
// the server won't cast. The season flag no longer branches any of this: the
// old `world_boss` / S1 mirror is gone, because a rotation that branches on a
// flag has already bitten once.
//
// Rituals are COSMETIC ONLY. A blurb here describes what you SEE for six
// hours; the recipe that draws it lives in `constants/ritualFx.ts`.
//
// Plan: docs/design/2026-09-14-weekday-rituals-plan.md

import { formatHM } from "./duration";

export type BlessingKind =
	// The week, Monday first.
	| "cloud_nine"
	| "bubble_bath"
	| "butterfly_crown"
	| "confetti_snout"
	| "golden_hour"
	| "firefly_night"
	| "sunday_best"
	// System-granted (never in the daily rotation): the crew-wide Chorus
	// glow — 3+ crewmates casting within 30 min — and the Dig-Off winner's
	// 72h regen glow, both written by the server as self-rows.
	| "chorus_glow"
	| "war_winner_regen";

export type CurseKind =
	// The week, Monday first.
	| "pickle_brine"
	| "topsy_turvy"
	| "pipsqueak"
	| "little_raincloud"
	| "bacon_bits"
	| "hiccups"
	| "old_timey";

export type RitualMode = "bless" | "curse";

// Rotation order — index 0..6 picked by (isoWeekdayUTC - 1), Monday first.
export const BLESSING_ROTATION: BlessingKind[] = [
	"cloud_nine",
	"bubble_bath",
	"butterfly_crown",
	"confetti_snout",
	"golden_hour",
	"firefly_night",
	"sunday_best",
];
export const CURSE_ROTATION: CurseKind[] = [
	"pickle_brine",
	"topsy_turvy",
	"pipsqueak",
	"little_raincloud",
	"bacon_bits",
	"hiccups",
	"old_timey",
];

export interface RitualMeta {
	name: string;
	// require()'d art asset — the only rendered ritual icon.
	icon: number;
	blurb: string;
}

// Icons: one painted sticker per weekday kind, generated in the Codex ImageGen
// lane (2026-09-14 art pass) and living beside the S0 set in
// assets/images/emoji/. The two system-granted kinds below reuse `blessed.png`
// on purpose — they are not part of the weekday rotation and never appear in a
// ritual door, only on an effect card.
export const BLESSING_META: Record<BlessingKind, RitualMeta> = {
	cloud_nine: {
		name: "Cloud Nine",
		icon: require("../assets/images/emoji/cloud-nine.png"),
		blurb: "Your pig floats an inch off the mud on a tiny cloud.",
	},
	bubble_bath: {
		name: "Bubble Bath",
		icon: require("../assets/images/emoji/bubble-bath.png"),
		blurb: "Soap bubbles drift up around your pig.",
	},
	butterfly_crown: {
		name: "Butterfly Crown",
		icon: require("../assets/images/emoji/butterfly-crown.png"),
		blurb: "A butterfly rides on your pig's head all day.",
	},
	confetti_snout: {
		name: "Confetti Snout",
		icon: require("../assets/images/emoji/confetti-snout.png"),
		blurb: "Every tickle pops confetti.",
	},
	golden_hour: {
		name: "Golden Hour",
		icon: require("../assets/images/emoji/golden-hour.png"),
		blurb: "The Barn goes warm amber and your pig glows.",
	},
	firefly_night: {
		name: "Firefly Night",
		icon: require("../assets/images/emoji/firefly-night.png"),
		blurb: "The Barn dims to dusk and fireflies wander.",
	},
	sunday_best: {
		name: "Sunday Best",
		icon: require("../assets/images/emoji/sunday-best.png"),
		blurb: "Your pig wears a little bow tie over its hat.",
	},
	// ── System-granted, never in the rotation ──
	chorus_glow: {
		name: "Chorus Glow",
		icon: require("../assets/images/emoji/blessed.png"),
		blurb: "The Sounder sang together — regen runs double for the hour.",
	},
	war_winner_regen: {
		name: "Winner's Glow",
		// System-granted, never in a ritual door — shares chorus_glow's icon.
		icon: require("../assets/images/emoji/blessed.png"),
		blurb: "Your crew took the Dig-Off — regen runs double for three days.",
	},
};

export const CURSE_META: Record<CurseKind, RitualMeta> = {
	pickle_brine: {
		name: "Pickle Brine",
		icon: require("../assets/images/emoji/pickle-brine.png"),
		blurb: "The Barn turns briny green, like it fell in a jar.",
	},
	topsy_turvy: {
		name: "Topsy-Turvy",
		icon: require("../assets/images/emoji/topsy-turvy.png"),
		blurb: "Your pig stands upside down and carries on.",
	},
	pipsqueak: {
		name: "Pipsqueak",
		icon: require("../assets/images/emoji/pipsqueak.png"),
		blurb: "Your pig shrinks to half size; its oink goes up an octave.",
	},
	little_raincloud: {
		name: "Little Raincloud",
		icon: require("../assets/images/emoji/little-raincloud.png"),
		blurb: "A small grey cloud follows your pig and drizzles.",
	},
	bacon_bits: {
		name: "Bacon Bits",
		icon: require("../assets/images/emoji/bacon-bits.png"),
		blurb: "Your pig is striped like a rasher.",
	},
	hiccups: {
		name: "Hiccups",
		icon: require("../assets/images/emoji/hiccups.png"),
		blurb: "Every few seconds your pig hops with a “hic!” bubble.",
	},
	old_timey: {
		name: "Old-Timey Pig",
		icon: require("../assets/images/emoji/old-timey.png"),
		blurb: "Sepia, film grain, and a monocle it didn't ask for.",
	},
};

// ── Retired kinds ───────────────────────────────────────────────────────
// The Season 0 + Season 1 sets. Nothing casts these any more, but a row cast
// in the twelve hours before the weekday rotation shipped is still live, so
// the Inbox, the effect cards and the Barn strip keep naming it correctly
// until it expires. `effectMeta` falls back here; NOTHING else should read
// this table, and no kind here appears in a rotation or a `*Kind` union.
export const LEGACY_RITUAL_META: Record<string, RitualMeta> = {
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

// ISO weekday, Mon=1 … Sun=7, on the UTC date — matches Postgres
// EXTRACT(ISODOW FROM ...). The `getUTCDay() || 7` idiom is the one the
// Dig-Off race already uses (utils/truffleExchange.ts), so the rotation
// shares a convention rather than inventing one.
export function isoWeekdayUTC(d: Date = new Date()): number {
	return d.getUTCDay() || 7;
}

export function dailyBlessingKind(d: Date = new Date()): BlessingKind {
	return BLESSING_ROTATION[isoWeekdayUTC(d) - 1];
}

export function dailyCurseKind(d: Date = new Date()): CurseKind {
	return CURSE_ROTATION[isoWeekdayUTC(d) - 1];
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

// What `dailyRitual` hands back: the day's kind plus its display meta.
export type TodayRitual = { kind: BlessingKind | CurseKind } & RitualMeta;

// A blurb is written to the pig's OWNER ("Your pig floats…") — the Barn, an
// effect card and the Inbox all speak to the wearer. The Friends list speaks
// to the CASTER about a friend, so the same sentence turns to point at them:
// "Their pig floats…". Only the pig's owner changes hands; "The Barn" and
// "Every tickle" read the same from either side. (2026-09-14)
export function castBlurb(blurb: string): string {
	return blurb
		.replace(/\bYour pig\b/g, "Their pig")
		.replace(/\byour pig\b/g, "their pig");
}

// Rituals reset at UTC midnight (the daily cap keys on the UTC date). "7h 23m"
// until you can bless/curse again — a snapshot taken when the caller renders.
// Lives here rather than in RitualPicker because the friend-row doors, the
// picker and the Inbox all speak the same reset.
export function untilDailyReset(d: Date = new Date()): string {
	const next = Date.UTC(
		d.getUTCFullYear(),
		d.getUTCMonth(),
		d.getUTCDate() + 1
	);
	return formatHM(next - d.getTime());
}
