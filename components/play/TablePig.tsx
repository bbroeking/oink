// One pig as a table draws it: the seat's look (utils/multiplayer/looks) on a
// PigStage scaled into a square box, standing on its own contact shadow.
// A living surface (taste standard 2026-07-16): the stage tracks the live
// sprite frame so a worn hat rides the breathing pig. `facing` turns it
// toward a friend (the visit's three-quarter turn); a mood is held, a
// reaction plays once. Decorative to a screen reader: the seat around it
// says who it is.

import { useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { PigStage, type PigReaction, type PigStageProps } from "@/components/ui";
import { RADII, TINT } from "@/constants/theme";
import type { PigLook } from "@/multiplayer/protocol";
import { pigStagePropsForLook } from "@/utils/multiplayer/looks";
import { SHADOW_FRAC, STAGE } from "./layout";

// The contact shadow's height: a squashed ellipse under the hooves.
const SHADOW_H = 8;

export interface TablePigProps {
	look: PigLook | null | undefined;
	/** The square box the pig is drawn into, in points. */
	size: number;
	facing?: PigStageProps["facing"];
	mood?: "content" | "happy" | "sad" | "tired";
	reaction?: PigReaction | null;
	onReactionDone?: () => void;
	/** Hold the rest frame (Reduce Motion, a list avatar). */
	frozen?: boolean;
	style?: StyleProp<ViewStyle>;
	testID?: string;
}

export function TablePig({ look, size, facing, mood = "content", reaction = null, onReactionDone, frozen = false, style, testID }: TablePigProps) {
	const [frame, setFrame] = useState(0);
	const stage = pigStagePropsForLook(look);
	const shadowW = size * SHADOW_FRAC;
	return (
		<View
			pointerEvents="none"
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[{ width: size, height: size }, style]}
			testID={testID}
		>
			<View style={[styles.shadow, { width: shadowW, left: (size - shadowW) / 2 }]} />
			<View style={[styles.stage, { left: (size - STAGE) / 2, top: (size - STAGE) / 2, transform: [{ scale: size / STAGE }] }]}>
				<PigStage
					{...stage}
					facing={facing}
					pigAnimation="idle"
					pigMood={mood}
					pigReaction={reaction}
					onPigComplete={onReactionDone}
					pigFrozen={frozen}
					pigFrameIdx={frozen ? 0 : frame}
					onPigFrame={setFrame}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	shadow: {
		position: "absolute",
		bottom: 0,
		height: SHADOW_H,
		borderRadius: RADII.pill,
		backgroundColor: TINT.well,
	},
	stage: {
		position: "absolute",
		width: STAGE,
		height: STAGE,
	},
});
