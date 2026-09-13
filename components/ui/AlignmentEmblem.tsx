// Raster alignment emblem — the halo / scales / horns art.
// Replaces the interim SVG icons. `kind` is the visual; callers
// derive it from an alignment label (utils/alignment alignmentIcon)
// or a finale side (JudgementDayModal sideIcon).
//
// Decorative by contract: the emblem always rides a surface that already
// announces the standing (AlignmentBadge's label, AlignmentBar's
// accessibilityValue), so it never stops VoiceOver on its own. [B-04]
// (2026-09-11)
import React from "react";
import { Image, ImageStyle, StyleProp } from "react-native";
import { ART_SIZE } from "@/constants/theme";

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

export function AlignmentEmblem({
	kind,
	size = ART_SIZE.glyphSm,
	style,
}: Props) {
	return (
		<Image
			source={IMAGES[kind]}
			style={[{ width: size, height: size }, style]}
			resizeMode="contain"
			accessible={false}
		/>
	);
}
