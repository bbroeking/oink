// The Great Hunger — Season 2 intro. A 5-beat animated storybook that
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

import { type ReactNode, useCallback, useEffect, useState } from "react";
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
// "Watch the tale" plays the full cinematic seven-shot Great Hunger story —
// the same beats the offline slideshow renders (great_hunger_slideshow_v2.mp4),
// but native: the real Midjourney "higgsfield" story art crossfaded with a
// slow Ken Burns drift, the captions carried VERBATIM from the render's build
// script (scripts/build_walking_slideshow.py, the `higgsfield` set + CTA).
//
// We render it natively rather than embedding the 13 MB .mp4 because the repo
// ships no video player (no expo-av / expo-video in package.json) — reanimated
// crossfades over the shot frames are the animation vocabulary this app already
// speaks, keep the world responding *now* (no buffering), and cost only the
// seven bundled stills instead of a video module + a large binary. The frames
// live under assets/concepts/great-hungerer/higgsfield_set/. See the PR notes
// for the remote-.mp4 alternative if a true video player ever lands.
type Shot = {
	key: string;
	img: ImageSourcePropType;
	line: string;
	move: "in" | "inDeep" | "driftR" | "driftL";
	cta?: string;
};

const SHOTS: Shot[] = [
	{
		key: "valley",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_01_valley_of_tickles.png"),
		line: "Once, the valley glowed gold…",
		move: "in",
	},
	{
		key: "asleep",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_02_rosie_asleep.png"),
		line: "…and no one loved them\nmore than Rosie.",
		move: "driftR",
	},
	{
		key: "arrive",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_03_hunger_arrives.png"),
		line: "But then… the Great Hunger.",
		move: "in",
	},
	{
		key: "theft",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_04_the_theft.png"),
		line: "He ate every last tickle.",
		move: "driftL",
	},
	{
		key: "dawn",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_05_grey_dawn.png"),
		line: "Morning came. The gold was gone.",
		move: "in",
	},
	{
		key: "empty",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_06_empty_valley.png"),
		line: "The tickles were gone.\nEvery last one.",
		move: "driftR",
	},
	{
		key: "begun",
		img: require("../assets/concepts/great-hungerer/higgsfield_set/shot_07_hunger_begins.png"),
		line: "The Great Hunger has begun.",
		move: "inDeep",
		cta: "Help win them back.",
	},
];

// How long each shot holds before auto-advancing (a tap skips ahead sooner).
const SHOT_MS = 4200;

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
}: {
	visible: boolean;
	// Fired on the final CTA ("Rally your Sounder") or Skip — the parent
	// dismisses and can route on to the season.
	onDone: (action: "rally" | "skip") => void;
}) {
	const [beat, setBeat] = useState(0);
	// The cinematic "watch the tale" reel, layered over the beats on demand.
	const [reelOpen, setReelOpen] = useState(false);
	// Restart the tale on every open — the season tab's "Hear the tale again"
	// chip re-opens this modal, and a retold story must start at beat one.
	useEffect(() => {
		if (visible) {
			setBeat(0);
			setReelOpen(false);
		}
	}, [visible]);
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

// ── Ken Burns ────────────────────────────────────────────────────────
// A slow, hand-wound push/drift on a still, so the reel breathes like the
// rendered slideshow instead of snapping between flat frames. The `move`
// mirrors the per-shot camera hint in the build script.
function KenBurns({
	move,
	duration,
	children,
}: {
	move: Shot["move"];
	duration: number;
	children: ReactNode;
}) {
	const t = useSharedValue(0);
	useEffect(() => {
		t.value = 0;
		t.value = withTiming(1, { duration, easing: Easing.inOut(Easing.quad) });
	}, [t, duration]);
	const style = useAnimatedStyle(() => {
		const p = t.value;
		let scale = 1;
		let tx = 0;
		if (move === "in") scale = 1 + p * 0.08;
		else if (move === "inDeep") scale = 1 + p * 0.12;
		else if (move === "driftR") {
			scale = 1.06;
			tx = (p - 0.5) * 40;
		} else if (move === "driftL") {
			scale = 1.06;
			tx = (0.5 - p) * 40;
		}
		return { transform: [{ scale }, { translateX: tx }] };
	});
	return (
		<Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
	);
}

// ── The tale reel ────────────────────────────────────────────────────
function GreatHungerTaleReel({
	visible,
	onClose,
}: {
	visible: boolean;
	onClose: () => void;
}) {
	const [i, setI] = useState(0);
	useEffect(() => {
		if (visible) setI(0);
	}, [visible]);
	const S = SHOTS[i];
	const isLast = i === SHOTS.length - 1;

	// Auto-advance until the closing shot, which holds on its CTA until tapped.
	useEffect(() => {
		if (!visible || isLast) return;
		const id = setTimeout(
			() => setI((n) => Math.min(n + 1, SHOTS.length - 1)),
			SHOT_MS
		);
		return () => clearTimeout(id);
	}, [visible, i, isLast]);

	const tap = useCallback(() => {
		Haptics.selectionAsync().catch(() => {});
		if (isLast) onClose();
		else setI((n) => n + 1);
	}, [isLast, onClose]);

	if (!visible) return null;

	return (
		<Animated.View
			entering={FadeIn.duration(280)}
			exiting={FadeOut.duration(200)}
			style={styles.reelRoot}
		>
			{/* Tap the scene to skip ahead (or close on the final shot). */}
			<Pressable style={StyleSheet.absoluteFill} onPress={tap}>
				<Animated.View
					key={S.key}
					entering={FadeIn.duration(560)}
					exiting={FadeOut.duration(300)}
					style={StyleSheet.absoluteFill}
				>
					<KenBurns move={S.move} duration={SHOT_MS + 900}>
						<Image source={S.img} resizeMode="cover" style={styles.reelImg} />
					</KenBurns>
				</Animated.View>

				{/* A soft ink veil keeps the warm palette cinematic and the
				    caption legible over bright frames. */}
				<View pointerEvents="none" style={styles.reelVeil} />

				<View pointerEvents="none" style={styles.reelCaptionWrap}>
					<Animated.View
						key={`rc-${S.key}`}
						entering={FadeIn.duration(440).delay(180)}
						style={styles.card}
					>
						<Text style={styles.line}>{S.line}</Text>
						{S.cta ? <Text style={styles.reelCta}>{S.cta}</Text> : null}
					</Animated.View>
					<View style={styles.dots}>
						{SHOTS.map((_, k) => (
							<View key={k} style={[styles.dot, k === i && styles.dotActive]} />
						))}
					</View>
				</View>
			</Pressable>

			{/* Close the reel and return to the beats. */}
			<Pressable onPress={onClose} style={styles.reelClose} hitSlop={12}>
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
	reelImg: { width: "100%", height: "100%" },
	// A light ink veil (the shared backdrop tint, softened) — keeps the warm
	// palette cinematic and the caption legible over bright frames.
	reelVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: MODAL_BACKDROP_BG, opacity: 0.5 },
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
