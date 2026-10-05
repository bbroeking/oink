// Every word the Play screens say: the hub, the invite landing, the table,
// the result sheet, the wins board and the door. The protocol's own lines
// (refusals, result headlines, the connection banner) live in
// utils/multiplayer/copy.ts and are reused, never rewritten; these are the
// screens'. One file, so __tests__/play scans every string for an em dash or
// an emoji, and so a line reads the same wherever it shows.
//
// Voice: short, warm, lowercase kickers, sentence-case buttons. Losing still
// feels warm: a pig who leaves "had to head home", a table that ends early is
// nobody's fault. Never a population count, never a wait estimate.

import type { CatalogEntry, RoomSnapshot, SeatInfo } from "@/multiplayer/protocol";
import type { GameKind, Pace, Seat } from "@/multiplayer/types";
import { RESULT_DETAIL, RESULT_HEADLINE, fill, joinNames, resultCopy } from "@/utils/multiplayer/copy";
import { formatClockMS } from "@/utils/duration";

export { fill, joinNames };

// ── The hub ──────────────────────────────────────────────────────────────────

export const HUB_COPY = Object.freeze({
	kicker: "five little games",
	title: "Play together",
	offTitle: "Play together is on its way",
	offSub: "Five little games for you and a pig or two. Soon.",
	backLabel: "back",
	anyTitle: "Find a pig for any game",
	anySub: "Whichever of the five a free pig wants to play.",
	anyHint: "Looks for a pig to play any of the five games, live",
	inviteAny: "or invite friends to a game ›",
	inviteAnyHint: "Pick a game, then friends, your Sounder or a link",
	invitesKicker: "for you",
	invitesTitle: "Invites",
	tablesKicker: "on the go",
	tablesTitle: "Your tables",
	gamesTitle: "The five",
	winsLabel: "Wins this month",
	winsSub: "Wins only. Resets on the 1st.",
	winsHint: "Opens the board of this month's wins",
	retry: "Try again",
	retryHint: "Reconnects to the play table",
});

export const SEARCH_COPY = Object.freeze({
	live: "Looking for a pig to play with…",
	async: "Finding you a table by post…",
	elapsed: "sniffing for {time}",
	anyGame: "any of the five",
	stop: "Stop looking",
	stopHint: "Stops looking for a pig",
	offer: "Still sniffing around. Practice while you wait, or play by post?",
	openSeat: "Leave an open seat",
	openSeatHint: "Starts a table by post now. The next pig who looks takes the other chair",
	practice: "Practice with a bot pig",
	practiceHint: "Stops looking and sets a practice table with bot pigs",
});

export const GAME_COPY = Object.freeze({
	sheetKicker: "how it goes",
	realKicker: "with real pigs",
	findPig: "Find a pig",
	findPigHint: "Looks for a pig who wants to play {game} right now",
	byPost: "Play by post",
	byPostHint: "Starts a table now. A move a day, and a ping when it's your turn",
	byPostNote: "By post: a move a day, and a ping when it's your turn.",
	invite: "Invite friends",
	inviteHint: "Pick friends, your Sounder or a link",
	practiceKicker: "practice",
	practiceNote: "Bot pigs, plainly labelled. Nothing here counts.",
	practice: "Practice",
	practiceHint: "Sets a practice table with {bots} for {game}",
	noClock: "No clock",
	noClockNote: "Take all the time you like. Real tables keep the clock.",
	noClockHint: "Practice with no turn clock",
	asleep: "Resting right now. Practice still works.",
	asleepTag: "resting",
	coop: "co-op",
	live: "live",
	byPostTag: "by post",
	open: "Opens how {game} goes and the ways to play it",
});

export const INCOMING_COPY = Object.freeze({
	wants: "{name} wants to play {game}",
	accept: "Accept",
	acceptHint: "Takes a seat at {name}'s table",
	notNow: "Not now",
	notNowHint: "Lets this invite go",
});

export const TABLE_COPY = Object.freeze({
	with: "with {names}",
	openSeat: "an open seat, waiting for a pig",
	yourMove: "Your move",
	theirMove: "{name}'s move",
	waiting: "waiting",
	live: "live",
	lobby: "pigs sitting down",
	starting: "starting",
	finished: "finished",
	open: "Opens your {game} table",
});

// ── The table ────────────────────────────────────────────────────────────────

