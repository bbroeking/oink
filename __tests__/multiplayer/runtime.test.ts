// The connection policy behind useMultiplayer: lazy connect, the 60 s linger,
// keep-alive while searching or seated at a live table, background, sign-out,
// actions that wait for the socket, room re-joins, and the Practice registry.

import type { GameDefinition, Seat } from "../../multiplayer/types";
import { DEFAULT_TIMING, PROTOCOL_VERSION, type ClientMessage, type RoomSnapshot, type ServerMessage } from "../../multiplayer/protocol";
import { TEST_LOOK } from "../../multiplayer/testkit";
import {
	IDLE_CONNECTION,
	PlayRequestError,
	type PlayClientEvents,
	type PlayConnectionState,
	type PlayStatus,
	type PlayStopReason,
} from "../../utils/multiplayer/client";
import { createPracticeRoom } from "../../utils/multiplayer/localRoom";
import { LINGER_MS, PlayRuntime, inviteFromAck, roomFromAck, type PlayClientLike } from "../../utils/multiplayer/runtime";

function fakeClock(start = 1_700_000_000_000) {
	let now = start;
	let seq = 0;
	const tasks = new Map<number, { at: number; fn: () => void }>();
	return {
		now: () => now,
		timers: {
			setTimeout: (fn: () => void, ms: number) => {
				const id = ++seq;
				tasks.set(id, { at: now + Math.max(0, ms), fn });
				return id;
			},
			clearTimeout: (id: unknown) => {
				tasks.delete(id as number);
			},
		},
		advance(ms: number) {
			const target = now + ms;
			for (;;) {
				let nextId: number | null = null;
				let nextAt = Infinity;
				for (const [id, task] of tasks) {
					if (task.at <= target && task.at < nextAt) {
						nextAt = task.at;
						nextId = id;
					}
				}
				if (nextId === null) break;
				const task = tasks.get(nextId)!;
				tasks.delete(nextId);
				now = task.at;
				task.fn();
			}
			now = target;
		},
	};
}

type Listener<E extends keyof PlayClientEvents> = (payload: PlayClientEvents[E]) => void;

class FakeClient implements PlayClientLike {
	connection: PlayConnectionState = IDLE_CONNECTION;
	calls: string[] = [];
	sent: { message: ClientMessage | Record<string, unknown>; resolve: (data: unknown) => void; reject: (e: unknown) => void }[] = [];
	private listeners: { [E in keyof PlayClientEvents]: Set<Listener<E>> } = { status: new Set(), message: new Set(), clock: new Set() };
	constructor(private readonly clock: ReturnType<typeof fakeClock>) {}

	get status(): PlayStatus {
		return this.connection.status;
	}
	connect() {
		this.calls.push("connect");
		if (this.status === "idle" || this.status === "stopped") this.setStatus("connecting");
	}
	reconnect() {
		this.calls.push("reconnect");
		this.setStatus("connecting");
	}
	close() {
		this.calls.push("close");
		this.setStatus("idle");
	}
	suspend() {
		this.calls.push("suspend");
		if (this.status !== "idle" && this.status !== "stopped") this.setStatus("suspended");
	}
	resume() {
		this.calls.push("resume");
		if (this.status === "suspended") this.setStatus("connecting");
	}
	request<T = unknown>(message: Parameters<PlayClientLike["request"]>[0]): Promise<T> {
		if (this.status !== "open") return Promise.reject(new PlayRequestError("offline"));
		return new Promise<T>((resolve, reject) => this.sent.push({ message, resolve: resolve as (d: unknown) => void, reject }));
	}
	send() {
		return this.status === "open";
	}
	serverNow() {
		return this.clock.now();
	}
	on<E extends keyof PlayClientEvents>(event: E, listener: Listener<E>): () => void {
		const set = this.listeners[event] as Set<Listener<E>>;
		set.add(listener);
		return () => {
			set.delete(listener);
		};
	}
	// drivers
	setStatus(status: PlayStatus, reason: PlayStopReason | null = null) {
		this.connection = { status, reason, attempt: 0, retryAt: null };
		for (const l of [...this.listeners.status]) l(this.connection);
	}
	receive(message: ServerMessage) {
		for (const l of [...this.listeners.message]) l(message);
	}
	open() {
		this.receive({
			t: "welcome",
			userId: "user-me",
			name: "Rosie",
			serverNow: this.clock.now(),
			protocol: PROTOCOL_VERSION,
			timing: DEFAULT_TIMING,
			catalog: [],
			resume: { queue: { state: "idle", games: [], pace: "live", since: null }, rooms: [], invites: [] },
		});
		this.setStatus("open");
	}
	sentOf(t: string) {
		return this.sent.filter((s) => (s.message as { t: string }).t === t);
	}
}

