// Tables: the decision clock, reconnect grace (back in time vs. gone),
// leaving, emotes, rematch, the tick clock, persistence and rehydrate after a
// restart, results recorded exactly once, hidden ratings, and secrecy.

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { RoomSnapshot } from "../../multiplayer/protocol";
import type { RoomState } from "../../multiplayer/engine";
import { ManualClock } from "../src/clock";
import { outcomeFor, ratedPair, resultRows } from "../src/results";
import { MemoryStore } from "../src/store/memory";
import { periodOf } from "../src/store/types";
import { beat, dig, nim, race, sealed } from "./fixtures/games";
import { playOut, startServer, type TestClient, type TestServer } from "./helpers";

let ts: TestServer | null = null;
afterEach(async () => {
	await ts?.close();
	ts = null;
});

/** Two pigs paired through the queue, past the countdown. */
async function liveTable(server: TestServer, game: string, a = 1, b = 2): Promise<{ x: TestClient; y: TestClient; room: RoomSnapshot }> {
	const x = await server.connect(server.pig(a));
	const y = await server.connect(server.pig(b));
	await x.request({ t: "queue.join", games: [game], pace: "live" });
	await y.request({ t: "queue.join", games: [game], pace: "live" });
	// A party game gathers first; nobody else comes, so it sets off with two.
	const first = await x.room(() => true);
	if (first.phase === "lobby") await server.advance(server.server.config.partyGatherMs);
	const starting = await x.room((r) => r.phase === "starting");
	await server.advance(server.server.config.timing.countdownMs);
	const room = await x.room((r) => r.roomId === starting.roomId && r.phase === "playing");
	await y.room((r) => r.roomId === starting.roomId && r.phase === "playing");
	return { x, y, room };
}

/** The client holding a given seat. */
const holder = (clients: TestClient[], room: RoomSnapshot, seat: number) =>
	clients.find((c) => c.userId === room.seats[seat].userId) as TestClient;

describe("the decision clock", () => {
	it("resolves a missed deadline with the game's default and re-arms for the next seat", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		assert.equal(room.deadline, ts.clock.now() + nim.decisionMs.live);
		await ts.advance(nim.decisionMs.live);
		const after = await x.room((r) => r.roomId === room.roomId && r.rev > room.rev);
		assert.deepEqual(after.activeSeats, [1]);
		assert.ok(after.events.some((e) => e.type === "timeout" && e.seat === 0));
		assert.equal(after.deadline, ts.clock.now() + nim.decisionMs.live);
		void y;
	});

	it("does not move early when the client's rev is stale: the engine judges the move", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		const mover = holder([x, y], room, 0);
		const ok = await mover.request({ t: "room.action", roomId: room.roomId, rev: 0, action: { type: "take", n: 1 } });
		assert.equal(ok.ok, true, "a stale rev is informational");
		const again = await mover.request({ t: "room.action", roomId: room.roomId, rev: 999, action: { type: "take", n: 1 } });
		assert.equal(!again.ok && again.error, "not_your_turn");
		const bad = await holder([x, y], room, 1).request({ t: "room.action", roomId: room.roomId, rev: 1, action: { type: "take", n: 7 } });
		assert.equal(!bad.ok && bad.error, "bad_action");
	});
});

describe("reconnect grace", () => {
	it("holds the chair while a pig is away, and gives it back when they return in time", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		const yId = y.userId as string;
		y.terminate();
		const away = await x.room((r) => r.roomId === room.roomId && r.seats.some((s) => s.userId === yId && !s.connected));
		assert.equal(away.phase, "playing");
		await ts.advance(ts.server.config.timing.reconnectGraceMs - 1_000);
		const back = await ts.connect(yId);
		const resumed = await back.room((r) => r.roomId === room.roomId && r.seats.every((s) => s.connected));
		assert.equal(resumed.phase, "playing", "auto re-attached on sign-in, no room.join needed");
		await ts.advance(5_000);
		const after = await x.room((r) => r.roomId === room.roomId && r.seats.every((s) => s.connected));
		assert.equal(after.phase, "playing", "the lapsed grace timer was cancelled");
		const ended = await playOut(nim, [x, back], room.roomId, ts);
		assert.equal(ended.result?.reason, "complete");
	});

	it("calls the table for the pig who stayed once the grace lapses", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		const yId = y.userId as string;
		const ySeat = room.seats.find((s) => s.userId === yId)?.seat as number;
		y.terminate();
		await ts.waitOffline(yId);
		await ts.advance(ts.server.config.timing.reconnectGraceMs);
		const ended = await x.room((r) => r.roomId === room.roomId && r.phase === "ended");
		assert.equal(ended.result?.reason, "forfeit");
		assert.deepEqual(ended.result?.winners, [1 - ySeat]);
		assert.equal(ended.seats[ySeat].gone, true);
		await ts.settle();
		const rows = ts.store.allResults().filter((r) => r.matchId === room.roomId);
		assert.deepEqual(rows.map((r) => [r.userId === yId ? "y" : "x", r.outcome, r.reason]).sort(), [
			["x", "win", "forfeit"],
			["y", "loss", "forfeit"],
		]);
		assert.equal(ts.store.ratingOf(x.userId as string, "fence_the_pen")?.rating, 1012);
		assert.equal(ts.store.ratingOf(yId, "fence_the_pen")?.rating, 988);
	});

	it("ends a co-op table early when it drops below its minimum", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "snout_says");
		y.terminate();
		await ts.waitOffline(y.userId as string);
		await ts.advance(ts.server.config.timing.reconnectGraceMs);
		const ended = await x.room((r) => r.roomId === room.roomId && r.phase === "ended");
		assert.deepEqual([ended.result?.kind, ended.result?.reason], ["no_contest", "ended_early"]);
		void dig;
	});
});

