// End-to-end: boots the real play server in-process (memory store, dev auth,
// pushes to the log, real clock with short timings) and plays every game in
// the registry through every way a table can happen, with bot pigs speaking
// the real protocol over real sockets:
//
//   queue     a random live match through the queue, to the end
//   link      a link invite, accepted, played
//   direct    a direct invite to friends, accepted, played
//   reconnect a pig drops mid-game and comes back inside the grace
//   forfeit   a pig drops for good: forfeit (competitive) or ended early
//   async     a table by post with an open seat, filled later, played
//   rematch   a finished table votes a rematch and plays it
//
// Every snapshot the server sends is checked against the game's secretsOf:
// no seat may ever receive a marker of a secret it should not see.
//
//   npm run e2e                 the registry (fixtures if it is empty)
//   npm run e2e -- --fixtures   the server's toy games instead
//   npm run e2e -- --game rootle --verbose

import { randomUUID } from "node:crypto";
import type { AnyGame, GameId } from "../../multiplayer/types";
import type { RoomSnapshot } from "../../multiplayer/protocol";
import { GAMES } from "../../multiplayer/games/index";
import { localConfig } from "../src/config";
import { createLogger } from "../src/log";
import { createPlayServer, gameMap } from "../src/server";
import { MemoryStore } from "../src/store/memory";
import { FIXTURE_GAMES } from "../test/fixtures/games";
import { BotClient } from "./lib/botClient";

const SCENARIOS = ["queue", "link", "direct", "reconnect", "forfeit", "async", "rematch"] as const;
type Scenario = (typeof SCENARIOS)[number];
type Outcome = { status: "pass" | "fail" | "n/a"; note?: string };

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};
const verbose = flag("verbose");
const SCENARIO_TIMEOUT_MS = Number(option("timeout") ?? 120_000);

const registry = Object.values(GAMES).filter((g): g is AnyGame => !!g);
const useFixtures = flag("fixtures") || (!flag("registry") && registry.length === 0);
const allGames = useFixtures ? FIXTURE_GAMES : registry;
const only = option("game");
const games = only ? allGames.filter((g) => g.id === only) : allGames;
if (games.length === 0) {
	console.error(`no games to run${only ? ` (no game "${only}")` : ""}`);
	process.exit(1);
}

const TIMING = { countdownMs: 150, reconnectGraceMs: 800, rematchWindowMs: 15_000, emoteCooldownMs: 0 };
const store = new MemoryStore();
const leaks = new Map<GameId, string[]>();
const gameById = gameMap(allGames);

const server = createPlayServer({
	config: localConfig({
		logLevel: verbose ? "info" : "silent",
		pushMode: "log",
		partyGatherMs: 300,
		lobbyHostWaitMs: 3_000,
		timing: TIMING,
	}),
	games: allGames,
	store,
	log: createLogger({ level: verbose ? "info" : "silent" }),
	hooks: {
		// The secrecy cross-check: the exact snapshot each seat is sent.
		onSnapshot(state, seat, snapshot) {
			const game = gameById.get(state.gameId);
			const text = JSON.stringify(snapshot);
			const found: string[] = [];
			if (text.includes(state.seed)) found.push("the room seed");
			if (game?.secretsOf && state.game !== null) {
				for (const marker of game.secretsOf(state.game, seat)) if (text.includes(marker)) found.push(marker);
			}
			if (found.length > 0) {
				const list = leaks.get(state.gameId) ?? [];
				list.push(...found.map((m) => `seat ${seat} rev ${snapshot.rev}: ${m}`));
				leaks.set(state.gameId, list);
			}
		},
	},
});

let pigCount = 0;
const allBots: BotClient[] = [];

/** A fresh pig, signed in, playing by itself. */
async function pig(label: string): Promise<BotClient> {
	const userId = randomUUID();
	const name = `${label}${++pigCount}`;
	store.seedPlayer({ userId, username: name, pushToken: `ExponentPushToken[${userId}]` });
	const bot = new BotClient({
		url: server.wsUrl,
		token: `dev:${userId}:${name}`,
		games: gameById,
		label: name,
		moveDelayMs: [5, 40],
		seed: name,
		log: verbose ? (line) => console.log(line) : undefined,
	});
	allBots.push(bot);
	await bot.connect();
	return bot;
}

async function pigs(n: number, label: string): Promise<BotClient[]> {
	return Promise.all(Array.from({ length: n }, () => pig(label)));
}

const ended = (r: RoomSnapshot) => r.phase === "ended";

async function finish(bots: BotClient[], roomId: string): Promise<RoomSnapshot> {
	const results = await Promise.all(bots.map((b) => b.waitRoom(roomId, ended, `the end of ${roomId}`, SCENARIO_TIMEOUT_MS)));
	return results[0];
}

