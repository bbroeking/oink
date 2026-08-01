// The runtime feeding-window schedule — SERVER-AUTHORITATIVE window geometry.
//
// WHY (founder call 2026-07-16, right after the +2h anchor shift): a schedule
// change must never need a binary again. The server owns the numbers in
// app_settings.feeding_schedule (migration 20260744100000 — the jsonb sibling
// of the feature-flags lane); the compiled constants in constants/dig.ts are
// the FALLBACK DEFAULTS the module boots on. Future shifts = one UPDATE to the
// server row; clients follow on their next fetch, no build.
//
// LIFECYCLE: boots on the compiled defaults → hydrates from the AsyncStorage
// cache (last fetched values, so a relaunch mid-rollout keeps the new clock) →
// refreshes from the app_setting('feeding_schedule') RPC on the season tab's
// mount and every app-foreground (useFeedingCta wires both, beside its dug
// reconcile). A confirmed CHANGE re-derives the clocks immediately — window
// ids detach exactly like the 20260744 anchor shift did (accepted, rare) and
// the dug-state reconcile heals the flags.
//
// FAIL-SOFT: no row / RPC missing (unpushed migration) / offline / malformed
// values → keep whatever we have (ultimately the compiled defaults). A bad
// server row can never wedge the clocks: sanitizeFeedingSchedule clamps every
// candidate (window > 0, 0 < open ≤ window, 0 ≤ offset < window) and rejects
// the rest.
//
// This module is now a thin DECLARATION over utils/configCell — the shared
// "server-tuned config with compiled fallback" lifecycle (cache + debounce +
// change-detection). This cell opts into BOTH the AsyncStorage cache and the
// fetch debounce; the shape below is exactly the byte-for-byte behavior the
// hand-rolled version had. The build-151 "config over constants" contract and
// the lazy-require dependency note now live on the primitive.
//
// DEPENDENCY NOTE: the rpc chain + AsyncStorage are require()d lazily inside the
// cell's async paths, so importing this module (and utils/rooting, which reads
// feedingSchedule() in every window function) stays pure — no native modules,
// nothing for a test to mock unless it exercises the fetch/cache paths.

import {
	PATCH_OPEN_SECS,
	ROOTING_WINDOW_OFFSET_SECS,
	ROOTING_WINDOW_SECS,
} from "@/constants/dig";
import { createConfigCell } from "@/utils/configCell";

export interface FeedingSchedule {
	/** Omitted/"uniform" is the deployed legacy clock; commuter is the v2 clock. */
	mode?: "uniform" | "commuter_eastern";
	/** Full window length, seconds (compiled default 28800 — 8h). */
	windowSecs: number;
	/** Open (diggable) span at the head of each window, seconds (default 14400). */
	openSecs: number;
	/** Anchor offset from the epoch, seconds (default 7200 — 02/10/18 UTC). */
	offsetSecs: number;
}

// The compiled fallback — always the same numbers as constants/dig.ts.
export const DEFAULT_FEEDING_SCHEDULE: FeedingSchedule = Object.freeze({
	mode: "uniform",
	windowSecs: ROOTING_WINDOW_SECS,
	openSecs: PATCH_OPEN_SECS,
	offsetSecs: ROOTING_WINDOW_OFFSET_SECS,
});

// Last-fetched server values, persisted so a cold start keeps a rolled-out
// schedule without waiting on the network. Stored in the SERVER's row shape
// ({window_secs, ...}) so the cache and the RPC share one sanitizer.
const CACHE_KEY = "feeding_schedule_cache_v1";

// Debounce floor for the server fetch — rapid foreground/background flips (or
// a mount racing an AppState 'active') collapse into one RPC.
const FETCH_MIN_MS = 5000;

// Coerce a server/cache field to a positive-ish integer, or NaN.
function intField(v: unknown): number {
	const n = typeof v === "number" ? v : NaN;
	return Number.isFinite(n) ? Math.floor(n) : NaN;
}

/**
 * Clamp-validate a candidate schedule in the SERVER row shape
 * ({window_secs, open_secs, offset_secs}). Null on anything out of bounds —
 * a bad row keeps the previous schedule, never a broken clock.
 */
export function sanitizeFeedingSchedule(raw: unknown): FeedingSchedule | null {
	if (raw == null || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (r.mode === "commuter_eastern") {
		return {
			mode: "commuter_eastern",
			windowSecs: ROOTING_WINDOW_SECS,
			openSecs: PATCH_OPEN_SECS,
			offsetSecs: ROOTING_WINDOW_OFFSET_SECS,
		};
	}
	const windowSecs = intField(r.window_secs);
	const openSecs = intField(r.open_secs);
	const offsetSecs = intField(r.offset_secs);
	if (!Number.isFinite(windowSecs) || windowSecs <= 0) return null;
	if (!Number.isFinite(openSecs) || openSecs <= 0 || openSecs > windowSecs) return null;
	if (!Number.isFinite(offsetSecs) || offsetSecs < 0 || offsetSecs >= windowSecs) return null;
	return { mode: "uniform", windowSecs, openSecs, offsetSecs };
}

const cell = createConfigCell<FeedingSchedule>({
	key: "feeding_schedule",
	fallback: DEFAULT_FEEDING_SCHEDULE,
	sanitize: sanitizeFeedingSchedule,
	cacheKey: CACHE_KEY,
	minRefreshMs: FETCH_MIN_MS,
});

/** The live schedule every window function reads (module-level, no context). */
export const feedingSchedule: () => FeedingSchedule = cell.read;

/**
 * Install an (already sanitized) schedule. Returns true when the values
 * actually moved — the caller uses that to trigger the clock re-derive.
 * Exported as the test seam for override-propagation coverage.
 */
export const applyFeedingSchedule: (next: FeedingSchedule) => boolean = cell.apply;

/**
 * Hydrate from the AsyncStorage cache — the last server values this install
 * saw. Fail-soft: missing/corrupt cache is simply ignored. Called from
 * useFeedingCta's mount (before the network refresh), so a relaunch between
 * fetches still ticks the rolled-out clock.
 */
export const hydrateFeedingScheduleCache: () => Promise<void> = cell.hydrate;

/**
 * Fetch the server schedule (app_setting RPC) and install it. Resolves true
 * when the values CHANGED (the caller re-derives the clocks + reconciles the
 * dug state). Fail-soft + debounced: offline / unpushed migration / bad row /
 * a fetch within FETCH_MIN_MS of the last all resolve false, silently.
 */
export const refreshFeedingSchedule: () => Promise<boolean> = cell.refresh;

/** Test seam: back to the compiled defaults + a cleared fetch debounce. */
export const resetFeedingScheduleForTests: () => void = cell.resetForTests;
