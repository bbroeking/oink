import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { COLORS, FONTS, RADII, SHADOWS } from "@/constants/theme";
import { Icon } from "./Icon";
import { TickleIcon, SnoutCoin } from "./SnoutCoin";

export { Icon } from "./Icon";
export { TickleIcon, SnoutCoin } from "./SnoutCoin";
export { Button } from "./Button";

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

// ----- StatPill -----
export function StatPill({
	label,
	value,
	icon,
	style,
	onPress,
}: {
	label: string;
	value: string;
	icon?: React.ReactNode;
	style?: ViewStyle;
	onPress?: () => void;
}) {
	const Wrap: React.ElementType = onPress ? require("react-native").Pressable : View;
	return (
		<Wrap
			onPress={onPress}
			style={[
				{
					backgroundColor: "rgba(0,0,0,0.6)",
					borderRadius: 18,
					paddingHorizontal: 14,
					paddingVertical: 8,
					flexDirection: "row",
					alignItems: "center",
					gap: 10,
				},
				SHADOWS.pillFloat,
				style,
			]}
		>
			{icon}
			<View>
				<Text
					style={{
						fontSize: 9,
						fontFamily: FONTS.bodyExtra,
						color: "rgba(255,255,255,0.7)",
						letterSpacing: 1.2,
						textTransform: "uppercase",
					}}
				>
					{label}
				</Text>
				<Text
					style={{
						fontSize: 22,
						fontFamily: FONTS.display,
						color: "#fff",
						lineHeight: 24,
						marginTop: 1,
					}}
				>
					{value}
				</Text>
			</View>
		</Wrap>
	);
}

// ----- PremiumBadge -----
export function PremiumBadge({
	size = "sm",
	children = "Premium",
	icon = true,
	style,
}: {
	size?: "sm" | "lg";
	children?: React.ReactNode;
	icon?: boolean;
	style?: ViewStyle;
}) {
	const fs = size === "lg" ? 12 : 10;
	return (
		<View
			style={[
				{
					backgroundColor: COLORS.purple,
					borderRadius: 8,
					paddingHorizontal: size === "lg" ? 9 : 7,
					paddingVertical: size === "lg" ? 4 : 2,
					flexDirection: "row",
					alignItems: "center",
					alignSelf: "flex-start",
				},
				style,
			]}
		>
			{icon && (
				<Icon
					name="star"
					size={fs - 1}
					filled
					color="#fff"
					strokeWidth={0}
					style={{ marginRight: 3 }}
				/>
			)}
			{typeof children === "string" ? (
				<Text
					style={{
						color: "#fff",
						fontSize: fs,
						fontFamily: FONTS.bodyExtra,
						letterSpacing: 0.3,
					}}
				>
					{children}
				</Text>
			) : (
				children
			)}
		</View>
	);
}

// ----- SectionHeader -----
export function SectionHeader({
	title,
	action,
}: {
	title: string;
	action?: string;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				justifyContent: "space-between",
				alignItems: "baseline",
				marginBottom: 10,
			}}
		>
			<Text
				style={{
					fontSize: 19,
					fontFamily: FONTS.display,
					color: COLORS.ink,
				}}
			>
				{title}
			</Text>
			{action && (
				<Text
					style={{
						fontSize: 13,
						fontFamily: FONTS.bodyExtra,
						color: COLORS.pinkDeep,
					}}
				>
					{action}
				</Text>
			)}
		</View>
	);
}

// ----- DisplayText / BodyText helpers -----
export function Display({
	children,
	style,
}: {
	children: React.ReactNode;
	style?: TextStyle;
}) {
	return (
		<Text style={[{ fontFamily: FONTS.display, color: COLORS.ink }, style]}>
			{children}
		</Text>
	);
}
