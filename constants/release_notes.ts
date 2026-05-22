// "What's new" release notes shown on app launch via ReleaseNotesModal.
//
// DRIP MODEL: each entry carries an `availableFrom` date. An entry
// stays invisible — to the modal AND to currentRelease() — until that
// date arrives. So future Season 1 features can be authored now
// without spoiling them: the blessings card simply won't surface
// until blessings actually unlock. `availableFrom` dates come from
// utils/season.ts so the announcement and the feature roll out
// together.
//
// AsyncStorage tracks last-seen version; the modal auto-fires when
// the current (latest available) release is newer than that.

import { SEASON_1_UNLOCKS } from "@/utils/season";

export interface ReleaseNote {
	version: string;
	date: string;          // ISO date — display-only
	availableFrom: string; // ISO — entry is hidden in-app until this date
	headline: string;
	items: { title: string; body: string; emoji?: string }[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
	// ── Build 62 launch — everything live on day one. ────────────────
	{
		version: "1.4.0",
		date: "2026-05-20",
		availableFrom: SEASON_1_UNLOCKS.alignment, // launch
		headline: "Season 1 begins: Goblins vs Angels",
		items: [
			{
				emoji: "🤝",
				title: "Tickle Trade",
				body: "Ask a friend for 1-5 tickles. If they answer, you pocket DOUBLE — they give it from their own bank for nothing but goodwill. Manage trades from the handshake on the home screen.",
			},
			{
				emoji: "👥",
				title: "Friends & the Sounder",
				body: "Add friends by username (everyone has a private #1234 code). Share your code — every friend who joins with it earns BOTH of you 100 snouts and climbs you toward titles like Drove Captain and Crown Hog.",
			},
			{
				emoji: "👀",
				title: "Tap anyone",
				body: "Tap a player on the leaderboard to see their stats, add them, and trade with them.",
			},
			{
				emoji: "✦",
				title: "Lucky Pig",
				body: "Tickling can now trigger a Lucky Pig moment — a window where your tickles have a chance to double, with a rare shot at a one-of-a-kind folklore title.",
			},
			{
				emoji: "🏆",
				title: "Achievements",
				body: "A new Achievements screen with tiered rewards — titles, items, and snouts. The top tiers keep going forever.",
			},
			{
				emoji: "🔔",
				title: "Notifications",
				body: "Get a push when a friend asks you for tickles or answers one of your requests. Say yes when iOS asks.",
			},
			{
				emoji: "⚖️",
				title: "Your alignment is forming",
				body: "Season 1 has begun. Every player now has an alignment that shifts with how they trade — give freely and you drift Generous, ask and pocket double and you drift Greedy. Cross far enough and you'll see your schism. More of the season unlocks week by week…",
			},
		],
	},

	// ── Week 3 — drips in on its date, hidden until then. ────────────
	{
		version: "1.5.0",
		date: "2026-06-03",
		availableFrom: SEASON_1_UNLOCKS.blessings,
		headline: "Daily Blessings",
		items: [
			{
				emoji: "☀️",
				title: "Bless your friends",
				body: "Once a day you can send a blessing to up to 3 friends — a warm tea that speeds their tickles, a sun beam, a halo glow, a handful of snouts. The blessing rotates daily. Casting one nudges you Generous.",
			},
		],
	},

	// ── Week 4 ───────────────────────────────────────────────────────
	{
		version: "1.6.0",
		date: "2026-06-10",
		availableFrom: SEASON_1_UNLOCKS.curses,
		headline: "Daily Curses",
		items: [
			{
				emoji: "🟢",
				title: "Send a little mischief",
				body: "The goblin-hearted can now cast a daily curse instead — a sluggish snout, a phantom itch, a green miasma cloud. Curses are capped and cleansable: annoying, never ruinous. A blessing washes them away.",
			},
		],
	},

	// ── Week 6 ───────────────────────────────────────────────────────
	{
		version: "1.7.0",
		date: "2026-06-24",
		availableFrom: SEASON_1_UNLOCKS.bounties,
		headline: "Weekly Bounties",
		items: [
			{
				emoji: "📋",
				title: "The bounty board",
				body: "Three bounties now rotate onto the Season page each week — fulfill trades, get your requests answered, send blessings. Complete them for snouts.",
			},
		],
	},

	// ── Week 8 — the finale. ─────────────────────────────────────────
	{
		version: "1.8.0",
		date: "2026-07-08",
		availableFrom: SEASON_1_UNLOCKS.finale,
		headline: "Judgement Day approaches",
		items: [
			{
				emoji: "👑",
				title: "The season ends",
				body: "Season 1 is closing. The alignment leaderboard ranks the most generous and most greedy — when the gavel falls, the top 3 of each side earn titles no one will be able to claim again. Then the slate wipes for Season 2.",
			},
		],
	},
];

// The newest release whose availableFrom date has arrived. Future
// season entries are invisible to this until their date — so the
// modal never spoils what hasn't rolled out.
export function currentRelease(now: Date = new Date()): ReleaseNote {
	const today = now.toISOString().slice(0, 10);
	const live = RELEASE_NOTES.filter((r) => r.availableFrom <= today);
	return live[live.length - 1] ?? RELEASE_NOTES[0];
}

export const RELEASE_SEEN_KEY = "last_seen_release_v1";