export const MATCH_COPY = Object.freeze({
	kickerLive: "live table",
	kickerAsync: "by post",
	kickerPractice: "practice · bot pigs",
	kickerTable: "a table",
	leave: "Leave",
	leaveHint: "Asks before you leave the table",
	leaveNowHint: "Leaves the table and goes back",
	more: "More for this table",
	resign: "Resign",
	resignTitle: "This table",
	settingUp: "setting the table",
	pulling: "pulling up a chair",
	packedUp: "This table has packed up",
	packedUpSub: "It finished, or everyone headed home.",
	notSeated: "You're not at this table",
	notSeatedSub: "Find a pig and pull up a chair of your own.",
	backToHub: "Back to Play together",
	backToHubHint: "Opens the Play hub",
	yourMove: "Your move",
	theirMoveSpoken: "their move",
	everyonePicks: "Everyone picks",
	waitingFor: "Waiting for {names}",
	asyncYourMove: "Your move · {left}",
	asyncWaiting: "Waiting for {names} · we'll ping you",
	asyncOpenSeat: "Waiting for a pig to take the open seat · we'll ping you",
	secondsLeft: "{s}s",
	clockLabel: "{who}, {s} seconds left",
	skip: "Skip to result",
	skipHint: "Shows the result now",
	seeResult: "See the result",
	seeResultHint: "Opens how the table ended",
	you: "You",
	away: "away",
	trottedOff: "trotted off",
	openChair: "the next pig",
	practicePig: "practice pig",
});

export const COUNTDOWN_COPY = Object.freeze({
	foundOne: "Found a pig!",
	foundMany: "Found some pigs!",
	everyone: "Everyone's here",
	again: "Again!",
	practice: "The practice pigs are ready",
});

export const LOBBY_COPY = Object.freeze({
	kickerHost: "your table",
	kickerGuest: "pulling up chairs",
	hostLine: "Share the link and pigs can sit down.",
	directLine: "Your friends have a ping to take their seats.",
	crewLine: "Your Sounder has a ping. First pigs to tap take the seats.",
	openSeat: "an open seat",
	// The tag under the dashed chair: one word, so it sits on one line in a
	// quarter of the card ("an open seat" stacked three words high). The
	// chair still says "an open seat" to VoiceOver.
	openSeatTag: "open",
	codeKicker: "the table's code",
	codeLabel: "The table's code: {code}",
	copy: "Copy link",
	copied: "Copied",
	copyHint: "Copies the invite link",
	share: "Share",
	shareHint: "Opens the share sheet with the invite link",
	shareMessage: "Come play {game} with me in Tickle the Pig.",
	start: "Start now",
	startHint: "Starts with the pigs already seated",
	needMore: "Start once {n} more pig sits down",
	needMorePlural: "Start once {n} more pigs sit down",
	waitingHost: "Waiting for {name} to start",
	startsWhenFull: "It starts the moment every seat is taken.",
	gathering: "A few more pigs may sit down. It starts in a moment.",
	cancel: "Call it off",
	cancelHint: "Asks before closing the invite",
	expires: "{left} on the invite",
});

export const RESULT_COPY = Object.freeze({
	rematch: "Rematch",
	rematchHint: "Asks the table for another round",
	asked: "Asked",
	wantsRematch: "{name} wants a rematch",
	waitingRematch: "Waiting for {names}…",
	windowLeft: "{s}s to say yes",
	tooLate: "The rematch window closed",
	noRematch: "No rematch this time",
	findAnother: "Find another pig",
	findAnotherHint: "Leaves this table and looks for a new pig to play {game}",
	findReal: "Find a real pig",
	headHome: "Head home",
	headHomeHint: "Leaves the table and goes back to Play together",
	tookIt: "took it",
	sharedIt: "shared it",
	headedHome: "headed home",
	/** Your own row, when the table went on without you: you left, or it
	 *  seated you out for missed turns. True of both. */
	satOut: "sat out",
	/** The line under the headline in the same case. Warm, no blame. */
	movedOn: "The table moved on without you.",
	together: "together",
	theTable: "The table",
	practiceNote: "Practice table. Nothing here counts toward the board.",
	shared: "{score} between you",
});

/** Short titles for the toasts the screens raise; the sentence under each
 *  is errorCopy(code). */
export const REFUSAL_TITLE = Object.freeze({
	act: "Not quite",
	queue: "Couldn't start looking",
	accept: "Couldn't take that seat",
	decline: "Couldn't let that go",
	invite: "Couldn't make the invite",
	practice: "Couldn't set the practice table",
	rematch: "No rematch this time",
	start: "Couldn't start yet",
	cancel: "Couldn't call it off",
	resign: "Couldn't leave just now",
});

