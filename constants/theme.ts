// Design tokens — ported from Claude Design hi-fi bundle.

import type { ViewStyle } from "react-native";

// Whimsical paper-sticker palette (App Outlines v2).
export const WHIMSY = {
	ink: "#2a1f15",
	paper: "#fffaf0",
	cream: "#fbeee2",
	cream2: "#f6e6d4",
	rose: "#ffd6dc",
	roseDeep: "#f8a8b3",
	sky: "#c8e3f0",
	sage: "#c9dec1",
	sun: "#ffd87a",
	lilac: "#d6c8f0",
	lilacDeep: "#a89bff",
	peach: "#ffc8a8",
	// Interactive terracotta. Dark enough for normal-size text on paper and
	// rose surfaces (the original #c25a3f missed AA on paper). Nudged one step
	// darker again on 2026-09-11: design-system spec §5 decision 2 sanctions the
	// accent kicker on sage, where #a13f30 measured 4.497:1 — a rule the
	// contrast test could not have held. Now ≥4.5:1 on all of
	// ACCENT_SAFE_FILLS (sage 4.56 is the tightest).
	accent: "#a03e2f",
	// The gold Button's label ink — the one ink dark enough to read on the gold
	// ramp, inlined as #5A3F00 in Button.tsx and again on the pass track's gold
	// tier stones. [F-02] (2026-09-11)
	goldInk: "#5A3F00",
	// The success control's outline — a sage picked to clear 3:1 on paper
	// (3.01) as a non-text boundary, where the old inline #7A9B63 was chosen by
	// eye. [F-06] (2026-09-11)
	sageInk: "#7A9B63",
	// Explicit warm-ink steps avoid alpha-dependent contrast as surfaces change.
	// `mute` is text-safe across every core pastel; `muteSoft` is for disabled
	// icons, separators, and other non-body-text UI — it reads 3.78:1 on paper,
	// which is a boundary, not a word. Disabled TEXT uses `muteDim`. (2026-09-11)
	mute: "#605449",
	muteSoft: "#8c7e71",
	// Text-safe disabled ink — ≥4.5:1 on paper (6.19), cream (5.65), cream2
	// (5.27), rose (4.88), sky (4.82), sage (4.51) and sun (4.71). Closes the
	// audit's "muteSoft is doing textDisabled's job" finding [F-06, E10] so
	// muteSoft can retire to UI_COLORS.uiMuted. (2026-09-11)
	muteDim: "#6a5c50",
	// Dark "storyteller" callout — the why-we-scuffle / vs-the-Great-Hunger
	// strips on the war surfaces (Your Sounder redesign, 2026-07-06). Ink-dark
	// bark panel with warm cream text; kicker text on bark uses WHIMSY.sun.
	bark: "#3a2c1e",
	barkText: "#fff3e2",
	barkMute: "#e8d9c6",
	// Alignment tints — Goblins vs Angels.
	angel: "#a89bff",
	goblin: "#d4a437",
	// Slop Club gold — the members-only identity hue. `slopGold` is the badge /
	// ribbon fill (the crown-and-lock gold); `slopBand` is the soft band tint
	// behind the members header row (subtle, not an ad). Tokenized so the shop's
	// gold stops leaking as inline #F5C44A / #FFE7AD across cards + band header.
	slopGold: "#F5C44A",
	slopBand: "#FFE7AD",
	// Blessing / curse pair — the two-sided "alignment countdown" hue used on
	// the Barn effect cards, the leaderboard alignment section, and the
	// while-away recap. `bless` is the gold a blessing counts down in (= the
	// generous/angel side); `curseGreen` is the muddy sage a curse counts down
	// in (the greedy/goblin side). Five files hand-mixed this pair off-palette
	// (#C99B23 / #5E7E49 / #7BA266 / #D5E4C9 / #5b8a4a); tokenized once so
	// "matches Barn" is matched by token, not by copy-paste. (2026-07-12)
	bless: "#C99B23",
	curseGreen: "#526f40",
	// The pale companions of the pair above — the SURFACE a blessing or curse
	// card sits on, as opposed to the ink its countdown is written in. Both were
	// hand-mixed at the use site alongside the pair. [A-11, C-11] (2026-09-11)
	curseSurface: "#D5E4C9",
	blessSurface: "#FFF3D0",
	// Boost flame — the warm ember a "boost" reward burns in on the pass track's
	// tier stones. A single sanctioned orange, tokenized before reuse so the
	// flame glyph can't drift back into an inline `#F58F4A`. (2026-07-13)
	flame: "#F58F4A",
	// Near-black — the stop the Judgement Day ceremony gradient opens on and the
	// hanging-sign / lounge shadows reach for. Darker than `ink`; a surface and a
	// shadow, never a text color. [C-23] (2026-09-11)
	inkDeep: "#1a1411",
	// The dark ceremony stage beside `bark` — the surface a Judgement Day or
	// season-end ceremony plays on. No single hex was shared between the two
	// (JudgementDayModal ramps inkDeep → ink → #4a2f1f), so this names the step
	// the ceremonies should settle on rather than promoting a ramp stop. [C-23]
	// (2026-09-11)
	stage: "#1f1710",
	// Truffle-patch earth. WHIMSY has no earth tones, so the dig and the tab
	// bar's wood rail each hand-mixed their own; `dirt`/`dirtDeep` are the one
	// pair (they are also the WOOD rail's two gradient stops). [C-14] (2026-09-11)
	dirt: "#8d5a2c",
	dirtDeep: "#74441e",
	// Pasture green + barn siding red — the two scene hues worth keeping out of
	// the deprecated legacy COLORS ramp. (2026-09-11)
	grass: "#8FBF6A",
	barnRed: "#C44848",
	// Prestige gilt + the masking-tape pair (tape fill and its darker edge) —
	// the Porch Round / pig-card literals the audit flagged. [B-ask] (2026-09-11)
	prestige: "#D9A45D",
	tape: "#EAD59E",
	tapeEdge: "#C8AD77",
};

