// Single source of truth mapping a push notification's `data.screen` to an
// in-app route. The SERVER sets `screen` in the push payload (the push triggers
// in supabase/migrations/*); the root layout routes on tap. Centralizing the
// map here — with a test asserting every server-sent screen resolves — stops
// the two from drifting. (A `season` bounty-ready push used to deep-link
// NOWHERE because the router had branches for trade/friends/achievements/
// account but none for season.)

// THE screen→route table — the one source of truth. Every `screen` value the
// server may put in a push payload (the `jsonb_build_object(... 'screen', '<x>'
// ...)` calls in supabase/migrations/*) must have a key here, or a real push
// deep-links NOWHERE (it falls through routeForScreen → null). The guard test
// (__tests__/notificationRouting.test.ts) scans the migrations for the screens
// the server actually emits and asserts each one is present here, so this table
// and the server can't silently drift. (A `season` bounty-ready push, then a
// `shop` finale-reward push, each used to dead-end because the router grew a
// branch per screen by hand and missed one.)
//
// Paths match the convention the layout already uses when it hands the result
// to router.replace (bare tab-relative paths, e.g. "/season", not "/(tabs)/…").
const NOTIFICATION_ROUTES = {
	home: "/",
	trade: "/friends", // the Inbox on the Friends tab carries the event
	friends: "/friends", // (trade + friends both land on the Friends Inbox)
	achievements: "/achievements",
	account: "/account",
	season: "/season", // bounties (and the season pass) live here
	shop: "/shop", // finale/world-cup reward grants open the Shop (wardrobe)
	// Reserved alias, NOT emitted by the server today: kept so a future
	// trough (item-drive) push routes to the Shop tab without another edit.
	// utils/whileAway.ts also resolves "trough" through here on purpose.
	trough: "/shop?trough=open",
} as const;

// Every screen the router accepts (table keys). Includes the reserved `trough`
// alias, so this is a superset of what the server emits — the guard test owns
// the "server ⊆ table" direction by reading the migrations directly.
export const NOTIFICATION_SCREENS = Object.keys(
	NOTIFICATION_ROUTES
) as (keyof typeof NOTIFICATION_ROUTES)[];

export type NotificationScreen = keyof typeof NOTIFICATION_ROUTES;

// → in-app route, or null when there's nothing to navigate to (unknown/absent
// screen). A plain table lookup so adding a screen means adding one table entry.
export function routeForScreen(screen: string | null | undefined): string | null {
	if (screen == null) return null;
	return (NOTIFICATION_ROUTES as Record<string, string>)[screen] ?? null;
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
