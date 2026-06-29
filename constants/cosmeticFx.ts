// Per-item animated-cosmetic recipes. This is the "B" approach: every
// members-only item declares its OWN motion recipe (float cadence, glow
// hue, shimmer timing, sparkle placement) tuned to its art — bespoke, not
// one uniform overlay slapped on every sticker. The render engine that
// consumes these lives in components/ui/AnimatedCosmetic.tsx.
//
// Effects are PROCEDURAL (Reanimated), not baked sprite sheets — a 12-frame
// sheet per item × ~90 items would add tens of MB to the bundle, and the
// glint/sparkle/float look is identical whether baked or driven live. Each
// item instead supplies a small config object, so the look stays per-item
// without the asset cost.
//
// Coordinate convention for `sparkles`: x/y are FRACTIONS (0..1) of the
// rendered art box — {x:0.5, y:0} is top-center, {x:0.5, y:1} bottom-center.
// That keeps placement art-relative and size-independent (shop card, buy
// sheet, on-pig all reuse the same recipe).

export interface SparkleSpec {
	x: number; // 0..1 across the art box
	y: number; // 0..1 down the art box
	size?: number; // px at a 100px box; scales with the box
	delay?: number; // ms before this sparkle's first twinkle (staggers them)
}

export interface CosmeticFx {
	// Gentle vertical bob. amp in px at a 100px box; period = full cycle ms.
	float?: { amp?: number; period?: number };
	// Soft pulsing halo behind the sticker (rarity glow). color = halo hue.
	glow?: { color?: string; period?: number };
	// Periodic white bloom over the sticker (a "catches the light" shine).
	shimmer?: { period?: number; strength?: number };
	// Twinkling star sprites pinned to the art (jewels, peaks, etc.).
	sparkles?: SparkleSpec[];
}

// Registry. An item with NO entry renders as a plain static Image — only
// the items listed here animate, so non-members / ordinary cosmetics are
// untouched and there's zero per-frame cost for them.
export const COSMETIC_FX: Record<string, CosmeticFx> = {
	// ── Hero prototype: Slop Club Signet Crown (legendary) ──────────────
	// Regal, unhurried bob; warm gold halo; a slow shine sweep; sparkles
	// pinned to the centre snout-emblem, the two side rubies, and the peak.
	slop_club_signet_crown: {
		float: { amp: 5, period: 2600 },
		glow: { color: "#F5C44A", period: 2800 },
		shimmer: { period: 3400, strength: 0.42 },
		sparkles: [
			{ x: 0.5, y: 0.11, size: 17, delay: 0 }, // top peak ball
			{ x: 0.21, y: 0.34, size: 12, delay: 950 }, // left ruby
			{ x: 0.79, y: 0.34, size: 12, delay: 1750 }, // right ruby
			{ x: 0.5, y: 0.54, size: 13, delay: 480 }, // centre snout emblem
		],
	},
};

// ── Archetype animation for the 74-item members catalog ────────────────
// Rather than hand-author 74 sparkle arrays blind (placement only makes sense
// against the final art), each members item derives its recipe from its THEME
// (→ glow/accent hue) and CATEGORY (→ where sparkles sit). The look stays
// per-item without per-item authoring; promote any item to COSMETIC_FX above
// for a fully bespoke pass (as the Signet Crown already is). Source map:
// constants/membersFx.generated.ts (id → {category, theme}).
import { MEMBERS_FX_DATA } from "./membersFx.generated";

// Glow / accent hue per theme. Warm, cozy, on-brand.
const THEME_ACCENT: Record<string, string> = {
	"Royal Sty": "#F5C44A", // gold
	"Cosmic Hog": "#9C7BF0", // nebula purple
	"Garden Gala": "#F2A0C0", // blossom pink
	"Mudlark Deluxe": "#D8A24A", // burnished gold-on-mud
	"Confection Counter": "#FFB3C7", // candy pink
	"Storybook Knight": "#C3CDDC", // soft silver
	"Aurora Frost": "#8FD8E8", // ice blue
	"Tropic Luau": "#FFB24A", // tropical sun
	"Midnight Masquerade": "#B98BD8", // jewel violet
	"Slop Club Signature": "#F5C44A", // club gold (matches the crown)
};

// Where the twinkles sit, per category (fractions of the art box). Tuned so
// sparkles land on the bright/jewelled parts of each accessory shape.
const SPARKLE_LAYOUT: Record<string, SparkleSpec[]> = {
	hat: [
		{ x: 0.5, y: 0.13, size: 16, delay: 0 },
		{ x: 0.24, y: 0.36, size: 12, delay: 900 },
		{ x: 0.76, y: 0.36, size: 12, delay: 1700 },
	],
	bow: [
		{ x: 0.5, y: 0.46, size: 14, delay: 0 },
		{ x: 0.21, y: 0.42, size: 11, delay: 800 },
		{ x: 0.79, y: 0.42, size: 11, delay: 1600 },
	],
	glasses: [
		{ x: 0.31, y: 0.46, size: 13, delay: 0 },
		{ x: 0.69, y: 0.46, size: 13, delay: 1100 },
	],
	mask: [
		{ x: 0.33, y: 0.4, size: 12, delay: 0 },
		{ x: 0.67, y: 0.4, size: 12, delay: 900 },
		{ x: 0.5, y: 0.64, size: 11, delay: 1700 },
	],
	held: [
		{ x: 0.55, y: 0.18, size: 15, delay: 0 },
		{ x: 0.44, y: 0.5, size: 11, delay: 1200 },
	],
	aura: [
		{ x: 0.5, y: 0.1, size: 14, delay: 0 },
		{ x: 0.12, y: 0.42, size: 12, delay: 600 },
		{ x: 0.88, y: 0.42, size: 12, delay: 1200 },
		{ x: 0.28, y: 0.82, size: 11, delay: 1800 },
		{ x: 0.72, y: 0.82, size: 11, delay: 2400 },
	],
	tickle_particle: [
		{ x: 0.5, y: 0.32, size: 15, delay: 0 },
		{ x: 0.5, y: 0.64, size: 11, delay: 1100 },
	],
};

function archetypeFx(category: string, theme: string): CosmeticFx | undefined {
	// Backgrounds are full-bleed scenes — the shop card renders them static
	// (HatThumb never routes fullBleed art through the animator), so no recipe.
	if (category === "background") return undefined;
	const accent = THEME_ACCENT[theme] ?? "#F5C44A";
	const fx: CosmeticFx = {
		glow: { color: accent, period: 2800 },
		shimmer: { period: 3400, strength: 0.4 },
		sparkles: SPARKLE_LAYOUT[category] ?? [
			{ x: 0.5, y: 0.3, size: 14, delay: 0 },
		],
	};
	// Auras are a glowing ring — a bob looks odd; everything else gently floats.
	if (category !== "aura") fx.float = { amp: 5, period: 2600 };
	return fx;
}

export function cosmeticFxFor(id: string): CosmeticFx | undefined {
	// Explicit bespoke recipe wins (e.g. the Signet Crown).
	if (COSMETIC_FX[id]) return COSMETIC_FX[id];
	// Otherwise derive from the members catalog's theme × category.
	const m = MEMBERS_FX_DATA[id];
	return m ? archetypeFx(m.category, m.theme) : undefined;
}