// Every ink wash in the app derives from WHIMSY.ink rather than a hand-typed
// rgba. The audit found 41 `rgba(` literals carrying five different inks — most
// of them `rgba(40,30,20,…)`, which is not the ink we ship. [C-12, F-3]
// (2026-09-11)
const INK_RGB = WHIMSY.ink
	.slice(1)
	.match(/../g)!
	.map((pair) => Number.parseInt(pair, 16))
	.join(", ");

export function inkAlpha(alpha: number): string {
	return `rgba(${INK_RGB}, ${alpha})`;
}

// Named translucencies. `scrim` corrects UI_COLORS.scrim, which dimmed with an
// ink the palette does not contain. paperWash/sunGlow are the two non-ink
// washes worth a name (a frosted paper veil and the "one hero" sun bloom).
// [C-12, F-3] (2026-09-11)
export const TINT = {
	scrim: inkAlpha(0.55),
	inkWash: inkAlpha(0.08),
	well: inkAlpha(0.12),
	paperWash: "rgba(255, 250, 240, 0.7)",
	sunGlow: "rgba(255, 216, 122, 0.5)",
	// Veils laid OVER artwork (a habitat scene, a placed item) — lighter than
	// the paper-surface washes above, so the art stays legible under them.
	// (2026-09-11, wave 3 · Habitat)
	paperVeil: "rgba(255, 250, 240, 0.14)",
	sunVeil: "rgba(255, 216, 122, 0.2)",
} as const;

