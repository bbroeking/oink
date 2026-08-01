import React from "react";
import {
	Image,
	ImageProps,
	StyleSheet,
	View,
	useWindowDimensions,
} from "react-native";
import { HAT_IMAGES } from "@/constants/hats";
import {
	ANIMATED_BACKGROUNDS,
	isAnimatedBackground,
} from "@/constants/animatedBackgrounds";
import { AnimatedBackground } from "./AnimatedBackground";

// Explicit current-window pixels, NOT percentage / absoluteFill insets. A
// percentage-sized background <Image> hits RN's Yoga indefinite-size quirk and
// falls back toward the art's intrinsic size, rendering a centered band that
// leaves an edge — most visibly the LEFT — showing the layer behind it. Numeric
// window size preserves that cure while still reacting to Display Zoom and
// live window changes.

interface Props {
	/**
	 * The currently-equipped background id, or null/undefined for the
	 * default homestead_barn fallback. Resolution chain:
	 *   1. bgId → HAT_IMAGES[bgId]   (the user's choice)
	 *   2. HAT_IMAGES.homestead_barn (the default barn pasture)
	 *   3. require(homepage-bg.jpg)  (raw asset — only if HAT_IMAGES is
	 *      somehow empty, which would mean the bundler is broken)
	 */
	bgId?: string | null;
	children?: React.ReactNode;
	resizeMode?: ImageProps["resizeMode"];
}

/**
 * The full-page background for any screen that wants the equipped
 * background image stretched edge-to-edge behind its content.
 *
 * This is intentionally a **page background**, not an overlay or
 * card-bounded layer. It stretches to fill the full visible area:
 * behind the status bar at the top, behind the tab bar at the bottom,
 * edge to edge horizontally. Any SafeAreaView or other content lives
 * INSIDE the children prop so insets only pad content, not the image.
 *
 * Backgrounds are NOT rendered anywhere else in the app — there's no
 * "in-card background overlay" anymore. If you need a background, you
 * mount this component.
 */
export function PageBackground({ bgId, children, resizeMode = "cover" }: Props) {
	const { width, height } = useWindowDimensions();
	// Animated backgrounds (e.g. northern_lights) cross-fade a frame loop.
	if (isAnimatedBackground(bgId)) {
		return (
			<AnimatedBackground
				frames={ANIMATED_BACKGROUNDS[bgId!]}
				resizeMode={resizeMode}
			>
				{children}
			</AnimatedBackground>
		);
	}

	const bgSrc =
		(bgId && HAT_IMAGES[bgId]) ||
		HAT_IMAGES.homestead_barn ||
		require("../../assets/images/homepage-bg.jpg");

	return (
		<View style={styles.root}>
			<Image
				source={bgSrc}
				resizeMode={resizeMode}
				style={[styles.fill, { width: width + 4, height }]}
			/>
			<View style={styles.content}>{children}</View>
		</View>
	);
}

const styles = StyleSheet.create({
	// Edge-to-edge: needs a flex:1 parent to expand into.
	root: { flex: 1 },
	// Explicit screen pixels (see note above) so `cover` fills the whole screen
	// instead of a centered intrinsic-width band. Overscan 2px each side so a
	// sub-pixel rounding gap can never leave a sliver of the layer behind showing
	// at an edge — `cover` just crops the extra.
	fill: { position: "absolute", top: 0, left: -2 },
	content: { flex: 1 },
});
