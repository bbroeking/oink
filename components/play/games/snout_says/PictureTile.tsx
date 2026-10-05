// One picture on a paper tile. The spread, the tray, the small answer card
// and the reveal all draw it, in one of five states:
//   idle    paper with the small sticker shadow
//   lifted  sun, heavy outline, full sticker shadow: the picture you picked,
//           or the tile you just tapped while the table answers
//   ringed  sun with a heavy outline: the answer, as a Nose sees it, and as
//           everyone sees it in the reveal
//   dimmed  a wrong tap: still the picture, at the dim opacity, flat
//   fogged  the free sniff: the never-carried grammar (cream, dashed, the
//           picture as a silhouette), so a fogged tile reads as "not this"
// A tile is pressable only when the board passes `onPress`; dimmed and
// fogged tiles never get one. Turning dimmed lands with Rosie's squash (a
// soft thud); turning ringed with `celebrate` pops on the overshoot spring.
//
// Two ways to size it. Natural (no `height`): at least as tall as it is
// wide, the picture stepped up by the width. Fitted (`height`, from the
// board's plan in ./layout.ts): exactly that tall, the picture as big as the
// tile allows and the short name under it only when both fit; the name
// always stays in the accessibility label. A fitted tile under TAP_MIN gets
// its frame back as vertical hitSlop into the gap between rows.
import { useEffect, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { ART_SIZE, BORDER, CHROME_TYPE_CAP, MOTION_SPRING, OPACITY, RADII, SPACE, TAP_MIN, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import { restPose, squashAndSpring } from "@/utils/motionRecipes";
import type { PictureId } from "@/multiplayer/games/snout_says/deck";
import { Glyph, Sticker, T } from "@/components/ui";
import { useTextScale } from "../fit";
import { tileFace } from "./layout";
import { pictureArt } from "./pictures";

export type TileState = "idle" | "lifted" | "ringed" | "dimmed" | "fogged";

// Drawing geometry: the tile widths at which the picture steps up a size.
const BADGE_AT = 88;
const GLYPH_AT = 60;
// The reveal's answer pops from a touch under its own size.
const POP_FROM = 0.86;

function glyphSize(tile: number): number {
	if (tile >= BADGE_AT) return ART_SIZE.badge;
	if (tile >= GLYPH_AT) return ART_SIZE.glyph;
	if (tile >= TAP_MIN) return ART_SIZE.glyphMd;
	return ART_SIZE.glyphSm;
}

export function PictureTile({
	id,
	size,
	height,
	state = "idle",
	label = false,
	labelLines = 2,
	hitSlop = 0,
	celebrate = false,
	reduceMotion,
	onPress,
	accessibilityLabel,
	accessibilityHint,
	testID,
}: {
	id: PictureId;
	/** Tile width in points; without `height` the tile is at least this tall. */
	size: number;
	/** The fitted tile's exact height (the board's plan); omitted: natural. */
	height?: number;
	state?: TileState;
	/** Draw the picture's short name under it. */
	label?: boolean;
	/** Fitted: the label lines the plan reserves (drawn only if they fit). */
	labelLines?: number;
	/** Fitted: the vertical hitSlop that restores a short tile's frame. */
	hitSlop?: number;
	/** Pop when the tile turns ringed (the reveal's answer). */
	celebrate?: boolean;
	reduceMotion: boolean;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
}) {
	const policy = useMotionPolicy();
	const still = reduceMotion || policy.reduceMotion;
	const [scale] = useState(() => new Animated.Value(1));
	const [shown, setShown] = useState(state);

	// The moment a tile changes state is the one the motion is for: adjusted
	// during render (React's sanctioned way), then played by the effect.
	const [cue, setCue] = useState<"thud" | "pop" | null>(null);
	if (shown !== state) {
		setShown(state);
		setCue(state === "dimmed" ? "thud" : state === "ringed" && celebrate ? "pop" : null);
	}
	const [mountedRinged] = useState(state === "ringed" && celebrate);

	useEffect(() => {
		const play = cue ?? (mountedRinged ? "pop" : null);
		if (!play) return;
		if (still) {
			restPose(scale, 1).start();
			return;
		}
		if (play === "thud") {
			const thud = squashAndSpring(scale, policy);
			thud.start();
			return () => thud.stop();
		}
		scale.setValue(POP_FROM);
		const pop = Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...MOTION_SPRING.overshoot });
		pop.start();
		return () => pop.stop();
	}, [cue, mountedRinged, still, policy, scale]);

	const s = useTextScale();
	const art = pictureArt(id);
	const lifted = state === "lifted" || state === "ringed";
	const fogged = state === "fogged";
	const dimmed = state === "dimmed" || fogged;
	const face = height === undefined ? null : tileFace(size, height, s, label ? labelLines : 0);
	const glyph = face ? face.glyph : glyphSize(size);
	const lines = face ? face.labelLines : label ? 2 : 0;
	const pressable = !!onPress && !dimmed;
	const slop = pressable && hitSlop > 0 ? { top: hitSlop, bottom: hitSlop } : undefined;

	return (
		<Animated.View style={[{ width: size, transform: [{ scale }] }, dimmed && styles.dimmed]} testID={testID}>
			<Sticker
				color={fogged ? "cream2" : lifted ? "sun" : "paper"}
				radius={RADII.lg}
				border={lifted ? BORDER.heavy : BORDER.ink}
				borderStyle={fogged ? "dashed" : "solid"}
				shadow={dimmed ? "none" : state === "lifted" ? "sticker" : "sm"}
				rotate={0}
				onPress={dimmed ? undefined : onPress}
				hitSlop={slop}
				accessibilityRole={pressable ? "button" : "image"}
				accessibilityLabel={accessibilityLabel ?? art.name}
				accessibilityHint={pressable ? accessibilityHint : undefined}
				accessibilityState={state === "lifted" ? { selected: true } : undefined}
				style={[styles.tile, face ? { height, paddingVertical: face.padY } : { minHeight: size }]}
			>
				<Glyph
					name={art.glyph}
					size={glyph}
					style={fogged ? [styles.silhouette, { tintColor: WHIMSY.ink }] : undefined}
				/>
				{lines > 0 ? (
					<T
						role="kicker"
						align="center"
						tone={dimmed ? "secondary" : "primary"}
						numberOfLines={lines}
						maxFontSizeMultiplier={CHROME_TYPE_CAP}
						testID={testID ? `${testID}-label` : undefined}
					>
						{art.short}
					</T>
				) : null}
			</Sticker>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	tile: {
		alignItems: "center",
		justifyContent: "center",
		gap: SPACE.xxs,
		paddingVertical: SPACE.xs,
		paddingHorizontal: SPACE.xxs,
	},
	dimmed: { opacity: OPACITY.dim },
	silhouette: { opacity: OPACITY.ghost },
});
