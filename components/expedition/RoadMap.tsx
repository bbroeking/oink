import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import {
	RADII,
	SPACE,
	STICKER_SHADOW,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
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
		const colStride = DOT + 12 + SPACE.sm; // stopCol width + row gap
		const center = SPACE.xs + idx * colStride + (DOT + 12) / 2;
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
								<Text style={styles.num}>{seg.segment}</Text>
							)}
						</View>
						{here && <Text style={styles.pigTag}>Rosie</Text>}
						{wall && (
							<Text style={styles.stopLabel}>
								{defeated ? "cleared" : wall.name}
							</Text>
						)}
						{bramble && (
							<Text style={styles.stopLabel}>
								Cushion {BRAMBLE_CUSHION_ASK}
							</Text>
						)}
						{seg.segment === CHAPTER_END && !wall && (
							<Text style={styles.stopLabel}>end</Text>
						)}
					</View>
				);
			})}
		</ScrollView>
	);
}

const DOT = 48;
const styles = StyleSheet.create({
	track: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: SPACE.sm,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.xs,
	},
	stopCol: { alignItems: "center", width: DOT + 12 },
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
	},
	dotDone: { backgroundColor: WHIMSY.sage },
	dotHere: { backgroundColor: WHIMSY.sun, ...STICKER_SHADOW },
	num: { ...TYPE.numeral, color: UI_COLORS.textSecondary },
	pigTag: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.action,
		marginTop: 3,
	},
	// A mixed-case caption (enemy names, "cleared", "Cushion 3", "end") — reads as
	// small body text, NOT a tracked uppercase pill, so it stays bodySm. The 10px
	// is deliberate (a caption tighter than bodySm's 13) and left as-is.
	stopLabel: {
		...TYPE.bodySm,
		fontSize: 11,
		color: UI_COLORS.textSecondary,
		marginTop: 2,
		maxWidth: DOT + 10,
		textAlign: "center",
	},
});
