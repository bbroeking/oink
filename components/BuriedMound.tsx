// A buried truffle is a THING IN THE YARD, so it shows as one: a little mound of
// earth bottom-left on Rosie's ground plane with the truffle's cap showing.
// Diegetic accessories are allowed for things in the yard, never for actions
// (taste-standard, 2026-09-13) — the act of burying lives in the Barn button's
// fan; this is only what it left behind.
//
// COLLAPSED BY DEFAULT. The mound stands alone, no tag, so the yard stays a
// painting. Tap it and a paper tag unfolds BESIDE it with what is down there —
// "3 snouts buried" — and that tag is the way into the buried-truffle sheet.
// Tap the mound again and the tag folds. Nothing here fires a sheet on the
// first tap. The tag sits to the right, not under: the yard anchors this by
// its bottom-left corner, so a tag underneath would shove the mound off the
// ground line the moment it unfolded.
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
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
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { POP_IN_SPRING } from "@/utils/motionRecipes";

// --- ART -------------------------------------------------------------------
// The mound's drawing, in points.
const MOUND_W = 54;
const MOUND_H = 24;
// The truffle poking out of it, and how far its cap rises above the crown.
const TRUFFLE = 26;
const TRUFFLE_LIFT = -16;
const TAG_TILT = "-2deg";
// How far the tag slides into place from the mound's side as it unfolds.
const TAG_SLIDE = -6;

interface Props {
	/** Snouts still in the pot for visitors to dig. */
	remaining: number;
	/** The tag's tap: check on the truffle (the buried-truffle sheet). */
	onPress: () => void;
}

/** "3 snouts buried" / "1 snout buried". */
export function buriedSnoutsCopy(remaining: number): string {
	return `${remaining} ${remaining === 1 ? "snout" : "snouts"} buried`;
}

export function BuriedMound({ remaining, onPress }: Props) {
	const motion = useMotionPolicy();
	const [shown, setShown] = useState(false);
	const unfold = useRef(new Animated.Value(0)).current;
	const snouts = buriedSnoutsCopy(remaining);

	// The tag springs up when the mound is tapped and eases away on the next
	// tap. Under Reduce Motion it fades in place.
	useEffect(() => {
		const to = shown ? 1 : 0;
		(motion.reduceMotion || !shown
			? Animated.timing(unfold, {
					toValue: to,
					duration: motion.duration(MOTION_DURATION.state, MOTION_DURATION.crossfade),
					useNativeDriver: true,
				})
			: Animated.spring(unfold, {
					toValue: to,
					...POP_IN_SPRING,
					useNativeDriver: true,
				})
		).start();
	}, [shown, unfold, motion]);

	const toggle = () => {
		Haptics.selectionAsync().catch(() => {});
		setShown((s) => !s);
	};
	const check = () => {
		Haptics.selectionAsync().catch(() => {});
		onPress();
	};

	return (
		<View style={styles.spot}>
			<Pressable
				onPress={toggle}
				hitSlop={SPACE.sm}
				accessibilityRole="button"
				accessibilityLabel="Your buried truffle"
				accessibilityValue={{ text: snouts }}
				accessibilityState={{ expanded: shown }}
				accessibilityHint={shown ? "Folds the tag away" : "Shows how many snouts are buried here"}
				style={({ pressed }) => [styles.mound, pressed && styles.pressed]}
			>
				<View style={styles.truffle}>
					<Glyph name="truffle" size={TRUFFLE} />
				</View>
			</Pressable>
			{/* The tag is only in the tree while shown, so a folded mound never
			    holds an invisible tap target over the yard. */}
			{shown ? (
				<Animated.View
					style={{
						opacity: unfold,
						transform: [
							{ translateX: unfold.interpolate({ inputRange: [0, 1], outputRange: [TAG_SLIDE, 0] }) },
						],
					}}
				>
					<Pressable
						onPress={check}
						hitSlop={SPACE.xs}
						accessibilityRole="button"
						accessibilityLabel={snouts}
						accessibilityHint="Opens the buried-truffle sheet, where you can add snouts or dig it back up"
						style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
					>
						<Hand numberOfLines={1}>{snouts}</Hand>
						<Hand tone="secondary" numberOfLines={1}>
							check on it ›
						</Hand>
					</Pressable>
				</Animated.View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	// A row: the mound planted at the left, the tag hanging off its shoulder.
	spot: {
		flexDirection: "row",
		alignItems: "flex-end",
		gap: SPACE.sm,
	},
	pressed: {
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
		alignItems: "flex-start",
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.xxs,
		borderRadius: RADII.sm,
		borderWidth: BORDER.ink,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.paper,
		transform: [{ rotate: TAG_TILT }],
		...SHADOW_SM,
	},
});
