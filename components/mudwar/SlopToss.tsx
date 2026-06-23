// Slop Toss — the skill minigame inside a Mud Fight. Goblins from the Goblin
// King's horde run across a bog lane one after another; you HOLD the bucket to
// ready a throw (it cocks back, charging) and RELEASE the instant the goblin
// crosses the center STRIKE ZONE. Timing is the whole skill: dead-center gold =
// perfect, the green gate = good, the shoulders = weak, off-zone = the goblin
// escapes (whiff).
//
// FLESHED OUT: varied goblin ARCHETYPES (grunt / scout / brute / warboss) each
// with its own size, run sprite + hit/recoil sprite, point value, AND GAIT — a
// per-archetype lap speed + bob so the scout darts, the brute lumbers, the
// warboss struts. On a connect the arena does a hit-stop (brief freeze), a
// tier-scaled screen-shake, a band-scaled knockback, and the hit pose crossfades
// in; a perfect adds a gold burst ring. The bog is alive: parallax backdrop,
// swaying reeds, a reacting watching horde, a warboss danger vignette. The lane
// backdrop tracks the siege day. The run loop is gated on focus (battery).
//
// ANTI-CHEAT UNCHANGED: the goblin's position at release is read ONLY on the
// client (runnerXRef) to pick the 4-value band enum; that enum is all that
// crosses the wire (onThrow). The server owns band->points (0/1/2/3) + the
// 7-throw / 21-mud caps. Every animation value here (charge, hit-stop, shake,
// bob, recoil) is PURELY cosmetic — none feeds runnerXRef or classify().
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { MudBand } from "@/utils/mudWars";
import { FONTS, STICKER_SHADOW, WHIMSY } from "@/constants/theme";

// Lane backdrop per siege day (1..WAR_LENGTH_DAYS=5; day 5 = the festival
// finale). Module-level require()s — never require() in render; indexed by a
// clamped day. (golden_mire_bg stays an equippable cosmetic, not a lane backdrop.)
const BG_BY_DAY = [
	HAT_IMAGES.mud_pit_bg, // day 1
	HAT_IMAGES.reed_marsh_bg, // day 2
	HAT_IMAGES.mud_derby_bg, // day 3
	HAT_IMAGES.bog_dusk_bg, // day 4
	HAT_IMAGES.festival_night_bg, // day 5 — the festival finale
];

// Tuning knobs. Strike zone as half-widths of the 0..1 lane from dead center.
const GOLD_HALF = 0.05; // |x-0.5| <= this -> perfect (center 10% of lane)
const GREEN_HALF = 0.18; // -> good (center 36%)
const WEAK_HALF = 0.3; // -> weak (shoulders); beyond -> whiff
const STAGE_H = 380;

