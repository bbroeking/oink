// Songs of the Bog — the HOLD-phase rhythm defense (Phase 1d). A sibling to
// SlopToss (which TEND still uses); this is the short skill run defenders play
// during Hold. A conveyor of goblins from the Goblin King's horde streams toward
// a FIXED strike line at the bog's center; you TAP the bucket the instant each
// SCORED goblin crosses it. Land NOTES_PER_RUN scored notes (~RUN_LENGTH_MS) and
// the run banks its summed normalized mud into your area.
//
// REUSES SLOP TOSS'S JUICE WHOLESALE: the same goblin archetypes/sprites,
// hit-stop, tier-scaled screenshake, band-scaled recoil/knockback, flung splats,
// floaters, gold-burst ring, haptics, the focus-gated loop lifecycle, and the
// gold-post strike telegraph. The ONE mechanic change vs the toss: the timing
// classifier is TEMPORAL, not spatial — |dt| (ms from the note's ideal crossing
// time) -> perfect/good/weak/whiff — because a Hold run is a beat you tap on, not
// a hold/release.
//
// DIFFICULTY = the DEFENDED AREA'S PUBLIC p_band (light/medium/heavy -> easy/med/
// hard, decision B). It drives tempo/density/window FEEL only; the opponent's
// DEPLOYED difficulty is a hidden pressure shown only in the post-day recap.
//
// ANTI-CHEAT UNCHANGED FROM THE TOSS: the goblin's position at the tap is read
// ONLY on the client (runnerXRef) to derive |dt| and pick the 4-value band enum.
// The band ARRAY (one per scored note) is all that crosses the wire (onRunComplete);
// the server owns band->mud (0/1/2/3) + the per-day RUN cap. Every animation value
// here is PURELY cosmetic — none feeds the band classification.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { MudBand } from "@/utils/mudWars";
import {
	NOTES_PER_RUN,
	PERFECT_WINDOW_MS,
	GOOD_WINDOW_MS,
	WEAK_WINDOW_MS,
	type Difficulty,
} from "@/constants/mudFights";
import { FONTS, STICKER_SHADOW, WHIMSY } from "@/constants/theme";

const STAGE_H = 380;

// Per-difficulty FEEL of the song. The defended area's p_band picks one (decision
// B). Tempo (lapMs) + density (extra unscored pass-through goblins between scored
// notes) + window tightness are all COSMETIC — only the |dt| classification leaves.
// The window multiplier tightens harder songs, matching the server's secondary
// DIFF_MULT lever (1.30/1.0/0.82) so a weak defender leaks more on a heavy area.
interface SongFeel {
	lapMs: number;       // crossing duration of a goblin (faster = harder to time)
	windowMult: number;  // multiplies the base ms windows (smaller = tighter)
	announce: string;    // the song-start chip
}
const SONG: Record<Difficulty, SongFeel> = {
	easy: { lapMs: 2000, windowMult: 1.3, announce: "A light song — the bog hums" },
	med: { lapMs: 1550, windowMult: 1.0, announce: "A steady song — hold the line" },
	hard: { lapMs: 1150, windowMult: 0.82, announce: "A heavy song — the horde pours in" },
};

// Goblin archetypes — the horde (mirrors SlopToss). Each scored crossing re-rolls
// one (weighted). `size`/`pts` are cosmetic; `bobMs`/`bobAmp` are the run-cycle gait.
interface Archetype {
	key: string;
	name: string;
	sprite: number;
	hitSprite: number;
	size: number;
	pts: number;
	weight: number;
	bobMs: number;
	bobAmp: number;
}
const ARCHETYPES: Archetype[] = [
	{ key: "grunt", name: "Bog Grunt", sprite: HAT_IMAGES.goblin_grunt, hitSprite: HAT_IMAGES.goblin_grunt_hit, size: 60, pts: 1.0, weight: 5, bobMs: 230, bobAmp: 7 },
	{ key: "scout", name: "Mire Scout", sprite: HAT_IMAGES.goblin_scout, hitSprite: HAT_IMAGES.goblin_scout_hit, size: 48, pts: 1.5, weight: 3, bobMs: 150, bobAmp: 5 },
	{ key: "brute", name: "Slop Brute", sprite: HAT_IMAGES.goblin_brute, hitSprite: HAT_IMAGES.goblin_brute_hit, size: 92, pts: 0.7, weight: 3, bobMs: 330, bobAmp: 10 },
	{ key: "warboss", name: "Warboss", sprite: HAT_IMAGES.goblin_warboss, hitSprite: HAT_IMAGES.goblin_warboss_hit, size: 104, pts: 2.4, weight: 1, bobMs: 300, bobAmp: 9 },
];
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