// ── The invite landing ───────────────────────────────────────────────────────

export const LANDING_COPY = Object.freeze({
	kicker: "an invite",
	title: "Play together",
	loading: "finding your invite",
	seats: "{taken} of {max} seats taken",
	join: "Join the table",
	joinHint: "Takes a seat at {name}'s table",
	notNow: "Not now",
	notNowHint: "Lets this invite go",
	instead: "Find a pig instead",
	insteadHint: "Opens the Play hub",
	expiredTitle: "This invite wandered off",
	expiredSub: "Invites only wait a little while.",
	fullTitle: "That table filled up",
	fullSub: "Every seat was taken before you got there.",
	missingTitle: "We couldn't find that table",
	missingSub: "The link may be mistyped, or the table packed up.",
	cancelledTitle: "{name} called it off",
	cancelledSub: "The table packed up before it started.",
	blockedTitle: "This table isn't open to you",
	blockedSub: "Plenty of games are still a tap away.",
	signedOutTitle: "Sign in to take your seat",
	signedOutSub: "Sign in, then tap the link again.",
	errorTitle: "Couldn't reach the table",
	retryHint: "Asks for the invite again",
});

// ── The invite sheet ─────────────────────────────────────────────────────────

export const INVITE_SHEET_COPY = Object.freeze({
	kicker: "invite",
	pickTitle: "Pick a game",
	whoTitle: "Who's playing?",
	pickHint: "Invites pigs to play {game}",
	friends: "Friends",
	crew: "Your Sounder",
	link: "A link",
	kindsLabel: "Who to invite",
	paceLabel: "How fast",
	live: "Live",
	byPost: "By post",
	upTo: "Pick up to {n}",
	upToOne: "Pick one friend",
	noFriendsTitle: "No friends to ask yet",
	noFriendsSub: "Add a friend on the Friends tab, or share a link.",
	friendsError: "Your friends didn't come back.",
	retry: "Try again",
	retryHint: "Asks for your friends again",
	loadingFriends: "rounding up your pals",
	crewLine: "Everyone in {crew} gets a ping. First pigs to tap take the seats.",
	linkLine: "Anyone with the link can sit down. It wanders off in an hour.",
	linkLineAsync: "Anyone with the link can sit down. It waits a day.",
	inviteOne: "Invite {name}",
	inviteMany: "Invite {n} friends",
	inviteNone: "Pick a friend",
	inviteCrew: "Invite the Sounder",
	makeLink: "Make a link",
	inviteHintFriends: "Sends a ping to take a seat at your table",
	inviteHintCrew: "Pings everyone in your Sounder",
	inviteHintLink: "Makes a link and opens the share sheet",
	selectHint: "Adds this friend to the invite",
	unselectHint: "Takes this friend off the invite",
	full: "That's every seat",
	sent: "Invite sent. Your table is waiting.",
	back: "Pick another game",
	backHint: "Goes back to the list of games",
});

// ── The wins board ───────────────────────────────────────────────────────────

export const WINS_COPY = Object.freeze({
	kicker: "this month",
	title: "Wins this month",
	all: "All",
	segmentsLabel: "Which game",
	loading: "counting wins",
	soonTitle: "The board opens soon",
	soonSub: "Wins land here once the first tables finish.",
	errorSub: "The board didn't come back.",
	emptyTitle: "No wins yet this month",
	emptySub: "The first win puts a pig at the top.",
	youWins: "You · {wins}",
	firstWin: "Your first win puts you on the board",
	footnote: "Wins only. Resets on the 1st.",
	retry: "Try again",
	retryHint: "Asks the board again",
	rowLabel: "Rank {rank}, {name}, {wins}",
	youRowLabel: "You, rank {rank}, {wins}",
});

// ── The door ─────────────────────────────────────────────────────────────────

export const DOOR_COPY = Object.freeze({
	title: "Play together",
	sub: "five little games with a pig or two",
	hint: "Opens Play together",
	waiting: "{n} waiting on you",
});

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** "2 pigs" or "2–4 pigs" (an en dash: a range, not a pause). */
export function seatsLabel(seats: { min: number; max: number }): string {
	return seats.min === seats.max ? `${seats.min} pigs` : `${seats.min}–${seats.max} pigs`;
}

