// The play store: a pure reducer over every server frame, plus the selectors
// the Play screens read. No React, no sockets, no clocks of its own: the
// provider (hooks/useMultiplayer.tsx) feeds it PlayClient output and the
// caller passes every timestamp in, so __tests__/multiplayer/store.test.ts
// drives it with plain objects.
//
// Invariants:
//   • rooms keep the HIGHEST rev only. An older or equal snapshot is dropped
//     whole, so a re-sent snapshot can never replay its events: the UI keys
//     animations on `${roomId}:${rev}` and plays each rev's events once;
//   • invites are keyed by code, sent and received alike. Incoming means
//     addressed to me (direct `to` includes my id) or a crew/link invite I
//     previewed;
//   • the reducer returns the SAME state object when nothing changed, so a
//     subscriber can compare by reference.

import type {
	CatalogEntry,
	Emote,
	InviteSummary,
	PlayerCard,
	ProtocolErrorCode,
	QueueState,
	RoomSnapshot,
	RoomSummary,
	SeatInfo,
	ServerMessage,
	Timing,
} from "@/multiplayer/protocol";
import type { GameEvent, Seat } from "@/multiplayer/types";
import { IDLE_CONNECTION, mergeTiming, type PlayConnectionState } from "./client";

// ── State ────────────────────────────────────────────────────────────────────

export interface EmoteMark {
	emote: Emote;
	/** When it was sent, on the room's clock (server epoch ms for a real
	 *  table, device epoch ms for Practice). */
	at: number;
}

export interface PlayNotice {
	kind: "server_restarting" | "signed_in_elsewhere";
	message: string;
	at: number;
}

export interface PlayErrorMark {
	error: ProtocolErrorCode;
	message: string | null;
	at: number;
}

export type RoomGoneReason = "not_found" | "left" | "expired";

export interface PlayState {
	connection: PlayConnectionState;
	/** Who the server says we are (from the welcome). */
	me: { userId: string; name: string } | null;
	timing: Timing;
	catalog: CatalogEntry[];
	clockOffsetMs: number;
	rttMs: number | null;
	queue: QueueState;
	/** The latest snapshot per table, highest rev wins. */
	rooms: Record<string, RoomSnapshot>;
	/** The "Your games" list: tables I sit at (welcome.resume, `rooms`
	 *  frames, kept current by every snapshot). */
	roomSummaries: Record<string, RoomSummary>;
	/** Tables the server said are gone (or I left). Cleared if it comes back. */
	goneRooms: Record<string, RoomGoneReason>;
	/** A finished table → the table its rematch created. */
	successors: Record<string, string>;
	/** Every invite I sent, received or previewed, by code. */
	invites: Record<string, InviteSummary>;
	/** Codes I previewed (a link or crew invite counts as incoming once seen). */
	previewed: Record<string, true>;
	/** The latest emote per room per seat. */
	emotes: Record<string, Record<number, EmoteMark>>;
	notices: PlayNotice[];
	/** The last unsolicited `error` frame (request failures go to the caller). */
	lastError: PlayErrorMark | null;
}

export const IDLE_QUEUE: QueueState = Object.freeze({ state: "idle", games: [], pace: "live", since: null }) as QueueState;

const NO_EMOTES: Record<number, EmoteMark> = Object.freeze({}) as Record<number, EmoteMark>;
const MAX_NOTICES = 10;

export const INITIAL_PLAY_STATE: PlayState = Object.freeze({
	connection: IDLE_CONNECTION,
	me: null,
	timing: mergeTiming(null),
	catalog: [],
	clockOffsetMs: 0,
	rttMs: null,
	queue: IDLE_QUEUE,
	rooms: {},
	roomSummaries: {},
	goneRooms: {},
	successors: {},
	invites: {},
	previewed: {},
	emotes: {},
	notices: [],
	lastError: null,
}) as PlayState;

// ── Actions ──────────────────────────────────────────────────────────────────

