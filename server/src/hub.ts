// The socket side: one WebSocket per pig at /ws.
//
//   first frame must be `auth` within 5 s          (else close 4001)
//   protocol must match PROTOCOL_VERSION           (else close 4002)
//   the token must verify                          (else close 4003)
//   the pig must be let in by the dark-launch gate (else close 4004)
//   a second socket for the same pig supersedes the first
//     (notice signed_in_elsewhere, close 4005; its tables follow the new one)
//   silent for idleTimeoutMs                       (close 4006)
//   keeps hammering after rate_limited             (close 4008)
//   server restarting                              (close 1012, reconnect)
//
// Liveness has two layers (docs/multiplayer/research/platform-notes.md §6):
// a protocol ping every heartbeat, which iOS answers natively, so a suspended
// app is found within two beats; and the client's own app-level `ping`, which
// the server answers with `pong` so the app can tell a dead server apart.

import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import {
	MAX_FRAME_BYTES,
	PROTOCOL_VERSION,
	parseClientMessage,
	type ClientMessage,
	type ServerMessage,
	type Timing,
} from "../../multiplayer/protocol";
import type { Clock, Timer } from "./clock";
import { COPY } from "./copy";
import { AuthUnavailableError, type TokenVerifier } from "./auth";
import type { InviteManager } from "./invites";
import type { Logger } from "./log";
import type { Matchmaker } from "./matchmaker";
import type { PlayerDirectory } from "./players";
import { TokenBucket } from "./ratelimit";
import { fail, ok, type HandlerResult, type Presence } from "./reply";
import type { RoomManager } from "./rooms";
import type { Settings } from "./settings";
import type { Tasks } from "./tasks";

export const CLOSE = {
	authTimeout: 4001,
	protocolMismatch: 4002,
	badToken: 4003,
	notAllowed: 4004,
	superseded: 4005,
	idle: 4006,
	abuse: 4008,
	internal: 1011,
	restarting: 1012,
	tryAgain: 1013,
} as const;

const BUCKET_BURST = 30;
const BUCKET_PER_SECOND = 10;
/** Frames held while an auth is being checked. */
const MAX_EARLY_FRAMES = 16;
/** Strikes (rate limited, malformed, oversized) before the socket is cut. */
const STRIKES_TO_CLOSE = 20;
const STRIKE_FORGET_MS = 10_000;
/** A socket this far behind on writes is not reading: cut it. */
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

interface Session {
	readonly id: number;
	readonly ws: WebSocket;
	readonly ip: string;
	userId: string | null;
	authed: boolean;
	authing: boolean;
	superseded: boolean;
	lastFrame: number;
	awaitingPong: boolean;
	strikes: number;
	lastStrike: number;
	readonly bucket: TokenBucket;
	authTimer: Timer | null;
	/** Frames that arrived behind a valid auth while it was being checked;
	 *  replayed, in order, once the pig is welcomed. */
	early: unknown[];
	/** Frames from one socket are handled strictly in order. */
	chain: Promise<void>;
}

export interface HubDeps {
	clock: Clock;
	log: Logger;
	tasks: Tasks;
	timing: Timing;
	authTimeoutMs: number;
	verifier: TokenVerifier;
	players: PlayerDirectory;
	settings: Settings;
	rooms: RoomManager;
	matchmaker: Matchmaker;
	invites: InviteManager;
}

export class Hub implements Presence {
	private readonly wss: WebSocketServer;
	private readonly sessions = new Map<string, Session>();
	private readonly open = new Set<Session>();
	private nextId = 1;
	private draining = false;
	private heartbeatTimer: Timer | null = null;
	private idleTimer: Timer | null = null;

