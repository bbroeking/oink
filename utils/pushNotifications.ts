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
import { nextOpenAtMs } from "./rooting";
import { foregroundNotificationBehavior } from "./notificationPolicy";

const PUSH_TOKEN_CACHE_KEY = "ttp_push_token_v1";

// Pushes are re-engagement by default: background/terminated delivery still
// behaves normally, but a push received while the player is already in-game is
// quiet unless its producer explicitly sends `{ foreground: "alert" }`.
// This prevents self-caused rewards from sounding over their own receipt UI.
Notifications.setNotificationHandler({
	handleNotification: async (notification) =>
		foregroundNotificationBehavior(notification.request.content.data),
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

// ── "Oink me when the patch opens" — one LOCAL notification, no server ────────
// A player who reaches the dig while the patch is GUARDED (or right after a dig)
// can opt into a single local push at the next feeding-window open. This is
// purely on-device (expo-notifications schedule), so there's no server change
// and no token needed — but iOS still requires notification PERMISSION to show
// a local alert, so we route through the same ensurePushPermission() lane.

// Stable identifier so a re-schedule REPLACES the pending one (dedupe) rather
// than stacking three "the patch is open" alerts across three opt-ins.
const OPEN_REMINDER_ID = "patch-open-reminder";
const OPEN_REMINDER_TITLE = "the patch is open";
const OPEN_REMINDER_BODY = "the Hungerer's gorging — dig quick, dig quiet.";

// The outcome of a schedule attempt, so the caller can speak plainly:
//   scheduled — the local oink is set for the next open.
//   denied    — notification permission isn't granted (soft no-op, tell gently).
//   unavailable — web / no future open time / scheduling failed (quiet no-op).
export type OpenReminderResult = "scheduled" | "denied" | "unavailable";

/**
 * Schedule (or replace) ONE local notification at the next feeding-window open.
 * Requests notification permission via the shared lane if needed; a decline is
 * a quiet no-op ("denied"). Safe to call repeatedly — the fixed identifier
 * means the pending reminder is always de-duplicated to the latest next-open.
 */
export async function scheduleOpenReminder(
	nowMs: number = Date.now()
): Promise<OpenReminderResult> {
	if (Platform.OS === "web") return "unavailable";

	// A local alert still needs OS permission — reuse the feature-tied lane so
	// the grant prompt rides a moment the player already cares about.
	const { status: existing } = await Notifications.getPermissionsAsync();
	let status = existing;
	if (status !== "granted" && status !== "denied") {
		const res = await Notifications.requestPermissionsAsync();
		status = res.status;
	}
	if (status !== "granted") return "denied";

	const openAt = nextOpenAtMs(nowMs);
	const secondsUntil = Math.round((openAt - nowMs) / 1000);
	if (secondsUntil <= 0) return "unavailable"; // already open — nothing to wait for

	try {
		// Replace any pending reminder first so opting in twice never stacks.
		await Notifications.cancelScheduledNotificationAsync(OPEN_REMINDER_ID).catch(
			() => {}
		);
		await Notifications.scheduleNotificationAsync({
			identifier: OPEN_REMINDER_ID,
			content: {
				title: OPEN_REMINDER_TITLE,
				body: OPEN_REMINDER_BODY,
			},
			trigger: {
				type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
				seconds: secondsUntil,
			},
		});
		return "scheduled";
	} catch (e) {
		console.warn("Failed to schedule open reminder:", e);
		return "unavailable";
	}
}

/** Cancel a pending "patch is open" reminder (e.g. the player just dug). */
export async function cancelOpenReminder(): Promise<void> {
	try {
		await Notifications.cancelScheduledNotificationAsync(OPEN_REMINDER_ID);
	} catch {}
}