/** The small tags on a game's card: how many, how fast, and co-op. */
export function gameTags(entry: Pick<CatalogEntry, "seats" | "paces" | "kind">, asyncAllowed: boolean): string[] {
	const tags = [seatsLabel(entry.seats)];
	if (entry.paces.includes("live")) tags.push(GAME_COPY.live);
	if (asyncAllowed && entry.paces.includes("async")) tags.push(GAME_COPY.byPostTag);
	if (entry.kind === "cooperative") tags.push(GAME_COPY.coop);
	return tags;
}

/** "wins" / "win" with the count: "3 wins", "1 win". Never called with 0. */
export function winsWords(wins: number): string {
	return `${wins} ${wins === 1 ? "win" : "wins"}`;
}

/** Time left on something, in a hand line: "12m left", "3h left",
 *  "under a minute left". */
export function leftWords(ms: number): string {
	if (ms <= 0) return "closing now";
	if (ms < 60_000) return "under a minute left";
	const mins = Math.floor(ms / 60_000);
	if (mins < 60) return `${mins}m left`;
	const h = Math.floor(mins / 60);
	const m = mins % 60;
	return m && h < 10 ? `${h}h ${m}m left` : `${h}h left`;
}

/** How long a search has run: "12s", "1m 05s". */
export function elapsedWords(ms: number): string {
	return formatClockMS(Math.max(0, Math.floor(ms / 1000)));
}

/** A seat's name, or a warm stand-in for an open chair. */
export function seatName(room: Pick<RoomSnapshot, "seats">, seat: Seat): string {
	return room.seats.find((s) => s.seat === seat)?.name ?? MATCH_COPY.openChair;
}

/** The pigs still at the table besides you. */
export function othersAtTable(room: Pick<RoomSnapshot, "seats" | "you">): SeatInfo[] {
	return room.seats.filter((s) => !s.gone && s.seat !== room.you);
}

/** The game's titles in a hand line: "Rootle", "Rootle or Fence the Pen",
 *  "any of the five". */
export function gamesLine(titles: readonly string[], allCount: number): string {
	if (titles.length === 0) return "";
	if (titles.length >= allCount && allCount > 1) return SEARCH_COPY.anyGame;
	if (titles.length === 1) return titles[0];
	return `${titles.slice(0, -1).join(", ")} or ${titles[titles.length - 1]}`;
}

/** The line under "Your tables" for one table's pigs. */
export function withLine(names: readonly string[]): string {
	return names.length === 0 ? TABLE_COPY.openSeat : fill(TABLE_COPY.with, { names: joinNames(names) });
}

/** "1 bot pig", "3 bot pigs". */
export function botsWords(n: number): string {
	return n === 1 ? "1 bot pig" : `${n} bot pigs`;
}

export interface LeaveDialogCopy {
	title: string;
	body: string;
	confirmLabel: string;
	cancelLabel: string;
	confirmHint: string;
	cancelHint: string;
	tone: "warm" | "destructive";
}

/**
 * What leaving this table costs, said before it happens, or null when
 * leaving costs nobody anything (a finished table, a practice table, a guest
 * standing up from a lobby): then the screen just goes.
 *
 * The rules (multiplayer/engine.ts, departures by kind): a competitive table
 * with one other pig left is that pig's win; a co-op or social table that
 * drops below the game's minimum ends early for everyone; otherwise the
 * others play on and the empty chair's turns resolve by its default. A
 * play-by-post table leaves the same way, through Resign.
 */
export function leaveDialog(
	room: Pick<RoomSnapshot, "phase" | "seats" | "you" | "host" | "pace">,
	game: { kind: GameKind; seats: { min: number } } | null,
	practice: boolean,
): LeaveDialogCopy | null {
	if (practice || room.phase === "ended" || room.you === null) return null;
	const mine = room.seats.find((s) => s.seat === room.you);
	if (!mine || mine.gone) return null;
	if (room.phase === "lobby") {
		if (room.host !== room.you) return null;
		return {
			title: "Call off the table?",
			body: "The invite closes and nobody else can sit down.",
			confirmLabel: "Call it off",
			cancelLabel: "Keep it open",
			confirmHint: "Closes the invite and leaves the table",
			cancelHint: "Keeps the invite open",
			tone: "destructive",
		};
	}
	const others = othersAtTable(room);
	const names = joinNames(others.map((s) => s.name));
	const competitive = (game?.kind ?? "competitive") === "competitive";
	const byPost = room.pace === "async";
	let body: string;
	if (others.length === 0) {
		body = "Nobody else has sat down yet, so the table packs up.";
	} else if (competitive) {
		body = others.length === 1 ? `${names} takes the win.` : `${names} play on without you.`;
	} else {
		// Below the game's minimum a co-op table cannot go on.
		body = others.length < (game?.seats.min ?? 2) ? "The game ends for everyone." : `${names} play on without you.`;
	}
	return {
		title: byPost ? (competitive ? "Resign this table?" : "Leave this table?") : competitive ? "Leave the table?" : "Leave?",
		body,
		confirmLabel: byPost && competitive ? "Resign" : "Leave",
		cancelLabel: byPost ? "Keep playing" : "Stay",
		confirmHint: "Leaves the table for good",
		cancelHint: "Stays at the table",
		tone: "destructive",
	};
}

