// The soft-update nudge's switch: app_settings.min_build, read through the
// shared server-config lifecycle (utils/configCell.ts, the build-151 "config
// over constants" contract).
//
// WHY: there is no OTA lane and the tail of old binaries is weeks long, so a
// server-side change that wants today's client (the Season 2 flip first) needs
// a way to say "a new version is ready". The server raises
// `{"build": N, "title": "...", "body": "..."}`; a binary whose native build
// number is below N shows UpdateNudge on Home. NEVER BLOCKING: the nudge is a
// card with a link and a dismiss, never a gate.
//
// INERT BY DEFAULT, three ways: the compiled fallback is `{build: 0}` (nothing
// is below 0); a missing row / missing RPC / offline keeps the fallback (the
// cell is fail-soft); and an unknown native build number (Expo Go, web,
// Android) never shows it.
//
// THE NATIVE BUILD NUMBER: expo-application is not a dependency of this app.
// Its `nativeBuildVersion` is the binary's CFBundleVersion, which expo-constants
// already exposes as `Constants.platform.ios.buildNumber` (read straight from
// the Info.plist, so it is the number EAS stamped at build time). That is read
// first. `Constants.expoConfig.ios.buildNumber` is the last resort: app.json
// carries no buildNumber here (eas.json `appVersionSource: "remote"`), so on
// its own it would leave the nudge inert forever.
//
// NO COLD-START CACHE (deliberate): a cached row could flash a nudge the server
// has already lowered. The cost is one RPC before the card appears.
//
// DISMISSAL lasts the app session: a module-level note of which min_build was
// dismissed, so Home remounts keep it hidden and the next launch shows it
// again. Raising min_build again mid-session shows it again.

import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { createConfigCell } from "@/utils/configCell";

export interface MinBuildConfig {
	/** Native builds BELOW this see the nudge. 0 = inert. */
	build: number;
	/** Server copy. Empty means the compiled fallback line. */
	title: string;
	body: string;
}

export const DEFAULT_MIN_BUILD: MinBuildConfig = Object.freeze({
	build: 0,
	title: "",
	body: "",
});

export const UPDATE_NUDGE_FALLBACK_TITLE = "A new version is ready";
export const UPDATE_NUDGE_FALLBACK_BODY = "Update to get the latest.";

// Server copy is clamped so a runaway row can never grow the card over Rosie.
const TITLE_MAX = 60;
const BODY_MAX = 140;
/** Rapid mount/foreground beats collapse into one fetch. */
const FETCH_MIN_MS = 60_000;

/** A positive whole build number from a number or a digits-only string, else null. */
export function parseBuildNumber(raw: unknown): number | null {
	if (typeof raw === "number") {
		return Number.isInteger(raw) && raw > 0 ? raw : null;
	}
	if (typeof raw !== "string") return null;
	const t = raw.trim();
	if (!/^\d+$/.test(t)) return null;
	const n = Number.parseInt(t, 10);
	return n > 0 ? n : null;
}

function copy(raw: unknown, max: number): string {
	return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

/**
 * Validate the app_settings.min_build row. REJECTS (null: the cell keeps what
 * it has) a non-object or a build that is not a whole number >= 0; a missing
 * or non-string title/body falls back to "" (the compiled line). Test seam.
 */
export function sanitizeMinBuild(raw: unknown): MinBuildConfig | null {
	if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
	const r = raw as Record<string, unknown>;
	const build = r.build === 0 || r.build === "0" ? 0 : parseBuildNumber(r.build);
	if (build === null) return null;
	return { build, title: copy(r.title, TITLE_MAX), body: copy(r.body, BODY_MAX) };
}

const cell = createConfigCell<MinBuildConfig>({
	key: "min_build",
	fallback: DEFAULT_MIN_BUILD,
	sanitize: sanitizeMinBuild,
	minRefreshMs: FETCH_MIN_MS,
	// No cacheKey: see the header.
});

/** Fetch app_setting('min_build'). Resolves true when the value changed. */
export const refreshMinBuild: () => Promise<boolean> = cell.refresh;

/**
 * The running binary's build number, or null when it cannot be known. iOS
 * only: the nudge's one action is the App Store listing.
 */
export function nativeBuildNumber(): number | null {
	if (Platform.OS !== "ios") return null;
	return (
		parseBuildNumber(Constants.platform?.ios?.buildNumber) ??
		parseBuildNumber(Constants.expoConfig?.ios?.buildNumber)
	);
}

export interface MinBuildNudge {
	show: boolean;
	title: string;
	body: string;
}

/** Pure: should this binary see the nudge, and with which words. */
export function resolveMinBuildNudge(
	config: MinBuildConfig,
	nativeBuild: number | null,
): MinBuildNudge {
	return {
		show: config.build > 0 && nativeBuild !== null && nativeBuild < config.build,
		title: config.title || UPDATE_NUDGE_FALLBACK_TITLE,
		body: config.body || UPDATE_NUDGE_FALLBACK_BODY,
	};
}

// The min_build value the player waved away this session (0 = none).
let sessionDismissedBuild = 0;

/** Test seam: back to the compiled fallback, nothing dismissed. */
export function resetMinBuildForTests(): void {
	cell.resetForTests();
	sessionDismissedBuild = 0;
}

export interface MinBuildState extends MinBuildNudge {
	/** Hide the nudge until the next launch (or a higher min_build). */
	dismiss: () => void;
}

/**
 * Home's read of the soft-update switch. Fetches on mount and on every return
 * to the foreground (debounced), so raising the row reaches open apps too.
 */
export function useMinBuild(): MinBuildState {
	const [config, setConfig] = useState<MinBuildConfig>(cell.read);
	const [dismissedBuild, setDismissedBuild] = useState(sessionDismissedBuild);

	useEffect(() => {
		let alive = true;
		const pull = () => {
			void cell.refresh().then((changed) => {
				if (alive && changed) setConfig(cell.read());
			});
		};
		pull();
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") pull();
		});
		return () => {
			alive = false;
			sub.remove();
		};
	}, []);

	const dismiss = useCallback(() => {
		sessionDismissedBuild = config.build;
		setDismissedBuild(config.build);
	}, [config.build]);

	const nudge = resolveMinBuildNudge(config, nativeBuildNumber());
	return {
		...nudge,
		show: nudge.show && dismissedBuild !== config.build,
		dismiss,
	};
}