// Goblin archetypes — the horde. Each crossing re-rolls one (weighted). `size`
// is the sprite px; `pts` scales the vanity score; `lapMs` is the crossing time
// (faster = harder to time = scout); `bobMs`/`bobAmp` are the run-cycle gait.
interface Archetype {
	key: string;
	name: string; // player-facing
	announce: string; // the "a goblin approaches" chip copy
	sprite: number; // run pose
	hitSprite: number; // recoil pose, crossfaded in on a connect
	size: number;
	pts: number; // vanity-points multiplier
	weight: number;
	lapMs: number; // crossing duration (gait speed)
	bobMs: number; // half-period of the run bob
	bobAmp: number; // run bob height (px)
}
const ARCHETYPES: Archetype[] = [
	{ key: "grunt", name: "Bog Grunt", announce: "A Bog Grunt charges!", sprite: HAT_IMAGES.goblin_grunt, hitSprite: HAT_IMAGES.goblin_grunt_hit, size: 60, pts: 1.0, weight: 5, lapMs: 1600, bobMs: 230, bobAmp: 7 },
	{ key: "scout", name: "Mire Scout", announce: "A Mire Scout darts past!", sprite: HAT_IMAGES.goblin_scout, hitSprite: HAT_IMAGES.goblin_scout_hit, size: 48, pts: 1.5, weight: 3, lapMs: 1150, bobMs: 150, bobAmp: 5 }, // small + fast = hard, worth more
	{ key: "brute", name: "Slop Brute", announce: "A Slop Brute lumbers up!", sprite: HAT_IMAGES.goblin_brute, hitSprite: HAT_IMAGES.goblin_brute_hit, size: 92, pts: 0.7, weight: 3, lapMs: 2200, bobMs: 330, bobAmp: 10 }, // big + slow = easy, worth less
	{ key: "warboss", name: "Warboss", announce: "The Goblin King sends a WARBOSS!", sprite: HAT_IMAGES.goblin_warboss, hitSprite: HAT_IMAGES.goblin_warboss_hit, size: 104, pts: 2.4, weight: 1, lapMs: 2400, bobMs: 300, bobAmp: 9 }, // rare, big payoff, a slow swagger
];
// The dim watching horde behind the lane — a few archetypes for silhouette variety.
const CROWD = [
	HAT_IMAGES.goblin_grunt,
	HAT_IMAGES.goblin_brute,
	HAT_IMAGES.goblin_grunt,
	HAT_IMAGES.goblin_scout,
	HAT_IMAGES.goblin_brute,
	HAT_IMAGES.goblin_grunt,
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
	day?: number; // siege day -> lane backdrop
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
	rot: string;
	dur: number;
	a: Animated.Value;
	gold: boolean; // warboss hits fling gold-flecked treasure-mud
}
interface Ring {
	id: number;
	a: Animated.Value;
	gold: boolean;
}

