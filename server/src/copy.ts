// Every player-facing line the server writes: push titles and bodies, and
// the two notices. House rules: no emoji, no em dash (a full stop, or " · "
// between fragments), cozy, short. Names are the pigs' own usernames.

export interface PushCopy {
	title: string;
	body: string;
}

export const COPY = {
	directInvite: (from: string, game: string): PushCopy => ({
		title: `${from} wants to play`,
		body: `${game} · tap to take your seat`,
	}),
	crewInvite: (from: string, game: string): PushCopy => ({
		title: `${from} wants to play ${game}`,
		body: "First pig to tap takes the seat",
	}),
	hostAtTable: (guest: string, game: string): PushCopy => ({
		title: `${guest} is at the table`,
		body: `${game} · tap to play`,
	}),
	seatTaken: (game: string): PushCopy => ({
		title: "A pig took your seat",
		body: `${game} · your table is ready`,
	}),
	yourMove: (game: string): PushCopy => ({
		title: "Your move",
		body: `${game} · tap to play`,
	}),
	restarting: "The barn is tidying up. Back in a moment.",
	signedInElsewhere: "You opened the barn on another device.",
} as const;

/** Fallback name for a pig without a username. */
export const NAMELESS_PIG = "a pig";