export type PlayAction =
	| { type: "connection"; connection: PlayConnectionState }
	/** A parsed server frame. `at` is the receive time on the server clock. */
	| { type: "server"; message: ServerMessage; at: number }
	| { type: "clock"; offsetMs: number; rttMs: number | null }
	/** An invite from an ack (create / preview / accept). */
	| { type: "invite"; invite: InviteSummary; previewed?: boolean }
	/** A snapshot from an ack (preview, join). Same rev rule as room.state. */
	| { type: "room"; room: RoomSnapshot; at: number }
	/** My own emote, echoed locally before (or instead of) the server's. */
	| { type: "emote"; roomId: string; seat: Seat; emote: Emote; at: number }
	/** I left this table: drop it from "Your games". The snapshot stays so a
	 *  mounted screen does not blank before it navigates away. */
	| { type: "forgetRoom"; roomId: string }
	| { type: "rematchLink"; from: string; to: string }
	| { type: "dismissNotice"; at: number }
	| { type: "clearError" }
	/** Sign-out or account switch: everything but the connection. */
	| { type: "reset" };

// ── Reducer ──────────────────────────────────────────────────────────────────

export function playReducer(state: PlayState, action: PlayAction): PlayState {
	switch (action.type) {
		case "connection":
			return sameConnection(state.connection, action.connection) ? state : { ...state, connection: action.connection };
		case "clock":
			if (state.clockOffsetMs === action.offsetMs && state.rttMs === action.rttMs) return state;
			return { ...state, clockOffsetMs: action.offsetMs, rttMs: action.rttMs };
		case "server":
			return reduceServer(state, action.message, action.at);
		case "invite":
			return upsertInvite(state, action.invite, action.previewed === true);
		case "room":
			return applyRoom(state, action.room, action.at);
		case "emote":
			return setEmote(state, action.roomId, action.seat, { emote: action.emote, at: action.at });
		case "forgetRoom": {
			const hasSummary = Object.hasOwn(state.roomSummaries, action.roomId);
			if (!hasSummary && state.goneRooms[action.roomId] === "left") return state;
			return {
				...state,
				roomSummaries: hasSummary ? omit(state.roomSummaries, action.roomId) : state.roomSummaries,
				goneRooms: { ...state.goneRooms, [action.roomId]: "left" },
			};
		}
		case "rematchLink":
			if (action.from === action.to || state.successors[action.from] === action.to) return state;
			return { ...state, successors: { ...state.successors, [action.from]: action.to } };
		case "dismissNotice": {
			const notices = state.notices.filter((n) => n.at !== action.at);
			return notices.length === state.notices.length ? state : { ...state, notices };
		}
		case "clearError":
			return state.lastError === null ? state : { ...state, lastError: null };
		case "reset":
			return { ...INITIAL_PLAY_STATE, connection: state.connection };
		default:
			return state;
	}
}

function reduceServer(state: PlayState, message: ServerMessage, at: number): PlayState {
	switch (message.t) {
		case "welcome": {
			// A different account on the same install starts from nothing.
			const base = state.me && state.me.userId !== message.userId ? { ...INITIAL_PLAY_STATE, connection: state.connection } : state;
			const resume = message.resume ?? { queue: IDLE_QUEUE, rooms: [], invites: [] };
			// The resume is the server's word on my open invites; keep the ones
			// I only previewed (a link invite is mine to look at, not the
			// server's to list).
			const invites: Record<string, InviteSummary> = {};
			for (const code of Object.keys(base.previewed)) {
				const kept = base.invites[code];
				if (kept) invites[code] = kept;
			}
			for (const invite of resume.invites ?? []) invites[invite.code] = invite;
			return {
				...base,
				me: { userId: message.userId, name: message.name },
				timing: mergeTiming(message.timing),
				catalog: Array.isArray(message.catalog) ? message.catalog : [],
				queue: resume.queue ?? IDLE_QUEUE,
				roomSummaries: indexSummaries(resume.rooms ?? []),
				invites,
				lastError: null,
			};
		}
		case "queue.state":
			return { ...state, queue: message.queue };
		case "room.state":
			return applyRoom(state, message.room, at);
		case "room.gone": {
			if (state.goneRooms[message.roomId] === message.reason && !Object.hasOwn(state.roomSummaries, message.roomId)) return state;
			return {
				...state,
				goneRooms: { ...state.goneRooms, [message.roomId]: message.reason },
				roomSummaries: omit(state.roomSummaries, message.roomId),
			};
		}
		case "room.emote":
			return setEmote(state, message.roomId, message.seat, { emote: message.emote, at: message.at });
		case "invite.state":
			return upsertInvite(state, message.invite, false);
		case "rooms":
			return { ...state, roomSummaries: indexSummaries(message.rooms) };
		case "notice":
			return {
				...state,
				notices: [...state.notices, { kind: message.kind, message: message.message, at }].slice(-MAX_NOTICES),
			};
		case "error":
			return { ...state, lastError: { error: message.error, message: message.message ?? null, at } };
		case "pong":
		case "ack":
		default:
			return state;
	}
}

