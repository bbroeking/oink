// PlayClient: the app's one WebSocket to the Render play server.
//
// It owns the transport and nothing else: auth, reconnects, the heartbeat and
// clock, and request/ack correlation. What the frames MEAN lives in
// ./store.ts (a pure reducer the provider feeds every message into), and the
// React lifecycle (when to connect at all) lives in hooks/useMultiplayer.tsx.
//
// The conversation (multiplayer/protocol.ts has the full shape):
//   open socket → { t: "auth", token, protocol, client }   (first frame)
//              ← { t: "welcome", ... timing, catalog, resume }
//   every timing.heartbeatMs → { t: "ping", ct } ← { t: "pong", ct, st }
//   request(msg) → { ...msg, rid } ← { t: "ack", rid, ok, data | error }
//
// Rules this file keeps:
//   • first-frame auth only; the token never rides in the URL (wss only in
//     production; the config cell rejects anything else);
//   • every inbound frame goes through parseServerMessage, and an unknown
//     frame is dropped, never thrown on;
//   • reconnects back off exponentially with jitter (1 s doubling to a 15 s
//     cap) and reset after a welcome; 4002 (protocol mismatch) and 4004
//     (play switched off) are terminal; 4003 (token refused) refreshes the
//     token ONCE and retries, then stops;
//   • iOS suspends sockets in the background, so the app suspend()s on
//     background and resume()s on active, which reconnects at once;
//   • RN never surfaces protocol pong frames to JS, so liveness is an
//     app-level ping: a ping that goes unanswered for a request timeout means
//     the socket is dead and gets replaced.
//
// Everything platform-shaped (WebSocket, clock, timers, randomness, the
// token source) is injected, so __tests__/multiplayer/client.test.ts drives
// it with a fake socket and a fake clock.

import {
	DEFAULT_TIMING,
	PROTOCOL_VERSION,
	parseServerMessage,
	type ClientMessage,
	type ProtocolErrorCode,
	type ServerMessage,
	type Timing,
} from "@/multiplayer/protocol";

// ── Close codes ──────────────────────────────────────────────────────────────

/** WebSocket close codes the play server uses that change what the client
 *  does. Every other code (4001 and 4005–4008 included: auth timeout, idle,
 *  restart, rate limit, a replaced socket) is transient and reconnects with
 *  backoff. Keep in step with the server hub. */
export const PLAY_CLOSE = {
	/** The auth frame did not arrive (or was malformed) in time. Transient. */
	AUTH_TIMEOUT: 4001,
	/** The app and server speak different protocol versions. Terminal: the
	 *  app needs an update. */
	PROTOCOL_MISMATCH: 4002,
	/** The access token was refused. Refresh it once, retry, then stop. */
	BAD_TOKEN: 4003,
	/** Play is switched off for this account. Terminal until asked again. */
	DISABLED: 4004,
} as const;

/** Close code the client itself uses when it drops a socket that went quiet
 *  (no welcome, or no pong). Never sent by the server. */
const CLIENT_DROP = 4000;

// ── Public types ─────────────────────────────────────────────────────────────

/**
 * idle         not connected and not trying (never started, or close()d).
 * connecting   opening the socket, authenticating, waiting for the welcome.
 * open         welcomed: requests and room traffic flow.
 * reconnecting dropped; a retry is scheduled at `retryAt`.
 * suspended    the app is in the background; resume() reconnects at once.
 * stopped      terminal: will not reconnect on its own (see `reason`).
 */
export type PlayStatus = "idle" | "connecting" | "open" | "reconnecting" | "suspended" | "stopped";

export type PlayStopReason =
	/** The server speaks another protocol version: the app needs an update. */
	| "protocol_mismatch"
	/** Play is switched off for this account (or for everyone). */
	| "disabled"
	/** The token was refused twice in a row. */
	| "unauthorized"
	/** This account opened play on another device; resume() takes it back. */
	| "signed_in_elsewhere"
	/** No session to authenticate with. */
	| "signed_out";

export interface PlayConnectionState {
	status: PlayStatus;
	/** Why the connection stopped (status "stopped"); null otherwise. */
	reason: PlayStopReason | null;
	/** Consecutive failed attempts since the last welcome. */
	attempt: number;
	/** Local epoch ms of the next reconnect attempt (status "reconnecting"). */
	retryAt: number | null;
}

