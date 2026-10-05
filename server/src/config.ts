// Environment → one typed config. Defaults favour a zero-setup local run
// (dev tokens, the in-memory store, pushes to the log); production defaults
// to the real thing and refuses the dev shortcuts outright. The effective
// timing goes to every client in `welcome.timing` (server config over
// constants: the app reads these, never its compiled defaults).

import { DEFAULT_TIMING, type InviteKind, type Timing } from "../../multiplayer/protocol";
import type { LogLevel } from "./log";
import pkg from "../package.json" with { type: "json" };

export type AuthMode = "supabase" | "dev";
export type PushMode = "expo" | "log";
export type StoreKind = "supabase" | "memory";
export type AccessMode = "flag" | "all";

export interface ServerConfig {
	port: number;
	host: string;
	production: boolean;
	authMode: AuthMode;
	supabaseUrl: string | null;
	/** sb_secret_… (preferred) or the legacy service_role JWT. */
	supabaseKey: string | null;
	/** Legacy HS256 signing secret: the primary verifier while the project
	 *  still signs user tokens with it (docs/multiplayer/research/platform-notes.md §2.1). */
	supabaseJwtSecret: string | null;
	/** apikey header for the GET /auth/v1/user fallback; defaults to supabaseKey. */
	supabasePublishableKey: string | null;
	expoAccessToken: string | null;
	pushMode: PushMode;
	store: StoreKind;
	storeFile: string | null;
	access: AccessMode;
	timing: Timing;
	partyGatherMs: number;
	lobbyHostWaitMs: number;
	asyncOpenSeatTtlMs: number;
	/** First frame must be `auth` within this window (protocol: 5 s). */
	authTimeoutMs: number;
	/** Cap on tables held in memory. */
	maxRooms: number;
	/** How often the dark-launch switches are re-read. */
	settingsPollMs: number;
	logLevel: LogLevel;
	version: string;
}

export class ConfigError extends Error {}

type Env = Record<string, string | undefined>;

function text(env: Env, key: string): string | null {
	const value = env[key]?.trim();
	return value ? value : null;
}

function int(env: Env, key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
	const raw = text(env, key);
	if (raw === null) return fallback;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min || value > max) {
		throw new ConfigError(`${key} must be an integer between ${min} and ${max}, got "${raw}"`);
	}
	return value;
}

function oneOf<T extends string>(env: Env, key: string, options: readonly T[], fallback: T): T {
	const raw = text(env, key);
	if (raw === null) return fallback;
	if (!(options as readonly string[]).includes(raw)) {
		throw new ConfigError(`${key} must be one of ${options.join(", ")}, got "${raw}"`);
	}
	return raw as T;
}

export function loadConfig(env: Env = process.env): ServerConfig {
	const production = env.NODE_ENV === "production";
	const authMode = oneOf<AuthMode>(env, "AUTH_MODE", ["supabase", "dev"], production ? "supabase" : "dev");
	if (authMode === "dev" && production) {
		throw new ConfigError("AUTH_MODE=dev is refused when NODE_ENV=production: anyone could sign in as anyone");
	}
	const store = oneOf<StoreKind>(env, "STORE", ["supabase", "memory"], production ? "supabase" : "memory");
	const supabaseUrl = text(env, "SUPABASE_URL")?.replace(/\/+$/, "") ?? null;
	const supabaseKey = text(env, "SUPABASE_SECRET_KEY") ?? text(env, "SUPABASE_SERVICE_ROLE_KEY");
	if (authMode === "supabase" && !supabaseUrl) throw new ConfigError("AUTH_MODE=supabase needs SUPABASE_URL");
	if (store === "supabase" && (!supabaseUrl || !supabaseKey)) {
		throw new ConfigError("STORE=supabase needs SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
	}

	const heartbeatMs = int(env, "HEARTBEAT_MS", DEFAULT_TIMING.heartbeatMs, 1_000);
	const timing: Timing = {
		...DEFAULT_TIMING,
		heartbeatMs,
		// A client that pings every heartbeat must never trip the idle cut.
		idleTimeoutMs: int(env, "IDLE_TIMEOUT_MS", Math.max(DEFAULT_TIMING.idleTimeoutMs, heartbeatMs * 2 + 20_000), 2_000),
		reconnectGraceMs: int(env, "RECONNECT_GRACE_MS", DEFAULT_TIMING.reconnectGraceMs, 0),
		countdownMs: int(env, "COUNTDOWN_MS", DEFAULT_TIMING.countdownMs, 0),
		rematchWindowMs: int(env, "REMATCH_WINDOW_MS", DEFAULT_TIMING.rematchWindowMs, 1_000),
		emoteCooldownMs: int(env, "EMOTE_COOLDOWN_MS", DEFAULT_TIMING.emoteCooldownMs, 0),
		practiceOfferMs: int(env, "PRACTICE_OFFER_MS", DEFAULT_TIMING.practiceOfferMs, 0),
		inviteTtlMs: { ...DEFAULT_TIMING.inviteTtlMs } as Record<InviteKind, number>,
		asyncInviteTtlMs: int(env, "ASYNC_INVITE_TTL_MS", DEFAULT_TIMING.asyncInviteTtlMs, 60_000),
	};

	const commit = text(env, "RENDER_GIT_COMMIT");
	return {
		port: int(env, "PORT", 8787, 0, 65_535),
		host: text(env, "HOST") ?? "0.0.0.0",
		production,
		authMode,
		supabaseUrl,
		supabaseKey,
		supabaseJwtSecret: text(env, "SUPABASE_JWT_SECRET"),
		supabasePublishableKey: text(env, "SUPABASE_PUBLISHABLE_KEY") ?? text(env, "SUPABASE_ANON_KEY"),
		expoAccessToken: text(env, "EXPO_ACCESS_TOKEN"),
		pushMode: oneOf<PushMode>(env, "PUSH_MODE", ["expo", "log"], production ? "expo" : "log"),
		store,
		storeFile: text(env, "STORE_FILE"),
		access: oneOf<AccessMode>(env, "ACCESS", ["flag", "all"], production ? "flag" : "all"),
		timing,
		partyGatherMs: int(env, "PARTY_GATHER_MS", 6_000, 0),
		lobbyHostWaitMs: int(env, "LOBBY_HOST_WAIT_MS", 120_000, 0),
		asyncOpenSeatTtlMs: int(env, "ASYNC_OPEN_SEAT_TTL_MS", 72 * 3_600_000, 1_000),
		authTimeoutMs: int(env, "AUTH_TIMEOUT_MS", 5_000, 100),
		maxRooms: int(env, "MAX_ROOMS", 5_000, 1),
		settingsPollMs: int(env, "SETTINGS_POLL_MS", 60_000, 1_000),
		logLevel: oneOf<LogLevel>(env, "LOG_LEVEL", ["debug", "info", "warn", "error", "silent"], "info"),
		version: commit ? `${pkg.version}+${commit.slice(0, 7)}` : pkg.version,
	};
}

export type ConfigOverrides = Partial<Omit<ServerConfig, "timing">> & { timing?: Partial<Timing> };

/** A local, fully in-memory config for tests and the e2e harness. */
export function localConfig(overrides: ConfigOverrides = {}): ServerConfig {
	const base = loadConfig({ NODE_ENV: "test", PORT: "0", HOST: "127.0.0.1", LOG_LEVEL: "silent" });
	return { ...base, ...overrides, timing: { ...base.timing, ...overrides.timing } };
}