// TEMPORAL classifier — the one mechanic that differs from the spatial toss.
// |dt| is ms from the goblin's ideal crossing time at the strike line. The
// windows scale with the song's tightness (harder = smaller).
function classifyDt(absDt: number, windowMult: number): MudBand {
	if (absDt <= PERFECT_WINDOW_MS * windowMult) return "perfect";
	if (absDt <= GOOD_WINDOW_MS * windowMult) return "good";
	if (absDt <= WEAK_WINDOW_MS * windowMult) return "weak";
	return "whiff"; // a leak — he slipped past
}

const BAND_BASE: Record<MudBand, number> = { whiff: 0, weak: 120, good: 450, perfect: 1000 };
function scorePoints(band: MudBand, accuracy: number, streak: number, ptsMult: number): number {
	if (band === "whiff") return 0;
	const comboMult = 1 + Math.min(streak, 6) * 0.15;
	return Math.round(BAND_BASE[band] * (1 + accuracy * 0.5) * comboMult * ptsMult);
}

interface Props {
	onRunComplete: (bands: MudBand[]) => void;
	runsRemaining: number;
	pBand: "light" | "medium" | "heavy";
	day?: number;
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
	gold: boolean;
}
interface Ring {
	id: number;
	a: Animated.Value;
	gold: boolean;
}

const BG_BY_DAY = [
	HAT_IMAGES.mud_pit_bg,
	HAT_IMAGES.reed_marsh_bg,
	HAT_IMAGES.mud_derby_bg,
	HAT_IMAGES.bog_dusk_bg,
	HAT_IMAGES.festival_night_bg,
];

const P_BAND_TO_DIFF: Record<"light" | "medium" | "heavy", Difficulty> = {
	light: "easy",
	medium: "med",
	heavy: "hard",
};

