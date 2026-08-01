import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { ZOOMIES_MAX } from "@/utils/expedition";

// The Zoomies charge — a FEELING, not a number. Drawn as a row of hand-authored
// ink sparks (the EnemySilhouette style) that light up progressively as she
// charges; the last one is the burst. No numeric readout anywhere — the charge
// level is spoken in words to screen readers instead.
//
// One concave 4-point spark, viewBox 0 0 24 24.
const SPARK_PATH =
	"M12 2 C13 8 16 11 22 12 C16 13 13 16 12 22 C11 16 8 13 2 12 C8 11 11 8 12 2 Z";

// The charge, in words — since the visible number is gone, this is what a screen
// reader announces and the tiny caption reads.
export function zoomiesLabel(value: number): string {
	if (value <= 0) return "Zoomies resting";
	if (value < Math.ceil(ZOOMIES_MAX / 2)) return "Zoomies stirring";
	if (value < ZOOMIES_MAX) return "Zoomies nearly bursting";
	return "Zoomies ready to burst";
}

function Spark({ lit }: { lit: boolean }) {
	return (
		<Svg width={20} height={20} viewBox="0 0 24 24">
			<Path
				d={SPARK_PATH}
				fill={lit ? WHIMSY.roseDeep : WHIMSY.paper}
				stroke={WHIMSY.ink}
				strokeWidth={1.5}
				strokeLinejoin="round"
				opacity={lit ? 1 : 0.5}
			/>
		</Svg>
	);
}

export function ZoomiesMeter({ value }: { value: number }) {
	const label = zoomiesLabel(value);
	return (
		<View
			style={styles.wrap}
			accessibilityRole="progressbar"
			accessibilityLabel={label}
		>
			<Text style={styles.title}>ZOOMIES</Text>
			<View style={styles.sparks}>
				{Array.from({ length: ZOOMIES_MAX }).map((_, i) => (
					<Spark key={i} lit={i < value} />
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { gap: SPACE.xs },
	title: { ...TYPE.kickerPill, color: UI_COLORS.action },
	sparks: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
});
