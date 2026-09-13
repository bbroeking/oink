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