function expectComplete(room: RoomSnapshot): Outcome {
	return room.result?.reason === "complete" ? { status: "pass" } : { status: "fail", note: `ended ${room.result?.reason}` };
}

/** Seats `n` pigs at one live table through the queue; returns its id. */
async function queueTable(game: AnyGame, bots: BotClient[]): Promise<string> {
	const tables = bots.map((b) => b.nextTable(game.id, `a ${game.id} table`, SCENARIO_TIMEOUT_MS));
	for (const b of bots) {
		const ack = await b.queue([game.id], "live");
		if (!ack.ok) throw new Error(`queue.join refused: ${ack.error}`);
	}
	const snaps = await Promise.all(tables);
	const roomId = snaps[0].roomId;
	if (snaps.some((s) => s.roomId !== roomId)) throw new Error("the pigs landed at different tables");
	return roomId;
}

const scenarios: Record<Scenario, (game: AnyGame) => Promise<Outcome>> = {
	async queue(game) {
		if (!game.paces.includes("live")) return { status: "n/a" };
		const bots = await pigs(game.seats.min, "q");
		return expectComplete(await finish(bots, await queueTable(game, bots)));
	},

	async link(game) {
		const pace = game.paces.includes("live") ? "live" : "async";
		const [host, ...guests] = await pigs(game.seats.min, "l");
		const invite = await host.createInvite(game.id, "link", pace);
		for (const g of guests) await g.acceptInvite(invite.code);
		const roomId = invite.roomId as string;
		const lobby = await host.waitRoom(roomId, (r) => r.seats.length === game.seats.min, "everyone seated");
		if (lobby.phase === "lobby") {
			const ack = await host.request({ t: "room.start", roomId });
			if (!ack.ok) throw new Error(`room.start refused: ${ack.error}`);
		}
		return expectComplete(await finish([host, ...guests], roomId));
	},

	async direct(game) {
		const pace = game.paces.includes("live") ? "live" : "async";
		const [host, ...friends] = await pigs(game.seats.min, "d");
		for (const f of friends) store.seedFriends(host.userId as string, f.userId as string);
		// Friendships seeded after sign-in: the server re-reads them on create.
		const heard = friends.map((f) => f.waitFor((m) => (m.t === "invite.state" ? m.invite : undefined), "the invite"));
		const invite = await host.createInvite(game.id, "direct", pace, friends.map((f) => f.userId as string));
		await Promise.all(heard);
		for (const f of friends) await f.acceptInvite(invite.code);
		return expectComplete(await finish([host, ...friends], invite.roomId as string));
	},

	async reconnect(game) {
		if (!game.paces.includes("live")) return { status: "n/a" };
		const bots = await pigs(game.seats.min, "r");
		const victim = bots[0];
		victim.autoplay = false;
		const roomId = await queueTable(game, bots);
		await victim.waitRoom(roomId, (r) => r.phase === "playing", "play to begin");
		victim.drop();
		await new Promise((resolve) => setTimeout(resolve, 150));
		await victim.connect();
		await victim.waitRoom(roomId, (r) => r.seats.every((s) => s.gone || s.connected) && r.phase !== "ended", "the seat back", 5_000);
		victim.autoplay = true;
		victim.wake();
		const room = await finish(bots, roomId);
		const seat = room.seats.find((s) => s.userId === victim.userId);
		if (seat?.gone) return { status: "fail", note: "the returning pig was counted gone" };
		return expectComplete(room);
	},

	async forfeit(game) {
		if (!game.paces.includes("live")) return { status: "n/a" };
		const bots = await pigs(game.seats.min, "f");
		for (const b of bots) b.autoplay = false;
		const [victim, ...stayers] = bots;
		const roomId = await queueTable(game, bots);
		await victim.waitRoom(roomId, (r) => r.phase === "playing", "play to begin");
		victim.drop();
		// Wait until the table lets the pig go, then let the others play on.
		await stayers[0].waitRoom(roomId, (r) => r.seats.some((s) => s.userId === victim.userId && s.gone) || ended(r), "the pig to be let go");
		for (const b of stayers) {
			b.autoplay = true;
			b.wake();
		}
		const room = await finish(stayers, roomId);
		const victimSeat = room.seats.find((s) => s.userId === victim.userId);
		if (!victimSeat?.gone) return { status: "fail", note: "the dropped pig is still seated" };
		if (room.result?.winners.includes(victimSeat.seat)) return { status: "fail", note: "a departed pig won" };
		const expected = game.kind === "competitive" ? (stayers.length === 1 ? "forfeit" : "complete") : stayers.length < game.seats.min ? "ended_early" : "complete";
		return room.result?.reason === expected ? { status: "pass" } : { status: "fail", note: `ended ${room.result?.reason}, wanted ${expected}` };
	},

	async async(game) {
		if (!game.paces.includes("async")) return { status: "n/a" };
		const first = await pig("a");
		const opened = first.nextTable(game.id, "an open table");
		const ack = await first.queue([game.id], "async");
		if (!ack.ok) throw new Error(`async queue.join refused: ${ack.error}`);
		const roomId = (ack.data as { roomId: string }).roomId;
		const table = await opened;
		if (table.roomId !== roomId) throw new Error("opened the wrong table");
		await new Promise((resolve) => setTimeout(resolve, 200));
		const later: BotClient[] = [];
		for (let i = 1; i < game.seats.min; i++) {
			const p = await pig("a");
			const joined = await p.queue([game.id], "async");
			if (!joined.ok || (joined.data as { roomId: string }).roomId !== roomId) {
				throw new Error(`the later pig did not take the open seat (${joined.ok ? "another table" : joined.error})`);
			}
			later.push(p);
		}
		return expectComplete(await finish([first, ...later], roomId));
	},

	async rematch(game) {
		if (!game.paces.includes("live")) return { status: "n/a" };
		const bots = await pigs(game.seats.min, "m");
		const roomId = await queueTable(game, bots);
		const first = await finish(bots, roomId);
		if (first.result?.reason !== "complete") return { status: "fail", note: `first game ended ${first.result?.reason}` };
		const next = bots.map((b) => b.waitFor((m) => (m.t === "room.state" && m.room.source === "rematch" ? m.room : undefined), "the rematch table"));
		for (const b of bots) {
			const vote = await b.request({ t: "room.rematch", roomId });
			if (!vote.ok) throw new Error(`rematch vote refused: ${vote.error}`);
		}
		const tables = await Promise.all(next);
		const nextId = tables[0].roomId;
		if (tables.some((t) => t.roomId !== nextId) || nextId === roomId) throw new Error("no shared rematch table");
		return expectComplete(await finish(bots, nextId));
	},
};

