// Central registry mapping game data → the generated emoji-replacement
// art under assets/images/emoji/. Static require()s so Metro bundles
// them. See docs/openai-emoji-replacement-art.md.

export const TROPHY = require("../assets/images/emoji/trophy.png");

// Cosmetic-category → art. `aura` and `necklace` have no dedicated
// icon yet; categoryIcon() returns null for them (caller falls back
// to the ✦ print glyph).
const CATEGORY_ICON: Record<string, number> = {
	hat: require("../assets/images/emoji/cat/hat.png"),
	glasses: require("../assets/images/emoji/cat/glasses.png"),
	bow: require("../assets/images/emoji/cat/bow.png"),
	scarf: require("../assets/images/emoji/cat/scarf.png"),
	mask: require("../assets/images/emoji/cat/mask.png"),
	cape: require("../assets/images/emoji/cat/cape.png"),
	held: require("../assets/images/emoji/cat/wand.png"),
	background: require("../assets/images/emoji/cat/picture.png"),
};

export function categoryIcon(
	category: string | null | undefined
): number | null {
	return (category && CATEGORY_ICON[category]) || null;
}

// Achievement id → medallion. achievementIcon() falls back to the
// generic trophy for any id without dedicated art (e.g. future tiers).
export const ACHIEVEMENT_ICON: Record<string, number> = {
	generous_t1: require("../assets/images/emoji/achv/open-hoof.png"),
	generous_t2: require("../assets/images/emoji/achv/snout-saint.png"),
	generous_t3: require("../assets/images/emoji/achv/bacon-bountiful.png"),
	generous_t4: require("../assets/images/emoji/achv/hog-of-hearts.png"),
	greedy_t1: require("../assets/images/emoji/achv/hungry-hog.png"),
	greedy_t2: require("../assets/images/emoji/achv/trough-sniffer.png"),
	greedy_t3: require("../assets/images/emoji/achv/bottomless.png"),
	greedy_t4: require("../assets/images/emoji/achv/glutton-king.png"),
};

export function achievementIcon(id: string | null | undefined): number {
	return (id && ACHIEVEMENT_ICON[id]) || TROPHY;
}

// Release-notes item emoji → art. Only the emoji with dedicated art
// are listed; releaseIcon() returns null for the rest, which the modal
// then resolves to an <Icon> (via releaseIconName) or a print glyph.
const RELEASE_ICON: Record<string, number> = {
	"🤝": require("../assets/images/emoji/trade.png"),
	"👥": require("../assets/images/emoji/friends.png"),
	"👀": require("../assets/images/emoji/peek.png"),
	"🏆": TROPHY,
	"🔔": require("../assets/images/emoji/bell.png"),
	"☀️": require("../assets/images/emoji/sun-beam.png"),
	"🟢": require("../assets/images/emoji/goblin-whisper.png"),
	"📋": require("../assets/images/emoji/clipboard.png"),
	"🐷": require("../assets/images/emoji/pig.png"),
	"🐽": require("../assets/images/emoji/pig.png"),
};

export function releaseIcon(emoji: string | undefined): number | null {
	return (emoji && RELEASE_ICON[emoji]) || null;
}

// Release-notes item emoji → Icon name, for emoji with no dedicated art
// but a fitting vector Icon. Consumed by the modal as a second-tier
// fallback after releaseIcon(); emoji handled by neither (👗, ⚽, ✨)
// fall through to a print glyph in the modal. IconName isn't imported
// here to avoid a UI→constants dependency; the modal types it.
const RELEASE_ICON_NAME: Record<string, string> = {
	"⚖️": "scales",
	"👑": "crown",
	"🏚️": "home",
};

export function releaseIconName(emoji: string | undefined): string | null {
	return (emoji && RELEASE_ICON_NAME[emoji]) || null;
}
