// "What's new" release notes shown on app launch via ReleaseNotesModal.
//
// DRIP MODEL: each entry carries an `availableFrom` date. An entry
// stays invisible — to the modal AND to currentRelease() — until that
// date arrives. So future Season 0 features can be authored now
// without spoiling them: the blessings card simply won't surface
// until blessings actually unlock. `availableFrom` dates come from
// utils/season.ts so the announcement and the feature roll out
// together.
//
// NOTE on numbering: the greedy/generous era was renumbered to
// Season 0 (2026-07-06). Entries already shipped to players keep
// their original "Season 1" copy — they're history.
//
// AsyncStorage tracks last-seen version; the modal auto-fires when
// the current (latest available) release is newer than that.

import { SEASON_0_UNLOCKS } from "@/utils/season";

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
		availableFrom: SEASON_0_UNLOCKS.alignment, // launch
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
		availableFrom: SEASON_0_UNLOCKS.blessings,
		headline: "Daily Blessings",
		items: [
			{
				emoji: "☀️",
				title: "Bless your friends",
				body: "Once a day you can send a blessing to up to 3 friends — a warm tea that speeds their tickles, a sun beam, a halo glow, a handful of snouts. The blessing rotates daily. Casting one nudges you Generous.",
			},
		],
	},

	// ── Build 80 — happiness + visiting + the Closet + the Hog Cup. ──
	// Placed BEFORE the future drip entries so it shows now without
	// suppressing the curses/bounties/finale notes when their dates arrive.
	{
		version: "1.5.5",
		date: "2026-06-06",
		availableFrom: "2026-06-06",
		headline: "A big care + social update!",
		items: [
			{
				emoji: "🐷",
				title: "Your pig has moods now",
				body: "Tickle Rosie regularly and she'll perk up Happy — and her tickles even regenerate faster. Neglect her and she gets Sad and slows down. Her face is the tell: keep coming back to keep her smiling.",
			},
			{
				emoji: "🏚️",
				title: "Visit your friends' barns",
				body: "Tap a friend, then Visit their Barn to see both your pigs together and tap-tickle theirs. You both get happier (and a little tickle) — until the pigs tucker out and call it a day.",
			},
			{
				emoji: "🐽",
				title: "Bury a truffle",
				body: "Leave a truffle on your Barn for visitors. The first friend to drop by digs it up for snouts — a little gift for whoever comes to play.",
			},
			{
				emoji: "👗",
				title: "The Closet",
				body: "The wardrobe is now a dress-up screen: see Rosie wearing everything, browse your items by type, and tap any one to try it on instantly.",
			},
			{
				emoji: "✨",
				title: "Mix and match your look",
				body: "Hat, eyes, face, neck and more are separate slots now — so you can wear a hat AND glasses at once. Whatever you already had on moved to its right slot.",
			},
			{
				emoji: "⚽",
				title: "The Hog Cup is on",
				body: "Pick a country to back for the tournament, fly its flag on your pig + the leaderboard, and grab soccer backgrounds and an always-available soccer ball.",
			},
		],
	},

	// ── Week 4 ───────────────────────────────────────────────────────
	{
		version: "1.6.0",
		date: "2026-06-10",
		availableFrom: SEASON_0_UNLOCKS.curses,
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
		availableFrom: SEASON_0_UNLOCKS.bounties,
		headline: "Weekly Bounties",
		items: [
			{
				emoji: "📋",
				title: "The bounty board",
				body: "Three bounties now rotate onto the Season page each week — fulfill trades, get your requests answered, send blessings. Complete them for snouts.",
			},
		],
	},

	// ── Build 101 — titles earned, Collectibles, visit cooldowns. ────
	{
		version: "1.7.5",
		date: "2026-06-25",
		availableFrom: "2026-06-25", // immediate — ships with build 101
		headline: "Titles are earned, not bought",
		items: [
			{
				emoji: "🏆",
				title: "Titles move to Achievements",
				body: "Titles can no longer be bought in the shop — they're earned. Every title you already own is yours to keep, and there are new ways to earn more in the Achievements ladders, including a new Devotion track for lifetime tickling.",
			},
			{
				emoji: "✦",
				title: "Collectibles",
				body: "The shop's middle tab is now “Collectibles” — the full set of everything there is to collect, owned or not, with a little icon for each category so it's clear what you're filtering by.",
			},
			{
				emoji: "🐷",
				title: "Barn visits, retuned",
				body: "Visiting a friend gives a little burst of tickles, then that barn rests for 3 hours — a fair, cozy rhythm instead of an endless tap. A live countdown shows when you can come back.",
			},
			{
				emoji: "🔧",
				title: "Fixes",
				body: "Declining a friend request now sticks, clearing a curse updates your Barn instantly, and your “what happened” feed shows when each thing happened.",
			},
		],
	},

	// ── Week 8 — the finale. ─────────────────────────────────────────
	{
		version: "1.8.0",
		date: "2026-07-08",
		availableFrom: SEASON_0_UNLOCKS.finale,
		headline: "Judgement Day approaches",
		items: [
			{
				emoji: "👑",
				title: "The season ends",
				body: "Season 0 is closing. The alignment leaderboard ranks the most generous and most greedy — when the gavel falls, the top 3 of each side earn titles no one will be able to claim again. Then the slate wipes for Season 1.",
			},
		],
	},

	// ── Season 1 — the Truffle Patch deepens. ────────────────────────
	{
		version: "1.9.0",
		date: "2026-07-12",
		availableFrom: "2026-07-12",
		headline: "The Truffle Patch runs deeper",
		items: [
			{
				title: "Choose your dig",
				body: "The patch is richer than one dig can clear. Read the mounds, pick what you chase — and what you leave behind is a story for next feeding.",
			},
			{
				title: "The Burrow Book",
				body: "Strange somethings are buried in the patch now. First catches light their page in the Burrow Book. Twelve entries wait in the dark.",
			},
			{
				title: "The full field",
				body: "The Dig-Off board now opens into the whole race — every Sounder, your herd pinned at the top, load more as deep as you dare.",
			},
			{
				title: "A quieter, louder bog",
				body: "The dig has sounds now — scrapes, creaks, and the pop of a truffle coming free. Plus a pile of polish across the season screens.",
			},
		],
	},

	// ── 1.3 — the Sounder update. Ships with build 149. ─────────────
	{
		version: "1.10.0",
		date: "2026-07-14",
		availableFrom: "2026-07-14",
		headline: "Find your herd",
		items: [
			{
				title: "A path to your Sounder",
				body: "The season page now walks you in — taste a dig, slip into an open Sounder or found your own, and dig your first feeding with the herd.",
			},
			{
				title: "The banner calls the dig",
				body: "When the patch is open, the Great Hunger banner says so — one tap and you're digging. Guarded? It counts down to the next feeding.",
			},
			{
				title: "A dig worth reading",
				body: "The end of a dig now settles up properly — what you found, what it carried, what waits in the dirt. No more squinting at the fine print.",
			},
			{
				title: "Name yourself, any time",
				body: "Change your name from the settings on your scrapbook page. First one's free — after that it costs snouts, so make it count.",
			},
			{
				title: "Favorites up front",
				body: "Star your favorite friends and they'll hold the top of your list. And when your snout needs a rest, the barn says so plainly — no countdown clocks.",
			},
			{
				title: "Leaving leaves a mark",
				body: "A digger who trots on keeps their finds with the crew they dug for — the ledger remembers, softly. The only thing you forfeit is Monday's spoils.",
			},
			{
				title: "A hundred hats, redrawn",
				body: "Nearly every worn thing in the closet got redrawn to sit true on Rosie — same character, better fit.",
			},
			{
				title: "New feeding hours",
				body: "The Hungerer gorges on a new clock — the patch now opens with your morning coffee, your ride home, and the last hour before bed.",
			},
		],
	},
	{
		version: "1.11.0",
		date: "2026-07-24",
		availableFrom: "2026-07-24",
		headline: "Rosie’s friends have arrived!",
		items: [
			{
				title: "Meet the new pigs",
				body: "Copper, Pepper, Bandit, Pickles, and Biscuit each have their own coat, collectible card, and full set of animations.",
			},
			{
				title: "A Slop Club companion",
				body: "Visit the new Pen in the Shop to choose one long-term friend for Rosie, then choose whether Rosie or that friend greets you at home.",
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
