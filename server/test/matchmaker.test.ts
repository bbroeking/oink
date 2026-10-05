// Matchmaking: live pairing (blocks both ways, multi-game lists and the
// game-choice rule, busy pigs, the recent-opponent rule, the veteran and
// rating rules), party gathering, and play-by-push open seats.

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { nim, race } from "./fixtures/games";
import { playOut, startServer, type TestClient, type TestServer } from "./helpers";

let ts: TestServer | null = null;
afterEach(async () => {
	await ts?.close();
	ts = null;
});

async function queue(client: TestClient, games: string[], pace = "live") {
	const ack = await client.request({ t: "queue.join", games, pace });
	assert.equal(ack.ok, true, `queue.join refused: ${!ack.ok ? ack.error : ""}`);
	return ack;
}

describe("live pairing", () => {
	it("pairs two pigs, counts down, then plays", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["fence_the_pen"]);
		assert.equal((await a.nextOf("queue.state", (q) => q.queue.state === "searching")).queue.games[0], "fence_the_pen");
		await queue(b, ["fence_the_pen"]);
		const starting = await a.room((r) => r.phase === "starting");
		assert.equal(starting.source, "queue");
		assert.equal(starting.seats.length, 2);
		assert.ok(starting.seats.every((s) => s.connected));
		assert.ok(starting.startsAt !== null);
		await ts.advance(ts.server.config.timing.countdownMs);
		const playing = await b.room((r) => r.roomId === starting.roomId && r.phase === "playing");
		assert.deepEqual(playing.activeSeats, [0]);
		assert.equal(ts.server.matchmaker.waitingCount, 0);
		const ended = await playOut(nim, [a, b], starting.roomId, ts);
		assert.equal(ended.result?.reason, "complete");
	});

	it("never pairs pigs with a block in either direction", async () => {
		ts = await startServer();
		const [p1, p2, p3] = [ts.pig(1), ts.pig(2), ts.pig(3)];
		ts.store.seedBlock(p1, p2);
		const a = await ts.connect(p1);
		const b = await ts.connect(p2);
		await queue(a, ["fence_the_pen"]);
		await queue(b, ["fence_the_pen"]);
		await ts.advance(30_000);
		assert.equal(ts.server.matchmaker.waitingCount, 2, "blocker and blocked both still waiting");
		// The other direction: p3 is blocked BY nobody but blocks p1.
		ts.store.seedBlock(p3, p1);
		const c = await ts.connect(p3);
		await queue(c, ["fence_the_pen"]);
		const room = await c.room((r) => r.phase === "starting");
		assert.deepEqual(room.seats.map((s) => s.userId).sort(), [p2, p3].sort());
	});

	it("chooses the first game in the waiting pig's list that the newcomer also listed", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["rootle", "fence_the_pen"]);
		await queue(b, ["fence_the_pen", "rootle"]);
		const room = await b.room(() => true);
		assert.equal(room.game, "rootle");
	});

	it("keeps pigs with no game in common apart", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["mud_volley"]);
		await queue(b, ["fence_the_pen"]);
		await ts.advance(15_000);
		assert.equal(ts.server.matchmaker.waitingCount, 2);
	});

	it("refuses a pig already at a live table, and leaves the queue on request or disconnect", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["fence_the_pen"]);
		await queue(b, ["fence_the_pen"]);
		await a.room((r) => r.phase === "starting");
		const busy = await a.request({ t: "queue.join", games: ["mud_volley"], pace: "live" });
		assert.equal(!busy.ok && busy.error, "busy");

		const c = await ts.connect(ts.pig(3));
		await queue(c, ["mud_volley"]);
		assert.equal(ts.server.matchmaker.waitingCount, 1);
		await c.request({ t: "queue.leave" });
		assert.equal((await c.nextOf("queue.state", (q) => q.queue.state === "idle")).queue.since, null);
		await queue(c, ["mud_volley"]);
		c.terminate();
		await ts.waitOffline(c.userId as string);
		assert.equal(ts.server.matchmaker.waitingCount, 0, "a dropped socket leaves the queue");
	});

	it("does not re-pair the last opponent inside three minutes until both have waited 20 s", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["fence_the_pen"]);
		await queue(b, ["fence_the_pen"]);
		const first = await a.room((r) => r.phase === "starting");
		await ts.advance(ts.server.config.timing.countdownMs);
		await playOut(nim, [a, b], first.roomId, ts);

		await queue(a, ["fence_the_pen"]);
		await queue(b, ["fence_the_pen"]);
		await ts.advance(10_000);
		assert.equal(ts.server.matchmaker.waitingCount, 2, "just played each other");
		await ts.advance(11_000);
		const second = await a.room((r) => r.roomId !== first.roomId && r.phase === "starting");
		assert.notEqual(second.roomId, first.roomId);
	});

	it("prefers the closest rating among fresh waiters, but a ten-second waiter always wins", async () => {
		ts = await startServer();
		const [low, high, mid, close, newcomer] = [ts.pig(1), ts.pig(2), ts.pig(3), ts.pig(4), ts.pig(5)];
		for (const [id, r] of [[low, 900], [high, 1500], [mid, 1480], [close, 1490], [newcomer, 1490]] as const) {
			ts.store.setRating(id, "fence_the_pen", r);
		}
		// Blocks keep the waiters from pairing with each other.
		ts.store.seedBlock(low, high).seedBlock(close, low);
		const l = await ts.connect(low);
		const h = await ts.connect(high);
		await queue(l, ["fence_the_pen"]);
		await ts.advance(1_000);
		await queue(h, ["fence_the_pen"]);
		const m = await ts.connect(mid);
		await queue(m, ["fence_the_pen"]);
		const room = await m.room(() => true);
		assert.deepEqual(room.seats.map((s) => s.userId).sort(), [high, mid].sort(), "closest rating among fresh waiters");

		// `low` has now waited past ten seconds; `close` has the closer rating
		// but only just arrived. The veteran is next.
		await ts.advance(10_000);
		const c = await ts.connect(close);
		await queue(c, ["fence_the_pen"]);
		const n = await ts.connect(newcomer);
		await queue(n, ["fence_the_pen"]);
		const vroom = await n.room(() => true);
		assert.deepEqual(vroom.seats.map((s) => s.userId).sort(), [low, newcomer].sort());
		assert.equal(ts.server.matchmaker.waitingCount, 1, "close keeps waiting");
	});
});

