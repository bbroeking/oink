// PlayClient against a fake socket and a hand-cranked clock: the auth
// handshake, terminal close codes, the backoff schedule, suspend/resume, the
// ping clock, and request/ack correlation.

import {
	PLAY_CLOSE,
	PlayClient,
	PlayRequestError,
	backoffDelay,
	clockSample,
	mergeTiming,
	smoothClock,
	type PlayClientDeps,
	type PlayConnectionState,
	type PlaySocket,
} from "../../utils/multiplayer/client";
import { DEFAULT_TIMING, PROTOCOL_VERSION, type ServerMessage } from "../../multiplayer/protocol";

// ── Fakes ────────────────────────────────────────────────────────────────────

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
		/** Run every task due within `ms`, in time order, moving the clock. */
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
		/** Move the clock without running timers (a frozen, suspended app). */
		jump(ms: number) {
			now += ms;
		},
		pending: () => tasks.size,
	};
}

class FakeSocket implements PlaySocket {
	static all: FakeSocket[] = [];
	readonly url: string;
	sent: Record<string, unknown>[] = [];
	closedWith: { code?: number; reason?: string } | null = null;
	onopen: ((event: unknown) => void) | null = null;
	onmessage: ((event: { data?: unknown }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onclose: ((event: { code?: number; reason?: string }) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		FakeSocket.all.push(this);
	}
	send(data: string) {
		this.sent.push(JSON.parse(data));
	}
	close(code?: number, reason?: string) {
		this.closedWith = { code, reason };
	}
	// Test drivers: the server side.
	open() {
		this.onopen?.({});
	}
	receive(message: unknown) {
		this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
	}
	drop(code: number) {
		this.onerror?.({});
		this.onclose?.({ code });
	}
	last(t: string) {
		return [...this.sent].reverse().find((m) => m.t === t);
	}
}

const latest = () => FakeSocket.all[FakeSocket.all.length - 1];
const flush = async () => {
	for (let i = 0; i < 6; i++) await Promise.resolve();
};

function welcome(overrides: Partial<Extract<ServerMessage, { t: "welcome" }>> = {}): Extract<ServerMessage, { t: "welcome" }> {
	return {
		t: "welcome",
		userId: "user-1",
		name: "Rosie",
		serverNow: 1_700_000_000_000,
		protocol: PROTOCOL_VERSION,
		timing: { ...DEFAULT_TIMING, heartbeatMs: 20_000 },
		catalog: [],
		resume: { queue: { state: "idle", games: [], pace: "live", since: null }, rooms: [], invites: [] },
		...overrides,
	};
}

function setup(overrides: Partial<PlayClientDeps> = {}) {
	FakeSocket.all = [];
	const clock = fakeClock();
	const getToken = jest.fn(async ({ refresh }: { refresh: boolean }) => (refresh ? "fresh-token" : "token-1"));
	const client = new PlayClient({
		url: () => "wss://play.test/ws",
		getToken,
		WebSocket: FakeSocket,
		now: clock.now,
		timers: clock.timers,
		random: () => 1,
		client: { version: "1.3", build: "200", platform: "ios" },
		...overrides,
	});
	const statuses: PlayConnectionState[] = [];
	const messages: ServerMessage[] = [];
	client.on("status", (s) => statuses.push(s));
	client.on("message", (m) => messages.push(m));
	return { client, clock, getToken, statuses, messages };
}

/** connect → socket → open → welcome. */
async function connected(overrides: Partial<PlayClientDeps> = {}) {
	const env = setup(overrides);
	env.client.connect();
	await flush();
	latest().open();
	latest().receive(welcome());
	return env;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

describe("backoffDelay", () => {
	it("doubles from 1 s to a 15 s cap, jittered into [ceiling/2, ceiling]", () => {
		expect([0, 1, 2, 3, 4, 5, 9].map((a) => backoffDelay(a, () => 1))).toEqual([1000, 2000, 4000, 8000, 15000, 15000, 15000]);
		expect([0, 1, 2, 3, 4].map((a) => backoffDelay(a, () => 0))).toEqual([500, 1000, 2000, 4000, 7500]);
		expect(backoffDelay(2, () => 0.5)).toBe(3000);
	});
});

describe("mergeTiming", () => {
	it("takes the server's live values field by field and keeps defaults for junk", () => {
		const t = mergeTiming({ heartbeatMs: 10_000, countdownMs: "soon", inviteTtlMs: { link: 5_000, crew: -1 } });
		expect(t.heartbeatMs).toBe(10_000);
		expect(t.countdownMs).toBe(DEFAULT_TIMING.countdownMs);
		expect(t.inviteTtlMs).toEqual({ ...DEFAULT_TIMING.inviteTtlMs, link: 5_000 });
		expect(mergeTiming(null)).toEqual(DEFAULT_TIMING);
	});
});

describe("clock math", () => {
	it("computes offset = st - (ct + rtt/2) and smooths toward quicker samples", () => {
		expect(clockSample(1_000, 6_050, 1_100)).toEqual({ offsetMs: 5_000, rttMs: 100 });
		expect(clockSample(1_000, 6_050, 900)).toBeNull(); // time ran backwards
		const first = smoothClock(null, { offsetMs: 5_000, rttMs: 100 });
		expect(first).toEqual({ offsetMs: 5_000, rttMs: 100 });
		// A quicker round trip moves the estimate half way, a slower one a quarter.
		expect(smoothClock(first, { offsetMs: 5_200, rttMs: 80 }).offsetMs).toBe(5_100);
		expect(smoothClock(first, { offsetMs: 5_400, rttMs: 300 }).offsetMs).toBe(5_100);
	});
});

// ── The handshake ────────────────────────────────────────────────────────────

describe("PlayClient auth", () => {
	it("sends auth as the first frame, then opens on welcome and stores the timing", async () => {
		const { client, statuses, messages } = setup();
		client.connect();
		expect(client.status).toBe("connecting");
		await flush();
		const socket = latest();
		expect(socket.url).toBe("wss://play.test/ws");
		expect(socket.url).not.toContain("token");
		socket.open();
		expect(socket.sent[0]).toEqual({
			t: "auth",
			token: "token-1",
			protocol: PROTOCOL_VERSION,
			client: { version: "1.3", build: "200", platform: "ios" },
		});
		socket.receive(welcome());
		expect(client.status).toBe("open");
		expect(client.timing.heartbeatMs).toBe(20_000);
		expect(messages.map((m) => m.t)).toEqual(["welcome"]);
		// The welcome lands in listeners before the status flips to open.
		expect(statuses.map((s) => s.status)).toEqual(["connecting", "open"]);
		// A first ping goes out at once to measure the clock.
		expect(socket.sent[1]).toMatchObject({ t: "ping" });
	});

	it("ignores unknown and malformed frames instead of throwing", async () => {
		const { messages } = await connected();
		expect(() => latest().receive({ t: "mystery", x: 1 })).not.toThrow();
		expect(() => latest().receive("{not json")).not.toThrow();
		expect(() => latest().receive({ nope: true })).not.toThrow();
		latest().receive({ t: "queue.state", queue: { state: "searching", games: ["mud_volley"], pace: "live", since: 5 } });
		expect(messages.map((m) => m.t)).toEqual(["welcome", "queue.state"]);
	});

	it("stops as signed out when there is no token", async () => {
		const { client } = setup({ getToken: async () => null });
		client.connect();
		await flush();
		expect(client.connection).toMatchObject({ status: "stopped", reason: "signed_out" });
		expect(FakeSocket.all).toHaveLength(0);
	});

	it("treats a welcome from another protocol version as terminal", async () => {
		const { client, clock } = setup();
		client.connect();
		await flush();
		latest().open();
		latest().receive(welcome({ protocol: PROTOCOL_VERSION + 1 }));
		expect(client.connection).toMatchObject({ status: "stopped", reason: "protocol_mismatch" });
		clock.advance(120_000);
		expect(FakeSocket.all).toHaveLength(1);
	});
});

// ── Close codes ──────────────────────────────────────────────────────────────

describe("PlayClient close codes", () => {
	it("never reconnects after 4002 (protocol mismatch) or 4004 (play switched off)", async () => {
		for (const [code, reason] of [
			[PLAY_CLOSE.PROTOCOL_MISMATCH, "protocol_mismatch"],
			[PLAY_CLOSE.DISABLED, "disabled"],
		] as const) {
			const { client, clock } = await connected();
			latest().drop(code);
			expect(client.connection).toMatchObject({ status: "stopped", reason });
			clock.advance(10 * 60_000);
			await flush();
			expect(FakeSocket.all).toHaveLength(1);
			// An explicit connect() is the way back.
			client.connect();
			await flush();
			expect(FakeSocket.all).toHaveLength(2);
		}
	});

	it("refreshes the token once on 4003 and retries at once; a second 4003 stops", async () => {
		const { client, getToken } = await connected();
		latest().drop(PLAY_CLOSE.BAD_TOKEN);
		await flush();
		expect(getToken).toHaveBeenLastCalledWith({ refresh: true });
		expect(FakeSocket.all).toHaveLength(2);
		latest().open();
		expect(latest().sent[0]).toMatchObject({ t: "auth", token: "fresh-token" });
		latest().drop(PLAY_CLOSE.BAD_TOKEN);
		await flush();
		expect(client.connection).toMatchObject({ status: "stopped", reason: "unauthorized" });
		expect(FakeSocket.all).toHaveLength(2);
	});

	it("earns a fresh token refresh after a successful welcome", async () => {
		const { client } = await connected();
		latest().drop(PLAY_CLOSE.BAD_TOKEN);
		await flush();
		latest().open();
		latest().receive(welcome());
		latest().drop(PLAY_CLOSE.BAD_TOKEN);
		await flush();
		expect(client.status).toBe("connecting");
		expect(FakeSocket.all).toHaveLength(3);
	});

	it("reconnects with backoff on transient codes (4001, 4005–4008, 1006)", async () => {
		for (const code of [PLAY_CLOSE.AUTH_TIMEOUT, 4005, 4006, 4007, 4008, 1006]) {
			const { client, clock } = await connected();
			latest().drop(code);
			expect(client.status).toBe("reconnecting");
			clock.advance(1_000);
			await flush();
			expect(FakeSocket.all).toHaveLength(2);
		}
	});
});

// ── Backoff ──────────────────────────────────────────────────────────────────

describe("PlayClient backoff", () => {
	it("waits 1, 2, 4, 8, 15, 15 s between failed attempts and resets after a welcome", async () => {
		const { client, clock } = setup();
		client.connect();
		await flush();
		const waits: number[] = [];
		for (let i = 0; i < 6; i++) {
			latest().drop(1006); // dies before the welcome
			expect(client.status).toBe("reconnecting");
			const wait = (client.connection.retryAt as number) - clock.now();
			waits.push(wait);
			clock.advance(wait - 1);
			await flush();
			expect(FakeSocket.all).toHaveLength(i + 1); // not yet
			clock.advance(1);
			await flush();
			expect(FakeSocket.all).toHaveLength(i + 2);
		}
		expect(waits).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
		latest().open();
		latest().receive(welcome());
		expect(client.connection.attempt).toBe(0);
		latest().drop(1006);
		expect((client.connection.retryAt as number) - clock.now()).toBe(1000);
	});

	it("abandons an attempt with no welcome inside the connect budget", async () => {
		const { client, clock } = setup({ connectTimeoutMs: 10_000 });
		client.connect();
		await flush();
		latest().open(); // auth sent, server silent
		clock.advance(10_000);
		expect(latest().closedWith).toMatchObject({ code: 4000 });
		expect(client.status).toBe("reconnecting");
	});
});

// ── Background ───────────────────────────────────────────────────────────────

describe("PlayClient suspend/resume", () => {
	it("closes on suspend, stays down in the background, and redials at once on resume", async () => {
		const { client, clock } = await connected();
		const first = latest();
		client.suspend();
		expect(first.closedWith).toMatchObject({ code: 1000 });
		expect(client.status).toBe("suspended");
		clock.advance(10 * 60_000);
		await flush();
		expect(FakeSocket.all).toHaveLength(1);
		// Late events from the dead socket are ignored.
		first.drop(1006);
		expect(client.status).toBe("suspended");

		client.resume();
		expect(client.status).toBe("connecting");
		await flush();
		expect(FakeSocket.all).toHaveLength(2);
		latest().open();
		latest().receive(welcome());
		expect(client.status).toBe("open");
	});

	it("skips the backoff wait when the app comes back mid-retry", async () => {
		const { client } = await connected();
		latest().drop(1006);
		latest().drop(1006); // ignored: already dropped
		expect(client.status).toBe("reconnecting");
		client.resume();
		await flush();
		expect(FakeSocket.all).toHaveLength(2);
	});

	it("stops after a signed-in-elsewhere notice instead of fighting the other device; resume takes it back", async () => {
		const { client, clock, messages } = await connected();
		latest().receive({ t: "notice", kind: "signed_in_elsewhere", message: "elsewhere" });
		expect(messages.map((m) => m.t)).toContain("notice");
		latest().drop(4005);
		expect(client.connection).toMatchObject({ status: "stopped", reason: "signed_in_elsewhere" });
		clock.advance(60_000);
		await flush();
		expect(FakeSocket.all).toHaveLength(1);
		client.resume();
		await flush();
		expect(FakeSocket.all).toHaveLength(2);
	});

	it("replaces a socket that went silent through a background stint", async () => {
		const { client, clock } = await connected();
		const ping = latest().last("ping") as { ct: number };
		latest().receive({ t: "pong", ct: ping.ct, st: ping.ct });
		const first = latest();
		// The OS froze the app (no timers ran) for longer than a heartbeat and
		// no background event reached us: the socket claims to be open.
		clock.jump(30_000);
		client.resume();
		expect(first.closedWith).toMatchObject({ code: 1000 });
		await flush();
		expect(FakeSocket.all).toHaveLength(2);
	});

	it("proves a recently busy socket with a ping instead of redialing", async () => {
		const { client, clock } = await connected();
		const ping = latest().last("ping") as { ct: number };
		latest().receive({ t: "pong", ct: ping.ct, st: ping.ct });
		clock.jump(1_000);
		const pings = latest().sent.filter((m) => m.t === "ping").length;
		client.resume();
		expect(FakeSocket.all).toHaveLength(1);
		expect(latest().sent.filter((m) => m.t === "ping").length).toBe(pings + 1);
	});
});

// ── Heartbeat + clock ───────────────────────────────────────────────────────

describe("PlayClient heartbeat", () => {
	it("measures the server clock from ping/pong and pings every heartbeat", async () => {
		const { client, clock } = await connected();
		const socket = latest();
		const first = socket.last("ping") as { ct: number };
		expect(first.ct).toBe(clock.now());
		clock.advance(100);
		socket.receive({ t: "pong", ct: first.ct, st: first.ct + 5_050 });
		expect(client.clockOffsetMs).toBe(5_000);
		expect(client.rttMs).toBe(100);
		expect(client.serverNow()).toBe(clock.now() + 5_000);

		const pings = () => socket.sent.filter((m) => m.t === "ping").length;
		const before = pings();
		clock.advance(19_900); // heartbeatMs from the welcome = 20 s after the welcome
		expect(pings()).toBe(before + 1);
	});

	it("estimates the clock from the welcome, then lets the first pong replace it outright", async () => {
		const { client, clock } = setup();
		client.connect();
		await flush();
		latest().open(); // auth sent now
		clock.jump(200); // the server checked the token for a while
		latest().receive(welcome({ serverNow: clock.now() - 200 + 3_100 }));
		expect(client.clockOffsetMs).toBe(3_000); // serverNow - (authSentAt + rtt/2)
		const ping = latest().last("ping") as { ct: number };
		clock.advance(60);
		latest().receive({ t: "pong", ct: ping.ct, st: ping.ct + 2_530 });
		expect(client.clockOffsetMs).toBe(2_500);
		expect(client.rttMs).toBe(60);
	});

	it("emits clock samples to listeners", async () => {
		const { client, clock } = await connected();
		const samples: { offsetMs: number; rttMs: number }[] = [];
		client.on("clock", (c) => samples.push(c));
		const ping = latest().last("ping") as { ct: number };
		clock.advance(40);
		latest().receive({ t: "pong", ct: ping.ct, st: ping.ct + 20 });
		expect(samples).toEqual([{ offsetMs: 0, rttMs: 40 }]);
	});

	it("replaces the socket when a ping goes unanswered", async () => {
		const { client, clock } = await connected({ requestTimeoutMs: 8_000 });
		const socket = latest();
		clock.advance(8_000); // the welcome's ping never got its pong
		expect(socket.closedWith).toMatchObject({ code: 4000 });
		expect(client.status).toBe("reconnecting");
	});
});

// ── Requests ─────────────────────────────────────────────────────────────────

describe("PlayClient requests", () => {
	it("correlates acks by rid, in any order", async () => {
		const { client } = await connected();
		const a = client.request({ t: "queue.join", games: ["mud_volley"], pace: "live" });
		const b = client.request({ t: "invite.preview", code: "ABCD2345" });
		const sentA = latest().last("queue.join") as { rid: number };
		const sentB = latest().last("invite.preview") as { rid: number };
		expect(sentA.rid).not.toBe(sentB.rid);
		latest().receive({ t: "ack", rid: sentB.rid, ok: true, data: { invite: "x" } });
		latest().receive({ t: "ack", rid: sentA.rid, ok: false, error: "rate_limited", message: "slow down" });
		await expect(b).resolves.toEqual({ invite: "x" });
		await expect(a).rejects.toMatchObject({ code: "rate_limited", serverMessage: "slow down" });
		await expect(a).rejects.toBeInstanceOf(PlayRequestError);
	});

	it("times out after the request timeout with a typed error", async () => {
		const { client, clock } = await connected({ requestTimeoutMs: 8_000 });
		const pending = client.request({ t: "queue.leave" });
		// Keep the socket alive: answer its ping.
		const ping = latest().last("ping") as { ct: number };
		latest().receive({ t: "pong", ct: ping.ct, st: ping.ct });
		clock.advance(7_999);
		let settled = false;
		pending.then(
			() => (settled = true),
			() => (settled = true),
		);
		await flush();
		expect(settled).toBe(false);
		clock.advance(1);
		await expect(pending).rejects.toMatchObject({ code: "timeout" });
		// A late ack for it is ignored.
		const sent = latest().last("queue.leave") as { rid: number };
		expect(() => latest().receive({ t: "ack", rid: sent.rid, ok: true })).not.toThrow();
	});

	it("refuses to queue a request while offline", async () => {
		const { client } = setup();
		await expect(client.request({ t: "queue.leave" })).rejects.toMatchObject({ code: "offline" });
		client.connect();
		await expect(client.request({ t: "queue.leave" })).rejects.toMatchObject({ code: "offline" });
	});

	it("fails in-flight requests with 'disconnected' when the socket drops", async () => {
		const { client } = await connected();
		const pending = client.request({ t: "room.join", roomId: "0000aaaa-1111" });
		latest().drop(1006);
		await expect(pending).rejects.toMatchObject({ code: "disconnected" });
	});

	it("sends fire-and-forget frames only while open", async () => {
		const { client } = setup();
		expect(client.send({ t: "room.emote", roomId: "0000aaaa-1111", emote: "oink" })).toBe(false);
		const env = await connected();
		expect(env.client.send({ t: "room.emote", roomId: "0000aaaa-1111", emote: "oink" })).toBe(true);
		expect(latest().last("room.emote")).toEqual({ t: "room.emote", roomId: "0000aaaa-1111", emote: "oink" });
	});

	it("close() fails pending requests and goes idle without reconnecting", async () => {
		const { client, clock } = await connected();
		const pending = client.request({ t: "queue.leave" });
		client.close();
		await expect(pending).rejects.toMatchObject({ code: "disconnected" });
		expect(client.status).toBe("idle");
		clock.advance(60_000);
		await flush();
		expect(FakeSocket.all).toHaveLength(1);
	});
});
