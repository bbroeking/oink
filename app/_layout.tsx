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
import { useEffect, useState, useRef } from "react";
import { Alert, AppState, LogBox, Linking } from "react-native";
import "react-native-reanimated";

// Silence the bridgeless-Fabric "Unsupported dashed / dotted border
// style" warning. RN's new architecture refuses dashed borders on
// iOS, and 13 call sites across the app print this on every render —
// which the dev server buffers as JSON-RPC frames, OOM'ing Metro
// after a few hours of an open dev session. Dashed borders degrade
// gracefully to solid; the visual hit is small, the OOM-prevention
// is large. Replace with a real SVG <DashedDivider /> when we have
// the cycles.
// "Invalid Refresh Token": benign, self-healing startup noise. On launch
// auth-js's _recoverAndRefresh() tries to refresh a persisted session; if the
// stored refresh token was already rotated/expired (a stale session left in
// storage — common after reusing a sim/dev build) the server returns "Refresh
// Token Not Found". auth-js logs it via console.error AND immediately clears
// the session (_removeSession), so we're cleanly signed out — nothing to fix.
// A getSession().catch() can't intercept it (the error is emitted inside the
// library during init, not by our call), so we suppress the dev-only LogBox
// toast here instead. Dev-only: LogBox is a no-op in production.
LogBox.ignoreLogs([
	"Unsupported dashed",
	"Unsupported dotted",
	"Invalid Refresh Token",
]);
import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/utils/supabase";
import { rpc } from "@/utils/rpc";
import { routeForScreen } from "@/utils/notificationRouting";
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
	type WhileAwayEvent,
} from "@/components/WhileAwayModal";
import {
	AchievementUnlockModal,
	type UnlockedAchievement,
} from "@/components/AchievementUnlockModal";
import { AllegianceModal } from "@/components/AllegianceModal";
import { SounderLaunchModal } from "@/components/SounderLaunchModal";
import { GreatHungerIntroModal } from "@/components/GreatHungerIntroModal";
import {
	FeatureFlagsProvider,
	useFeatureFlag,
} from "@/hooks/useFeatureFlags";
import { fetchCrewState } from "@/utils/crews";
import { PurchaseToastHost } from "@/components/PurchaseToast";
import {
	PopupQueueProvider,
	usePopupSlot,
	POPUP_TEARDOWN_MS,
} from "@/components/ui/PopupQueue";
import {
	PENDING_REFERRAL_CODE_KEY,
	parseReferralCodeFromUrl,
	redeemReferralCode,
	referralErrorMessage,
} from "@/utils/referrals";
import {
	PENDING_REDEMPTION_CODE_KEY,
	parseRedemptionPayload,
} from "@/utils/redemption";
import {
	markCeremonyShown,
	ceremonyShownThisSession,
} from "@/utils/ceremonyGate";
import {
	anyPopupPresentedThisSession,
	sounderNudgeFiredThisSession,
	markSounderNudgeFired,
} from "@/utils/popupSession";

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