// Semantic interface roles. WHIMSY remains the primitive brand palette; new
// shared UI should consume these roles so meaning survives palette tuning.
// Tickle the Pig intentionally ships light-only until a complete dark paper,
// ink, art, shadow, and navigation treatment exists.
export const UI_COLORS = {
	canvas: WHIMSY.paper,
	surface: WHIMSY.paper,
	surfaceMuted: WHIMSY.cream,
	surfaceStrong: WHIMSY.cream2,
	textPrimary: WHIMSY.ink,
	textSecondary: WHIMSY.mute,
	// Disabled TEXT — a text-safe ink, never an opacity crush. Was muteSoft,
	// which is a 3.78:1 boundary color and failed AA as a word. [F-06, E10]
	// (2026-09-11)
	textDisabled: WHIMSY.muteDim,
	// Non-text muted UI: disabled icons, hairline separators, chart gridlines.
	// muteSoft's actual job, now that it is not textDisabled. Never a text color.
	// [F-06, E10] (2026-09-11)
	uiMuted: WHIMSY.muteSoft,
	// `placeholderTextColor` reads a role instead of a hex. [E10] (2026-09-11)
	textPlaceholder: WHIMSY.muteDim,
	border: WHIMSY.ink,
	separator: "#8c7e71",
	action: WHIMSY.accent,
	actionSurface: WHIMSY.sun,
	// The focus ring. Same value as infoText — the web had to invent its own
	// (#16729c) for want of a token. [G-2] (2026-09-11)
	focus: "#3d687f",
	successText: "#476436",
	successSurface: "#e8f5e0",
	// The success control's outline — 3.01:1 on paper, so the boundary is
	// discernible without shouting. [F-02] (2026-09-11)
	successBorder: WHIMSY.sageInk,
	warningText: "#7b5a00",
	warningSurface: "#fff3d0",
	infoText: "#3d687f",
	infoSurface: WHIMSY.sky,
	dangerText: "#983a2c",
	dangerSurface: WHIMSY.rose,
	textOnDark: WHIMSY.barkText,
	// Derived from ink via TINT so the dim matches the outline. [C-12] (2026-09-11)
	scrim: TINT.scrim,
} as const;

// The fills WHIMSY.accent (and any other ≥4.5:1-required warm ink) may sit on.
// Design-system spec §5 decision 2: one accent, restricted by rule — on lilac,
// peach, roseDeep, lilacDeep, slopGold and goblin the kicker is ink instead.
// Exported so the contrast test and the future lint rule share one list.
// (2026-09-11)
export const ACCENT_SAFE_FILLS = [
	WHIMSY.paper,
	WHIMSY.cream,
	WHIMSY.cream2,
	WHIMSY.rose,
	WHIMSY.sky,
	WHIMSY.sage,
	WHIMSY.sun,
] as const;

// Hard sticker drop shadow (offset 4,4 / radius 0 / opacity 1).
export const STICKER_SHADOW = {
	shadowColor: WHIMSY.ink,
	shadowOffset: { width: 4, height: 4 },
	shadowOpacity: 1,
	shadowRadius: 0,
	elevation: 4,
};

export const FONTS = {
	display: "Fredoka_700Bold",
	displaySemi: "Fredoka_600SemiBold",
	body: "Nunito_700Bold",
	bodySemi: "Nunito_600SemiBold",
	bodyExtra: "Nunito_800ExtraBold",
	bodyBlack: "Nunito_900Black",
	whimsy: "Caprasimo_400Regular",
	hand: "PatrickHand_400Regular",
};

