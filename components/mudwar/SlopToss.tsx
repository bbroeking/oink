// Slop Toss — the skill minigame at the heart of a Mud Fight. Hold the bucket
// to wind up a power meter; a green ZONE with a thin GOLD core sits high on the
// bar. Release:
//   under the zone -> weak      (band 'weak'    -> 1 mud)
//   in the green    -> good      (band 'good'    -> 2 mud)
//   in the gold     -> perfect   (band 'perfect' -> 3 mud)
//   overcharged     -> bust      (band 'whiff'   -> 0 mud)
// Power + accuracy collapse into one release-point: you must charge ENOUGH and
// release PRECISELY, and overcharging busts (the risk/reward greed).
//
// Two currencies, by design (see the war plan): the player racks up GRANULAR
// POINTS (power x accuracy x combo — the skill/dopamine, uncapped, client-only),
// while the throw's coarse BAND is what the server clamps into the bounded mud
// pull that actually moves the war. onThrow(band) hands the band up to the hook.
//
// NOTE: goblin targets are placeholders (a reused mud sprite) until the horde
// art lands; the mechanic + scoring are the real thing here.
import { useCallback, useRef, useState } from "react";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { HAT_IMAGES } from "@/constants/hats";
import { MudBand } from "@/utils/mudWars";
import { FONTS, WHIMSY } from "@/constants/theme";

// Meter geometry (0..1 along the bar). Gold sits at the TOP of the green, just
// under the overcharge cliff — charge high but not over. Tune on-device.
const METER_H = 210;
const GREEN_LO = 0.5;
const GREEN_HI = 0.9; // above this = overcharge bust
const GOLD_LO = 0.78; // GOLD_LO..GREEN_HI = perfect
const WEAK_LO = 0.15; // below this = whiff (barely charged)
const CHARGE_MS = 1150; // 0 -> full wind-up time

function classify(v: number): MudBand {
	if (v > GREEN_HI) return "whiff"; // overcharged / busted
	if (v >= GOLD_LO) return "perfect";
	if (v >= GREEN_LO) return "good";
	if (v >= WEAK_LO) return "weak";
	return "whiff";
}

// Granular vanity points — coarse band base, scaled by how cleanly you hit the
// gold core and your current streak. Never touches the server score.
const BAND_BASE: Record<MudBand, number> = { whiff: 0, weak: 120, good: 450, perfect: 1000 };
function scorePoints(band: MudBand, v: number, streak: number): number {
	if (band === "whiff") return 0;
	const goldMid = (GOLD_LO + GREEN_HI) / 2;
	const accuracy = band === "perfect" ? 1 - Math.min(1, Math.abs(v - goldMid) / 0.1) : 0;
	const comboMult = 1 + Math.min(streak, 6) * 0.15;
	return Math.round(BAND_BASE[band] * (1 + accuracy * 0.5) * comboMult);
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
}

