// Player-facing words for matchmade play: one line per error code, per
// result reason, the result headlines, the connection banner, invites and
// emote labels. Screens import from here instead of writing their own, so a
// refusal reads the same on every surface.
//
// Voice: short, warm, never blaming a pig. Losing still feels warm: a
// fall-short is the table's, a departure is "had to head home", a stall is a
// doze. No emoji, no em dash (ttp/no-em-dash-copy; the test scans every
// string here). {name} and {game} are filled by fill().

import type { Emote, InviteStatus, InviteSummary, ProtocolErrorCode, RoomResult, RoomSnapshot } from "@/multiplayer/protocol";
import type { Seat } from "@/multiplayer/types";
import type { ClientErrorCode, PlayConnectionState, PlayErrorCode, PlayStopReason } from "./client";

/** One line per server refusal. Typed as a full Record so a new code in the
 *  protocol fails to compile until it has words. */
export const PROTOCOL_ERROR_COPY: Readonly<Record<ProtocolErrorCode, string>> = Object.freeze({
	not_your_turn: "Hold that thought. It's not your turn yet.",
	illegal_move: "That move isn't allowed here. Try another.",
	bad_action: "That didn't quite work. Try again.",
	game_over: "This round is already over.",
	unauthorized: "Sign in again to play with friends.",
	protocol_mismatch: "Update Tickle the Pig to play with friends.",
	bad_request: "That didn't quite work. Try again.",
	not_found: "That table has packed up.",
	forbidden: "That seat isn't yours.",
	blocked: "This table isn't open to you.",
	full: "That table is full.",
	expired: "Too late for that one. It wandered off.",
	busy: "You're already at a table.",
	stale: "The table moved on. Have another look.",
	rate_limited: "Easy there. Give it a moment.",
	disabled: "Play is napping right now. Try again soon.",
	game_unavailable: "That game is resting right now. Pick another?",
	internal: "That didn't go through. Give it another go.",
});

/** Failures that happen on the phone, not the server. */
export const CLIENT_ERROR_COPY: Readonly<Record<ClientErrorCode, string>> = Object.freeze({
	timeout: "The table didn't answer. Give it another go.",
	offline: "You're offline. Play picks up when you're back.",
	disconnected: "Lost the table for a moment. Reconnecting.",
});

/** The line for any request failure. */
export function errorCopy(code: PlayErrorCode | null | undefined): string {
	if (!code) return PROTOCOL_ERROR_COPY.internal;
	if (Object.hasOwn(PROTOCOL_ERROR_COPY, code)) return PROTOCOL_ERROR_COPY[code as ProtocolErrorCode];
	if (Object.hasOwn(CLIENT_ERROR_COPY, code)) return CLIENT_ERROR_COPY[code as ClientErrorCode];
	return PROTOCOL_ERROR_COPY.internal;
}

/** One line per way a table can end. */
export const RESULT_REASON_COPY: Readonly<Record<RoomResult["reason"], string>> = Object.freeze({
	complete: "Played all the way to the end.",
	forfeit: "A pig had to head home, so the table called it.",
	ended_early: "The table ended early. No result this time.",
	server: "The table took a breather. No result this time.",
});

/** Result headlines: a short phrase, no full stop. */
export const RESULT_HEADLINE = Object.freeze({
	youWon: "You took it",
	theyWon: "{name} took it",
	draw: "A draw",
	/** I share the top place with another pig (3 or more at the table). */
	youShared: "You shared the win",
	/** Other pigs share the top place; {name} is "Copper and Pepper". */
	theyShared: "{name} shared it",
	coopSuccess: "You did it together",
	coopShort: "So close, together",
	social: "What a round",
	endedEarly: "Ended early",
	dozedOff: "Everyone dozed off",
	serverPause: "The table took a breather",
	// A forfeit can be a Leave or a clock that ran out; the copy is true for both.
	youHeadedHome: "The table moved on",
});

/** The sentence under a headline. */
export const RESULT_DETAIL = Object.freeze({
	headedHome: "{name} had to head home.",
	youHeadedHome: "The table moved on without you.",
	noResult: "No result this time.",
	coopShort: "Every pig played their part. Next time, together.",
	coopSuccess: "Every pig played their part.",
});

/** The connection banner, by state. Null: show nothing. */
export const CONNECTION_COPY = Object.freeze({
	connecting: "Finding the table…",
	reconnecting: "Reconnecting…",
	stopped: Object.freeze({
		protocol_mismatch: "Update Tickle the Pig to keep playing with friends.",
		disabled: "Play is napping right now. Try again soon.",
		unauthorized: "Sign in again to play with friends.",
		signed_in_elsewhere: "You're playing on another device. Come back here to pick it up.",
		signed_out: "Sign in to play with friends.",
	} satisfies Record<PlayStopReason, string>),
});

export function connectionCopy(connection: PlayConnectionState | null | undefined): string | null {
	if (!connection) return null;
	switch (connection.status) {
		case "connecting":
			return CONNECTION_COPY.connecting;
		case "reconnecting":
			return CONNECTION_COPY.reconnecting;
		case "stopped":
			return connection.reason ? CONNECTION_COPY.stopped[connection.reason] : CONNECTION_COPY.stopped.disabled;
		default:
			return null;
	}
}

export const QUEUE_COPY = Object.freeze({
	searching: "Looking for a pig to play with…",
	practiceOffer: "Still sniffing around. Practice while you wait, or play by post?",
});

export const INVITE_COPY = Object.freeze({
	invitedYou: "{name} invited you to play {game}",
	sent: "Invite sent. Your table is waiting.",
});

