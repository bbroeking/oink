// Landing route for the OAuth redirect (ticklethepig://auth-callback).
//
// On Android the custom-scheme redirect is delivered to the router as a deep
// link rather than being caught by WebBrowser.openAuthSessionAsync, so without
// this route the callback path falls through to +not-found ("This screen
// doesn't exist"). This screen finishes the sign-in instead: it reads the
// tokens (implicit flow → access/refresh in the fragment) or code (PKCE →
// query) from the callback URL, sets the Supabase session, then steps back to
// the app. The (tabs) auth gate swaps SupaAuth for the barn the instant the
// session lands (its onAuthStateChange), so all this route has to do is leave
// — a Redirect to "/" resolves to the tabs group.
//
// If openAuthSessionAsync DID catch the redirect (a session already exists),
// this route simply redirects home without re-doing the exchange.
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import { supabase } from "@/utils/supabase";
import { paramsFromUrl } from "@/utils/authCallback";
import { WHIMSY } from "@/constants/theme";

export default function AuthCallback() {
	const url = Linking.useURL();
	const [done, setDone] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			// Already signed in (openAuthSessionAsync caught it) → just leave.
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (session) {
				if (!cancelled) setDone(true);
				return;
			}
			if (!url) return; // wait for the deep-link URL to arrive

			const params = paramsFromUrl(url);
			const code = params.get("code");
			if (code) {
				await supabase.auth.exchangeCodeForSession(code).catch(() => {});
			} else {
				const access_token = params.get("access_token");
				const refresh_token = params.get("refresh_token");
				if (access_token && refresh_token) {
					await supabase.auth
						.setSession({ access_token, refresh_token })
						.catch(() => {});
				}
			}
			if (!cancelled) setDone(true);
		})();
		return () => {
			cancelled = true;
		};
	}, [url]);

	if (done) return <Redirect href="/" />;
	return (
		<View style={styles.center}>
			<ActivityIndicator color={WHIMSY.ink} />
		</View>
	);
}

const styles = StyleSheet.create({
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: WHIMSY.paper,
	},
});
