// The invite push's buttons. iOS shows a notification's actions only when
// the app registered its category at launch and the push names it, so the
// play server sends invites with `categoryId: "match_invite"` (and
// `data: { screen: "play", invite: <CODE>, url: "ticklethepig://play/<CODE>" }`)
// and the provider registers the category once per launch, while play is on.
//
// "Play" opens the app and routes like a plain tap (utils/notificationRouting
// planTapRoute). "Not now" is a plain dismissal: it never opens the app, and
// on iOS Expo does not promise background handling for it, so nothing relies
// on it reaching the server; the invite simply lapses.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { MATCH_INVITE_CATEGORY, PLAY_ACTION, PLAY_DISMISS_ACTION } from "@/utils/notificationRouting";

let registered: Promise<boolean> | null = null;

/** Idempotent; resolves false where the native module is missing (web, a
 *  build without it) instead of throwing. */
export function registerPlayNotificationCategory(): Promise<boolean> {
	if (registered) return registered;
	registered = (async () => {
		if (Platform.OS === "web") return false;
		try {
			await Notifications.setNotificationCategoryAsync(MATCH_INVITE_CATEGORY, [
				{ identifier: PLAY_ACTION, buttonTitle: "Play", options: { opensAppToForeground: true } },
				{ identifier: PLAY_DISMISS_ACTION, buttonTitle: "Not now", options: { opensAppToForeground: false } },
			]);
			return true;
		} catch {
			registered = null; // let a later launch of the provider try again
			return false;
		}
	})();
	return registered;
}
