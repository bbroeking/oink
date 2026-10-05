// Entry point (Render runs `node dist/index.js`, the esbuild bundle of this
// file plus ../multiplayer). Boots the real game registry against the
// configured store, and on SIGTERM drains within 10 s: stop matchmaking,
// tell every pig, write every table, close sockets with 1012, exit 0.

import { GAMES } from "../../multiplayer/games/index";
import { ConfigError, loadConfig } from "./config";
import { createLogger } from "./log";
import { createPlayServer } from "./server";
import { createStore } from "./store/index";

const SHUTDOWN_DEADLINE_MS = 10_000;

async function main(): Promise<void> {
	let config;
	try {
		config = loadConfig();
	} catch (err) {
		if (err instanceof ConfigError) {
			process.stderr.write(`${JSON.stringify({ level: "error", msg: "bad config", reason: err.message })}\n`);
			process.exit(1);
		}
		throw err;
	}
	const log = createLogger({ level: config.logLevel, base: { svc: "ttp-play" } });
	const store = createStore(config, log);
	const server = createPlayServer({ config, games: GAMES, store, log });

	let stopping = false;
	const stop = (why: string, code: number) => {
		if (stopping) return;
		stopping = true;
		log.info("shutting down", { why });
		const deadline = setTimeout(() => {
			log.warn("shutdown ran past its deadline; exiting anyway");
			process.exit(code);
		}, SHUTDOWN_DEADLINE_MS);
		deadline.unref();
		server.shutdown().then(
			() => process.exit(code),
			(err: unknown) => {
				log.error("shutdown failed", { err });
				process.exit(code);
			},
		);
	};
	process.on("SIGTERM", () => stop("SIGTERM", 0));
	process.on("SIGINT", () => stop("SIGINT", 0));
	process.on("unhandledRejection", (err) => log.error("unhandled rejection", { err }));
	process.on("uncaughtException", (err) => {
		// State may be inconsistent: write what we can and let Render restart us.
		log.error("uncaught exception", { err });
		stop("uncaughtException", 1);
	});

	await server.start();
}

main().catch((err: unknown) => {
	process.stderr.write(`${JSON.stringify({ level: "error", msg: "the play server could not start", err: String(err) })}\n`);
	process.exit(1);
});
