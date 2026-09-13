import React from "react";
import { DynamicTypeText as Text } from "./DynamicTypeText";
import {
	Pressable,
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";
import {
	BORDER,
	DISABLED_TEXT,
	OPACITY,
	RADII,
	SPACE,
	TAP_MIN,
	TYPE,
	UI_COLORS,
	WHIMSY,
} from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

export interface SegmentOption<T extends string> {
	value: T;
	label: string;
	icon?: IconName;
	// A segment can be present but unavailable (a scope with nothing in it yet).
	// It keeps its shape and announces `disabled` — it never disappears.
	disabled?: boolean;
	// Top-right marker on the segment — an unread count, a "new" dot.
	badge?: React.ReactNode;
	// Spoken name/consequence when the visible label is too terse ("Mine" →
	// "Show only furnishings you own"). (2026-09-11)
	accessibilityLabel?: string;
	accessibilityHint?: string;
}

type Layout = "row" | "icon-over-label";

interface Props<T extends string> {
	options: readonly SegmentOption<T>[];
	value: T;
	onChange: (value: T) => void;
	label: string;
	// `row` is the compact filter control; `icon-over-label` stacks the icon over
	// a tracked pill kicker for hub navigation. [B-06, C-05] (2026-09-11)
	layout?: Layout;
	// A ceiling on Dynamic Type for the segment labels, forwarded to each
	// <Text>. Undefined by default — the control normally scales the whole 200%
	// and the two-line labels grow the track with it. Pass 1.3 where the control
	// FLOATS over a fixed stage and has no room to grow (the visit screen's
	// Outside/Inside toggle), so the words stay whole. (2026-09-12)
	maxFontSizeMultiplier?: number;
	style?: StyleProp<ViewStyle>;
}

// The stacked layout's icon — larger than the inline one, because it is the
// thing you read first when the label shrinks to a kicker.
const STACKED_ICON = 20;
const INLINE_ICON = 14;

/**
 * Compact mutually-exclusive choices with full 44pt targets and explicit
 * selected semantics. Use for local scope/filter changes, not navigation tabs.
 */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	label,
	layout = "row",
	maxFontSizeMultiplier,
	style,
}: Props<T>) {
	const stacked = layout === "icon-over-label";
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={label}
			style={[styles.track, style]}
		>
			{options.map((option) => {
				const selected = option.value === value;
				const disabled = !!option.disabled;
				return (
					<Pressable
						key={option.value}
						onPress={() => onChange(option.value)}
						disabled={disabled}
						accessibilityRole="radio"
						accessibilityLabel={option.accessibilityLabel ?? option.label}
						accessibilityHint={option.accessibilityHint}
						accessibilityState={{
							selected,
							...(disabled ? { disabled: true } : null),
						}}
						style={({ pressed }) => [
							styles.segment,
							stacked && styles.segmentStacked,
							selected && styles.segmentSelected,
							pressed && !disabled && styles.pressed,
						]}
					>
						{option.icon ? (
							<Icon
								name={option.icon}
								size={stacked ? STACKED_ICON : INLINE_ICON}
								filled={selected}
								color={
									disabled
										? DISABLED_TEXT.color
										: UI_COLORS.textPrimary
								}
								strokeWidth={1.8}
							/>
						) : null}
						<Text
							maxFontSizeMultiplier={maxFontSizeMultiplier}
							style={[
								stacked ? styles.labelStacked : styles.label,
								selected && styles.labelSelected,
								disabled && DISABLED_TEXT,
							]}
							numberOfLines={2}
						>
							{option.label}
						</Text>
						{option.badge ? (
							<View style={styles.badge}>{option.badge}</View>
						) : null}
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
		borderWidth: BORDER.ink,
		borderColor: UI_COLORS.border,
		borderRadius: RADII.pill,
		backgroundColor: UI_COLORS.surface,
	},
	segment: {
		// NOT `flex: 1`. React Native's `flex: 1` is flexGrow 1 + flexShrink 1 +
		// flexBasis **0**, so a segment contributed NOTHING to the track's own
		// measured width — a track that sizes to its content (the visit's
		// floating toggle: absolute, `minWidth`, no fixed width) collapsed to its
		// minimum and then squeezed the labels inside it, ellipsizing single
		// words ("Outside" -> "Out…"). With an `auto` basis the segment measures
		// at its label, the track grows to hold both, and `flexGrow` still shares
		// any leftover evenly — so a stretched control looks exactly as it did.
		// (2026-09-12)
		flexGrow: 1,
		flexShrink: 1,
		flexBasis: "auto",
		minHeight: TAP_MIN,
		paddingHorizontal: SPACE.sm,
		paddingVertical: SPACE.sm,
		borderWidth: BORDER.thin,
		borderColor: "transparent",
		borderRadius: RADII.pill,
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: SPACE.xs,
	},
	segmentStacked: {
		flexDirection: "column",
		gap: SPACE.xxs,
	},
	segmentSelected: {
		backgroundColor: WHIMSY.sun,
		borderColor: UI_COLORS.border,
	},
	// One face for every segment: the label role, ink when selected and
	// secondary otherwise. Mixing the hand font on the resting segments made
	// one control read as two voices (2026-09-11 screen review).
	label: {
		...TYPE.label,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
		// The label does NOT shrink. A shrinkable label can be squeezed below the
		// width of its own longest word, and a segment is never allowed to
		// ellipsize a word — the segment above grows to the label instead.
		// (2026-09-12)
		flexShrink: 0,
	},
	labelStacked: {
		...TYPE.kickerPillSm,
		color: UI_COLORS.textSecondary,
		textAlign: "center",
		flexShrink: 0,
	},
	labelSelected: {
		color: UI_COLORS.textPrimary,
	},
	badge: {
		position: "absolute",
		top: 0,
		right: 0,
	},
	pressed: {
		opacity: OPACITY.pressed,
	},
});