// How long the quiet-login Sounder nudge waits after its crew check before
// arming its want — long enough for the sibling popup polls (schism/finale/
// rituals/achievements/recap/intro) to land and present, so the
// anyPopupPresentedThisSession() AND-gate reflects a settled queue. A generous
// window: the nudge is the lowest-priority fallback, so a little extra quiet
// before it appears is fine.
const SOUNDER_NUDGE_SETTLE_MS = 1500;

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
	// Season 1 co-op dig visibility — server flag (Brian-overridden). Gates the
	// "start a Sounder" launch nudge.
	// Align with the Season tab's crew gate (world_boss || __DEV__). coop_dig
	// stayed false, so the Sounder launch nudge never fired even after the season
	// went live. See friends.tsx for the matching fix.
	const worldBoss = useFeatureFlag("world_boss");
	const coopDig = worldBoss || __DEV__;
	// Season 0: pending alignment-schism reveal. Set by the polling
	// effect below when a user first crosses ±25 alignment.
	const [schism, setSchism] = useState<{
		side: SchismSide;
		score: number;
		milestone: 25 | 50 | 100;
	} | null>(null);
	// Season 0 finale: pending Judgement Day verdict.
	const [finale, setFinale] = useState<FinaleResult | null>(null);
	// "While you were away" — bless/curse received since last launch.
	const [rituals, setRituals] = useState<WhileAwayEvent[] | null>(null);
	// The away-seen marker is written on modal DISMISS, not at fetch time —
	// writing at fetch meant a wedge/force-kill before the player saw the
	// modal permanently ate the batch (issue #8). Fetch stashes the value
	// here; the WhileAwayModal onDismiss persists it.
	const pendingAwaySeenRef = useRef<string | null>(null);
	// Earned-but-unseen achievements, shown one reveal at a time.
	const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
	// World Cup allegiance pick — shown once when the player hasn't chosen a
	// country yet and hasn't locally dismissed the prompt.
	const [showAllegiance, setShowAllegiance] = useState(false);
	// "Start a Sounder!" launch nudge: shown when the feature is live + the
	// player has no crew, ≤ once/day until they create/join one.
	const [sounderPrompt, setSounderPrompt] = useState(false);
	// The Great Hunger (Season 1) intro cinematic. The tale must tell itself on
	// the MAIN page at login (not only on the Season tab), so the FIRST-VIEW
	// auto-present is owned here at root — same gating as the old
	// season-tab effect (world_boss flag + not-yet-stamped s2_intro_seen:{uid}).
	// The Season tab keeps only the manual "Hear the tale again" replay path.
	// hungerIntroUid carries the user id so the dismiss handler can stamp.
	const [hungerIntro, setHungerIntro] = useState(false);
	const [hungerIntroUid, setHungerIntroUid] = useState<string | null>(null);

	// Global popup queue slots — every launch popup goes through PopupQueue so
	// only one shows at a time (across root AND the Barn tab). Lower priority
	// number shows first when several are pending.
	const schismSlot = usePopupSlot("schism", !!schism, 10);
	const finaleSlot = usePopupSlot("finale", !!finale, 20);
	const ritualsSlot = usePopupSlot("rituals", !!rituals, 30);
	// Suppressed for the session if a ceremony (recap / hungerIntro) fired —
	// the carousel surfaces next login instead (flip-day stacking ceiling).
	const achievementsSlot = usePopupSlot(
		"achievements",
		achievements.length > 0 && !ceremonyShownThisSession(),
		40
	);
	const allegianceSlot = usePopupSlot("allegiance", showAllegiance, 70);
	// Quiet-login Sounder nudge — the FALLBACK popup: "show them something about
	// joining a Sounder if no other dialog is going to show up" (founder, 2026-07).
	// LOW priority (90) so it can never preempt a real dialog, and its want ANDs
	// with anyPopupPresentedThisSession()'s negation so it's suppressed the moment
	// anything else presents this session. Fires at most once per SESSION (the
	// popupSession latch) — the old AsyncStorage daily cap is gone; the queue-empty
	// condition is the real limiter (see utils/popupSession.ts). markSounderNudge-
	// Fired() latches on present so it never re-arms mid-session.
	const sounderSlot = usePopupSlot(
		"sounderLaunch",
		sounderPrompt &&
			!anyPopupPresentedThisSession() &&
			!sounderNudgeFiredThisSession(),
		90
	);
	useEffect(() => {
		if (sounderSlot.visible) markSounderNudgeFired();
	}, [sounderSlot.visible]);
	// The flip-day ceremony chain is recap (seasonEnd, pri 25 in season.tsx) →
	// intro (pri 27): slotting the intro just ABOVE the recap guarantees it can
	// never co-present over the recap on the season-flip login.
	const hungerIntroSlot = usePopupSlot("hungerIntro", hungerIntro, 27);
	// The moment a ceremony PRESENTS (not on dismiss), latch the session gate so
	// the achievements carousel + release notes hold their `want` for next login
	// (flip-day stacking ceiling — SKILL.md 2026-07-11).
	useEffect(() => {
		if (hungerIntroSlot.visible) markCeremonyShown();
	}, [hungerIntroSlot.visible]);

	// Resolve the initial auth state before letting the splash drop, so we
	// transition straight into either auth or the home screen — no blank flash.
	useEffect(() => {
		supabase.auth.getSession().finally(() => setAuthChecked(true));
	}, []);

	// Tag the Sentry scope with the signed-in user so crashes/errors are
	// attributable (id + username) instead of anonymous — makes "Freddy and
	// Jen are having issues" something we can actually look up.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const { data } = await supabase.auth.getUser();
			if (cancelled) return;
			if (!data.user) {
				Sentry.setUser(null);
				return;
			}
			const { data: prof } = await supabase
				.from("profiles")
				.select("username")
				.eq("id", data.user.id)
				.maybeSingle();
			Sentry.setUser({
				id: data.user.id,
				username:
					(prof as { username?: string | null } | null)?.username ?? undefined,
			});
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked]);

	// Poll check_schism_status whenever we have an authenticated user
	// AND on every transition back to foreground. The RPC is fast (PK
	// lookup + two boolean checks). If it returns a side, the modal
	// mounts and the dismiss handler clears the state + writes
	// mark_schism_seen so the user never sees the same crossing twice.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		const check = async () => {
			const r = await rpc<{
				side?: string;
				score?: number;
				milestone?: number;
			}>("check_schism_status");
			if (cancelled) return;
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
			const r = await rpc<{ pending?: boolean } & Partial<FinaleResult>>(
				"my_finale_result"
			);
			if (cancelled) return;
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

	// World Cup allegiance — offer the "pick your country" modal. Shows on each
	// launch while the player has NOT yet chosen (profiles.allegiance_country
	// IS NULL), so the invite keeps surfacing for the rest of the tournament.
	// "Maybe later" only hides it for the current session (in-memory) — no
	// persistent dismiss — and it stops for good once they pick.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		const check = async () => {
			const { data: ures } = await supabase.auth.getUser();
			if (cancelled || !ures.user) return;
			const { data } = await supabase
				.from("profiles")
				.select("allegiance_country")
				.eq("id", ures.user.id)
				.maybeSingle();
			if (cancelled) return;
			if (data && !(data as { allegiance_country?: string | null }).allegiance_country) {
				setShowAllegiance(true);
			}
		};
		check();
	}, [authChecked]);

	// Sounder launch nudge — the quiet-login FALLBACK. Fires only when the feature
	// is live (the `coop_dig` server flag) AND the player has no crew. Unlike the
	// other launch popups it carries no persistent frequency stamp: the want is
	// gated (at the slot) on nothing-else-having-presented-this-session, which is
	// both the UX rule ("fill the quiet, never compete") and the frequency ceiling.
	// A short settle delay after the crew check lets the higher-priority popup polls
	// (schism / finale / rituals / achievements / recap / hunger intro) land and
	// present first, so "no other dialog is going to show" is actually knowable by
	// the time we arm the want. If one of them presented in that window,
	// anyPopupPresentedThisSession() is already true and the slot's want stays
	// false; if the queue is genuinely empty, the low-priority (90) nudge presents.
	useEffect(() => {
		if (!authChecked || !coopDig) return;
		let cancelled = false;
		(async () => {
			const { data: ures } = await supabase.auth.getUser();
			if (cancelled || !ures.user) return;
			const crew = await fetchCrewState();
			if (cancelled || crew.crew) return;
			// Settle beat: give the sibling popup polls a chance to arrive + present
			// before we arm. Mirrors how the slot's gating waits for authChecked —
			// the AND with anyPopupPresentedThisSession() is only meaningful once the
			// other sources have had a tick to declare their wants.
			await new Promise((r) => setTimeout(r, SOUNDER_NUDGE_SETTLE_MS));
			if (cancelled) return;
			// If anything already presented in the settle window, don't even arm —
			// the slot's want would evaluate false anyway, but skipping the state
			// set keeps the module-flag read authoritative without relying on a
			// re-render to drop a queued want.
			if (anyPopupPresentedThisSession() || sounderNudgeFiredThisSession()) {
				return;
			}
			setSounderPrompt(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked, coopDig]);

	// Great Hunger intro — first-view auto-present at login. Same gate the
	// Season tab used to own: the world_boss flag (coopDig = world_boss || DEV)
	// AND no `s2_intro_seen:{uid}` stamp yet. Queue-slotted (pri 27) so it
	// serializes behind the season-end recap on flip day and never fights it.
	useEffect(() => {
		if (!authChecked || !coopDig) return;
		let cancelled = false;
		(async () => {
			const { data: ures } = await supabase.auth.getUser();
			const me = ures?.user?.id;
			if (cancelled || !me) return;
			const seen = await AsyncStorage.getItem(`s2_intro_seen:${me}`);
			if (cancelled || seen) return;
			setHungerIntroUid(me);
			setHungerIntro(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked, coopDig]);

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

			// System announcements — admin-issued messages that
			// persist server-side. Independent of the `since` marker
			// because the server tracks seen_at per row (so a fresh
			// install still gets every unread announcement, not just
			// ones newer than first-launch). Marked seen on modal
			// dismiss via mark_announcement_seen.
			const systemRows = await (async () => {
				const data = await rpc<
					{
						id: number;
						kind: string;
						title: string;
						body: string;
						data: unknown;
						dispatched_at: string;
					}[]
				>("my_unseen_announcements");
				return data ?? [];
			})();

			// Normalize all events to a shared shape so we can sort + cap
			// uniformly. `ts` is the comparable timestamp; `actor_id` is
			// who to look up a display name for. System rows skip the
			// actor lookup (no sender) but carry their own title/body.
			type Norm = {
				source: "blessing" | "curse" | "trade_fulfilled" | "system";
				ts: string;
				actor_id?: string;
				kind?: string;
				amount?: number;
				// system-only
				announcement_id?: number;
				title?: string;
				body?: string;
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
				...systemRows.map<Norm>((r) => ({
					source: "system",
					ts: r.dispatched_at,
					announcement_id: r.id,
					title: r.title,
					body: r.body,
				})),
			];

			if (cancelled) return;
			if (all.length === 0) {
				// Advance the marker so a first launch never dredges history.
				AsyncStorage.setItem(SEEN, new Date().toISOString());
				return;
			}
			// Profile hydration only needed for rows with an actor_id
			// (rituals + trades). System rows skip this.
			const actorIds = [
				...new Set(all.map((r) => r.actor_id).filter((x): x is string => !!x)),
			];
			let byId = new Map<string, string | null>();
			if (actorIds.length > 0) {
				const { data: profs } = await supabase
					.from("profiles")
					.select("id, username")
					.in("id", actorIds);
				if (cancelled) return;
				byId = new Map(
					((profs ?? []) as { id: string; username: string | null }[]).map(
						(p) => [p.id, p.username]
					)
				);
			}
			all.sort((a, b) => (a.ts < b.ts ? 1 : -1));
			// Marker semantics: newest ritual/trade ts when present (system
			// rows have their own server-side seen tracking); otherwise
			// fetch-time now — system-ONLY batches must still persist a
			// marker on dismiss, or a fresh install re-anchors `since` to
			// "now" every boot and silently skips between-launch rituals.
			// Stashed here, WRITTEN on modal dismiss (see render below).
			const nonSystemNewest = all.find((r) => r.source !== "system");
			pendingAwaySeenRef.current =
				nonSystemNewest?.ts ?? new Date().toISOString();
			setRituals(
				all.map<WhileAwayEvent>((r) => {
					if (r.source === "system") {
						return {
							source: "system",
							announcementId: r.announcement_id ?? 0,
							title: r.title ?? "",
							body: r.body ?? "",
						};
					}
					const from = r.actor_id ? byId.get(r.actor_id) ?? null : null;
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
			const rows =
				(await rpc<
					(UnlockedAchievement & {
						claimed: boolean;
						viewed_at: string | null;
						display_order: number;
					})[]
				>("my_achievements")) ?? [];
			if (cancelled) return;
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

	// Referral deep-link handler. Universal Link
	// `https://ticklethepig.com/i/<code>` (canonical; legacy /r/<code>
	// still parses) → app:
	//   - if signed in, prompt to apply (rare; existing user
	//     opened the link by mistake; gate-cross is unlikely so
	//     misuse doesn't matter)
	//   - if not signed in, stash the code in AsyncStorage under
	//     PENDING_REFERRAL_CODE_KEY; the onboarding code-entry
	//     step reads + clears it on mount.
	// Runs against the cold-launch URL (Linking.getInitialURL) AND
	// any URL received while the app is foregrounded.
	useEffect(() => {
		let cancelled = false;

		const handle = async (url: string | null) => {
			const code = parseReferralCodeFromUrl(url);
			if (!code) return;

			// If we already have a session, prompt before applying —
			// the canonical use case is "friend forwarded their link
			// to an existing user"; almost never crosses the gate, so
			// rare misapplication is acceptable. If unauthenticated,
			// stash for onboarding to pick up.
			const { data } = await supabase.auth.getSession();
			if (cancelled) return;
			if (!data.session) {
				await AsyncStorage.setItem(PENDING_REFERRAL_CODE_KEY, code);
				return;
			}

			Alert.alert(
				"Apply your friend's code?",
				`Add ${code} to your account?`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Apply",
						onPress: async () => {
							const result = await redeemReferralCode(code);
							if (result?.ok) {
								Alert.alert(
									"Code applied",
									result.inviter_username
										? `You're now in ${result.inviter_username}'s sounder. +50 snouts.`
										: "+50 snouts landed."
								);
							} else {
								Alert.alert(
									"Couldn't apply",
									referralErrorMessage(result?.reason)
								);
							}
						},
					},
				]
			);
		};

		// Cold launch.
		Linking.getInitialURL().then(handle);
		// Foreground URL events (Universal Link tap from outside the app).
		const sub = Linking.addEventListener("url", (event) => handle(event.url));

		return () => {
			cancelled = true;
			sub.remove();
		};
	}, []);

	// Golden-Ticket redemption deep-link handler. Universal Link
	// `https://ticklethepig.com/redeem/<CODE>` (or the custom scheme
	// `ticklethepig://redeem/<CODE>`):
	//   - if signed in → push the scan-code screen with the code as a param;
	//     scan-code prefills the field and auto-submits.
	//   - if not signed in → stash under PENDING_REDEMPTION_CODE_KEY (mirror of
	//     the referral stash); scan-code redeems it after a session exists.
	// Only fires for /redeem/ links; parseRedemptionPayload returns null for
	// anything else (referral /i/ /r/ links stay owned by the handler above).
	useEffect(() => {
		let cancelled = false;

		const handle = async (url: string | null) => {
			if (!url || !/\/redeem\//i.test(url)) return;
			const code = parseRedemptionPayload(url);
			if (!code) return;

			const { data } = await supabase.auth.getSession();
			if (cancelled) return;
			if (!data.session) {
				await AsyncStorage.setItem(PENDING_REDEMPTION_CODE_KEY, code);
				return;
			}
			router.push({ pathname: "/scan-code", params: { code } });
		};

		Linking.getInitialURL().then(handle);
		const sub = Linking.addEventListener("url", (event) => handle(event.url));

		return () => {
			cancelled = true;
			sub.remove();
		};
	}, []);

	// Post-auth Golden-Ticket redemption pickup. The deep-link handler above
	// stashes a redemption code under PENDING_REDEMPTION_CODE_KEY when the tap
	// arrives signed-out (the primary booth flow: scan → install → sign up).
	// Nothing else consumes that stash, so without this the grant is silently
	// dropped. Mirror the referral deep-link pattern (Alert-then-navigate): once
	// a session exists, if a pending code is stashed, prompt and route to
	// /scan-code (which prefills + auto-submits it), then clear the key so it can
	// never re-fire later.
	useEffect(() => {
		if (!authChecked) return;
		let cancelled = false;
		(async () => {
			const code = await AsyncStorage.getItem(PENDING_REDEMPTION_CODE_KEY);
			if (cancelled || !code) return;
			const { data } = await supabase.auth.getSession();
			if (cancelled || !data.session) return;
			// Clear FIRST so this fires at most once even if the prompt is left open.
			await AsyncStorage.removeItem(PENDING_REDEMPTION_CODE_KEY);
			if (cancelled) return;
			Alert.alert(
				"Redeem your Golden Ticket?",
				"You scanned a code before signing in. Claim it now?",
				[
					{ text: "Later", style: "cancel" },
					{
						text: "Redeem",
						onPress: () =>
							router.push({ pathname: "/scan-code", params: { code } }),
					},
				]
			);
		})();
		return () => {
			cancelled = true;
		};
	}, [authChecked]);

	// Push tap → deep route. Payload `data.screen` drives where the
	// tap lands:
	//   'trade' / 'friends' → Friends tab (Inbox carries the event)
	//   'achievements'      → /achievements (claim the new unlock)
	// One listener; expo-notifications coalesces foreground +
	// background taps.
	useEffect(() => {
		const route = (screen: string | undefined) => {
			const path = routeForScreen(screen);
			if (path) router.replace(path as never);
		};
		// Cold launch: the app was opened by TAPPING a push while terminated.
		// addNotificationResponseReceivedListener does NOT fire for that case, so
		// read the response that launched us and route from it once.
		Notifications.getLastNotificationResponseAsync().then((res) => {
			if (res) {
				const data = res.notification.request.content.data as { screen?: string };
				route(data?.screen);
			}
		});
		// Warm/foreground taps. routeForScreen is the single source of truth for
		// the screen→route map (utils/notificationRouting) so the server's push
		// `screen` values and the client router can't drift.
		const sub = Notifications.addNotificationResponseReceivedListener((res) => {
			const data = res.notification.request.content.data as { screen?: string };
			route(data?.screen);
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
			{/* Launch popups all route through the global PopupQueue. Each
			    mounts on its own state, but the NATIVE modal's `visible` is
			    driven by its queue slot, and the dismiss handlers are
			    two-phase: release() hides the modal first, the state clears
			    a POPUP_TEARDOWN_MS beat later. A presented modal is never
			    unmounted mid-flight, so the next one can't present into an
			    in-progress teardown and come up invisible (the iOS
			    "stuck/invisible" bug — see PopupQueue.tsx). */}
			{schism && (
				<AlignmentSchismModal
					visible={schismSlot.visible}
					side={schism.side}
					score={schism.score}
					milestone={schism.milestone}
					onDismiss={() => {
						schismSlot.release();
						setTimeout(() => setSchism(null), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{finale && (
				<JudgementDayModal
					visible={finaleSlot.visible}
					result={finale}
					onDismiss={() => {
						finaleSlot.release();
						setTimeout(() => setFinale(null), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{rituals && (
				<WhileAwayModal
					visible={ritualsSlot.visible}
					events={rituals}
					onDismiss={() => {
						// Server-side mark-seen for any system announcements
						// in the batch. Fire-and-forget; if the network is
						// down the rows stay unseen and reappear next launch,
						// which is the correct conservative behavior.
						rituals.forEach((e) => {
							if (e.source === "system") {
								rpc("mark_announcement_seen", {
									announcement_id: e.announcementId,
								}).then(() => {});
							}
						});
						// Persist the away-seen marker only now that the player
						// actually SAW the batch (see pendingAwaySeenRef).
						if (pendingAwaySeenRef.current) {
							AsyncStorage.setItem("away_seen_v1", pendingAwaySeenRef.current);
							pendingAwaySeenRef.current = null;
						}
						ritualsSlot.release();
						setTimeout(() => setRituals(null), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{achievements.length > 0 && (
				<AchievementUnlockModal
					visible={achievementsSlot.visible}
					achievement={achievements[0]}
					onDismiss={() => {
						achievementsSlot.release();
						// Advance AFTER the beat: while more unlocks remain,
						// `want` stays true so the slot re-requests and the
						// queue presents the next one once the gap clears.
						setTimeout(
							() => setAchievements((q) => q.slice(1)),
							POPUP_TEARDOWN_MS
						);
					}}
				/>
			)}
			{showAllegiance && (
				<AllegianceModal
					visible={allegianceSlot.visible}
					onSkip={() => {
						allegianceSlot.release();
						setTimeout(() => setShowAllegiance(false), POPUP_TEARDOWN_MS);
					}}
					onChosen={() => {
						allegianceSlot.release();
						setTimeout(() => setShowAllegiance(false), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{sounderPrompt && (
				<SounderLaunchModal
					visible={sounderSlot.visible}
					onCreate={() => {
						// No persistent daily stamp anymore — the session latch
						// (markSounderNudgeFired on present) + the queue-empty gate
						// are the frequency ceiling. Two-phase dismiss per the
						// PopupQueue TIMING CONTRACT.
						sounderSlot.release();
						setTimeout(() => setSounderPrompt(false), POPUP_TEARDOWN_MS);
						router.push("/(tabs)/friends?seg=sounder");
					}}
					onDismiss={() => {
						sounderSlot.release();
						setTimeout(() => setSounderPrompt(false), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{/* Great Hunger intro — the tale, told at login on the main page.
			    Queue-slotted at pri 27 (just above the season-end recap) so on
			    flip day the chain is recap → intro, never both at once. */}
			{hungerIntro && (
				<GreatHungerIntroModal
					visible={hungerIntroSlot.visible}
					onDone={() => {
						hungerIntroSlot.release();
						if (hungerIntroUid) {
							AsyncStorage.setItem(`s2_intro_seen:${hungerIntroUid}`, "1").catch(
								() => {}
							);
						}
						setTimeout(() => setHungerIntro(false), POPUP_TEARDOWN_MS);
					}}
				/>
			)}
			{/* Purchase toast — global, slides down from the top on
			    shop buys + Slop Club join. Stays mounted; quiet until
			    showPurchaseToast() is called from anywhere. */}
			<PurchaseToastHost />
		</ThemeProvider>
	);
}

// The PopupQueue provider must sit ABOVE everything that pops a modal — both the
// root launch modals here AND the Barn-tab modals inside the Stack — so they all
// share one arbiter and show strictly one at a time.
function RootLayoutWithQueue() {
	return (
		<PopupQueueProvider>
			<FeatureFlagsProvider>
				<RootLayoutInner />
			</FeatureFlagsProvider>
		</PopupQueueProvider>
	);
}

// Wrap the root in Sentry's error boundary when DSN is configured.
// Otherwise just export RootLayoutWithQueue directly.
const RootLayout = SENTRY_DSN ? Sentry.wrap(RootLayoutWithQueue) : RootLayoutWithQueue;
export default RootLayout;