const flush = async () => {
	for (let i = 0; i < 8; i++) await Promise.resolve();
};

function setup(opts: { url?: () => string; practiceAllowed?: () => boolean } = {}) {
	const clock = fakeClock();
	const clients: FakeClient[] = [];
	const runtime = new PlayRuntime({
		createClient: () => {
			const client = new FakeClient(clock);
			clients.push(client);
			return client;
		},
		serverUrl: opts.url ?? (() => "wss://play.test/ws"),
		practiceAllowed: opts.practiceAllowed,
		loadMyCard: async () => ({ userId: "user-me", name: "Rosie", look: TEST_LOOK }),
		createPractice: (options, deps) => createPracticeRoom(options, { ...deps, game: nim, now: clock.now, timers: clock.timers, random: () => 0.5 }),
		now: clock.now,
		timers: clock.timers,
	});
	const client = () => clients[clients.length - 1];
	return { runtime, clock, clients, client };
}

function ready(opts?: Parameters<typeof setup>[0]) {
	const env = setup(opts);
	env.runtime.setEnabled(true);
	env.runtime.setSession("user-me");
	return env;
}

function liveRoom(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
	return {
		roomId: "0000aaaa-1111",
		game: "fence_the_pen",
		rulesVersion: 1,
		pace: "live",
		source: "queue",
		phase: "playing",
		seats: [
			{ seat: 0, userId: "user-me", name: "Rosie", look: TEST_LOOK, connected: true, gone: false },
			{ seat: 1, userId: "user-2", name: "Copper", look: TEST_LOOK, connected: true, gone: false },
		],
		seatCount: 2,
		you: 0,
		view: null,
		activeSeats: [0],
		deadline: null,
		startsAt: null,
		rev: 1,
		events: [],
		result: null,
		invite: null,
		rematch: null,
		host: null,
		...overrides,
	};
}

type NimState = { sticks: number; turn: Seat; winner: Seat | null };
const nim: GameDefinition<NimState, { type: "take"; n: 1 | 2 }, NimState> = {
	id: "fence_the_pen",
	title: "Nim",
	tagline: "Take the last stick.",
	rulesVersion: 1,
	seats: { min: 2, max: 2 },
	kind: "competitive",
	paces: ["live"],
	decisionMs: { live: 10_000 },
	setup: () => ({ sticks: 7, turn: 0, winner: null }),
	activeSeats: (s) => (s.winner === null ? [s.turn] : []),
	apply: (s, seat, a) => {
		if (seat !== s.turn) return { ok: false, error: "not_your_turn" };
		const sticks = s.sticks - a.n;
		return { ok: true, state: { sticks, turn: sticks === 0 ? s.turn : 1 - s.turn, winner: sticks === 0 ? seat : null } };
	},
	onTimeout: (s, seat) => {
		const sticks = s.sticks - 1;
		return { state: { sticks, turn: sticks === 0 ? seat : 1 - seat, winner: sticks === 0 ? seat : null } };
	},
	view: (s) => s,
	result: (s) => (s.winner === null ? null : { kind: "win", winners: [s.winner], scores: [0, 0], summary: "" }),
	bot: (v, seat) => (v.turn === seat && v.winner === null ? { type: "take", n: 1 } : null),
	parseAction: (raw) => {
		const r = raw as { type?: unknown; n?: unknown };
		return r && r.type === "take" && (r.n === 1 || r.n === 2) ? { type: "take", n: r.n } : null;
	},
};

describe("lazy connection", () => {
	it("opens nothing until play is on, someone is signed in, and a screen asks", () => {
		const { runtime, clients } = setup();
		const releaseEarly = runtime.retain(); // flag still off
		expect(clients).toHaveLength(0);
		runtime.setEnabled(true);
		expect(clients).toHaveLength(0); // no session yet
		runtime.setSession("user-me");
		expect(clients).toHaveLength(1);
		expect(clients[0].calls).toEqual(["connect"]);
		releaseEarly();
	});

	it("does not connect for a signed-in player with nothing on screen", () => {
		const { clients } = ready();
		expect(clients).toHaveLength(0);
	});

	it("lingers 60 s after the last consumer, then closes; a quick return keeps it", () => {
		const { runtime, clock, client } = ready();
		const release = runtime.retain();
		client().open();
		release();
		clock.advance(LINGER_MS - 1);
		expect(client().calls).not.toContain("close");
		const again = runtime.retain(); // hopped to another Play screen
		clock.advance(LINGER_MS * 2);
		expect(client().calls).not.toContain("close");
		again();
		clock.advance(LINGER_MS);
		expect(client().calls).toContain("close");
		expect(runtime.store.getState().connection.status).toBe("idle");
	});

	it("ref-counts: one release does not close while another screen holds on", () => {
		const { runtime, clock, client } = ready();
		const a = runtime.retain();
		const b = runtime.retain();
		client().open();
		a();
		a(); // double release is harmless
		clock.advance(LINGER_MS * 2);
		expect(client().calls).not.toContain("close");
		expect(runtime.consumerCount).toBe(1);
		b();
		clock.advance(LINGER_MS);
		expect(client().calls).toContain("close");
	});
});

