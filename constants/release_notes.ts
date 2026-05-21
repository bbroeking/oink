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

export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: "1.1.0",
		date: "2026-05-20",
		headline: "Lucky Pig, friends + trading",
		items: [
			{
				emoji: "✦",
				title: "Lucky Pig",
				body: "Tickling now has a chance to trigger a Lucky Pig moment. Your next 10 tickles each have a 30% chance to be doubled — plus a small chance to unlock a rare folklore title.",
			},
			{
				emoji: "🤝",
				title: "Tickle Trade",
				body: "Ask a friend for 1-5 tickles. When they fulfill, you owe them 2× back when you say thanks. Tap the handshake button on the home screen to manage trades.",
			},
			{
				emoji: "#",
				title: "Friend codes",
				body: "Every account now has a private 4-digit code (your full handle is on your Account page). Share it to make sure friends find the right you.",
			},
			{
				emoji: "👑",
				title: "Shop titles",
				body: "10 new buyable titles in the Shop's new Titles tab — from Mud Connoisseur to Sty Sovereign.",
			},
		],
	},
	{
		version: "1.2.0",
		date: "2026-05-20",
		headline: "The Sounder",
		items: [
			{
				emoji: "🐷",
				title: "Build your sounder",
				body: "Share your invite link from Account. Every friend who joins + plays earns BOTH of you 500 snouts each — and brings you closer to exclusive titles like Ambassador, Drove Captain, and Crown Hog.",
			},
			{
				emoji: "🏆",
				title: "Sounder leaderboard",
				body: "Top recruiters ranked by their sounder size. Open it from your Account page to see where you stand and how far you are from the next title.",
			},
			{
				emoji: "👥",
				title: "Better Friends",
				body: "Friends got a full redesign: three tabs for your sounder, your pending requests, and adding new ones. Search by username with live autocomplete — `#1234` codes let two Brians coexist peacefully.",
			},
			{
				emoji: "🤝",
				title: "Trade tickles with friends",
				body: "Ask 1-5 tickles from any friend. When they fulfill, you owe 2× back when you thank them. Tap the handshake on the home screen.",
			},
		],
	},
	{
		version: "1.3.0",
		date: "2026-05-20",
		headline: "Notifications + trade cooldown",
		items: [
			{
				emoji: "🔔",
				title: "Push notifications",
				body: "You'll get a push when a friend asks for tickles, fulfills your request, or thanks you. The first time you open Friends or the 🤝 pill, iOS will ask for permission — say yes to keep the social loop fast.",
			},
			{
				emoji: "⏳",
				title: "24-hour trade cooldown",
				body: "After any trade with a friend, neither of you can open a new one for 24 hours. Keeps trades feeling deliberate instead of farm-y.",
			},
		],
	},
	{
		version: "1.4.0",
		date: "2026-05-20",
		headline: "Season 1: Goblins vs Angels",
		items: [
			{
				emoji: "⚖️",
				title: "Pick a side — without picking",
				body: "Every player now has an alignment that shifts with how you trade. Give, repay, and bless to drift Generous; receive, hoard, and curse to drift Greedy. Cross ±25 and you'll see your schism.",
			},
			{
				emoji: "☀️",
				title: "Daily blessings",
				body: "Once a day, send a blessing to up to 3 friends — warm tea, sun beams, a halo glow. The kind rotates daily.",
			},
			{
				emoji: "🟢",
				title: "Daily curses",
				body: "Or send a little mischief instead. Curses are capped and cleansable — annoying, never ruinous.",
			},
			{
				emoji: "📋",
				title: "Weekly bounties",
				body: "Three bounties rotate onto the season tab each week. Fulfill trades, repay debts, send blessings — claim snouts.",
			},
			{
				emoji: "🏆",
				title: "Alignment leaderboard + Judgement Day",
				body: "A new leaderboard ranks the most generous and most greedy. At season's end, the top 3 of each side earn exclusive titles.",
			},
		],
	},
];

export const LATEST_RELEASE = RELEASE_NOTES[RELEASE_NOTES.length - 1];
export const RELEASE_SEEN_KEY = "last_seen_release_v1";
