import React from "react";
import { View, ViewStyle, StyleProp, StyleSheet } from "react-native";
import { WHIMSY, STICKER_SHADOW } from "@/constants/theme";

type StickerColor =
	| "paper"
	| "cream"
	| "cream2"
	| "bark"
	| "rose"
	| "roseDeep"
	| "sky"
	| "sage"
	| "sun"
	| "lilac"
	| "lilacDeep"
	| "peach";

interface Props {
	children?: React.ReactNode;
	color?: StickerColor | string;
	rotate?: number; // degrees
	radius?: number;
	border?: number;
	shadow?: boolean;
	style?: StyleProp<ViewStyle>;
}

const COLOR_MAP: Record<StickerColor, string> = {
	paper: WHIMSY.paper,
	cream: WHIMSY.cream,
	cream2: WHIMSY.cream2,
	bark: WHIMSY.bark,
	rose: WHIMSY.rose,
	roseDeep: WHIMSY.roseDeep,
	sky: WHIMSY.sky,
	sage: WHIMSY.sage,
	sun: WHIMSY.sun,
	lilac: WHIMSY.lilac,
	lilacDeep: WHIMSY.lilacDeep,
	peach: WHIMSY.peach,
};

export function Sticker({
	children,
	color = "paper",
	rotate = -0.6,
	radius = 14,
	border = 2,
	shadow = true,
	style,
}: Props) {
	const bg =
		(color in COLOR_MAP ? COLOR_MAP[color as StickerColor] : color) as string;
	return (
		<View
			style={[
				styles.base,
				{
					backgroundColor: bg,
					borderRadius: radius,
					borderWidth: border,
					transform: [{ rotate: `${rotate}deg` }],
				},
				shadow && STICKER_SHADOW,
				style,
			]}
		>
			{children}
		</View>
	);
}

// Strip of "tape" — narrow translucent rect, used to pin stickers.
export function Tape({
	color = "sun",
	rotate = -8,
	width = 48,
	height = 14,
	style,
}: {
	color?: StickerColor | string;
	rotate?: number;
	width?: number;
	height?: number;
	style?: StyleProp<ViewStyle>;
}) {
	const bg =
		(color in COLOR_MAP ? COLOR_MAP[color as StickerColor] : color) as string;
	return (
		<View
			style={[
				styles.tape,
				{
					backgroundColor: bg,
					width,
					height,
					transform: [{ rotate: `${rotate}deg` }],
				},
				style,
			]}
		/>
	);
}

const styles = StyleSheet.create({
	base: {
		borderColor: WHIMSY.ink,
	},
	tape: {
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		opacity: 0.85,
	},
});
