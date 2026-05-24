import { Tabs } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import { View, AppState } from "react-native";
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

	// Bounty-ready badge on the Season tab. Polled on mount + every
	// foreground transition. Cheap RPC (counts rows from my_weekly_bounties),
	// no realtime sub. The bounty_ready_push trigger fires immediately
	// on the writes that move progress; this badge is the "ambient"
	// reminder when you missed (or muted) the push.
	const [bountyReady, setBountyReady] = useState(0);
	useEffect(() => {
		if (!session) return;
		let cancelled = false;
		const fetchCount = async () => {
			const { data } = await supabase.rpc("bounty_ready_count");
			if (cancelled) return;
			setBountyReady(typeof data === "number" ? data : 0);
		};
		fetchCount();
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") fetchCount();
		});
		// 30s ambient poll — covers mid-session claim (badge clears
		// when the count drops to 0 after a tap). Cheap RPC; no
		// realtime sub needed.
		const interval = setInterval(fetchCount, 30_000);
		return () => {
			cancelled = true;
			sub.remove();
			clearInterval(interval);
		};
	}, [session]);

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
			tabBar={(props) => (
				<HangingSignsTabBar {...props} badges={{ season: bountyReady }} />
			)}
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
