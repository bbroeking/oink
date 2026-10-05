// Expo pushes: batching, the fields Expo needs, ticket and receipt errors,
// retries, malformed tokens, log mode, and the notifier's token lookup.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ManualClock, nextTurn } from "../src/clock";
import { createLogger, type Logger } from "../src/log";
import { EXPO_RECEIPTS_URL, EXPO_SEND_URL, ExpoPushSender, LogPushSender, Notifier, type PushMessage } from "../src/push";
import { MemoryStore } from "../src/store/memory";
import { Tasks } from "../src/tasks";

function capture(): { log: Logger; lines: Record<string, unknown>[] } {
	const lines: Record<string, unknown>[] = [];
	return { log: createLogger({ level: "debug", sink: (line) => lines.push(JSON.parse(line)) }), lines };
}

interface Call {
	url: string;
	headers: Record<string, string>;
	body: unknown;
}

function fakeExpo(respond: (call: Call, n: number) => Response): { fetch: typeof fetch; calls: Call[] } {
	const calls: Call[] = [];
	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		const call = { url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) };
		calls.push(call);
		return respond(call, calls.length);
	}) as typeof fetch;
	return { fetch: fetchImpl, calls };
}

const msg = (i: number): PushMessage => ({
	to: `ExponentPushToken[device-${i}]`,
	title: "Your move",
	body: "Nim · tap to play",
	data: { screen: "play", room: "r1", foreground: "alert" },
	sound: "default",
	priority: "high",
	ttl: 900,
	threadId: "play",
	collapseId: "room_r1",
});

const okTickets = (call: Call) =>
	new Response(JSON.stringify({ data: (call.body as unknown[]).map((_, i) => ({ status: "ok", id: `ticket-${i}` })) }), { status: 200 });

describe("Expo push sender", () => {
	it("sends in batches of at most 100 with the access token and every field intact", async () => {
		const { log } = capture();
		const clock = new ManualClock();
		const expo = fakeExpo(okTickets);
		const sender = new ExpoPushSender({ accessToken: "expo-token", fetch: expo.fetch, clock, log, tasks: new Tasks(log), retryDelaysMs: [] });
		await sender.send(Array.from({ length: 250 }, (_, i) => msg(i)));
		assert.deepEqual(expo.calls.map((c) => (c.body as unknown[]).length), [100, 100, 50]);
		assert.ok(expo.calls.every((c) => c.url === EXPO_SEND_URL));
		assert.equal(expo.calls[0].headers.Authorization, "Bearer expo-token");
		assert.equal(expo.calls[0].headers["Content-Type"], "application/json");
		assert.deepEqual((expo.calls[0].body as PushMessage[])[0], msg(0));
		sender.stop();
	});

	it("sends no Authorization header without a token, and skips malformed tokens", async () => {
		const { log, lines } = capture();
		const expo = fakeExpo(okTickets);
		const sender = new ExpoPushSender({ fetch: expo.fetch, clock: new ManualClock(), log, tasks: new Tasks(log), retryDelaysMs: [] });
		await sender.send([msg(1), { ...msg(2), to: "not-a-token" }]);
		assert.equal(expo.calls[0].headers.Authorization, undefined);
		assert.equal((expo.calls[0].body as unknown[]).length, 1);
		assert.ok(lines.some((l) => l.msg === "skipped pushes to malformed tokens"));
		sender.stop();
	});

	it("logs ticket errors, never throws, and checks receipts about 15 minutes later", async () => {
		const { log, lines } = capture();
		const clock = new ManualClock();
		const tasks = new Tasks(log);
		const expo = fakeExpo((call) => {
			if (call.url === EXPO_RECEIPTS_URL) {
				return new Response(
					JSON.stringify({ data: { "ticket-0": { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } } }),
				);
			}
			return new Response(
				JSON.stringify({
					data: [
						{ status: "ok", id: "ticket-0" },
						{ status: "error", message: "bad", details: { error: "InvalidCredentials" } },
					],
				}),
			);
		});
		const sender = new ExpoPushSender({ fetch: expo.fetch, clock, log, tasks, retryDelaysMs: [] });
		await sender.send([msg(1), msg(2)]);
		assert.ok(lines.some((l) => l.msg === "push ticket error" && l.error === "InvalidCredentials"));
		await clock.advance(14 * 60_000);
		assert.equal(expo.calls.filter((c) => c.url === EXPO_RECEIPTS_URL).length, 0);
		await clock.advance(60_000);
		await tasks.settled();
		const receipts = expo.calls.filter((c) => c.url === EXPO_RECEIPTS_URL);
		assert.equal(receipts.length, 1);
		assert.deepEqual(receipts[0].body, { ids: ["ticket-0"] });
		assert.ok(lines.some((l) => l.msg === "push token no longer registered"));
		assert.ok(!JSON.stringify(lines).includes("device-1]"), "tokens are never logged whole");
		sender.stop();
	});

	it("retries a 5xx, then gives up quietly", async () => {
		const { log, lines } = capture();
		const clock = new ManualClock();
		const expo = fakeExpo((call, n) => (n === 1 ? new Response("busy", { status: 503 }) : okTickets(call)));
		const sender = new ExpoPushSender({ fetch: expo.fetch, clock, log, tasks: new Tasks(log), retryDelaysMs: [1_000] });
		const sending = sender.send([msg(1)]);
		// The backoff is armed only once the 503 has come back.
		while (clock.pending === 0) await nextTurn();
		await clock.advance(1_000);
		await sending;
		assert.equal(expo.calls.length, 2);

		const down = fakeExpo(() => new Response("down", { status: 500 }));
		const giveUp = new ExpoPushSender({ fetch: down.fetch, clock, log, tasks: new Tasks(log), retryDelaysMs: [] });
		await giveUp.send([msg(1)]);
		assert.ok(lines.some((l) => l.msg === "push request failed" && l.status === 500));
		sender.stop();
		giveUp.stop();
	});
});

describe("log mode and the notifier", () => {
	it("logs instead of sending in PUSH_MODE=log", async () => {
		const { log, lines } = capture();
		await new LogPushSender(log).send([msg(1)]);
		const line = lines.find((l) => l.msg === "push (log mode)");
		assert.equal(line?.title, "Your move");
		assert.equal(line?.ttl, 900);
	});

	it("turns pigs into tokens and skips pigs without one", async () => {
		const { log } = capture();
		const store = new MemoryStore()
			.seedPlayer({ userId: "a", pushToken: "ExponentPushToken[a]" })
			.seedPlayer({ userId: "b", pushToken: null });
		const sent: PushMessage[] = [];
		const tasks = new Tasks(log);
		const notifier = new Notifier({ store, sender: { send: async (m) => void sent.push(...m) }, log, tasks });
		notifier.notify(["a", "b", "a"], { title: "t", body: "b", data: {} });
		await tasks.settled();
		assert.deepEqual(sent.map((m) => m.to), ["ExponentPushToken[a]"]);
	});
});
