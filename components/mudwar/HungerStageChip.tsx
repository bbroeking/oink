// The Hungerer's stage, as a small chip — "He's Peckish." — so a season
// surface visibly connects to the boss. EXPORT-ONLY: a parent mounts it.

import { View, Text, StyleSheet } from "react-native";
import { FONTS, WHIMSY } from "@/constants/theme";
import type { HungerStage } from "@/hooks/useHungerMeter";

const STAGE_SHORT: Record<HungerStage, string> = {
	gorged: "He's Gorged.",
	stuffed: "He's Stuffed.",
	full: "He's Full.",
	peckish: "He's Peckish.",
	hungry: "He's Hungry.",
	famished: "He's Famished.",
};

export function HungerStageChip({ stage }: { stage: HungerStage }) {
	return (
		<View style={styles.chip}>
			<Text style={styles.text}>{STAGE_SHORT[stage]}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	chip: {
		alignSelf: "center",
		backgroundColor: WHIMSY.peach,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		borderRadius: 10,
		paddingHorizontal: 10,
		paddingVertical: 3,
	},
	text: { fontFamily: FONTS.hand, fontSize: 12, color: WHIMSY.ink },
});