export function RhythmDefense({ onRunComplete, runsRemaining, pBand, day = 3 }: Props) {
	const difficulty = P_BAND_TO_DIFF[pBand];
	const song = SONG[difficulty];
	// In dev keep the bucket LIVE past the daily run budget so the run stays
	// testable without waiting for the UTC reset. The server still enforces the
	// real RUNS_PER_DAY cap on what banks (submitRun no-ops past it). Prod: spent = empty.
	const outOfRuns = runsRemaining <= 0;
	const empty = outOfRuns && !__DEV__;
	const bgSource = BG_BY_DAY[Math.min(Math.max(day - 1, 0), BG_BY_DAY.length - 1)];

	const [laneW, setLaneW] = useState(0);
	const runnerX = useRef(new Animated.Value(0)).current;
	const runnerXRef = useRef(0); // crossing snapshot — the ONLY thing the classifier reads
	const ambient = useRef(new Animated.Value(0)).current;
	const bucketScale = useRef(new Animated.Value(1)).current;
	const recoil = useRef(new Animated.Value(0)).current;
	const gobFlee = useRef(new Animated.Value(0)).current;
	const bob = useRef(new Animated.Value(0)).current;
	const stagePunch = useRef(new Animated.Value(1)).current;
	const shake = useRef(new Animated.Value(0)).current;
	const bossMode = useRef(new Animated.Value(0)).current;
	const hitFade = useRef(new Animated.Value(0)).current;
	const crowdReact = useRef(new Animated.Value(0)).current;

	// Lifecycle refs.
	const focusedRef = useRef(false);
	const lapRef = useRef<Animated.CompositeAnimation | null>(null);
	const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hitCountRef = useRef(0);
	const hitTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

	const [goblin, setGoblin] = useState<Archetype>(() => rollArchetype());
	const goblinRef = useRef(goblin);

	const [score, setScore] = useState(0);
	const streakRef = useRef(0);
	const [combo, setCombo] = useState(0);
	const comboAnim = useRef(new Animated.Value(0)).current;
	const [floaters, setFloaters] = useState<Floater[]>([]);
	const [splats, setSplats] = useState<Splat[]>([]);
	const [rings, setRings] = useState<Ring[]>([]);
	const idRef = useRef(0);

	// Run progress: the bands collected so far this run + whether a run is in flight.
	const bandsRef = useRef<MudBand[]>([]);
	const [notesDone, setNotesDone] = useState(0);
	const runOverRef = useRef(false); // latched once the run hits NOTES_PER_RUN
	const [runOver, setRunOver] = useState(false);

	// The run-cycle bob loop, restarted per archetype.
	const bobLoopRef = useRef<Animated.CompositeAnimation | null>(null);
	const startBobLoop = useCallback(
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

	// Advance the run: append the band, bump the counter, and finish the run when
	// it reaches NOTES_PER_RUN. The band array is the ONLY thing that leaves.
	const registerNote = useCallback(
		(band: MudBand) => {
			if (runOverRef.current) return;
			bandsRef.current = [...bandsRef.current, band];
			const done = bandsRef.current.length;
			setNotesDone(done);
			if (done >= NOTES_PER_RUN) {
				runOverRef.current = true;
				setRunOver(true);
				lapRef.current?.stop();
				bobLoopRef.current?.stop();
				onRunComplete(bandsRef.current.slice(0, NOTES_PER_RUN));
			}
		},
		[onRunComplete]
	);

	// One lap of the crossing, then re-roll a fresh goblin and recurse. The lap
	// SPEED is the song's tempo (not the archetype's, so difficulty owns the beat).
	// `from` > 0 means a hit-stop resume.
	const animateLap = useCallback(
		(from: number) => {
			if (!focusedRef.current || runOverRef.current) return;
			runnerX.setValue(from);
			const a = Animated.timing(runnerX, {
				toValue: 1,
				duration: Math.max(60, song.lapMs * (1 - from)),
				easing: Easing.linear,
				useNativeDriver: true,
			});
			lapRef.current = a;
			a.start(({ finished }) => {
				if (!finished || !focusedRef.current || runOverRef.current) return;
				// He crossed un-tapped — a leak. Count it as a whiff note (softened copy).
				registerNote("whiff");
				if (runOverRef.current) return;
				hitTimersRef.current.forEach(clearTimeout);
				hitTimersRef.current.clear();
				hitCountRef.current = 0;
				hitFade.setValue(0);
				const next = rollArchetype();
				goblinRef.current = next;
				setGoblin(next);
				animateLap(0);
			});
		},
		[runnerX, hitFade, song.lapMs, registerNote]
	);

	// Announce + boss vignette + gait, each time the foe changes.
	useEffect(() => {
		goblinRef.current = goblin;
		startBobLoop(goblin.bobMs);
		if (goblin.key === "warboss") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
			Animated.spring(bossMode, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 6 }).start();
		} else {
			Animated.timing(bossMode, { toValue: 0, duration: 400, useNativeDriver: true }).start();
		}
	}, [goblin, bossMode, startBobLoop]);

	const fire = useCallback(
		(band: MudBand, accuracy: number, crossX: number) => {
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

			// Bucket recoil squish.
			Animated.sequence([
				Animated.spring(bucketScale, { toValue: 0.84, useNativeDriver: true, speed: 50, bounciness: 0 }),
				Animated.spring(bucketScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
			]).start();

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

				const peak = band === "perfect" ? 1 : band === "good" ? 0.75 : 0.5;
				recoil.setValue(0);
				Animated.sequence([
					Animated.timing(recoil, { toValue: peak, duration: 120, useNativeDriver: true }),
					Animated.spring(recoil, { toValue: 0, useNativeDriver: true, speed: 8, bounciness: 6 }),
				]).start();

				const mag = (tier === 2 ? 1 : tier === 1 ? 0.5 : 0.25) * (arche.key === "warboss" && band === "perfect" ? 1.4 : 1);
				shake.setValue(0);
				Animated.sequence(
					[1, -1, 0.6, -0.4, 0].map((m) =>
						Animated.timing(shake, { toValue: m * mag, duration: 45, useNativeDriver: true })
					)
				).start();
				// NB: the hit-stop pause before the NEXT goblin is owned by onTap's single
				// advance (below), not a freeze() here — two lap-restarts would fight.
			}

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
				const rid = idRef.current++;
				const ra = new Animated.Value(0);
				setRings((r) => [...r, { id: rid, a: ra, gold: arche.key === "warboss" }]);
				Animated.timing(ra, { toValue: 1, duration: 440, useNativeDriver: true }).start(() =>
					setRings((r) => r.filter((x) => x.id !== rid))
				);
			}

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

			if (hit) {
				const goblinX = -arche.size + crossX * (laneW + arche.size) + arche.size / 2;
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
		},
		[bucketScale, comboAnim, crowdReact, gobFlee, hitFade, recoil, shake, stagePunch, laneW]
	);

	// Tap = score the goblin at the strike line. The TEMPORAL band comes from |dt|
	// (ms from the lap's ideal crossing time); the cosmetic position snapshot drives
	// the splat origin. After firing, advance the run + roll the next goblin.
	const onTap = useCallback(() => {
		if (empty || runOverRef.current) return;
		const x = runnerXRef.current;
		// |dt|: how far the goblin's CURRENT progress (0..1) is from dead-center 0.5,
		// converted to ms via the song tempo. The lane-position read is client-only —
		// same anti-cheat source of truth as the toss.
		const absDt = Math.abs(x - 0.5) * song.lapMs;
		const band = classifyDt(absDt, song.windowMult);
		const accuracy = Math.max(0, 1 - absDt / (WEAK_WINDOW_MS * song.windowMult));
		fire(band, accuracy, x);
		registerNote(band);
		if (runOverRef.current) return;
		// Roll the next goblin + lap for the next note.
		hitTimersRef.current.forEach(clearTimeout);
		hitTimersRef.current.clear();
		hitCountRef.current = 0;
		const next = rollArchetype();
		goblinRef.current = next;
		setGoblin(next);
		// SINGLE advance to the next runner, with a hit-stop pause that scales with the
		// band (a perfect lingers longest). This is the ONLY lap-restart per tap — fire()
		// no longer schedules its own, so the two never race on runnerX.
		const pause = band === "perfect" ? 120 : band === "good" ? 70 : 0;
		runnerX.stopAnimation(() => {
			if (freezeTimer.current) clearTimeout(freezeTimer.current);
			if (pause > 0) {
				freezeTimer.current = setTimeout(() => {
					if (focusedRef.current && !runOverRef.current) animateLap(0);
				}, pause);
			} else if (focusedRef.current && !runOverRef.current) {
				animateLap(0);
			}
		});
	}, [empty, fire, registerNote, song.lapMs, song.windowMult, animateLap, runnerX]);

	// Begin a FRESH run (after one banks) without remounting — used when the player
	// still has runs left this Hold day. Resets the per-run band buffer + score juice
	// and re-arms the conveyor. The daily cap is enforced by the parent (runsRemaining)
	// + the server (submit_run no-ops past it).
	const beginRun = useCallback(() => {
		if (empty || (runsRemaining <= 0 && !__DEV__)) return;
		bandsRef.current = [];
		setNotesDone(0);
		streakRef.current = 0;
		setCombo(0);
		setScore(0);
		runOverRef.current = false;
		setRunOver(false);
		hitTimersRef.current.forEach(clearTimeout);
		hitTimersRef.current.clear();
		hitCountRef.current = 0;
		hitFade.setValue(0);
		const next = rollArchetype();
		goblinRef.current = next;
		setGoblin(next);
		startBobLoop(next.bobMs);
		Haptics.selectionAsync().catch(() => {});
		animateLap(0);
	}, [empty, runsRemaining, hitFade, startBobLoop, animateLap]);

	// Loop lifecycle gated on FOCUS (battery) — mirrors SlopToss.
	useFocusEffect(
		useCallback(() => {
			focusedRef.current = true;
			runOverRef.current = false;
			setRunOver(false);
			bandsRef.current = [];
			setNotesDone(0);
			streakRef.current = 0;
			setScore(0);
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
			startBobLoop(goblinRef.current.bobMs);
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
			// animateLap depends on song.lapMs; re-arming on focus is intentional.
		}, [animateLap, startBobLoop, runnerX, ambient])
	);

	// Memoized interpolations (mirrors SlopToss).
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
	const shakeTX = useMemo(() => shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }), [shake]);
	const shakeRot = useMemo(() => shake.interpolate({ inputRange: [-1, 1], outputRange: ["-0.6deg", "0.6deg"] }), [shake]);
	const bossVignette = useMemo(() => bossMode.interpolate({ inputRange: [0, 1], outputRange: [0, 0.22] }), [bossMode]);
	// Gold-post strike telegraph: brightens + grows as the goblin nears dead-center.
	const proximity = useMemo(() => runnerX.interpolate({ inputRange: [0.34, 0.5, 0.66], outputRange: [0, 1, 0], extrapolate: "clamp" }), [runnerX]);
	const goldOpacity = useMemo(() => proximity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), [proximity]);
	const goldScaleY = useMemo(() => proximity.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }), [proximity]);
	const goldBlink = useMemo(() => runnerX.interpolate({ inputRange: [0.45, 0.5, 0.55], outputRange: [0, 0.85, 0], extrapolate: "clamp" }), [runnerX]);

	// The strike line is FIXED at center — a thin gold post, no green gate (timing
	// is temporal, so there's no spatial shoulder zone to draw).
	const postW = 10;

	// After a run banks, the bucket re-arms for the NEXT run when one remains. In
	// dev the bucket stays live past the cap (mirrors SlopToss) for feel-testing.
	const canStartNext = runOver && !empty && (runsRemaining > 0 || __DEV__);
	const bucketDisabled = empty || (runOver && !canStartNext);

	const runsLabel = empty
		? "Out of runs — the horde regroups till tomorrow"
		: outOfRuns
		? "dev · runs spent — bucket kept live to test"
		: `tap as each goblin crosses · ${runsRemaining} ${runsRemaining === 1 ? "run" : "runs"} left`;

	return (
		<Animated.View style={[styles.stageWrap, { transform: [{ scale: stagePunch }, { translateX: shakeTX }, { rotate: shakeRot }] }]}>
			<View style={styles.stage} onLayout={(e) => setLaneW(e.nativeEvent.layout.width)}>
				<Animated.Image source={bgSource} resizeMode="cover" style={[styles.bg, { transform: [{ translateX: bgDrift }] }]} />
				<View style={styles.scrim} />
				<Animated.View pointerEvents="none" style={[styles.bossVignette, { opacity: bossVignette }]} />

				{/* Watching horde */}
				<Animated.View
					style={[styles.crowd, { transform: [{ translateX: crowdParallax }, { translateY: crowdTY }, { translateY: crowdReactTY }, { scale: crowdReactScale }] }]}
					pointerEvents="none"
				>
					{CROWD.map((src, i) => (
						<Image key={i} source={src} style={styles.crowdGoblin} resizeMode="contain" />
					))}
				</Animated.View>

				{/* Score chip + run progress pips */}
				<View style={styles.scoreChip}>
					<Text style={styles.scoreText}>{score.toLocaleString()}</Text>
				</View>
				<View style={styles.progressPips}>
					{Array.from({ length: NOTES_PER_RUN }).map((_, i) => (
						<View key={i} style={[styles.progressPip, i < notesDone && styles.progressPipDone]} />
					))}
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

				{/* Run lane: fixed strike post (telegraph) + the goblin + burst rings */}
				<View style={styles.lane} pointerEvents="none">
					<Animated.View style={[styles.goldPost, { left: laneW / 2 - postW / 2, width: postW, opacity: goldOpacity, transform: [{ scaleY: goldScaleY }] }]} />
					<Animated.View style={[styles.goldBlink, { left: laneW / 2 - postW / 2, width: postW, opacity: goldBlink }]} />

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

				{/* Reed curtains */}
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
							: "he slipped past!"}
					</Animated.Text>
				))}

				<Pressable
					onPress={canStartNext ? beginRun : onTap}
					disabled={bucketDisabled}
					style={styles.bucketWrap}
				>
					<Animated.View
						style={[
							styles.bucket,
							bucketDisabled && styles.bucketEmpty,
							{ transform: [{ scale: bucketScale }, ...(bucketDisabled ? [] : [{ translateY: bucketIdleTY }])] },
						]}
					>
						<Image source={HAT_IMAGES.slop_bucket} resizeMode="contain" style={[styles.bucketImg, bucketDisabled && { opacity: 0.4 }]} />
					</Animated.View>
				</Pressable>

				{/* Song banner — the area-band difficulty (decision B) */}
				{!runOver && (
					<View style={styles.songChip}>
						<Text style={styles.songText}>{song.announce}</Text>
					</View>
				)}

				<Text style={styles.label}>
					{runOver
						? canStartNext
							? "Run banked — tap to hold the line again"
							: "Run banked — the bog soaks it up till tomorrow"
						: runsLabel}
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
	progressPips: { position: "absolute", top: 12, right: 12, flexDirection: "row", gap: 5 },
	progressPip: {
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: "rgba(255,255,255,0.35)",
	},
	progressPipDone: { backgroundColor: WHIMSY.sun },
	comboRibbon: { position: "absolute", top: 36, alignSelf: "center", backgroundColor: WHIMSY.sun, borderWidth: 2, borderColor: WHIMSY.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
	comboText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },

	lane: { position: "absolute", left: 0, right: 0, top: STAGE_H * 0.42, height: 96 },
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
	bucket: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: WHIMSY.ink, backgroundColor: WHIMSY.sun, alignItems: "center", justifyContent: "center" },
	bucketEmpty: { backgroundColor: WHIMSY.cream2 },
	bucketImg: { width: 54, height: 54 },

	songChip: {
		position: "absolute",
		top: STAGE_H * 0.3,
		alignSelf: "center",
		backgroundColor: "rgba(20,16,28,0.6)",
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	songText: { fontFamily: FONTS.hand, fontSize: 14, color: "#fff" },
	label: { position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", paddingVertical: 4, fontFamily: FONTS.hand, fontSize: 13, color: "#fff" },
});
