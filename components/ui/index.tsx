import React from "react";
import { View, ViewStyle } from "react-native";
import { COLORS, SHADOWS } from "@/constants/theme";

export { Button } from "./Button";
export { SectionHeader } from "./SectionHeader";

// ----- Card -----
export function Card({
	children,
	style,
	padding = 14,
}: {
	children: React.ReactNode;
	style?: ViewStyle;
	padding?: number;
}) {
	return (
		<View
			style={[
				{
					backgroundColor: COLORS.paper,
					borderRadius: 20,
					padding,
				},
				SHADOWS.card,
				style,
			]}
		>
			{children}
		</View>
	);
}
