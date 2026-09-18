// The chalkboard by the door — it says when the shelves restock (Storefront
// build 2, 2026-09-16). A bark sticker with the sun kicker the bark token
// prescribes, the countdown in the big numeral, leaning the way a board on a
// nail leans.
import { StyleSheet } from "react-native";
import { RADII, SPACE, TILT } from "@/constants/theme";

import { Sticker } from "../ui/Sticker";
import { T } from "../ui/Text";

/**
 * The caps line's Dynamic Type ceiling. The board sits in a fixed-height row
 * beside three signs; past this it stops growing and the countdown keeps the
 * line. (The visit chrome's 1.3 cap, same reason.)
 */
const BOARD_TYPE_CAP = 1.2;

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
			<T
				role="kickerPillSm"
				tone="onDarkAccent"
				numberOfLines={1}
				maxFontSizeMultiplier={BOARD_TYPE_CAP}
			>
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
		// The board is the doorway row's one shrinkable child: the three signs
		// state their width, and whatever is left is the board's. Without these
		// its caps line measured at content width and pushed the signs out of
		// the row. (2026-09-17)
		flexShrink: 1,
		minWidth: 0,
		paddingVertical: SPACE.sm,
		paddingHorizontal: SPACE.md,
		gap: SPACE.xxs,
	},
});
