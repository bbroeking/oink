// The Rosie hero the sign-in and handle screens share (SupaAuth, then
// UsernameSetup): her frame, the hero's vertical spend around her, and the
// arithmetic that sizes her. One module, so the two scenes of the same
// storybook flow land her on the same points. (2026-10-04)
import { ART_SIZE, SPACE } from "@/constants/theme";

// Rosie's own frame: idle_1.png is 370×383 with no @2x, so these are points.
// It is the size she has always drawn at on a tall phone, and her ceiling.
export const ROSIE_ART = { width: 370, height: 383 } as const;

// The hero's own vertical spend around Rosie (each screen's hero and slot
// styles read these, so the arithmetic and the layout cannot drift apart).
// Top minus bottom is the 24pt (SPACE.xl) the hero always kept above her.
export const HERO_PAD_TOP = SPACE.xxl;
export const HERO_PAD_BOTTOM = SPACE.sm;
export const ROSIE_GAP = SPACE.lg;

/**
 * Rosie's height on a hero scene: what the scene can spare once the hero's
 * pads, the words and the card are laid out, never above her own 383pt and
 * never below the portrait size (below that floor the scene scrolls).
 * `sceneH` is the window less its top and bottom safe areas. Whole points, so
 * a scene that fits never turns into a half-point scroll.
 */
export function fitRosieHeight({
	sceneH,
	wordsH,
	cardH,
}: {
	sceneH: number;
	wordsH: number;
	cardH: number;
}): number {
	const spare = sceneH - (HERO_PAD_TOP + HERO_PAD_BOTTOM + ROSIE_GAP + wordsH + cardH);
	return Math.floor(Math.min(ROSIE_ART.height, Math.max(ART_SIZE.portrait, spare)));
}
