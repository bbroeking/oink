// Foreground notification policy.
//
// A remote push is primarily a re-engagement tool. When the player is already
// inside the game, an OS banner + sound can interrupt the exact action that
// caused the reward (a dig, claim, or purchase). Producers may explicitly opt
// into an alert for a genuinely time-sensitive event; everything else is quiet
// in the foreground and remains a normal push while backgrounded/terminated.

export type ForegroundNotificationMode = "quiet" | "alert";

type NotificationData = Record<string, unknown> | null | undefined;

export interface ForegroundNotificationBehavior {
	shouldShowAlert: boolean;
	shouldPlaySound: boolean;
	shouldSetBadge: boolean;
}

export function foregroundNotificationMode(
	data: NotificationData
): ForegroundNotificationMode {
	return data?.foreground === "alert" ? "alert" : "quiet";
}

export function foregroundNotificationBehavior(
	data: NotificationData
): ForegroundNotificationBehavior {
	const alert = foregroundNotificationMode(data) === "alert";
	return {
		shouldShowAlert: alert,
		shouldPlaySound: alert,
		shouldSetBadge: alert,
	};
}
