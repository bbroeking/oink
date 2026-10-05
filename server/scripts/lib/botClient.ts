// A bot pig that speaks the real wire protocol: connects, signs in (a dev
// token locally, or a real Supabase token), follows every table it sits at,
// and whenever its seat owes a move picks one with the game's own practice
// bot (`game.bot(view, seat, rng)`, which sees only that seat's view) after a
// short, human-ish pause. It also polices the server: revisions on a table
// must never go backwards. Used by the e2e harness and `npm run bot`.
//
// It pings the way the app does: an app-level `ping` every heartbeat from
// the welcome's timing. The server closes a socket that has sent nothing for
// idleTimeoutMs (4006), and a by-post bot waiting on the other pig sends
// nothing between moves: without the ping it was dropped ~70 s after each
// move and re-queued into a fresh table, leaving orphan open seats.

import { WebSocket } from "ws";
import type { AnyGame, GameId, Pace } from "../../../multiplayer/types";
import {
	DEFAULT_TIMING,
	PROTOCOL_VERSION,
	type InviteKind,
	type InviteSummary,
	type RoomSnapshot,
	type ServerMessage,
} from "../../../multiplayer/protocol";
import { createRng } from "../../../multiplayer/rng";

type Msg<K extends ServerMessage["t"]> = Extract<ServerMessage, { t: K }>;
export type Ack = Msg<"ack">;

export interface BotOptions {
	url: string;
	token: string;
	/** Rules modules the bot can play, by id. */
	games: ReadonlyMap<GameId, AnyGame>;
	/** Label for logs. */
	label?: string;
	/** Pause before each move, ms [min, max]. */
	moveDelayMs?: [number, number];
	/** Seeds the bot's choices and pauses. */
	seed?: string;
	log?: (line: string) => void;
}

