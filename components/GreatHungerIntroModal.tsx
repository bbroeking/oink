// The Great Hunger — Season 1 intro. A 5-beat animated storybook that
// introduces the season villain: a Hungry Hog eating the world's tickles
// (narratively = the global regen "blight"), and the call to rally your
// Sounder for Mud Wars. Follows the established full-screen season-moment
// pattern (AllegianceModal / JudgementDayModal), routed through the launch
// PopupQueue and gated on the `world_boss` server flag + a first-view marker.
//
// ART SLOTS: every beat's `bg`/`hero` is a placeholder using existing assets
// (bog/mire backgrounds + a dark-tinted pig silhouette as the stand-in Hungry
// Hog). Swap the `hero` requires for the Midjourney/Meshy hog art + per-beat
// scene art as it lands — the beat copy + motion stay put.

import { useCallback, useEffect, useState } from "react";
import {
	Modal,
	View,
	Text,
	Pressable,
	StyleSheet,
	ImageBackground,
	Image,
	type ImageSourcePropType,
} from "react-native";
import Animated, {
	FadeIn,
	FadeOut,
	useSharedValue,
	useAnimatedStyle,
	withRepeat,
	withTiming,
	withSequence,
	Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import { Button } from "./ui";
import { Glyph, IconText } from "./ui/Glyph";
import {
	FONTS,
	MODAL_BACKDROP_BG,
	RADII,
	SPACE,
	STICKER_SHADOW,
	WHIMSY,
} from "@/constants/theme";

// ── Beat script ──────────────────────────────────────────────────────
// bg = scenery; hero = foreground character (Rosie sticker on valley/rally
// beats, the real Hungerer render on "arrive"); heroTint stays available for
// silhouette beats. fog = overlay intensity (the "peckish fog" rolls in as
// the Hunger arrives, then eases as we rally).
type Beat = {
	key: string;
	bg: ImageSourcePropType;
	hero: ImageSourcePropType;
	heroTint?: string;
	heroScale: number;
	breathe?: boolean;
	sparkles?: "rising" | "eaten" | null;
	fog: number;
	kicker: string;
	line: string;
	cta?: string;
};

// Heroes: the full-body Rosie sticker carries the valley/rally beats; the
// "arrive" beat shows the REAL Great Hungerer (the LOCKED crowned-hog render,
// alpha cutout, bundled via assets/images/hunger/).
const PIG = require("../assets/images/pig.png");
const HUNGER = require("../assets/images/hunger/great_hungerer_hero.png");

const BEATS: Beat[] = [
	{
		key: "calm",
		bg: require("../assets/images/backgrounds/golden_mire_bg.png"),
		hero: PIG,
		heroScale: 1,
		sparkles: "rising",
		fog: 0.04,
		kicker: "a full valley",
		line: "Once, the whole valley was full of tickles…",
	},
	{
		key: "arrive",
		bg: require("../assets/images/backgrounds/bog_dusk_bg.png"),
		hero: HUNGER,
		heroScale: 2.1,
		breathe: true,
		sparkles: "eaten",
		fog: 0.4,
		kicker: "the great hunger",
		line: "…until the Great Hunger came — a hog so hungry it ate them all.",
	},
	{
		key: "slow",
		bg: require("../assets/images/backgrounds/reed_marsh_bg.png"),
		hero: PIG,
		heroScale: 0.92,
		fog: 0.5,
		kicker: "a sleepy world",
		line: "Now every pig is a little sleepier. The world needs its tickles back.",
	},
	{
		key: "rally",
		bg: require("../assets/images/backgrounds/mud_pit_bg.png"),
		hero: PIG,
		heroScale: 1.05,
		fog: 0.28,
		kicker: "shoo the hog",
		line: "But a full valley can shoo any hog — every tickle, visit, and truffle helps push it back.",
	},
	{
		key: "muster",
		bg: require("../assets/images/backgrounds/mud_derby_bg.png"),
		hero: PIG,
		heroScale: 1.1,
		sparkles: "rising",
		fog: 0.1,
		kicker: "to the mud",
		line: "Rally your Sounder. It’s time for Mud Scuffles.",
		cta: "Rally your Sounder",
	},
];

// ── The tale reel ────────────────────────────────────────────────────
// "Watch the tale" plays the REAL cinematic — the generated-panel animated
// cut with the ElevenLabs narration track (captions burned into the frames,
// so no native caption card renders over it). The bundled asset is a
// mobile re-encode of assets/concepts/great-hungerer/video/
// great_hunger_generated_panels_animated_v2_no_app_section.mp4: trimmed at
// 29.1s to drop the dated marketing CTA card (players watching this are
// already inside Season 1), 720×1280 CRF-27 → 4.1 MB. The 40 MB master
// stays out of the bundle (nothing require()s it). This retires the native
// Ken Burns slideshow that stood in while the repo shipped no video player.
const TALE_VIDEO = require("../assets/video/great_hunger_tale.mp4");

// A single tickle-sparkle that drifts (up when "rising", toward the hog's maw
// when "eaten") on a staggered repeat.
function Sparkle({ delay, eaten }: { delay: number; eaten?: boolean }) {
	const t = useSharedValue(0);
	useEffect(() => {
		t.value = withRepeat(
			withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
			-1,
			false
		);
	}, [t]);
	const style = useAnimatedStyle(() => {
		const p = t.value;
		return {
			opacity: p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1,
			transform: [
				{ translateY: eaten ? p * 26 : -p * 90 },
				{ translateX: eaten ? p * 40 : (p - 0.5) * 18 },
				{ scale: eaten ? 1 - p * 0.5 : 0.6 + p * 0.5 },
			],
		};
	});
	return (
		<Animated.View
			style={[
				styles.sparkle,
				{ left: `${12 + delay * 15}%`, bottom: `${28 + (delay % 3) * 12}%` },
				style,
			]}
		>
			<Glyph name="sparkles" size={20} />
		</Animated.View>
	);
}

export function GreatHungerIntroModal({
	visible,
	onDone,
	autoPlayReel = false,
}: {
	visible: boolean;
	// Fired on the final CTA ("Rally your Sounder") or Skip — the parent
	// dismisses and can route on to the season.
	onDone: (action: "rally" | "skip") => void;
	// First-ever Season-1 visit leads with the cinematic tale reel; the
	// storybook beats wait underneath for when it closes.
	autoPlayReel?: boolean;
}) {
	const [beat, setBeat] = useState(0);
	// The cinematic "watch the tale" reel, layered over the beats on demand.
	const [reelOpen, setReelOpen] = useState(false);
	// Restart the tale on every open — the season tab's "Hear the tale again"
	// chip re-opens this modal, and a retold story must start at beat one.
	// A first-visit open leads with the reel itself.
	useEffect(() => {
		if (visible) {
			setBeat(0);
			setReelOpen(autoPlayReel);
		}
	}, [visible, autoPlayReel]);
	const B = BEATS[beat];
	const isLast = beat === BEATS.length - 1;

	// Ambient hog "breathing" — a slow scale pulse on the arrival beat.
	const breathe = useSharedValue(1);
	useEffect(() => {
		breathe.value = B.breathe
			? withRepeat(
					withSequence(
						withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
						withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) })
					),
					-1,
					true
				)
			: withTiming(1, { duration: 300 });
	}, [B.breathe, breathe]);
	const heroStyle = useAnimatedStyle(() => ({
		transform: [{ scale: B.heroScale * breathe.value }],
	}));

	const advance = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		if (isLast) {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
				() => {}
			);
			onDone("rally");
		} else {
			setBeat((b) => b + 1);
		}
	}, [isLast, onDone]);

	return (
		<Modal visible={visible} animationType="fade" transparent onRequestClose={() => onDone("skip")}>
			<View style={styles.root}>
				{/* Scene — crossfades on each beat via key remount. */}
				<Animated.View
					key={B.key}
					entering={FadeIn.duration(500)}
					exiting={FadeOut.duration(220)}
					style={StyleSheet.absoluteFill}
				>
					<ImageBackground source={B.bg} style={styles.scene} resizeMode="cover">
						<Animated.View style={[styles.heroWrap, heroStyle]}>
							<Image
								source={B.hero}
								resizeMode="contain"
								style={[
									styles.hero,
									B.heroTint ? { tintColor: B.heroTint } : null,
								]}
							/>
						</Animated.View>
						{B.sparkles &&
							[0, 1, 2, 3, 4].map((i) => (
								<Sparkle key={i} delay={i} eaten={B.sparkles === "eaten"} />
							))}
					</ImageBackground>
				</Animated.View>

				{/* Peckish fog — a warm ink veil whose weight tracks the beat. */}
				<FogVeil intensity={B.fog} />

				{/* Skip — always available; a season intro must never trap. */}
				<Pressable
					onPress={() => onDone("skip")}
					style={styles.skip}
					hitSlop={12}
				>
					<Text style={styles.skipText}>Skip</Text>
				</Pressable>

				{/* Story card + advance. */}
				<View style={styles.cardWrap}>
					<Animated.View
						key={`c-${B.key}`}
						entering={FadeIn.duration(420).delay(120)}
						style={styles.card}
					>
						<Text style={styles.kicker}>{"★ "}{B.kicker}</Text>
						<Text style={styles.line}>{B.line}</Text>
					</Animated.View>

					<View style={styles.dots}>
						{BEATS.map((_, i) => (
							<View
								key={i}
								style={[styles.dot, i === beat && styles.dotActive]}
							/>
						))}
					</View>

					<Button size="lg" variant="primary" full onPress={advance}>
						{B.cta ?? "Next"}
					</Button>

					{/* Watch the tale — opens the full cinematic seven-shot reel
					    over the beats. A quiet hand-drawn affordance, never a
					    second loud button competing with the primary CTA. */}
					<Pressable
						onPress={() => {
							Haptics.selectionAsync().catch(() => {});
							setReelOpen(true);
						}}
						style={styles.taleLink}
						hitSlop={10}
					>
						<IconText left={<Glyph name="scene" size={16} />} gap={6}>
							<Text style={styles.taleLinkText}>Watch the tale</Text>
						</IconText>
					</Pressable>
				</View>

				{/* The cinematic reel, layered above everything when opened. */}
				<GreatHungerTaleReel visible={reelOpen} onClose={() => setReelOpen(false)} />
			</View>
		</Modal>
	);
}

