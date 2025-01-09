import React, { useState, useEffect } from "react";
import {
	View,
	StyleSheet,
	ImageBackground,
	Dimensions,
	Platform,
	SafeAreaView,
} from "react-native";
import { supabase } from "../utils/supabase";
import { ThemedText } from "./ThemedText";
import SwipeElement from "./SwipeElement";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const TAB_BAR_HEIGHT = Platform.OS === "ios" ? 88 : 68;

interface Stats {
	counter: number;
	itemCount: number;
}

export default function Barn() {
	const [stats, setStats] = useState<Stats>({ counter: 0, itemCount: 0 });

	useEffect(() => {
		fetchStats();
	}, []);

	const fetchStats = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const [profileResult, itemsResult] = await Promise.all([
				supabase
					.from("profiles")
					.select("counter")
					.eq("id", user.id)
					.single(),
				supabase
					.from("user_items")
					.select("item_count")
					.eq("user_id", user.id)
					.single(),
			]);

			if (profileResult.error) throw profileResult.error;

			setStats({
				counter: profileResult.data?.counter || 0,
				itemCount: itemsResult.data?.item_count || 0,
			});
		} catch (error) {
			console.error("Error fetching stats:", error);
		}
	};

	const handleIncrement = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			const { error } = await supabase.rpc("increment_counter", {
				user_id: user.id,
			});

			if (error) throw error;
			fetchStats();
		} catch (error) {
			console.error("Error incrementing count:", error);
		}
	};

	return (
		<ImageBackground
			source={require("../assets/images/homepage-bg.jpg")}
			style={styles.backgroundImage}
			resizeMode="cover"
		>
			<SafeAreaView style={styles.contentContainer}>
				<View style={styles.statsContainer}>
					<View style={styles.statItem}>
						<ThemedText style={styles.statLabel}>
							TICKLES
						</ThemedText>
						<ThemedText style={styles.statValue}>
							{stats.counter}
						</ThemedText>
					</View>
					<View style={styles.statItem}>
						<ThemedText style={styles.statLabel}>
							AVAILABLE
						</ThemedText>
						<ThemedText style={styles.statValue}>
							{stats.itemCount}
						</ThemedText>
					</View>
				</View>
				<View style={styles.mainSection}>
					<View style={styles.swipeContainer}>
						<SwipeElement onLuckySwipe={handleIncrement} />
					</View>
				</View>
			</SafeAreaView>
		</ImageBackground>
	);
}

const styles = StyleSheet.create({
	backgroundImage: {
		position: "absolute",
		left: 0,
		top: 0,
		right: 0,
		bottom: 0,
		width: "100%",
		height: SCREEN_HEIGHT,
	},
	contentContainer: {
		flex: 1,
		height: SCREEN_HEIGHT,
	},
	statsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingTop: Platform.OS === "ios" ? 8 : 20,
		zIndex: 1,
	},
	statItem: {
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 12,
		minWidth: 100,
	},
	statLabel: {
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 2,
		color: "#FFFFFF",
		opacity: 0.9,
		marginBottom: 4,
	},
	statValue: {
		fontSize: 22,
		fontWeight: "700",
		color: "#FFFFFF",
	},
	mainSection: {
		flex: 1,
		justifyContent: "flex-end",
	},
	swipeContainer: {
		width: "100%",
		alignItems: "center",
		marginBottom: Platform.OS === "ios" ? 20 : 40,
	},
});
