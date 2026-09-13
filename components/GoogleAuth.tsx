// "Continue with Google" — the default sign-in on Android (Apple Sign-In is
// iOS-only, so Android's front door is Google + the shared email fallback).
// Standard Expo web-OAuth against Supabase, no native module: we open the
// provider URL in an auth session browser, then hand the callback back to
// Supabase. Two callback shapes are handled defensively — a PKCE `code` query
// param (exchangeCodeForSession) or implicit-flow tokens in the URL fragment
// (setSession). The client currently defaults to the implicit flow (see
// utils/supabase.ts — no `flowType` set), so the fragment path is primary, but
// both are covered so a later flip to PKCE keeps working.
//
// The button is the app's own `Button` in the `ghost` variant — Google's
// approved light-background treatment — carrying the OFFICIAL four-colour "G".
// It used to be a Caprasimo letter "G" on an ink pill: the only place in the
// app a letterform stood in for an icon, and a branding-compliance risk on the
// Play listing. [E23] (2026-09-11)
import React, { useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../utils/supabase";
import { paramsFromUrl } from "../utils/authCallback";
import { log } from "../utils/log";
import { Button } from "./ui";
import { ART_SIZE } from "@/constants/theme";

// Lets the auth session browser dismiss cleanly when it redirects back.
WebBrowser.maybeCompleteAuthSession();

// Google's brand hexes. The ONE sanctioned foreign palette in the app: a
// third-party mark may not be recoloured, so these are brand facts, not theme
// tokens — named here (never inline in the JSX) so nothing mistakes them for
// precedent. [E23] (2026-09-11)
const GOOGLE_BLUE = "#4285F4";
const GOOGLE_GREEN = "#34A853";
const GOOGLE_YELLOW = "#FBBC05";
const GOOGLE_RED = "#EA4335";

// The mark's drawing box — a glyph, not a spacing step.
const MARK_BOX = ART_SIZE.glyphSm;

function GoogleMark() {
	return (
		<View accessible={false}>
			<Svg width={MARK_BOX} height={MARK_BOX} viewBox="0 0 48 48">
				<Path
					fill={GOOGLE_BLUE}
					d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
				/>
				<Path
					fill={GOOGLE_GREEN}
					d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
				/>
				<Path
					fill={GOOGLE_YELLOW}
					d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
				/>
				<Path
					fill={GOOGLE_RED}
					d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
				/>
			</Svg>
		</View>
	);
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
		<Button
			full
			size="lg"
			variant="ghost"
			icon={<GoogleMark />}
			onPress={() => void handlePress()}
			loading={busy}
			loadingLabel="Opening Google…"
			accessibilityLabel="Continue with Google"
			accessibilityHint="Opens Google in a browser and brings you into the barn"
		>
			Continue with Google
		</Button>
	);
}
