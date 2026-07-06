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

import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph } from "../ui/Glyph";
import { Button } from "../ui/Button";
import { ReclaimSlam, ReclaimSlamHandle } from "./ReclaimSlam";
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

	const claimables = (): ClaimableFind[] =>
		claimableFinds(board, collectedRef.current);

	const finish = async (why: string) => {
		if (endedRef.current) return;
		endedRef.current = true;
		setEnding(why);
		setSubmitting(true);
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
		setRooted((s) => new Set(s).add(idx));
		const cell = board.cells[idx];
		if (cell && cell.kind !== "stone") {
			if (!collectedRef.current.has(cell.kind)) {
				collectedRef.current.add(cell.kind);
				setCollected([...collectedRef.current]);
				setLine(`you rooted up ${FIND_LABEL[cell.kind]}.`);
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
				// The scoop reclaims joy — golden burst for a truffle, a wisp for
				// a shimmer. (haptic:false — the grab already buzzed on this beat.)
				slamRef.current?.slam({
					intensity: cell.kind.startsWith("truffle") ? "pop" : "wisp",
					to: { x: 0.24, y: 0.95 },
					haptic: false,
				});
			}
		} else if (cell?.kind === "stone") {
			setLine("clonk — stone.");
		} else {
			setLine("just soil.");
		}
		afterMove();
	};

	const goDeeper = () => {
		if (depth >= PATCH_ROWS - 1) return;
		if (!spend(1)) return;
		setDepth((d) => d + 1);
		setLine("deeper — the soil goes soft.");
		Haptics.selectionAsync().catch(() => {});
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
				{Array.from({ length: PATCH_ROWS }).map((_, row) => (
					<View
						key={row}
						style={[
							styles.level,
							{ backgroundColor: SOIL[row % SOIL.length] },
							row === depth && styles.levelHere,
							row > depth && styles.levelBelow,
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
					</View>
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
				<Text style={styles.pouch}>
					pouch · {claimables().length}
					{session.blessed ? "  ✦ blessed" : ""}
				</Text>
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
