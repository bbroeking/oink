import React from "react";
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import { FONTS, RADII, SPACE, TYPE, UI_COLORS, WHIMSY } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

export interface SegmentOption<T extends string> {
	value: T;
	label: string;
	icon?: IconName;
}

interface Props<T extends string> {
	options: readonly SegmentOption<T>[];
	value: T;
	onChange: (value: T) => void;
	label: string;
	style?: StyleProp<ViewStyle>;
}

/**
 * Compact mutually-exclusive choices with full 44pt targets and explicit
 * selected semantics. Use for local scope/filter changes, not navigation tabs.
 */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	label,
	style,
}: Props<T>) {
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={[styles.track, style]}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						accessibilityRole="radio"
						accessibilityLabel={option.label}
						accessibilityState={{ selected }}
						style={({ pressed }) => [
							styles.segment,
							selected && styles.segmentSelected,
							pressed && styles.pressed,
						]}
					>
						{option.icon ? (
							<Icon
								name={option.icon}
								size={14}
								filled={selected}
								color={UI_COLORS.textPrimary}
								strokeWidth={1.8}
							/>
						) : null}
						<Text
							style={[
								styles.label,
								selected && styles.labelSelected,
							]}
							numberOfLines={2}
						>
							{option.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	track: {
		flexDirection: "row",
		gap: SPACE.xs,
		padding: SPACE.xs,
		borderWidth: 2,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surface,
	},
	segment: {
		flex: 1,
		minHeight: 44,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.sm,
		borderWidth: 1.5,
		borderColor: "transparent",
		borderRadius: RADII.pill,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: 6,
	},
	segmentSelected: {
		backgroundColor: WHIMSY.sun,
		borderColor: UI_COLORS.border,
	},
	label: {
		...TYPE.bodySm,
		fontFamily: FONTS.hand,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
	},
	labelSelected: {
		fontFamily: FONTS.bodyExtra,
		color: UI_COLORS.textPrimary,
	},
	pressed: {
		opacity: 0.72,
	},
});
