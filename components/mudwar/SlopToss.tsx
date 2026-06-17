// Slop Toss — the skill minigame inside a Mud Fight. Goblins from the Goblin
// King's horde run across a bog lane one after another; you HOLD the bucket to
// ready a throw and RELEASE the instant the goblin crosses the center STRIKE
// ZONE. Timing is the whole skill: dead-center gold = perfect, the green gate =
// good, the shoulders = weak, off-zone = the goblin escapes (whiff).
//
// FLESHED OUT: varied goblin ARCHETYPES (grunt / scout / brute / warboss — each
// its own size, sprite, and point value, re-rolled every crossing so it reads
// as a horde), a DIFFICULTY RAMP (the gold window tightens as your streak
// climbs — the "greed"), and a dressed BOG ARENA (parallax backdrop, reed
// curtains, a watching horde, ground ridge).
//
// ANTI-CHEAT UNCHANGED: the goblin's position at release is read ONLY on the
// client to pick the 4-value band enum; that enum is all that crosses the wire
// (onThrow). The server owns band->points (0/1/2/3) + the 7-throw / 21-mud caps.
// Skill decides the band; the server clamps the mud. The granular POINTS (power
// x accuracy x combo x archetype) are client-only vanity. Goblin art is
// PLACEHOLDER (reused mud sprites) until the horde art lands.
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { MudBand } from "@/utils/mudWars";
import { FONTS, STICKER_SHADOW, WHIMSY } from "@/constants/theme";

const MUD_BG = require("../../assets/images/backgrounds/mud_pit_bg.png");

// Tuning knobs. Strike zone as half-widths of the 0..1 lane from dead center.
const LAP_MS = 1600;
const GOLD_HALF = 0.05; // |x-0.5| <= this -> perfect (center 10% of lane)
const GREEN_HALF = 0.18; // -> good (center 36%)
const WEAK_HALF = 0.3; // -> weak (shoulders); beyond -> whiff
const STAGE_H = 380;

// Goblin archetypes — the horde. Each crossing re-rolls one (weighted). size is
// the sprite px; pts scales the vanity score; sprite is a PLACEHOLDER.
interface Archetype {
	key: string;
	name: string; // player-facing
	announce: string; // the "a goblin approaches" chip copy
	sprite: number;
	size: number;
	pts: number; // vanity-points multiplier
	weight: number;
}
const ARCHETYPES: Archetype[] = [
	{ key: "grunt", name: "Bog Grunt", announce: "A Bog Grunt charges!", sprite: HAT_IMAGES.mud_pie, size: 50, pts: 1.0, weight: 5 },
	{ key: "scout", name: "Mire Scout", announce: "A Mire Scout darts past!", sprite: HAT_IMAGES.mud_pie, size: 38, pts: 1.5, weight: 3 }, // small = hard, worth more
	{ key: "brute", name: "Slop Brute", announce: "A Slop Brute lumbers up!", sprite: HAT_IMAGES.mud_shovel, size: 76, pts: 0.7, weight: 3 }, // big = easy, worth less
	{ key: "warboss", name: "Warboss", announce: "The Goblin King sends a WARBOSS!", sprite: HAT_IMAGES.swamp_crown, size: 92, pts: 2.4, weight: 1 }, // rare, big payoff
];
const TOTAL_WEIGHT = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
function rollArchetype(): Archetype {
	let r = Math.random() * TOTAL_WEIGHT;
	for (const a of ARCHETYPES) {
		if ((r -= a.weight) <= 0) return a;
	}
	return ARCHETYPES[0];
}

function classify(x: number, goldHalf: number): MudBand {
	const d = Math.abs(x - 0.5);
	if (d <= goldHalf) return "perfect";
	if (d <= GREEN_HALF) return "good";
	if (d <= WEAK_HALF) return "weak";
	return "whiff";
}

const BAND_BASE: Record<MudBand, number> = { whiff: 0, weak: 120, good: 450, perfect: 1000 };
function scorePoints(band: MudBand, accuracy: number, streak: number, ptsMult: number): number {
	if (band === "whiff") return 0;
	const comboMult = 1 + Math.min(streak, 6) * 0.15;
	return Math.round(BAND_BASE[band] * (1 + accuracy * 0.5) * comboMult * ptsMult);
}

interface Props {
	onThrow: (band: MudBand) => void;
	throwsRemaining: number;
}
interface Floater {
	id: number;
	x: number;
	a: Animated.Value;
	band: MudBand;
	boss: boolean;
}
interface Splat {
	id: number;
	dx: number;
	a: Animated.Value;
}