export const IDLE_CONNECTION: PlayConnectionState = Object.freeze({
	status: "idle",
	reason: null,
	attempt: 0,
	retryAt: null,
}) as PlayConnectionState;

/** Client-side failures a request can end in, beside the server's own codes. */
export type ClientErrorCode =
	/** No ack within the request timeout. */
	| "timeout"
	/** The socket is not open, so the request was never sent. */
	| "offline"
	/** The socket closed while the request was in flight. */
	| "disconnected";

export type PlayErrorCode = ProtocolErrorCode | ClientErrorCode;

export class PlayRequestError extends Error {
	readonly code: PlayErrorCode;
	/** The server's optional human note on a refused ack (never shown raw). */
	readonly serverMessage: string | null;

	constructor(code: PlayErrorCode, serverMessage: string | null = null) {
		super(`play request failed: ${code}`);
		this.name = "PlayRequestError";
		this.code = code;
		this.serverMessage = serverMessage;
		// Keep instanceof honest under transpiled class extends Error.
		Object.setPrototypeOf(this, PlayRequestError.prototype);
	}
}

export function isPlayRequestError(value: unknown): value is PlayRequestError {
	return (
		value instanceof PlayRequestError ||
		(typeof value === "object" &&
			value !== null &&
			(value as { name?: unknown }).name === "PlayRequestError" &&
			typeof (value as { code?: unknown }).code === "string")
	);
}

/** The error code of anything a request can reject with. */
export function playErrorCode(error: unknown): PlayErrorCode {
	return isPlayRequestError(error) ? error.code : "internal";
}

type WithoutRid<T> = T extends unknown ? Omit<T, "rid"> : never;

/** Every message the app may send as a request (auth and ping are the
 *  client's own business). The client assigns the rid. */
export type PlayRequest = WithoutRid<Exclude<ClientMessage, { t: "auth" } | { t: "ping" }>>;

/** The slice of a WebSocket the client uses; RN's WebSocket satisfies it. */
export interface PlaySocket {
	send(data: string): void;
	close(code?: number, reason?: string): void;
	onopen: ((event: unknown) => void) | null;
	onmessage: ((event: { data?: unknown }) => void) | null;
	onerror: ((event: unknown) => void) | null;
	onclose: ((event: { code?: number; reason?: string }) => void) | null;
}

export type PlaySocketConstructor = new (url: string) => PlaySocket;

export interface PlayTimers {
	setTimeout(fn: () => void, ms: number): unknown;
	clearTimeout(handle: unknown): void;
}

export interface PlayClientInfo {
	version?: string;
	build?: string;
	platform?: string;
}

export interface PlayClientDeps {
	/** The play server endpoint, read at every connect so a config change
	 *  lands on the next attempt. */
	url: () => string;
	/** The Supabase access token. `refresh: true` asks for a freshly
	 *  refreshed one (after a 4003). Null means signed out. May reject on a
	 *  network blip; that counts as a transient failure. */
	getToken: (opts: { refresh: boolean }) => Promise<string | null>;
	WebSocket?: PlaySocketConstructor;
	now?: () => number;
	timers?: PlayTimers;
	/** Jitter source in [0, 1). */
	random?: () => number;
	client?: PlayClientInfo;
	/** Ack deadline for request(), and the pong deadline for a ping. */
	requestTimeoutMs?: number;
	/** Budget for open + auth + welcome before the attempt is abandoned. */
	connectTimeoutMs?: number;
	backoff?: { baseMs: number; maxMs: number };
	log?: (message: string, detail?: unknown) => void;
}

export interface PlayClockSample {
	/** Smoothed server-minus-local offset, ms. serverNow = localNow + offset. */
	offsetMs: number;
	/** Smoothed round trip, ms. */
	rttMs: number;
}

export interface PlayClientEvents {
	status: PlayConnectionState;
	/** Every parsed server frame except acks and pongs (the client consumes
	 *  those itself). Welcome is emitted before the status flips to open. */
	message: ServerMessage;
	clock: PlayClockSample;
}

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
export const DEFAULT_BACKOFF = Object.freeze({ baseMs: 1_000, maxMs: 15_000 });
/** Heartbeat clamp: a bad server value can neither hammer nor starve us. */
const HEARTBEAT_MIN_MS = 5_000;
const HEARTBEAT_MAX_MS = 120_000;
/** A pong slower than this is a broken clock sample, not a measurement. */
const MAX_SANE_RTT_MS = 60_000;
const MAX_RID = 2_147_483_647;