// Type scale — role-based text styles (June 2026 taste pass). Compose with a
// WHIMSY color per use (`{ ...TYPE.body, color: WHIMSY.ink }`); color is
// intentionally NOT baked in so one role serves ink / mute / accent. Extracted
// from the values already shipping in the redesigned primitives, not invented.
// Reach for a role instead of a raw fontSize. See docs/design/taste-standard.md.
// Every role carries a lineHeight as of 2026-09-11 [F-9] — a role without one
// let the platform pick, and the platform picks differently per font.
export const TYPE = {
	// Fredoka — the one Fredoka job: the Barn tickle counter and ceremony
	// numerals. Spec §5 decision 1: Fredoka stays, with exactly this role.
	// (2026-09-11)
	hero: { fontFamily: FONTS.display, fontSize: 44, lineHeight: 48 },
	// Caprasimo (whimsy) — titles & numbers
	// Ceremony headline — resolves JudgementDayModal's 36 and season.tsx's 30
	// into one role. [C-19] (2026-09-11)
	displayLg: { fontFamily: FONTS.whimsy, fontSize: 36, lineHeight: 38 },
	display: { fontFamily: FONTS.whimsy, fontSize: 32, lineHeight: 34 },
	pageTitle: { fontFamily: FONTS.whimsy, fontSize: 26, lineHeight: 28 },
	sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 22, lineHeight: 24, letterSpacing: 0.2 },
	cardTitle: { fontFamily: FONTS.whimsy, fontSize: 18, lineHeight: 22, letterSpacing: 0.2 },
	// Small card title — the sanctioned 15px Caprasimo used on gear/card/dupe/
	// bestiary chips (replaces the `...TYPE.cardTitle, fontSize: 15` overrides).
	cardTitleSm: { fontFamily: FONTS.whimsy, fontSize: 15, lineHeight: 22, letterSpacing: 0.2 },
	// The big count readout — `Stat` size lg. (2026-09-11)
	numeralLg: { fontFamily: FONTS.whimsy, fontSize: 26, lineHeight: 28 },
	numeral: { fontFamily: FONTS.whimsy, fontSize: 16, lineHeight: 20 },
	// Nunito — reading text
	bodyLg: { fontFamily: FONTS.body, fontSize: 17, lineHeight: 24 },
	body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
	bodySm: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
	// Nunito ExtraBold — labels (often tracked)
	label: { fontFamily: FONTS.bodyExtra, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
	// PatrickHand — cozy accents / kickers / sub-text
	kicker: { fontFamily: FONTS.hand, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
	hand: { fontFamily: FONTS.hand, fontSize: 14, lineHeight: 20 },
	handLg: { fontFamily: FONTS.hand, fontSize: 17, lineHeight: 24 },
	handDisplay: { fontFamily: FONTS.hand, fontSize: 21, lineHeight: 28 },
	// Nunito ExtraBold caps — the tracked "pill" kicker
	kickerPill: { fontFamily: FONTS.bodyExtra, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, textTransform: "uppercase" },
	// Smaller tracked pill kicker — the sanctioned 10px caption pill (replaces the
	// `...TYPE.kickerPill, fontSize: 9|10` overrides; the 9s move up to 10, a
	// negligible visual delta that kills the sub-pixel shadow scale).
	kickerPillSm: { fontFamily: FONTS.bodyExtra, fontSize: 10, lineHeight: 13, letterSpacing: 1.6, textTransform: "uppercase" },
} as const;

export const RADII = {
	// Rules, meter bars, sheet grabbers — the 2px "barely rounded" step that was
	// being written as a bare `borderRadius: 2`. (2026-09-11)
	hair: 2,
	sm: 8,
	md: 12,
	lg: 14,
	xl: 18,
	xxl: 22,
	// Fully-rounded pill / capsule — the `borderRadius: 999` idiom reinvented
	// inline across cleanse pills, corner tags, and toggles. One name for it.
	pill: 999,
};

// Four border widths, each with a job: `hair` separators, `thin` ghost/tape/tag
// outlines, `ink` the 2px sticker outline that IS the look, `heavy` selected or
// hero. Folds the ten stray 2.5s. (2026-09-11)
export const BORDER = { hair: 1, thin: 1.5, ink: 2, heavy: 3 } as const;

// The opacity ladder. Replaces the 0.45–0.9 free-for-all and the five different
// "pressed" values inside the primitives. Text color NEVER comes from opacity,
// and a disabled control never wears one. [F-05, E4] (2026-09-11)
export const OPACITY = {
	pressed: 0.85,
	muted: 0.7,
	dim: 0.55,
	ghost: 0.45,
	rule: 0.3,
} as const;

// The press for anything wearing a hard shadow: shove the surface into its own
// shadow and collapse the shadow to nothing, so the sticker looks pressed flat
// against the paper (the BarnUpdatesTray press, generalised). Spread it, don't
// remember it. [C-01, C-07] (2026-09-11)
export const PRESSED: ViewStyle = {
	transform: [{ translateX: 2 }, { translateY: 2 }],
	shadowOffset: { width: 0, height: 0 },
};

// The press for flat controls (no shadow to collapse). [F-05] (2026-09-11)
export const PRESSED_FLAT: ViewStyle = { opacity: OPACITY.pressed };

// "A button, asleep" — the 2026-07-07 ruling as something you spread. Full
// chrome kept: muted fill, ink outline, muted-but-legible ink. NO opacity,
// ever — an opacity crush is what this token exists to delete.
// [C-01, C-07, B-08, A-15] (2026-09-11)
export const DISABLED: ViewStyle = {
	backgroundColor: UI_COLORS.surfaceStrong,
	borderColor: UI_COLORS.border,
	borderWidth: BORDER.ink,
};

export const DISABLED_TEXT = { color: UI_COLORS.textDisabled };

// Small hard shadow for interactive chips / buttons / list rows (offset 2,2).
// The lighter companion to STICKER_SHADOW (4,4) — the ONLY two shadow tiers
// per the June 2026 UI audit. The retired soft `SHADOWS.card`/`pillFloat`
// export (with the dead legacy `Card`) was deleted here so no new surface can
// import a soft-shadow slop template.
export const SHADOW_SM = {
	shadowColor: WHIMSY.ink,
	shadowOffset: { width: 2, height: 2 },
	shadowOpacity: 1,
	shadowRadius: 0,
	elevation: 2,
};

// Spacing scale (June 2026 UI audit) — use ONLY these for gaps / margins.
// xxs hairline nudge, xs gutter, sm intra-card, md card-to-card, card the inner
// padding of a Sticker (structural to the 2px-border look — spec §5 decision 3),
// lg inter-section, xl loose, xxl ceremony breathing room. No arithmetic on a
// step: `SPACE.xs + 1` is an off-scale value in a token's clothes.
// [C-18, B-18] (xxs/card/xxl added 2026-09-11)
export const SPACE = { xxs: 2, xs: 4, sm: 8, md: 12, card: 14, lg: 16, xl: 24, xxl: 32 } as const;

// Button geometry, lifted out of Button.tsx's private SIZE_MAP so the web
// stylesheet and any future Button-shaped primitive read the same numbers.
// `lg` uses RADII.pill: at 54pt tall the platform clamps 999 to 27, which is
// exactly the radius it used to hard-code. (2026-09-11)
// `xs` is the small-visual step: it deliberately sits BELOW TAP_MIN, because the
// frame is restored with `hitSlop` rather than by inflating the pill (the
// IconButton visual/frame split, generalised). [C-04] (2026-09-11)
// Declared after SPACE so `px`/`py` can read the scale instead of retyping it.
export const BUTTON_SIZE = {
	xs: { minH: 32, px: SPACE.md, py: SPACE.xs, fs: 12, br: RADII.pill },
	sm: { minH: 44, px: 14, py: 10, fs: 13, br: RADII.xxl },
	md: { minH: 44, px: 18, py: 11, fs: 15, br: RADII.xxl },
	lg: { minH: 54, px: 22, py: 14, fs: 17, br: RADII.pill },
} as const;

// The minimum interactive frame. A control may look smaller than this, but its
// touch target may not be (the IconButton visual/frame split, generalised).
// [C-04, D-05, E4] (2026-09-11)
export const TAP_MIN = 44;

// The short ink underline's one width — was hand-tuned per string. [B-17]
// (2026-09-11)
export const RULE_WIDTH = 64;

// The three sanctioned `Avatar` diameters (spec §2 row 06) and the fraction of
// that frame a Glyph fills inside one — so the primitive's default parameter is
// a token rather than a bare 40, and the "half-ish" glyph inset stops being a
// magic multiplier at the use site. (2026-09-11)
export const AVATAR_SIZE = [32, 40, 56] as const;
export type AvatarSize = (typeof AVATAR_SIZE)[number];
export const AVATAR_GLYPH_FRAC = 0.55;

// The status-bar offset for full-screen overlays that mount OUTSIDE a
// SafeAreaView (the Barn visit chrome, coach-mark spotlights) — the counterpart
// to TAB_SAFE. Decided once here per audit A-26 rather than per overlay.
// (2026-09-11)
export const STATUS_SAFE = 56;

// Art sizes — the fixed boxes hand-drawn art is laid out in (a glyph on an
// empty state, a cosmetic thumbnail, a gift portrait, the pig stage's reserve).
// These are drawing geometry, not spacing, which is why they are not SPACE
// steps; naming them stops every screen re-declaring "72" for a thumbnail.
// Two wave-3 section passes asked for this scale independently. (2026-09-11)
// The camera lens — the one sanctioned non-paper surface (audit E30): a live
// viewfinder is black because that is what a camera shows, not a palette
// choice. Text over it wears LENS_TEXT_SHADOW for legibility over video.
// (2026-09-11)
export const WHIMSY_LENS = "#000";
export const LENS_TEXT_SHADOW = {
	textShadowColor: "rgba(0, 0, 0, 0.6)",
	textShadowRadius: 4,
} as const;

export const ART_SIZE = {
	mark: 12, // an inline glyph beside a label
	glyphSm: 24, // a row/avatar glyph
	glyphMd: 32, // a glyph's art box inside a row (the Monday draw's ember)
	glyph: 40, // EmptyState / detail-card art
	badge: 56, // reveal marks (a coin, a gem), the lg Avatar
	thumb: 72, // catalog thumbnails
	portrait: 120, // gift / reveal portraits
	reveal: 148, // the Almanac sheets' hero card (a claimed furnishing, the Monday purse)
	stage: 300, // the pig stage reserve
	bubble: 104, // the ritual bubble's diameter (its art rides at `thumb`)
} as const;

// Canonical horizontal page padding — the page header AND the scroll-content
// edges on every screen (grids needing numeric-width math may use 12 internally
// only if the chips/legend directly above them match it).
export const PAGE_PAD = 18;

// The single scroll paddingBottom for tab-bar clearance (~50px bar + SPACE.xl).
// Replaces the per-screen 80/100/110/120 values. Where a screen already reads
// the bar height, prefer useBottomTabBarHeight() + SPACE.xl.
export const TAB_SAFE = 74;

// A scrolling list of tilted stickers clips their corners and hard shadows at
// its own edge. The list bleeds this far past its rows on every side and pads
// its content back by the same amount, so the rows stay on the sheet's inset
// and the clip edge lands past the 2pt shadow and the tilt's overhang.
// (2026-09-13, the while-away recap)
export const LIST_BLEED = SPACE.sm;

// Durations, in ms. `modalHandoff` is the iOS nested-modal gap that UserSheet
// repeated verbatim three times; `toast` is the one toast dwell; `debounce` the
// one input settle. Pair with useMotionPolicy's MOTION_DURATION, which decides
// whether a duration is honoured under Reduce Motion — this map is the scale,
// that one is the policy. (2026-09-11)
export const MOTION = {
	tap: 120,
	fade: 180,
	sheetIn: 300,
	sheetOut: 180,
	modalHandoff: 320,
	toast: 2400,
	// A "read the one-line message" beat — a confirm dialog that shows its
	// result before it closes, a chip that flashes a state. Shorter than a
	// toast, longer than a fade. (2026-09-11)
	beat: 800,
	debounce: 250,
	// The ritual bubble's surface-to-pop travel. A blessing rides the toast
	// dwell; a curse is a beat heavier, so it climbs slower. Two flat numbers,
	// not a nested pair: the web token layer reads MOTION as flat ms values.
	// (2026-09-15)
	ritualRiseBless: 2400,
	ritualRiseCurse: 2800,
} as const;

// One spring parameterization, replacing 20 springs across 14 configs. Springy
// and overshooting on purpose: a linear fade is never the default here.
// `tap` snaps, `settle` lands a moved thing, `sway` is ambient (the hanging
// signs), `overshoot` is celebration. [F-08] (2026-09-11)
export const MOTION_SPRING = {
	tap: { damping: 14, stiffness: 220 },
	settle: { damping: 12, stiffness: 180 },
	sway: { damping: 6, stiffness: 60 },
	overshoot: { damping: 8, stiffness: 140 },
} as const;

// Shared paper-sticker tilt sequence — used by leaderboard rows and season tier
// rows so each list item gets a slightly different scrapbook angle.
export const ROW_TILTS = [-1.2, 0.8, -0.6, 0.5, -0.4, 1, -0.7, 0.6];

// One tilt vocabulary: a card leans a little, a dialog a little more, tape a
// lot, and a list row takes its turn from ROW_TILTS. [F-8] (2026-09-11)
export const TILT = {
	card: -0.6,
	dialog: -0.8,
	// The Almanac sheets' hero card (a claimed furnishing) — a stuck-on art
	// square that leans more than furniture, less than tape. (2026-09-16)
	reveal: -1.5,
	tape: -8,
	row: ROW_TILTS,
} as const;

// Shared modal-backdrop tint (warm ink shadow) so all sticker modals share the
// same dim treatment.
export const MODAL_BACKDROP_BG = TINT.scrim;

// Tiny accent text that sits above a section title — e.g. "★ welcome",
// "★ snout season 0". Identical across Account, Onboarding and season.
// Compose with marginBottom override per screen.
export const KICKER_TEXT = {
	...TYPE.kicker,
	color: WHIMSY.accent,
};

// Pill-style kicker — tracked uppercase muted-ink band that sits above a
// header or section title (e.g. "★ FRIENDS", "★ TITLES", "★ THE SHOP").
// Companion to KICKER_TEXT for screens that want a heavier header
// treatment. fontSize varies 10–11 and letterSpacing 1.4–1.6 between
// screens; compose with overrides + marginBottom per use site.
export const KICKER_PILL = {
	...TYPE.kickerPill,
	color: WHIMSY.mute,
};

// Short ink underline drawn under a section title. Identical on Account,
// leaderboard, season — only width and surrounding margin vary per screen.
export const TITLE_RULE = {
	height: 2,
	backgroundColor: WHIMSY.ink,
	opacity: OPACITY.rule,
	borderRadius: 1,
};

// The three sanctioned button ramps, moved out of Button.tsx so the web
// stylesheet reads the same stops. `purple` keeps one consistently dark ramp —
// the old light stop dropped below 4.5:1 for a white label halfway through.
// [F-01] (2026-09-11)
export const GRADIENT = {
	rose: ["#F0B8C8", "#E8A7B9"],
	purple: ["#7052EE", "#5C3FE0"],
	gold: ["#F8D068", "#F5C44A"],
} as const;

// The ember ramp for boost/heat surfaces. No ramp existed to promote — the
// pass track burns a single WHIMSY.flame — so this names the flame→goblin
// gradient the audit asked for before a second orange gets invented. [C-23]
// (2026-09-11) Unused by design until a heat surface needs it.
export const EMBER_GRADIENT = [WHIMSY.flame, WHIMSY.goblin] as const;

// Podium metals — deliberately NOT WHIMSY.slopGold. First place is a medal,
// membership is an identity; they must not read as the same thing. [C-13]
// (2026-09-11)
export const PODIUM = {
	gold: "#F5C44A",
	silver: "#BFC4CC",
	bronze: "#C68A5C",
} as const;

// Per-rarity light fill — the tinted panel behind an item on shop cards,
// closet cards and ItemPreviewModal. One source of truth so the surfaces
// can't drift apart. (This was the light end of a RARITY_GRADIENT pair the
// Shop's LinearGradient cards once drew; the gradient retired with them.)
export const RARITY_BG_SOLID: Record<string, string> = {
	common:    "#FAF7F3",
	uncommon:  "#E8F5E0",
	rare:      "#E0EBFF",
	epic:      "#EFE9FF",
	legendary: "#FFF3D0",
};

// Saturated per-rarity accent — the color DOT in the shop legend and the
// STRIPE down the side of a closet card. The companion to RARITY_BG_SOLID
// (the light fill): fill is the tinted panel behind the item, stripe is the
// bold rarity marker on top of it. Consolidates the two divergent hand-rolled
// maps (shop SHOP_RARITY_DOT + closet RARITY_STRIPE) that had drifted apart.
// NOTE (2026-09-11): none of these five clears 3:1 against its own
// RARITY_BG_SOLID (1.69–2.95). On the shop dot the 2px ink border carries the
// boundary, so the pair is legible; the closet's borderless 4px stripe is the
// real gap. Recorded — not silently re-hued — in colorSystem.test.ts.
export const RARITY_STRIPE: Record<string, string> = {
	common:    "#cdbfae",
	uncommon:  "#7ba868",
	rare:      "#5a8bc5",
	epic:      WHIMSY.lilacDeep,
	legendary: WHIMSY.goblin,
};

// The rarity BADGE pair — the light fill and the ink written on it, every pair
// verified ≥4.5:1 so an 11px rarity word is legible. `ink` is a dark tint of
// the rarity's own hue, so "rare" still reads blue. Retires the saturated
// `constants/hats.ts:RARITY_COLORS`, which was tuned as a dot and pressed into
// service as text (common #9098A2 on paper is 2.6:1). [D-02] (2026-09-11)
export const RARITY_BADGE: Record<string, { bg: string; ink: string }> = {
	common:    { bg: RARITY_BG_SOLID.common,    ink: "#494f56" }, // 7.75:1
	uncommon:  { bg: RARITY_BG_SOLID.uncommon,  ink: "#2e6640" }, // 6.01:1
	rare:      { bg: RARITY_BG_SOLID.rare,      ink: "#2c4f7a" }, // 6.98:1
	epic:      { bg: RARITY_BG_SOLID.epic,      ink: "#4a3a8f" }, // 7.75:1
	legendary: { bg: RARITY_BG_SOLID.legendary, ink: "#6b4a00" }, // 7.29:1
};

// Truffle-patch tile palette. Mud tints are a sanctioned palette exception —
// WHIMSY has no earth tones and the patch IS mud — but they were living in two
// components at two different mixes. `mud` is the shallow → deep layer ramp;
// `silhouette` is the ink veil a buried cluster shows through. TrufflePatch and
// the postcard surfaces read these since the wave-3 section-C pass.
// [C-14] (2026-09-11)
export const DIG_TILE = {
	mud: ["#c2a077", "#a5825f", "#8a6b4f"],
	truffle: "#e8b636",
	shimmer: "#8ed9d0",
	unique: "#865ba8",
	uniqueEdge: "#d8a82d",
	silhouette: TINT.scrim,
} as const;

// Per-pig accent — the character's identity hue (`solid`, the one the card
// stripe and sprite glow use) and its pale surface companion (`tint`, the
// panel behind a portrait). Keyed by string rather than PigId so utils/pigs.ts
// can read it without theme.ts importing the roster back. [D-18] (2026-09-11)
//
// Both entries are TEXT-BEARING FILLS: `solid` is the nameplate under a pig
// (`PigPenView`, `PigFriendsLaunchModal` — ink on the fill), `tint` is the art
// well and ribbon behind a portrait. So both obey the Sticker-fill law —
// ink clears 4.5:1 on them — and `colorSystem.test.ts` enforces it.
// Re-picked 2026-09-11 (wave 4, B-05/B-16 residue): the two cool greys carried
// ink at 2.68:1 (`pepper #646269`) and 1.83:1 (`bandit #4B4A50`) and copper at
// 4.25:1 (`#C66A45`). Each moved to the nearest lighter tone of its OWN hue —
// pepper stays cool slate, bandit becomes the warm taupe of its cream blaze,
// copper stays rusty — landing all three at ≥ 4.6:1 for ink and ≥ 3:1 against
// paper. The three identity pastels (rosie, pickles, biscuit) sit below 3:1 on
// paper by design — they are the characters' own hues, and the nameplate's ink
// border carries the boundary (the same ruling the rarity stripe took).
export const PIG_ACCENT: Record<string, { solid: string; tint: string }> = {
	rosie:   { solid: "#F8A8B3", tint: "#FDE4E8" },
	copper:  { solid: "#C97350", tint: "#F3DED5" },
	pepper:  { solid: "#8A879B", tint: "#E3E2E5" },
	bandit:  { solid: "#94877C", tint: "#DEDDE0" },
	pickles: { solid: "#E88FA3", tint: "#FADFE6" },
	biscuit: { solid: "#D8A36E", tint: "#F5E6D6" },
};

// The ten members-catalog theme hues — the glow/accent an animated cosmetic
// burns in, keyed by its theme name. Read by constants/cosmeticFx.ts. [F-7]
// (2026-09-11)
export const COSMETIC_ACCENT: Record<string, string> = {
	"Royal Sty": WHIMSY.slopGold,
	"Cosmic Hog": "#9C7BF0",
	"Garden Gala": "#F2A0C0",
	"Mudlark Deluxe": "#D8A24A",
	"Confection Counter": "#FFB3C7",
	"Storybook Knight": "#C3CDDC",
	"Aurora Frost": "#8FD8E8",
	"Tropic Luau": "#FFB24A",
	"Midnight Masquerade": "#B98BD8",
	"Slop Club Signature": WHIMSY.slopGold,
};

// The hanging-signs tab bar's wood rail — the design's
// linear-gradient(180deg, dirt 0%, dirtDeep 100%), the sign's inner frame, the
// nail head, and the grain stroke. Tokens only: HangingSignsTabBar keeps its
// literals until wave 3. [F-6] (2026-09-11)
export const WOOD = {
	top: WHIMSY.dirt,
	bottom: WHIMSY.dirtDeep,
	frame: WHIMSY.dirt,
	nail: "#7a5223",
	grain: "#3a3026",
} as const;