export function SlopToss({ onThrow, throwsRemaining }: Props) {
	const empty = throwsRemaining <= 0;

	const charge = useRef(new Animated.Value(0)).current;
	const bucketScale = useRef(new Animated.Value(1)).current;
	const [charging, setCharging] = useState(false);

	const [score, setScore] = useState(0);
	const streakRef = useRef(0);
	const [combo, setCombo] = useState(0);
	const comboAnim = useRef(new Animated.Value(0)).current;

	const [floaters, setFloaters] = useState<Floater[]>([]);
	const [splats, setSplats] = useState<{ id: number; x: number; a: Animated.Value }[]>([]);
	const idRef = useRef(0);

	const fire = useCallback(
		(band: MudBand, v: number) => {
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

			// Score (vanity) + combo ribbon.
			const pts = scorePoints(band, v, streakRef.current - 1);
			if (pts > 0) setScore((s) => s + pts);
			if (streakRef.current >= 2 && band !== "whiff") {
				setCombo(streakRef.current);
				comboAnim.setValue(0);
				Animated.spring(comboAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }).start();
			} else {
				setCombo(0);
			}

			// Bucket squish.
			Animated.sequence([
				Animated.spring(bucketScale, { toValue: 0.86, useNativeDriver: true, speed: 50, bounciness: 0 }),
				Animated.spring(bucketScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
			]).start();

			// Flung mud (more + higher with tier).
			if (band !== "whiff") {
				const count = [3, 5, 6][tier];
				const fresh = Array.from({ length: count }).map(() => ({
					id: idRef.current++,
					x: (Math.random() - 0.5) * (90 + tier * 30),
					a: new Animated.Value(0),
				}));
				setSplats((s) => [...s, ...fresh]);
				fresh.forEach((sp) =>
					Animated.timing(sp.a, { toValue: 1, duration: 600, useNativeDriver: true }).start(() =>
						setSplats((s) => s.filter((x) => x.id !== sp.id))
					)
				);
			}

			// "+N" / band floater.
			const fid = idRef.current++;
			const fa = new Animated.Value(0);
			setFloaters((f) => [...f, { id: fid, x: (Math.random() - 0.5) * 40, a: fa, band }]);
			Animated.timing(fa, { toValue: 1, duration: 850, useNativeDriver: true }).start(() =>
				setFloaters((f) => f.filter((x) => x.id !== fid))
			);

			onThrow(band);
		},
		[bucketScale, comboAnim, onThrow]
	);

	const onPressIn = useCallback(() => {
		if (empty) return;
		setCharging(true);
		charge.setValue(0);
		Animated.timing(charge, { toValue: 1, duration: CHARGE_MS, useNativeDriver: false }).start();
	}, [empty, charge]);

	const onPressOut = useCallback(() => {
		if (empty) return;
		setCharging(false);
		charge.stopAnimation((v: number) => {
			fire(classify(v), v);
			charge.setValue(0);
		});
	}, [empty, charge, fire]);

	const fillH = charge.interpolate({ inputRange: [0, 1], outputRange: [0, METER_H] });

	return (
		<View style={styles.wrap}>
			{/* Score (granular skill points) */}
			<Text style={styles.score}>{score.toLocaleString()}</Text>

			<View style={styles.arena}>
				{/* Power meter */}
				<View style={styles.meter}>
					{/* green zone */}
					<View
						style={[
							styles.zone,
							{ bottom: GREEN_LO * METER_H, height: (GREEN_HI - GREEN_LO) * METER_H },
						]}
					/>
					{/* gold core */}
					<View
						style={[
							styles.gold,
							{ bottom: GOLD_LO * METER_H, height: (GREEN_HI - GOLD_LO) * METER_H },
						]}
					/>
					{/* rising fill */}
					<Animated.View style={[styles.fill, { height: fillH }]} />
				</View>

				{/* Goblins (placeholder) + the thrower */}
				<View style={styles.field}>
					<View style={styles.goblinRow}>
						{[0, 1, 2].map((i) => (
							<Image key={i} source={HAT_IMAGES.mud_pie} style={styles.goblin} resizeMode="contain" />
						))}
					</View>

					{/* Flung mud */}
					{splats.map((sp) => (
						<Animated.Image
							key={sp.id}
							source={HAT_IMAGES.mud_pie}
							resizeMode="contain"
							style={[
								styles.splat,
								{
									transform: [
										{ translateX: sp.x },
										{ translateY: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) },
										{ scale: sp.a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
									],
									opacity: sp.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
								},
							]}
						/>
					))}

					{/* Band floaters */}
					{floaters.map((f) => (
						<Animated.Text
							key={f.id}
							style={[
								styles.floater,
								f.band === "perfect" && { color: WHIMSY.sun },
								f.band === "whiff" && { color: WHIMSY.mute },
								{
									transform: [
										{ translateX: f.x },
										{ translateY: f.a.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) },
									],
									opacity: f.a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
								},
							]}
						>
							{f.band === "perfect"
								? "PERFECT!"
								: f.band === "good"
								? "good"
								: f.band === "weak"
								? "weak"
								: "bust"}
						</Animated.Text>
					))}

					<Pressable onPressIn={onPressIn} onPressOut={onPressOut} disabled={empty}>
						<Animated.View
							style={[styles.bucket, empty && styles.bucketEmpty, { transform: [{ scale: bucketScale }] }]}
						>
							<Image
								source={HAT_IMAGES.slop_bucket}
								resizeMode="contain"
								style={[styles.bucketImg, empty && { opacity: 0.4 }]}
							/>
						</Animated.View>
					</Pressable>
				</View>

				{combo >= 2 && (
					<Animated.View
						pointerEvents="none"
						style={[
							styles.comboRibbon,
							{
								opacity: comboAnim,
								transform: [{ scale: comboAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
							},
						]}
					>
						<Text style={styles.comboText}>x{combo} HOT STREAK</Text>
					</Animated.View>
				)}
			</View>

			<Text style={styles.label}>
				{empty
					? "Out of throws — come back tomorrow"
					: charging
					? "release in the gold!"
					: `hold to wind up · ${throwsRemaining} throws left`}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { alignItems: "center", marginTop: 18 },
	score: { fontFamily: FONTS.whimsy, fontSize: 30, color: WHIMSY.ink },
	arena: { flexDirection: "row", alignItems: "flex-end", marginTop: 8, height: METER_H + 20 },
	meter: {
		width: 26,
		height: METER_H,
		borderRadius: 13,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
		marginRight: 22,
	},
	zone: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(91,201,125,0.45)" },
	gold: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(245,196,74,0.7)" },
	fill: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(74,48,26,0.55)" },
	field: { alignItems: "center", justifyContent: "flex-end", height: METER_H },
	goblinRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
	goblin: { width: 40, height: 40, opacity: 0.85 },
	splat: { position: "absolute", bottom: 70, width: 30, height: 30 },
	floater: { position: "absolute", bottom: 150, fontFamily: FONTS.whimsy, fontSize: 18, color: WHIMSY.accent },
	bucket: {
		width: 130,
		height: 130,
		borderRadius: 65,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.sun,
		alignItems: "center",
		justifyContent: "center",
	},
	bucketEmpty: { backgroundColor: WHIMSY.cream2 },
	bucketImg: { width: 56, height: 56 },
	comboRibbon: {
		position: "absolute",
		top: 0,
		alignSelf: "center",
		backgroundColor: WHIMSY.sun,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 4,
	},
	comboText: { fontFamily: FONTS.whimsy, fontSize: 15, color: WHIMSY.ink },
	label: { fontFamily: FONTS.hand, fontSize: 14, color: WHIMSY.ink, textAlign: "center", marginTop: 14 },
});