describe("party tables", () => {
	it("gathers for PARTY_GATHER_MS, pulls in a third pig, then drops the open chair", async () => {
		ts = await startServer({ config: { partyGatherMs: 6_000 } });
		const a = await ts.connect(ts.pig(1));
		const b = await ts.connect(ts.pig(2));
		await queue(a, ["rootle"]);
		await queue(b, ["rootle"]);
		const lobby = await a.room((r) => r.phase === "lobby");
		assert.equal(lobby.seatCount, 4);
		assert.equal(lobby.seats.length, 2);
		const c = await ts.connect(ts.pig(3));
		await queue(c, ["fence_the_pen", "rootle"]);
		await c.room((r) => r.roomId === lobby.roomId && r.seats.length === 3);
		await ts.advance(6_000);
		const starting = await a.room((r) => r.roomId === lobby.roomId && r.phase === "starting");
		assert.equal(starting.seatCount, 3);
		await ts.advance(ts.server.config.timing.countdownMs);
		const ended = await playOut(race, [a, b, c], lobby.roomId, ts);
		assert.equal(ended.result?.reason, "complete");
	});

	it("sets off at once when every chair fills", async () => {
		ts = await startServer({ config: { partyGatherMs: 60_000 } });
		const clients = [await ts.connect(ts.pig(1)), await ts.connect(ts.pig(2)), await ts.connect(ts.pig(3)), await ts.connect(ts.pig(4))];
		for (const c of clients) await queue(c, ["rootle"]);
		const starting = await clients[0].room((r) => r.phase === "starting");
		assert.equal(starting.seatCount, 4);
	});
});

