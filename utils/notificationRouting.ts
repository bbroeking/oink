// Single source of truth mapping a push notification's `data.screen` to an
// in-app route. The SERVER sets `screen` in the push payload (the push triggers
// in supabase/migrations/*); the root layout routes on tap. Centralizing the
// map here — with a test asserting every server-sent screen resolves — stops
// the two from drifting. (A `season` bounty-ready push used to deep-link
// NOWHERE because the router had branches for trade/friends/achievements/
// account but none for season.)

// Exactly the `screen` values the server emits in push payloads. Keep in sync
// with the `jsonb_build_object(... 'screen', '<x>' ...)` calls in the migrations
// (rg "'screen'," supabase/migrations); the test guards that they all resolve.
export const NOTIFICATION_SCREENS = [
	"trade",
	"friends",
	"achievements",
	"account",
	"season",
] as const;

export type NotificationScreen = (typeof NOTIFICATION_SCREENS)[number];

// → in-app route, or null when there's nothing to navigate to (unknown/absent
// screen). Paths match the convention the layout already uses (router.replace).
export function routeForScreen(screen: string | null | undefined): string | null {
	switch (screen) {
		case "trade":
		case "friends":
			return "/friends"; // the Inbox on the Friends tab carries the event
		case "achievements":
			return "/achievements";
		case "account":
			return "/account";
		case "season":
			return "/season"; // bounties (and the season pass) live here
		case "trough":
			return "/shop"; // Troughs (item drives) live on the Shop tab
		default:
			return null;
	}
}

// AsyncStorage key for the consume-once guard below. Persistent (not module
// state) on purpose: expo replays the last tap across COLD launches too, so the
// guard has to outlive the process to stop a stale re-route on the next open.
export const LAST_NOTIF_RESPONSE_KEY = "notif:last-consumed-response";

// A notification response as far as the consume-once guard cares. The real
// expo-notifications NotificationResponse is much wider; we only read the two
// fields that identify one physical tap.
export type ConsumableResponse = {
	notification: {
		date?: number | null;
		request: { identifier?: string | null };
	};
};

// Stable key for ONE physical notification tap: the notification's identifier +
// its delivery date. `getLastNotificationResponseAsync()` persists the last tap
// and returns the SAME response object on later foregrounds, remounts, and even
// unrelated cold launches — so without a guard the app re-navigates instead of
// opening neutral (spec-18 suspect 2). The layout stamps this key once per tap
// (both the cold-start read and the warm listener) and skips a match, so each
// tap routes exactly once. Returns null when there's no identifier to key on.
export function responseConsumeKey(
	res: ConsumableResponse | null | undefined
): string | null {
	const id = res?.notification?.request?.identifier;
	if (!id) return null;
	const date = res?.notification?.date ?? "";
	return `${id}:${date}`;
}

// What a push tap should do, given whether the router shell is mounted yet.
// Pure so the deferral (spec-18 suspect 3 — a tap that lands during the
// saddling/auth gate must not navigate before the <Stack> mounts, or
// expo-router throws) is unit-testable without mounting the layout:
//   - "ignore": unknown/absent screen — no route, no-op cleanly.
//   - "navigate": router is ready — route now.
//   - "defer": router not ready — stash the path and flush when the shell mounts.
export type TapRoutePlan = {
	action: "navigate" | "defer" | "ignore";
	path: string | null;
};

export function planTapRoute(
	screen: string | null | undefined,
	routerReady: boolean
): TapRoutePlan {
	const path = routeForScreen(screen);
	if (!path) return { action: "ignore", path: null };
	return { action: routerReady ? "navigate" : "defer", path };
}