describe("leaving, emotes", () => {
	it("treats Leave at a live table as a resignation and tells the leaver room.gone", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		assert.equal((await y.request({ t: "room.leave", roomId: room.roomId })).ok, true);
		assert.equal((await y.nextOf("room.gone")).reason, "left");
		const ended = await x.room((r) => r.roomId === room.roomId && r.phase === "ended");
		assert.equal(ended.result?.reason, "forfeit");
	});

	it("broadcasts emotes to the table with a cooldown", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		assert.equal((await x.request({ t: "room.emote", roomId: room.roomId, emote: "giggle" })).ok, true);
		const seen = await y.nextOf("room.emote");
		assert.equal(seen.emote, "giggle");
		const tooSoon = await x.request({ t: "room.emote", roomId: room.roomId, emote: "oink" });
		assert.equal(!tooSoon.ok && tooSoon.error, "rate_limited");
		await ts.advance(ts.server.config.timing.emoteCooldownMs);
		assert.equal((await x.request({ t: "room.emote", roomId: room.roomId, emote: "oink" })).ok, true);
		const free = await y.request({ t: "room.emote", roomId: room.roomId, emote: "shout" });
		assert.equal(!free.ok && free.error, "bad_request", "no free text, ever");
	});
});

describe("rematch", () => {
	it("forms a new table with rotated seats once both pigs vote", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		await playOut(nim, [x, y], room.roomId, ts);
		const first = await x.request({ t: "room.rematch", roomId: room.roomId });
		assert.equal(first.ok, true);
		await y.room((r) => r.roomId === room.roomId && (r.rematch?.votes.length ?? 0) === 1);
		const second = await y.request({ t: "room.rematch", roomId: room.roomId });
		const nextId = (second.ok && (second.data as { roomId: string }).roomId) as string;
		assert.ok(nextId && nextId !== room.roomId);
		const next = await x.room((r) => r.roomId === nextId);
		assert.equal(next.source, "rematch");
		assert.equal(next.phase, "starting");
		assert.deepEqual(
			next.seats.map((s) => s.userId),
			[room.seats[1].userId, room.seats[0].userId],
			"whoever moved first moves second",
		);
		await ts.advance(ts.server.config.timing.countdownMs);
		const ended = await playOut(nim, [x, y], nextId, ts);
		assert.equal(ended.result?.reason, "complete");
	});
});

describe("the tick clock", () => {
	it("lets a reveal beat end on the server clock alone", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "out_looking");
		const reveal = (r: RoomSnapshot) => (r.view as { phase: string } | null)?.phase === "reveal";
		for (const c of [x, y]) {
			const snap = c.latest(room.roomId) as RoomSnapshot;
			await c.request({ t: "room.action", roomId: room.roomId, rev: snap.rev, action: { type: "pick", n: 2 } });
		}
		const revealing = await x.room((r) => r.roomId === room.roomId && reveal(r));
		assert.deepEqual(revealing.activeSeats, [], "nobody owes a decision during the beat");
		assert.equal(revealing.deadline, null);
		await ts.advance(500);
		const next = await x.room((r) => r.roomId === room.roomId && (r.view as { round: number }).round === 2);
		assert.deepEqual(next.activeSeats, [0, 1]);
		const ended = await playOut(beat, [x, y], room.roomId, ts);
		assert.equal(ended.result?.reason, "complete");
	});
});

