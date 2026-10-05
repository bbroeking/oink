// Stores: the Supabase store's dark-launch fallback (a play_* table that is
// not there yet is held in memory, logged once) and its row shapes, against
// a fake PostgREST; and the memory store's STORE_FILE persistence.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RoomState } from "../../multiplayer/engine";
import { createLogger } from "../src/log";
import { MemoryStore } from "../src/store/memory";
import { SupabaseStore } from "../src/store/supabase";
import type { ResultRow } from "../src/store/types";

const ROOM = "11111111-2222-4333-8444-555555555555";
const USER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const USER_B = "bbbbbbbb-0000-4000-8000-000000000002";

const room = (rev: number): RoomState =>
	({
		roomId: ROOM,
		gameId: "fence_the_pen",
		rulesVersion: 1,
		pace: "async",
		source: "queue",
		phase: "playing",
		seats: [
			{ userId: USER_A, name: "A", look: { pigId: "rosie" }, connected: false, gone: false, missed: 0 },
			{ userId: USER_B, name: "B", look: { pigId: "rosie" }, connected: false, gone: false, missed: 0 },
		],
		seed: "secret-seed",
		rev,
		game: { sticks: 5 },
		activeSeats: [0],
		deadline: null,
		startsAt: null,
		result: null,
		events: [],
		host: null,
		rematch: null,
		createdAt: 1,
		updatedAt: 2,
		log: [],
	}) as unknown as RoomState;

interface Seen {
	method: string;
	path: string;
	body: unknown;
	prefer: string | null;
}

/** A PostgREST stand-in: play_* tables are missing; everything else answers. */
function fakePostgrest(missing: "pgrst205" | "42p01" | "none") {
	const seen: Seen[] = [];
	const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(String(input));
		const headers = new Headers(init?.headers);
		seen.push({
			method: init?.method ?? "GET",
			path: url.pathname + url.search,
			body: init?.body ? JSON.parse(String(init.body)) : null,
			prefer: headers.get("Prefer"),
		});
		const table = url.pathname.split("/").pop() ?? "";
		if (table.startsWith("play_") && missing !== "none") {
			const body =
				missing === "pgrst205"
					? { code: "PGRST205", details: null, hint: null, message: `Could not find the table 'public.${table}' in the schema cache` }
					: { code: "42P01", details: null, hint: null, message: `relation "public.${table}" does not exist` };
			return new Response(JSON.stringify(body), { status: missing === "pgrst205" ? 404 : 400, headers: { "Content-Type": "application/json" } });
		}
		return new Response(missing === "none" && (init?.method ?? "GET") !== "GET" ? null : "[]", {
			status: missing === "none" && (init?.method ?? "GET") !== "GET" ? 201 : 200,
			headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
		});
	}) as typeof fetch;
	return { fetch: fetchImpl, seen };
}

