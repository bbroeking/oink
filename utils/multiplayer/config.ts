// Where the app finds the play server, and whether it offers Practice and
// play-by-post. Server config over constants (utils/configCell.ts): the
// live value is app_settings.multiplayer (migration 20261004230000), the
// compiled fallback below is only what a fresh install boots on. Which GAMES
// are on is not here: the server's welcome catalog owns that.
//
// The URL must be wss:// (the token rides the first frame, never the URL, and
// never in clear text). In development only, `EXPO_PUBLIC_PLAY_URL` points
// the app at a local server, e.g.
//   EXPO_PUBLIC_PLAY_URL=ws://192.168.1.20:8787/ws npx expo start
// and plain ws:// is accepted for that case alone.

import { createConfigCell } from "@/utils/configCell";

export interface MultiplayerConfig {
	/** The play server's WebSocket endpoint. */
	url: string;
	/** Offer Practice tables (a bot pig plays the other seats). */
	practice: boolean;
	/** Offer play-by-post (async) tables. */
	async: boolean;
}

export const DEFAULT_MULTIPLAYER_CONFIG: MultiplayerConfig = Object.freeze({
	url: "wss://ttp-play.onrender.com/ws",
	practice: true,
	async: true,
});

const CACHE_KEY = "multiplayer_config_cache_v1";
/** Rapid mount/foreground beats collapse into one fetch. */
const FETCH_MIN_MS = 5_000;
const MAX_URL_LENGTH = 512;

const SECURE_URL = /^wss:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;
const ANY_WS_URL = /^wss?:\/\/[^\s/?#]+(?:\/[^\s]*)?$/i;

/** True for a usable endpoint: wss://, or ws:// when `allowInsecure`. */
export function isPlayServerUrl(value: unknown, allowInsecure = false): value is string {
	if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return false;
	return (allowInsecure ? ANY_WS_URL : SECURE_URL).test(value.trim());
}

/**
 * Validate a server/cache row ({ url, practice, async }). Rejects the whole
 * row (null: the cell keeps what it has) when the URL is missing or not a
 * WebSocket URL; a missing or non-boolean flag keeps its fallback value.
 * Plain ws:// passes only in development builds.
 */
export function sanitizeMultiplayerConfig(raw: unknown, allowInsecure: boolean = __DEV__): MultiplayerConfig | null {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
	const r = raw as Record<string, unknown>;
	if (!isPlayServerUrl(r.url, allowInsecure)) return null;
	return {
		url: (r.url as string).trim(),
		practice: typeof r.practice === "boolean" ? r.practice : DEFAULT_MULTIPLAYER_CONFIG.practice,
		async: typeof r.async === "boolean" ? r.async : DEFAULT_MULTIPLAYER_CONFIG.async,
	};
}

const cell = createConfigCell<MultiplayerConfig>({
	key: "multiplayer",
	fallback: DEFAULT_MULTIPLAYER_CONFIG,
	sanitize: (raw) => sanitizeMultiplayerConfig(raw),
	cacheKey: CACHE_KEY,
	minRefreshMs: FETCH_MIN_MS,
});

/** The development override, or null. Read literally so Expo inlines it. */
function devUrlOverride(): string | null {
	if (!__DEV__) return null;
	const url = process.env.EXPO_PUBLIC_PLAY_URL;
	return isPlayServerUrl(url, true) ? url.trim() : null;
}

/** The live config, with the development URL override applied. */
export function multiplayerConfig(): MultiplayerConfig {
	const live = cell.read();
	const override = devUrlOverride();
	return override ? { ...live, url: override } : live;
}

/** The endpoint the client dials, read at every connect attempt. */
export function playServerUrl(): string {
	return multiplayerConfig().url;
}

/** Load the last server row from AsyncStorage (cold start, before the net). */
export const hydrateMultiplayerConfig: () => Promise<void> = cell.hydrate;

/** Fetch app_setting('multiplayer'). Resolves true when the value changed. */
export const refreshMultiplayerConfig: () => Promise<boolean> = cell.refresh;

/** Test seam. */
export const applyMultiplayerConfig: (next: MultiplayerConfig) => boolean = cell.apply;

/** Test seam: back to the compiled fallback. */
export const resetMultiplayerConfigForTests: () => void = cell.resetForTests;
