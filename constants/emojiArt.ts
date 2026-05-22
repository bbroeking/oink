// Central registry mapping game data → the generated emoji-replacement
// art under assets/images/emoji/. Static require()s so Metro bundles
// them. See docs/openai-emoji-replacement-art.md.

export const TROPHY = require("../assets/images/emoji/trophy.png");

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
