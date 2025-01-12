import { useState, useEffect, useCallback } from "react";
import {
	View,
	StyleSheet,
	FlatList,
	Platform,
	SafeAreaView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../utils/supabase";
import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";

interface LeaderboardEntry {
	username: string;
	counter: number;
}

export default function LeaderboardScreen() {
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchLeaderboard();
	}, []);

	const fetchLeaderboard = async () => {
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("username, counter")
				.order("counter", { ascending: false })
				.limit(10);

			if (error) throw error;

			setLeaderboard(data || []);
		} catch (error) {
			console.error("Error fetching leaderboard:", error);
		} finally {
			setLoading(false);
		}
	};

	const renderItem = ({
		item,
		index,
	}: {
		item: LeaderboardEntry;
		index: number;
	}) => (
		<View style={styles.row}>
			<ThemedText style={styles.rank}>#{index + 1}</ThemedText>
			<ThemedText style={styles.username}>
				{item.username || "Anonymous"}
			</ThemedText>
			<ThemedText style={styles.counter}>{item.counter || 0}</ThemedText>
		</View>
	);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ThemedText style={styles.title}>Top Tappers</ThemedText>
				{loading ? (
					<ThemedText>Loading...</ThemedText>
				) : (
					<FlatList
						data={leaderboard}
						renderItem={renderItem}
						keyExtractor={(item, index) => index.toString()}
						style={styles.list}
						contentContainerStyle={styles.listContent}
					/>
				)}
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		textAlign: "center",
		marginTop: Platform.OS === "ios" ? 8 : 20,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingHorizontal: 20,
	},
	row: {
		flexDirection: "row",
		padding: 15,
		borderBottomWidth: 1,
		borderBottomColor: "#ccc",
		alignItems: "center",
	},
	rank: {
		width: 50,
		fontSize: 16,
		fontWeight: "bold",
	},
	username: {
		flex: 1,
		fontSize: 16,
	},
	counter: {
		width: 80,
		fontSize: 16,
		textAlign: "right",
	},
});
