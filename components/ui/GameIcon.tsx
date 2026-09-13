import React, { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import {
	FRIEND_ACTION_ICON_XML,
	type FriendActionIconName,
} from "@/constants/friendActionIcons.generated";
import { UI_COLORS, WHIMSY } from "@/constants/theme";

export type GameIconName = FriendActionIconName;

function mutedXml(xml: string): string {
	return xml
		.replace(/\bfill=(['"])(?!none\1)[^'"]*\1/gi, `fill="${WHIMSY.cream2}"`)
		.replace(/\bstroke=(['"])(?!none\1)[^'"]*\1/gi, `stroke="${UI_COLORS.textDisabled}"`);
}

/** Shared storybook action art. The containing control supplies its accessible label. */
export function GameIcon({
	name,
	size = 24,
	muted = false,
	style,
}: {
	name: GameIconName;
	size?: number;
	muted?: boolean;
	style?: StyleProp<ViewStyle>;
}) {
	const source = FRIEND_ACTION_ICON_XML[name];
	const xml = useMemo(() => (muted ? mutedXml(source) : source), [muted, source]);

	return (
		<View
			accessible={false}
			accessibilityElementsHidden
			importantForAccessibility="no"
			style={[{ width: size, height: size, flexShrink: 0 }, style]}
		>
			<SvgXml xml={xml} width={size} height={size} accessible={false} />
		</View>
	);
}
