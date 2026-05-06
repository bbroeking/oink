import React from "react";
import { Pressable, Text, View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "@/constants/theme";

type Variant = "primary" | "purple" | "gold" | "dark" | "ghost" | "locked" | "success";
type Size = "sm" | "md" | "lg";

interface Props {
	children: React.ReactNode;
	variant?: Variant;
	size?: Size;
	icon?: React.ReactNode;
	full?: boolean;
	style?: ViewStyle;
	onPress?: () => void;
	disabled?: boolean;
}

const SIZE_MAP: Record<Size, { h: number; px: number; fs: number; br: number }> = {
	sm: { h: 32, px: 14, fs: 13, br: 16 },
	md: { h: 44, px: 18, fs: 15, br: 22 },
	lg: { h: 54, px: 22, fs: 17, br: 27 },
};

const GRADIENT_VARIANTS: Partial<Record<Variant, [string, string]>> = {
	primary: ["#F0B8C8", "#E8A7B9"],
	purple: ["#9078FF", "#7B5FFF"],
	gold: ["#F8D068", "#F5C44A"],
};

const FLAT_VARIANTS: Partial<
	Record<Variant, { bg: string; color: string; border?: string }>
> = {
	dark: { bg: "#1A1A1A", color: "#fff" },
	ghost: { bg: "#FFFFFF", color: "#1A1A1A", border: COLORS.border },
	locked: { bg: COLORS.paper3, color: COLORS.ink4 },
	success: { bg: COLORS.successBg, color: COLORS.successText, border: "#C0DCA0" },
};

const TEXT_COLORS: Record<Variant, string> = {
	primary: "#fff",
	purple: "#fff",
	gold: "#5A3F00",
	dark: "#fff",
	ghost: "#1A1A1A",
	locked: COLORS.ink4,
	success: COLORS.successText,
};

export function Button({
	children,
	variant = "primary",
	size = "md",
	icon,
	full,
	style,
	onPress,
	disabled,
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
				}}
			>
				{children}
			</Text>
		</>
	);

	const baseStyle: ViewStyle = {
		height: sz.h,
		paddingHorizontal: sz.px,
		borderRadius: sz.br,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		alignSelf: full ? "stretch" : undefined,
		opacity: disabled ? 0.5 : 1,
		...style,
	};

	if (gradient) {
		return (
			<Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => ({
				opacity: pressed && !disabled ? 0.85 : 1,
			})}>
				<LinearGradient
					colors={gradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 0, y: 1 }}
					style={baseStyle}
				>
					{inner}
				</LinearGradient>
			</Pressable>
		);
	}

	return (
		<Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [
			baseStyle,
			{
				backgroundColor: flat?.bg ?? "#fff",
				borderWidth: flat?.border ? 1.5 : 0,
				borderColor: flat?.border,
				opacity: pressed && !disabled ? 0.85 : disabled ? 0.5 : 1,
			},
		]}>
			{inner}
		</Pressable>
	);
}
