import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SPACE } from "@/constants/theme";
import { IconButton } from "./IconButton";

interface Props {
	onPress: () => void;
	label?: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * Standard dismiss rail for centered dialogs.
 *
 * This row deliberately participates in layout. Keeping the close action out of
 * absolute positioning guarantees that long or accessibility-sized headings
 * cannot render underneath it.
 */
export function DialogCloseRow({
	onPress,
	label = "Close",
	style,
}: Props) {
	return (
		<View style={[styles.row, style]}>
			<IconButton
				name="x"
				label={label}
				onPress={onPress}
				visualSize={44}
				iconSize={20}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		width: "100%",
		minHeight: 52,
		alignItems: "flex-end",
		justifyContent: "center",
		paddingTop: SPACE.sm,
		paddingRight: SPACE.sm,
	},
});
