// PlayRuntime: the connection policy and the actions, with no React in it.
// hooks/useMultiplayer.tsx owns one per app and feeds it the outside world
// (the server flag, the Supabase session, AppState, config changes); screens
// reach it only through the hooks.
//
// The policy, in one place:
//   • nothing connects unless play is switched on for this account AND
//     someone is signed in;
//   • the socket is opened LAZILY: only while a Play screen holds a
//     connection (retain(), via usePlayConnection), while the player is
//     searching, or while they hold a seat at a live table that has not
//     ended. Async tables do not hold it open: their moves come by push;
//   • when nothing needs it any more it lingers for LINGER_MS (a quick hop
//     between Play screens never reconnects), then closes;
//   • background suspends it, active resumes it (iOS `inactive` is ignored
//     upstream); a terminal stop (update needed, play switched off) waits
//     for retry() instead of looping;
//   • an action made while the socket is still coming up waits for it
//     (inside the request timeout) instead of failing "offline".

import type { GameId, Pace } from "@/multiplayer/types";
import type { Emote, InviteKind, InviteSummary, PlayerCard, RoomSnapshot } from "@/multiplayer/protocol";
import {
	DEFAULT_REQUEST_TIMEOUT_MS,
	PlayClient,
	PlayRequestError,
	playErrorCode,
	type PlayClientDeps,
	type PlayErrorCode,
	type PlayRequest,
	type PlayTimers,
} from "./client";
import { createPracticeRoom, isPracticeRoomId, type LocalRoomSource, type PracticeDeps, type PracticeOptions } from "./localRoom";
import { PLAIN_LOOK } from "./looks";
import { RemoteRoomSource, type ActResult, type RoomSource } from "./roomSource";
import { createPlayStore, holdsLiveInterest, type PlayStore } from "./store";

/** How long the socket stays up after the last thing that needed it. */
export const LINGER_MS = 60_000;

/** The client surface the runtime drives (PlayClient; a fake in tests). */
export type PlayClientLike = Pick<
	PlayClient,
	"connection" | "status" | "connect" | "reconnect" | "close" | "suspend" | "resume" | "request" | "send" | "serverNow" | "on"
>;

export type PlayResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: PlayErrorCode };

export interface PracticeRequest {
	gameId: GameId;
	/** Total chairs, you included (defaults to the game's minimum). */
	seats?: number;
	untimed?: boolean;
}

export interface CreateInviteRequest {
	game: GameId;
	kind: InviteKind;
	/** Friends' user ids (direct invites only, 1–3). */
	to?: string[];
	pace: Pace;
}

export interface PlayRuntimeDeps {
	/** Builds the client on first need. */
	createClient: (deps: Pick<PlayClientDeps, "url">) => PlayClientLike;
	/** The live server URL (config cell + dev override). */
	serverUrl: () => string;
	/** Whether Practice is offered (config cell). */
	practiceAllowed?: () => boolean;
	/** The signed-in player's own card for Practice. */
	loadMyCard?: () => Promise<PlayerCard | null>;
	createPractice?: (options: PracticeOptions, deps?: PracticeDeps) => LocalRoomSource | null;
	store?: PlayStore;
	now?: () => number;
	timers?: PlayTimers;
	lingerMs?: number;
	requestTimeoutMs?: number;
	log?: (message: string, detail?: unknown) => void;
}

