// A buried truffle is a THING IN THE YARD, so it shows as one: a little mound of
// earth bottom-left on Rosie's ground plane with the truffle's cap showing and
// a paper tag under it. Diegetic accessories are allowed for things in the
// yard, never for actions (taste-standard, 2026-09-13) — the act of burying
// lives in the Barn button's fan; this is only what it left behind. Tap to
// check on it (the buried-truffle sheet).
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph, Hand } from "./ui";
import {
	BORDER,
	PRESSED,
	RADII,
	SHADOW_SM,
	SPACE,
	WHIMSY,
} from "@/constants/theme";

// --- ART -------------------------------------------------------------------
// The mound's drawing, in points.
const MOUND_W = 54;
const MOUND_H = 24;
// The truffle poking out of it, and how far its cap rises above the crown.
const TRUFFLE = 26;
const TRUFFLE_LIFT = -16;
const TAG_TILT = "-2deg";

interface Props {
	/** Snouts still in the pot for visitors to dig. */
	remaining: number;
	onPress: () => void;
}

export function BuriedMound({ remaining, onPress }: Props) {
	const snouts = `${remaining} ${remaining === 1 ? "snout" : "snouts"} left`;
	return (
		<Pressable
			onPress={() => {
				Haptics.selectionAsync().catch(() => {});
				onPress();
			}}
			hitSlop={SPACE.sm}
			accessibilityRole="button"
			accessibilityLabel="Your buried truffle"
			accessibilityValue={{ text: snouts }}
			accessibilityHint="Opens the buried-truffle sheet, where you can add snouts or dig it back up"
			style={({ pressed }) => [styles.spot, pressed && styles.spotPressed]}
		>
			<View style={styles.mound}>
				<View style={styles.truffle}>
					<Glyph name="truffle" size={TRUFFLE} />
				</View>
			</View>
			<View style={styles.tag}>
				<Hand numberOfLines={1}>one buried</Hand>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	spot: {
		alignItems: "center",
		gap: SPACE.xs,
	},
	spotPressed: {
		...PRESSED,
		elevation: 0,
	},
	mound: {
		width: MOUND_W,
		height: MOUND_H,
		borderRadius: RADII.pill,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.bark,
		...SHADOW_SM,
	},
	truffle: {
		position: "absolute",
		top: TRUFFLE_LIFT,
		alignSelf: "center",
	},
	tag: {
		paddingHorizontal: SPACE.sm,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		transform: [{ rotate: TAG_TILT }],
		...SHADOW_SM,
	},
});
