// The socket layer against a real server on an ephemeral port: first-frame
// auth and its close codes, the gate, frame hygiene, acks, ping/pong, one
// socket per pig, rate limiting, heartbeats and idle cuts, plus the HTTP
// routes beside the socket.

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROTOCOL_VERSION } from "../../multiplayer/protocol";
import { CLOSE } from "../src/hub";
import { devToken, realDelay, startServer, TestClient, uid, type TestServer } from "./helpers";

let ts: TestServer | null = null;
afterEach(async () => {
	await ts?.close();
	ts = null;
});

describe("first-frame auth", () => {
	it("welcomes a pig with timing, catalog and resume state", async () => {
		ts = await startServer();
		const id = ts.pig(1, "Rosie");
		const client = await TestClient.connect(ts.url);
		client.send({ t: "auth", rid: 7, token: devToken(id), protocol: PROTOCOL_VERSION, client: { version: "1.0.0", platform: "ios" } });
		const welcome = await client.nextOf("welcome");
		assert.equal(welcome.userId, id);
		assert.equal(welcome.name, "Rosie");
		assert.equal(welcome.protocol, PROTOCOL_VERSION);
		assert.equal(welcome.timing.reconnectGraceMs, ts.server.config.timing.reconnectGraceMs);
		assert.deepEqual(
			welcome.catalog.map((c) => c.id).sort(),
			["fence_the_pen", "mud_volley", "out_looking", "rootle", "snout_says"],
		);
		assert.ok(welcome.catalog.every((c) => c.enabled));
		assert.deepEqual(welcome.resume, { queue: { state: "idle", games: [], pace: "live", since: null }, rooms: [], invites: [] });
		const ack = await client.nextOf("ack");
		assert.deepEqual(ack, { t: "ack", rid: 7, ok: true });
		client.close();
	});

	it("closes 4001 when no auth arrives in time, or another frame comes first", async () => {
		ts = await startServer();
		const silent = await TestClient.connect(ts.url);
		await ts.advance(ts.server.config.authTimeoutMs + 1);
		assert.equal((await silent.closed).code, CLOSE.authTimeout);

		const eager = await TestClient.connect(ts.url);
		eager.send({ t: "queue.leave" });
		assert.equal((await eager.closed).code, CLOSE.authTimeout);
	});

	it("holds a frame sent right behind auth and answers it after the welcome", async () => {
		ts = await startServer();
		const id = ts.pig(1);
		const client = await TestClient.connect(ts.url);
		client.send({ t: "auth", token: devToken(id), protocol: PROTOCOL_VERSION });
		client.send({ t: "queue.leave", rid: 9 });
		await client.nextOf("welcome");
		assert.equal((await client.nextOf("ack", (a) => a.rid === 9)).ok, true);
		client.close();
	});

	it("closes 4002 on a protocol mismatch and 4003 on a bad token", async () => {
		ts = await startServer();
		const old = await TestClient.connect(ts.url);
		old.send({ t: "auth", token: devToken(uid(1)), protocol: PROTOCOL_VERSION + 1 });
		assert.equal((await old.nextOf("error")).error, "protocol_mismatch");
		assert.equal((await old.closed).code, CLOSE.protocolMismatch);

		const forged = await TestClient.connect(ts.url);
		forged.send({ t: "auth", token: "not a dev token", protocol: PROTOCOL_VERSION });
		assert.equal((await forged.closed).code, CLOSE.badToken);
	});

	it("closes 4004 while the dark-launch gate is shut, and lets an overridden pig in", async () => {
		ts = await startServer({ config: { access: "flag" } });
		ts.store.setSettings({ multiplayerEnabled: false });
		await ts.server.settings.refresh();
		const outsider = ts.pig(1);
		const tester = ts.pig(2, "Tester", { featureOverrides: { multiplayer: true } });

		const shut = await TestClient.connect(ts.url);
		shut.send({ t: "auth", token: devToken(outsider), protocol: PROTOCOL_VERSION });
		assert.equal((await shut.closed).code, CLOSE.notAllowed);

		const inside = await TestClient.connect(ts.url);
		assert.equal((await inside.auth(devToken(tester))).userId, tester);
		inside.close();
	});
});

