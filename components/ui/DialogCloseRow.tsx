import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SPACE } from "@/constants/theme";
import { IconButton } from "./IconButton";

interface Props {
	onPress: () => void;
	label?: string;
	style?: StyleProp<ViewStyle>;
	// A header that shares the rail's row — a kicker and a title beside the ×
	// rather than stacked under it. The rail is 52pt of dead space when the
	// heading has to sit below it; sharing the row gives that back. The slot
	// takes the sheet's own side inset so the heading lands on the same left
	// edge as the content beneath it. (2026-09-13)
	children?: React.ReactNode;
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
	children,
}: Props) {
	return (
		<View style={[styles.row, children !== undefined && styles.rowWithHeader, style]}>
			{children !== undefined ? <View style={styles.header}>{children}</View> : null}
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
	// With a header the rail becomes a row: heading left, × right, both hung
	// from the top edge so a two-line title grows downward, never under the ×.
	rowWithHeader: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		gap: SPACE.sm,
		paddingLeft: SPACE.xl,
		paddingTop: SPACE.lg,
		// A hair under the heading so a display title's low-sitting baseline
		// clears whatever the sheet puts first.
		paddingBottom: SPACE.xs,
	},
	header: {
		flex: 1,
		minWidth: 0,
	},
});