function applyRoom(state: PlayState, room: RoomSnapshot, at: number): PlayState {
	const prev = state.rooms[room.roomId];
	if (prev && prev.rev >= room.rev) return state;
	let next: PlayState = { ...state, rooms: { ...state.rooms, [room.roomId]: room } };
	// A table I walked away from (its final snapshot can still arrive) never
	// comes back into "Your games".
	const iLeft = mySeat(room)?.gone === true;

	if (room.you !== null && !iLeft) {
		const summary = summaryFromSnapshot(room, at);
		next = { ...next, roomSummaries: { ...next.roomSummaries, [room.roomId]: summary } };
	} else if (iLeft && Object.hasOwn(next.roomSummaries, room.roomId)) {
		next = { ...next, roomSummaries: omit(next.roomSummaries, room.roomId) };
	}
	if (room.invite) {
		next = { ...next, invites: { ...next.invites, [room.invite.code]: room.invite } };
	}
	if (Object.hasOwn(next.goneRooms, room.roomId) && !(iLeft && next.goneRooms[room.roomId] === "left")) {
		next = { ...next, goneRooms: omit(next.goneRooms, room.roomId) };
	}
	// A brand-new rematch table: link the finished table it came from, so a
	// match screen still on the old id can follow it.
	if (!prev && room.source === "rematch") {
		const from = rematchParent(next, room);
		if (from && !next.successors[from]) next = { ...next, successors: { ...next.successors, [from]: room.roomId } };
	}
	return next;
}

/** The finished table a rematch came from: the most recent ended room with
 *  the same pigs (by user id) that is not already linked. */
function rematchParent(state: PlayState, room: RoomSnapshot): string | null {
	const pigs = userSet(room.seats);
	let best: RoomSnapshot | null = null;
	for (const candidate of Object.values(state.rooms)) {
		if (candidate.roomId === room.roomId || candidate.phase !== "ended") continue;
		if (state.successors[candidate.roomId]) continue;
		if (candidate.game !== room.game) continue;
		const present = candidate.seats.filter((s) => !s.gone);
		if (!sameSet(userSet(present), pigs)) continue;
		if (!best || candidate.rev > best.rev) best = candidate;
	}
	return best?.roomId ?? null;
}

function upsertInvite(state: PlayState, invite: InviteSummary, previewed: boolean): PlayState {
	const prev = state.invites[invite.code];
	const alreadyPreviewed = state.previewed[invite.code] === true;
	if (prev === invite && (!previewed || alreadyPreviewed)) return state;
	return {
		...state,
		invites: { ...state.invites, [invite.code]: invite },
		previewed: previewed && !alreadyPreviewed ? { ...state.previewed, [invite.code]: true } : state.previewed,
	};
}

