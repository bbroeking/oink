// A buried truffle is a THING IN THE YARD, so it shows as one: a little mound of
// earth bottom-left on Rosie's ground plane with the truffle's cap showing.
// Diegetic accessories are allowed for things in the yard, never for actions
// (taste-standard, 2026-09-13) — the act of burying lives in the Barn button's
// fan; this is only what it left behind.
//
// COLLAPSED BY DEFAULT. The mound stands alone, no tag, so the yard stays a
// painting. Tap it and a paper tag unfolds ABOVE it with what is down there —
// "3 snouts buried" — and that tag is the way into the buried-truffle sheet.
// Tap the mound again and the tag folds. Nothing here fires a sheet on the
// first tap. The tag stands over the mound, never beside it: the yard anchors
// this spot by its bottom-left corner, so a tag above grows upward and the
// mound never leaves the ground line — and a tag to the right sat on Rosie's
// front leg and half her bandana (polish 2026-10-04, B-07). Above, it reads as
// the mound's own sign, the way the Barn button's word sits over the button.
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Glyph, Hand } from "./ui";
import {
	BORDER,
	CHROME_TYPE_CAP,
	PRESSED,
	RADII,
	SHADOW_SM,
	SPACE,
	TAP_MIN,
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
// How far the tag rises into place over the mound as it unfolds.
const TAG_RISE = 6;
// The truffle's cap pokes TRUFFLE_LIFT above the mound's crown, so the tag
// stands that much higher again to clear it.
const CAP_CLEARANCE = -TRUFFLE_LIFT;
// The mound is a 54x24 drawing; its touch frame comes back to TAP_MIN as
// hitSlop, never by inflating the mound.
const MOUND_HIT = {
	top: (TAP_MIN - MOUND_H) / 2,
	bottom: (TAP_MIN - MOUND_H) / 2,
	left: SPACE.sm,
	right: SPACE.sm,
};

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
			{/* The tag is only in the tree while shown, so a folded mound never
			    holds an invisible tap target over the yard. */}
			{shown ? (
				<Animated.View
					style={[
						styles.tagSeat,
						{
							opacity: unfold,
							transform: [
								{ translateY: unfold.interpolate({ inputRange: [0, 1], outputRange: [TAG_RISE, 0] }) },
							],
						},
					]}
				>
					<Pressable
						onPress={check}
						hitSlop={SPACE.xs}
						accessibilityRole="button"
						accessibilityLabel={snouts}
						accessibilityHint="Opens the buried-truffle sheet, where you can add snouts or dig it back up"
						style={({ pressed }) => [styles.tag, pressed && styles.pressed]}
					>
						<Hand numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							{snouts}
						</Hand>
						<Hand tone="secondary" numberOfLines={1} maxFontSizeMultiplier={CHROME_TYPE_CAP}>
							check on it ›
						</Hand>
					</Pressable>
				</Animated.View>
			) : null}
			<Pressable
				onPress={toggle}
				hitSlop={MOUND_HIT}
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
		</View>
	);
}

const styles = StyleSheet.create({
	// A column anchored at its foot: the tag on top, the mound planted under it
	// on the ground line, both hung off the spot's left edge.
	spot: {
		alignItems: "flex-start",
		gap: SPACE.xs,
	},
	// The tag stands clear of the truffle's cap, which overhangs the mound.
	tagSeat: {
		marginBottom: CAP_CLEARANCE,
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
