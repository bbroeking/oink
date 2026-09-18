// Glyphs — hand-drawn replacements for decorative/pictographic emoji, in
// the game's cozy sticker style. Use instead of literal emoji characters.
// Functional symbols (arrows, close, check, bullet) live in ./Icon (SVG).
// Barn and ritual marks use the shared vector art; other subjects use PNGs.
import type { ReactNode } from "react";
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { GameIcon } from "./GameIcon";

const GLYPHS = {
	star: require("../../assets/images/glyphs/star.png"),
	heart: require("../../assets/images/glyphs/heart.png"),
	sparkle: require("../../assets/images/glyphs/sparkle.png"),
	sparkles: require("../../assets/images/glyphs/sparkles.png"),
	lock: require("../../assets/images/glyphs/lock.png"),
	bell: require("../../assets/images/glyphs/bell.png"),
	trophy: require("../../assets/images/glyphs/trophy.png"),
	crown: require("../../assets/images/glyphs/crown.png"),
	scales: require("../../assets/images/glyphs/scales.png"),
	zzz: require("../../assets/images/glyphs/zzz.png"),
	arrowRight: require("../../assets/images/glyphs/arrowRight.png"),
	arrowLeft: require("../../assets/images/glyphs/arrowLeft.png"),
	check: require("../../assets/images/glyphs/check.png"),
	close: require("../../assets/images/glyphs/close.png"),
	bullet: require("../../assets/images/glyphs/bullet.png"),
	gift: require("../../assets/images/glyphs/gift.png"),
	party: require("../../assets/images/glyphs/party.png"),
	gem: require("../../assets/images/glyphs/gem.png"),
	// The Truffle Patch's own mark. It already stands for "dig finds" on the
	// tickle receipt; naming it here makes it reachable through the one glyph
	// registry instead of a fourth direct require. (2026-09-12)
	truffle: require("../../assets/images/glyphs/receipt/truffle.png"),
	search: require("../../assets/images/glyphs/search.png"),
	eyes: require("../../assets/images/glyphs/eyes.png"),
	tophat: require("../../assets/images/glyphs/tophat.png"),
	glasses: require("../../assets/images/glyphs/glasses.png"),
	bow: require("../../assets/images/glyphs/bow.png"),
	scarf: require("../../assets/images/glyphs/scarf.png"),
	dress: require("../../assets/images/glyphs/dress.png"),
	beads: require("../../assets/images/glyphs/beads.png"),
	wand: require("../../assets/images/glyphs/wand.png"),
	mask: require("../../assets/images/glyphs/mask.png"),
	superhero: require("../../assets/images/glyphs/superhero.png"),
	pigface: require("../../assets/images/glyphs/pigface.png"),
	sun: require("../../assets/images/glyphs/sun.png"),
	cloud: require("../../assets/images/glyphs/cloud.png"),
	soccer: require("../../assets/images/glyphs/soccer.png"),
	coffee: require("../../assets/images/glyphs/coffee.png"),
	scene: require("../../assets/images/glyphs/scene.png"),
	snail: require("../../assets/images/glyphs/snail.png"),
	statusdot: require("../../assets/images/glyphs/statusdot.png"),
	handshake: require("../../assets/images/glyphs/handshake.png"),
	friends: require("../../assets/images/glyphs/friends.png"),
	halo: require("../../assets/images/glyphs/halo.png"),
	sleepyface: require("../../assets/images/glyphs/sleepyface.png"),
	dizzy: require("../../assets/images/glyphs/dizzy.png"),
	ogre: require("../../assets/images/glyphs/ogre.png"),
	pinch: require("../../assets/images/glyphs/pinch.png"),
	clipboard: require("../../assets/images/glyphs/clipboard.png"),
	premium: require("../../assets/images/glyphs/premium.png"),
	flame: require("../../assets/images/glyphs/flame.png"),
	globe: require("../../assets/images/glyphs/globe.png"),
	ghost: require("../../assets/images/glyphs/ghost.png"),
	// The Ghost Sheep Trader — his own sticker (2026-09-17), for the fan row's mark.
	trader: require("../../assets/images/glyphs/trader.png"),
	// The Barn button's door — the barn front with the right leaf swung open,
	// painted in the satchel sticker style (2026-09-17; replaces the BarnDoor SVG).
	barnDoor: require("../../assets/images/glyphs/barn_door.png"),
	// The store's hanging signs (2026-09-17) — Store, Closet, Pen in the same
	// painted family (Codex ImageGen off dig/bag.png; docs/reviews/shop-signs-2026-09-17/).
	signStore: require("../../assets/images/glyphs/store.png"),
	signCloset: require("../../assets/images/glyphs/closet.png"),
	signPen: require("../../assets/images/glyphs/pen.png"),
	// The tab bar's five signs (2026-09-17) — the same painted family as the
	// Barn button's fan, one sheet so they match each other.
	tabBarn: require("../../assets/images/glyphs/tabs/barn.png"),
	tabFriends: require("../../assets/images/glyphs/tabs/friends.png"),
	tabSeason: require("../../assets/images/glyphs/tabs/season.png"),
	tabShop: require("../../assets/images/glyphs/tabs/shop.png"),
	tabMe: require("../../assets/images/glyphs/tabs/me.png"),
	// Snout Deep's painted find marks (ImageGen lane, the truffle glyph as the
	// style anchor) — what a find wears on a cleared tile, in the pouch, on the
	// reveal sticker and on the tally's disc. Truffles keep `truffle`; a stone
	// is FindMark's hand-cut pebble. (2026-09-13)
	digBoom: require("../../assets/images/glyphs/dig/boom.png"),
	digPouch: require("../../assets/images/glyphs/dig/pouch.png"),
	digApple: require("../../assets/images/glyphs/dig/apple.png"),
	digBoot: require("../../assets/images/glyphs/dig/boot.png"),
	digHorseshoe: require("../../assets/images/glyphs/dig/horseshoe.png"),
	digCap: require("../../assets/images/glyphs/dig/cap.png"),
	digShimmer: require("../../assets/images/glyphs/dig/shimmer.png"),
	digAcorn: require("../../assets/images/glyphs/dig/acorn.png"),
	digTea: require("../../assets/images/glyphs/dig/tea.png"),
	digScroll: require("../../assets/images/glyphs/dig/scroll.png"),
	digRelic: require("../../assets/images/glyphs/dig/relic.png"),
	digFurnishing: require("../../assets/images/glyphs/dig/furnishing.png"),
	digBow: require("../../assets/images/glyphs/dig/bow.png"),
	digCharm: require("../../assets/images/glyphs/dig/charm.png"),
	digBag: require("../../assets/images/glyphs/dig/bag.png"),
	// The Satchel's twelve finds (ImageGen lane, one keyed sheet sliced by
	// tools — the dig acorn + apple as the style anchors). What a find wears
	// in the bag strip, the wish bubble, the catalog and the tally's satchel
	// line. Ids mirror constants/satchel SATCHEL_FIND_IDS. (2026-09-14)
	findRiverPebble: require("../../assets/images/glyphs/finds/river_pebble.png"),
	findBlueFeather: require("../../assets/images/glyphs/finds/blue_feather.png"),
	findClover: require("../../assets/images/glyphs/finds/clover.png"),
	findSnailShell: require("../../assets/images/glyphs/finds/snail_shell.png"),
	findBrassButton: require("../../assets/images/glyphs/finds/brass_button.png"),
	findWoolTuft: require("../../assets/images/glyphs/finds/wool_tuft.png"),
	findRedBerries: require("../../assets/images/glyphs/finds/red_berries.png"),
	findPinecone: require("../../assets/images/glyphs/finds/pinecone.png"),
	findOldKey: require("../../assets/images/glyphs/finds/old_key.png"),
	findHoneycomb: require("../../assets/images/glyphs/finds/honeycomb.png"),
	findMarble: require("../../assets/images/glyphs/finds/marble.png"),
	findTinWhistle: require("../../assets/images/glyphs/finds/tin_whistle.png"),
} as const;

type RasterGlyphName = keyof typeof GLYPHS;
export type GlyphName = RasterGlyphName | "barn" | "bless" | "curse" | "pin";

// The raw image source — for Animated.Image / cases that can't use <Glyph/>.
export function glyphSource(name: RasterGlyphName) {
	return GLYPHS[name];
}

export function Glyph({
	name,
	size = 16,
	style,
}: {
	name: GlyphName;
	size?: number;
	style?: StyleProp<ImageStyle>;
}) {
	if (name === "barn" || name === "bless" || name === "curse" || name === "pin") {
		return <GameIcon name={name === "barn" ? "visit" : name} size={size} style={style} />;
	}
	return <Image source={GLYPHS[name]} style={[{ width: size, height: size }, style]} resizeMode="contain" />;
}

// Lay out a glyph/icon alongside text in a row (RN can't drop an image inside a
// <Text> run cleanly). Pass <Glyph/> or <Icon/> nodes as `left`/`right`.
export function IconText({
	left,
	right,
	children,
	gap = 5,
	style,
}: {
	left?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
	gap?: number;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>
			{left}
			{children}
			{right}
		</View>
	);
}