describe("keep-alive", () => {
	it("stays up while searching, then lingers once the search ends", () => {
		const { runtime, clock, client } = ready();
		const release = runtime.retain();
		client().open();
		client().receive({ t: "queue.state", queue: { state: "searching", games: ["mud_volley"], pace: "live", since: clock.now() } });
		release();
		clock.advance(LINGER_MS * 3);
		expect(client().calls).not.toContain("close");
		client().receive({ t: "queue.state", queue: { state: "idle", games: [], pace: "live", since: null } });
		clock.advance(LINGER_MS);
		expect(client().calls).toContain("close");
	});

	it("stays up while seated at a live table, but not for a by-post one", () => {
		const { runtime, clock, client } = ready();
		const release = runtime.retain();
		client().open();
		client().receive({ t: "room.state", room: liveRoom() });
		release();
		clock.advance(LINGER_MS * 3);
		expect(client().calls).not.toContain("close");
		client().receive({ t: "room.state", room: liveRoom({ rev: 2, phase: "ended", activeSeats: [] }) });
		clock.advance(LINGER_MS);
		expect(client().calls).toContain("close");

		const env = ready();
		const off = env.runtime.retain();
		env.client().open();
		env.client().receive({ t: "room.state", room: liveRoom({ pace: "async" }) });
		off();
		env.clock.advance(LINGER_MS);
		expect(env.client().calls).toContain("close");
	});
});

describe("app state, session, config", () => {
	it("suspends in the background and resumes when active", () => {
		const { runtime, client } = ready();
		runtime.retain();
		client().open();
		runtime.setAppActive(false);
		expect(client().calls).toContain("suspend");
		expect(client().status).toBe("suspended");
		runtime.setAppActive(true);
		expect(client().calls).toContain("resume");
		expect(client().status).toBe("connecting");
	});

	it("closes and forgets everything on sign-out or an account switch", () => {
		const { runtime, client } = ready();
		runtime.retain();
		client().open();
		client().receive({ t: "room.state", room: liveRoom() });
		expect(runtime.store.getState().me?.userId).toBe("user-me");
		runtime.setSession(null);
		expect(client().calls).toContain("close");
		expect(runtime.store.getState().me).toBeNull();
		expect(runtime.store.getState().rooms).toEqual({});
		runtime.setSession("someone-else");
		expect(client().calls.filter((c) => c === "connect")).toHaveLength(2); // the screen still holds on
	});

	it("closes at once when play is switched off", () => {
		const { runtime, client } = ready();
		runtime.retain();
		client().open();
		runtime.setEnabled(false);
		expect(client().calls).toContain("close");
	});

	it("redials only when the server URL actually moved", () => {
		let url = "wss://play.test/ws";
		const { runtime, client } = ready({ url: () => url });
		runtime.retain();
		// The client reads the URL when it dials; the fake never does, so dial for it.
		(runtime as unknown as { dialedUrl: string }).dialedUrl = url;
		client().open();
		runtime.configChanged();
		expect(client().calls).not.toContain("reconnect");
		url = "wss://play.ticklethepig.com/ws";
		runtime.configChanged();
		expect(client().calls).toContain("reconnect");
	});

	it("leaves a terminal stop alone until retry()", () => {
		const { runtime, clock, client } = ready();
		runtime.retain();
		client().setStatus("stopped", "protocol_mismatch");
		clock.advance(LINGER_MS * 2);
		expect(client().calls.filter((c) => c === "connect")).toHaveLength(1);
		runtime.retry();
		expect(client().calls.filter((c) => c === "connect")).toHaveLength(2);
	});
});

