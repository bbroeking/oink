import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { WHIMSY } from "@/constants/theme";

interface Props {
	width?: number | string;
	height?: number | string;
	radius?: number;
	style?: StyleProp<ViewStyle>;
}

// Shimmery placeholder block. Pulses between two paper tones.
export function Skeleton({ width = "100%", height = 20, radius = 8, style }: Props) {
	const v = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		Animated.loop(
			Animated.sequence([
				Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: false }),
				Animated.timing(v, { toValue: 0, duration: 800, useNativeDriver: false }),
			])
		).start();
	}, [v]);
	const bg = v.interpolate({
		inputRange: [0, 1],
		outputRange: [WHIMSY.cream, WHIMSY.paper],
	});
	return (
		<Animated.View
			style={[
				{ width: width as any, height: height as any, borderRadius: radius, backgroundColor: bg },
				style,
			]}
		/>
	);
}

// Predefined card-shaped skeleton matching the shop ItemCard
export function ShopCardSkeleton() {
	return (
		<View style={styles.cardSkeleton}>
			<Skeleton height={120} radius={0} />
			<View style={{ padding: 10, gap: 6 }}>
				<Skeleton height={16} width="80%" />
				<Skeleton height={12} width="40%" />
				<Skeleton height={28} radius={14} />
			</View>
		</View>
	);
}

// Leaderboard row skeleton
export function ListRowSkeleton() {
	return (
		<View style={styles.listRow}>
			<Skeleton width={40} height={40} radius={20} />
			<View style={{ flex: 1, gap: 6, marginLeft: 10 }}>
				<Skeleton height={14} width="60%" />
				<Skeleton height={10} width="35%" />
			</View>
			<Skeleton width={50} height={18} />
		</View>
	);
}

const styles = StyleSheet.create({
	cardSkeleton: {
		flex: 1,
		backgroundColor: WHIMSY.paper,
		borderRadius: 18,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		overflow: "hidden",
	},
	listRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 14,
		backgroundColor: WHIMSY.paper,
		borderRadius: 12,
		borderWidth: 1.5,
		borderColor: WHIMSY.ink,
		marginVertical: 4,
	},
});
