// Ritual presentation recipes — the CONTRACT between the ritual catalog
// (`utils/rituals.ts`: which kind is today's), the receiver-side effects layer
// (`utils/activeEffects.ts`: which kinds are on me right now), and the render
// surfaces that show them (BarnOverlay, PigStage, the tap loop, the oink).
//
// Rituals are cosmetic only (charter decision 2026-09-14). A recipe never
// reaches gameplay: no regen, no luck, no tickles, no snouts. Every field here
// is something the player can SEE (or hear) for the six hours the effect lasts.
//
// Plan: docs/design/2026-09-14-weekday-rituals-plan.md
//
// Channel rule — a player can carry the day's blessing AND the day's curse at
// once, so the weekday pairing in `utils/rituals.ts` must keep each day's two
// recipes on disjoint channels (`fxChannels`). A unit test asserts it.
//
// Merging — `mergeRitualFx` folds the active kinds into ONE presentation.
// Order matters and is deterministic: callers pass kinds in the order
// `fetchActiveEffects` returns them (blessings first). For a field two recipes
// both set, the FIRST wins. The weekday pairing makes that impossible for the
// day's own pair; it only decides legacy overlap.

import { WHIMSY } from "./theme";
import type { RelSpec } from "./hat_overlay_types";

// ── Kinds ───────────────────────────────────────────────────────────────
// Must match `BlessingKind` / `CurseKind` in `utils/rituals.ts` and the SQL
// kind CHECK constraints. Monday-first order lives in `utils/rituals.ts`.
export type RitualBlessingFxKind =
	| "cloud_nine"
	| "bubble_bath"
	| "butterfly_crown"
	| "confetti_snout"
	| "golden_hour"
	| "firefly_night"
	| "sunday_best";

export type RitualCurseFxKind =
	| "pickle_brine"
	| "topsy_turvy"
	| "pipsqueak"
	| "little_raincloud"
	| "bacon_bits"
	| "hiccups"
	| "old_timey";

export type RitualFxKind = RitualBlessingFxKind | RitualCurseFxKind;

// ── Channels ────────────────────────────────────────────────────────────
export interface SceneFx {
	// Full-Barn wash (the Goblin Whisper haze precedent): a WHIMSY token + alpha.
	tint?: string;
	alpha?: number;
	// Dims the scene toward evening under the wash.
	dusk?: boolean;
	// Film-grain overlay (Old-Timey).
	grain?: boolean;
	// Ambient scene particles, drawn in the overlay layer, not on the pig.
	particles?: "fireflies";
}

export interface PigFx {
	// A whole-pig skin. "bacon" = flat tint + striped mask sprite (art phase 3).
	skin?: "bacon";
	// Flat pig tint (rides `skinTintOverride`).
	tint?: string;
	// Soft halo behind the pig.
	glow?: string;
	// Upside down (rotate 180°), applied on the stage wrapper so raster + Rive match.
	flip?: boolean;
	// Uniform scale on the stage wrapper. 1 = normal.
	scale?: number;
	// Gentle bob: amp in px at a 100px stage; period = full cycle ms.
	float?: { amp: number; period: number };
	// Periodic hop: every ms, height px at a 100px stage. Shows a "hic!" bubble.
	hop?: { every: number; height: number };
	// Forced cosmetics, merged AHEAD of the player's own so a bow tie sits over
	// the hat, never instead of it. Values are ritual item ids resolved through
	// `RITUAL_ITEM_ART`; an id with no art yet is skipped, never a broken image.
	forced?: { head?: string; bow?: string; face?: string; mask?: string };
	// A sprite that tags along with the pig.
	follower?: "raincloud" | "cloud_under";
	// Particles pinned to the pig's art box.
	particles?: "bubbles";
}

export interface TapFx {
	burst?: "confetti";
}

export interface SoundFx {
	// Playback-rate multiplier on the oink one-shot. 1 = normal.
	pitch?: number;
}

export interface RitualFx {
	scene?: SceneFx;
	pig?: PigFx;
	tap?: TapFx;
	sound?: SoundFx;
}

