// The six-stage Hunger meter — Gorged … Famished as six ink-outlined blocks:
// sage for every stage the herd has starved him through, sun for the one he is
// at, paper for the ones ahead, and a dashed outline on the last so the finish
// line reads as a finish line. Hand labels under each block; the current stage
// is written in ink, the rest in mute. The stage is a feeling, so the meter is
// worded, never numbered (announceValue stays off, the wrapper says the words).

import { StyleSheet, View } from "react-native";
import { T } from "@/components/ui";
import { BORDER, RADII, SPACE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { HUNGER_LEVEL_NAME, HUNGER_STAGES } from "@/hooks/useHungerMeter";

// Drawing geometry — the height of one stage block.
const BLOCK_H = 14;

export interface StageMeterProps {
	/** 0 (Gorged) … 5 (Famished). */
	stageIndex: number;
	testID?: string;
}

export function StageMeter({ stageIndex, testID }: StageMeterProps) {
	const current = Math.max(0, Math.min(HUNGER_STAGES.length - 1, stageIndex));
	const remaining = HUNGER_STAGES.length - 1 - current;
	return (
		<View
			accessible
			accessibilityLabel={`The Hungerer is ${HUNGER_LEVEL_NAME[HUNGER_STAGES[current]]}. ${remaining} ${remaining === 1 ? "stage" : "stages"} to Famished.`}
			testID={testID}
		>
			<View style={styles.blocks}>
				{HUNGER_STAGES.map((stage, i) => {
					const done = i < current;
					const here = i === current;
					const last = i === HUNGER_STAGES.length - 1;
					return (
						<View
							key={stage}
							style={[
								styles.block,
								done && styles.blockDone,
								here && styles.blockHere,
								last && !done && !here && styles.blockLast,
							]}
						/>
					);
				})}
			</View>
			<View style={styles.labels}>
				{HUNGER_STAGES.map((stage, i) => (
					<T
						key={stage}
						role="kicker"
						tone={i === current ? "primary" : "secondary"}
						align="center"
						numberOfLines={1}
						style={styles.label}
					>
						{HUNGER_LEVEL_NAME[stage]}
					</T>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	blocks: {
		flexDirection: "row",
		gap: SPACE.xs,
	},
	block: {
		flex: 1,
		height: BLOCK_H,
		borderRadius: RADII.hair,
		borderWidth: BORDER.thin,
		borderColor: UI_COLORS.border,
		backgroundColor: UI_COLORS.surface,
	},
	blockDone: { backgroundColor: WHIMSY.sage },
	blockHere: { backgroundColor: WHIMSY.sun, borderWidth: BORDER.ink },
	blockLast: { borderStyle: "dashed", borderColor: UI_COLORS.uiMuted },
	labels: {
		flexDirection: "row",
		gap: SPACE.xs,
		marginTop: SPACE.xs,
	},
	label: { flex: 1, minWidth: 0 },
});
