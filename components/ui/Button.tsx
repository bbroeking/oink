import React from "react";
import {
	Pressable,
	Text,
	ViewStyle,
	type PressableProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS, SHADOW_SM, UI_COLORS } from "@/constants/theme";

// Cozy treatment for the colorful gradient CTAs (primary/purple/gold): the
// app's signature ink outline + hard "sticker" drop shadow, so they read as
// hand-drawn buttons instead of flat gradient pills.
const COZY_GRADIENT = {
	borderWidth: 2,
	borderColor: UI_COLORS.border,
	...SHADOW_SM,
};

type Variant = "primary" | "purple" | "gold" | "dark" | "ghost" | "locked" | "success";
type Size = "sm" | "md" | "lg";

interface Props extends Pick<
	PressableProps,
	"accessibilityHint" | "accessibilityLabel" | "accessibilityState" | "testID"
> {
	children: React.ReactNode;
	variant?: Variant;
	size?: Size;
	icon?: React.ReactNode;
	full?: boolean;
	style?: ViewStyle;
	onPress?: () => void;
	// Optional secondary gesture (e.g. long-press-to-copy on a share CTA). Threads
	// to the same Pressable as onPress for both the gradient and flat variants.
	onLongPress?: () => void;
	disabled?: boolean;
}

const SIZE_MAP: Record<
	Size,
	{ minH: number; px: number; py: number; fs: number; br: number }
> = {
	sm: { minH: 44, px: 14, py: 10, fs: 13, br: 22 },
	md: { minH: 44, px: 18, py: 11, fs: 15, br: 22 },
	lg: { minH: 54, px: 22, py: 14, fs: 17, br: 27 },
};

const GRADIENT_VARIANTS: Partial<Record<Variant, [string, string]>> = {
	primary: ["#F0B8C8", "#E8A7B9"],
	// White labels need one consistently dark ramp; the old light stop dropped
	// below 4.5:1 halfway through the gradient.
	purple: ["#7052EE", COLORS.purpleDeep],
	gold: ["#F8D068", "#F5C44A"],
};

const FLAT_VARIANTS: Partial<
	Record<Variant, { bg: string; color: string; border?: string; bw?: number }>
> = {
	dark: { bg: UI_COLORS.textPrimary, color: UI_COLORS.textOnDark },
	ghost: {
		bg: UI_COLORS.surface,
		color: UI_COLORS.textPrimary,
		border: UI_COLORS.separator,
	},
	// The "asleep button": full chrome (2px ink outline, muted paper fill + ink
	// text) with NO opacity crush, so a disabled CTA reads as a button that's
	// resting rather than a washed-out, borderless pill.
	locked: {
		bg: UI_COLORS.surfaceStrong,
		color: UI_COLORS.textSecondary,
		border: UI_COLORS.border,
		bw: 2,
	},
	success: {
		bg: UI_COLORS.successSurface,
		color: UI_COLORS.successText,
		border: "#7A9B63",
	},
};

const TEXT_COLORS: Record<Variant, string> = {
	primary: UI_COLORS.textPrimary,
	purple: UI_COLORS.textOnDark,
	gold: "#5A3F00",
	dark: UI_COLORS.textOnDark,
	ghost: UI_COLORS.textPrimary,
	locked: UI_COLORS.textSecondary,
	success: UI_COLORS.successText,
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	icon,
	full,
	style,
	onPress,
	onLongPress,
	disabled,
	accessibilityHint,
	accessibilityLabel,
	accessibilityState,
	testID,
}: Props) {
	const sz = SIZE_MAP[size];
	const gradient = GRADIENT_VARIANTS[variant];
	const flat = FLAT_VARIANTS[variant];

	const inner = (
		<>
			{icon}
			<Text
				style={{
					color: TEXT_COLORS[variant],
					fontFamily: FONTS.bodyExtra,
					fontSize: sz.fs,
					letterSpacing: 0.1,
					marginLeft: icon ? 6 : 0,
					flexShrink: 1,
					textAlign: "center",
				}}
			>
				{children}
			</Text>
		</>
	);

	const baseStyle: ViewStyle = {
		minHeight: sz.minH,
		paddingHorizontal: sz.px,
		paddingVertical: sz.py,
		borderRadius: sz.br,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		alignSelf: full ? "stretch" : undefined,
		// The locked variant is itself the disabled look — don't double-punish it
		// with an opacity crush; every other variant still dims when disabled.
		opacity: disabled && variant !== "locked" ? 0.5 : 1,
		...style,
	};

	if (gradient) {
		return (
			<Pressable
				onPress={onPress}
				onLongPress={onLongPress}
				disabled={disabled}
				accessibilityRole="button"
				accessibilityLabel={accessibilityLabel}
				accessibilityHint={accessibilityHint}
				accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
				testID={testID}
				style={({ pressed }) => ({
					opacity: pressed && !disabled ? 0.85 : 1,
				})}
			>
				<LinearGradient
					colors={gradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 0, y: 1 }}
					style={[baseStyle, COZY_GRADIENT]}
				>
					{inner}
				</LinearGradient>
			</Pressable>
		);
	}

	return (
		<Pressable
			onPress={onPress}
			onLongPress={onLongPress}
			disabled={disabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
			testID={testID}
			style={({ pressed }) => [
				baseStyle,
				{
					backgroundColor: flat?.bg ?? UI_COLORS.surface,
					borderWidth: flat?.border ? (flat.bw ?? 1.5) : 0,
					borderColor: flat?.border,
					opacity:
						pressed && !disabled
							? 0.85
							: disabled && variant !== "locked"
								? 0.5
								: 1,
				},
			]}
		>
			{inner}
		</Pressable>
	);
}
