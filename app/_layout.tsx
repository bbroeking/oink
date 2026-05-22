import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import {
	useFonts,
	Fredoka_600SemiBold,
	Fredoka_700Bold,
} from "@expo-google-fonts/fredoka";
import {
	Nunito_600SemiBold,
	Nunito_700Bold,
	Nunito_800ExtraBold,
	Nunito_900Black,
} from "@expo-google-fonts/nunito";
import { Caprasimo_400Regular } from "@expo-google-fonts/caprasimo";
import { PatrickHand_400Regular } from "@expo-google-fonts/patrick-hand";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import "react-native-reanimated";
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
import {
	AlignmentSchismModal,
	type SchismSide,
} from "@/components/AlignmentSchismModal";
import {
	JudgementDayModal,
	type FinaleResult,
} from "@/components/JudgementDayModal";
import {
	WhileAwayModal,
	type RitualEvent,
} from "@/components/WhileAwayModal";

// Initialize Sentry as early as possible. Gated on DSN env var so dev
// without a project still works.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN && !__DEV__) {
	Sentry.init({
		dsn: SENTRY_DSN,
		// Send errors but don't trace every interaction — costs add up
		tracesSampleRate: 0.1,
		enableNative: true,
	});
}

import { useColorScheme } from "@/hooks/useColorScheme";

SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
	const colorScheme = useColorScheme();
	const [loaded] = useFonts({
		SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
		Fredoka_600SemiBold,
		Fredoka_700Bold,
		Nunito_600SemiBold,
		Nunito_700Bold,
		Nunito_800ExtraBold,
		Nunito_900Black,
		Caprasimo_400Regular,
		PatrickHand_400Regular,
	});
	const [authChecked, setAuthChecked] = useState(false);
	// Season 1: pending alignment-schism reveal. Set by the polling
	// effect below when a user first crosses ±25 alignment.
	const [schism, setSchism] = useState<{ side: SchismSide; score: number } | null>(null);
	// Season 1 finale: pending Judgement Day verdict.
	const [finale, setFinale] = useState<FinaleResult | null>(null);
	// "While you were away" — bless/curse received since last launch.
	const [rituals, setRituals] = useState<RitualEvent[] | null>(null);

	// Resolve the initial auth state before letting the splash drop, so we
	// transition straight into either auth or the home screen — no blank flash.
	useEffect(() => {
		supabase.auth.getSession().finally(() => setAuthChecked(true));
	}, []);

	// Poll check_schism_status whenever we have an authenticated user
	// AND on every transition back to foreground. The RPC is fast (PK
	// lookup + two boolean checks). If it returns a side, the modal
	// mounts and the dismiss handler clears the state + writes
	// mark_schism_seen so the user never sees the same crossing twice.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		const check = async () => {
			const { data } = await supabase.rpc("check_schism_status");
			if (cancelled) return;
			const r = data as { side?: string; score?: number } | null;
			if (r?.side === "angel" || r?.side === "goblin") {
				setSchism({ side: r.side, score: r.score ?? 0 });
			}
		};
		check();
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") check();
		});
		return () => {
			cancelled = true;
			sub.remove();
		};
	}, [authChecked]);

	// Poll my_finale_result the same way — surfaces the Judgement Day
	// modal once a season has been finalized. Independent of the
	// schism poll so a finalized season shows even mid-schism.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		const check = async () => {
			const { data } = await supabase.rpc("my_finale_result");
			if (cancelled) return;
			const r = data as ({ pending?: boolean } & Partial<FinaleResult>) | null;
			if (r?.pending) {
				setFinale(r as FinaleResult);
			}
		};
		check();
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") check();
		});
		return () => {
			cancelled = true;
			sub.remove();
		};
	}, [authChecked]);

	// "While you were away" — surface blessings + curses received
	// since the last launch. Tracked client-side via AsyncStorage
	// (`rituals_seen_v1` = the newest sent_at already shown). The
	// events also live in the Friends-tab Inbox; this is the
	// can't-miss-it launch announcement. Runs once on auth.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		(async () => {
			const { data: ures } = await supabase.auth.getUser();
			const me = ures?.user?.id;
			if (!me || cancelled) return;
			const SEEN = "rituals_seen_v1";
			const since =
				(await AsyncStorage.getItem(SEEN)) ?? new Date().toISOString();
			const side = async (table: "blessings" | "curses") => {
				const { data } = await supabase
					.from(table)
					.select("kind, sender_id, sent_at")
					.eq("receiver_id", me)
					.gt("sent_at", since)
					.order("sent_at", { ascending: false })
					.limit(20);
				return (data ?? []) as {
					kind: string;
					sender_id: string;
					sent_at: string;
				}[];
			};
			const rows = [
				...(await side("blessings")).map((r) => ({
					...r,
					source: "blessing" as const,
				})),
				...(await side("curses")).map((r) => ({
					...r,
					source: "curse" as const,
				})),
			];
			if (cancelled) return;
			if (rows.length === 0) {
				// Advance the marker so a first launch never dredges history.
				AsyncStorage.setItem(SEEN, new Date().toISOString());
				return;
			}
			const ids = [...new Set(rows.map((r) => r.sender_id))];
			const { data: profs } = await supabase
				.from("profiles")
				.select("id, username")
				.in("id", ids);
			if (cancelled) return;
			const byId = new Map(
				((profs ?? []) as { id: string; username: string | null }[]).map(
					(p) => [p.id, p.username]
				)
			);
			rows.sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1));
			AsyncStorage.setItem(SEEN, rows[0].sent_at);
			setRituals(
				rows.map((r) => ({
					source: r.source,
					kind: r.kind,
					from: byId.get(r.sender_id) ?? null,
				}))
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked]);

	// Push tap → deep route. Trade + bless/curse payloads carry
	// `data.screen` ('trade' or 'friends'); both open the Friends tab,
	// where the Inbox carries the request / event. One listener;
	// expo-notifications coalesces foreground + background taps.
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener((res) => {
			const data = (res.notification.request.content.data ?? {}) as {
				screen?: string;
			};
			if (data.screen === "trade" || data.screen === "friends") {
				router.replace("/friends" as any);
			}
		});
		return () => sub.remove();
	}, []);

	useEffect(() => {
		if (loaded && authChecked) {
			SplashScreen.hideAsync();
		}
	}, [loaded, authChecked]);

	if (!loaded || !authChecked) {
		return null;
	}

	return (
		<ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
			<Stack>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				{__DEV__ && (
					<Stack.Screen name="align" options={{ title: "Align Items" }} />
				)}
				<Stack.Screen name="+not-found" />
			</Stack>
			<StatusBar style="auto" />
			{schism && (
				<AlignmentSchismModal
					side={schism.side}
					score={schism.score}
					onDismiss={() => setSchism(null)}
				/>
			)}
			{finale && (
				<JudgementDayModal
					result={finale}
					onDismiss={() => setFinale(null)}
				/>
			)}
			{rituals && !schism && !finale && (
				<WhileAwayModal
					events={rituals}
					onDismiss={() => setRituals(null)}
				/>
			)}
		</ThemeProvider>
	);
}

// Wrap the root in Sentry's error boundary when DSN is configured.
// Otherwise just export RootLayoutInner directly.
const RootLayout = SENTRY_DSN ? Sentry.wrap(RootLayoutInner) : RootLayoutInner;
export default RootLayout;
