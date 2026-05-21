// "What's new" release notes shown on app launch via ReleaseNotesModal.
//
// Each release is an entry in the array; the LAST entry is treated as
// the latest. Bump `version` when you ship something user-facing.
// AsyncStorage tracks `last_seen_release_version`; modal auto-fires
// when the latest version is newer than that.

export interface ReleaseNote {
	version: string;
	date: string;          // ISO date — display-only
	headline: string;
	items: { title: string; body: string; emoji?: string }[];
}

// Build 62 is the first ship of all of this, so it's ONE consolidated
// entry — every player sees the whole update on first launch. Future
// builds append a new, smaller entry per release.
export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: "1.4.0",
		date: "2026-05-20",
		headline: "Season 1: Goblins vs Angels",
		items: [
			{
				emoji: "🤝",
				title: "Tickle Trade",
				body: "Ask a friend for 1-5 tickles. If they answer, you pocket DOUBLE — they give it from their own bank for nothing but goodwill. Manage trades from the handshake on the home screen.",
			},
			{
				emoji: "👥",
				title: "Friends & the Sounder",
				body: "Add friends by username (everyone has a private #1234 code so two Brians can coexist). Share your invite link from Account — every friend who joins earns BOTH of you 500 snouts and climbs you toward titles like Drove Captain and Crown Hog.",
			},
			{
				emoji: "👀",
				title: "Tap anyone",
				body: "Tap a player on the leaderboard to see their stats, how generous or greedy they've been, and add them, trade with them, bless them — or curse them.",
			},
			{
				emoji: "✦",
				title: "Lucky Pig",
				body: "Tickling can now trigger a Lucky Pig moment — a window where your tickles have a chance to double, with a rare shot at unlocking a one-of-a-kind folklore title.",
			},
			{
				emoji: "🏆",
				title: "Achievements",
				body: "A new Achievements screen with tiered rewards — titles, items, and snouts. The top tiers keep going forever, Candy-Crush style.",
			},
			{
				emoji: "🔔",
				title: "Notifications",
				body: "Get a push when a friend asks you for tickles or answers one of your requests. Say yes when iOS asks — it keeps the social loop fast.",
			},
			{
				emoji: "⚖️",
				title: "Season 1: Goblins vs Angels",
				body: "Every player now has an alignment that shifts with how they trade. Give freely and you drift Generous; ask and pocket double and you drift Greedy. Cross far enough and you'll see your schism. It's shown everywhere — your reputation is everything you've done.",
			},
			{
				emoji: "☀️",
				title: "Daily blessings & curses",
				body: "Once a day, send a blessing to up to 3 friends — warm tea, sun beams, a halo glow. Or send a little mischief instead. Curses are capped and cleansable: annoying, never ruinous.",
			},
			{
				emoji: "📋",
				title: "Weekly bounties + Judgement Day",
				body: "Three bounties rotate onto the season tab each week for snout rewards. And a new leaderboard ranks the most generous and most greedy — at season's end, the top 3 of each side earn exclusive titles.",
			},
		],
	},
];

export const LATEST_RELEASE = RELEASE_NOTES[RELEASE_NOTES.length - 1];
export const RELEASE_SEEN_KEY = "last_seen_release_v1";
