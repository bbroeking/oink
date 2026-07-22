// Pure surface + lifecycle seam of the postgres_changes owner. The
// React hook itself needs a full RN + supabase mount to exercise, but
// the channel-key derivation, spec normalization, and the
// subscribe→teardown invariant are all reachable without one — which is
// the point of extracting them.

import {
	buildChannelKey,
	normalizeSpecFilter,
	subscribePostgresChanges,
	type PgChangesClient,
	type PostgresChangeSpec,
} from "../hooks/usePostgresChanges";

describe("buildChannelKey", () => {
	test("no extra parts → realtime:<topic>:<uid>", () => {
		expect(buildChannelKey("active-effects", "u1")).toBe(
			"realtime:active-effects:u1"
		);
		expect(buildChannelKey("inbox", "u1")).toBe("realtime:inbox:u1");
	});

	test("appends extra key parts after the uid", () => {
		expect(buildChannelKey("crew", "u1", "c9")).toBe("realtime:crew:u1:c9");
	});

	test("nullish key parts collapse to 'none' (crewless topic)", () => {
		expect(buildChannelKey("crew", "u1", null)).toBe("realtime:crew:u1:none");
		expect(buildChannelKey("crew", "u1", undefined)).toBe(
			"realtime:crew:u1:none"
		);
	});

	test("differs per subject and per crew (no cross-subject collision)", () => {
		expect(buildChannelKey("crew", "u1", "c1")).not.toBe(
			buildChannelKey("crew", "u2", "c1")
		);
		expect(buildChannelKey("crew", "u1", "c1")).not.toBe(
			buildChannelKey("crew", "u1", "c2")
		);
	});
});

describe("normalizeSpecFilter", () => {
	test("defaults schema to public", () => {
		expect(
			normalizeSpecFilter({
				event: "INSERT",
				table: "blessings",
				filter: "receiver_id=eq.u1",
				callback: () => {},
			})
		).toEqual({
			event: "INSERT",
			schema: "public",
			table: "blessings",
			filter: "receiver_id=eq.u1",
		});
	});

	test("honors an explicit schema", () => {
		expect(
			normalizeSpecFilter({
				event: "*",
				schema: "app",
				table: "crew_members",
				filter: "crew_id=eq.c1",
				callback: () => {},
			}).schema
		).toBe("app");
	});

	test("omits the filter key entirely when absent (not filter: undefined)", () => {
		const out = normalizeSpecFilter({
			event: "UPDATE",
			table: "curses",
			callback: () => {},
		});
		expect("filter" in out).toBe(false);
	});
});

// A minimal fake channel/client recording the on() registrations, the
// subscribe call, and every removeChannel target.
function makeFakeClient() {
	const removed: unknown[] = [];
	const channels: {
		key: string;
		ons: { filter: unknown }[];
		subscribed: number;
	}[] = [];
	const client = {
		channel(key: string) {
			const rec = { key, ons: [] as { filter: unknown }[], subscribed: 0 };
			channels.push(rec);
			const chan = {
				on(_type: string, filter: unknown) {
					rec.ons.push({ filter });
					return chan;
				},
				subscribe() {
					rec.subscribed += 1;
					return chan;
				},
			};
			return chan;
		},
		removeChannel(ch: unknown) {
			removed.push(ch);
			return Promise.resolve("ok");
		},
	};
	return { client: client as unknown as PgChangesClient, channels, removed };
}

describe("subscribePostgresChanges lifecycle", () => {
	const specs: PostgresChangeSpec[] = [
		{
			event: "INSERT",
			table: "blessings",
			filter: "receiver_id=eq.u1",
			callback: () => {},
		},
		{
			event: "UPDATE",
			table: "curses",
			filter: "receiver_id=eq.u1",
			callback: () => {},
		},
	];

	test("opens one channel, registers every spec, subscribes once", () => {
		const { client, channels } = makeFakeClient();
		subscribePostgresChanges(client, "realtime:active-effects:u1", specs);
		expect(channels).toHaveLength(1);
		expect(channels[0].key).toBe("realtime:active-effects:u1");
		expect(channels[0].ons).toHaveLength(2);
		expect(channels[0].subscribed).toBe(1);
	});

	test("disposer removes exactly the channel it created", () => {
		const { client, removed } = makeFakeClient();
		const dispose = subscribePostgresChanges(client, "k", specs);
		expect(removed).toHaveLength(0);
		dispose();
		expect(removed).toHaveLength(1);
	});

	test("disposer is idempotent — no double-teardown", () => {
		const { client, removed } = makeFakeClient();
		const dispose = subscribePostgresChanges(client, "k", specs);
		dispose();
		dispose();
		dispose();
		expect(removed).toHaveLength(1);
	});

	test("two subscriptions on one topic each remove their own channel", () => {
		// The old getChannels().filter(topic===key) teardown would have
		// removed BOTH on a single dispose; holding the exact ref does not.
		const { client, removed } = makeFakeClient();
		const d1 = subscribePostgresChanges(client, "same-topic", specs);
		const d2 = subscribePostgresChanges(client, "same-topic", specs);
		d1();
		expect(removed).toHaveLength(1);
		d2();
		expect(removed).toHaveLength(2);
	});
});
