import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../utils/supabase";
import { log } from "../utils/log";

export function AppleAuth() {
	if (Platform.OS !== "ios") {
		return <>{/* Android sign-in is handled elsewhere. */}</>;
	}
	return (
		<AppleAuthentication.AppleAuthenticationButton
			buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
			buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
			cornerRadius={12}
			style={{ width: "100%", height: 52 }}
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
	);
}
