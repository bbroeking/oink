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
import { supabase } from "@/utils/supabase";
import {
	AlignmentSchismModal,
	type SchismSide,
} from "@/components/AlignmentSchismModal";

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

	// Push tap → deep route. Payloads carry `data.screen='trade'` so
	// tapping a trade notification opens the Tickle Trade modal on
	// Barn. Only one listener; expo-notifications coalesces foreground
	// + background taps into the same callback.
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener((res) => {
			const data = (res.notification.request.content.data ?? {}) as {
				screen?: string;
			};
			if (data.screen === "trade") {
				// Land on Barn — TickleTradeModal will auto-refresh trades
				// on focus + the user can see the new state.
				router.replace("/");
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
		</ThemeProvider>
	);
}

// Wrap the root in Sentry's error boundary when DSN is configured.
// Otherwise just export RootLayoutInner directly.
const RootLayout = SENTRY_DSN ? Sentry.wrap(RootLayoutInner) : RootLayoutInner;
export default RootLayout;
