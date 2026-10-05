// The wire protocol between the app and the play server (JSON text frames over
// one WebSocket). Both sides import these types; the server additionally runs
// `parseClientMessage` on every inbound frame, so nothing untyped reaches the
// hub, the matchmaker or a room.
//
// Shape of a conversation:
//   client → { t: "auth", token, protocol }           (first frame, within 5 s)
//   server → { t: "welcome", userId, catalog, resume } (or closes 4001/4002)
//   client → { t: "queue.join", rid: 1, games, pace }
//   server → { t: "ack", rid: 1, ok: true }
//   server → { t: "queue.state", state: "searching", ... }
//   server → { t: "room.state", room }                 (matched; then every rev)
//   client → { t: "room.action", rid: 2, roomId, rev, action }
//   server → { t: "ack", rid: 2, ok: true } + { t: "room.state", room }
//
// The server is the authority for every match. The client renders the latest
// `room.state` it holds and never applies an action locally — a press shows
// local feedback (a squash, a pending mark) and waits for the next state.

import type { GameErrorCode, GameEvent, GameId, GameKind, Pace, Seat } from "./types";
import { isInt, isOneOf, isRecord, isShortString } from "./validate";

export const PROTOCOL_VERSION = 1;

/** Cosmetic reactions a seat can send during a match. No free text, ever:
 *  strangers share a table, so expression is a fixed sticker set. */
export const EMOTES = ["oink", "love", "giggle", "wow", "oops", "gg"] as const;
export type Emote = (typeof EMOTES)[number];

export const INVITE_KINDS = ["direct", "link", "crew"] as const;
/** direct: named friends (pushed). link: anyone holding the URL. crew: the
 *  caller's Sounder (pushed to every member; first to accept takes a seat). */
export type InviteKind = (typeof INVITE_KINDS)[number];

export type InviteStatus = "open" | "accepted" | "declined" | "cancelled" | "expired" | "full";

/** Server-tunable timing. These are the compiled defaults; the server sends
 *  the live values in `welcome.timing`, and the client must read them from
 *  there (server config over constants). */
export const DEFAULT_TIMING = {
	/** Client sends an app-level ping this often while connected. */
	heartbeatMs: 25_000,
	/** Server drops a socket that has sent nothing for this long. */
	idleTimeoutMs: 70_000,
	/** A live seat that drops may reconnect within this window. */
	reconnectGraceMs: 20_000,
	/** "Found a pig!" beat before a live match starts. */
	countdownMs: 3_000,
	/** How long a finished live table waits for rematch votes. */
	rematchWindowMs: 30_000,
	/** Minimum gap between two emotes from one seat. */
	emoteCooldownMs: 2_000,
	/** After this long in the live queue the client offers Practice / By post. */
	practiceOfferMs: 15_000,
	/** Invite lifetimes for a live table (everyone is about to play). */
	inviteTtlMs: { direct: 15 * 60_000, crew: 15 * 60_000, link: 60 * 60_000 } as Record<InviteKind, number>,
	/** A play-by-push invite waits a day for its pigs, whatever its kind. */
	asyncInviteTtlMs: 24 * 3_600_000,
};
export type Timing = typeof DEFAULT_TIMING;

/** Inbound frames larger than this are refused before parsing. */
export const MAX_FRAME_BYTES = 8 * 1024;

// ── Shared shapes ────────────────────────────────────────────────────────────

/** A pig as other players see it: which pig, and the item id worn in each
 *  slot (null = empty). The client resolves ids to art exactly as the visit
 *  and leaderboard do. Snapshotted when a seat is taken. */
export interface PigLook {
	pigId: string;
	hat: string | null;
	bow: string | null;
	glasses: string | null;
	mask: string | null;
	neck: string | null;
	held: string | null;
	aura: string | null;
	/** Public Wallow rank (portrait ring); 0 when none. */
	wallow: number;
}

export interface PlayerCard {
	userId: string;
	name: string;
	look: PigLook;
}

export interface CatalogEntry {
	id: GameId;
	title: string;
	tagline: string;
	kind: GameKind;
	seats: { min: number; max: number };
	paces: Pace[];
	rulesVersion: number;
	/** False while a game is switched off server-side (kept in the list so a
	 *  resumed match can still render). */
	enabled: boolean;
}

export interface SeatInfo extends PlayerCard {
	seat: Seat;
	/** Socket currently attached (live presence; async seats are usually not). */
	connected: boolean;
	/** Left the table for good (forfeit / walked away). */
	gone: boolean;
}

export type RoomPhase =
	/** Invite table: seats are filling. */
	| "lobby"
	/** Seats are full; the countdown runs. */
	| "starting"
	| "playing"
	| "ended";

export type RoomSource = "queue" | "invite" | "rematch";

export interface RoomResult {
	kind: "win" | "draw" | "coop" | "no_contest";
	winners: Seat[];
	scores: number[];
	success?: boolean;
	summary: string;
	/** complete: played to the end. forfeit: a seat left a competitive table.
	 *  ended_early: a co-op/social table lost a pig. server: a restart or fault. */
	reason: "complete" | "forfeit" | "ended_early" | "server";
}