// Ritual item ids → art. A forced id with NO entry here is skipped by
// `forcedRitualItem`, so a ritual never renders a broken sticker; the four
// below all have art as of the 2026-09-14 pass.
//
// These four are NOT shop items: they are never in `HAT_IMAGES`, never in the
// `hats` table, and so never in tools/regen_studio or tools/placement_studio,
// which both enumerate the shop catalog. Their art lives under
// assets/images/hats/ritual/ to keep it out of that namespace, and they have no
// RelSpec in `hat_rel.generated.ts` — `resolveSlot` falls back to the category
// preset in `CATEGORY_OVERLAYS` for each (hat / bow / glasses / mask).
export const RITUAL_ITEM_IDS = {
	butterfly: "ritual_butterfly",
	bowTie: "ritual_bow_tie",
	monocle: "ritual_monocle",
	baconMask: "ritual_bacon_mask",
} as const;
// Ritual item placement. These four are not shop items, so the placement
// studio (which enumerates HAT_IMAGES) never sees them and `hat_rel.generated.ts`
// carries no entry; the category presets in CATEGORY_OVERLAYS are calibrated
// to an older sprite and land every one of them off the card. PigStage merges
// this table under its `relOverrides`, so a studio override still wins.
// Tuned against the rest pose (scripts/pig_preview.py math), 2026-09-14.
export const RITUAL_ITEM_REL: Record<string, RelSpec> = {
	[RITUAL_ITEM_IDS.butterfly]: { pivot: { x: 0.5, y: 0.88 }, widthFrac: 0.34, anchor: "head" },
	[RITUAL_ITEM_IDS.bowTie]: { pivot: { x: 0.5, y: 0.5 }, widthFrac: 0.4, anchor: "neck" },
	[RITUAL_ITEM_IDS.monocle]: { pivot: { x: 0.5, y: 0.27 }, widthFrac: 0.34, anchor: "eye_l" },
	[RITUAL_ITEM_IDS.baconMask]: { pivot: { x: 0.5, y: 0.6 }, widthFrac: 0.8, anchor: "body" },
};

export const RITUAL_ITEM_ART: Partial<Record<string, number>> = {
	[RITUAL_ITEM_IDS.butterfly]: require("../assets/images/hats/ritual/butterfly.png"),
	[RITUAL_ITEM_IDS.bowTie]: require("../assets/images/hats/ritual/bow_tie.png"),
	[RITUAL_ITEM_IDS.monocle]: require("../assets/images/hats/ritual/monocle.png"),
	[RITUAL_ITEM_IDS.baconMask]: require("../assets/images/hats/ritual/bacon_mask.png"),
};

// ── Recipes ─────────────────────────────────────────────────────────────
export const RITUAL_FX: Record<RitualFxKind, RitualFx> = {
	// Monday
	cloud_nine: {
		pig: { float: { amp: 6, period: 2400 }, follower: "cloud_under" },
	},
	pickle_brine: {
		scene: { tint: WHIMSY.sage, alpha: 0.38 },
	},
	// Tuesday
	bubble_bath: {
		pig: { particles: "bubbles" },
	},
	topsy_turvy: {
		pig: { flip: true },
	},
	// Wednesday
	butterfly_crown: {
		pig: { forced: { head: RITUAL_ITEM_IDS.butterfly } },
	},
	pipsqueak: {
		pig: { scale: 0.5 },
		sound: { pitch: 1.6 },
	},
	// Thursday
	confetti_snout: {
		tap: { burst: "confetti" },
	},
	little_raincloud: {
		pig: { follower: "raincloud" },
	},
	// Friday
	golden_hour: {
		scene: { tint: WHIMSY.sun, alpha: 0.24 },
		pig: { glow: WHIMSY.sun },
	},
	bacon_bits: {
		pig: { skin: "bacon", tint: WHIMSY.roseDeep, forced: { mask: RITUAL_ITEM_IDS.baconMask } },
	},
	// Saturday
	firefly_night: {
		scene: { tint: WHIMSY.ink, alpha: 0.3, dusk: true, particles: "fireflies" },
	},
	hiccups: {
		pig: { hop: { every: 4000, height: 8 } },
	},
	// Sunday
	sunday_best: {
		pig: { forced: { bow: RITUAL_ITEM_IDS.bowTie } },
	},
	old_timey: {
		scene: { tint: WHIMSY.ink, alpha: 0.16, grain: true },
		pig: { forced: { face: RITUAL_ITEM_IDS.monocle } },
	},
};

export function isRitualFxKind(kind: string): kind is RitualFxKind {
	return Object.prototype.hasOwnProperty.call(RITUAL_FX, kind);
}

// ── Wash ────────────────────────────────────────────────────────────────
// A scene wash is a WHIMSY token at an alpha, not a hand-mixed rgba. The
// recipes above carry the token hex + the alpha separately so the two stay
// legible as data; this is the one place they become a color string.
// (`inkAlpha` in theme.ts does the same job for the one ink it knows.)
export function fxWash(hex: string, alpha = 1): string {
	const raw = hex.startsWith("#") ? hex.slice(1) : hex;
	const full =
		raw.length === 3
			? raw
					.split("")
					.map((c) => c + c)
					.join("")
			: raw;
	if (full.length !== 6) return hex;
	const rgb = (full.match(/../g) ?? []).map((pair) => Number.parseInt(pair, 16));
	if (rgb.length !== 3 || rgb.some((n) => Number.isNaN(n))) return hex;
	return `rgba(${rgb.join(", ")}, ${Math.max(0, Math.min(1, alpha))})`;
}

// Does this scene draw anything at all? Cheap "should the overlay mount" test.
export function hasSceneFx(scene: SceneFx | undefined): boolean {
	if (!scene) return false;
	return (
		scene.tint !== undefined ||
		scene.dusk === true ||
		scene.grain === true ||
		scene.particles !== undefined
	);
}