// ── The tale reel ────────────────────────────────────────────────────
// The outer component gates on `visible` so the player mounts fresh per
// open (autoplay from 0:00 every time) and releases on close — useVideoPlayer
// ties the native player's lifetime to the mount.
function GreatHungerTaleReel({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	if (!visible) return null;
	return <TaleReelPlayer onClose={onClose} />;
}

function TaleReelPlayer({ onClose }: { onClose: () => void }) {
	// Holds the final frame + native CTA card once narration finishes.
	const [ended, setEnded] = useState(false);
	const player = useVideoPlayer(TALE_VIDEO, (p) => {
		p.loop = false;
		p.play();
	});
	useEffect(() => {
		const sub = player.addListener("playToEnd", () => setEnded(true));
		return () => sub.remove();
	}, [player]);

	const finish = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		onClose();
	}, [onClose]);

	return (
		<Animated.View
			entering={FadeIn.duration(280)}
			exiting={FadeOut.duration(200)}
			style={styles.reelRoot}
		>
			{/* Captions ride inside the video; controls stay native-free so
			    the cinematic reads as a story moment, not a media player. */}
			<VideoView
				player={player}
				style={StyleSheet.absoluteFill}
				contentFit="cover"
				nativeControls={false}
			/>

			{/* Narration done — hold the last frame under the closing card. */}
			{ended && (
				<Pressable style={StyleSheet.absoluteFill} onPress={finish}>
					<View style={styles.reelCaptionWrap}>
						<Animated.View
							entering={FadeIn.duration(440).delay(120)}
							style={styles.card}
						>
							<Text style={styles.line}>The Great Hunger has begun.</Text>
							<Text style={styles.reelCta}>Help win them back.</Text>
						</Animated.View>
					</View>
				</Pressable>
			)}

			{/* Close the reel and return to the beats — a tale must never trap. */}
			<Pressable onPress={finish} style={styles.reelClose} hitSlop={12}>
				<Glyph name="close" size={16} />
			</Pressable>
		</Animated.View>
	);
}