/** How an invite stands, for a row that is no longer open. */
export const INVITE_STATUS_COPY: Readonly<Record<InviteStatus, string>> = Object.freeze({
	open: "Waiting for a pig",
	accepted: "Accepted",
	declined: "Not this time",
	cancelled: "Called off",
	expired: "This invite wandered off",
	full: "That table filled up",
});

/** Accessibility labels for the emote stickers. */
export const EMOTE_LABEL: Readonly<Record<Emote, string>> = Object.freeze({
	oink: "Oink",
	love: "Love",
	giggle: "Giggle",
	wow: "Wow",
	oops: "Oops",
	gg: "Good game",
});

/** Fill {name}, {game} and friends. Unknown keys stay as written. */
export function fill(template: string, vars: Readonly<Record<string, string>>): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(vars, key) ? vars[key] : match));
}

/** "Copper", "Copper and Pepper", "Copper, Pepper and Bandit". */
export function joinNames(names: readonly string[]): string {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function inviteLine(invite: Pick<InviteSummary, "from">, gameTitle: string): string {
	return fill(INVITE_COPY.invitedYou, { name: invite.from.name, game: gameTitle });
}

export interface ResultCopy {
	headline: string;
	/** A sentence for under the headline, or null. */
	detail: string | null;
}

function nameAt(room: RoomSnapshot, seat: Seat): string {
	return room.seats.find((s) => s.seat === seat)?.name ?? "A pig";
}

/**
 * The result card's words for `room`, from the viewer's seat (`room.you`).
 * Null while the table is still going.
 */
export function resultCopy(room: RoomSnapshot | null | undefined): ResultCopy | null {
	const result = room?.result;
	if (!room || !result) return null;
	const you = room.you;
	const own = result.summary?.trim() ? result.summary.trim() : null;
	// A game's own name-free line wins; without one, the scores speak.
	const summary = own ?? scoreLine(room, result);
	const gone = room.seats.filter((s) => s.gone);
	const goneOthers = gone.filter((s) => s.seat !== you).map((s) => s.name);
	const youLeft = you !== null && gone.some((s) => s.seat === you);

	if (result.kind === "no_contest") {
		if (result.reason === "server") return { headline: RESULT_HEADLINE.serverPause, detail: RESULT_DETAIL.noResult };
		// Every pig still seated idled out together: nobody left anybody.
		if (room.seats.length > 0 && gone.length === room.seats.length) {
			return { headline: RESULT_HEADLINE.dozedOff, detail: RESULT_DETAIL.noResult };
		}
		if (youLeft && goneOthers.length === 0) return { headline: RESULT_HEADLINE.endedEarly, detail: RESULT_DETAIL.youHeadedHome };
		if (goneOthers.length > 0) {
			return { headline: RESULT_HEADLINE.endedEarly, detail: fill(RESULT_DETAIL.headedHome, { name: joinNames(goneOthers) }) };
		}
		return { headline: RESULT_HEADLINE.endedEarly, detail: RESULT_DETAIL.noResult };
	}

	if (result.kind === "coop") {
		// A co-op table repeats one shared score per seat, so a score line
		// would read as a ranking: the table's own words or a warm default.
		if (result.success === true) return { headline: RESULT_HEADLINE.coopSuccess, detail: own ?? RESULT_DETAIL.coopSuccess };
		if (result.success === false) return { headline: RESULT_HEADLINE.coopShort, detail: own ?? RESULT_DETAIL.coopShort };
		return { headline: RESULT_HEADLINE.social, detail: own };
	}

	if (result.kind === "draw") {
		// `winners` lists the seats sharing the top place; empty (or every
		// seat) means the whole table drew. Two pigs level is just a draw.
		const sharers = result.winners;
		if (sharers.length === 0 || sharers.length >= room.seats.length || room.seats.length <= 2) {
			return { headline: RESULT_HEADLINE.draw, detail: summary };
		}
		if (you !== null && sharers.includes(you)) return { headline: RESULT_HEADLINE.youShared, detail: summary };
		const names = joinNames(sharers.map((seat) => nameAt(room, seat)));
		return { headline: fill(RESULT_HEADLINE.theyShared, { name: names }), detail: summary };
	}

	// A win.
	if (result.winners.length === 0) return { headline: RESULT_HEADLINE.endedEarly, detail: RESULT_DETAIL.noResult };
	const forfeit = result.reason === "forfeit";
	if (you !== null && result.winners.includes(you)) {
		const detail = forfeit && goneOthers.length > 0 ? fill(RESULT_DETAIL.headedHome, { name: joinNames(goneOthers) }) : summary;
		return { headline: RESULT_HEADLINE.youWon, detail };
	}
	if (youLeft && forfeit) return { headline: RESULT_HEADLINE.youHeadedHome, detail: RESULT_DETAIL.youHeadedHome };
	const winners = joinNames(result.winners.map((seat) => nameAt(room, seat)));
	return { headline: fill(RESULT_HEADLINE.theyWon, { name: winners }), detail: summary };
}

/** The scores in seat order, with names, for a result with no summary of its
 *  own: "Rosie 54 · Clover 47 · Biscuit 31". Null when there are none. */
export function scoreLine(room: RoomSnapshot, result: RoomResult): string | null {
	if (!Array.isArray(result.scores) || result.scores.length === 0) return null;
	const parts = room.seats
		.filter((seat) => Number.isFinite(result.scores[seat.seat]))
		.map((seat) => `${seat.name} ${result.scores[seat.seat]}`);
	return parts.length > 0 ? parts.join(" · ") : null;
}

/** Just the headline (a "Your games" row, a push preview). */
export function resultHeadline(room: RoomSnapshot | null | undefined): string | null {
	return resultCopy(room)?.headline ?? null;
}
