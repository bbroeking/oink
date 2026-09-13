// "Sign in with Apple" — the default sign-in on iOS (Android's front door is
// Google + the shared email fallback).
//
// SANCTIONED PLATFORM-CONTROL EXCEPTION (spec §3.1): platform sign-in controls
// keep their platform drawing. Apple's review guidance expects its own button —
// its type, mark, label and font — so this stays `AppleAuthenticationButton`
// rather than becoming a paper `Button`; only the two numbers it takes come
// from tokens, so it sits at the same corner and height as every other CTA in
// the gate chain. The native control exposes no accessibility props of its own,
// so a labelled wrapper speaks for it. (2026-09-11)
import { Platform, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";
import { BUTTON_SIZE, RADII } from "@/constants/theme";

export function AppleAuth() {
	if (Platform.OS !== "ios") {
		// Android sign-in is Google (see GoogleAuth). Return null — never an
		// empty frame — so no stray pill can render off-platform.
		return null;
	}
	return (
		<View
			accessibilityRole="button"
			accessibilityLabel="Sign in with Apple"
			accessibilityHint="Opens Apple's sign-in sheet and brings you into the barn"
		>
			<AppleAuthentication.AppleAuthenticationButton
				buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
				buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
				cornerRadius={RADII.xxl}
				style={styles.button}
				onPress={async () => {
					try {
						const credential = await AppleAuthentication.signInAsync({
							requestedScopes: [
								AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
								AppleAuthentication.AppleAuthenticationScope.EMAIL,
							],
						});
						if (!credential.identityToken) {
							throw new Error("Apple sign-in returned no identity token.");
						}
						const { error } = await supabase.auth.signInWithIdToken({
							provider: "apple",
							token: credential.identityToken,
						});
						// On success the Supabase session is set and the app's
						// auth listener routes onward — nothing to do here.
						if (error) log.error("Apple sign-in (Supabase) failed", error);
					} catch (e) {
						// A user-cancelled prompt is expected — ignore it.
						// expo-apple-authentication tags it with this code.
						const err = e as { code?: string };
						if (err.code !== "ERR_REQUEST_CANCELED") {
							log.error("Apple sign-in failed", e);
						}
					}
				}}
			/>
		</View>
	);
}

// Not a StyleSheet: the vendor control's frame is the one thing we do own, and
// both numbers are tokens — the md Button height and the button corner.
const styles = {
	button: { width: "100%" as const, height: BUTTON_SIZE.md.minH },
};
