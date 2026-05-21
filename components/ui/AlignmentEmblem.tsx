// Raster alignment emblem — the halo / scales / horns art.
// Replaces the interim SVG icons. `kind` is the visual; callers
// derive it from an alignment label (utils/alignment alignmentIcon)
// or a finale side (JudgementDayModal sideIcon).
import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";

const IMAGES = {
	halo: require("../../assets/images/alignment/generous.png"),
	scales: require("../../assets/images/alignment/pilgrim.png"),
	horns: require("../../assets/images/alignment/greedy.png"),
} as const;

export type AlignmentEmblemKind = keyof typeof IMAGES;

interface Props {
	kind: AlignmentEmblemKind;
	size?: number;
	style?: StyleProp<ImageStyle>;
}

export function AlignmentEmblem({ kind, size = 24, style }: Props) {
	return (
		<Image
			source={IMAGES[kind]}
			style={[{ width: size, height: size }, style]}
			resizeMode="contain"
		/>
	);
}