describe("play by post", () => {
	it("opens a table at once, then fills the open chair with the next pig", async () => {
		ts = await startServer();
		const [p1, p2] = [ts.pig(1, "Rosie"), ts.pig(2, "Bramble")];
		const a = await ts.connect(p1);
		const ack = await queue(a, ["fence_the_pen"], "async");
		const roomId = (ack.ok && (ack.data as { roomId: string }).roomId) as string;
		const open = await a.room((r) => r.roomId === roomId && r.phase === "playing");
		assert.equal(open.seatCount, 2);
		assert.equal(open.seats.length, 1);
		assert.deepEqual(open.activeSeats, [0], "the first pig can move straight away");
		assert.equal(open.deadline !== null, true);
		assert.equal((await a.request({ t: "room.action", roomId, rev: open.rev, action: { type: "take", n: 1 } })).ok, true);
		await a.room((r) => r.roomId === roomId && r.activeSeats[0] === 1 && r.deadline === null);
		a.close();
		await ts.waitOffline(p1);

		const b = await ts.connect(p2);
		const ackB = await queue(b, ["fence_the_pen"], "async");
		assert.equal(ackB.ok && (ackB.data as { roomId: string }).roomId, roomId);
		const full = await b.room((r) => r.roomId === roomId && r.seats.length === 2);
		assert.equal(full.you, 1);
		assert.ok(full.deadline !== null, "the clock starts once the chair is filled");
		await ts.settle();
		const seatPush = ts.push.to(p1);
		assert.equal(seatPush.length, 1);
		assert.equal(seatPush[0].title, "A pig took your seat");
		assert.equal(seatPush[0].body, "Nim · your table is ready");
		assert.deepEqual(seatPush[0].data, { screen: "play", room: roomId, foreground: "alert" });

		// Bramble moves; Rosie (away) owes the next move: a "Your move" push
		// would follow, but the seat push just went out, so it waits.
		const snap = b.latest(roomId)!;
		assert.equal((await b.request({ t: "room.action", roomId, rev: snap.rev, action: { type: "take", n: 1 } })).ok, true);
		await ts.settle();
		assert.equal(ts.push.to(p1).length, 1, "no second buzz inside ten minutes");
	});

	it("nudges a pig who is in the app but not at that table; a pig at the table hears it there", async () => {
		ts = await startServer();
		const [p1, p2] = [ts.pig(1), ts.pig(2)];
		const a = await ts.connect(p1);
		const ack = await queue(a, ["fence_the_pen"], "async");
		const roomId = (ack.ok && (ack.data as { roomId: string }).roomId) as string;
		const open = await a.room((r) => r.roomId === roomId);
		await a.request({ t: "room.action", roomId, rev: open.rev, action: { type: "take", n: 1 } });
		a.close();
		await ts.waitOffline(p1);
		// Back in the app, but this table is not open (play-by-post tables
		// re-attach only on room.join).
		const a2 = await ts.connect(p1);
		const b = await ts.connect(p2);
		await queue(b, ["fence_the_pen"], "async");
		await ts.settle();
		assert.equal(ts.push.to(p1).length, 1, "seat taken: pushed although the pig has a socket");
		assert.ok(a2.latest(roomId), "and the snapshot reached the app too");

		assert.equal((await a2.request({ t: "room.join", roomId })).ok, true);
		const full = await b.room((r) => r.roomId === roomId && r.seats.every((s) => s.connected));
		await ts.advance(11 * 60_000); // past the ten-minute gap, so only presence can hold a push back
		await b.request({ t: "room.action", roomId, rev: full.rev, action: { type: "take", n: 1 } });
		const next = await a2.room((r) => r.roomId === roomId && r.you !== null && r.activeSeats.includes(r.you));
		assert.ok(next);
		await ts.settle();
		assert.equal(ts.push.to(p1).length, 1, "no push for a pig sitting at the table");
	});

	it("calls an unfilled open seat off as a no contest after the TTL", async () => {
		ts = await startServer({ config: { asyncOpenSeatTtlMs: 72 * 3_600_000 } });
		const a = await ts.connect(ts.pig(1));
		const ack = await queue(a, ["fence_the_pen"], "async");
		const roomId = (ack.ok && (ack.data as { roomId: string }).roomId) as string;
		await ts.advance(72 * 3_600_000 + 1);
		const ended = await a.room((r) => r.roomId === roomId && r.phase === "ended");
		assert.equal(ended.result?.kind, "no_contest");
		assert.equal(ts.store.allResults().length, 0, "a table nobody joined records nothing");
	});

	it("caps a pig at ten unfinished tables by post", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		for (let i = 0; i < 10; i++) await queue(a, ["fence_the_pen"], "async");
		const eleventh = await a.request({ t: "queue.join", games: ["fence_the_pen"], pace: "async" });
		assert.equal(!eleventh.ok && eleventh.error, "busy");
	});

	it("refuses a game that does not support the pace", async () => {
		ts = await startServer();
		const a = await ts.connect(ts.pig(1));
		const res = await a.request({ t: "queue.join", games: ["mud_volley"], pace: "async" });
		assert.equal(!res.ok && res.error, "game_unavailable");
	});
});