/** Everything one seat needs to draw a table. Sent after every revision. */
export interface RoomSnapshot<V = unknown> {
	roomId: string;
	game: GameId;
	rulesVersion: number;
	pace: Pace;
	source: RoomSource;
	phase: RoomPhase;
	/** Filled seats, in seat order. Open async seats are absent. */
	seats: SeatInfo[];
	/** Total seats at this table (filled + open). */
	seatCount: number;
	/** The receiving player's seat (null for a not-yet-seated invite preview). */
	you: Seat | null;
	/** game.view(state, you); null until the game is set up. */
	view: V | null;
	activeSeats: Seat[];
	/** Server epoch ms by which the active seats must act (null: no clock). */
	deadline: number | null;
	/** Countdown end (phase "starting"). */
	startsAt: number | null;
	/** Monotonic per room; a client ignores any snapshot older than it holds. */
	rev: number;
	/** Cues produced by the step that made this rev, filtered for `you`. */
	events: GameEvent[];
	result: RoomResult | null;
	/** Open invite attached to a lobby (host sees the link to share). */
	invite: InviteSummary | null;
	/** Seats that asked for a rematch, and until when the table waits. */
	rematch: { votes: Seat[]; until: number } | null;
	/** Seat that may start a lobby early (host), when allowed. */
	host: Seat | null;
}

export interface InviteSummary {
	code: string;
	url: string;
	game: GameId;
	pace: Pace;
	kind: InviteKind;
	from: PlayerCard;
	/** Named invitees (direct). */
	to: string[];
	status: InviteStatus;
	roomId: string | null;
	seatsTaken: number;
	seatsMax: number;
	expiresAt: number;
}

/** A table the player sits at, for the "Your games" list and resume. */
export interface RoomSummary {
	roomId: string;
	game: GameId;
	pace: Pace;
	phase: RoomPhase;
	yourTurn: boolean;
	opponents: PlayerCard[];
	deadline: number | null;
	updatedAt: number;
}

export interface QueueState {
	state: "idle" | "searching";
	games: GameId[];
	pace: Pace;
	/** Server epoch ms the search began. */
	since: number | null;
}

export type ProtocolErrorCode =
	| GameErrorCode
	| "unauthorized"
	| "protocol_mismatch"
	| "bad_request"
	| "not_found"
	| "forbidden"
	| "blocked"
	| "full"
	| "expired"
	| "busy"
	| "stale"
	| "rate_limited"
	| "disabled"
	| "game_unavailable"
	| "internal";

// ── Client → server ─────────────────────────────────────────────────────────

interface Req {
	/** Request id; when present the server answers with an `ack` carrying it. */
	rid?: number;
}

export type ClientMessage =
	| (Req & { t: "auth"; token: string; protocol: number; client?: { version?: string; build?: string; platform?: string } })
	| (Req & { t: "ping"; ct: number })
	| (Req & { t: "sync" })
	| (Req & { t: "queue.join"; games: GameId[]; pace: Pace })
	| (Req & { t: "queue.leave" })
	| (Req & { t: "invite.create"; game: GameId; kind: InviteKind; to?: string[]; pace: Pace })
	| (Req & { t: "invite.preview"; code: string })
	| (Req & { t: "invite.accept"; code: string })
	| (Req & { t: "invite.decline"; code: string })
	| (Req & { t: "invite.cancel"; code: string })
	| (Req & { t: "room.join"; roomId: string })
	| (Req & { t: "room.action"; roomId: string; rev: number; action: unknown })
	| (Req & { t: "room.leave"; roomId: string })
	| (Req & { t: "room.emote"; roomId: string; emote: Emote })
	| (Req & { t: "room.rematch"; roomId: string })
	| (Req & { t: "room.start"; roomId: string });

export type ClientMessageType = ClientMessage["t"];

// ── Server → client ─────────────────────────────────────────────────────────

export interface ResumeState {
	queue: QueueState;
	rooms: RoomSummary[];
	/** Open invites the player sent or received. */
	invites: InviteSummary[];
}

export type ServerMessage =
	| { t: "welcome"; userId: string; name: string; serverNow: number; protocol: number; timing: Timing; catalog: CatalogEntry[]; resume: ResumeState }
	| { t: "pong"; ct: number; st: number }
	| { t: "ack"; rid: number; ok: true; data?: unknown }
	| { t: "ack"; rid: number; ok: false; error: ProtocolErrorCode; message?: string }
	| { t: "queue.state"; queue: QueueState }
	| { t: "room.state"; room: RoomSnapshot }
	| { t: "room.gone"; roomId: string; reason: "not_found" | "left" | "expired" }
	| { t: "room.emote"; roomId: string; seat: Seat; emote: Emote; at: number }
	| { t: "invite.state"; invite: InviteSummary }
	| { t: "rooms"; rooms: RoomSummary[] }
	| { t: "notice"; kind: "server_restarting" | "signed_in_elsewhere"; message: string }
	| { t: "error"; error: ProtocolErrorCode; message?: string };

