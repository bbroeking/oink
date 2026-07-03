// The Hungerer's stage, as a small chip for the war screen's header zone —
// "He's Peckish." — so every war visibly connects to the season boss. Styled
// after FrontBoard's weather modChip so the two chips read as siblings.
// EXPORT-ONLY: the parent (app/mud-war.tsx) mounts it; see
// docs/mudwar-ui-integration.md.

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
