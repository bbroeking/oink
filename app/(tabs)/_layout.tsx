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
	index: "tabBarn",
	friends: "tabFriends",
	season: "tabSeason",
	shop: "tabShop",
	account: "tabMe",
};

// Tape-strip active indicator — a small yellow tape rectangle pinned
// just above the icon when the tab is focused. Mirrors the .tape-strip
// rule from the redesign's styles.css (26×4, sun w/ ink border).
//
// The strip used to sit BELOW the icon, but React Navigation lays the
// label out directly under the icon — pinning the strip at bottom:-10
// dropped it right through the label text ("Barn" with a yellow bar
// running through the middle). Moving the indicator above the icon
// reads cleanly without colliding with the label.
function TabIcon({
	name,
	focused,
}: {
	name: string;
	color: string;
	focused: boolean;
}) {
	return (
		<View style={{ alignItems: "center", justifyContent: "center" }}>
			{focused && (
				<View
					style={{
						position: "absolute",
						top: -8,
						width: 26,
						height: 4,
						backgroundColor: WHIMSY.sun,
						borderRadius: 2,
						borderWidth: 1,
						borderColor: WHIMSY.ink,
					}}
				/>
			)}
			<Icon
				name={TAB_ICON[name]}
				size={24}
				color={WHIMSY.ink}
				filled={focused}
				strokeWidth={2}
			/>
		</View>
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
					// Per the redesign tokens: Nunito 800 (bodyExtra)
					// at 10px with 0.3px letter-spacing. Was Patrick
					// Hand at 11px — handwriting reads as decorative
					// noise next to the SVG icons.
					fontSize: 10,
					fontFamily: FONTS.bodyExtra,
					letterSpacing: 0.3,
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
					title: "Barn",
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
					title: "Me",
					tabBarIcon: ({ color, focused }) => (
						<TabIcon name="account" color={color} focused={focused} />
					),
					headerShown: false,
				}}
			/>
		</Tabs>
	);
}
