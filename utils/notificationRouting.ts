import { parseInviteCode } from "@/multiplayer/links";

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
	// The Satchel swap's while-away line and its push: a friend swapped with
	// your pig, and the thing to look at is your own Barn (2026-09-16).
	barn: "/",
	trade: "/friends", // the Inbox on the Friends tab carries the event
	friends: "/friends", // (trade + friends both land on the Friends Inbox)
	achievements: "/achievements",
	account: "/account",
	season: "/season", // bounties (and the season pass) live here
	shop: "/shop", // finale/world-cup reward grants open the Shop (wardrobe)
	// Reserved alias, NOT emitted by the server today. Since 2026-09-17 the
	// Trough is reached from the Barn button's fan and nowhere else, so a
	// trough nudge lands on the Barn tab (its row is on the fan); nothing
	// auto-opens. utils/whileAway.ts also resolves "trough" through here.
	trough: "/",
	// A pig is back from its errand (20260918120000): the homecoming waits on
	// the Pen's corkboard, so the push opens the Pen (2026-09-18).
	pen: "/pen",
	// Matchmade play (2026-10-04). Sent by the Render play server, not by a
	// migration, so the guard test's migration scan never sees it. A bare
	// `play` opens the Play hub; with `invite` it opens that invite, with
	// `room` that table (routeForPush below carries the params).
	play: "/play",
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
	// Own-key check (not a widened index) so a stray "constructor"/"toString"
	// screen can't walk up the prototype and hand back a function as a route.
	return Object.hasOwn(NOTIFICATION_ROUTES, screen)
		? NOTIFICATION_ROUTES[screen as NotificationScreen]
		: null;
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
//   - "defer" (modalHeld): an UNMANAGED native Modal holds the popup queue (the
//     Snout Deep dig, a tab sheet). Replacing the Stack under it hides its host
//     Modal while a sheet nested inside is still presented — iOS dismisses the
//     nested sheet instead and strands the host, invisible over the whole app,
//     eating every touch (the 2026-09-20 dig freeze). Route once the hold lifts.
export type TapRoutePlan = {
	action: "navigate" | "defer" | "ignore";
	path: string | null;
};

export function planTapRoute(
	target: string | PushTapTarget | null | undefined,
	routerReady: boolean,
	modalHeld = false
): TapRoutePlan {
	const path = routeForPush(target);
	if (!path) return { action: "ignore", path: null };
	return { action: routerReady && !modalHeld ? "navigate" : "defer", path };
}

// ── Push taps that carry params (matchmade play, 2026-10-04) ────────────────
// A tap is more than its screen once a push points at one thing: an invite
// push carries `invite` (and `url`, the ticklethepig://play/<CODE> link), a
// your-turn push carries `room`. The layout hands planTapRoute the whole
// target (tapTargetFromResponse) and the consume-once + defer rules above
// apply unchanged; the deferred value is still just a path.

/** The invite push's iOS category (no ':' or '-' allowed in the id). */
export const MATCH_INVITE_CATEGORY = "match_invite";
/** The invite push's "Play" button: routes like a plain tap. */
export const PLAY_ACTION = "play";
/** The invite push's "Not now" button: a plain dismissal, never a route. */
export const PLAY_DISMISS_ACTION = "not_now";

export type PushTapTarget = {
	screen?: string | null;
	/** Invite code (screen "play"). Wins over `room` when both are present:
	 *  an invitee is not seated yet, so the invite is what they can open. */
	invite?: string | null;
	/** Table id (screen "play"). */
	room?: string | null;
	/** The ticklethepig://play/<CODE> link an invite push also carries. */
	url?: string | null;
	/** The notification action tapped (expo's actionIdentifier). */
	action?: string | null;
};

// Mirrors the room-id guard in multiplayer/protocol.ts.
const ROOM_ID_RE = /^[0-9a-f-]{8,64}$/i;

const asString = (value: unknown): string | null =>
	typeof value === "string" ? value : null;

/** A route for a push tap, params included; null when there is nothing to
 *  open (unknown screen, the dismiss action). A bare string is a screen. */
export function routeForPush(
	target: string | PushTapTarget | null | undefined
): string | null {
	const t: PushTapTarget =
		typeof target === "string" ? { screen: target } : (target ?? {});
	if (t.action === PLAY_DISMISS_ACTION) return null;
	const base = routeForScreen(asString(t.screen));
	if (!base) return null;
	if (t.screen === "play") {
		const code = parseInviteCode(asString(t.invite)) ?? parseInviteCode(asString(t.url));
		if (code) return `/play/${code}`;
		const room = asString(t.room);
		if (room && ROOM_ID_RE.test(room)) return `/match/${room}`;
	}
	return base;
}

// The slice of an expo NotificationResponse the tap path reads.
export type TapResponse = {
	actionIdentifier?: string | null;
	notification: { request: { content: { data?: unknown } } };
};

/** The tap target of one notification response: its data's screen + params,
 *  and the action that was tapped. Never throws on a malformed payload. */
export function tapTargetFromResponse(
	res: TapResponse | null | undefined
): PushTapTarget {
	const raw = res?.notification?.request?.content?.data;
	const data =
		raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
	return {
		screen: asString(data.screen),
		invite: asString(data.invite),
		room: asString(data.room),
		url: asString(data.url),
		action: asString(res?.actionIdentifier),
	};
}