// The channels a list row, a sheet, or any surface OUTSIDE the Barn may show:
// skin, tint, forced cosmetics, flip, scale. Everything that runs a loop —
// float, hop, follower, particles, glow — is dropped, because fifty rows each
// running a bob is fifty dropped frames. Identifying a ritual never depends on
// its motion (see the Reduce Motion rule), so a static row still reads.
export function staticPigFx(pig: PigFx | undefined): PigFx | undefined {
	if (!pig) return undefined;
	const out: PigFx = {};
	if (pig.skin !== undefined) out.skin = pig.skin;
	if (pig.tint !== undefined) out.tint = pig.tint;
	if (pig.flip !== undefined) out.flip = pig.flip;
	if (pig.scale !== undefined) out.scale = pig.scale;
	if (pig.forced) out.forced = { ...pig.forced };
	return hasPigFx(out) ? out : undefined;
}

// Does this pig recipe draw anything at all?
export function hasPigFx(pig: PigFx | undefined): boolean {
	if (!pig) return false;
	return (
		pig.skin !== undefined ||
		pig.tint !== undefined ||
		pig.glow !== undefined ||
		pig.flip === true ||
		pig.scale !== undefined ||
		pig.float !== undefined ||
		pig.hop !== undefined ||
		pig.follower !== undefined ||
		pig.particles !== undefined ||
		(!!pig.forced && Object.values(pig.forced).some(Boolean))
	);
}

// ── Channels (for the disjoint-pair rule) ───────────────────────────────
export type FxChannel =
	| "scene.wash"
	| "scene.particles"
	| "pig.skin"
	| "pig.transform"
	| "pig.glow"
	| "pig.head"
	| "pig.bow"
	| "pig.face"
	| "pig.mask"
	| "pig.follower"
	| "pig.particles"
	| "tap.burst"
	| "sound.pitch";

export function fxChannels(fx: RitualFx): FxChannel[] {
	const out: FxChannel[] = [];
	if (fx.scene?.tint !== undefined || fx.scene?.dusk || fx.scene?.grain) out.push("scene.wash");
	if (fx.scene?.particles) out.push("scene.particles");
	if (fx.pig?.skin || fx.pig?.tint !== undefined) out.push("pig.skin");
	if (fx.pig?.flip || fx.pig?.scale !== undefined || fx.pig?.float || fx.pig?.hop) {
		out.push("pig.transform");
	}
	if (fx.pig?.glow !== undefined) out.push("pig.glow");
	if (fx.pig?.forced?.head) out.push("pig.head");
	if (fx.pig?.forced?.bow) out.push("pig.bow");
	if (fx.pig?.forced?.face) out.push("pig.face");
	if (fx.pig?.forced?.mask) out.push("pig.mask");
	if (fx.pig?.follower) out.push("pig.follower");
	if (fx.pig?.particles) out.push("pig.particles");
	if (fx.tap?.burst) out.push("tap.burst");
	if (fx.sound?.pitch !== undefined) out.push("sound.pitch");
	return out;
}

// ── Merge ───────────────────────────────────────────────────────────────
export interface RitualPresentation {
	scene: SceneFx;
	pig: PigFx;
	tap: TapFx;
	sound: SoundFx;
	// The kinds that contributed, in the order they were folded.
	kinds: RitualFxKind[];
}

export const REST_PRESENTATION: RitualPresentation = Object.freeze({
	scene: {},
	pig: {},
	tap: {},
	sound: {},
	kinds: [],
});

function fillFirstWins<T extends object>(into: T, from: T | undefined): void {
	if (!from) return;
	for (const key of Object.keys(from) as (keyof T)[]) {
		const v = from[key];
		if (v === undefined) continue;
		if (key === "forced") {
			// Forced slots merge per slot, first wins per slot.
			const cur = ((into as PigFx).forced ??= {});
			for (const [slot, id] of Object.entries(v as NonNullable<PigFx["forced"]>)) {
				if (id && !(cur as Record<string, string>)[slot]) {
					(cur as Record<string, string>)[slot] = id;
				}
			}
			continue;
		}
		if (into[key] === undefined) into[key] = v;
	}
}

// Pure: unknown kinds (legacy rows still expiring) are ignored. Returns
// REST_PRESENTATION itself when nothing contributes, so `=== REST_PRESENTATION`
// is a cheap "at rest" test.
export function mergeRitualFx(kinds: readonly string[]): RitualPresentation {
	const known = kinds.filter(isRitualFxKind);
	if (known.length === 0) return REST_PRESENTATION;
	const out: RitualPresentation = { scene: {}, pig: {}, tap: {}, sound: {}, kinds: [] };
	for (const kind of known) {
		const fx = RITUAL_FX[kind];
		fillFirstWins(out.scene, fx.scene);
		fillFirstWins(out.pig, fx.pig);
		fillFirstWins(out.tap, fx.tap);
		fillFirstWins(out.sound, fx.sound);
		out.kinds.push(kind);
	}
	return out;
}
