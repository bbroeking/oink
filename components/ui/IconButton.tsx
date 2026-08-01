import React from "react";
import {
	Pressable,
	StyleSheet,
	View,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { RADII, UI_COLORS } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

type Variant = "none" | "paper" | "dark";

interface Props
	extends Pick<
		PressableProps,
		"accessibilityHint" | "testID" | "onLongPress"
	> {
	name: IconName;
	label: string;
	onPress: () => void;
	variant?: Variant;
	iconSize?: number;
	visualSize?: number;
	color?: string;
	strokeWidth?: number;
	disabled?: boolean;
	selected?: boolean;
	style?: StyleProp<ViewStyle>;
}

/**
 * A semantic icon action with a guaranteed 44pt hit target. `visualSize` may
 * stay small for corner badges, but the tappable frame never shrinks.
 */
export function IconButton({
	name,
	label,
	onPress,
	variant = "paper",
	iconSize = 18,
	visualSize = 40,
	color,
	strokeWidth = 2.4,
	disabled = false,
	selected,
	style,
	accessibilityHint,
	testID,
	onLongPress,
}: Props) {
	const iconColor =
		color ??
		(variant === "dark" ? UI_COLORS.textOnDark : UI_COLORS.textPrimary);

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled, selected }}
			testID={testID}
			style={({ pressed }) => [
				style,
				styles.hitTarget,
				(pressed || disabled) && styles.dimmed,
			]}
		>
			<View
				style={[
					styles.visual,
					{ width: visualSize, height: visualSize },
					variant === "paper" && styles.paper,
					variant === "dark" && styles.dark,
				]}
			>
				<Icon
					name={name}
					size={iconSize}
					color={iconColor}
					strokeWidth={strokeWidth}
				/>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	hitTarget: {
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	visual: {
		alignItems: "center",
		justifyContent: "center",
		borderRadius: RADII.pill,
	},
	paper: {
		backgroundColor: UI_COLORS.surface,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
	},
	dark: {
		backgroundColor: UI_COLORS.textPrimary,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
	},
	dimmed: {
		opacity: 0.64,
	},
});
