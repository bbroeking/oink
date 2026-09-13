// The page indicator — "which of these am I looking at". [wave 4, E-ask]
//
// Three silent squares are not an indicator; a progressbar that says "2 of 3"
// is. The storybook drew this by hand (`Onboarding.tsx`), and every future
// pager would have drawn it again, slightly differently — so the dots, their
// gap, the active lozenge and the announcement live here once.
//
// The active dot stretches rather than only changing color: position is the
// thing being communicated, and a length reads at a glance where a hue does not
// (and survives a color-blind viewer).
import React from "react";
import {
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { RADII, SPACE, TAP_MIN, UI_COLORS, WHIMSY } from "@/constants/theme";

// The dot's own geometry: a square that the pill radius rounds into a dot, and
// the width the current one stretches to. A length, not a spacing step — hence
// named here rather than read as SPACE at the point of use. (2026-09-11)
const DOT = SPACE.sm;
const DOT_ACTIVE_WIDTH = SPACE.xl;

export interface PageDotsProps {
	/** How many pages the pager holds. */
	count: number;
	/** The current page, zero-based. */
	index: number;
	/** What the pager is, spoken before the position ("Introduction page"). */
	label?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * `<PageDots count={3} index={page} label="Introduction page" />` — announces
 * as a progressbar reading "2 of 3". (2026-09-11)
 */
export function PageDots({ count, index, label, testID, style }: PageDotsProps) {
	const position = `${Math.min(Math.max(index, 0), Math.max(count - 1, 0)) + 1} of ${count}`;
	return (
		<View
			style={[styles.row, style]}
			testID={testID}
			accessibilityRole="progressbar"
			accessibilityLabel={label ? `${label}, ${position}` : position}
			accessibilityValue={{ min: 1, max: count, now: index + 1 }}
		>
			{Array.from({ length: count }, (_, i) => (
				<View key={i} style={[styles.dot, i === index && styles.dotActive]} />
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: SPACE.xs,
		// The indicator is not tappable, but it holds the same band a control
		// would, so a pager's chrome doesn't jump when it appears.
		minHeight: TAP_MIN,
	},
	dot: {
		width: DOT,
		height: DOT,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.uiMuted,
	},
	dotActive: {
		width: DOT_ACTIVE_WIDTH,
		backgroundColor: WHIMSY.ink,
	},
});
