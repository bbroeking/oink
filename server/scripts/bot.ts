// A practice partner for development: bot pigs that join the queue (or take
// an invite) and play forever, re-queueing after every table. Start a local
// server, open the app in the simulator, queue for the same game, and the
// bot sits down opposite you.
//
//   npm run bot -- --game fence_the_pen
//   npm run bot -- --url ws://localhost:8787/ws --game rootle --count 3
//   npm run bot -- --game mud_volley --pace async
//   npm run bot -- --game snout_says --invite ABCD2345
//   npm run bot -- --game rootle --token dev:<uuid>:<name>
//
// Against a server in AUTH_MODE=supabase, pass a real access token with
// --token (a test account's); dev tokens only work against AUTH_MODE=dev.

import { randomUUID } from "node:crypto";
import type { AnyGame, GameId, Pace } from "../../multiplayer/types";
import { GAMES } from "../../multiplayer/games/index";
import { gameMap } from "../src/server";
import { FIXTURE_GAMES } from "../test/fixtures/games";
import { BotClient } from "./lib/botClient";

const args = process.argv.slice(2);
const option = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i >= 0 ? args[i + 1] : undefined;
};

const url = option("url") ?? "ws://localhost:8787/ws";
const gameId = option("game") as GameId | undefined;
const pace = (option("pace") ?? "live") as Pace;
const invite = option("invite")?.toUpperCase();
const token = option("token");
const count = Math.max(1, Number(option("count") ?? 1));

const registry = gameMap(Object.values(GAMES).filter((g): g is AnyGame => !!g));
// The server's toy games too, for a server started on them in a test.
const games = new Map([...gameMap(FIXTURE_GAMES), ...registry]);

if (!gameId || !games.has(gameId) || (pace !== "live" && pace !== "async") || (token && count > 1)) {
	console.error(
		[
			"usage: npm run bot -- --game <id> [--url ws://localhost:8787/ws] [--pace live|async]",
			"                      [--token dev:<uuid>:<name>] [--invite CODE] [--count N]",
			`games: ${[...registry.keys()].join(", ")}`,
			"(--token works with --count 1 only)",
		].join("\n"),
	);
	process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DAY = 24 * 3_600_000;

async function runBot(index: number): Promise<never> {
	const name = `BotPig${index + 1}`;
	const bot = new BotClient({
		url,
		token: token ?? `dev:${randomUUID()}:${name}`,
		games,
		label: name,
		moveDelayMs: [500, 1_400],
		log: (line) => console.log(line),
	});
	let inviteUsed = false;
	for (let attempt = 0; ; attempt++) {
		try {
			const welcome = await bot.connect();
			attempt = 0;
			console.log(`[${bot.label}] signed in as ${welcome.name} (${welcome.userId})`);
			for (;;) {
				let roomId: string;
				if (invite && !inviteUsed) {
					inviteUsed = true;
					roomId = await bot.acceptInvite(invite);
					console.log(`[${bot.label}] took a seat from invite ${invite}`);
				} else {
					const table = bot.nextTable(gameId as GameId, "a table", DAY);
					const ack = await bot.queue([gameId as GameId], pace);
					if (!ack.ok) {
						console.log(`[${bot.label}] queue refused (${ack.error}); trying again shortly`);
						await sleep(5_000);
						continue;
					}
					console.log(`[${bot.label}] looking for a ${pace} game of ${gameId}...`);
					roomId = (await Promise.race([table, bot.closed.then(() => Promise.reject(new Error("socket closed")))])).roomId;
				}
				console.log(`[${bot.label}] at table ${roomId}`);
				const done = await Promise.race([
					bot.waitRoom(roomId, (r) => r.phase === "ended", "the end of the table", 7 * DAY),
					bot.closed.then(() => Promise.reject(new Error("socket closed"))),
				]);
				const mine = done.you !== null && done.result?.winners.includes(done.you);
				console.log(`[${bot.label}] table over: ${done.result?.kind} (${done.result?.reason}) ${done.result?.summary ?? ""}${mine ? " · the bot won" : ""}`);
				await sleep(1_500);
			}
		} catch (err) {
			bot.close();
			const wait = Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5));
			console.log(`[${bot.label}] ${(err as Error).message}; reconnecting in ${Math.round(wait / 1000)} s`);
			await sleep(wait);
		}
	}
}

console.log(`bots: ${count} × ${gameId} (${pace}) against ${url}`);
for (let i = 0; i < count; i++) void runBot(i);