interface Watcher {
	pick: (m: ServerMessage) => unknown;
	resolve: (value: unknown) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class BotClient {
	readonly rooms = new Map<string, RoomSnapshot>();
	/** Anything the server did wrong, in words (rev went backwards...). */
	readonly violations: string[] = [];
	userId: string | null = null;
	name: string | null = null;
	/** Plays its seat automatically while true. */
	autoplay = true;
	private ws: WebSocket | null = null;
	private rid = 0;
	private readonly acks = new Map<number, (ack: Ack) => void>();
	private readonly watchers = new Set<Watcher>();
	private readonly acted = new Map<string, number>();
	private readonly rng;
	private closedOnPurpose = false;
	private heartbeat: ReturnType<typeof setInterval> | null = null;
	/** Resolves with the close code when the current socket closes. */
	closed: Promise<number> = Promise.resolve(0);

	constructor(private readonly opts: BotOptions) {
		this.rng = createRng(opts.seed ?? opts.token);
	}

	get label(): string {
		return this.opts.label ?? this.name ?? this.userId ?? "bot";
	}

	get connected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	/** Opens a socket and signs in. Resolves with the welcome. */
	connect(): Promise<Msg<"welcome">> {
		this.closedOnPurpose = false;
		const ws = new WebSocket(this.opts.url);
		this.ws = ws;
		this.closed = new Promise((resolve) => ws.on("close", (code) => resolve(code)));
		return new Promise((resolve, reject) => {
			let welcomed = false;
			ws.on("open", () => ws.send(JSON.stringify({ t: "auth", token: this.opts.token, protocol: PROTOCOL_VERSION })));
			ws.on("message", (data) => {
				const msg = JSON.parse(data.toString()) as ServerMessage;
				if (msg.t === "welcome" && !welcomed) {
					welcomed = true;
					this.userId = msg.userId;
					this.name = msg.name;
					this.startHeartbeat(ws, msg.timing?.heartbeatMs);
					resolve(msg);
				}
				this.receive(msg);
			});
			ws.on("close", (code, reason) => {
				if (this.ws === ws) this.stopHeartbeat();
				for (const resolveAck of this.acks.values()) {
					resolveAck({ t: "ack", rid: -1, ok: false, error: "internal", message: "socket closed" });
				}
				this.acks.clear();
				if (!welcomed) reject(new Error(`closed ${code} before welcome: ${reason.toString()}`));
				else if (!this.closedOnPurpose) this.log(`socket closed ${code}`);
			});
			ws.on("error", (err) => {
				if (!welcomed) reject(err);
			});
		});
	}

	/** Drops the connection without a goodbye (a phone losing signal). */
	drop(): void {
		this.closedOnPurpose = true;
		this.stopHeartbeat();
		this.ws?.terminate();
	}

	close(): void {
		this.closedOnPurpose = true;
		this.stopHeartbeat();
		this.ws?.close();
	}

	/** An app-level ping every heartbeat on this socket, as the app sends. */
	private startHeartbeat(ws: WebSocket, everyMs: number | undefined): void {
		this.stopHeartbeat();
		const every = typeof everyMs === "number" && Number.isFinite(everyMs) && everyMs > 0 ? everyMs : DEFAULT_TIMING.heartbeatMs;
		const timer = setInterval(() => {
			if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return;
			ws.send(JSON.stringify({ t: "ping", ct: Date.now() }));
		}, every);
		// Never the thing that keeps a finished harness alive.
		timer.unref?.();
		this.heartbeat = timer;
	}

	private stopHeartbeat(): void {
		if (this.heartbeat !== null) clearInterval(this.heartbeat);
		this.heartbeat = null;
	}

	request(msg: Record<string, unknown>): Promise<Ack> {
		const rid = ++this.rid;
		return new Promise((resolve) => {
			this.acks.set(rid, resolve);
			if (!this.connected) {
				this.acks.delete(rid);
				resolve({ t: "ack", rid, ok: false, error: "internal", message: "not connected" });
				return;
			}
			this.ws?.send(JSON.stringify({ ...msg, rid }));
		});
	}

	/** Resolves with the first future frame `pick` maps to a value. */
	waitFor<T>(pick: (m: ServerMessage) => T | undefined | null | false, label: string, timeoutMs = 30_000): Promise<T> {
		return new Promise((resolve, reject) => {
			const watcher: Watcher = {
				pick,
				resolve: resolve as (value: unknown) => void,
				timer: setTimeout(() => {
					this.watchers.delete(watcher);
					reject(new Error(`${this.label}: timed out waiting for ${label}`));
				}, timeoutMs),
			};
			this.watchers.add(watcher);
		});
	}

	/** A table's snapshot once it satisfies `pred` (the latest held, or a later one). */
	waitRoom(roomId: string, pred: (r: RoomSnapshot) => boolean, label: string, timeoutMs = 30_000): Promise<RoomSnapshot> {
		const held = this.rooms.get(roomId);
		if (held && pred(held)) return Promise.resolve(held);
		return this.waitFor((m) => (m.t === "room.state" && m.room.roomId === roomId && pred(m.room) ? m.room : undefined), label, timeoutMs);
	}

	/** The next table this bot is seated at for `game` (any table when null). */
	nextTable(game: GameId | null, label: string, timeoutMs = 30_000): Promise<RoomSnapshot> {
		return this.waitFor(
			(m) => (m.t === "room.state" && (game === null || m.room.game === game) && m.room.you !== null ? m.room : undefined),
			label,
			timeoutMs,
		);
	}

	queue(games: GameId[], pace: Pace): Promise<Ack> {
		return this.request({ t: "queue.join", games, pace });
	}

	async createInvite(game: GameId, kind: InviteKind, pace: Pace, to?: string[]): Promise<InviteSummary> {
		const ack = await this.request({ t: "invite.create", game, kind, pace, ...(to ? { to } : {}) });
		if (!ack.ok) throw new Error(`${this.label}: invite.create refused (${ack.error} ${ack.message ?? ""})`);
		return ack.data as InviteSummary;
	}

	async acceptInvite(code: string): Promise<string> {
		const ack = await this.request({ t: "invite.accept", code });
		if (!ack.ok) throw new Error(`${this.label}: invite.accept refused (${ack.error} ${ack.message ?? ""})`);
		return (ack.data as { roomId: string }).roomId;
	}

	private receive(msg: ServerMessage): void {
		if (msg.t === "ack") {
			const resolveAck = this.acks.get(msg.rid);
			if (resolveAck) {
				this.acks.delete(msg.rid);
				resolveAck(msg);
			}
		}
		if (msg.t === "room.state") this.onRoom(msg.room);
		for (const watcher of [...this.watchers]) {
			const value = watcher.pick(msg);
			if (value !== undefined && value !== null && value !== false) {
				this.watchers.delete(watcher);
				clearTimeout(watcher.timer);
				watcher.resolve(value);
			}
		}
	}

	private onRoom(snap: RoomSnapshot): void {
		const held = this.rooms.get(snap.roomId);
		if (held && snap.rev < held.rev) {
			this.violations.push(`${snap.roomId}: rev went backwards ${held.rev} -> ${snap.rev}`);
			return;
		}
		this.rooms.set(snap.roomId, snap);
		this.maybeAct(snap);
	}

	/** Re-checks every table (after autoplay is switched back on). */
	wake(): void {
		for (const snap of this.rooms.values()) this.maybeAct(snap);
	}

	private maybeAct(snap: RoomSnapshot): void {
		if (!this.autoplay || snap.phase !== "playing" || snap.you === null || snap.view === null) return;
		if (!snap.activeSeats.includes(snap.you) || this.acted.get(snap.roomId) === snap.rev) return;
		const game = this.opts.games.get(snap.game);
		if (!game) return;
		this.acted.set(snap.roomId, snap.rev);
		const [lo, hi] = this.opts.moveDelayMs ?? [40, 120];
		const delay = lo + Math.floor(this.rng.next() * (hi - lo + 1));
		setTimeout(() => {
			const now = this.rooms.get(snap.roomId);
			// Only act on the table as it still stands.
			if (!this.autoplay || !now || now.rev !== snap.rev || !this.connected) {
				if (now && now.rev === snap.rev) this.acted.delete(snap.roomId);
				return;
			}
			const you = now.you as number;
			const action = game.bot(now.view, you, createRng(`${this.opts.seed ?? this.opts.token}:${now.roomId}:${now.rev}:${you}`));
			if (action === null) return; // nothing to do: the clock will resolve it
			void this.request({ t: "room.action", roomId: now.roomId, rev: now.rev, action }).then((ack) => {
				if (!ack.ok && ack.error !== "not_your_turn" && ack.message !== "socket closed") {
					this.log(`move refused on ${now.roomId} at rev ${now.rev}: ${ack.error}`);
				}
			});
		}, delay);
	}

	private log(line: string): void {
		this.opts.log?.(`[${this.label}] ${line}`);
	}
}
