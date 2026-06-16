// Backgrounds that animate. An id listed here renders through
// <AnimatedBackground> (a cross-fading ping-pong loop over the frames) instead
// of a single static image. The frame list is ordered as one sweep; playback
// ping-pongs (forward then reverse) so the motion reads as a back-and-forth
// wave and the last frame never has to seam back to the first.
import type { ImageSourcePropType } from "react-native";

export const ANIMATED_BACKGROUNDS: Record<string, ImageSourcePropType[]> = {
	northern_lights: [
		require("../assets/images/backgrounds/northern_lights_1.png"),
		require("../assets/images/backgrounds/northern_lights_2.png"),
		require("../assets/images/backgrounds/northern_lights_3.png"),
		require("../assets/images/backgrounds/northern_lights_4.png"),
		require("../assets/images/backgrounds/northern_lights_5.png"),
	],
};

export function isAnimatedBackground(id: string | null | undefined): boolean {
	return !!id && id in ANIMATED_BACKGROUNDS;
}