	constructor(private readonly deps: HubDeps) {
		// ws enforces a hard ceiling (closing 1009); frames between the
		// protocol limit and the ceiling are refused politely instead.
		this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES * 4, clientTracking: false });
	}

	start(): void {
		this.scheduleHeartbeat();
		this.scheduleIdleSweep();
	}

	get connections(): number {
		return this.open.size;
	}

	isOnline(userId: string): boolean {
		const session = this.sessions.get(userId);
		return !!session && session.ws.readyState === WebSocket.OPEN;
	}

	send(userId: string, msg: ServerMessage): void {
		const session = this.sessions.get(userId);
		if (session) this.write(session, msg);
	}

	handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer, ip: string): void {
		const path = (req.url ?? "").split("?")[0];
		if (path !== "/ws" || this.draining) {
			socket.write(this.draining ? "HTTP/1.1 503 Service Unavailable\r\n\r\n" : "HTTP/1.1 404 Not Found\r\n\r\n");
			socket.destroy();
			return;
		}
		this.wss.handleUpgrade(req, socket, head, (ws) => this.accept(ws, ip));
	}

	/** Shutdown, step one: no new sockets or sign-ins, and every pig is told
	 *  the barn is restarting. */
	beginDrain(): void {
		this.draining = true;
		this.heartbeatTimer?.cancel();
		this.idleTimer?.cancel();
		for (const session of this.open) {
			this.write(session, { t: "notice", kind: "server_restarting", message: COPY.restarting });
		}
	}

	/** Shutdown, last step (after every table is written): close with 1012,
	 *  which the app treats as "reconnect", landing on the next instance. */
	closeAll(): void {
		for (const session of [...this.open]) session.ws.close(CLOSE.restarting, "server restarting");
	}

	/** Stops timers and drops every socket at once (tests, final exit). */
	terminateAll(): void {
		this.draining = true;
		this.heartbeatTimer?.cancel();
		this.idleTimer?.cancel();
		for (const session of [...this.open]) session.ws.terminate();
	}

	// ── Connections ──────────────────────────────────────────────────────────

	private accept(ws: WebSocket, ip: string): void {
		const now = () => this.deps.clock.now();
		const session: Session = {
			id: this.nextId++,
			ws,
			ip,
			userId: null,
			authed: false,
			authing: false,
			superseded: false,
			lastFrame: now(),
			awaitingPong: false,
			strikes: 0,
			lastStrike: 0,
			bucket: new TokenBucket(BUCKET_BURST, BUCKET_PER_SECOND, now),
			authTimer: null,
			early: [],
			chain: Promise.resolve(),
		};
		this.open.add(session);
		session.authTimer = this.deps.clock.after(this.deps.authTimeoutMs, () => {
			if (!session.authed) this.close(session, CLOSE.authTimeout, "auth first");
		});
		ws.on("message", (data, isBinary) => this.onFrame(session, data, isBinary));
		ws.on("pong", () => {
			session.awaitingPong = false;
		});
		ws.on("close", () => this.onClose(session));
		ws.on("error", (err) => this.deps.log.debug("socket error", { session: session.id, err }));
	}

	private onFrame(session: Session, data: RawData, isBinary: boolean): void {
		session.lastFrame = this.deps.clock.now();
		const bytes = toBuffer(data);
		if (isBinary || bytes.byteLength > MAX_FRAME_BYTES) {
			this.strike(session);
			this.write(session, { t: "error", error: "bad_request", message: isBinary ? "Text frames only" : "That frame is too large" });
			return;
		}
		let raw: unknown;
		try {
			raw = JSON.parse(bytes.toString("utf8"));
		} catch {
			this.strike(session);
			this.write(session, { t: "error", error: "bad_request", message: "Frames are JSON" });
			return;
		}
		const rid = ridOf(raw);
		if (!session.bucket.take()) {
			this.strike(session);
			this.reply(session, rid, fail("rate_limited"));
			return;
		}
		if (!session.authed) {
			this.onPreAuthFrame(session, raw);
			return;
		}
		this.onAuthedFrame(session, raw, rid);
	}

	private onAuthedFrame(session: Session, raw: unknown, rid: number | undefined): void {
		const msg = parseClientMessage(raw, this.deps.settings.enabledGameIds());
		if (!msg) {
			this.strike(session);
			this.reply(session, rid, fail("bad_request"));
			return;
		}
		// Pings skip the queue: a slow request must not look like a dead server.
		if (msg.t === "ping") {
			this.write(session, { t: "pong", ct: msg.ct, st: this.deps.clock.now() });
			if (msg.rid !== undefined) this.reply(session, msg.rid, ok());
			return;
		}
		const run = session.chain.then(() => this.dispatch(session, msg));
		session.chain = run.catch(() => undefined);
		this.deps.tasks.spawn("frame", () => run);
	}

	private onPreAuthFrame(session: Session, raw: unknown): void {
		if (session.authing) {
			if (session.early.length >= MAX_EARLY_FRAMES) this.close(session, CLOSE.abuse, "slow down");
			else session.early.push(raw);
			return;
		}
		const msg = parseClientMessage(raw, this.deps.settings.enabledGameIds());
		if (!msg || msg.t !== "auth") {
			const t = typeof raw === "object" && raw !== null ? (raw as { t?: unknown }).t : undefined;
			this.close(session, t === "auth" ? CLOSE.badToken : CLOSE.authTimeout, "auth first");
			return;
		}
		if (session.authing) return;
		session.authing = true;
		this.deps.tasks.spawn("auth", () => this.authenticate(session, msg));
	}

	private async authenticate(session: Session, msg: Extract<ClientMessage, { t: "auth" }>): Promise<void> {
		if (msg.protocol !== PROTOCOL_VERSION) {
			this.write(session, { t: "error", error: "protocol_mismatch", message: `server speaks protocol ${PROTOCOL_VERSION}` });
			this.close(session, CLOSE.protocolMismatch, "protocol mismatch");
			return;
		}
		let userId: string;
		let name: string | undefined;
		try {
			const user = await this.deps.verifier.verify(msg.token);
			userId = user.userId;
			name = user.name;
		} catch (err) {
			if (err instanceof AuthUnavailableError) {
				this.deps.log.warn("auth unavailable", { err: err.message });
				this.close(session, CLOSE.tryAgain, "auth unavailable");
			} else {
				this.deps.log.info("token refused", { reason: (err as Error).message, ip: session.ip });
				this.close(session, CLOSE.badToken, "bad token");
			}
			return;
		}
		if (session.ws.readyState !== WebSocket.OPEN) return;

		let player;
		try {
			player = await this.deps.players.load(userId, { name });
		} catch (err) {
			this.deps.log.error("loading a player failed", { userId, err });
			this.close(session, CLOSE.internal, "try again");
			return;
		}
		if (!this.deps.players.isAllowed(player)) {
			this.close(session, CLOSE.notAllowed, "not yet");
			return;
		}
		if (this.draining) {
			this.close(session, CLOSE.restarting, "server restarting");
			return;
		}
		if (session.ws.readyState !== WebSocket.OPEN) return;

		const prev = this.sessions.get(userId);
		if (prev && prev !== session) {
			prev.superseded = true;
			this.write(prev, { t: "notice", kind: "signed_in_elsewhere", message: COPY.signedInElsewhere });
			this.close(prev, CLOSE.superseded, "signed in elsewhere");
		}
		session.authTimer?.cancel();
		session.authTimer = null;
		session.userId = userId;
		session.authed = true;
		this.sessions.set(userId, session);
		this.deps.log.info("pig signed in", { userId, session: session.id, client: msg.client });

		const rooms = await this.deps.rooms.summariesFor(userId);
		this.write(session, {
			t: "welcome",
			userId,
			name: player.card.name,
			serverNow: this.deps.clock.now(),
			protocol: PROTOCOL_VERSION,
			timing: this.deps.timing,
			catalog: this.deps.settings.catalog(),
			resume: {
				queue: this.deps.matchmaker.stateFor(userId),
				rooms,
				invites: this.deps.invites.openFor(userId),
			},
		});
		if (msg.rid !== undefined) this.reply(session, msg.rid, ok());
		for (const raw of session.early.splice(0)) this.onAuthedFrame(session, raw, ridOf(raw));
		await this.deps.rooms.onUserOnline(userId);
	}

	private async dispatch(session: Session, msg: ClientMessage): Promise<void> {
		const userId = session.userId as string;
		let result: HandlerResult;
		try {
			result = await this.handle(userId, msg);
		} catch (err) {
			this.deps.log.error("request failed", { t: msg.t, userId, err });
			result = fail("internal");
		}
		this.reply(session, msg.rid, result);
	}

	private async handle(userId: string, msg: ClientMessage): Promise<HandlerResult> {
		const { rooms, matchmaker, invites } = this.deps;
		switch (msg.t) {
			case "auth":
				return fail("bad_request", "Already signed in");
			case "ping":
				return ok();
			case "sync": {
				this.send(userId, { t: "queue.state", queue: matchmaker.stateFor(userId) });
				this.send(userId, { t: "rooms", rooms: await rooms.summariesFor(userId) });
				for (const invite of invites.openFor(userId)) this.send(userId, { t: "invite.state", invite });
				rooms.resend(userId);
				return ok();
			}
			case "queue.join":
				return matchmaker.join(userId, msg.games, msg.pace);
			case "queue.leave":
				matchmaker.leave(userId);
				return ok();
			case "invite.create":
				if (this.draining) return fail("disabled", "The barn is tidying up. Try again in a moment");
				return invites.create(userId, msg);
			case "invite.preview":
				return invites.preview(userId, msg.code);
			case "invite.accept":
				if (this.draining) return fail("disabled", "The barn is tidying up. Try again in a moment");
				return invites.accept(userId, msg.code);
			case "invite.decline":
				return invites.decline(userId, msg.code);
			case "invite.cancel":
				return invites.cancel(userId, msg.code);
			case "room.join":
				return rooms.handleJoin(userId, msg.roomId);
			case "room.action":
				return rooms.handleAction(userId, msg.roomId, msg.action);
			case "room.leave":
				return rooms.handleLeave(userId, msg.roomId);
			case "room.emote":
				return rooms.handleEmote(userId, msg.roomId, msg.emote);
			case "room.rematch":
				return rooms.handleRematch(userId, msg.roomId);
			case "room.start":
				return rooms.handleStart(userId, msg.roomId);
		}
	}

	private onClose(session: Session): void {
		this.open.delete(session);
		session.authTimer?.cancel();
		const userId = session.userId;
		if (!session.authed || session.superseded || !userId) return;
		if (this.sessions.get(userId) !== session) return;
		this.sessions.delete(userId);
		this.deps.log.info("pig signed off", { userId, session: session.id });
		this.deps.matchmaker.leave(userId, false);
		this.deps.tasks.spawn("offline", () => this.deps.rooms.onUserOffline(userId));
	}

	// ── Plumbing ─────────────────────────────────────────────────────────────

	private reply(session: Session, rid: number | undefined, result: HandlerResult): void {
		if (rid !== undefined) {
			this.write(
				session,
				result.ok
					? result.data === undefined
						? { t: "ack", rid, ok: true }
						: { t: "ack", rid, ok: true, data: result.data }
					: { t: "ack", rid, ok: false, error: result.error, ...(result.message ? { message: result.message } : {}) },
			);
		} else if (!result.ok) {
			this.write(session, { t: "error", error: result.error, ...(result.message ? { message: result.message } : {}) });
		}
	}

	private write(session: Session, msg: ServerMessage): void {
		if (session.ws.readyState !== WebSocket.OPEN) return;
		if (session.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
			this.deps.log.warn("socket not reading; cutting it", { session: session.id, userId: session.userId });
			session.ws.terminate();
			return;
		}
		session.ws.send(JSON.stringify(msg));
	}

	private close(session: Session, code: number, reason: string): void {
		if (session.ws.readyState === WebSocket.OPEN || session.ws.readyState === WebSocket.CONNECTING) {
			session.ws.close(code, reason);
		}
	}

	private strike(session: Session): void {
		const now = this.deps.clock.now();
		if (now - session.lastStrike > STRIKE_FORGET_MS) session.strikes = 0;
		session.strikes++;
		session.lastStrike = now;
		if (session.strikes >= STRIKES_TO_CLOSE) {
			this.deps.log.warn("closing an abusive socket", { session: session.id, userId: session.userId, ip: session.ip });
			this.close(session, CLOSE.abuse, "slow down");
		}
	}

	private scheduleHeartbeat(): void {
		this.heartbeatTimer = this.deps.clock.after(this.deps.timing.heartbeatMs, () => {
			for (const session of [...this.open]) {
				if (session.awaitingPong) {
					// No pong since the last beat: suspended, or gone.
					session.ws.terminate();
					continue;
				}
				session.awaitingPong = true;
				try {
					session.ws.ping();
				} catch {
					session.ws.terminate();
				}
			}
			if (!this.draining) this.scheduleHeartbeat();
		});
	}

	private scheduleIdleSweep(): void {
		// About ten looks per idle window (7 s at the default 70 s), never
		// more often than every 5 s.
		const every = Math.max(5_000, Math.floor(this.deps.timing.idleTimeoutMs / 10));
		this.idleTimer = this.deps.clock.after(every, () => {
			const cutoff = this.deps.clock.now() - this.deps.timing.idleTimeoutMs;
			for (const session of [...this.open]) {
				if (session.authed && session.lastFrame < cutoff) this.close(session, CLOSE.idle, "idle");
			}
			if (!this.draining) this.scheduleIdleSweep();
		});
	}
}

function toBuffer(data: RawData): Buffer {
	if (Array.isArray(data)) return Buffer.concat(data);
	return Buffer.isBuffer(data) ? data : Buffer.from(data);
}

function ridOf(raw: unknown): number | undefined {
	if (typeof raw !== "object" || raw === null) return undefined;
	const rid = (raw as { rid?: unknown }).rid;
	return typeof rid === "number" && Number.isInteger(rid) && rid >= 0 && rid <= 2_147_483_647 ? rid : undefined;
}
