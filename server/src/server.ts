// Wires the play server together. Everything injectable (games, store,
// clock, verifier, push sender, entropy, hooks) comes in through the
// options, so tests and the e2e harness run the real server against toy
// games, an in-memory store and a hand-driven clock.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { AnyGame, GameId } from "../../multiplayer/types";
import { DEFAULT_ENGINE_OPTIONS, type EngineOptions } from "../../multiplayer/engine";
import { devVerifier, supabaseVerifier, type TokenVerifier } from "./auth";
import { nextTurn, systemClock, type Clock } from "./clock";
import type { ServerConfig } from "./config";
import { cryptoEntropy, type Entropy } from "./entropy";
import { clientIp, createHttpHandler } from "./http";
import { Hub } from "./hub";
import { InviteManager } from "./invites";
import { createLogger, type Logger } from "./log";
import { Matchmaker } from "./matchmaker";
import { PlayerDirectory } from "./players";
import { ExpoPushSender, LogPushSender, Notifier, type PushSender } from "./push";
import type { Presence } from "./reply";
import { RoomManager, type RoomHooks } from "./rooms";
import { Settings } from "./settings";
import type { Store } from "./store/types";
import { Tasks } from "./tasks";

export type GameList = readonly AnyGame[] | Partial<Record<GameId, AnyGame>>;

export interface PlayServerOptions {
	config: ServerConfig;
	games: GameList;
	store: Store;
	clock?: Clock;
	log?: Logger;
	verifier?: TokenVerifier;
	push?: PushSender;
	/** fetch for Auth and Expo (tests pass a fake). */
	fetch?: typeof fetch;
	entropy?: Entropy;
	hooks?: RoomHooks;
}

export interface PlayServer {
	readonly config: ServerConfig;
	readonly store: Store;
	readonly clock: Clock;
	readonly games: ReadonlyMap<GameId, AnyGame>;
	readonly rooms: RoomManager;
	readonly matchmaker: Matchmaker;
	readonly invites: InviteManager;
	readonly players: PlayerDirectory;
	readonly settings: Settings;
	readonly hub: Hub;
	/** Bound port (ephemeral when config.port is 0). Valid after start(). */
	readonly port: number;
	readonly wsUrl: string;
	readonly httpUrl: string;
	start(): Promise<void>;
	/** Stop matchmaking, tell every pig, write every table, close 1012. */
	shutdown(): Promise<void>;
	/** Resolves once no server-side work is in flight (tests). */
	settled(): Promise<void>;
}

export function gameMap(input: GameList): Map<GameId, AnyGame> {
	const list: AnyGame[] = Array.isArray(input)
		? [...(input as readonly AnyGame[])]
		: (Object.values(input) as (AnyGame | undefined)[]).filter((g): g is AnyGame => !!g);
	return new Map(list.map((g) => [g.id, g]));
}

/** Production verifies Supabase tokens only. Dev mode (refused in
 *  production) takes `dev:` tokens and, when SUPABASE_URL is set, real ones
 *  too: the simulator signs in with its real session while `npm run bot`
 *  pigs use dev tokens, all at one local server. */
export function verifierFor(config: ServerConfig, clock: Clock, log: Logger, fetchImpl?: typeof fetch): TokenVerifier {
	const real = config.supabaseUrl
		? supabaseVerifier({
				supabaseUrl: config.supabaseUrl,
				jwtSecret: config.supabaseJwtSecret,
				// VERIFY: that Auth accepts the secret key as the apikey header on
				// GET /auth/v1/user (Supabase's example uses the publishable key;
				// set SUPABASE_PUBLISHABLE_KEY to use that instead).
				apiKey: config.supabasePublishableKey ?? config.supabaseKey,
				fetch: fetchImpl,
				clock,
				log,
			})
		: null;
	if (config.authMode === "supabase") {
		if (!real) throw new Error("AUTH_MODE=supabase needs SUPABASE_URL");
		return real;
	}
	const dev = devVerifier();
	return { verify: (token) => (real && !token.startsWith("dev:") ? real.verify(token) : dev.verify(token)) };
}

