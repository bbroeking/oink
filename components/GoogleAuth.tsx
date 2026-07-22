// "Continue with Google" — the default sign-in on Android (Apple Sign-In is
// iOS-only, so Android's front door is Google + the shared email fallback).
// Standard Expo web-OAuth against Supabase, no native module: we open the
// provider URL in an auth session browser, then hand the callback back to
// Supabase. Two callback shapes are handled defensively — a PKCE `code` query
// param (exchangeCodeForSession) or implicit-flow tokens in the URL fragment
// (setSession). The client currently defaults to the implicit flow (see
// utils/supabase.ts — no `flowType` set), so the fragment path is primary, but
// both are covered so a later flip to PKCE keeps working.
import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";
import { WHIMSY, FONTS, RADII } from "@/constants/theme";

// Lets the auth session browser dismiss cleanly when it redirects back.
WebBrowser.maybeCompleteAuthSession();

// Pull auth params from either the query string or the fragment. Supabase's
// implicit flow returns access_token/refresh_token in the fragment; a PKCE
// setup would return `code` in the query. We read both.
function paramsFromUrl(url: string): URLSearchParams {
	const merged = new URLSearchParams();
	try {
		const u = new URL(url);
		u.searchParams.forEach((v, k) => merged.set(k, v));
		const frag = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
		if (frag) {
			new URLSearchParams(frag).forEach((v, k) => merged.set(k, v));
		}
	} catch {
		// Malformed callback URL — fall through to an empty set, which the
		// caller treats as "no session came back" and shows the friendly note.
	}
	return merged;
}

export function GoogleAuth({ onError }: { onError?: (msg: string) => void }) {
	const [busy, setBusy] = useState(false);

	const fail = (msg: string, e?: unknown) => {
		if (e) log.error("Google sign-in failed", e);
		onError?.(msg);
	};

	const handlePress = async () => {
		if (busy) return;
		setBusy(true);
		try {
			// Force the app's OWN scheme so the redirect returns to the native
			// app. Left to itself, createURL emits the dev-only exp+ttp:// form in
			// a dev client — which isn't in Supabase's redirect allow-list, so
			// Supabase falls back to the Site URL (localhost:8081) and the OAuth
			// lands on the WEB build instead of coming home. ticklethepig:// is
			// registered by both the custom dev build and release, and is the one
			// URL allow-listed in Supabase → openAuthSessionAsync catches it and
			// hands the tokens back here.
			const redirectTo = Linking.createURL("auth-callback", {
				scheme: "ticklethepig",
			});

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: { redirectTo, skipBrowserRedirect: true },
			});
			// No URL back usually means the provider isn't configured server-side
			// yet (Supabase dashboard work pending) — degrade to the note, no crash.
			if (error || !data?.url) {
				fail("google didn't answer — try email instead.", error ?? undefined);
				return;
			}

			const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
			if (result.type === "cancel" || result.type === "dismiss") {
				// User backed out — fail quiet.
				return;
			}
			if (result.type !== "success" || !result.url) {
				fail("google didn't answer — try email instead.");
				return;
			}

			const params = paramsFromUrl(result.url);
			const oauthErr = params.get("error_description") || params.get("error");
			if (oauthErr) {
				fail("google didn't answer — try email instead.", oauthErr);
				return;
			}

			const code = params.get("code");
			if (code) {
				const { error: exchErr } =
					await supabase.auth.exchangeCodeForSession(code);
				if (exchErr) {
					fail("google didn't answer — try email instead.", exchErr);
					return;
				}
			} else {
				const access_token = params.get("access_token");
				const refresh_token = params.get("refresh_token");
				if (!access_token || !refresh_token) {
					fail("google didn't answer — try email instead.");
					return;
				}
				const { error: sessErr } = await supabase.auth.setSession({
					access_token,
					refresh_token,
				});
				if (sessErr) {
					fail("google didn't answer — try email instead.", sessErr);
					return;
				}
			}
			// On success the Supabase session is set and the app's auth listener
			// routes onward — nothing to do here.
		} catch (e) {
			fail("google didn't answer — try email instead.", e);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Pressable
			onPress={handlePress}
			disabled={busy}
			style={({ pressed }) => [
				styles.btn,
				(pressed || busy) && { opacity: 0.7 },
			]}
			accessibilityRole="button"
			accessibilityLabel="Continue with Google"
		>
			<View style={styles.gBadge}>
				<Text style={styles.gMark}>G</Text>
			</View>
			<Text style={styles.label}>
				{busy ? "Opening Google…" : "Continue with Google"}
			</Text>
		</Pressable>
	);
}

// Matches AppleAuth's visual weight — full-width, 52-tall, radius 12 — but in
// the paper-craft idiom: ink fill with paper text (the storybook parallel to
// Apple's black-and-white), a paper "G" chip standing in for the wordmark.
const styles = StyleSheet.create({
	btn: {
		width: "100%",
		height: 52,
		borderRadius: RADII.md,
		borderWidth: 2,
		borderColor: WHIMSY.ink,
		backgroundColor: WHIMSY.ink,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
	},
	gBadge: {
		width: 24,
		height: 24,
		borderRadius: RADII.sm,
		backgroundColor: WHIMSY.paper,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 10,
	},
	gMark: {
		fontFamily: FONTS.whimsy,
		fontSize: 16,
		color: WHIMSY.ink,
	},
	label: {
		fontFamily: FONTS.whimsy,
		fontSize: 17,
		color: WHIMSY.paper,
	},
});
