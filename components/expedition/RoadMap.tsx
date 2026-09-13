import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import {
	BORDER,
	RADII,
	SPACE,
	STICKER_SHADOW,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { T } from "@/components/ui/Text";
import { useMotionPolicy } from "@/hooks/useMotionPolicy";
import {
	CHAPTER_END,
	ENEMIES,
	ROAD,
	BRAMBLE_SEGMENT,
	BRAMBLE_CUSHION_ASK,
	type ExpeditionState,
} from "@/utils/expedition";
import { EnemySilhouette, type SilhouetteId } from "./EnemySilhouette";

// The 12-segment chapter road: a horizontal path of stops with the pig's
// position marked, walls shown as ink silhouettes, and the Bramble Cushion gate
// flagged. Scrolls horizontally, auto-centering Rosie's current segment so she is
// never off-screen after a walk. (Task 5c.)
export function RoadMap({ state }: { state: ExpeditionState }) {
	const policy = useMotionPolicy();
	const scrollRef = useRef<ScrollView>(null);
	const [viewW, setViewW] = useState(0);

	// Segment 0 (the trailhead) maps to the first stop; otherwise centre her stop.
	const idx = Math.max(0, state.segment - 1);
	useEffect(() => {
		if (viewW <= 0) return;
		const center = TRACK_INSET + idx * COL_STRIDE + COL_W / 2;
		const x = Math.max(0, center - viewW / 2);
		scrollRef.current?.scrollTo({ x, animated: !policy.reduceMotion });
	}, [idx, viewW, policy.reduceMotion]);

	return (
		<ScrollView
			ref={scrollRef}
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.track}
			onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
		>
			{ROAD.map((seg) => {
				const here = state.segment === seg.segment;
				const done = state.segment > seg.segment;
				const wall = seg.wallEnemyId ? ENEMIES[seg.wallEnemyId] : null;
				const defeated =
					seg.wallEnemyId && state.bestiary[seg.wallEnemyId] === "defeated";
				const bramble = seg.segment === BRAMBLE_SEGMENT;
				return (
					<View key={seg.segment} style={styles.stopCol}>
						<View
							style={[
								styles.dot,
								done && styles.dotDone,
								here && styles.dotHere,
							]}
						>
							{wall ? (
								<EnemySilhouette
									id={seg.wallEnemyId as SilhouetteId}
									size={34}
									defeated={!!defeated}
								/>
							) : bramble ? (
								<EnemySilhouette id="the_bramble" size={34} />
							) : (
								<T role="numeral" tone="secondary">
									{seg.segment}
								</T>
							)}
						</View>
						{here && (
							<T role="kickerPillSm" tone="accent" style={styles.pigTag}>
								Rosie
							</T>
						)}
						{wall && (
							<T role="kicker" tone="secondary" align="center" style={styles.stopLabel}>
								{defeated ? "cleared" : wall.name}
							</T>
						)}
						{bramble && (
							<T role="kicker" tone="secondary" align="center" style={styles.stopLabel}>
								Cushion {BRAMBLE_CUSHION_ASK}
							</T>
						)}
						{seg.segment === CHAPTER_END && !wall && (
							<T role="kicker" tone="secondary" align="center" style={styles.stopLabel}>
								end
							</T>
						)}
					</View>
				);
			})}
		</ScrollView>
	);
}

// Track geometry. These are MEASUREMENTS of the drawing below — what the
// auto-centre scroll has to know about the row it is scrolling — not spacing
// decisions, so the gap and the edge inset are read once from the scale here
// and the styles below consume the same names. Keeping them in one place is
// what stops the maths and the layout drifting apart.
const DOT = 48;
const DOT_GUTTER = 12;
const COL_W = DOT + DOT_GUTTER;
const STOP_GAP = SPACE.sm;
const TRACK_INSET = SPACE.xs;
const COL_STRIDE = COL_W + STOP_GAP;
// The caption under a stop wraps inside its own column, a hair narrower.
const LABEL_MAX_W = DOT + 10;

const styles = StyleSheet.create({
	track: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: STOP_GAP,
		paddingVertical: SPACE.sm,
		paddingHorizontal: TRACK_INSET,
	},
	stopCol: { alignItems: "center", width: COL_W },
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: RADII.md,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	dotDone: { backgroundColor: WHIMSY.sage },
	dotHere: { backgroundColor: WHIMSY.sun, ...STICKER_SHADOW },
	pigTag: {
		marginTop: SPACE.xxs,
	},
	// A mixed-case caption (enemy names, "cleared", "Cushion 3", "end"). It is a
	// caption in the hand voice, NOT a tracked uppercase pill — `kicker` is that
	// role, and it reads a step smaller than body at the same size.
	stopLabel: {
		marginTop: SPACE.xxs,
		maxWidth: LABEL_MAX_W,
	},
});
