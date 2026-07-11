// The Deep Root — the second scuffle game (lab option ②): root DOWNWARD
// through the soil, level by level, on your wind. Same server contract as
// the Truffle Patch — generateBoard(session.seed) lays the finds, every
// root or descent costs wind (an action), and the submit re-validates
// against the seed server-side. Rotation picks it by feeding window
// (FeedingStrip: windowIndex % 3).
//
// Play: you stand on a level; tap a spot on YOUR level to root it (finds
// are grabbed as uncovered), or root deeper to descend a level. When your
// wind runs out — or you've bagged both truffles — the haul submits.

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { ReclaimSlam, ReclaimSlamHandle } from "./ReclaimSlam";
import * as Sound from "@/utils/sound";
import type { RootingSession } from "@/hooks/useRooting";
import type { RootingOutcome } from "@/hooks/useRooting";
import {
	generateBoard,
	claimableFinds,
	type ClaimableFind,
	type Find,
} from "@/utils/rooting";
import { PATCH_ROWS, PATCH_COLS } from "@/constants/mudFights";
import { FONTS, KICKER_TEXT, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const FIND_LABEL: Record<Find, string> = {
	truffle_l: "the long truffle",
	truffle_d: "the dark truffle",
	shimmer: "a shimmer",
	junk_boot: "an old boot",
	junk_wrap: "a mud-soaked wrap",
	stone: "stone",
};

interface Props {
	session: RootingSession;
	onSubmit: (
		finds: ClaimableFind[],
		actions: number
	) => Promise<RootingOutcome | null>;
	onClose: () => void;
}

export function DeepRoot({ session, onSubmit, onClose }: Props) {
	const board = useMemo(() => generateBoard(session.seed), [session.seed]);
	const maxWind = session.coop ? 25 : 20;

	const [depth, setDepth] = useState(0); // current level (row)
	const [wind, setWind] = useState(0); // actions used
	const [rooted, setRooted] = useState<Set<number>>(new Set());
	const [collected, setCollected] = useState<Find[]>([]);
	const [line, setLine] = useState<string | null>(
		session.coop ? "a crewmate dug here — the soil is loose. root deep." : null
	);
	const [ending, setEnding] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const collectedRef = useRef<Set<Find>>(new Set());
	const windRef = useRef(0);
	const endedRef = useRef(false);
	// Reclaim slam — joy-motes rip from his corner (top) to your pouch (bottom).
	const slamRef = useRef<ReclaimSlamHandle>(null);

	// ── Juice: reanimated shared values ─────────────────────────────────────
	// crankWob: a quick resistance shudder on the active level each root/descent.
	const crankWob = useSharedValue(0);
	// tension: 0..1 root-line strain — climbs as wind depletes (harder to pull),
	// with a spring kick on each descent. Drives the root line's taut vibration.
	const tension = useSharedValue(0);
	// pouchScale: a spring bounce on the pouch tally when a find banks.
	const pouchScale = useSharedValue(1);

	const activeLevelStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: crankWob.value }],
	}));
	const rootLineStyle = useAnimatedStyle(() => ({
		opacity: 0.25 + tension.value * 0.55,
		transform: [
			{ scaleY: 0.4 + (depth / (PATCH_ROWS - 1)) * 0.6 },
			{ translateX: tension.value * (Math.random() < 0.5 ? -0.6 : 0.6) },
		],
	}));
	const pouchStyle = useAnimatedStyle(() => ({
		transform: [{ scale: pouchScale.value }],
	}));

	// A crank shudder whose weight scales with resistance (wind spent) — the
	// deeper you've dug, the stiffer the pull reads.
	const crankShudder = (resistance: number) => {
		const amp = 2 + resistance * 5;
		crankWob.value = withSequence(
			withTiming(-amp, { duration: 40, easing: Easing.out(Easing.quad) }),
			withTiming(amp * 0.7, { duration: 55 }),
			withSpring(0, { damping: 6, stiffness: 260 })
		);
	};

	// Graded haptic tied to that same resistance: a light tick early, a firm
	// knock once the pull gets stiff, a rigid bite near empty.
	const crankHaptic = (resistance: number) => {
		const style =
			resistance > 0.75
				? Haptics.ImpactFeedbackStyle.Heavy
				: resistance > 0.45
					? Haptics.ImpactFeedbackStyle.Medium
					: Haptics.ImpactFeedbackStyle.Light;
		Haptics.impactAsync(style).catch(() => {});
	};

	// Bog ambience for the whole session; a low taut hum on the root line.
	useEffect(() => {
		Sound.preload();
		Sound.startAmbience();
		tension.value = withRepeat(
			withTiming(0.18, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
			-1,
			true
		);
		return () => {
			Sound.stopAmbience();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const claimables = (): ClaimableFind[] =>
		claimableFinds(board, collectedRef.current);
	const pouchCount = claimables().length;

	// Pouch bounce whenever the banked count grows.
	const prevPouch = useRef(pouchCount);
	useEffect(() => {
		if (pouchCount > prevPouch.current) {
			pouchScale.value = withSequence(
				withSpring(1.35, { damping: 5, stiffness: 320 }),
				withSpring(1, { damping: 8, stiffness: 240 })
			);
		}
		prevPouch.current = pouchCount;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pouchCount]);

	const finish = async (why: string) => {
		if (endedRef.current) return;
		endedRef.current = true;
		setEnding(why);
		setSubmitting(true);
		// The haul goes in the pouch — a soft leather clink to close the beat.
		Sound.play("pouch_clink");
		await onSubmit(claimables(), windRef.current);
		setSubmitting(false);
	};

	const spend = (n: number): boolean => {
		if (endedRef.current || windRef.current >= maxWind) return false;
		windRef.current = Math.min(maxWind, windRef.current + n);
		setWind(windRef.current);
		return true;
	};

	const afterMove = () => {
		const both =
			collectedRef.current.has("truffle_l") &&
			collectedRef.current.has("truffle_d");
		if (both) {
			void finish("Both truffles — up the hole you go.");
		} else if (windRef.current >= maxWind) {
			void finish("Out of wind — you climb up with your armful.");
		}
	};

	const rootSpot = (col: number) => {
		const idx = depth * PATCH_COLS + col;
		if (rooted.has(idx)) return;
		if (!spend(1)) return;
		// Resistance = how much wind is already spent; drives crank feel + sound.
		const resistance = windRef.current / maxWind;
		crankShudder(resistance);
		Sound.play("scrape", { volume: 0.4 + resistance * 0.2 });
		setRooted((s) => new Set(s).add(idx));
		const cell = board.cells[idx];
		if (cell && cell.kind !== "stone") {
			if (!collectedRef.current.has(cell.kind)) {
				const isTruffle = cell.kind.startsWith("truffle");
				collectedRef.current.add(cell.kind);
				setCollected([...collectedRef.current]);
				setLine(`you rooted up ${FIND_LABEL[cell.kind]}.`);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
				// The catch slams: truffle pops with a coin sparkle, shimmer chimes.
				// Sound fires on the exact ReclaimSlam beat so they land together.
				Sound.play(isTruffle ? "truffle_pop" : "shimmer");
				// The scoop reclaims joy — golden burst for a truffle, a wisp for
				// a shimmer. (haptic:false — the grab already buzzed on this beat.)
				slamRef.current?.slam({
					intensity: isTruffle ? "pop" : "wisp",
					to: { x: 0.24, y: 0.95 },
					haptic: false,
				});
			} else {
				crankHaptic(resistance);
			}
		} else if (cell?.kind === "stone") {
			setLine("clonk — stone.");
			// A stone bites back — a firm knock and a taut root creak.
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
			Sound.play("creak", { volume: 0.4 });
		} else {
			setLine("just soil.");
			crankHaptic(resistance);
		}
		afterMove();
	};

	const goDeeper = () => {
		if (depth >= PATCH_ROWS - 1) return;
		if (!spend(1)) return;
		const resistance = windRef.current / maxWind;
		setDepth((d) => d + 1);
		setLine("deeper — the soil goes soft.");
		// Descending strains the root line — a creak, a crank shudder, and a
		// spring kick of tension that decays back to the idle hum.
		crankShudder(Math.max(0.4, resistance));
		Haptics.selectionAsync().catch(() => {});
		Sound.play("creak");
		tension.value = withSequence(
			withSpring(0.85, { damping: 5, stiffness: 200 }),
			withTiming(0.18, { duration: 900, easing: Easing.out(Easing.quad) })
		);
		afterMove();
	};

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the deep root ★</Text>
			<Text style={styles.headline}>He's gorging — root deep.</Text>

			{/* Wind meter */}
			<View style={styles.windRow}>
				<Text style={styles.windLabel}>your wind</Text>
				<View style={styles.windTrack}>
					<View
						style={[styles.windFill, { width: `${(1 - wind / maxWind) * 100}%` }]}
					/>
				</View>
			</View>

			{/* The shaft — levels stack downward; yours is lit. */}
			<View style={styles.shaft}>
				{/* The root line — a taut fibre running down to your depth, humming
				    at idle and snapping tight on each descent. */}
				<Animated.View
					pointerEvents="none"
					style={[styles.rootLine, rootLineStyle]}
				/>
				{Array.from({ length: PATCH_ROWS }).map((_, row) => (
					<Animated.View
						key={row}
						style={[
							styles.level,
							{ backgroundColor: SOIL[row % SOIL.length] },
							row === depth && styles.levelHere,
							row > depth && styles.levelBelow,
							row === depth && activeLevelStyle,
						]}
					>
						{Array.from({ length: PATCH_COLS }).map((_, col) => {
							const idx = row * PATCH_COLS + col;
							const isRooted = rooted.has(idx);
							const cell = board.cells[idx];
							return (
								<Pressable
									key={col}
									disabled={row !== depth || !!ending}
									onPress={() => rootSpot(col)}
									style={[
										styles.spot,
										isRooted && styles.spotRooted,
										row === depth && !isRooted && styles.spotHere,
									]}
								>
									{isRooted && cell && cell.kind !== "stone" && (
										<Glyph
											name={
												cell.kind === "shimmer"
													? "sparkle"
													: cell.kind.startsWith("truffle")
														? "gem"
														: "snail"
											}
											size={14}
										/>
									)}
									{isRooted && cell?.kind === "stone" && (
										<View style={styles.stone} />
									)}
								</Pressable>
							);
						})}
					</Animated.View>
				))}
			</View>

			{/* Root deeper — costs wind, opens the next level. */}
			{!ending && depth < PATCH_ROWS - 1 && (
				<Pressable onPress={goDeeper} style={styles.deeperBtn} hitSlop={6}>
					<Text style={styles.deeperText}>root deeper ↓</Text>
				</Pressable>
			)}

			{!!line && !ending && <Text style={styles.line}>{line}</Text>}
			{!!ending && (
				<Text style={styles.line}>
					{ending}
					{submitting ? " …" : ""}
				</Text>
			)}

			<View style={styles.footRow}>
				<Animated.View style={pouchStyle}>
					<Text style={styles.pouch}>
						pouch · {pouchCount}
						{session.blessed ? "  ✦ blessed" : ""}
					</Text>
				</Animated.View>
				{ending ? (
					<Button size="sm" variant="primary" onPress={onClose} disabled={submitting}>
						Done
					</Button>
				) : (
					<Pressable onPress={() => finish("You climb up early — haul banked.")} hitSlop={8}>
						<Text style={styles.bagOut}>climb up ›</Text>
					</Pressable>
				)}
			</View>

			<ReclaimSlam ref={slamRef} />
		</View>
	);
}

const SOIL = ["#c9a06b", "#b98d55", "#a67a45", "#8f6636", "#7a542b"];

const styles = StyleSheet.create({
	wrap: {
		backgroundColor: WHIMSY.paper,
		borderWidth: 3,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.xl,
		padding: SPACE.lg,
	},
	kicker: { ...KICKER_TEXT, textAlign: "center" },
	headline: {
		fontFamily: FONTS.whimsy,
		fontSize: 20,
		color: WHIMSY.ink,
		textAlign: "center",
		marginBottom: SPACE.sm,
	},
	windRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm },
	windLabel: { ...TYPE.kicker, fontFamily: FONTS.hand, color: WHIMSY.mute },
	windTrack: {
		flex: 1,
		height: 10,
		borderRadius: 5,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.cream2,
		overflow: "hidden",
	},
	windFill: { height: "100%", backgroundColor: WHIMSY.sage },
	shaft: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		overflow: "hidden",
	},
	rootLine: {
		position: "absolute",
		left: 14,
		top: 0,
		bottom: 0,
		width: 3,
		borderRadius: 2,
		backgroundColor: WHIMSY.ink,
		zIndex: 1,
	},
	level: {
		flexDirection: "row",
		justifyContent: "space-around",
		paddingVertical: 6,
		paddingHorizontal: 4,
	},
	levelHere: { borderWidth: 2, borderColor: WHIMSY.sun },
	levelBelow: { opacity: 0.55 },
	spot: {
		width: 34,
		height: 30,
		borderRadius: 8,
		borderWidth: 1.5,
		borderColor: "rgba(42,31,21,0.45)",
		backgroundColor: "rgba(255,250,240,0.25)",
		alignItems: "center",
		justifyContent: "center",
	},
	spotHere: { backgroundColor: "rgba(255,250,240,0.5)" },
	spotRooted: { backgroundColor: "rgba(42,31,21,0.25)", borderStyle: "dashed" },
	stone: {
		width: 14,
		height: 10,
		borderRadius: 5,
		backgroundColor: WHIMSY.mute,
	},
	deeperBtn: { alignSelf: "center", marginTop: SPACE.sm },
	deeperText: {
		fontFamily: FONTS.bodyExtra,
		fontSize: 13,
		color: WHIMSY.accent,
		textDecorationLine: "underline",
	},
	line: {
		...TYPE.hand,
		fontFamily: FONTS.hand,
		color: WHIMSY.mute,
		textAlign: "center",
		marginTop: SPACE.sm,
	},
	footRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: SPACE.md,
	},
	pouch: { fontFamily: FONTS.bodyExtra, fontSize: 12, color: WHIMSY.ink },
	bagOut: {
		fontFamily: FONTS.hand,
		fontSize: 13,
		color: WHIMSY.mute,
		textDecorationLine: "underline",
	},
});
