import React from "react";
import { Text, useWindowDimensions } from "react-native";

/**
 * iOS Fabric can redraw mounted text at a new Dynamic Type size while keeping
 * its old measured frame (RN #57512). Renew only the native text node when the
 * system font scale changes, so Yoga measures it again. The surrounding button,
 * selection and screen state stay mounted; width-only changes keep the node.
 * Native font scaling, caller caps, refs and accessibility props pass through.
 */
export function DynamicTypeText(props: React.ComponentProps<typeof Text>) {
	const { fontScale } = useWindowDimensions();
	return <Text key={fontScale} {...props} />;
}

// Spec §1.2 scales text to 200%; an icon that rides a label stops there too.
const ICON_SCALE_CEILING = 2;

/**
 * How much an icon riding a label should grow with Dynamic Type: the system
 * font scale, never below 1, never past 2× (spec §1.2's 200%), and never past
 * the label's own `maxFontSizeMultiplier` when the control caps its words —
 * so a capped chrome button's mark stops exactly where its word does. A
 * 16pt icon beside a 34pt word at accessibility-large read as a speck (the Me
 * settings rows, the Share pill). Multiply an art size by it; it re-renders
 * when the text size changes. (2026-10-04, Me ask M-05)
 */
export function useIconScale(maxFontSizeMultiplier?: number): number {
	const { fontScale } = useWindowDimensions();
	// React Native ignores a cap below 1 (0 means "no cap"), and so does this.
	const cap =
		maxFontSizeMultiplier !== undefined && maxFontSizeMultiplier >= 1
			? Math.min(maxFontSizeMultiplier, ICON_SCALE_CEILING)
			: ICON_SCALE_CEILING;
	return Math.min(Math.max(fontScale || 1, 1), cap);
}