/**
 * The wait before reconnect attempt `attempt` (0 = the first retry):
 * exponential (base · 2^attempt, capped at max) with "equal jitter", so the
 * wait lands in [ceiling / 2, ceiling]. Retries from many phones after a
 * server restart spread out instead of arriving together.
 */
export function backoffDelay(
	attempt: number,
	random: () => number = Math.random,
	baseMs: number = DEFAULT_BACKOFF.baseMs,
	maxMs: number = DEFAULT_BACKOFF.maxMs,
): number {
	const exp = Math.min(Math.max(0, Math.floor(attempt)), 30);
	const ceiling = Math.min(maxMs, baseMs * 2 ** exp);
	const r = Math.min(Math.max(random(), 0), 1);
	return Math.round(ceiling / 2 + (r * ceiling) / 2);
}

/** The server's live timing over the compiled defaults, field by field: a
 *  missing or malformed field keeps its default. */
export function mergeTiming(raw: unknown): Timing {
	const out: Timing = { ...DEFAULT_TIMING, inviteTtlMs: { ...DEFAULT_TIMING.inviteTtlMs } };
	if (typeof raw !== "object" || raw === null) return out;
	const r = raw as Record<string, unknown>;
	const keys = Object.keys(DEFAULT_TIMING) as (keyof Timing)[];
	for (const key of keys) {
		if (key === "inviteTtlMs") continue;
		const v = r[key];
		if (typeof v === "number" && Number.isFinite(v) && v > 0) {
			(out as Record<string, unknown>)[key] = v;
		}
	}
	if (typeof r.inviteTtlMs === "object" && r.inviteTtlMs !== null) {
		const ttl = r.inviteTtlMs as Record<string, unknown>;
		for (const kind of Object.keys(out.inviteTtlMs) as (keyof Timing["inviteTtlMs"])[]) {
			const v = ttl[kind];
			if (typeof v === "number" && Number.isFinite(v) && v > 0) out.inviteTtlMs[kind] = v;
		}
	}
	return out;
}

/** One clock sample from a ping round trip, NTP style: the server stamped
 *  `st` roughly half a round trip after we sent at `ct`. */
export function clockSample(ct: number, st: number, receivedAt: number): { offsetMs: number; rttMs: number } | null {
	const rtt = receivedAt - ct;
	if (!Number.isFinite(rtt) || rtt < 0 || rtt > MAX_SANE_RTT_MS || !Number.isFinite(st)) return null;
	return { offsetMs: st - (ct + rtt / 2), rttMs: rtt };
}

/** Fold a sample into the running estimate. A quicker round trip is a more
 *  trustworthy sample, so it moves the estimate further. */
export function smoothClock(prev: PlayClockSample | null, sample: { offsetMs: number; rttMs: number }): PlayClockSample {
	if (!prev) return { offsetMs: sample.offsetMs, rttMs: sample.rttMs };
	const alpha = sample.rttMs <= prev.rttMs ? 0.5 : 0.25;
	return {
		offsetMs: prev.offsetMs + alpha * (sample.offsetMs - prev.offsetMs),
		rttMs: prev.rttMs + 0.25 * (sample.rttMs - prev.rttMs),
	};
}

// ── The client ───────────────────────────────────────────────────────────────

interface Pending {
	resolve: (data: unknown) => void;
	reject: (error: PlayRequestError) => void;
	timer: unknown;
}

type Listeners = { [E in keyof PlayClientEvents]: Set<(payload: PlayClientEvents[E]) => void> };

