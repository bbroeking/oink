import React, { useState, useEffect } from "react";
import { View, Text, Button } from "react-native";
import { supabase } from "../utils/supabase";

export default function Barn() {
	const [count, setCount] = useState(0);

	// Fetch initial count
	useEffect(() => {
		fetchCount();
	}, []);

	const fetchCount = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");
			const { data, error } = await supabase
				.from("profiles")
				.select("counter")
				.eq("id", user.id)
				.single();

			if (error) throw error;

			if (data) {
				setCount(data.counter);
			}
		} catch (error) {
			console.error("Error fetching count:", error);
		}
	};

	const handleIncrement = async () => {
		try {
			// Get the logged-in user's ID
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not logged in");

			// Increment the counter field for the logged-in user
			console.log(user.id);
			const { data, error } = await supabase.rpc("increment_counter", {
				user_id: user.id,
			});

			if (error) throw error;

			// Refresh the count
			fetchCount();
		} catch (error) {
			console.error("Error incrementing count:", error);
		}
	};

	return (
		<View>
			<Text>Current Count: {count}</Text>
			<Button title="Increment Count" onPress={handleIncrement} />
		</View>
	);
}