function setEmote(state: PlayState, roomId: string, seat: Seat, mark: EmoteMark): PlayState {
	const room = state.emotes[roomId] ?? NO_EMOTES;
	const prev = room[seat];
	if (prev && prev.at > mark.at) return state; // an older emote never replaces a newer one
	if (prev && prev.at === mark.at && prev.emote === mark.emote) return state;
	return { ...state, emotes: { ...state.emotes, [roomId]: { ...room, [seat]: mark } } };
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** A "Your games" row derived from a fresher snapshot. */
export function summaryFromSnapshot(room: RoomSnapshot, at: number): RoomSummary {
	const opponents: PlayerCard[] = room.seats
		.filter((s) => s.seat !== room.you)
		.map(({ userId, name, look }) => ({ userId, name, look }));
	return {
		roomId: room.roomId,
		game: room.game,
		pace: room.pace,
		phase: room.phase,
		yourTurn: isMyTurn(room),
		opponents,
		deadline: room.deadline,
		updatedAt: at,
	};
}

function indexSummaries(list: readonly RoomSummary[]): Record<string, RoomSummary> {
	const out: Record<string, RoomSummary> = {};
	for (const summary of list) out[summary.roomId] = summary;
	return out;
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
	if (!Object.hasOwn(record, key)) return record;
	const next = { ...record };
	delete next[key];
	return next;
}

function userSet(seats: readonly { userId: string }[]): Set<string> {
	return new Set(seats.map((s) => s.userId));
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
	if (a.size !== b.size || a.size === 0) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
}

function sameConnection(a: PlayConnectionState, b: PlayConnectionState): boolean {
	return a.status === b.status && a.reason === b.reason && a.attempt === b.attempt && a.retryAt === b.retryAt;
}

// ── Selectors ────────────────────────────────────────────────────────────────

/** The server clock, from a local timestamp and the measured offset. */
export function serverNow(state: PlayState, localNow: number): number {
	return localNow + state.clockOffsetMs;
}

/**
 * Milliseconds left on the table's running clock: the decision deadline
 * while playing, the countdown while starting. Null when no clock runs (an
 * untimed Practice table, an async open chair, a lobby, a finished table).
 * Pass the room source's `now()` for `now`: server time for a real table,
 * the device clock for Practice.
 */
export function msLeft(room: RoomSnapshot | null | undefined, now: number): number | null {
	if (!room) return null;
	const target = room.phase === "playing" ? room.deadline : room.phase === "starting" ? room.startsAt : null;
	return target === null ? null : Math.max(0, target - now);
}

/** Milliseconds left in a finished table's rematch window (null: none open). */
export function rematchMsLeft(room: RoomSnapshot | null | undefined, now: number): number | null {
	if (!room || room.phase !== "ended" || !room.rematch) return null;
	return Math.max(0, room.rematch.until - now);
}

/** My seat's info at this table (null when not seated). */
export function mySeat(room: RoomSnapshot | null | undefined): SeatInfo | null {
	if (!room || room.you === null) return null;
	return room.seats.find((s) => s.seat === room.you) ?? null;
}

/** True when the table is in play and waiting on me. */
export function isMyTurn(room: RoomSnapshot | null | undefined): boolean {
	if (!room || room.phase !== "playing" || room.you === null) return false;
	if (!room.activeSeats.includes(room.you)) return false;
	return mySeat(room)?.gone !== true;
}

/** This rev's events if they are newer than what the UI already played. */
export function eventsSince(room: RoomSnapshot | null | undefined, seenRev: number | null): GameEvent[] {
	if (!room) return [];
	return seenRev === null || room.rev > seenRev ? room.events : [];
}

function isOpen(invite: InviteSummary, now: number | undefined): boolean {
	return invite.status === "open" && (now === undefined || invite.expiresAt > now);
}

/**
 * Open invites waiting on me, newest first: a direct invite naming me, or a
 * crew / link invite I previewed. Never my own. Pass the server clock to
 * drop the ones that lapsed between frames.
 */
export function incomingInvites(state: PlayState, now?: number): InviteSummary[] {
	const me = state.me?.userId;
	if (!me) return [];
	return Object.values(state.invites)
		.filter((invite) => {
			if (invite.from.userId === me || !isOpen(invite, now)) return false;
			if (invite.kind === "direct") return invite.to.includes(me);
			return state.previewed[invite.code] === true || invite.to.includes(me);
		})
		.sort((a, b) => b.expiresAt - a.expiresAt);
}

/** Open invites I sent, newest first. */
export function sentInvites(state: PlayState, now?: number): InviteSummary[] {
	const me = state.me?.userId;
	if (!me) return [];
	return Object.values(state.invites)
		.filter((invite) => invite.from.userId === me && isOpen(invite, now))
		.sort((a, b) => b.expiresAt - a.expiresAt);
}

/** "Your games": tables where it is my turn first, then the freshest. A
 *  live snapshot, when held, outranks the summary it refreshes. */
export function roomSummaryList(state: PlayState): RoomSummary[] {
	return Object.values(state.roomSummaries)
		.map((summary) => {
			const room = state.rooms[summary.roomId];
			return room && room.you !== null ? { ...summary, yourTurn: isMyTurn(room), phase: room.phase, deadline: room.deadline } : summary;
		})
		.sort((a, b) => Number(b.yourTurn) - Number(a.yourTurn) || b.updatedAt - a.updatedAt);
}

/** How many tables are waiting on me (the Play door's badge). */
export function yourTurnCount(state: PlayState): number {
	let count = 0;
	for (const summary of Object.values(state.roomSummaries)) {
		const room = state.rooms[summary.roomId];
		const mine = room && room.you !== null ? isMyTurn(room) : summary.phase === "playing" && summary.yourTurn;
		if (mine) count++;
	}
	return count;
}

/** The table a room's rematch chain ends at (the room itself when none). */
export function followRematch(state: PlayState, roomId: string): string {
	let current = roomId;
	const seen = new Set<string>([current]);
	while (Object.hasOwn(state.successors, current)) {
		const next = state.successors[current];
		if (seen.has(next)) break;
		seen.add(next);
		current = next;
	}
	return current;
}

export function isSearching(state: PlayState): boolean {
	return state.queue.state === "searching";
}

/** After timing.practiceOfferMs in the live queue, offer Practice or a
 *  by-post game instead of more waiting. */
export function shouldOfferPractice(state: PlayState, now: number): boolean {
	const { queue } = state;
	if (queue.state !== "searching" || queue.pace !== "live" || queue.since === null) return false;
	return now - queue.since >= state.timing.practiceOfferMs;
}

/** True while I hold a seat at a live table that is filling or in play, or
 *  am searching: the provider keeps the socket up for these even when no
 *  Play screen is mounted. */
export function holdsLiveInterest(state: PlayState): boolean {
	if (isSearching(state)) return true;
	for (const room of Object.values(state.rooms)) {
		if (room.pace !== "live" || room.you === null || room.phase === "ended") continue;
		if (state.goneRooms[room.roomId]) continue;
		if (mySeat(room)?.gone) continue;
		return true;
	}
	return false;
}

/** The latest emotes at a table, by seat. */
export function roomEmotes(state: PlayState, roomId: string): Record<number, EmoteMark> {
	return state.emotes[roomId] ?? NO_EMOTES;
}


// ── A tiny external store over the reducer ──────────────────────────────────

export interface PlayStore {
	getState(): PlayState;
	dispatch(action: PlayAction): void;
	subscribe(listener: () => void): () => void;
}

/** useSyncExternalStore-shaped holder: listeners hear about a change only
 *  when the reducer returned a new state object. */
export function createPlayStore(initial: PlayState = INITIAL_PLAY_STATE): PlayStore {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		getState: () => state,
		dispatch(action) {
			const next = playReducer(state, action);
			if (next === state) return;
			state = next;
			for (const listener of [...listeners]) {
				try {
					listener();
				} catch {
					// a broken subscriber must not starve the others
				}
			}
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