describe("persistence", () => {
	it("survives a restart mid play-by-post game and plays on to the end", async () => {
		const store = new MemoryStore();
		const clock = new ManualClock();
		ts = await startServer({ store, clock });
		const [p1, p2] = [ts.pig(1), ts.pig(2)];
		const a = await ts.connect(p1);
		const ack = await a.request({ t: "queue.join", games: ["fence_the_pen"], pace: "async" });
		const roomId = (ack.ok && (ack.data as { roomId: string }).roomId) as string;
		const b = await ts.connect(p2);
		await b.request({ t: "queue.join", games: ["fence_the_pen"], pace: "async" });
		const snap = await a.room((r) => r.roomId === roomId && r.seats.length === 2);
		await a.request({ t: "room.action", roomId, rev: snap.rev, action: { type: "take", n: 2 } });
		await ts.settle();
		const before = store.peekMatch(roomId) as RoomState;
		assert.equal(before.rev, a.latest(roomId)?.rev, "play by post is written before anyone hears of it");
		await ts.close();

		ts = await startServer({ store, clock });
		assert.equal(ts.server.rooms.get(roomId)?.state.rev, before.rev, "rehydrated at boot");
		const a2 = await ts.connect(p1);
		const b2 = await ts.connect(p2);
		for (const c of [a2, b2]) assert.equal((await c.request({ t: "room.join", roomId })).ok, true);
		const resumed = await b2.room((r) => r.roomId === roomId);
		assert.equal(resumed.phase, "playing");
		const ended = await playOut(nim, [a2, b2], roomId, ts);
		assert.equal(ended.result?.reason, "complete");
	});

	it("resumes a live table inside the grace after a restart, and retires it after", async () => {
		const store = new MemoryStore();
		const clock = new ManualClock();
		ts = await startServer({ store, clock });
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		const [xId, yId] = [x.userId as string, y.userId as string];
		await ts.close(); // writes every table
		const stored = store.peekMatch(room.roomId) as RoomState;
		assert.equal(stored.phase, "playing");

		ts = await startServer({ store, clock });
		assert.equal(ts.server.rooms.get(room.roomId), undefined, "fresh live tables wait for a pig to rejoin");
		const x2 = await ts.connect(xId);
		assert.equal((await x2.request({ t: "room.join", roomId: room.roomId })).ok, true);
		const resumed = await x2.room((r) => r.roomId === room.roomId);
		assert.equal(resumed.phase, "playing");
		assert.ok(resumed.rev > stored.rev, "the revision jumps past anything a client could hold");
		const y2 = await ts.connect(yId);
		await y2.room((r) => r.roomId === room.roomId && r.seats.every((s) => s.connected));
		const ended = await playOut(nim, [x2, y2], room.roomId, ts);
		assert.equal(ended.result?.reason, "complete");

		// A second table, then a restart long after the grace: retired.
		const { room: other } = await liveTable(ts, "fence_the_pen", 3, 4);
		await ts.close();
		await clock.advance(ts.server.config.timing.reconnectGraceMs + nim.decisionMs.live + 60_000);
		ts = await startServer({ store, clock });
		const p3 = await ts.connect(other.seats[0].userId);
		await p3.request({ t: "room.join", roomId: other.roomId });
		const retired = await p3.room((r) => r.roomId === other.roomId && r.phase === "ended");
		assert.deepEqual([retired.result?.kind, retired.result?.reason], ["no_contest", "server"]);
	});

	it("records a table's result exactly once", async () => {
		ts = await startServer();
		const { x, y, room } = await liveTable(ts, "fence_the_pen");
		await playOut(nim, [x, y], room.roomId, ts);
		await x.request({ t: "room.rematch", roomId: room.roomId });
		await y.request({ t: "room.leave", roomId: room.roomId });
		await ts.settle();
		const rows = ts.store.allResults().filter((r) => r.matchId === room.roomId);
		assert.equal(rows.length, 2);
		assert.deepEqual(rows.map((r) => r.outcome).sort(), ["loss", "win"]);
		assert.equal(rows[0].period, periodOf(ts.clock.now()));
		assert.ok(rows.every((r) => r.opponents.length === 1 && r.reason === "complete"));
	});
});