describe("actions", () => {
	it("waits for the socket to come up instead of failing offline", async () => {
		const { runtime, client } = ready();
		const pending = runtime.joinQueue(["mud_volley"], "live");
		await flush();
		expect(client().calls).toEqual(["connect"]);
		client().open();
		await flush();
		const [sent] = client().sentOf("queue.join");
		expect(sent.message).toEqual({ t: "queue.join", games: ["mud_volley"], pace: "live" });
		sent.resolve(undefined);
		await expect(pending).resolves.toEqual({ ok: true });
	});

	it("gives up as offline when the socket does not come up in time", async () => {
		const { runtime, clock } = ready();
		const pending = runtime.leaveQueue();
		await flush();
		clock.advance(8_000);
		await expect(pending).resolves.toEqual({ ok: false, error: "offline" });
	});

	it("returns the server's refusal code and never throws", async () => {
		const { runtime, client } = ready();
		runtime.retain();
		client().open();
		const pending = runtime.acceptInvite("abcd2345");
		await flush();
		const [sent] = client().sentOf("invite.accept");
		expect(sent.message).toEqual({ t: "invite.accept", code: "ABCD2345" });
		sent.reject(new PlayRequestError("full"));
		await expect(pending).resolves.toEqual({ ok: false, error: "full" });
	});

	it("stores what invite acks carry and hands back the table to open", async () => {
		const { runtime, client } = ready();
		runtime.retain();
		client().open();
		const invite = {
			code: "ABCD2345",
			url: "https://ticklethepig.com/play/ABCD2345",
			game: "mud_volley",
			pace: "live",
			kind: "link",
			from: { userId: "user-2", name: "Copper", look: TEST_LOOK },
			to: [],
			status: "open",
			roomId: "0000aaaa-1111",
			seatsTaken: 1,
			seatsMax: 2,
			expiresAt: Date.now() + 60_000,
		};
		const preview = runtime.previewInvite("ABCD2345");
		await flush();
		client().sentOf("invite.preview")[0].resolve({ invite });
		await expect(preview).resolves.toMatchObject({ ok: true, invite: { code: "ABCD2345" } });
		expect(runtime.store.getState().previewed.ABCD2345).toBe(true);

		const accept = runtime.acceptInvite("ABCD2345");
		await flush();
		client().sentOf("invite.accept")[0].resolve({});
		await expect(accept).resolves.toEqual({ ok: true, roomId: "0000aaaa-1111" });
	});

	it("re-joins the tables on screen after every welcome, and tombstones a lost one", async () => {
		const { runtime, client } = ready();
		runtime.retain();
		const unwatch = runtime.watchRoom("0000aaaa-1111");
		client().open();
		expect(client().sentOf("room.join")).toHaveLength(1);
		client().sentOf("room.join")[0].resolve({ room: liveRoom({ rev: 4 }) });
		await flush();
		expect(runtime.store.getState().rooms["0000aaaa-1111"].rev).toBe(4);
		client().setStatus("reconnecting");
		client().open();
		expect(client().sentOf("room.join")).toHaveLength(2);
		client().sentOf("room.join")[1].reject(new PlayRequestError("not_found"));
		await flush();
		expect(runtime.store.getState().goneRooms["0000aaaa-1111"]).toBe("not_found");
		unwatch();
		client().setStatus("reconnecting");
		client().open();
		expect(client().sentOf("room.join")).toHaveLength(2);
	});
});

describe("practice registry", () => {
	it("opens a local table, routes room calls to it, and forgets it on leave", async () => {
		const { runtime, clock } = ready();
		const res = await runtime.startPractice({ gameId: "fence_the_pen" });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		const source = runtime.roomSource(res.roomId);
		expect(source?.practice).toBe(true);
		clock.advance(3_000);
		expect(await runtime.act(res.roomId, { type: "take", n: 1 })).toEqual({ ok: true });
		await runtime.leaveRoom(res.roomId);
		expect(runtime.roomSource(res.roomId)).toBeNull();
		// The screen that still holds the source keeps its last snapshot.
		expect(source?.snapshot?.phase).toBe("playing");
	});

	it("refuses Practice while play is off or the server config turns it off", async () => {
		const off = setup();
		expect(await off.runtime.startPractice({ gameId: "fence_the_pen" })).toEqual({ ok: false, error: "disabled" });
		const noPractice = ready({ practiceAllowed: () => false });
		expect(await noPractice.runtime.startPractice({ gameId: "fence_the_pen" })).toEqual({ ok: false, error: "disabled" });
	});

	it("disposes Practice tables on sign-out", async () => {
		const { runtime } = ready();
		const res = await runtime.startPractice({ gameId: "fence_the_pen" });
		if (!res.ok) throw new Error("practice failed");
		runtime.setSession(null);
		expect(runtime.roomSource(res.roomId)).toBeNull();
	});
});

describe("ack parsing", () => {
	it("reads an invite or a room from an ack, bare or wrapped", () => {
		expect(inviteFromAck({ invite: { code: "ABCD2345", from: {} } })?.code).toBe("ABCD2345");
		expect(inviteFromAck({ code: "ABCD2345", from: {} })?.code).toBe("ABCD2345");
		expect(inviteFromAck({ code: "ABCD2345" })).toBeNull();
		expect(inviteFromAck(null)).toBeNull();
		expect(roomFromAck({ room: liveRoom() })?.roomId).toBe("0000aaaa-1111");
		expect(roomFromAck(liveRoom())?.rev).toBe(1);
		expect(roomFromAck({ roomId: "x" })).toBeNull();
	});
});