/**
 * The result sheet's words: the protocol's (resultCopy), except its lines
 * about you leaving. A table marks a pig who left and a pig it seated out for
 * missed turns the same way (gone), so "You left before the end" was untrue
 * for a pig who never left (the 2026-10-04 run, #10). The sheet says the one
 * line true of both, and its headline names whoever took it rather than "You
 * headed home early".
 */
export function resultWords(room: RoomSnapshot): { headline: string; detail: string | null } {
	const words = resultCopy(room) ?? { headline: RESULT_HEADLINE.endedEarly, detail: null };
	if (words.detail !== RESULT_DETAIL.youHeadedHome) return words;
	let headline = words.headline;
	if (headline === RESULT_HEADLINE.youHeadedHome) {
		const winners = (room.result?.winners ?? []).map((seat) => seatName(room, seat));
		headline = winners.length > 0 ? fill(RESULT_HEADLINE.theyWon, { name: joinNames(winners) }) : RESULT_HEADLINE.endedEarly;
	}
	return { headline, detail: RESULT_COPY.movedOn };
}

/** The countdown's headline: who you found, or that everyone's here. */
export function countdownHeadline(room: Pick<RoomSnapshot, "source" | "seats">, practice: boolean): string {
	if (room.source === "rematch") return COUNTDOWN_COPY.again;
	if (practice) return COUNTDOWN_COPY.practice;
	if (room.source === "invite") return COUNTDOWN_COPY.everyone;
	return room.seats.length > 2 ? COUNTDOWN_COPY.foundMany : COUNTDOWN_COPY.foundOne;
}

/** The clock's words for whoever owes a move. */
export function clockWho(room: Pick<RoomSnapshot, "seats" | "activeSeats" | "you">): string {
	const you = room.you;
	if (you !== null && room.activeSeats.includes(you)) {
		return room.activeSeats.length > 1 ? MATCH_COPY.everyonePicks : MATCH_COPY.yourMove;
	}
	const names = room.activeSeats.map((seat) => seatName(room, seat));
	return names.length === 1 ? fill(TABLE_COPY.theirMove, { name: names[0] }) : fill(MATCH_COPY.waitingFor, { names: joinNames(names) });
}

/** The play-by-post line in place of a ticking clock. */
export function asyncLine(room: Pick<RoomSnapshot, "seats" | "activeSeats" | "you" | "deadline">, now: number): string {
	const you = room.you;
	if (you !== null && room.activeSeats.includes(you)) {
		return room.deadline === null ? MATCH_COPY.yourMove : fill(MATCH_COPY.asyncYourMove, { left: leftWords(room.deadline - now) });
	}
	const seated = room.activeSeats.filter((seat) => room.seats.some((s) => s.seat === seat));
	if (seated.length === 0) return MATCH_COPY.asyncOpenSeat;
	return fill(MATCH_COPY.asyncWaiting, { names: joinNames(seated.map((seat) => seatName(room, seat))) });
}

/** The pace a game offers by default when it offers both. */
export function defaultPace(paces: readonly Pace[]): Pace {
	return paces.includes("live") ? "live" : "async";
}

/** "October", from the board's "2026-10" period; null for anything else. */
export function monthName(period: string | null | undefined): string | null {
	const match = typeof period === "string" ? period.match(/^(\d{4})-(\d{2})$/) : null;
	if (!match) return null;
	const month = Number(match[2]);
	const names = [
		"january",
		"february",
		"march",
		"april",
		"may",
		"june",
		"july",
		"august",
		"september",
		"october",
		"november",
		"december",
	];
	return names[month - 1] ?? null;
}