export function SlopToss({ onThrow, throwsRemaining }: Props) {
	const empty = throwsRemaining <= 0;

	const [laneW, setLaneW] = useState(0);
	const runnerX = useRef(new Animated.Value(0)).current;
	const runnerXRef = useRef(0);
	const wrapRef = useRef(0); // prev value, to detect a lap wrap
	const ambient = useRef(new Animated.Value(0)).current;
	const bucketScale = useRef(new Animated.Value(1)).current;
	const gobHit = useRef(new Animated.Value(0)).current;
	const gobFlee = useRef(new Animated.Value(0)).current;
	const stagePunch = useRef(new Animated.Value(1)).current;

	const [goblin, setGoblin] = useState<Archetype>(() => rollArchetype());
	const goblinRef = useRef(goblin);
	const gobAnnounce = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		goblinRef.current = goblin;
		// Name the foe as it enters — a Warboss gets a louder beat (mini-event).
		gobAnnounce.setValue(0);
		if (goblin.key === "warboss") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
		}
		Animated.sequence([
			Animated.spring(gobAnnounce, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
			Animated.delay(goblin.key === "warboss" ? 1300 : 850),
			Animated.timing(gobAnnounce, { toValue: 0, duration: 300, useNativeDriver: true }),
		]).start();
	}, [goblin, gobAnnounce]);

	const [score, setScore] = useState(0);
	const streakRef = useRef(0);
	const [combo, setCombo] = useState(0);
	const comboAnim = useRef(new Animated.Value(0)).current;
	const [floaters, setFloaters] = useState<Floater[]>([]);
	const [splats, setSplats] = useState<Splat[]>([]);
	const idRef = useRef(0);

	// The crossing loop + a wrap detector that re-rolls the archetype each lap so
	// a fresh goblin runs every time. Stopped on unmount (ActiveWar unmounts this
	// on navigation away) to keep the phone light.
	useEffect(() => {
		runnerX.setValue(0);
		const run = Animated.loop(
			Animated.timing(runnerX, { toValue: 1, duration: LAP_MS, easing: Easing.linear, useNativeDriver: true })
		);
		run.start();
		const id = runnerX.addListener(({ value }) => {
			if (wrapRef.current > 0.7 && value < 0.3) setGoblin(rollArchetype()); // new lap, new goblin
			wrapRef.current = value;
			runnerXRef.current = value;
		});
		const amb = Animated.loop(
			Animated.timing(ambient, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
		);
		amb.start();
		return () => {
			runnerX.stopAnimation();
			runnerX.removeListener(id);
			ambient.stopAnimation();
		};
	}, [runnerX, ambient]);

	const fire = useCallback(
		(band: MudBand, accuracy: number, releaseX: number) => {
			const arche = goblinRef.current;
			const tier = band === "perfect" ? 2 : band === "good" ? 1 : 0;
			Haptics.impactAsync(
				band === "perfect"
					? Haptics.ImpactFeedbackStyle.Heavy
					: band === "good"
					? Haptics.ImpactFeedbackStyle.Medium
					: Haptics.ImpactFeedbackStyle.Light
			).catch(() => {});
			if (band === "whiff") {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
				streakRef.current = 0;
			} else {
				streakRef.current += 1;
			}

			const pts = scorePoints(band, accuracy, streakRef.current - 1, arche.pts);
			if (pts > 0) setScore((s) => s + pts);
			if (streakRef.current >= 2 && band !== "whiff") {
				setCombo(streakRef.current);
				comboAnim.setValue(0);
				Animated.spring(comboAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
			} else {
				setCombo(0);
			}

			Animated.sequence([
				Animated.spring(bucketScale, { toValue: 0.84, useNativeDriver: true, speed: 50, bounciness: 0 }),
				Animated.spring(bucketScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
			]).start();

			gobHit.setValue(0);
			Animated.sequence([
				Animated.timing(gobHit, { toValue: 1, duration: 120, useNativeDriver: true }),
				Animated.spring(gobHit, { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 6 }),
			]).start();
			if (band === "perfect" || band === "whiff") {
				gobFlee.setValue(0);
				Animated.timing(gobFlee, { toValue: band === "whiff" ? 1 : -1, duration: 260, useNativeDriver: true }).start(() =>
					gobFlee.setValue(0)
				);
			}

			if (band === "perfect") {
				Animated.sequence([
					Animated.spring(stagePunch, { toValue: 1.04, useNativeDriver: true, speed: 60, bounciness: 0 }),
					Animated.spring(stagePunch, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
				]).start();
				if (streakRef.current >= 3) {
					setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 90);
				}
			}

			if (band !== "whiff") {
				const goblinX = -arche.size + releaseX * (laneW + arche.size) + arche.size / 2;
				const targetDX = goblinX - laneW / 2;
				const count = [3, 5, 6][tier];
				const fresh: Splat[] = Array.from({ length: count }).map(() => ({
					id: idRef.current++,
					dx: targetDX + (Math.random() - 0.5) * 36,
					a: new Animated.Value(0),
				}));
				setSplats((s) => [...s, ...fresh]);
				fresh.forEach((sp) =>
					Animated.timing(sp.a, { toValue: 1, duration: 480, useNativeDriver: true }).start(() =>
						setSplats((s) => s.filter((x) => x.id !== sp.id))
					)
				);
			}

			const fid = idRef.current++;
			const fa = new Animated.Value(0);
			setFloaters((f) => [...f, { id: fid, x: (Math.random() - 0.5) * 30, a: fa, band, boss: arche.key === "warboss" }]);
			Animated.timing(fa, { toValue: 1, duration: 850, useNativeDriver: true }).start(() =>
				setFloaters((f) => f.filter((x) => x.id !== fid))
			);

			onThrow(band);
		},
		[ambient, bucketScale, comboAnim, gobHit, gobFlee, stagePunch, laneW, onThrow]
	);

	const onPressIn = useCallback(() => {
		if (empty) return;
		Animated.spring(bucketScale, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
	}, [empty, bucketScale]);

	const onPressOut = useCallback(() => {
		if (empty) return;
		const x = runnerXRef.current;
		// Difficulty ramp: the gold window tightens as the streak climbs.
		const goldHalf = GOLD_HALF * (1 - Math.min(streakRef.current, 5) * 0.06);
		const d = Math.abs(x - 0.5);
		const accuracy = Math.max(0, 1 - d / GREEN_HALF);
		fire(classify(x, goldHalf), accuracy, x);
	}, [empty, fire]);

	const runnerTX = runnerX.interpolate({ inputRange: [0, 1], outputRange: [-goblin.size, Math.max(0, laneW)] });
	const postGlow = runnerX.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
	const bgDrift = ambient.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
	const gateW = GREEN_HALF * 2 * laneW;
	const goldW = GOLD_HALF * 2 * laneW;

	return (
		<Animated.View style={[styles.stageWrap, { transform: [{ scale: stagePunch }] }]}>
			<View style={styles.stage} onLayout={(e) => setLaneW(e.nativeEvent.layout.width)}>
				<Animated.Image source={MUD_BG} resizeMode="cover" style={[styles.bg, { transform: [{ translateX: bgDrift }] }]} />
				<View style={styles.scrim} />

				{/* Watching horde (dim crowd hint) */}
				<View style={styles.crowd} pointerEvents="none">
					{[0, 1, 2, 3, 4, 5].map((i) => (
						<Image key={i} source={HAT_IMAGES.mud_pie} style={styles.crowdGoblin} resizeMode="contain" />
					))}
				</View>

				{/* Score chip + combo ribbon */}
				<View style={styles.scoreChip}>
					<Text style={styles.scoreText}>{score.toLocaleString()}</Text>
				</View>
				{combo >= 2 && (
					<Animated.View
						pointerEvents="none"
						style={[
							styles.comboRibbon,
							{ opacity: comboAnim, transform: [{ scale: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
						]}
					>
						<Text style={styles.comboText}>x{combo} HOT STREAK</Text>
					</Animated.View>
				)}

				{/* "A goblin approaches" chip — names the foe each crossing */}
				<Animated.View
					pointerEvents="none"
					style={[
						styles.announce,
						goblin.key === "warboss" && styles.announceBoss,
						{ opacity: gobAnnounce, transform: [{ translateY: gobAnnounce.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
					]}
				>
					<Text style={[styles.announceText, goblin.key === "warboss" && styles.announceBossText]}>{goblin.announce}</Text>
				</Animated.View>

				{/* Run lane: strike gate + gold post + the goblin */}
				<View style={styles.lane} pointerEvents="none">
					<View style={[styles.gate, { left: laneW / 2 - gateW / 2, width: gateW }]} />
					<Animated.View style={[styles.goldPost, { left: laneW / 2 - goldW / 2, width: Math.max(8, goldW), opacity: postGlow }]} />
					<Animated.Image
						source={goblin.sprite}
						resizeMode="contain"
						style={[
							styles.runner,
							{
								width: goblin.size,
								height: goblin.size,
								transform: [
									{ translateX: runnerTX },
									{ translateX: gobFlee.interpolate({ inputRange: [-1, 0, 1], outputRange: [-70, 0, 70] }) },
									{ rotate: gobHit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "26deg"] }) },
								],
							},
						]}
					/>
				</View>

				{/* Reed curtains (arena dressing) */}
				<View style={[styles.reed, styles.reedLeft]} pointerEvents="none" />
				<View style={[styles.reed, styles.reedRight]} pointerEvents="none" />

				{/* Ground + flung mud + floaters + the bucket */}
				<View style={styles.ground} pointerEvents="none" />
				{splats.map((sp) => (
					<Animated.Image
						key={sp.id}
						source={HAT_IMAGES.mud_splatter_aura}
						resizeMode="contain"
						style={[
							styles.splat,
							{
								transform: [
									{ translateX: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0, sp.dx] }) },
									{ translateY: sp.a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -190, -150] }) },
									{ scale: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] }) },
								],
								opacity: sp.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
							},
						]}
					/>
				))}
				{floaters.map((f) => (
					<Animated.Text
						key={f.id}
						style={[
							styles.floater,
							f.band === "perfect" && { color: WHIMSY.sun },
							f.band === "whiff" && { color: WHIMSY.muteSoft },
							{
								transform: [
									{ translateX: f.a.interpolate({ inputRange: [0, 1], outputRange: [f.x, f.band === "whiff" ? f.x + 50 : f.x] }) },
									{ translateY: f.a.interpolate({ inputRange: [0, 1], outputRange: [0, f.band === "whiff" ? -20 : -70] }) },
								],
								opacity: f.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
							},
						]}
					>
						{f.boss && f.band === "perfect"
							? "WARBOSS ROUTED!"
							: f.band === "perfect"
							? "SPLAT! routed"
							: f.band === "good"
							? "caught him"
							: f.band === "weak"
							? "glancing"
							: "he scampered off!"}
					</Animated.Text>
				))}

				<Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={empty} style={styles.bucketWrap}>
					<Animated.View style={[styles.bucket, empty && styles.bucketEmpty, { transform: [{ scale: bucketScale }] }]}>
						<Image source={HAT_IMAGES.slop_bucket} resizeMode="contain" style={[styles.bucketImg, empty && { opacity: 0.4 }]} />
					</Animated.View>
				</Pressable>

				<Text style={styles.label}>
					{empty
						? "Out of slings — the horde regroups till tomorrow"
						: `hold the bucket · let fly as he crosses · ${throwsRemaining} slings left`}
				</Text>
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	stageWrap: { marginTop: 14 },
	stage: {
		height: STAGE_H,
		width: "100%",
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
		backgroundColor: WHIMSY.cream2,
		...STICKER_SHADOW,
	},
	bg: { position: "absolute", top: 0, bottom: 0, left: "-5%", width: "110%" },
	scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(42,31,21,0.28)" },

	crowd: { position: "absolute", left: 0, right: 0, top: STAGE_H * 0.3, flexDirection: "row", justifyContent: "space-around", opacity: 0.28 },
	crowdGoblin: { width: 26, height: 26 },

	scoreChip: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(20,16,28,0.55)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
	scoreText: { fontFamily: FONTS.whimsy, fontSize: 20, color: "#fff" },
	comboRibbon: { position: "absolute", top: 10, alignSelf: "center", backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
	comboText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },

	announce: {
		position: "absolute",
		top: STAGE_H * 0.3,
		alignSelf: "center",
		backgroundColor: "rgba(20,16,28,0.6)",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	announceText: { fontFamily: FONTS.hand, fontSize: 14, color: "#fff" },
	announceBoss: { backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: WHIMSY.ink, paddingVertical: 6 },
	announceBossText: { fontFamily: FONTS.whimsy, fontSize: 16, color: WHIMSY.ink },

	lane: { position: "absolute", left: 0, right: 0, top: STAGE_H * 0.42, height: 96 },
	gate: { position: "absolute", top: 0, bottom: 0, backgroundColor: "rgba(91,201,125,0.32)", borderRadius: 6 },
	goldPost: { position: "absolute", top: -6, bottom: -6, backgroundColor: "rgba(245,196,74,0.85)", borderRadius: 6 },
	runner: { position: "absolute", bottom: 4 },

	reed: { position: "absolute", bottom: 80, width: 20, height: 150, backgroundColor: "rgba(58,92,46,0.55)", borderRadius: 10 },
	reedLeft: { left: -6, transform: [{ rotate: "8deg" }] },
	reedRight: { right: -6, transform: [{ rotate: "-8deg" }] },

	ground: { position: "absolute", left: 0, right: 0, bottom: 0, height: 92, backgroundColor: "#4a301a", borderTopWidth: 2, borderTopColor: "#6b4a2a" },
	splat: { position: "absolute", bottom: 70, alignSelf: "center", width: 34, height: 34 },
	floater: { position: "absolute", bottom: 150, alignSelf: "center", fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.accent },

	bucketWrap: { position: "absolute", bottom: 8, alignSelf: "center" },
	bucket: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.sun, alignItems: "center", justifyContent: "center" },
	bucketEmpty: { backgroundColor: WHIMSY.cream2 },
	bucketImg: { width: 54, height: 54 },

	label: { position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", paddingVertical: 4, fontFamily: FONTS.hand, fontSize: 13, color: "#fff" },
});