export type ServerMessageType = ServerMessage["t"];

// ── Parsing (server side: every inbound frame) ──────────────────────────────

const PACES: readonly Pace[] = ["live", "async"];
const ROOM_ID_RE = /^[0-9a-f-]{8,64}$/i;
/** Crockford-style, no 0/1/I/L/O/U, so a code read aloud or typed survives. */
export const INVITE_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_CODE_RE = new RegExp(`^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`);

export function isInviteCode(value: unknown): value is string {
	return typeof value === "string" && INVITE_CODE_RE.test(value);
}

function isRoomId(value: unknown): value is string {
	return typeof value === "string" && ROOM_ID_RE.test(value);
}

function isUserIdList(value: unknown, max: number): value is string[] {
	return Array.isArray(value) && value.length > 0 && value.length <= max && value.every((v) => isShortString(v, 64));
}

/**
 * Validates one decoded frame. `knownGames` is the server's registry, so a
 * client can never name a game the server does not run. Returns null for
 * anything malformed; the hub answers null with `bad_request`.
 */
export function parseClientMessage(raw: unknown, knownGames: readonly GameId[]): ClientMessage | null {
	if (!isRecord(raw) || typeof raw.t !== "string") return null;
	const rid = raw.rid === undefined ? undefined : isInt(raw.rid, 0, 2_147_483_647) ? raw.rid : null;
	if (rid === null) return null;
	const base = rid === undefined ? {} : { rid };
	const isGame = (g: unknown): g is GameId => isOneOf(g, knownGames);

	switch (raw.t) {
		case "auth": {
			if (!isShortString(raw.token, 8192) || !isInt(raw.protocol, 0, 1000)) return null;
			const client = isRecord(raw.client)
				? {
						version: isShortString(raw.client.version, 32) ? raw.client.version : undefined,
						build: isShortString(raw.client.build, 32) ? raw.client.build : undefined,
						platform: isShortString(raw.client.platform, 16) ? raw.client.platform : undefined,
					}
				: undefined;
			return { ...base, t: "auth", token: raw.token, protocol: raw.protocol, client };
		}
		case "ping":
			return isInt(raw.ct, 0) ? { ...base, t: "ping", ct: raw.ct } : null;
		case "sync":
			return { ...base, t: "sync" };
		case "queue.join": {
			if (!Array.isArray(raw.games) || raw.games.length === 0 || raw.games.length > knownGames.length) return null;
			if (!raw.games.every(isGame) || !isOneOf(raw.pace, PACES)) return null;
			return { ...base, t: "queue.join", games: Array.from(new Set(raw.games)), pace: raw.pace };
		}
		case "queue.leave":
			return { ...base, t: "queue.leave" };
		case "invite.create": {
			if (!isGame(raw.game) || !isOneOf(raw.kind, INVITE_KINDS) || !isOneOf(raw.pace, PACES)) return null;
			if (raw.kind === "direct") {
				if (!isUserIdList(raw.to, 3)) return null;
				return { ...base, t: "invite.create", game: raw.game, kind: raw.kind, pace: raw.pace, to: Array.from(new Set(raw.to)) };
			}
			if (raw.to !== undefined) return null;
			return { ...base, t: "invite.create", game: raw.game, kind: raw.kind, pace: raw.pace };
		}
		case "invite.preview":
		case "invite.accept":
		case "invite.decline":
		case "invite.cancel": {
			const code = typeof raw.code === "string" ? raw.code.toUpperCase() : null;
			return isInviteCode(code) ? { ...base, t: raw.t, code } : null;
		}
		case "room.join":
		case "room.leave":
		case "room.rematch":
		case "room.start":
			return isRoomId(raw.roomId) ? { ...base, t: raw.t, roomId: raw.roomId } : null;
		case "room.action":
			if (!isRoomId(raw.roomId) || !isInt(raw.rev, 0) || raw.action === undefined) return null;
			return { ...base, t: "room.action", roomId: raw.roomId, rev: raw.rev, action: raw.action };
		case "room.emote":
			if (!isRoomId(raw.roomId) || !isOneOf(raw.emote, EMOTES)) return null;
			return { ...base, t: "room.emote", roomId: raw.roomId, emote: raw.emote };
		default:
			return null;
	}
}

/** Light client-side guard: the server is trusted, but a frame from a newer
 *  server build with an unknown `t` must be ignored, not crash a reducer. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
	if (!isRecord(raw) || typeof raw.t !== "string") return null;
	const known: readonly ServerMessageType[] = [
		"welcome", "pong", "ack", "queue.state", "room.state", "room.gone",
		"room.emote", "invite.state", "rooms", "notice", "error",
	];
	return isOneOf(raw.t, known) ? (raw as unknown as ServerMessage) : null;
}
