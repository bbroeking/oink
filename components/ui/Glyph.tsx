// Image glyphs — hand-drawn replacements for decorative/pictographic emoji, in
// the game's cozy sticker style. Use instead of literal emoji characters.
// Functional symbols (arrows, close, check, bullet) live in ./Icon (SVG).
import type { ReactNode } from "react";
import { Image, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";

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
	barn: require("../../assets/images/glyphs/barn.png"),
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
} as const;

export type GlyphName = keyof typeof GLYPHS;

// The raw image source — for Animated.Image / cases that can't use <Glyph/>.
export function glyphSource(name: GlyphName) {
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
