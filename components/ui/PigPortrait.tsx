import { Image, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import type { PigId } from "@/utils/pigs";

// Roster portraits stay aligned to Rosie's canonical canvas and proportions.
// Recruitable pigs use either their matching animation frame or an explicitly
// approved authored master normalized to that same canvas.
const PIG_PORTRAITS: Record<PigId, number> = {
	rosie: require("../../assets/images/sprites/rosie/idle_1.png"),
	copper: require("../../assets/images/pigs/normalized/copper-v2.png"),
	pepper: require("../../assets/images/pigs/normalized/pepper-v2.png"),
	bandit: require("../../assets/images/pigs/normalized/bandit-v2.png"),
	pickles: require("../../assets/images/pigs/normalized/pickles-v2.png"),
	biscuit: require("../../assets/images/pigs/normalized/biscuit-v2.png"),
};

interface Props {
	pigId: PigId;
	size?: number;
	style?: StyleProp<ViewStyle>;
}

export function PigPortrait({ pigId, size = 300, style }: Props) {
	return (
		<View style={[{ width: size, height: size }, style]}>
			<Image
				source={PIG_PORTRAITS[pigId]}
				style={styles.fill}
				resizeMode="contain"
				fadeDuration={0}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	fill: {
		width: "100%",
		height: "100%",
	},
});
