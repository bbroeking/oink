import { Tabs } from "expo-router";
import React, { useState, useEffect } from "react";
import { FontAwesome5 } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase";
import SupaAuth from "@/components/SupaAuth";

export default function TabLayout() {
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
		});

		supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});
	}, []);

	if (!session) {
		return (
			<View style={{ flex: 1 }}>
				<SupaAuth />
			</View>
		);
	}

	return (
		<Tabs
			screenOptions={{
				tabBarStyle: {
					backgroundColor: "#1A1A1A",
					borderTopWidth: 0,
					height: Platform.OS === "ios" ? 88 : 68,
					paddingBottom: Platform.OS === "ios" ? 28 : 8,
					paddingTop: 8,
					elevation: 0,
					shadowOpacity: 0,
				},
				tabBarActiveTintColor: "#FFFFFF",
				tabBarInactiveTintColor: "rgba(255, 255, 255, 0.5)",
				tabBarLabelStyle: {
					fontSize: 12,
					fontWeight: "500",
					paddingBottom: Platform.OS === "ios" ? 0 : 4,
				},
				tabBarIconStyle: {
					marginBottom: -4,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color }) => (
						<FontAwesome5 name="home" size={20} color={color} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="leaderboard"
				options={{
					title: "Leaderboard",
					tabBarIcon: ({ color }) => (
						<FontAwesome5 name="trophy" size={20} color={color} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="account"
				options={{
					title: "Account",
					tabBarIcon: ({ color }) => (
						<FontAwesome5 name="user" size={20} color={color} />
					),
					headerShown: false,
				}}
			/>
		</Tabs>
	);
}