describe("SupabaseStore", () => {
	for (const flavour of ["pgrst205", "42p01"] as const) {
		it(`holds a missing play table in memory (${flavour}) and says so once`, async () => {
			const lines: Record<string, unknown>[] = [];
			const log = createLogger({ level: "warn", sink: (line) => lines.push(JSON.parse(line)) });
			const pg = fakePostgrest(flavour);
			const store = new SupabaseStore({ url: "https://example.supabase.co", key: "sb_secret_test", log, fetch: pg.fetch });
			await store.saveMatch(room(3));
			await store.saveMatch(room(4));
			assert.equal((await store.loadMatch(ROOM))?.rev, 4, "served from the fallback");
			assert.deepEqual((await store.listOpenMatches()).map((r) => r.roomId), [ROOM]);
			assert.deepEqual((await store.listMatchesForUser(USER_B)).map((r) => r.roomId), [ROOM]);
			assert.deepEqual(store.missingTables, ["play_matches"]);
			assert.equal(lines.filter((l) => l.msg?.toString().startsWith("play table missing")).length, 1);
			assert.equal(pg.seen.filter((s) => s.path.startsWith("/rest/v1/play_matches")).length, 1, "asked once, then remembered");
			await store.recordResult([]);
			assert.deepEqual(await store.loadRatings(USER_A), {});
		});
	}

	it("writes matches, results and ratings in the migration's shapes", async () => {
		const log = createLogger({ level: "silent" });
		const pg = fakePostgrest("none");
		const store = new SupabaseStore({ url: "https://example.supabase.co", key: "sb_secret_test", log, fetch: pg.fetch });
		await store.saveMatch(room(5));
		const match = pg.seen.find((s) => s.path.startsWith("/rest/v1/play_matches"));
		assert.equal(match?.method, "POST");
		assert.match(match?.prefer ?? "", /resolution=merge-duplicates/);
		const row = match?.body as Record<string, unknown>;
		assert.deepEqual(row.seat_users, [USER_A, USER_B]);
		assert.equal(row.phase, "playing");
		assert.equal(row.game, "fence_the_pen");
		assert.equal((row.state as RoomState).seed, "secret-seed", "the full state, seed included (service role only)");
		assert.equal(row.ended_at, null);

		const result: ResultRow = {
			matchId: ROOM,
			userId: USER_A,
			game: "fence_the_pen",
			seat: 0,
			outcome: "win",
			score: 1,
			reason: "complete",
			opponents: [USER_B],
			period: "2026-10",
			endedAt: Date.UTC(2026, 9, 4),
		};
		await store.recordResult([result]);
		const results = pg.seen.find((s) => s.path.startsWith("/rest/v1/play_results"));
		assert.match(results?.path ?? "", /on_conflict=match_id%2Cuser_id/);
		assert.match(results?.prefer ?? "", /resolution=ignore-duplicates/, "idempotent on the primary key");
		assert.deepEqual((results?.body as unknown[])[0], {
			match_id: ROOM,
			user_id: USER_A,
			game: "fence_the_pen",
			seat: 0,
			outcome: "win",
			score: 1,
			reason: "complete",
			opponents: [USER_B],
			period: "2026-10",
			ended_at: "2026-10-04T00:00:00.000Z",
		});

		await store.saveRatings([{ userId: USER_A, game: "fence_the_pen", rating: 1012, games: 1, updatedAt: 0 }]);
		const ratings = pg.seen.find((s) => s.path.startsWith("/rest/v1/play_ratings"));
		assert.match(ratings?.path ?? "", /on_conflict=user_id%2Cgame/);
	});

	it("never sends a non-uuid into a PostgREST filter", async () => {
		const pg = fakePostgrest("none");
		const store = new SupabaseStore({ url: "https://example.supabase.co", key: "k", log: createLogger({ level: "silent" }), fetch: pg.fetch });
		assert.equal(await store.loadPlayer("dev-pig,or(id.neq.0)"), null);
		assert.deepEqual((await store.loadSocialGraph("x)")).friends, []);
		assert.equal(pg.seen.length, 0);
	});
});

describe("MemoryStore", () => {
	it("persists to STORE_FILE and reads it back", async () => {
		const dir = mkdtempSync(join(tmpdir(), "ttp-play-"));
		const file = join(dir, "store.json");
		try {
			const a = new MemoryStore(file).seedPlayer({ userId: USER_A, username: "Rosie" });
			await a.saveMatch(room(9));
			a.flush();
			const b = new MemoryStore(file);
			assert.equal((await b.loadMatch(ROOM))?.rev, 9);
			assert.equal((await b.loadPlayer(USER_A))?.username, "Rosie");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("hands out copies, never its own objects", async () => {
		const store = new MemoryStore();
		await store.saveMatch(room(1));
		const loaded = (await store.loadMatch(ROOM)) as RoomState;
		loaded.rev = 99;
		assert.equal((await store.loadMatch(ROOM))?.rev, 1);
	});
});
