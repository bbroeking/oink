// The visit screen's bottom band: ONE secondary action, or nothing.
//
// The slot lives under the scene, and what it says is a pure function of where
// the visit is:
//
//   tickled out → "Head home"  (the exit)
//   otherwise   →  nothing
//
// (The guestbook's "Leave a hoofprint" used to share this slot; the feature was
// retired 2026-09-12.)
//
// The bar keeps its height either way. A pill that appears by pushing the barn
// up the screen reads as the layout breaking; it fades in over reserved space
// instead, through the motion policy — so under Reduce Motion it simply is or
// isn't there.
import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { PAGE_PAD, SPACE, TAP_MIN } from "@/constants/theme";
import { MOTION_DURATION, useMotionPolicy } from "@/hooks/useMotionPolicy";
import { VISIT_TYPE_CAP } from "./chrome";

// How far the pill floats above the home indicator. A drawing offset against a
// device inset, not a step on the spacing scale.
const BAR_FLOAT = SPACE.md;

type Action = { label: "Head home"; testID: "visit-head-home" } | null;

/** What the one slot says, given where the visit is. Pure, so it is testable
 *  without a renderer. The header's Leave pill is always the way out; this slot
 *  offers the exit once the pigs are tickled out. */
export function visitAction({ tired }: { tired: boolean }): Action {
	if (tired) return { label: "Head home", testID: "visit-head-home" };
	return null;
}

export function VisitActionBar({
	tired,
	hidden,
	onHeadHome,
}: {
	tired: boolean;
	/** Arriving at a sleeping barn: the nap card owns the only way out. */
	hidden?: boolean;
	onHeadHome: () => void;
}) {
	const insets = useSafeAreaInsets();
	const policy = useMotionPolicy();
	const action = hidden ? null : visitAction({ tired });
	// `useState` rather than `useRef` so the driver is created once without the
	// component reading a ref during render.
	const [opacity] = useState(() => new Animated.Value(action ? 1 : 0));
	const shown = !!action;

	useEffect(() => {
		Animated.timing(opacity, {
			toValue: shown ? 1 : 0,
			duration: policy.duration(MOTION_DURATION.state),
			useNativeDriver: true,
		}).start();
	}, [opacity, policy, shown]);

	return (
		<View
			pointerEvents="box-none"
			style={[styles.bar, { paddingBottom: insets.bottom + BAR_FLOAT }]}
		>
			<Animated.View
				pointerEvents={action ? "auto" : "none"}
				style={[styles.slot, { opacity }]}
			>
				{action ? (
					<Button
						variant="gold"
						full
						testID={action.testID}
						onPress={onHeadHome}
						maxFontSizeMultiplier={VISIT_TYPE_CAP}
						accessibilityLabel={action.label}
						accessibilityHint="Ends this visit and returns to your Barn"
					>
						{action.label}
					</Button>
				) : null}
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	bar: {
		paddingHorizontal: PAGE_PAD,
		paddingTop: SPACE.md,
	},
	// The slot holds its height whether or not it holds a button, so the scene
	// above never jumps.
	slot: { minHeight: TAP_MIN, justifyContent: "center" },
});
