// One find on a paper tile — the square the bag draws a find on, in the
// Satchel sheet's bag row and the dig receipt's "into your satchel" beat.
// `ghost` is a find that is NOT in the bag (the receipt's "stayed in the mud"):
// the catalog's never-carried grammar — cream, dashed, the mark as a
// silhouette. A tap-minimum square, so six fit a phone with the gaps.
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet } from "react-native";
import type { SatchelFindId } from "@/constants/satchel";
import { ART_SIZE, BORDER, RADII, TAP_MIN } from "@/constants/theme";
import { Sticker } from "../ui";
import { FindArt } from "./FindArt";

export function FindTile({
	id,
	ghost = false,
	onPress,
	onLongPress,
	accessibilityRole,
	accessibilityLabel,
	accessibilityHint,
	accessibilityState,
	testID,
	style,
	children,
}: {
	id: SatchelFindId;
	ghost?: boolean;
	onPress?: () => void;
	onLongPress?: () => void;
	accessibilityRole?: "button" | "text" | "image";
	accessibilityLabel?: string;
	accessibilityHint?: string;
	accessibilityState?: { selected?: boolean; disabled?: boolean };
	testID?: string;
	style?: StyleProp<ViewStyle>;
	children?: ReactNode;
}) {
	return (
		<Sticker
			color={ghost ? "cream2" : "paper"}
			radius={RADII.lg}
			border={BORDER.thin}
			borderStyle={ghost ? "dashed" : "solid"}
			shadow="none"
			rotate={0}
			onPress={onPress}
			onLongPress={onLongPress}
			accessibilityRole={accessibilityRole}
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityState={accessibilityState}
			testID={testID}
			style={[styles.tile, style]}
		>
			<FindArt id={id} size={ART_SIZE.glyphSm} silhouette={ghost} />
			{children}
		</Sticker>
	);
}

const styles = StyleSheet.create({
	tile: { width: TAP_MIN, height: TAP_MIN, alignItems: "center", justifyContent: "center" },
});
