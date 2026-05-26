// Push-notification permission + token registration.
//
// We DO NOT ask for permission on app launch — Apple's grant rate is
// dramatically higher when the prompt is tied to a feature the user
// already cares about. Call `ensurePushPermission()` the first time
// a user touches a social surface (Friends tab, Tickle Trade pill,
// etc.) and it handles the full flow: check existing status, ask if
// undetermined, register, persist token.
//
// Subsequent calls are cheap: if the token is already registered, we
// return immediately. If the user previously denied, we just no-op
// (calling getPermissionsAsync wouldn't reprompt; user has to go to
// iOS Settings to flip it).
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { rpc } from "./rpc";

const PUSH_TOKEN_CACHE_KEY = "ttp_push_token_v1";

// Default handler: show alerts + play sound when the app is foreground.
// Without this, push received while the app is open does nothing visible.
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: true,
	}),
});

let inFlight: Promise<string | null> | null = null;

export function ensurePushPermission(): Promise<string | null> {
	// Coalesce concurrent calls so we don't double-prompt.
	if (inFlight) return inFlight;
	inFlight = doEnsure().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

async function doEnsure(): Promise<string | null> {
	if (Platform.OS === "web") return null;

	// Fast path: token already cached locally + on server.
	try {
		const cached = await AsyncStorage.getItem(PUSH_TOKEN_CACHE_KEY);
		if (cached) return cached;
	} catch {}

	const { status: existing } = await Notifications.getPermissionsAsync();
	let status = existing;
	if (status !== "granted") {
		// Only prompt when status is undetermined. If denied, requesting
		// again is a no-op on iOS — user has to go to Settings.
		if (status !== "denied") {
			const res = await Notifications.requestPermissionsAsync();
			status = res.status;
		}
	}
	if (status !== "granted") {
		// Persist the denial intent on the server so we can surface
		// "enable notifications" hints in places that need it.
		await rpc("set_push_token", { token: null });
		return null;
	}

	// Project ID from expo config — needed for cross-project tokens.
	const projectId =
		Constants?.expoConfig?.extra?.eas?.projectId ??
		Constants?.easConfig?.projectId;

	let tokenString: string | null = null;
	try {
		const tokenObj = await Notifications.getExpoPushTokenAsync(
			projectId ? { projectId } : undefined
		);
		tokenString = tokenObj.data;
	} catch (e) {
		// Most common cause on sim w/o APNs config: "Failed to get push
		// token for device: ..." — log + no-op so the rest of the
		// social flow keeps working.
		console.warn("Failed to fetch push token:", e);
		return null;
	}

	if (!tokenString) return null;

	await rpc("set_push_token", { token: tokenString });
	try {
		await AsyncStorage.setItem(PUSH_TOKEN_CACHE_KEY, tokenString);
	} catch (e) {
		console.warn("Failed to cache push token:", e);
		// Don't reject — token still works locally; we'll retry next time.
	}

	return tokenString;
}

/** Clears the cached token. Call on sign-out. */
export async function clearPushToken() {
	await rpc("set_push_token", { token: null });
	try {
		await AsyncStorage.removeItem(PUSH_TOKEN_CACHE_KEY);
	} catch {}
}