const defaultTimers: PlayTimers = {
	setTimeout: (fn, ms) => setTimeout(fn, ms),
	clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class PlayClient {
	private readonly deps: PlayClientDeps;
	private readonly now: () => number;
	private readonly timers: PlayTimers;
	private readonly random: () => number;
	private readonly requestTimeoutMs: number;
	private readonly connectTimeoutMs: number;
	private readonly backoff: { baseMs: number; maxMs: number };

	private socket: PlaySocket | null = null;
	/** Bumped whenever a socket (or an in-flight open) is abandoned, so late
	 *  events from it are ignored. */
	private generation = 0;
	private state: PlayConnectionState = IDLE_CONNECTION;
	private timingValue: Timing = mergeTiming(null);
	private rid = 0;
	private readonly pending = new Map<number, Pending>();

	private retryTimer: unknown = null;
	private connectTimer: unknown = null;
	private heartbeatTimer: unknown = null;
	private pongTimer: unknown = null;

	/** ct of the ping still waiting for its pong. */
	private outstandingPing: number | null = null;
	private authSentAt = 0;
	private lastFrameAt = 0;
	private clock: PlayClockSample | null = null;
	/** The estimate came from the welcome (its round trip includes the
	 *  server's token check), so the first real pong replaces it outright. */
	private clockProvisional = false;
	/** The one token refresh a 4003 earns has been spent this cycle. */
	private tokenRefreshSpent = false;
	/** The next open() asks getToken for a refreshed token. */
	private refreshTokenNext = false;
	/** The server told us this account went live on another device. */
	private replacedElsewhere = false;

	private readonly listeners: Listeners = { status: new Set(), message: new Set(), clock: new Set() };

	constructor(deps: PlayClientDeps) {
		this.deps = deps;
		this.now = deps.now ?? Date.now;
		this.timers = deps.timers ?? defaultTimers;
		this.random = deps.random ?? Math.random;
		this.requestTimeoutMs = deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		this.connectTimeoutMs = deps.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
		this.backoff = deps.backoff ?? DEFAULT_BACKOFF;
	}

	// ── Reads ──────────────────────────────────────────────────────────────

	get connection(): PlayConnectionState {
		return this.state;
	}

	get status(): PlayStatus {
		return this.state.status;
	}

	/** The server's live timing (compiled defaults until the first welcome). */
	get timing(): Timing {
		return this.timingValue;
	}

	/** serverNow = localNow + clockOffsetMs. Zero until first measured. */
	get clockOffsetMs(): number {
		return this.clock?.offsetMs ?? 0;
	}

	get rttMs(): number | null {
		return this.clock?.rttMs ?? null;
	}

	/** The best estimate of the server's clock, epoch ms. */
	serverNow(): number {
		return this.now() + this.clockOffsetMs;
	}

	on<E extends keyof PlayClientEvents>(event: E, listener: (payload: PlayClientEvents[E]) => void): () => void {
		const set = this.listeners[event] as Set<(payload: PlayClientEvents[E]) => void>;
		set.add(listener);
		return () => {
			set.delete(listener);
		};
	}

	// ── Lifecycle ──────────────────────────────────────────────────────────

	/** Start connecting. A no-op while connecting, open, reconnecting (the
	 *  scheduled retry stands) or suspended (resume() owns that); restarts
	 *  from idle or stopped. */
	connect(): void {
		const { status } = this.state;
		if (status !== "idle" && status !== "stopped") return;
		this.replacedElsewhere = false;
		this.tokenRefreshSpent = false;
		this.setState({ status: "connecting", reason: null, attempt: 0, retryAt: null });
		void this.open();
	}

	/** Drop the current socket and connect again now, with the backoff reset
	 *  (a config URL change, an explicit retry). */
	reconnect(): void {
		this.dropSocket(1000, "reconnect");
		this.clearRetry();
		this.rejectAll("disconnected");
		this.replacedElsewhere = false;
		this.tokenRefreshSpent = false;
		this.setState({ status: "connecting", reason: null, attempt: 0, retryAt: null });
		void this.open();
	}

	/** Stop for good (signed out, nothing needs play). Pending requests fail
	 *  with "disconnected". */
	close(): void {
		this.dropSocket(1000, "closed");
		this.clearRetry();
		this.rejectAll("disconnected");
		this.setState(IDLE_CONNECTION);
	}

	/** The app went to the background. iOS will suspend the socket anyway;
	 *  closing it cleanly lets the server start its reconnect grace now. */
	suspend(): void {
		const { status } = this.state;
		if (status === "idle" || status === "stopped" || status === "suspended") return;
		this.dropSocket(1000, "background");
		this.clearRetry();
		this.rejectAll("disconnected");
		this.setState({ status: "suspended", reason: null, attempt: 0, retryAt: null });
	}

	/** The app is active again: reconnect at once if we were suspended or
	 *  waiting out a backoff, and check a socket that claims to be open. */
	resume(): void {
		const { status, reason } = this.state;
		if (status === "suspended" || status === "reconnecting" || (status === "stopped" && reason === "signed_in_elsewhere")) {
			this.clearRetry();
			this.replacedElsewhere = false;
			this.setState({ status: "connecting", reason: null, attempt: 0, retryAt: null });
			void this.open();
			return;
		}
		if (status === "open") {
			// A socket that lived through a background stint may be a zombie
			// (iOS reclaims suspended sockets). Silence longer than a heartbeat
			// means replace it; otherwise prove it with a ping.
			if (this.now() - this.lastFrameAt > this.heartbeatMs()) this.reconnect();
			else this.ping();
		}
	}

	// ── Sending ────────────────────────────────────────────────────────────

	/** Fire-and-forget (emotes). False when the socket is not open. */
	send(message: PlayRequest): boolean {
		if (this.state.status !== "open") return false;
		return this.sendFrame(message);
	}

	/**
	 * Send `message` with a fresh rid and resolve with the ack's `data`.
	 * Rejects with a PlayRequestError: the server's code on a refused ack,
	 * "timeout" after the request timeout, "offline" when not connected (it is
	 * never queued), "disconnected" if the socket drops first.
	 */
	request<T = unknown>(message: PlayRequest): Promise<T> {
		if (this.state.status !== "open" || !this.socket) {
			return Promise.reject(new PlayRequestError("offline"));
		}
		this.rid = this.rid >= MAX_RID ? 1 : this.rid + 1;
		const rid = this.rid;
		return new Promise<T>((resolve, reject) => {
			const timer = this.timers.setTimeout(() => {
				if (!this.pending.delete(rid)) return;
				reject(new PlayRequestError("timeout"));
			}, this.requestTimeoutMs);
			this.pending.set(rid, { resolve: resolve as (data: unknown) => void, reject, timer });
			if (!this.sendFrame({ ...message, rid } as ClientMessage)) {
				this.timers.clearTimeout(timer);
				this.pending.delete(rid);
				reject(new PlayRequestError("offline"));
			}
		});
	}

	// ── Internals: connecting ──────────────────────────────────────────────

	private async open(): Promise<void> {
		const generation = ++this.generation;
		const refresh = this.refreshTokenNext;
		this.refreshTokenNext = false;
		// One budget covers the token, the socket opening, auth and the welcome.
		this.clearTimer("connectTimer");
		this.connectTimer = this.timers.setTimeout(() => {
			this.connectTimer = null;
			if (generation !== this.generation) return;
			this.deps.log?.("[play] no welcome in time; retrying");
			this.lose(CLIENT_DROP, "connect timeout");
		}, this.connectTimeoutMs);
		let token: string | null;
		try {
			token = await this.deps.getToken({ refresh });
		} catch (error) {
			if (generation !== this.generation) return;
			this.deps.log?.("[play] token fetch failed", error);
			this.scheduleRetry();
			return;
		}
		if (generation !== this.generation) return; // superseded while awaiting
		if (!token) {
			this.stop("signed_out");
			return;
		}

		const Ctor = this.deps.WebSocket ?? (globalThis as unknown as { WebSocket?: PlaySocketConstructor }).WebSocket;
		let socket: PlaySocket;
		try {
			if (!Ctor) throw new Error("no WebSocket");
			socket = new Ctor(this.deps.url());
		} catch (error) {
			this.deps.log?.("[play] socket construction failed", error);
			this.scheduleRetry();
			return;
		}
		this.socket = socket;

		socket.onopen = () => {
			if (generation !== this.generation) return;
			this.authSentAt = this.now();
			const client = this.deps.client;
			this.sendFrame({ t: "auth", token, protocol: PROTOCOL_VERSION, ...(client ? { client } : {}) });
		};
		socket.onmessage = (event) => {
			if (generation !== this.generation) return;
			this.onFrame(event?.data);
		};
		// RN dispatches `error` and then `close` (1006) for a native failure;
		// reconnecting only from `close` avoids a double retry.
		socket.onerror = () => {};
		socket.onclose = (event) => {
			if (generation !== this.generation) return;
			this.onSocketClosed(typeof event?.code === "number" ? event.code : 1006);
		};
	}

	private onFrame(data: unknown): void {
		this.lastFrameAt = this.now();
		if (typeof data !== "string") return;
		let raw: unknown;
		try {
			raw = JSON.parse(data);
		} catch {
			return;
		}
		const message = parseServerMessage(raw);
		if (!message) return;
		switch (message.t) {
			case "welcome":
				this.onWelcome(message);
				return;
			case "pong":
				this.onPong(message.ct, message.st);
				return;
			case "ack":
				this.onAck(message);
				return;
			case "notice":
				if (message.kind === "signed_in_elsewhere") this.replacedElsewhere = true;
				break;
			default:
				break;
		}
		this.emit("message", message);
	}

	private onWelcome(message: Extract<ServerMessage, { t: "welcome" }>): void {
		this.clearTimer("connectTimer");
		if (message.protocol !== PROTOCOL_VERSION) {
			this.stop("protocol_mismatch");
			return;
		}
		this.timingValue = mergeTiming(message.timing);
		// A provisional clock from the auth round trip until the ping sent
		// below comes back (only when nothing better is known yet).
		let provisional: PlayClockSample | null = null;
		if (!this.clock && typeof message.serverNow === "number" && this.authSentAt > 0) {
			provisional = clockSample(this.authSentAt, message.serverNow, this.now());
			if (provisional) {
				this.clock = provisional;
				this.clockProvisional = true;
			}
		}
		this.tokenRefreshSpent = false;
		this.replacedElsewhere = false;
		this.emit("message", message);
		this.setState({ status: "open", reason: null, attempt: 0, retryAt: null });
		if (provisional) this.emit("clock", { ...provisional });
		this.ping();
		this.scheduleHeartbeat(this.generation);
	}

	private onAck(message: Extract<ServerMessage, { t: "ack" }>): void {
		const entry = this.pending.get(message.rid);
		if (!entry) return; // timed out already, or not ours
		this.pending.delete(message.rid);
		this.timers.clearTimeout(entry.timer);
		if (message.ok) entry.resolve(message.data);
		else entry.reject(new PlayRequestError(message.error, typeof message.message === "string" ? message.message : null));
	}

	// ── Internals: heartbeat + clock ───────────────────────────────────────

	private heartbeatMs(): number {
		return Math.min(HEARTBEAT_MAX_MS, Math.max(HEARTBEAT_MIN_MS, this.timingValue.heartbeatMs));
	}

	private scheduleHeartbeat(generation: number): void {
		this.clearTimer("heartbeatTimer");
		this.heartbeatTimer = this.timers.setTimeout(() => {
			this.heartbeatTimer = null;
			if (generation !== this.generation || this.state.status !== "open") return;
			this.ping();
			this.scheduleHeartbeat(generation);
		}, this.heartbeatMs());
	}

	private ping(): void {
		if (this.state.status !== "open") return;
		const ct = this.now();
		if (!this.sendFrame({ t: "ping", ct })) return;
		if (this.outstandingPing === null) {
			// Only the oldest unanswered ping arms the deadline: a pong to any
			// ping proves the socket is alive.
			this.outstandingPing = ct;
			const generation = this.generation;
			this.clearTimer("pongTimer");
			this.pongTimer = this.timers.setTimeout(() => {
				this.pongTimer = null;
				if (generation !== this.generation || this.outstandingPing === null) return;
				this.deps.log?.("[play] ping went unanswered; replacing the socket");
				this.lose(CLIENT_DROP, "heartbeat");
			}, this.requestTimeoutMs);
		}
	}

	private onPong(ct: number, st: number): void {
		this.outstandingPing = null;
		this.clearTimer("pongTimer");
		const sample = clockSample(ct, st, this.now());
		if (!sample) return;
		this.clock = this.clockProvisional ? { ...sample } : smoothClock(this.clock, sample);
		this.clockProvisional = false;
		this.emit("clock", { ...this.clock });
	}

	// ── Internals: losing a socket ─────────────────────────────────────────

	/** The client gives up on the current socket (no welcome, no pong) and
	 *  goes through the same path as a server-side close. */
	private lose(code: number, reason: string): void {
		this.dropSocket(code, reason);
		this.onSocketClosed(code);
	}

	private onSocketClosed(code: number): void {
		this.detachSocket();
		this.rejectAll("disconnected");
		if (code === PLAY_CLOSE.PROTOCOL_MISMATCH) {
			this.stop("protocol_mismatch");
			return;
		}
		if (code === PLAY_CLOSE.DISABLED) {
			this.stop("disabled");
			return;
		}
		if (this.replacedElsewhere) {
			// Reconnecting would just kick the other device off in turn.
			this.stop("signed_in_elsewhere");
			return;
		}
		if (code === PLAY_CLOSE.BAD_TOKEN) {
			if (this.tokenRefreshSpent) {
				this.stop("unauthorized");
				return;
			}
			this.tokenRefreshSpent = true;
			this.refreshTokenNext = true;
			this.setState({ status: "connecting", reason: null, attempt: this.state.attempt, retryAt: null });
			void this.open();
			return;
		}
		this.scheduleRetry();
	}

	private scheduleRetry(): void {
		this.detachSocket();
		this.clearRetry();
		const attempt = this.state.attempt;
		const delay = backoffDelay(attempt, this.random, this.backoff.baseMs, this.backoff.maxMs);
		this.setState({ status: "reconnecting", reason: null, attempt: attempt + 1, retryAt: this.now() + delay });
		this.retryTimer = this.timers.setTimeout(() => {
			this.retryTimer = null;
			if (this.state.status !== "reconnecting") return;
			this.setState({ status: "connecting", reason: null, attempt: this.state.attempt, retryAt: null });
			void this.open();
		}, delay);
	}

	private stop(reason: PlayStopReason): void {
		this.dropSocket(1000, reason);
		this.clearRetry();
		this.rejectAll("disconnected");
		this.setState({ status: "stopped", reason, attempt: 0, retryAt: null });
	}

	/** Abandon the socket: bump the generation so its late events are
	 *  ignored, detach handlers, close it, clear its timers. */
	private dropSocket(code: number, reason: string): void {
		this.generation++;
		const socket = this.socket;
		this.detachSocket();
		if (!socket) return;
		socket.onopen = null;
		socket.onmessage = null;
		socket.onerror = null;
		socket.onclose = null;
		try {
			socket.close(code, reason);
		} catch {
			// already closed; nothing to do
		}
	}

	private detachSocket(): void {
		this.socket = null;
		this.outstandingPing = null;
		this.clearTimer("connectTimer");
		this.clearTimer("heartbeatTimer");
		this.clearTimer("pongTimer");
	}

	private clearRetry(): void {
		this.clearTimer("retryTimer");
	}

	private clearTimer(key: "retryTimer" | "connectTimer" | "heartbeatTimer" | "pongTimer"): void {
		const handle = this[key];
		if (handle !== null) {
			this.timers.clearTimeout(handle);
			this[key] = null;
		}
	}

	private rejectAll(code: ClientErrorCode): void {
		if (this.pending.size === 0) return;
		const entries = [...this.pending.values()];
		this.pending.clear();
		for (const entry of entries) {
			this.timers.clearTimeout(entry.timer);
			entry.reject(new PlayRequestError(code));
		}
	}

	private sendFrame(message: ClientMessage): boolean {
		const socket = this.socket;
		if (!socket) return false;
		try {
			socket.send(JSON.stringify(message));
			return true;
		} catch (error) {
			this.deps.log?.("[play] send failed", error);
			return false;
		}
	}

	private setState(next: PlayConnectionState): void {
		const prev = this.state;
		if (
			prev.status === next.status &&
			prev.reason === next.reason &&
			prev.attempt === next.attempt &&
			prev.retryAt === next.retryAt
		) {
			return;
		}
		this.state = next;
		this.emit("status", next);
	}

	private emit<E extends keyof PlayClientEvents>(event: E, payload: PlayClientEvents[E]): void {
		const set = this.listeners[event] as Set<(payload: PlayClientEvents[E]) => void>;
		for (const listener of [...set]) {
			try {
				listener(payload);
			} catch (error) {
				this.deps.log?.(`[play] ${event} listener threw`, error);
			}
		}
	}
}