const defaultTimers: PlayTimers = {
	setTimeout: (fn, ms) => setTimeout(fn, ms),
	clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** An InviteSummary out of an ack's data: the data itself or `data.invite`. */
export function inviteFromAck(data: unknown): InviteSummary | null {
	const d = asRecord(data);
	if (!d) return null;
	const candidate = asRecord(d.invite) ?? d;
	return typeof candidate.code === "string" && asRecord(candidate.from) ? (candidate as unknown as InviteSummary) : null;
}

/** A RoomSnapshot out of an ack's data: `data.room` or the data itself. */
export function roomFromAck(data: unknown): RoomSnapshot | null {
	const d = asRecord(data);
	if (!d) return null;
	const candidate = asRecord(d.room) ?? d;
	return typeof candidate.roomId === "string" && typeof candidate.rev === "number" && Array.isArray(candidate.seats)
		? (candidate as unknown as RoomSnapshot)
		: null;
}

function roomIdFromAck(data: unknown): string | null {
	const d = asRecord(data);
	if (!d) return null;
	if (typeof d.roomId === "string" && d.roomId.length > 0) return d.roomId;
	return roomFromAck(data)?.roomId ?? inviteFromAck(data)?.roomId ?? null;
}

export class PlayRuntime {
	readonly store: PlayStore;
	private readonly deps: PlayRuntimeDeps;
	private readonly timers: PlayTimers;
	private readonly now: () => number;
	private readonly lingerMs: number;
	private readonly requestTimeoutMs: number;

	private client: PlayClientLike | null = null;
	private clientOff: (() => void)[] = [];
	private enabled = false;
	/** undefined until the first session read; null when signed out. */
	private sessionUserId: string | null | undefined = undefined;
	private appActive = true;
	private consumers = 0;
	private lingerTimer: unknown = null;
	private dialedUrl: string | null = null;
	private readonly watched = new Map<string, number>();
	private readonly practice = new Map<string, LocalRoomSource>();
	private readonly remote = new Map<string, RemoteRoomSource>();
	private storeOff: (() => void) | null = null;
	private lastLiveInterest = false;
	private disposed = false;

	constructor(deps: PlayRuntimeDeps) {
		this.deps = deps;
		this.store = deps.store ?? createPlayStore();
		this.timers = deps.timers ?? defaultTimers;
		this.now = deps.now ?? Date.now;
		this.lingerMs = deps.lingerMs ?? LINGER_MS;
		this.requestTimeoutMs = deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		// The keep-alive rule reads the queue and the rooms: re-evaluate when
		// either flips.
		this.storeOff = this.store.subscribe(() => {
			const live = holdsLiveInterest(this.store.getState());
			if (live !== this.lastLiveInterest) {
				this.lastLiveInterest = live;
				this.evaluate();
			}
		});
	}

	// ── Inputs from the app ────────────────────────────────────────────────

	get isEnabled(): boolean {
		return this.enabled;
	}

	/** The server flag (loaded && on). */
	setEnabled(enabled: boolean): void {
		if (this.enabled === enabled) return;
		this.enabled = enabled;
		if (enabled && this.client?.status === "stopped") this.client.connect();
		this.evaluate();
	}

	/** The signed-in user (null: signed out). A different user resets. */
	setSession(userId: string | null): void {
		const prev = this.sessionUserId;
		this.sessionUserId = userId;
		if (prev !== undefined && prev !== userId) {
			// Sign-out or an account switch: nothing of the old account stays.
			this.client?.close();
			this.disposePractice();
			this.remote.clear();
			this.store.dispatch({ type: "reset" });
		} else if (userId && this.client?.status === "stopped") {
			const reason = this.client.connection.reason;
			// A fresh session is worth another try after a token problem.
			if (reason === "signed_out" || reason === "unauthorized") this.client.connect();
		}
		this.evaluate();
	}

	/** AppState: false on background, true on active. */
	setAppActive(active: boolean): void {
		if (this.appActive === active) return;
		this.appActive = active;
		if (!active) {
			this.client?.suspend();
			return;
		}
		if (this.client && this.allowed() && this.wanted()) this.client.resume();
		this.evaluate();
	}

	/** The config cell changed; redial if the URL moved under a live socket. */
	configChanged(): void {
		const client = this.client;
		if (!client || this.dialedUrl === null || this.dialedUrl === this.deps.serverUrl()) return;
		if (client.status === "open" || client.status === "connecting" || client.status === "reconnecting") client.reconnect();
	}

	// ── Consumers ──────────────────────────────────────────────────────────

	/** Hold the connection open; call the returned release when done. */
	retain(): () => void {
		this.consumers++;
		this.evaluate();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.consumers = Math.max(0, this.consumers - 1);
			this.evaluate();
		};
	}

	/** A match screen is showing this table: (re)join it on every welcome. */
	watchRoom(roomId: string): () => void {
		if (isPracticeRoomId(roomId)) return () => {};
		const count = this.watched.get(roomId) ?? 0;
		this.watched.set(roomId, count + 1);
		if (count === 0 && this.client?.status === "open") this.joinWatched(roomId);
		return () => {
			const left = (this.watched.get(roomId) ?? 1) - 1;
			if (left <= 0) this.watched.delete(roomId);
			else this.watched.set(roomId, left);
		};
	}

	get consumerCount(): number {
		return this.consumers;
	}

	/** Explicit "try again" after a stop or a long backoff. */
	retry(): void {
		if (!this.allowed()) return;
		const client = this.ensureClient();
		if (client.status === "stopped" || client.status === "idle") client.connect();
		else if (client.status === "reconnecting") client.reconnect();
	}

	/** The server clock, epoch ms. */
	serverNow = (): number => this.now() + this.store.getState().clockOffsetMs;

	// ── Sources ────────────────────────────────────────────────────────────

	/** The RoomSource for a table id: a Practice table from the registry, or
	 *  a real one over the store. Null for an unknown practice id. */
	roomSource(roomId: string): RoomSource | null {
		if (isPracticeRoomId(roomId)) return this.practice.get(roomId) ?? null;
		let source = this.remote.get(roomId);
		if (!source) {
			source = new RemoteRoomSource(roomId, {
				store: this.store,
				request: (message) => this.request(message),
				send: (message) => this.client?.send(message) ?? false,
				serverNow: this.serverNow,
				now: this.now,
			});
			this.remote.set(roomId, source);
		}
		return source;
	}

	// ── Actions ────────────────────────────────────────────────────────────

	async joinQueue(games: GameId[], pace: Pace): Promise<PlayResult> {
		return this.attempt({ t: "queue.join", games, pace });
	}

	async leaveQueue(): Promise<PlayResult> {
		return this.attempt({ t: "queue.leave" });
	}

	async createInvite(request: CreateInviteRequest): Promise<PlayResult<{ invite: InviteSummary | null }>> {
		const message: PlayRequest =
			request.kind === "direct"
				? { t: "invite.create", game: request.game, kind: request.kind, pace: request.pace, to: request.to ?? [] }
				: { t: "invite.create", game: request.game, kind: request.kind, pace: request.pace };
		const res = await this.attemptData(message);
		if (!res.ok) return res;
		const invite = inviteFromAck(res.data);
		if (invite) this.store.dispatch({ type: "invite", invite });
		const room = roomFromAck(res.data);
		if (room) this.store.dispatch({ type: "room", room, at: this.serverNow() });
		return { ok: true, invite };
	}

	/** Look at an invite (a tapped link or push). Counts it as incoming. */
	async previewInvite(code: string): Promise<PlayResult<{ invite: InviteSummary | null; room: RoomSnapshot | null }>> {
		const res = await this.attemptData({ t: "invite.preview", code: code.toUpperCase() });
		if (!res.ok) return res;
		const invite = inviteFromAck(res.data);
		if (invite) this.store.dispatch({ type: "invite", invite, previewed: true });
		const room = roomFromAck(res.data);
		if (room) this.store.dispatch({ type: "room", room, at: this.serverNow() });
		return { ok: true, invite, room };
	}

	/** Take a seat from an invite. `roomId` is the table to open (from the
	 *  ack, else the invite as the store knows it; null if not known yet). */
	async acceptInvite(code: string): Promise<PlayResult<{ roomId: string | null }>> {
		const upper = code.toUpperCase();
		const res = await this.attemptData({ t: "invite.accept", code: upper });
		if (!res.ok) return res;
		const invite = inviteFromAck(res.data);
		if (invite) this.store.dispatch({ type: "invite", invite });
		const room = roomFromAck(res.data);
		if (room) this.store.dispatch({ type: "room", room, at: this.serverNow() });
		const roomId = roomIdFromAck(res.data) ?? this.store.getState().invites[upper]?.roomId ?? null;
		return { ok: true, roomId };
	}

	async declineInvite(code: string): Promise<PlayResult> {
		return this.attempt({ t: "invite.decline", code: code.toUpperCase() });
	}

	async cancelInvite(code: string): Promise<PlayResult> {
		return this.attempt({ t: "invite.cancel", code: code.toUpperCase() });
	}

	async joinRoom(roomId: string): Promise<PlayResult> {
		const res = await this.attemptData({ t: "room.join", roomId });
		if (!res.ok) return res;
		const room = roomFromAck(res.data);
		if (room) this.store.dispatch({ type: "room", room, at: this.serverNow() });
		return { ok: true };
	}

	async act(roomId: string, action: unknown): Promise<ActResult> {
		const source = this.roomSource(roomId);
		return source ? source.act(action) : { ok: false, error: "not_found" };
	}

	async leaveRoom(roomId: string): Promise<void> {
		const source = this.roomSource(roomId);
		await source?.leave();
	}

	emote(roomId: string, emote: Emote): void {
		this.roomSource(roomId)?.emote(emote);
	}

	async rematch(roomId: string): Promise<PlayResult> {
		const source = this.roomSource(roomId);
		if (!source) return { ok: false, error: "not_found" };
		try {
			await source.rematch();
			return { ok: true };
		} catch (error) {
			return { ok: false, error: playErrorCode(error) };
		}
	}

	async startRoom(roomId: string): Promise<PlayResult> {
		const source = this.roomSource(roomId);
		if (!source) return { ok: false, error: "not_found" };
		try {
			await source.start();
			return { ok: true };
		} catch (error) {
			return { ok: false, error: playErrorCode(error) };
		}
	}

	/** Open a Practice table; navigate to /match/<roomId> on success. */
	async startPractice(request: PracticeRequest): Promise<PlayResult<{ roomId: string }>> {
		if (!this.enabled) return { ok: false, error: "disabled" };
		if (this.deps.practiceAllowed && !this.deps.practiceAllowed()) return { ok: false, error: "disabled" };
		const you = await this.myCard();
		const create = this.deps.createPractice ?? createPracticeRoom;
		const room = create(
			{ gameId: request.gameId, seats: request.seats, untimed: request.untimed, you },
			{ log: this.deps.log, emoteCooldownMs: this.store.getState().timing.emoteCooldownMs },
		);
		if (!room) return { ok: false, error: "game_unavailable" };
		const leave = room.leave;
		// Leaving forgets the table here too; a mounted screen keeps its source.
		room.leave = async () => {
			await leave();
			this.practice.delete(room.roomId);
		};
		this.practice.set(room.roomId, room);
		return { ok: true, roomId: room.roomId };
	}

	clearError(): void {
		this.store.dispatch({ type: "clearError" });
	}

	dismissNotice(at: number): void {
		this.store.dispatch({ type: "dismissNotice", at });
	}

	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.clearLinger();
		this.storeOff?.();
		this.storeOff = null;
		for (const off of this.clientOff) off();
		this.clientOff = [];
		this.client?.close();
		this.client = null;
		this.disposePractice();
	}

	// ── Internals ──────────────────────────────────────────────────────────

	private allowed(): boolean {
		return !this.disposed && this.enabled && !!this.sessionUserId;
	}

	private wanted(): boolean {
		return this.consumers > 0 || holdsLiveInterest(this.store.getState());
	}

	private evaluate(): void {
		if (!this.allowed()) {
			this.clearLinger();
			if (this.client && this.client.status !== "idle") this.client.close();
			return;
		}
		if (!this.appActive) return; // suspended; setAppActive(true) picks it up
		if (this.wanted()) {
			this.clearLinger();
			const client = this.ensureClient();
			if (client.status === "idle") client.connect();
			return;
		}
		const client = this.client;
		if (!client || client.status === "idle" || this.lingerTimer !== null) return;
		this.lingerTimer = this.timers.setTimeout(() => {
			this.lingerTimer = null;
			if (!this.wanted()) this.client?.close();
		}, this.lingerMs);
	}

	private clearLinger(): void {
		if (this.lingerTimer !== null) {
			this.timers.clearTimeout(this.lingerTimer);
			this.lingerTimer = null;
		}
	}

	private ensureClient(): PlayClientLike {
		if (this.client) return this.client;
		const client = this.deps.createClient({
			url: () => {
				const url = this.deps.serverUrl();
				this.dialedUrl = url;
				return url;
			},
		});
		this.clientOff = [
			client.on("status", (connection) => {
				this.store.dispatch({ type: "connection", connection });
				if (connection.status === "open") for (const roomId of this.watched.keys()) this.joinWatched(roomId);
				else if (connection.status === "idle") this.evaluate();
			}),
			client.on("message", (message) => {
				this.store.dispatch({ type: "server", message, at: this.serverNow() });
			}),
			client.on("clock", ({ offsetMs, rttMs }) => {
				this.store.dispatch({ type: "clock", offsetMs, rttMs });
			}),
		];
		this.client = client;
		return client;
	}

	private joinWatched(roomId: string): void {
		const client = this.client;
		if (!client || client.status !== "open") return;
		client.request({ t: "room.join", roomId }).then(
			(data) => {
				const room = roomFromAck(data);
				if (room) this.store.dispatch({ type: "room", room, at: this.serverNow() });
			},
			(error) => {
				const code = playErrorCode(error);
				if (code === "not_found" || code === "forbidden" || code === "expired") {
					this.store.dispatch({
						type: "server",
						message: { t: "room.gone", roomId, reason: code === "expired" ? "expired" : "not_found" },
						at: this.serverNow(),
					});
				}
			},
		);
	}

	/** Wait until the socket is open (bringing it up if needed), within the
	 *  request timeout. */
	private async whenOpen(): Promise<PlayClientLike | null> {
		if (!this.allowed()) return null;
		const release = this.retain();
		try {
			const client = this.ensureClient();
			if (client.status === "open") return client;
			if (client.status === "stopped" || client.status === "suspended") return null;
			return await new Promise<PlayClientLike | null>((resolve) => {
				const timer = this.timers.setTimeout(() => {
					off();
					resolve(null);
				}, this.requestTimeoutMs);
				const off = client.on("status", (connection) => {
					if (connection.status === "open") {
						this.timers.clearTimeout(timer);
						off();
						resolve(client);
					} else if (connection.status === "stopped" || connection.status === "idle") {
						this.timers.clearTimeout(timer);
						off();
						resolve(null);
					}
				});
			});
		} finally {
			release();
		}
	}

	private async request(message: PlayRequest): Promise<unknown> {
		const client = this.client?.status === "open" ? this.client : await this.whenOpen();
		if (!client) throw new PlayRequestError("offline");
		// Hold the connection for the round trip so a linger cannot cut it.
		const release = this.retain();
		try {
			return await client.request(message);
		} finally {
			release();
		}
	}

	private async attemptData(message: PlayRequest): Promise<{ ok: true; data: unknown } | { ok: false; error: PlayErrorCode }> {
		try {
			return { ok: true, data: await this.request(message) };
		} catch (error) {
			return { ok: false, error: playErrorCode(error) };
		}
	}

	private async attempt(message: PlayRequest): Promise<PlayResult> {
		const res = await this.attemptData(message);
		return res.ok ? { ok: true } : res;
	}

	private async myCard(): Promise<PlayerCard> {
		const me = this.store.getState().me;
		try {
			const card = await this.deps.loadMyCard?.();
			if (card) return card;
		} catch (error) {
			this.deps.log?.("[play] could not load my card", error);
		}
		return { userId: this.sessionUserId ?? me?.userId ?? "you", name: me?.name ?? "You", look: PLAIN_LOOK };
	}

	private disposePractice(): void {
		for (const room of this.practice.values()) room.dispose();
		this.practice.clear();
	}
}

