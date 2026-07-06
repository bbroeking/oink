// The Snout Hook — the third scuffle game (lab option ③): a swinging hook
// sweeps over the soil; drop it at the right moment to haul up whatever
// sits shallowest in that column. Same server contract as the Truffle
// Patch — generateBoard(session.seed) lays the finds, each drop is a
// chunky 4-action haul, and the submit re-validates against the seed.
// Rotation picks it by feeding window (FeedingStrip: windowIndex % 3).

import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import type { RootingSession, RootingOutcome } from "@/hooks/useRooting";
import {
	generateBoard,
	type ClaimableFind,
	type Find,
} from "@/utils/rooting";
import { PATCH_ROWS, PATCH_COLS } from "@/constants/mudFights";
import { FONTS, KICKER_TEXT, RADII, SPACE, TYPE, WHIMSY } from "@/constants/theme";

const ACTIONS_PER_DROP = 4;

const HAUL_LINE: Record<Find, string> = {
	truffle_l: "the long truffle! straight to the pouch.",
	truffle_d: "the dark truffle! straight to the pouch.",
	shimmer: "a shimmer — pretty.",
	junk_boot: "an old boot. huh.",
	junk_wrap: "a mud-soaked wrap. huh.",
	stone: "clonk — the hook skips off stone.",
};

interface Props {
	session: RootingSession;
	onSubmit: (
		finds: ClaimableFind[],
		actions: number
	) => Promise<RootingOutcome | null>;
	onClose: () => void;
}

export function SnoutHook({ session, onSubmit, onClose }: Props) {
	const board = useMemo(() => generateBoard(session.seed), [session.seed]);
	const maxDrops = session.coop ? 6 : 5; // 6×4=24 ≤ 25 / 5×4=20 ≤ 20

	const [drops, setDrops] = useState(0);
	const [hauled, setHauled] = useState<Set<number>>(new Set());
	const [line, setLine] = useState<string | null>(
		session.coop ? "a crewmate hauled this feeding — one extra drop." : null
	);
	const [ending, setEnding] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const collectedRef = useRef<Set<Find>>(new Set());
	const dropsRef = useRef(0);
	const endedRef = useRef(false);

	// The sweep — an eased ping-pong across the columns; sampled at drop time.
	const sweep = useRef(new Animated.Value(0)).current;
	const sweepVal = useRef(0);
	useEffect(() => {
		const id = sweep.addListener(({ value }) => (sweepVal.current = value));
		Animated.loop(
			Animated.sequence([
				Animated.timing(sweep, {
					toValue: 1,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: false,
				}),
				Animated.timing(sweep, {
					toValue: 0,
					duration: 1400,
					easing: Easing.inOut(Easing.quad),
					useNativeDriver: false,
				}),
			])
		).start();
		return () => sweep.removeListener(id);
	}, [sweep]);

	const claimables = (): ClaimableFind[] =>
		[...collectedRef.current].filter((f): f is ClaimableFind => f !== "stone");

	const finish = async (why: string) => {
		if (endedRef.current) return;
		endedRef.current = true;
		setEnding(why);
		setSubmitting(true);
		await onSubmit(claimables(), dropsRef.current * ACTIONS_PER_DROP);
		setSubmitting(false);
	};

	const drop = () => {
		if (endedRef.current || dropsRef.current >= maxDrops) return;
		dropsRef.current += 1;
		setDrops(dropsRef.current);
		const col = Math.min(
			PATCH_COLS - 1,
			Math.floor(sweepVal.current * PATCH_COLS)
		);
		// The hook sinks to the SHALLOWEST unhauled thing in this column.
		let caught: { idx: number; kind: Find } | null = null;
		for (let row = 0; row < PATCH_ROWS; row++) {
			const idx = row * PATCH_COLS + col;
			const cell = board.cells[idx];
			if (cell && !hauled.has(idx)) {
				caught = { idx, kind: cell.kind };
				break;
			}
		}
		if (!caught) {
			setLine("the hook comes up muddy — nothing there.");
			Haptics.selectionAsync().catch(() => {});
		} else {
			setHauled((s) => new Set(s).add(caught!.idx));
			setLine(HAUL_LINE[caught.kind]);
			if (caught.kind !== "stone") {
				collectedRef.current.add(caught.kind);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
			}
		}
		const both =
			collectedRef.current.has("truffle_l") &&
			collectedRef.current.has("truffle_d");
		if (both) {
			void finish("Both truffles hauled — reel it in.");
		} else if (dropsRef.current >= maxDrops) {
			void finish("Out of drops — you reel in your haul.");
		}
	};

	const hookLeft = sweep.interpolate({
		inputRange: [0, 1],
		outputRange: ["2%", "90%"],
	});

	return (
		<View style={styles.wrap}>
			<Text style={styles.kicker}>★ the snout hook ★</Text>
			<Text style={styles.headline}>He's gorging — drop the hook.</Text>

			{/* The sweep lane + hook */}
			<View style={styles.lane}>
				<Animated.View style={[styles.hook, { left: hookLeft }]}>
					<Glyph name="pinch" size={20} />
				</Animated.View>
			</View>

			{/* The soil — silhouettes until hauled. */}
			<View style={styles.soil}>
				{Array.from({ length: PATCH_ROWS }).map((_, row) => (
					<View key={row} style={[styles.soilRow, { backgroundColor: SOIL[row % SOIL.length] }]}>
						{Array.from({ length: PATCH_COLS }).map((_, col) => {
							const idx = row * PATCH_COLS + col;
							const cell = board.cells[idx];
							const isHauled = hauled.has(idx);
							return (
								<View key={col} style={styles.soilSpot}>
									{cell && !isHauled && <View style={styles.lump} />}
									{cell && isHauled && cell.kind === "stone" && (
										<View style={styles.stone} />
									)}
								</View>
							);
						})}
					</View>
				))}
			</View>

			<Button
				size="md"
				variant="primary"
				full
				onPress={drop}
				disabled={!!ending || drops >= maxDrops}
			>
				{`Drop the hook (${maxDrops - drops} left)`}
			</Button>

			{!!line && !ending && <Text style={styles.line}>{line}</Text>}
			{!!ending && (
				<Text style={styles.line}>
					{ending}
					{submitting ? " …" : ""}
				</Text>
			)}

			<View style={styles.footRow}>
				<Text style={styles.pouch}>
					pouch · {claimables().length}
					{session.blessed ? "  ✦ blessed" : ""}
				</Text>
				{ending ? (
					<Button size="sm" variant="primary" onPress={onClose} disabled={submitting}>
						Done
					</Button>
				) : (
					<Pressable onPress={() => finish("Reeled in early — haul banked.")} hitSlop={8}>
						<Text style={styles.bagOut}>reel in ›</Text>
					</Pressable>
				)}
			</View>
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
	lane: {
		height: 34,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		backgroundColor: WHIMSY.sky,
		marginBottom: 4,
		justifyContent: "center",
	},
	hook: { position: "absolute" },
	soil: {
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		borderRadius: RADII.md,
		overflow: "hidden",
		marginBottom: SPACE.md,
	},
	soilRow: {
		flexDirection: "row",
		justifyContent: "space-around",
		paddingVertical: 7,
	},
	soilSpot: { width: 30, height: 18, alignItems: "center", justifyContent: "center" },
	lump: {
		width: 16,
		height: 12,
		borderRadius: 6,
		backgroundColor: "rgba(42,31,21,0.35)",
	},
	stone: { width: 14, height: 10, borderRadius: 5, backgroundColor: WHIMSY.mute },
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