describe("secrecy", () => {
	it("never sends a seat a snapshot carrying another seat's sealed pick", async () => {
		const leaks: string[] = [];
		let sent = 0;
		ts = await startServer({
			hooks: {
				onSnapshot(state, seat, snapshot) {
					sent++;
					if (state.game === null || !sealed.secretsOf) return;
					const text = JSON.stringify(snapshot);
					for (const marker of sealed.secretsOf(state.game as never, seat)) if (text.includes(marker)) leaks.push(marker);
					if (text.includes(state.seed)) leaks.push("seed");
				},
			},
		});
		const { x, y, room } = await liveTable(ts, "mud_volley");
		const first = holder([x, y], room, 0);
		const snap = first.latest(room.roomId) as RoomSnapshot;
		await first.request({ t: "room.action", roomId: room.roomId, rev: snap.rev, action: { type: "pick", n: 3 } });
		const theirs = await holder([x, y], room, 1).room((r) => r.roomId === room.roomId && (r.view as { theirsIn: boolean }).theirsIn);
		assert.equal((theirs.view as { mine: number | null }).mine, null);
		await playOut(sealed, [x, y], room.roomId, ts);
		assert.ok(sent > 6);
		assert.deepEqual(leaks, []);
	});
});

describe("result rows", () => {
	it("maps every kind of ending onto the board's outcomes", () => {
		const base = { winners: [] as number[], scores: [3, 1], summary: "", reason: "complete" as const };
		assert.equal(outcomeFor({ ...base, kind: "win", winners: [0] }, "competitive", 0), "win");
		assert.equal(outcomeFor({ ...base, kind: "win", winners: [0] }, "competitive", 1), "loss");
		assert.equal(outcomeFor({ ...base, kind: "draw" }, "competitive", 1), "draw", "empty winners: every seat drew");
		assert.equal(outcomeFor({ ...base, kind: "draw", winners: [0, 1] }, "competitive", 1), "draw", "sharing the top place");
		assert.equal(outcomeFor({ ...base, kind: "draw", winners: [0, 1] }, "competitive", 2), "loss", "below a shared first place");
		assert.equal(outcomeFor({ ...base, kind: "coop", success: true }, "cooperative", 0), "coop_success");
		assert.equal(outcomeFor({ ...base, kind: "coop", success: false }, "cooperative", 1), "coop_short");
		assert.equal(outcomeFor({ ...base, kind: "coop" }, "cooperative", 1), "coop_short", "success must be said");
		assert.equal(outcomeFor({ ...base, kind: "draw" }, "social", 0), "shared");
		assert.equal(outcomeFor({ ...base, kind: "coop", success: true }, "social", 0), "shared", "nobody wins a social game");
		assert.equal(outcomeFor({ ...base, kind: "no_contest", reason: "ended_early" }, "social", 0), "no_contest");
		assert.equal(outcomeFor({ ...base, kind: "no_contest", reason: "server" }, "competitive", 0), "no_contest");
	});

	it("rates two-seat competitive tables only, a draw as half", () => {
		const seats = [
			{ userId: "a", name: "A", look: {}, connected: true, gone: false, missed: 0 },
			{ userId: "b", name: "B", look: {}, connected: true, gone: false, missed: 0 },
		];
		const table = (result: object) => ({ seats, game: {}, result }) as unknown as RoomState;
		const base = { scores: [1, 1], summary: "" };
		assert.equal(ratedPair(table({ ...base, kind: "win", winners: [1], reason: "forfeit" }), nim)?.scoreA, 0);
		assert.equal(ratedPair(table({ ...base, kind: "draw", winners: [0, 1], reason: "complete" }), nim)?.scoreA, 0.5);
		assert.equal(ratedPair(table({ ...base, kind: "draw", winners: [0], reason: "complete" }), nim)?.scoreA, 0.5);
		assert.equal(ratedPair(table({ ...base, kind: "no_contest", winners: [], reason: "server" }), nim), null);
		assert.equal(ratedPair(table({ ...base, kind: "coop", winners: [0, 1], reason: "complete", success: true }), dig), null);
		assert.equal(ratedPair({ ...table({ ...base, kind: "win", winners: [0], reason: "complete" }), seats: [...seats, seats[0]] } as RoomState, race), null);
	});

	it("writes nothing for a table that never began", () => {
		const lobby = {
			roomId: "r",
			gameId: "fence_the_pen",
			seats: [{ userId: "a" }, { userId: "b" }],
			game: null,
			result: { kind: "no_contest", winners: [], scores: [], summary: "", reason: "ended_early" },
		} as unknown as RoomState;
		assert.deepEqual(resultRows(lobby, nim, Date.UTC(2026, 9, 4)), []);
		assert.equal(periodOf(Date.UTC(2026, 9, 31, 23, 59)), "2026-10");
	});
});
