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
	// Interactive terracotta. Dark enough for normal-size text on paper and
	// rose surfaces (the previous #c25a3f missed AA on paper).
	accent: "#a13f30",
	// Explicit warm-ink steps avoid alpha-dependent contrast as surfaces change.
	// `mute` is text-safe across every core pastel; `muteSoft` is for disabled
	// icons, separators, and other non-body-text UI.
	mute: "#605449",
	muteSoft: "#8c7e71",
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
	// Boost flame — the warm ember a "boost" reward burns in on the pass track's
	// tier stones. A single sanctioned orange, tokenized before reuse so the
	// flame glyph can't drift back into an inline `#F58F4A`. (2026-07-13)
	flame: "#F58F4A",
};

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
	textDisabled: WHIMSY.muteSoft,
	border: WHIMSY.ink,
	separator: "#8c7e71",
	action: WHIMSY.accent,
	actionSurface: WHIMSY.sun,
	successText: "#476436",
	successSurface: "#e8f5e0",
	warningText: "#7b5a00",
	warningSurface: "#fff3d0",
	infoText: "#3d687f",
	infoSurface: WHIMSY.sky,
	dangerText: "#983a2c",
	dangerSurface: WHIMSY.rose,
	textOnDark: WHIMSY.barkText,
	scrim: "rgba(40,30,20,0.55)",
} as const;

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
	// Small card title — the sanctioned 15px Caprasimo used on gear/card/dupe/
	// bestiary chips (replaces the `...TYPE.cardTitle, fontSize: 15` overrides).
	cardTitleSm: { fontFamily: FONTS.whimsy, fontSize: 15, lineHeight: 22, letterSpacing: 0.2 },
	numeral: { fontFamily: FONTS.whimsy, fontSize: 16 },
	// Nunito — reading text
	bodyLg: { fontFamily: FONTS.body, fontSize: 17, lineHeight: 24 },
	body: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 21 },
	bodySm: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18 },
	// Nunito ExtraBold — labels (often tracked)
	label: { fontFamily: FONTS.bodyExtra, fontSize: 12, letterSpacing: 0.3 },
	// PatrickHand — cozy accents / kickers / sub-text
	kicker: { fontFamily: FONTS.hand, fontSize: 13, letterSpacing: 0.4 },
	hand: { fontFamily: FONTS.hand, fontSize: 14, lineHeight: 20 },
	handLg: { fontFamily: FONTS.hand, fontSize: 17, lineHeight: 24 },
	handDisplay: { fontFamily: FONTS.hand, fontSize: 21, lineHeight: 28 },
	// Nunito ExtraBold caps — the tracked "pill" kicker
	kickerPill: { fontFamily: FONTS.bodyExtra, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase" },
	// Smaller tracked pill kicker — the sanctioned 10px caption pill (replaces the
	// `...TYPE.kickerPill, fontSize: 9|10` overrides; the 9s move up to 10, a
	// negligible visual delta that kills the sub-pixel shadow scale).
	kickerPillSm: { fontFamily: FONTS.bodyExtra, fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase" },
} as const;

export const RADII = {
	sm: 8,
	md: 12,
	lg: 14,
	xl: 18,
	xxl: 22,
	// Fully-rounded pill / capsule — the `borderRadius: 999` idiom reinvented
	// inline across cleanse pills, corner tags, and toggles. One name for it.
	pill: 999,
};

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
export const MODAL_BACKDROP_BG = UI_COLORS.scrim;

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

// Saturated per-rarity accent — the color DOT in the shop legend and the
// STRIPE down the side of a closet card. The companion to RARITY_BG_SOLID
// (the light fill): fill is the tinted panel behind the item, stripe is the
// bold rarity marker on top of it. Consolidates the two divergent hand-rolled
// maps (shop SHOP_RARITY_DOT + closet RARITY_STRIPE) that had drifted apart.
export const RARITY_STRIPE: Record<string, string> = {
	common:    "#cdbfae",
	uncommon:  "#7ba868",
	rare:      "#5a8bc5",
	epic:      WHIMSY.lilacDeep,
	legendary: WHIMSY.goblin,
};
