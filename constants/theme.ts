// Design tokens — ported from Claude Design hi-fi bundle.

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
	accent: "#c25a3f",
	mute: "rgba(40,30,20,0.6)",
	muteSoft: "rgba(40,30,20,0.4)",
	// Alignment tints — Goblins vs Angels.
	angel: "#a89bff",
	goblin: "#d4a437",
};

// Hard sticker drop shadow (offset 4,4 / radius 0 / opacity 1).
export const STICKER_SHADOW = {
	shadowColor: WHIMSY.ink,
	shadowOffset: { width: 4, height: 4 },
	shadowOpacity: 1,
	shadowRadius: 0,
	elevation: 4,
};

export const COLORS = {
	pink: "#E8A7B9",
	pinkDeep: "#D17C92",
	pinkSoft: "#FBE6EC",
	pinkBg: "#FBD5D9",
	purple: "#7B5FFF",
	purpleDeep: "#5C3FE0",
	purpleSoft: "#EFE9FF",
	gold: "#F5C44A",
	goldDeep: "#C99B23",
	goldSoft: "#FFE08A",
	silver: "#BFC4CC",
	bronze: "#C68A5C",
	ink: "#1A1A1A",
	ink2: "#3A3A3A",
	ink3: "#6B6B6B",
	ink4: "#9A9A9A",
	paper: "#FFFFFF",
	paper2: "#FAF7F3",
	paper3: "#F4EFE7",
	border: "#EAE2D6",
	barn: "#C44848",
	grass: "#8FBF6A",
	sky: "#BCE0F0",
	success: "#5BC97D",
	successBg: "#E8F5E0",
	successText: "#5A8338",
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
export const TYPE = {
	// Caprasimo (whimsy) — titles & numbers
	display: { fontFamily: FONTS.whimsy, fontSize: 32, lineHeight: 34 },
	pageTitle: { fontFamily: FONTS.whimsy, fontSize: 26, lineHeight: 28 },
	sectionTitle: { fontFamily: FONTS.whimsy, fontSize: 22, lineHeight: 24, letterSpacing: 0.2 },
	cardTitle: { fontFamily: FONTS.whimsy, fontSize: 18, lineHeight: 22, letterSpacing: 0.2 },
	numeral: { fontFamily: FONTS.whimsy, fontSize: 16 },
	// Nunito — reading text
	body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
	bodySm: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
	// Nunito ExtraBold — labels (often tracked)
	label: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 0.3 },
	// PatrickHand — cozy accents / kickers / sub-text
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 0.4 },
	hand: { fontFamily: FONTS.hand, fontSize: 14, lineHeight: 20 },
	// Nunito ExtraBold caps — the tracked "pill" kicker
	kickerPill: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
} as const;

export const RADII = {
	sm: 8,
	md: 12,
	lg: 14,
	xl: 18,
	xxl: 22,
};

export const SHADOWS = {
	card: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.06,
		shadowRadius: 10,
		elevation: 2,
	},
	pillFloat: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15,
		shadowRadius: 10,
		elevation: 4,
	},
};

// Small hard shadow for interactive chips / buttons / list rows (offset 2,2).
// The lighter companion to STICKER_SHADOW (4,4) — the ONLY two shadow tiers
// per the June 2026 UI audit. Soft SHADOWS.card is retired from sticker
// contexts in favour of these two.
export const SHADOW_SM = {
	shadowColor: WHIMSY.ink,
	shadowOffset: { width: 2, height: 2 },
	shadowOpacity: 1,
	shadowRadius: 0,
	elevation: 2,
};

// Spacing scale (June 2026 UI audit) — use ONLY these for gaps / margins.
// xs gutter, sm intra-card, md card-to-card, lg inter-section, xl loose.
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

// Canonical horizontal page padding — the page header AND the scroll-content
// edges on every screen (grids needing numeric-width math may use 12 internally
// only if the chips/legend directly above them match it).
export const PAGE_PAD = 18;

// The single scroll paddingBottom for tab-bar clearance (~50px bar + SPACE.xl).
// Replaces the per-screen 80/100/110/120 values. Where a screen already reads
// the bar height, prefer useBottomTabBarHeight() + SPACE.xl.
export const TAB_SAFE = 74;

// Shared paper-sticker tilt sequence — used by leaderboard rows and season tier
// rows so each list item gets a slightly different scrapbook angle.
export const ROW_TILTS = [-1.2, 0.8, -0.6, 0.5, -0.4, 1, -0.7, 0.6];

// Shared modal-backdrop tint (warm ink shadow) so all sticker modals share the
// same dim treatment.
export const MODAL_BACKDROP_BG = "rgba(40,30,20,0.55)";

// Tiny accent text that sits above a section title — e.g. "★ welcome",
// "★ snout season 0". Identical across Account, Onboarding, season,
// BattlePassSaleModal. Compose with marginBottom override per screen.
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
	opacity: 0.3,
	borderRadius: 1,
};

// Per-rarity color tokens. The gradient pair is used by the Shop's
// LinearGradient card backgrounds (top-light → bottom-darker); the
// single-color shorthand picks the light end for surfaces that need
// a solid swatch (e.g. ItemPreviewModal). One source of truth so the
// two surfaces can't drift apart again.
export const RARITY_GRADIENT: Record<string, readonly [string, string]> = {
	common:    ["#FAF7F3", "#EFEAE3"],
	uncommon:  ["#E8F5E0", "#CFE8C0"],
	rare:      ["#E0EBFF", "#B7CFFA"],
	epic:      ["#EFE9FF", "#CFC4FF"],
	legendary: ["#FFF3D0", "#FFD96B"],
};

export const RARITY_BG_SOLID: Record<string, string> = {
	common:    RARITY_GRADIENT.common[0],
	uncommon:  RARITY_GRADIENT.uncommon[0],
	rare:      RARITY_GRADIENT.rare[0],
	epic:      RARITY_GRADIENT.epic[0],
	legendary: RARITY_GRADIENT.legendary[0],
};
