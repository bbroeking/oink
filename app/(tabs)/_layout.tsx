import { Tabs } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase";
import SupaAuth from "@/components/SupaAuth";
import UsernameSetup from "@/components/UsernameSetup";
import { Onboarding } from "@/components/Onboarding";
import { Icon, IconName } from "@/components/ui/Icon";
import { COLORS, FONTS, WHIMSY } from "@/constants/theme";
import { initIAP } from "@/utils/iap";

const TAB_ICON: Record<string, IconName> = {
	index: "home",
	friends: "friends",
	season: "season",
	shop: "shop",
	account: "user",
};

function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
	return (
		<Icon
			name={TAB_ICON[name]}
			size={26}
			color={WHIMSY.ink}
			filled={focused}
			strokeWidth={focused ? 2.6 : 2}
		/>
	);
}

export default function TabLayout() {
	const [session, setSession] = useState<Session | null>(null);
	const [username, setUsername] = useState<string | null | undefined>(undefined);
	const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			if (session) initIAP(session.user.id).catch(() => {});
		});

		supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
			if (!session) setUsername(undefined);
			if (session) initIAP(session.user.id).catch(() => {});
		});
	}, []);

	const refetchUsername = useCallback(async () => {
		if (!session) return;
		const { data } = await supabase
			.from("profiles")
			.select("username")
			.eq("id", session.user.id)
			.single();
		setUsername(data?.username ?? null);
	}, [session]);

	useEffect(() => {
		refetchUsername();
	}, [refetchUsername]);

	useEffect(() => {
		AsyncStorage.getItem("seen_onboarding").then((v) => {
			setNeedsOnboarding(v !== "1");
		});
	}, []);

	if (!session) {
		return (
			<View style={{ flex: 1 }}>
				<SupaAuth />
			</View>
		);
	}

	if (username === undefined) {
		return <View style={{ flex: 1, backgroundColor: COLORS.ink }} />;
	}

	if (!username) {
		return <UsernameSetup userId={session.user.id} onSaved={refetchUsername} />;
	}

	if (needsOnboarding) {
		return <Onboarding onDone={() => setNeedsOnboarding(false)} />;
	}

	return (
		<Tabs
			screenOptions={{
				tabBarStyle: {
					backgroundColor: WHIMSY.paper,
					borderTopWidth: 2,
					borderTopColor: WHIMSY.ink,
					height: Platform.OS === "ios" ? 88 : 68,
					paddingBottom: Platform.OS === "ios" ? 28 : 8,
					paddingTop: 10,
					elevation: 0,
					shadowOpacity: 0,
				},
				tabBarActiveTintColor: WHIMSY.ink,
				tabBarInactiveTintColor: WHIMSY.mute,
				tabBarLabelStyle: {
					fontSize: 11,
					fontFamily: FONTS.hand,
					letterSpacing: 0.2,
					paddingBottom: Platform.OS === "ios" ? 0 : 4,
				},
				tabBarIconStyle: {
					marginBottom: 0,
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: "Home",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="index" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="friends"
				options={{
					title: "Friends",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="friends" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="season"
				options={{
					title: "Season",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="season" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="shop"
				options={{
					title: "Shop",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="shop" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
			<Tabs.Screen
				name="account"
				options={{
					title: "Account",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="account" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
		</Tabs>
	);
}
