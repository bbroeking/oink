// The Great Hungerer — season-screen vignette of the world boss, staged by the
// server-wide energy meter (hooks/useHungerMeter). The whole barnyard's war
// effort drains him; this is where players SEE it: he shrinks, his glow thins,
// he slumps, and the stage is named only as a hand-written whisper —
// never a number or a bar (taste standard: feelings are shown, not labeled).
//
// ART: the real generated boss (the LOCKED crowned-hog render, alpha cutout,
// downscaled into assets/images/hunger/ — never from assets/concepts/, which
// isn't bundled). His crown is baked into the art, so the old crown-Glyph
// overlay is gone; the per-stage weakening cue is a gentle whole-body slump.

import { useEffect } from "react";
import { View, Text, Image, ImageBackground, StyleSheet } from "react-native";
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withSequence,
	withTiming,
	Easing,
} from "react-native-reanimated";
import {
	FONTS,
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	WHIMSY,
} from "@/constants/theme";
import {
	useHungerMeter,
	HUNGER_STAGE_LINE,
	HUNGER_LEVEL_NAME,
	hungerCredit,
	formatCredit,
	type HungerStage,
} from "@/hooks/useHungerMeter";

const HUNGER = require("../assets/images/hunger/great_hungerer_hero.png");
const BOG = require("../assets/images/backgrounds/bog_dusk_bg.png");

// Per-stage staging: how big he looms, how strong his gorged glow is, how far
// he's slumped, and how hard he's breathing. One row per stage so the values
// retune without touching the render.
type StageArt = {
	hero: number; // scale of the boss
	aura: number; // 0..1 opacity of the gorged glow behind him
	slump: number; // degrees of whole-body lean — grows as he weakens
	breatheTo: number; // breathing amplitude (smug & slow → shallow & tired)
};
const HUNGER_ART: Record<HungerStage, StageArt> = {
	gorged: { hero: 1.5, aura: 0.55, slump: -1, breatheTo: 1.05 },
	stuffed: { hero: 1.42, aura: 0.45, slump: -2, breatheTo: 1.045 },
	full: { hero: 1.32, aura: 0.35, slump: -3, breatheTo: 1.04 },
	peckish: { hero: 1.2, aura: 0.24, slump: -4.5, breatheTo: 1.03 },
	hungry: { hero: 1.08, aura: 0.14, slump: -6.5, breatheTo: 1.02 },
	famished: { hero: 0.94, aura: 0.06, slump: -9.5, breatheTo: 1.012 },
};

export function GreatHungerMeter({ refreshKey }: { refreshKey?: number } = {}) {
	const meter = useHungerMeter(refreshKey);
	const art = HUNGER_ART[meter.stage];

	// Slow gorging breath — amplitude eases down as he weakens.
	const breathe = useSharedValue(1);
	useEffect(() => {
		breathe.value = withRepeat(
			withSequence(
				withTiming(art.breatheTo, {
					duration: 1700,
					easing: Easing.inOut(Easing.quad),
				}),
				withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) })
			),
			-1,
			true
		);
	}, [art.breatheTo, breathe]);
	const heroStyle = useAnimatedStyle(() => ({
		transform: [{ scale: art.hero * breathe.value }],
	}));

	return (
		<View style={styles.wrap}>
			<ImageBackground
				source={BOG}
				style={styles.scene}
				imageStyle={styles.sceneImg}
				resizeMode="cover"
			>
				{/* Gorged glow — thins as the barnyard drains him. */}
				<View
					pointerEvents="none"
					style={[styles.aura, { opacity: art.aura }]}
				/>

				<Animated.View style={[styles.heroWrap, heroStyle]}>
					{/* The boss himself — his crown is in the art; the weakening
					    cue is a gentle whole-body slump per stage. */}
					<Image
						source={HUNGER}
						resizeMode="contain"
						style={[styles.hero, { transform: [{ rotate: `${art.slump}deg` }] }]}
					/>
				</Animated.View>

				{/* Stage whisper — the only words on the scene. */}
				<View style={styles.whisperCard}>
					<Text style={styles.whisper}>{HUNGER_STAGE_LINE[meter.stage]}</Text>
				</View>
			</ImageBackground>

			{/* Level + credit strip — progression numbers (allowed by the taste
			    standard; feelings stay in the vignette above). Credit is the
			    obfuscated scale: raw server totals × HUNGER_CREDIT_SCALE, so
			    thresholds stay retunable mid-season. */}
			{meter.available && (
				<View style={styles.creditRow}>
					<Text style={styles.creditLevel}>{HUNGER_LEVEL_NAME[meter.stage]}</Text>
					<Text style={styles.creditNum}>
						{formatCredit(hungerCredit(meter.total))}
						<Text style={styles.creditLabel}> tickles reclaimed</Text>
					</Text>
					{meter.nextThreshold != null && (
						<Text style={styles.creditNext}>
							he weakens at {formatCredit(hungerCredit(meter.nextThreshold))}
						</Text>
					)}
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		overflow: "hidden",
		...STICKER_SHADOW,
		backgroundColor: WHIMSY.ink,
	},
	scene: {
		height: 190,
		alignItems: "center",
		justifyContent: "center",
	},
	sceneImg: { borderRadius: RADII.xl - 2 },
	aura: {
		position: "absolute",
		width: 220,
		height: 220,
		borderRadius: 110,
		backgroundColor: WHIMSY.sun,
	},
	heroWrap: { alignItems: "center" },
	hero: { width: 120, height: 120 },
	whisperCard: {
		position: "absolute",
		left: SPACE.md,
		right: SPACE.md,
		bottom: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
	},
	whisper: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.ink,
		textAlign: "center",
	},
	creditRow: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: SPACE.sm,
		backgroundColor: WHIMSY.paper,
		borderTopWidth: 2,
		borderTopColor: WHIMSY.ink,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs + 2,
	},
	creditLevel: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	creditNum: {
		flex: 1,
		fontFamily: FONTS.whimsy,
		fontSize: 15,
		color: WHIMSY.ink,
		textAlign: "right",
	},
	creditLabel: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.mute },
	creditNext: { fontFamily: FONTS.hand, fontSize: 11, color: WHIMSY.mute },
});
