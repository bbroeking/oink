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
		default:
			return null;
	}
}
