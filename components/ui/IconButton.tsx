import React from "react";
import {
	Pressable,
	StyleSheet,
	View,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { BORDER, DISABLED, OPACITY, RADII, UI_COLORS } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

type Variant = "none" | "paper" | "dark";

interface Props
	extends Pick<
		PressableProps,
		| "accessibilityHint"
		| "accessibilityValue"
		| "testID"
		| "onLongPress"
		| "nativeID"
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
	/**
	 * This button opens something in place (a menu, a panel) and says so, so a
	 * screen reader hears "expanded" rather than discovering new buttons.
	 * (2026-09-14)
	 */
	expanded?: boolean;
	/**
	 * Web-only ARIA attributes react-native-web forwards straight to the DOM
	 * node and React Native has no prop mirror for (`aria-haspopup`,
	 * `aria-controls`). Inert on native. (2026-09-14)
	 */
	webAria?: Record<`aria-${string}`, string>;
	style?: StyleProp<ViewStyle>;
}

/**
 * A semantic icon action with a guaranteed 44pt hit target. `visualSize` may
 * stay small for corner badges, but the tappable frame never shrinks.
 *
 * Forwards its ref to the host frame, so a caller can measure it (an anchored
 * panel's hit test) or send accessibility focus back to it. (2026-09-14)
 */
export const IconButton = React.forwardRef<View, Props>(function IconButton(
	{
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
		expanded,
		webAria,
		style,
		accessibilityHint,
		accessibilityValue,
		testID,
		nativeID,
		onLongPress,
	},
	ref
) {
	const iconColor = disabled
		? UI_COLORS.textDisabled
		: (color ??
			(variant === "dark" ? UI_COLORS.textOnDark : UI_COLORS.textPrimary));

	return (
		<Pressable
			ref={ref}
			{...webAria}
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityValue={accessibilityValue}
			accessibilityState={{ disabled, selected, expanded }}
			testID={testID}
			nativeID={nativeID}
			style={({ pressed }) => [
				style,
				styles.hitTarget,
				pressed && !disabled && styles.pressed,
			]}
		>
			<View
				style={[
					styles.visual,
					{ width: visualSize, height: visualSize },
					variant === "paper" && styles.paper,
					variant === "dark" && styles.dark,
					// A resting icon button keeps its outline: DISABLED chrome, never
					// an opacity crush (ruling 2026-07-07; audit B-08). (2026-09-11)
					disabled && variant !== "none" && DISABLED,
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
});

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
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	dark: {
		backgroundColor: UI_COLORS.textPrimary,
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
	},
	pressed: {
		opacity: OPACITY.pressed,
	},
});
