import { Tabs } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase";
import SupaAuth from "@/components/SupaAuth";
import UsernameSetup from "@/components/UsernameSetup";
import { Onboarding } from "@/components/Onboarding";
import { HangingSignsTabBar } from "@/components/ui/HangingSignsTabBar";
import { COLORS } from "@/constants/theme";
import { initIAP } from "@/utils/iap";

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
			// Custom tabBar — the swinging hanging-signs treatment
			// from the design's bar-options.jsx (Option B). Replaces
			// the default flat label+icon strip; the bar owns its
			// own height, the wood-rail gradient, the per-tab signs
			// with their sway loops, and the swing-in tap animation.
			tabBar={(props) => <HangingSignsTabBar {...props} />}
			screenOptions={{ headerShown: false }}
		>
			<Tabs.Screen name="index"   options={{ title: "Barn" }} />
			<Tabs.Screen name="friends" options={{ title: "Friends" }} />
			<Tabs.Screen name="season"  options={{ title: "Season" }} />
			<Tabs.Screen name="shop"    options={{ title: "Shop" }} />
			<Tabs.Screen name="account" options={{ title: "Me" }} />
		</Tabs>
	);
}