describe("frames", () => {
	it("answers bad JSON, unknown frames and oversized frames without dropping the socket", async () => {
		ts = await startServer();
		const client = await ts.connect(ts.pig(1));
		client.send("{not json");
		assert.equal((await client.nextOf("error")).error, "bad_request");

		const unknown = await client.request({ t: "dance" });
		assert.deepEqual([unknown.ok, !unknown.ok && unknown.error], [false, "bad_request"]);

		const disabledGame = await client.request({ t: "queue.join", games: ["chess"], pace: "live" });
		assert.equal(!disabledGame.ok && disabledGame.error, "bad_request");

		client.send({ t: "sync", pad: "x".repeat(9_000) });
		assert.equal((await client.nextOf("error")).error, "bad_request");

		const still = await client.request({ t: "queue.leave" });
		assert.equal(still.ok, true);
	});

	it("answers ping with pong and an ack", async () => {
		ts = await startServer();
		const client = await ts.connect(ts.pig(1));
		client.send({ t: "ping", rid: 3, ct: 12345 });
		const pong = await client.nextOf("pong");
		assert.equal(pong.ct, 12345);
		assert.equal(pong.st, ts.clock.now());
		assert.equal((await client.nextOf("ack", (a) => a.rid === 3)).ok, true);
	});

	it("refuses a second auth on a signed-in socket", async () => {
		ts = await startServer();
		const id = ts.pig(1);
		const client = await ts.connect(id);
		const again = await client.request({ t: "auth", token: devToken(id), protocol: PROTOCOL_VERSION });
		assert.equal(!again.ok && again.error, "bad_request");
	});
});

describe("one socket per pig", () => {
	it("supersedes the old socket with a notice and 4005; the new one carries on", async () => {
		ts = await startServer();
		const id = ts.pig(1);
		const first = await ts.connect(id);
		const second = await ts.connect(id);
		const notice = await first.nextOf("notice");
		assert.equal(notice.kind, "signed_in_elsewhere");
		assert.equal((await first.closed).code, CLOSE.superseded);
		assert.equal((await second.request({ t: "queue.leave" })).ok, true);
		assert.equal(ts.server.hub.isOnline(id), true);
	});
});

describe("rate limiting", () => {
	it("refuses past the burst with rate_limited, then closes 4008 on repeated abuse", async () => {
		ts = await startServer();
		const client = await ts.connect(ts.pig(1));
		for (let i = 0; i < 31; i++) client.send({ t: "queue.leave", rid: 100 + i });
		const limited = await client.nextOf("ack", (a) => !a.ok);
		assert.equal(!limited.ok && limited.error, "rate_limited");
		for (let i = 0; i < 40; i++) client.send({ t: "queue.leave" });
		assert.equal((await client.closed).code, CLOSE.abuse);
	});
});

describe("liveness", () => {
	it("terminates a socket that stops answering protocol pings", async () => {
		ts = await startServer({ config: { timing: { heartbeatMs: 25_000 } } });
		const id = ts.pig(1);
		const deaf = await TestClient.connect(ts.url, { autoPong: false });
		deaf.userId = id;
		await deaf.auth(devToken(id));
		const healthy = await ts.connect(ts.pig(2));
		await ts.advance(25_000); // ping
		await realDelay(30); // the healthy client's pong crosses the wire
		await ts.advance(25_000); // no pong from the deaf one: cut
		assert.equal((await deaf.closed).code, 1006);
		assert.equal(ts.server.hub.isOnline(uid(2)), true);
		healthy.close();
	});

	it("closes a signed-in socket that has sent nothing for idleTimeoutMs", async () => {
		ts = await startServer({ config: { timing: { idleTimeoutMs: 60_000 } } });
		const client = await ts.connect(ts.pig(1));
		await ts.advance(30_000);
		client.send({ t: "ping", ct: 1 });
		await client.nextOf("pong");
		await ts.advance(45_000);
		assert.equal(ts.server.hub.connections, 1, "a ping resets the idle clock");
		await ts.advance(30_000);
		assert.equal((await client.closed).code, CLOSE.idle);
	});
});

describe("http", () => {
	it("serves health, a hello, and a rate-limited public invite preview", async () => {
		ts = await startServer();
		const base = ts.server.httpUrl;
		const health = (await (await fetch(`${base}/healthz`)).json()) as Record<string, unknown>;
		assert.equal(health.ok, true);
		assert.equal(typeof health.uptime, "number");
		assert.equal(health.rooms, 0);
		assert.match(await (await fetch(`${base}/`)).text(), /play server/);

		assert.equal((await fetch(`${base}/v1/invites/ABCD2345`)).status, 404);
		assert.equal((await fetch(`${base}/v1/invites/nope`)).status, 404);
		let limited = 0;
		for (let i = 0; i < 25; i++) {
			const res = await fetch(`${base}/v1/invites/ABCD2345`, { headers: { "CF-Connecting-IP": "203.0.113.9" } });
			if (res.status === 429) limited++;
		}
		assert.ok(limited >= 4, "one address cannot sweep codes");
		const other = await fetch(`${base}/v1/invites/ABCD2345`, { headers: { "CF-Connecting-IP": "203.0.113.10" } });
		assert.equal(other.status, 404, "another address has its own bucket");
	});
});