function FogVeil({ intensity }: { intensity: number }) {
	const op = useSharedValue(intensity);
	useEffect(() => {
		op.value = withTiming(intensity, { duration: 600 });
	}, [intensity, op]);
	const style = useAnimatedStyle(() => ({ opacity: op.value }));
	return (
		<Animated.View
			pointerEvents="none"
			style={[StyleSheet.absoluteFill, styles.fog, style]}
		/>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: WHIMSY.ink },
	scene: { flex: 1, alignItems: "center", justifyContent: "center" },
	heroWrap: { alignItems: "center", justifyContent: "center" },
	hero: { width: 180, height: 180 },
	sparkle: { position: "absolute" },
	fog: { backgroundColor: MODAL_BACKDROP_BG },
	skip: {
		position: "absolute",
		top: 52,
		right: 20,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		backgroundColor: "rgba(255,250,240,0.85)",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
	skipText: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	cardWrap: {
		position: "absolute",
		left: SPACE.lg,
		right: SPACE.lg,
		bottom: 44,
		gap: SPACE.md,
	},
	card: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 2.5,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xxl,
		paddingHorizontal: SPACE.lg,
		paddingVertical: SPACE.lg,
		...STICKER_SHADOW,
	},
	kicker: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 11,
		letterSpacing: 1.4,
		textTransform: "uppercase",
		color: WHIMSY.accent,
		marginBottom: SPACE.xs,
	},
	line: {
		fontFamily: FONTS.whimsy,
		fontSize: 22,
		lineHeight: 28,
		color: WHIMSY.ink,
	},
	dots: { flexDirection: "row", justifyContent: "center", gap: 7 },
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "rgba(255,250,240,0.55)",
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
	},
	dotActive: { backgroundColor: WHIMSY.sun, width: 22 },

	// Watch-the-tale affordance — a quiet hand-drawn link under the CTA.
	taleLink: { alignSelf: "center", paddingVertical: SPACE.xs },
	taleLinkText: {
		fontFamily: FONTS.hand,
		fontSize: 16,
		color: WHIMSY.paper,
		textDecorationLine: "underline",
	},

	// The cinematic reel overlay.
	reelRoot: { ...StyleSheet.absoluteFillObject, backgroundColor: WHIMSY.ink },
	reelCaptionWrap: {
		position: "absolute",
		left: SPACE.lg,
		right: SPACE.lg,
		bottom: 56,
		gap: SPACE.md,
	},
	reelCta: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		letterSpacing: 0.6,
		color: WHIMSY.accent,
		marginTop: SPACE.sm,
	},
	reelClose: {
		position: "absolute",
		top: 52,
		right: 20,
		width: 34,
		height: 34,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 999,
		backgroundColor: "rgba(255,250,240,0.85)",
		borderWidth: 2,
		borderColor: WHIMSY.ink,
	},
});