export function SlopToss({ onThrow, throwsRemaining, day = 1 }: Props) {
	// In dev, keep the bucket LIVE even after today's throw budget is spent so the
	// minigame stays testable without waiting for the UTC day to reset. The server
	// still enforces the real 7/day cap on what actually banks (throwBand no-ops
	// past it) — this only keeps the bucket pressable for feel-testing. Prod: spent = empty.
	const outOfThrows = throwsRemaining <= 0;
	const empty = outOfThrows && !__DEV__;
	const bgSource = BG_BY_DAY[Math.min(Math.max(day - 1, 0), BG_BY_DAY.length - 1)];

	const [laneW, setLaneW] = useState(0);
	const runnerX = useRef(new Animated.Value(0)).current;
	const runnerXRef = useRef(0); // release snapshot — the ONLY thing classify() reads
	const ambient = useRef(new Animated.Value(0)).current;
	const bucketScale = useRef(new Animated.Value(1)).current;
	const charge = useRef(new Animated.Value(0)).current; // hold wind-up
	const recoil = useRef(new Animated.Value(0)).current; // band-scaled hit reaction (tilt + hop)
	const gobFlee = useRef(new Animated.Value(0)).current; // perfect: knocked back; whiff: escapes forward
	const bob = useRef(new Animated.Value(0)).current; // run-cycle
	const stagePunch = useRef(new Animated.Value(1)).current;
	const shake = useRef(new Animated.Value(0)).current; // impact screen-shake
	const bossMode = useRef(new Animated.Value(0)).current; // warboss danger vignette
	const hitFade = useRef(new Animated.Value(0)).current; // 0 = run sprite, 1 = hit sprite (crossfade)
	const crowdReact = useRef(new Animated.Value(0)).current;

	// Lifecycle refs.
	const focusedRef = useRef(false);
	const lapRef = useRef<Animated.CompositeAnimation | null>(null);
	const bobLoopRef = useRef<Animated.CompositeAnimation | null>(null);
	const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hitCountRef = useRef(0); // latch: only crossfade back to run when no hit is in flight
	const hitTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

	const [goblin, setGoblin] = useState<Archetype>(() => rollArchetype());
	const goblinRef = useRef(goblin);
	const gobAnnounce = useRef(new Animated.Value(0)).current;

	const [score, setScore] = useState(0);
	const streakRef = useRef(0);
	const [combo, setCombo] = useState(0);
	const comboAnim = useRef(new Animated.Value(0)).current;
	const [floaters, setFloaters] = useState<Floater[]>([]);
	const [splats, setSplats] = useState<Splat[]>([]);
	const [rings, setRings] = useState<Ring[]>([]);
	const idRef = useRef(0);

	// The run-cycle bob loop, restarted per archetype so each goblin's gait is its
	// own. Native-driven, no listener/setState — cheap.
	const startBob = useCallback(
		(ms: number) => {
			bobLoopRef.current?.stop();
			bob.setValue(0);
			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(bob, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
					Animated.timing(bob, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
				])
			);
			bobLoopRef.current = loop;
			loop.start();
		},
		[bob]
	);

	// One lap of the crossing, then re-roll a fresh goblin and recurse. Driven as a
	// self-restarting chain (not Animated.loop) so a hit-stop can pause it and
	// resume from the captured position. `from` > 0 means a hit-stop resume.
	const animateLap = useCallback(
		(from: number) => {
			if (!focusedRef.current) return;
			runnerX.setValue(from);
			const g = goblinRef.current;
			const a = Animated.timing(runnerX, {
				toValue: 1,
				duration: Math.max(60, g.lapMs * (1 - from)),
				easing: Easing.linear,
				useNativeDriver: true,
			});
			lapRef.current = a;
			a.start(({ finished }) => {
				// finished:false means stopped (hit-stop freeze or blur) — don't recurse.
				if (!finished || !focusedRef.current) return;
				// Reset the hit-pose crossfade so a fresh goblin never inherits an
				// in-flight recoil (a late weak hit's 420ms latch can outlive the lap).
				hitTimersRef.current.forEach(clearTimeout);
				hitTimersRef.current.clear();
				hitCountRef.current = 0;
				hitFade.setValue(0);
				const next = rollArchetype();
				goblinRef.current = next; // keep the ref in sync immediately for the next lap's cadence
				setGoblin(next);
				animateLap(0);
			});
		},
		[runnerX, hitFade]
	);

	// Hit-stop: pause the lap on a connect, hold the recoil frame, then resume.
	const freeze = useCallback(
		(ms: number) => {
			runnerX.stopAnimation((v) => {
				if (freezeTimer.current) clearTimeout(freezeTimer.current);
				freezeTimer.current = setTimeout(() => {
					if (focusedRef.current) animateLap(v);
				}, ms);
			});
		},
		[animateLap, runnerX]
	);

	// Announce + boss vignette + gait, each time the foe changes.
	useEffect(() => {
		goblinRef.current = goblin;
		startBob(goblin.bobMs);
		gobAnnounce.setValue(0);
		if (goblin.key === "warboss") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
			Animated.spring(bossMode, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }).start();
		} else {
			Animated.timing(bossMode, { toValue: 0, duration: 400, useNativeDriver: true }).start();
		}
		Animated.sequence([
			Animated.spring(gobAnnounce, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
			Animated.delay(goblin.key === "warboss" ? 1300 : 850),
			Animated.timing(gobAnnounce, { toValue: 0, duration: 300, useNativeDriver: true }),
		]).start();
	}, [goblin, gobAnnounce, bossMode, startBob]);

	const fire = useCallback(
		(band: MudBand, accuracy: number, releaseX: number) => {
			const arche = goblinRef.current;
			const tier = band === "perfect" ? 2 : band === "good" ? 1 : 0;
			const hit = band !== "whiff";
			Haptics.impactAsync(
				band === "perfect"
					? Haptics.ImpactFeedbackStyle.Heavy
					: band === "good"
					? Haptics.ImpactFeedbackStyle.Medium
					: Haptics.ImpactFeedbackStyle.Light
			).catch(() => {});
			if (!hit) {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
				streakRef.current = 0;
			} else {
				streakRef.current += 1;
			}

			const pts = scorePoints(band, accuracy, streakRef.current - 1, arche.pts);
			if (pts > 0) setScore((s) => s + pts);
			if (streakRef.current >= 2 && hit) {
				setCombo(streakRef.current);
				comboAnim.setValue(0);
				Animated.spring(comboAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
			} else {
				setCombo(0);
			}

			// Bucket recoil squish + whip the charge wind-up forward.
			Animated.spring(charge, { toValue: 0, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
			Animated.sequence([
				Animated.spring(bucketScale, { toValue: 0.84, useNativeDriver: true, speed: 50, bounciness: 0 }),
				Animated.spring(bucketScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
			]).start();

			// Crossfade to the recoil pose on a connect, latched so overlapping hits
			// within the window never flip back to the run frame mid-flight.
			if (hit) {
				hitCountRef.current += 1;
				Animated.timing(hitFade, { toValue: 1, duration: 60, useNativeDriver: true }).start();
				const t = setTimeout(() => {
					hitTimersRef.current.delete(t);
					hitCountRef.current = Math.max(0, hitCountRef.current - 1);
					if (hitCountRef.current === 0) {
						Animated.timing(hitFade, { toValue: 0, duration: 140, useNativeDriver: true }).start();
					}
				}, 420);
				hitTimersRef.current.add(t);

				// Band-scaled knockback: a perfect punts the imp (full tilt + hop), a
				// weak just rocks it. recoil drives both the rotate and the hop.
				const peak = band === "perfect" ? 1 : band === "good" ? 0.75 : 0.5;
				recoil.setValue(0);
				Animated.sequence([
					Animated.timing(recoil, { toValue: peak, duration: 120, useNativeDriver: true }),
					Animated.spring(recoil, { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 6 }),
				]).start();

				// Tier-scaled screen-shake (decaying oscillation), warboss-perfect heavier.
				const mag = (tier === 2 ? 1 : tier === 1 ? 0.5 : 0.25) * (arche.key === "warboss" && band === "perfect" ? 1.4 : 1);
				shake.setValue(0);
				Animated.sequence(
					[1, -1, 0.6, -0.4, 0].map((m) =>
						Animated.timing(shake, { toValue: m * mag, duration: 45, useNativeDriver: true })
					)
				).start();

				// Hit-stop: freeze the lap on the recoil frame, then resume.
				if (band === "good") freeze(70);
				else if (band === "perfect") freeze(120);
			}

			// A perfect/whiff also slides the goblin (knocked back vs. escaping).
			if (band === "perfect" || band === "whiff") {
				gobFlee.setValue(0);
				Animated.timing(gobFlee, { toValue: band === "whiff" ? 1 : -1, duration: 300, useNativeDriver: true }).start(() =>
					gobFlee.setValue(0)
				);
			}

			if (band === "perfect") {
				Animated.sequence([
					Animated.spring(stagePunch, { toValue: 1.05, useNativeDriver: true, speed: 60, bounciness: 0 }),
					Animated.spring(stagePunch, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
				]).start();
				if (streakRef.current >= 3) {
					const ht = setTimeout(() => {
						hitTimersRef.current.delete(ht);
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
					}, 90);
					hitTimersRef.current.add(ht);
				}
				// Gold burst ring.
				const rid = idRef.current++;
				const ra = new Animated.Value(0);
				setRings((r) => [...r, { id: rid, a: ra, gold: arche.key === "warboss" }]);
				Animated.timing(ra, { toValue: 1, duration: 440, useNativeDriver: true }).start(() =>
					setRings((r) => r.filter((x) => x.id !== rid))
				);
			}

			// Crowd reacts: surge in on a hit, gloat-bob on a whiff.
			crowdReact.setValue(0);
			if (hit) {
				Animated.sequence([
					Animated.spring(crowdReact, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }),
					Animated.spring(crowdReact, { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 6 }),
				]).start();
			} else {
				Animated.sequence([
					Animated.timing(crowdReact, { toValue: -1, duration: 160, useNativeDriver: true }),
					Animated.timing(crowdReact, { toValue: 0, duration: 220, useNativeDriver: true }),
				]).start();
			}

			// Flung mud: flies from the bucket toward the goblin and SPLATS (squash on
			// landing). Warboss hits fling more, gold-flecked.
			if (hit) {
				const goblinX = -arche.size + releaseX * (laneW + arche.size) + arche.size / 2;
				const targetDX = goblinX - laneW / 2;
				const gold = arche.key === "warboss";
				const count = [3, 5, 6][tier] + (gold ? 3 : 0);
				const dur = tier === 2 ? 380 : 480;
				const fresh: Splat[] = Array.from({ length: count }).map(() => ({
					id: idRef.current++,
					dx: targetDX + (Math.random() - 0.5) * 44,
					rot: `${Math.round((Math.random() - 0.5) * 80)}deg`,
					dur,
					a: new Animated.Value(0),
					gold,
				}));
				setSplats((s) => [...s, ...fresh]);
				fresh.forEach((sp) =>
					Animated.timing(sp.a, { toValue: 1, duration: sp.dur, useNativeDriver: true }).start(() =>
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
		[bucketScale, charge, comboAnim, crowdReact, freeze, gobFlee, hitFade, recoil, shake, stagePunch, laneW, onThrow]
	);

	const onPressIn = useCallback(() => {
		if (empty) return;
		Animated.spring(bucketScale, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
		charge.setValue(0);
		Animated.timing(charge, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
	}, [empty, bucketScale, charge]);

	const onPressOut = useCallback(() => {
		if (empty) return;
		const x = runnerXRef.current; // the release snapshot — anti-cheat source of truth
		// Difficulty ramp: the gold window tightens as the streak climbs.
		const goldHalf = GOLD_HALF * (1 - Math.min(streakRef.current, 5) * 0.06);
		const d = Math.abs(x - 0.5);
		const accuracy = Math.max(0, 1 - d / GREEN_HALF);
		fire(classify(x, goldHalf), accuracy, x);
	}, [empty, fire]);

	// Loop lifecycle gated on FOCUS, not just mount — so the run loop, ambient
	// loop, per-frame listener and bob stop when the screen is backgrounded.
	useFocusEffect(
		useCallback(() => {
			focusedRef.current = true;
			runnerX.setValue(0);
			animateLap(0);
			ambient.setValue(0);
			const amb = Animated.loop(
				Animated.timing(ambient, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
			);
			amb.start();
			const id = runnerX.addListener(({ value }) => {
				runnerXRef.current = value;
			});
			startBob(goblinRef.current.bobMs);
			return () => {
				focusedRef.current = false;
				runnerX.stopAnimation();
				runnerX.removeListener(id);
				amb.stop();
				bobLoopRef.current?.stop();
				if (freezeTimer.current) clearTimeout(freezeTimer.current);
				hitTimersRef.current.forEach(clearTimeout);
				hitTimersRef.current.clear();
			};
		}, [animateLap, startBob, runnerX, ambient])
	);

	// Memoized interpolations (size/lane-dependent ones rebuild only when those change).
	const runnerTX = useMemo(
		() => runnerX.interpolate({ inputRange: [0, 1], outputRange: [-goblin.size, Math.max(0, laneW)] }),
		[runnerX, goblin.size, laneW]
	);
	const bobTY = useMemo(() => bob.interpolate({ inputRange: [0, 1], outputRange: [0, -goblin.bobAmp] }), [bob, goblin.bobAmp]);
	const fleeTX = useMemo(() => gobFlee.interpolate({ inputRange: [-1, 0, 1], outputRange: [-150, 0, 150] }), [gobFlee]);
	const hopTY = useMemo(() => recoil.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }), [recoil]);
	const recoilRot = useMemo(() => recoil.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "42deg"] }), [recoil]);
	const bobWobble = useMemo(() => bob.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] }), [bob]);
	const runOpacity = useMemo(() => hitFade.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), [hitFade]);

	const bgDrift = useMemo(() => ambient.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }), [ambient]);
	const crowdTY = useMemo(() => ambient.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }), [ambient]);
	const crowdParallax = useMemo(() => ambient.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }), [ambient]);
	const crowdReactTY = useMemo(() => crowdReact.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, 3] }), [crowdReact]);
	const crowdReactScale = useMemo(() => crowdReact.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.04, 1, 1.12] }), [crowdReact]);
	const reedLeftRot = useMemo(() => ambient.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["8deg", "12deg", "8deg"] }), [ambient]);
	const reedRightRot = useMemo(() => ambient.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-8deg", "-12deg", "-8deg"] }), [ambient]);
	const bucketIdleTY = useMemo(() => ambient.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -4, 0] }), [ambient]);
	const chargeRot = useMemo(() => charge.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-14deg"] }), [charge]);
	const chargeRingScale = useMemo(() => charge.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1] }), [charge]);
	const chargeRingOpacity = useMemo(() => charge.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }), [charge]);
	const shakeTX = useMemo(() => shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }), [shake]);
	const shakeRot = useMemo(() => shake.interpolate({ inputRange: [-1, 1], outputRange: ["-0.6deg", "0.6deg"] }), [shake]);
	const bossVignette = useMemo(() => bossMode.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }), [bossMode]);
	// Gold-post telegraph: brightens + grows as the goblin nears dead-center; a
	// white blink fires right at the strike. Derived from runnerX — zero loop cost.
	const proximity = useMemo(() => runnerX.interpolate({ inputRange: [0.34, 0.5, 0.66], outputRange: [0, 1, 0], extrapolate: "clamp" }), [runnerX]);
	const goldOpacity = useMemo(() => proximity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), [proximity]);
	const goldScaleY = useMemo(() => proximity.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }), [proximity]);
	const goldBlink = useMemo(() => runnerX.interpolate({ inputRange: [0.45, 0.5, 0.55], outputRange: [0, 0.85, 0], extrapolate: "clamp" }), [runnerX]);

	const gateW = GREEN_HALF * 2 * laneW;
	const goldW = GOLD_HALF * 2 * laneW;

	return (
		<Animated.View style={[styles.stageWrap, { transform: [{ scale: stagePunch }, { translateX: shakeTX }, { rotate: shakeRot }] }]}>
			<View style={styles.stage} onLayout={(e) => setLaneW(e.nativeEvent.layout.width)}>
				<Animated.Image source={bgSource} resizeMode="cover" style={[styles.bg, { transform: [{ translateX: bgDrift }] }]} />
				<View style={styles.scrim} />
				{/* Warboss danger vignette */}
				<Animated.View pointerEvents="none" style={[styles.bossVignette, { opacity: bossVignette }]} />

				{/* Watching horde — parallax drift + breathing bob + reaction */}
				<Animated.View
					style={[styles.crowd, { transform: [{ translateX: crowdParallax }, { translateY: crowdTY }, { translateY: crowdReactTY }, { scale: crowdReactScale }] }]}
					pointerEvents="none"
				>
					{CROWD.map((src, i) => (
						<Image key={i} source={src} style={styles.crowdGoblin} resizeMode="contain" />
					))}
				</Animated.View>

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

				{/* Run lane: strike gate + gold post (telegraph) + the goblin + burst rings */}
				<View style={styles.lane} pointerEvents="none">
					<View style={[styles.gate, { left: laneW / 2 - gateW / 2, width: gateW }]} />
					<Animated.View style={[styles.goldPost, { left: laneW / 2 - goldW / 2, width: Math.max(8, goldW), opacity: goldOpacity, transform: [{ scaleY: goldScaleY }] }]} />
					<Animated.View style={[styles.goldBlink, { left: laneW / 2 - goldW / 2, width: Math.max(8, goldW), opacity: goldBlink }]} />

					<Animated.View
						style={[
							styles.runner,
							{
								width: goblin.size,
								height: goblin.size,
								transform: [
									{ translateX: runnerTX },
									{ translateX: fleeTX },
									{ translateY: bobTY },
									{ translateY: hopTY },
									{ rotate: recoilRot },
									{ rotate: bobWobble },
								],
							},
						]}
					>
						<Animated.Image source={goblin.sprite} resizeMode="contain" style={[styles.runnerImg, { opacity: runOpacity }]} />
						<Animated.Image source={goblin.hitSprite} resizeMode="contain" style={[styles.runnerImg, { opacity: hitFade }]} />
					</Animated.View>

					{rings.map((r) => (
						<Animated.View
							key={r.id}
							style={[
								styles.ring,
								r.gold && styles.ringGold,
								{
									left: laneW / 2 - 30,
									opacity: r.a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.5, 0] }),
									transform: [{ scale: r.a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.2] }) }],
								},
							]}
						/>
					))}
				</View>

				{/* Reed curtains (swaying arena dressing) */}
				<Animated.View style={[styles.reed, styles.reedLeft, { transform: [{ rotate: reedLeftRot }] }]} pointerEvents="none" />
				<Animated.View style={[styles.reed, styles.reedRight, { transform: [{ rotate: reedRightRot }] }]} pointerEvents="none" />

				{/* Ground + flung mud + floaters + the bucket */}
				<View style={styles.ground} pointerEvents="none" />
				{splats.map((sp) => (
					<Animated.Image
						key={sp.id}
						source={sp.gold ? HAT_IMAGES.mud_splat_gold : HAT_IMAGES.mud_splat}
						resizeMode="contain"
						style={[
							styles.splat,
							{
								transform: [
									{ translateX: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0, sp.dx] }) },
									{ translateY: sp.a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -190, -150] }) },
									{ rotate: sp.rot },
									{ scaleX: sp.a.interpolate({ inputRange: [0, 0.4, 0.55, 1], outputRange: [0.4, 1.0, 1.4, 1.2] }) },
									{ scaleY: sp.a.interpolate({ inputRange: [0, 0.4, 0.55, 1], outputRange: [0.4, 1.0, 0.6, 0.8] }) },
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
							f.band === "perfect" && styles.floaterPerfect,
							f.band === "whiff" && { color: WHIMSY.muteSoft },
							{
								transform: [
									{ translateX: f.a.interpolate({ inputRange: [0, 1], outputRange: [f.x, f.band === "whiff" ? f.x + 50 : f.x] }) },
									{ translateY: f.a.interpolate({ inputRange: [0, 1], outputRange: [0, f.band === "whiff" ? -20 : -70] }) },
									{ scale: f.band === "perfect" ? f.a.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.25, 1] }) : 1 },
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
					{!empty && (
						<Animated.View pointerEvents="none" style={[styles.chargeRing, { opacity: chargeRingOpacity, transform: [{ scale: chargeRingScale }] }]} />
					)}
					<Animated.View
						style={[
							styles.bucket,
							empty && styles.bucketEmpty,
							{ transform: [{ scale: bucketScale }, { rotate: chargeRot }, ...(empty ? [] : [{ translateY: bucketIdleTY }])] },
						]}
					>
						<Image source={HAT_IMAGES.slop_bucket} resizeMode="contain" style={[styles.bucketImg, empty && { opacity: 0.4 }]} />
					</Animated.View>
				</Pressable>

				<Text style={styles.label}>
					{empty
						? "Out of slings — the horde regroups till tomorrow"
						: outOfThrows
						? "dev · throws spent — bucket kept live to test"
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
	bossVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(120,20,20,1)" },

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
	goldBlink: { position: "absolute", top: -6, bottom: -6, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 6 },
	runner: { position: "absolute", bottom: 4 },
	runnerImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
	ring: { position: "absolute", top: 8, width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: "rgba(245,196,74,0.9)" },
	ringGold: { borderColor: "rgba(255,225,120,1)", borderWidth: 4 },

	reed: { position: "absolute", bottom: 80, width: 20, height: 150, backgroundColor: "rgba(58,92,46,0.55)", borderRadius: 10 },
	reedLeft: { left: -6 },
	reedRight: { right: -6 },

	ground: { position: "absolute", left: 0, right: 0, bottom: 0, height: 92, backgroundColor: "#4a301a", borderTopWidth: 2, borderTopColor: "#6b4a2a" },
	splat: { position: "absolute", bottom: 70, alignSelf: "center", width: 44, height: 44 },
	floater: { position: "absolute", bottom: 150, alignSelf: "center", fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.accent },
	floaterPerfect: { color: WHIMSY.sun, fontSize: 24 },

	bucketWrap: { position: "absolute", bottom: 8, alignSelf: "center", alignItems: "center", justifyContent: "center" },
	chargeRing: { position: "absolute", width: 132, height: 132, borderRadius: 66, borderWidth: 3, borderColor: WHIMSY.sun },
	bucket: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.sun, alignItems: "center", justifyContent: "center" },
	bucketEmpty: { backgroundColor: WHIMSY.cream2 },
	bucketImg: { width: 54, height: 54 },

	label: { position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", paddingVertical: 4, fontFamily: FONTS.hand, fontSize: 13, color: "#fff" },
});
