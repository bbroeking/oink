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
import { AppState, LogBox } from "react-native";
import "react-native-reanimated";

// Silence the bridgeless-Fabric "Unsupported dashed / dotted border
// style" warning. RN's new architecture refuses dashed borders on
// iOS, and 13 call sites across the app print this on every render —
// which the dev server buffers as JSON-RPC frames, OOM'ing Metro
// after a few hours of an open dev session. Dashed borders degrade
// gracefully to solid; the visual hit is small, the OOM-prevention
// is large. Replace with a real SVG <DashedDivider /> when we have
// the cycles.
LogBox.ignoreLogs(["Unsupported dashed", "Unsupported dotted"]);
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
import {
	AchievementUnlockModal,
	type UnlockedAchievement,
} from "@/components/AchievementUnlockModal";
import { PurchaseToastHost } from "@/components/PurchaseToast";

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
	const [schism, setSchism] = useState<{
		side: SchismSide;
		score: number;
		milestone: 25 | 50 | 100;
	} | null>(null);
	// Season 1 finale: pending Judgement Day verdict.
	const [finale, setFinale] = useState<FinaleResult | null>(null);
	// "While you were away" — bless/curse received since last launch.
	const [rituals, setRituals] = useState<RitualEvent[] | null>(null);
	// Earned-but-unseen achievements, shown one reveal at a time.
	const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);

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
			const r = data as {
				side?: string;
				score?: number;
				milestone?: number;
			} | null;
			if (r?.side === "angel" || r?.side === "goblin") {
				// Milestone defaults to 25 to match the pre-milestone
				// server's return shape (and pre-migration installs).
				const ms = r.milestone === 50 || r.milestone === 100 ? r.milestone : 25;
				setSchism({ side: r.side, score: r.score ?? 0, milestone: ms });
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

	// "While you were away" — surface blessings + curses RECEIVED
	// and trades ANSWERED since the last launch. Tracked client-side
	// via AsyncStorage (`away_seen_v1` = the newest event timestamp
	// already shown; falls back to legacy `rituals_seen_v1` for
	// upgraded installs). The events also live in the Friends-tab
	// Inbox; this is the can't-miss-it launch announcement. Runs
	// once on auth.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		(async () => {
			const { data: ures } = await supabase.auth.getUser();
			const me = ures?.user?.id;
			if (!me || cancelled) return;
			const SEEN = "away_seen_v1";
			const LEGACY = "rituals_seen_v1";
			const since =
				(await AsyncStorage.getItem(SEEN)) ??
				(await AsyncStorage.getItem(LEGACY)) ??
				new Date().toISOString();

			// Rituals: blessings + curses where receiver = me.
			const ritualSide = async (table: "blessings" | "curses") => {
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

			// Trades you requested that got fulfilled while you were
			// gone — celebratory because the +2N tickles already
			// landed in your barn. Pending requests aren't surfaced
			// here; those sit in the Inbox actionable band where they
			// belong (they need a tap, not a "got it" dismiss).
			const tradeRows = await (async () => {
				const { data } = await supabase
					.from("tickle_trades")
					.select("id, amount, target_id, fulfilled_at")
					.eq("requester_id", me)
					.eq("status", "fulfilled")
					.gt("fulfilled_at", since)
					.order("fulfilled_at", { ascending: false })
					.limit(20);
				return (data ?? []) as {
					id: string;
					amount: number;
					target_id: string;
					fulfilled_at: string;
				}[];
			})();

			// Normalize all events to a shared shape so we can sort + cap
			// uniformly. `ts` is the comparable timestamp; `actor_id` is
			// who to look up a display name for.
			type Norm = {
				source: "blessing" | "curse" | "trade_fulfilled";
				ts: string;
				actor_id: string;
				kind?: string;
				amount?: number;
			};
			const all: Norm[] = [
				...(await ritualSide("blessings")).map<Norm>((r) => ({
					source: "blessing",
					ts: r.sent_at,
					actor_id: r.sender_id,
					kind: r.kind,
				})),
				...(await ritualSide("curses")).map<Norm>((r) => ({
					source: "curse",
					ts: r.sent_at,
					actor_id: r.sender_id,
					kind: r.kind,
				})),
				...tradeRows.map<Norm>((r) => ({
					source: "trade_fulfilled",
					ts: r.fulfilled_at,
					actor_id: r.target_id,
					amount: r.amount,
				})),
			];

			if (cancelled) return;
			if (all.length === 0) {
				// Advance the marker so a first launch never dredges history.
				AsyncStorage.setItem(SEEN, new Date().toISOString());
				return;
			}
			const ids = [...new Set(all.map((r) => r.actor_id))];
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
			all.sort((a, b) => (a.ts < b.ts ? 1 : -1));
			AsyncStorage.setItem(SEEN, all[0].ts);
			setRituals(
				all.map<RitualEvent>((r) => {
					const from = byId.get(r.actor_id) ?? null;
					if (r.source === "trade_fulfilled") {
						return { source: "trade_fulfilled", amount: r.amount ?? 0, from };
					}
					return { source: r.source, kind: r.kind ?? "", from };
				})
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked]);

	// Achievement reveals — surface achievements earned but not yet
	// seen (claimed = true, viewed_at = null). Shown one at a time;
	// AchievementUnlockModal marks each viewed on dismiss. Polls on
	// launch + foreground, but never clobbers an in-progress queue.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		const check = async () => {
			const { data } = await supabase.rpc("my_achievements");
			if (cancelled) return;
			const rows =
				(data as
					| (UnlockedAchievement & {
							claimed: boolean;
							viewed_at: string | null;
							display_order: number;
					  })[]
					| null) ?? [];
			const unseen = rows
				.filter((r) => r.claimed && !r.viewed_at)
				.sort((a, b) => a.display_order - b.display_order)
				.map((r) => ({
					id: r.id,
					name: r.name,
					description: r.description,
					icon: r.icon,
					reward_title_id: r.reward_title_id,
					reward_item_id: r.reward_item_id,
					reward_snouts: r.reward_snouts,
					level: r.level,
					is_top_tier: r.is_top_tier,
				}));
			setAchievements((cur) => (cur.length > 0 ? cur : unseen));
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

	// Push tap → deep route. Payload `data.screen` drives where the
	// tap lands:
	//   'trade' / 'friends' → Friends tab (Inbox carries the event)
	//   'achievements'      → /achievements (claim the new unlock)
	// One listener; expo-notifications coalesces foreground +
	// background taps.
	useEffect(() => {
		const sub = Notifications.addNotificationResponseReceivedListener((res) => {
			const data = (res.notification.request.content.data ?? {}) as {
				screen?: string;
			};
			if (data.screen === "trade" || data.screen === "friends") {
				router.replace("/friends" as any);
			} else if (data.screen === "achievements") {
				router.replace("/achievements" as any);
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
					milestone={schism.milestone}
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
			{achievements.length > 0 && !schism && !finale && !rituals && (
				<AchievementUnlockModal
					achievement={achievements[0]}
					onDismiss={() => setAchievements((q) => q.slice(1))}
				/>
			)}
			{/* Purchase toast — global, slides down from the top on
			    shop buys + Slop Club join. Stays mounted; quiet until
			    showPurchaseToast() is called from anywhere. */}
			<PurchaseToastHost />
		</ThemeProvider>
	);
}

// Wrap the root in Sentry's error boundary when DSN is configured.
// Otherwise just export RootLayoutInner directly.
const RootLayout = SENTRY_DSN ? Sentry.wrap(RootLayoutInner) : RootLayoutInner;
export default RootLayout;
