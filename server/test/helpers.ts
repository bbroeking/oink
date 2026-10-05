// Test harness: a real play server on an ephemeral port, driven by a manual
// clock (so deadlines, grace windows and countdowns move only when a test
// says so), an in-memory store, a recording push sender, and real `ws`
// clients that collect every frame.

import { WebSocket } from "ws";
import type { AnyGame } from "../../multiplayer/types";
import type { RoomSnapshot, ServerMessage } from "../../multiplayer/protocol";
import { createRng } from "../../multiplayer/rng";
import { ManualClock } from "../src/clock";
import { localConfig, type ConfigOverrides } from "../src/config";
import type { Entropy } from "../src/entropy";
import type { PushMessage, PushSender } from "../src/push";
import type { RoomHooks } from "../src/rooms";
import { createPlayServer, type PlayServer } from "../src/server";
import { MemoryStore, type SeedPlayer } from "../src/store/memory";
import { FIXTURE_GAMES } from "./fixtures/games";

export const realDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function uid(n: number): string {
	return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

export function devToken(userId: string, name?: string): string {
	return name ? `dev:${userId}:${encodeURIComponent(name)}` : `dev:${userId}`;
}

export function pushTokenOf(userId: string): string {
	return `ExponentPushToken[${userId}]`;
}

export class RecordingPush implements PushSender {
	readonly sent: PushMessage[] = [];

	async send(messages: PushMessage[]): Promise<void> {
		this.sent.push(...messages);
	}

	to(userId: string): PushMessage[] {
		return this.sent.filter((m) => m.to === pushTokenOf(userId));
	}
}

type Msg<K extends ServerMessage["t"]> = Extract<ServerMessage, { t: K }>;

interface Waiter {
	pred: (m: ServerMessage) => boolean;
	resolve: (m: ServerMessage) => void;
	timer: ReturnType<typeof setTimeout>;
}

export class TestClient {
	readonly inbox: ServerMessage[] = [];
	readonly rooms = new Map<string, RoomSnapshot>();
	readonly closed: Promise<{ code: number; reason: string }>;
	private readonly waiters: Waiter[] = [];
	private readonly roomWatchers: { pred: (r: RoomSnapshot) => boolean; resolve: (r: RoomSnapshot) => void }[] = [];
	private rid = 0;
	userId: string | null = null;

	private constructor(readonly ws: WebSocket) {
		this.closed = new Promise((resolve) => ws.on("close", (code, reason) => resolve({ code, reason: reason.toString() })));
		ws.on("message", (data) => this.receive(JSON.parse(data.toString()) as ServerMessage));
		ws.on("error", () => undefined);
	}

	static connect(url: string, opts: { autoPong?: boolean } = {}): Promise<TestClient> {
		const ws = new WebSocket(url, { autoPong: opts.autoPong ?? true });
		return new Promise((resolve, reject) => {
			ws.once("open", () => resolve(new TestClient(ws)));
			ws.once("error", reject);
		});
	}

	private receive(msg: ServerMessage): void {
		if (msg.t === "room.state") {
			const held = this.rooms.get(msg.room.roomId);
			if (!held || msg.room.rev >= held.rev) {
				this.rooms.set(msg.room.roomId, msg.room);
				for (let w = this.roomWatchers.length - 1; w >= 0; w--) {
					const watcher = this.roomWatchers[w];
					if (safe(watcher.pred, msg.room)) {
						this.roomWatchers.splice(w, 1);
						watcher.resolve(msg.room);
					}
				}
			}
		}
		const i = this.waiters.findIndex((w) => safe(w.pred, msg));
		if (i >= 0) {
			const [w] = this.waiters.splice(i, 1);
			clearTimeout(w.timer);
			w.resolve(msg);
			return;
		}
		this.inbox.push(msg);
	}

	/** The first frame (buffered or future) matching `pred`. */
	next(pred: (m: ServerMessage) => boolean, label = "a frame", timeoutMs = 3_000): Promise<ServerMessage> {
		const i = this.inbox.findIndex((m) => safe(pred, m));
		if (i >= 0) return Promise.resolve(this.inbox.splice(i, 1)[0]);
		return new Promise((resolve, reject) => {
			const waiter: Waiter = {
				pred,
				resolve,
				timer: setTimeout(() => {
					const at = this.waiters.indexOf(waiter);
					if (at >= 0) this.waiters.splice(at, 1);
					reject(new Error(`timed out waiting for ${label} (${this.userId ?? "unauthed"})`));
				}, timeoutMs),
			};
			this.waiters.push(waiter);
		});
	}

	nextOf<K extends ServerMessage["t"]>(t: K, pred: (m: Msg<K>) => boolean = () => true, timeoutMs?: number): Promise<Msg<K>> {
		return this.next((m) => m.t === t && pred(m as Msg<K>), t, timeoutMs) as Promise<Msg<K>>;
	}

	/** True if a frame matching `pred` is already buffered. */
	has(pred: (m: ServerMessage) => boolean): boolean {
		return this.inbox.some(pred);
	}

	send(raw: unknown): void {
		this.ws.send(typeof raw === "string" ? raw : JSON.stringify(raw));
	}

	request(msg: Record<string, unknown>, timeoutMs?: number): Promise<Msg<"ack">> {
		const rid = ++this.rid;
		this.send({ ...msg, rid });
		return this.nextOf("ack", (a) => a.rid === rid, timeoutMs);
	}

	async auth(token: string, protocol = 1): Promise<Msg<"welcome">> {
		this.send({ t: "auth", token, protocol });
		return this.nextOf("welcome");
	}

	/** A table's latest snapshot once it satisfies `pred`: judged on the
	 *  newest snapshot held now, then on each newer one as it arrives (never
	 *  on stale frames still sitting in the inbox). */
	room(pred: (r: RoomSnapshot) => boolean, label = "a room state", timeoutMs = 3_000): Promise<RoomSnapshot> {
		for (const r of this.rooms.values()) if (safe(pred, r)) return Promise.resolve(r);
		return new Promise((resolve, reject) => {
			const watcher = {
				pred,
				resolve: (r: RoomSnapshot) => {
					clearTimeout(timer);
					resolve(r);
				},
			};
			const timer = setTimeout(() => {
				const at = this.roomWatchers.indexOf(watcher);
				if (at >= 0) this.roomWatchers.splice(at, 1);
				reject(new Error(`timed out waiting for ${label} (${this.userId ?? "unauthed"})`));
			}, timeoutMs);
			this.roomWatchers.push(watcher);
		});
	}

	latest(roomId: string): RoomSnapshot | undefined {
		return this.rooms.get(roomId);
	}

	clear(): void {
		this.inbox.length = 0;
	}

	close(): void {
		this.ws.close();
	}

	terminate(): void {
		this.ws.terminate();
	}
}

function safe<T>(pred: (value: T) => boolean, value: T): boolean {
	try {
		return pred(value);
	} catch {
		return false;
	}
}

export interface TestServer {
	server: PlayServer;
	store: MemoryStore;
	clock: ManualClock;
	push: RecordingPush;
	url: string;
	/** Seeds a pig (with a push token) and returns its id. */
	pig(n: number, name?: string, extra?: Partial<SeedPlayer>): string;
	/** Connects and signs a pig in. */
	connect(userId: string, name?: string): Promise<TestClient>;
	/** Waits until the server has noticed a pig's socket is gone. */
	waitOffline(userId: string): Promise<void>;
	advance(ms: number): Promise<void>;
	settle(): Promise<void>;
	close(): Promise<void>;
}

export interface StartOptions {
	games?: readonly AnyGame[];
	config?: ConfigOverrides;
	store?: MemoryStore;
	clock?: ManualClock;
	hooks?: RoomHooks;
	entropy?: Entropy;
}

/** Quiet defaults: heartbeats and idle cuts far away unless a test asks. */
export async function startServer(opts: StartOptions = {}): Promise<TestServer> {
	const store = opts.store ?? new MemoryStore();
	const clock = opts.clock ?? new ManualClock();
	const push = new RecordingPush();
	const QUIET = 30 * 24 * 3_600_000;
	const config = localConfig({
		settingsPollMs: QUIET,
		...opts.config,
		timing: { heartbeatMs: QUIET, idleTimeoutMs: 2 * QUIET, ...opts.config?.timing },
	});
	const server = createPlayServer({
		config,
		games: opts.games ?? FIXTURE_GAMES,
		store,
		clock,
		push,
		hooks: opts.hooks,
		entropy: opts.entropy,
	});
	await server.start();
	const clients: TestClient[] = [];
	const settle = () => server.settled();
	return {
		server,
		store,
		clock,
		push,
		url: server.wsUrl,
		pig(n, name, extra) {
			const userId = uid(n);
			store.seedPlayer({ userId, username: name ?? `Pig ${n}`, pushToken: pushTokenOf(userId), ...extra });
			return userId;
		},
		async connect(userId, name) {
			const client = await TestClient.connect(server.wsUrl);
			client.userId = userId;
			clients.push(client);
			await client.auth(devToken(userId, name));
			await settle();
			return client;
		},
		async waitOffline(userId) {
			for (let i = 0; i < 400 && server.hub.isOnline(userId); i++) await realDelay(5);
			if (server.hub.isOnline(userId)) throw new Error(`${userId} never went offline`);
			await settle();
		},
		advance: (ms) => clock.advance(ms, settle),
		settle,
		async close() {
			for (const c of clients) c.terminate();
			await server.shutdown();
		},
	};
}

/** Plays every seat with the game's own bot until the table ends. When no
 *  seat can move it first lets the sockets catch up, then nudges the manual
 *  clock forward a little (a tick-driven reveal beat ends only that way). */
export async function playOut(game: AnyGame, clients: TestClient[], roomId: string, ts: TestServer, maxSteps = 400): Promise<RoomSnapshot> {
	let idle = 0;
	for (let step = 0; step < maxSteps; step++) {
		await ts.settle();
		const snaps = clients.map((c) => c.latest(roomId));
		const ended = snaps.find((s) => s?.phase === "ended");
		if (ended) return ended;
		let moved = false;
		for (const [i, client] of clients.entries()) {
			const snap = snaps[i];
			if (!snap || snap.phase !== "playing" || snap.you === null || !snap.activeSeats.includes(snap.you)) continue;
			const action = game.bot(snap.view, snap.you, createRng(`${roomId}:${snap.rev}:${snap.you}`));
			if (action === null) continue;
			const ack = await client.request({ t: "room.action", roomId, rev: snap.rev, action });
			if (!ack.ok) throw new Error(`bot move refused: ${ack.error}`);
			moved = true;
			break;
		}
		if (moved) {
			idle = 0;
			continue;
		}
		idle++;
		if (idle % 4 === 0) await ts.advance(100);
		else await realDelay(3);
	}
	throw new Error("table never ended");
}
