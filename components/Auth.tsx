import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../utils/supabase";

export function Auth() {
	if (Platform.OS === "ios")
		return (
			<AppleAuthentication.AppleAuthenticationButton
				buttonType={
					AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
				}
				buttonStyle={
					AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
				}
				cornerRadius={5}
				style={{ width: 200, height: 64 }}
				onPress={async () => {
					console.log("pressed");
					try {
						console.log("trying");
						const credential =
							await AppleAuthentication.signInAsync({
								requestedScopes: [
									AppleAuthentication.AppleAuthenticationScope
										.FULL_NAME,
									AppleAuthentication.AppleAuthenticationScope
										.EMAIL,
								],
							});
						console.log(credential);
						// Sign in via Supabase Auth.
						if (credential.identityToken) {
							const {
								error,
								data: { user },
							} = await supabase.auth.signInWithIdToken({
								provider: "apple",
								token: credential.identityToken,
							});
							console.log(
								JSON.stringify({ error, user }, null, 2)
							);
							if (!error) {
								// User is signed in.
							}
						} else {
							console.log("no identityToken");
							throw new Error("No identityToken.");
						}
					} catch (e: any) {
						if (e.code === "ERR_REQUEST_CANCELED") {
							console.log("canceled");
							// handle that the user canceled the sign-in flow
						} else {
							console.log("error", e);
							// handle other errors
						}
					}
				}}
			/>
		);
	return <>{/* Implement Android Auth options. */}</>;
}