async function runGame(game: AnyGame): Promise<Record<Scenario, Outcome>> {
	const outcomes = {} as Record<Scenario, Outcome>;
	for (const name of SCENARIOS) {
		const started = Date.now();
		try {
			outcomes[name] = await Promise.race([
				scenarios[name](game),
				new Promise<Outcome>((_, reject) => setTimeout(() => reject(new Error("timed out")), SCENARIO_TIMEOUT_MS + 5_000)),
			]);
		} catch (err) {
			outcomes[name] = { status: "fail", note: (err as Error).message };
		}
		if (verbose) console.log(`${game.id} ${name}: ${outcomes[name].status} in ${Date.now() - started} ms`);
	}
	return outcomes;
}

async function main(): Promise<void> {
	await server.start();
	console.log(`e2e: ${games.length} game(s) from ${useFixtures ? "the test fixtures" : "the registry"} on ${server.wsUrl}`);
	const started = Date.now();
	const results = await Promise.all(games.map(async (g) => [g, await runGame(g)] as const));
	await server.settled();

	const violations = allBots.flatMap((b) => b.violations.map((v) => `${b.label}: ${v}`));
	const width = Math.max(14, ...games.map((g) => g.id.length)) + 2;
	const cols = [...SCENARIOS, "secrets"];
	const header = "game".padEnd(width) + cols.map((c) => c.padEnd(11)).join("");
	console.log(`\n${header}\n${"-".repeat(header.length)}`);
	let failed = violations.length > 0;
	const notes: string[] = [];
	for (const [game, outcomes] of results) {
		const leaked = leaks.get(game.id) ?? [];
		const row = SCENARIOS.map((s) => outcomes[s].status.padEnd(11)).join("") + (leaked.length === 0 ? "pass" : `FAIL(${leaked.length})`);
		console.log(game.id.padEnd(width) + row);
		for (const s of SCENARIOS) {
			if (outcomes[s].status === "fail") {
				failed = true;
				notes.push(`${game.id} ${s}: ${outcomes[s].note ?? "failed"}`);
			}
		}
		if (leaked.length > 0) {
			failed = true;
			notes.push(`${game.id} leaked: ${leaked.slice(0, 5).join("; ")}`);
		}
	}
	for (const v of violations) notes.push(v);
	if (notes.length > 0) console.log(`\n${notes.join("\n")}`);
	console.log(`\n${failed ? "FAILED" : "all green"} in ${((Date.now() - started) / 1000).toFixed(1)} s`);

	for (const b of allBots) b.close();
	await server.shutdown();
	process.exit(failed ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