export function createPlayServer(opts: PlayServerOptions): PlayServer {
	const { config, store } = opts;
	const clock = opts.clock ?? systemClock;
	const log = opts.log ?? createLogger({ level: config.logLevel });
	const tasks = new Tasks(log);
	const entropy = opts.entropy ?? cryptoEntropy;
	const games = gameMap(opts.games);
	const engine: EngineOptions = {
		countdownMs: config.timing.countdownMs,
		rematchWindowMs: config.timing.rematchWindowMs,
		maxMissedInARow: { ...DEFAULT_ENGINE_OPTIONS.maxMissedInARow },
	};
	const verifier = opts.verifier ?? verifierFor(config, clock, log, opts.fetch);
	const sender: PushSender =
		opts.push ??
		(config.pushMode === "expo"
			? new ExpoPushSender({ accessToken: config.expoAccessToken, fetch: opts.fetch, clock, log, tasks })
			: new LogPushSender(log));

	const settings = new Settings({ store, games, clock, log, production: config.production, pollMs: config.settingsPollMs });
	const players = new PlayerDirectory({ store, settings, clock, log, access: config.access });
	const notifier = new Notifier({ store, sender, log, tasks });
	// The hub is built last (it needs everything else); presence reaches it late.
	let hubRef: Hub | null = null;
	const presence: Presence = {
		isOnline: (userId) => hubRef?.isOnline(userId) ?? false,
		send: (userId, msg) => hubRef?.send(userId, msg),
	};
	const rooms = new RoomManager({
		games,
		store,
		clock,
		log,
		tasks,
		presence,
		notifier,
		players,
		entropy,
		timing: config.timing,
		engine,
		lobbyHostWaitMs: config.lobbyHostWaitMs,
		maxRooms: config.maxRooms,
		hooks: opts.hooks,
	});
	const matchmaker = new Matchmaker({
		games,
		rooms,
		players,
		settings,
		presence,
		notifier,
		clock,
		log,
		tasks,
		entropy,
		timing: config.timing,
		engine,
		partyGatherMs: config.partyGatherMs,
		asyncOpenSeatTtlMs: config.asyncOpenSeatTtlMs,
	});
	const invites = new InviteManager({
		games,
		rooms,
		matchmaker,
		players,
		settings,
		presence,
		notifier,
		store,
		clock,
		log,
		tasks,
		entropy,
		timing: config.timing,
	});
	const hub = new Hub({
		clock,
		log,
		tasks,
		timing: config.timing,
		authTimeoutMs: config.authTimeoutMs,
		verifier,
		players,
		settings,
		rooms,
		matchmaker,
		invites,
	});
	hubRef = hub;

	const startedAt = clock.now();
	const http: Server = createServer(
		createHttpHandler({
			clock,
			log,
			invites,
			version: config.version,
			startedAt,
			connections: () => hub.connections,
			rooms: () => rooms.size,
		}),
	);
	http.on("upgrade", (req, socket, head) => hub.handleUpgrade(req, socket, head, clientIp(req)));
	http.on("clientError", (_err, socket) => socket.destroy());

	let port = config.port;
	let stopping: Promise<void> | null = null;

	const server: PlayServer = {
		config,
		store,
		clock,
		games,
		rooms,
		matchmaker,
		invites,
		players,
		settings,
		hub,
		get port() {
			return port;
		},
		get wsUrl() {
			return `ws://127.0.0.1:${port}/ws`;
		},
		get httpUrl() {
			return `http://127.0.0.1:${port}`;
		},

		async start() {
			await settings.start();
			const tables = await rooms.rehydrate();
			const linked = await invites.rehydrate();
			const openSeats = matchmaker.adoptOpenSeats();
			await new Promise<void>((resolve, reject) => {
				http.once("error", reject);
				http.listen(config.port, config.host, () => {
					http.off("error", reject);
					resolve();
				});
			});
			port = (http.address() as AddressInfo).port;
			hub.start();
			log.info("play server listening", {
				port,
				version: config.version,
				games: [...games.keys()],
				enabled: settings.enabledGameIds(),
				auth: config.authMode,
				store: store.kind,
				push: config.pushMode,
				access: config.access,
				tables,
				invitesLinked: linked,
				openSeats,
			});
		},

		shutdown() {
			stopping ??= (async () => {
				matchmaker.stop();
				const closed = new Promise<void>((resolve) => http.close(() => resolve()));
				hub.beginDrain();
				await tasks.settled();
				await rooms.flushAll();
				hub.closeAll();
				rooms.stop();
				settings.stop();
				invites.stop();
				sender.stop?.();
				await nextTurn();
				hub.terminateAll();
				http.closeAllConnections();
				await store.close?.();
				await closed;
				log.info("play server stopped");
			})();
			return stopping;
		},

		async settled() {
			for (let i = 0; i < 3; i++) {
				await nextTurn();
				await tasks.settled();
			}
		},
	};
	return server;
}
