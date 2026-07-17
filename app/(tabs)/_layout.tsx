import { Tabs } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, AppState, Image, Text, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../utils/supabase";
import { rpc } from "@/utils/rpc";
import SupaAuth from "@/components/SupaAuth";
import UsernameSetup from "@/components/UsernameSetup";
import { Onboarding } from "@/components/Onboarding";
import { ReferralCodeEntry } from "@/components/ReferralCodeEntry";
import { HangingSignsTabBar } from "@/components/ui/HangingSignsTabBar";
import { Button } from "@/components/ui/Button";
import { ActiveEffectsProvider } from "@/hooks/ActiveEffectsProvider";
import { WHIMSY, KICKER_TEXT, TYPE } from "@/constants/theme";
import { initIAP } from "@/utils/iap";
import { usePopupHold } from "@/components/ui/PopupQueue";
import {
	USERNAME_BACKOFF_MS,
	retryDelayMs,
	resolveUsernameFetch,
} from "@/utils/bootRetry";

export default function TabLayout() {
	const [session, setSession] = useState<Session | null>(null);
	const [username, setUsername] = useState<string | null | undefined>(undefined);
	const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
	// Referral code-entry step. Sits between UsernameSetup (where
	// the user picks a display name) and the storybook Onboarding,
	// per the spec's "immediately after username + display-name are
	// chosen, before the Barn is shown" placement.
	const [needsReferralStep, setNeedsReferralStep] = useState<boolean | null>(
		null
	);

	// Block ALL launch popups (root _layout mounts them above this whole
	// Stack) while any pre-shell gate screen is up: signed out, the
	// "saddling up" profile fetch, username setup, onboarding, or the
	// referral step. Wants queue behind the hold and present once the
	// player actually lands in the app shell. Without this a reinstall
	// (AsyncStorage wipe re-arms onboarding while a seasoned account's
	// schism/finale/achievements all want at boot) stacked native modals
	// on top of the onboarding storybook — "stuck on Hi, I'm Rosie!".
	usePopupHold(
		!session ||
			username === undefined ||
			!username ||
			needsOnboarding !== false ||
			needsReferralStep !== false
	);

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

	// The "saddling up" gate spins while username === undefined. An offline
	// boot used to hang that spinner forever (the profile fetch threw, nothing
	// caught it). Retry with a modest backoff, and once it's exhausted flip
	// usernameError so the gate offers a manual retry instead (spec 03 / issue
	// #5). CRITICAL: a failed fetch must NEVER setUsername(null) — that would
	// route a named pig to UsernameSetup. resolveUsernameFetch keeps the
	// undefined-on-error / null-only-on-success invariant.
	const [usernameError, setUsernameError] = useState(false);
	const usernameAttemptRef = useRef(0);
	const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const refetchUsernameRef = useRef<() => void>(() => {});

	const clearUsernameRetry = useCallback(() => {
		if (usernameTimerRef.current != null) {
			clearTimeout(usernameTimerRef.current);
			usernameTimerRef.current = null;
		}
	}, []);

	const refetchUsername = useCallback(async () => {
		if (!session) return;
		setUsernameError(false);
		try {
			const { data, error } = await supabase
				.from("profiles")
				.select("username")
				.eq("id", session.user.id)
				.single();
			const resolved = resolveUsernameFetch({ data, error });
			if (resolved === undefined) {
				// Fetch failed — fall through to the retry path; never treat this
				// as "no username".
				throw error ?? new Error("username fetch failed");
			}
			usernameAttemptRef.current = 0;
			clearUsernameRetry();
			setUsername(resolved);
		} catch {
			const delay = retryDelayMs(usernameAttemptRef.current, USERNAME_BACKOFF_MS);
			if (delay == null) {
				setUsernameError(true);
				return;
			}
			usernameAttemptRef.current += 1;
			clearUsernameRetry();
			usernameTimerRef.current = setTimeout(() => {
				usernameTimerRef.current = null;
				refetchUsernameRef.current();
			}, delay);
		}
	}, [session, clearUsernameRetry]);
	refetchUsernameRef.current = refetchUsername;

	// Manual retry from the gate affordance — reset the backoff so the button
	// gets a full fresh round of attempts, not a single already-exhausted try.
	const retryUsername = useCallback(() => {
		usernameAttemptRef.current = 0;
		refetchUsername();
	}, [refetchUsername]);

	useEffect(() => {
		refetchUsername();
		return () => {
			clearUsernameRetry();
		};
	}, [refetchUsername, clearUsernameRetry]);

	useEffect(() => {
		AsyncStorage.getItem("seen_onboarding").then((v) => {
			setNeedsOnboarding(v !== "1");
		});
		// Referral code-entry is bypassed for now — never force the step, so
		// every user skips straight past it. (Re-enable by restoring:
		//   hasSeenReferralStep().then((seen) => setNeedsReferralStep(!seen));
		// and re-importing hasSeenReferralStep.)
		setNeedsReferralStep(false);
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
			const data = await rpc<number>("bounty_ready_count");
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
		// Profile lookup in flight — show Rosie on a cream backdrop
		// so the loading beat reads as a continuation of the splash
		// (was a bare black screen, which felt like a crash). If the
		// fetch keeps failing (offline boot), swap the endless spinner
		// for a retry button so the gate can't hang forever. The popup
		// hold stays engaged the whole time (username is still
		// undefined) so no launch modal leaks over this screen.
		return (
			<View
				style={{
					flex: 1,
					backgroundColor: WHIMSY.cream,
					alignItems: "center",
					justifyContent: "center",
					gap: 14,
					paddingHorizontal: 32,
				}}
			>
				<Image
					source={require("../../assets/images/sprites/rosie/idle_1.png")}
					style={{ width: 200, height: 207 }}
					resizeMode="contain"
				/>
				{usernameError ? (
					<>
						<Text style={KICKER_TEXT}>★ the barn's being shy ★</Text>
						<Text
							style={[
								TYPE.hand,
								{ color: WHIMSY.mute, textAlign: "center", marginBottom: 4 },
							]}
						>
							Couldn't reach the farm. Give it another nudge.
						</Text>
						<Button variant="primary" onPress={retryUsername}>
							Try again
						</Button>
					</>
				) : (
					<>
						<Text style={KICKER_TEXT}>★ saddling up ★</Text>
						<ActivityIndicator color={WHIMSY.ink} />
					</>
				)}
			</View>
		);
	}

	if (!username) {
		return <UsernameSetup userId={session.user.id} onSaved={refetchUsername} />;
	}

	if (needsReferralStep) {
		return (
			<ReferralCodeEntry onDone={() => setNeedsReferralStep(false)} />
		);
	}

	if (needsOnboarding) {
		return <Onboarding onDone={() => setNeedsOnboarding(false)} />;
	}

	return (
		// One shared active-effects instance for the whole tab subtree, so a
		// cleanse on the Barn/Inbox updates the overlay, chips, sheet, and inbox
		// in lockstep (see ActiveEffectsProvider).
		<ActiveEffectsProvider>
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
		</ActiveEffectsProvider>
	);
}
