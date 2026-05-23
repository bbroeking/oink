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

// Shared paper-sticker tilt sequence — used by leaderboard rows and season tier
// rows so each list item gets a slightly different scrapbook angle.
export const ROW_TILTS = [-1.2, 0.8, -0.6, 0.5, -0.4, 1, -0.7, 0.6];

// Shared modal-backdrop tint (warm ink shadow) so all sticker modals share the
// same dim treatment.
export const MODAL_BACKDROP_BG = "rgba(40,30,20,0.55)";

// Tiny accent text that sits above a section title — e.g. "★ welcome",
// "★ snout season 1". Identical across Account, Onboarding, season,
// BattlePassSaleModal. Compose with marginBottom override per screen.
export const KICKER_TEXT = {
	fontFamily: FONTS.hand,
	fontSize: 13,
	color: WHIMSY.accent,
	letterSpacing: 0.4,
};

// Pill-style kicker — tracked uppercase muted-ink band that sits above a
// header or section title (e.g. "★ FRIENDS", "★ TITLES", "★ THE SHOP").
// Companion to KICKER_TEXT for screens that want a heavier header
// treatment. fontSize varies 10–11 and letterSpacing 1.4–1.6 between
// screens; compose with overrides + marginBottom per use site.
export const KICKER_PILL = {
	fontFamily: FONTS.bodyExtra,
	fontSize: 11,
	color: WHIMSY.mute,
	letterSpacing: 1.6,
	textTransform: "uppercase" as const,
};

// Short ink underline drawn under a section title. Identical on Account,
// leaderboard, season — only width and surrounding margin vary per screen.
export const TITLE_RULE = {
	height: 2,
	backgroundColor: WHIMSY.ink,
	opacity: 0.3,
	borderRadius: 1,
};
