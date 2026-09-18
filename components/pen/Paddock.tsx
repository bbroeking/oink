// The paddock — the sky Sticker the Pen opens on: a fenced yard with the
// pigs that are HOME standing in it. A pig that is out looking is absent
// (the note says so); the companion slot shows the recruited pig, or the
// friend being previewed before a recruit. The geometry is the hero the old
// Pen drew (2026-09-11); the pigs are live PigStages now, idling.
import { StyleSheet, View } from "react-native";
import { Hand, PigStage, Sticker } from "@/components/ui";
import { PIG_CANVAS } from "@/constants/hats";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import type { PigId } from "@/utils/pigs";

// ── Drawing constants ───────────────────────────────────────────────────────
// The Pen is a drawn scene — a fenced paddock with two pigs in it — so its
// geometry is art, not spacing.
/** The paddock and the pigs standing in it. */
export const HERO_H = 260;
export const HERO_PIG = 148;
/** The fence: overall height, the lower rail's drop, and one post. */
const FENCE_H = 74;
const FENCE_RAIL_DROP = 42;
const FENCE_POST_H = 70;

interface Props {
	/** Rosie, then the companion (or the previewed friend). */
	pigs: [PigId, PigId | null];
	/** Which of the two is out looking (absent from the yard). */
	out: PigId[];
	note: string;
	accessibilityLabel: string;
}

export function Paddock({ pigs, out, note, accessibilityLabel }: Props) {
	const motion = useMotionPolicy();
	const scale = HERO_PIG / PIG_CANVAS;
	return (
		<Sticker color="sky" rotate={0} style={styles.hero} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
			<View style={styles.sky} />
			<View style={styles.grass} />
			<View style={styles.fence} pointerEvents="none">
				<View style={[styles.fenceRail, styles.fenceRailTop]} />
				<View style={[styles.fenceRail, styles.fenceRailBottom]} />
				{[0, 1, 2, 3].map((post) => (
					<View key={post} style={styles.fencePost} />
				))}
			</View>
			<View style={styles.heroPigs} pointerEvents="none">
				{pigs.map((pigId, i) => (
					<View key={i} style={styles.heroPig}>
						{pigId && !out.includes(pigId) ? (
							<View style={styles.pigBox} testID={`paddock-pig-${pigId}`}>
								<View style={[styles.pigCanvas, { transform: [{ scale }] }]}>
									<PigStage
										pigId={pigId}
										pigAnimation="idle"
										pigFrozen={motion.reduceMotion}
										hideAccessory
									/>
								</View>
							</View>
						) : null}
					</View>
				))}
			</View>
			<Sticker color="paper" rotate={0} radius={RADII.sm} shadow="sm" border={BORDER.thin} style={styles.heroNote}>
				<Hand testID="paddock-note">{note}</Hand>
			</Sticker>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	hero: {
		height: HERO_H,
		marginTop: SPACE.md,
		overflow: "hidden",
	},
	sky: {
		...StyleSheet.absoluteFill,
		bottom: "34%",
		backgroundColor: WHIMSY.sky,
	},
	grass: {
		position: "absolute",
		left: 0,
		right: 0,
		bottom: 0,
		height: "38%",
		backgroundColor: WHIMSY.sage,
	},
	fence: {
		position: "absolute",
		left: SPACE.sm,
		right: SPACE.sm,
		bottom: SPACE.xl,
		height: FENCE_H,
		flexDirection: "row",
		justifyContent: "space-between",
	},
	fenceRail: {
		position: "absolute",
		left: 0,
		right: 0,
		height: SPACE.sm,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.cream2,
	},
	fenceRailTop: { top: SPACE.md },
	fenceRailBottom: { top: FENCE_RAIL_DROP },
	fencePost: {
		width: SPACE.md,
		height: FENCE_POST_H,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.cream,
	},
	heroPigs: {
		position: "absolute",
		left: SPACE.sm,
		right: SPACE.sm,
		bottom: SPACE.xs,
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
	},
	heroPig: { width: "47%", alignItems: "center" },
	pigBox: { width: HERO_PIG, height: HERO_PIG },
	// The 300pt stage scaled to HERO_PIG about its top-left, so the box is the
	// pig's box (the RewardReturn stage's idiom).
	pigCanvas: {
		position: "absolute",
		left: 0,
		top: 0,
		width: PIG_CANVAS,
		height: PIG_CANVAS,
		transformOrigin: "top left",
	},
	heroNote: {
		position: "absolute",
		alignSelf: "center",
		bottom: SPACE.sm,
		paddingHorizontal: SPACE.md,
		paddingVertical: SPACE.xs,
	},
});
