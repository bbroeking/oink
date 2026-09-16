// The chalkboard by the door — it says when the shelves restock (Storefront
// build 2, 2026-09-16). A bark sticker with the sun kicker the bark token
// prescribes, the countdown in the big numeral, leaning the way a board on a
// nail leans.
import { StyleSheet } from "react-native";
import { RADII, SPACE, TILT } from "@/constants/theme";
import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

export function Chalkboard({ countdown }: { countdown: string }) {
	return (
		<Sticker
			color="bark"
			radius={RADII.md}
			rotate={TILT.reveal}
			accessibilityRole="text"
			accessibilityLabel={`Shelves restock in ${countdown}`}
			style={styles.board}
		>
			<T role="kickerPillSm" tone="onDarkAccent">
				★ back at sunrise
			</T>
			<T role="numeralLg" tone="onDark">
				{countdown}
			</T>
		</Sticker>
	);
}

const styles = StyleSheet.create({
	board: {
		alignSelf: "flex-start",
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
		gap: SPACE.xxs,
	},
});
