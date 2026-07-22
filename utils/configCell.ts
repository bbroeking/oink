// A server-tuned config cell — the ONE lifecycle behind every "server owns the
// number, the binary ships a fallback" tunable in the app.
//
// WHY THIS EXISTS (server-authority contract, build 151): a tuning change must
// never need a new binary. The server owns the live value (a jsonb row read via
// the app_setting() RPC); the compiled constant the module boots on is only the
// FALLBACK DEFAULT. This is the "config over constants" rule that came out of the
// build-151 window-shift lesson — rhythm/tuning params fetch from the server with
// a compiled fallback, never a bare client constant. The pattern was hand-copied
// into two modules (feedingConfig, fieldGuideConfig) before it was extracted here.
//
// LIFECYCLE a cell owns:
//   • boots on the frozen compiled fallback,
//   • (opt-in) hydrates from an AsyncStorage cache of the last server row, so a
//     relaunch mid-rollout keeps the rolled-out value without waiting on the net,
//   • refreshes from app_setting(key) — sanitize → apply-with-change-detection,
//   • (opt-in) debounces the fetch behind a min-refresh floor so rapid
//     mount/foreground beats collapse into one RPC.
//
// FAIL-SOFT, always: no row / RPC missing (unpushed migration) / offline /
// malformed value → keep whatever we have (ultimately the compiled fallback). The
// sanitizer is the guard — a bad server row can never wedge the cell.
//
// DEPENDENCY NOTE (why the native imports are lazy `require`d): the reader path
// must stay pure so pure importers stay native-free. utils/rooting.ts reads
// feedingSchedule() in every window function; if this module pulled in the
// supabase client or AsyncStorage at import time, importing rooting would drag
// native modules into every jest suite that touches the window math. So the rpc
// chain and AsyncStorage are require()d lazily INSIDE the async paths only — a
// test never has to mock them unless it exercises the fetch/cache paths.

// The read RPC every cell fetches through — one jsonb setting by key, null when
// the row is absent (see the app_setting() migration, the jsonb sibling of the
// feature-flags lane).
const APP_SETTING_RPC = "app_setting";

// A cell fetches by passing this key as app_setting's p_key.
export interface ConfigCellSpec<T> {
	/** The app_settings.key this cell reads (the app_setting RPC's p_key). */
	key: string;
	/** The frozen compiled fallback the cell boots on and resets to. */
	fallback: Readonly<T>;
	/**
	 * Clamp-validate a raw server/cache jsonb value into a typed config.
	 * Return null to REJECT (the cell keeps its current value — a bad row never
	 * installs). A sanitizer that fills per-field defaults instead (never
	 * rejecting) simply never returns null; both shapes flow through unchanged.
	 */
	sanitize: (raw: unknown) => T | null;
	/**
	 * Change-detector for apply(). Defaults to a shallow field compare, which is
	 * correct for the flat numeric configs this primitive was built for; pass an
	 * override only for a nested shape.
	 */
	equals?: (a: T, b: T) => boolean;
	/**
	 * OPT-IN AsyncStorage cache key. When set, refresh() persists the accepted
	 * RAW server row here and hydrate() reads it back. The cache stores the
	 * SERVER row shape (not the sanitized shape) so cache + RPC share one
	 * sanitizer. Omit for a cache-less cell.
	 */
	cacheKey?: string;
	/**
	 * OPT-IN debounce floor (ms) for refresh(). A fetch within this window of the
	 * last resolves false without hitting the network — rapid foreground/mount
	 * beats collapse into one RPC. Omit for an un-debounced cell (every refresh
	 * fetches).
	 */
	minRefreshMs?: number;
}

export interface ConfigCell<T> {
	/** The live value every reader path reads. Synchronous, native-free. */
	read: () => T;
	/**
	 * Install an (already sanitized) value. Returns true when it actually moved —
	 * callers use that to trigger downstream re-derives. Exposed as a test seam.
	 */
	apply: (next: T) => boolean;
	/** The spec's sanitizer, re-exposed as a test seam. */
	sanitize: (raw: unknown) => T | null;
	/**
	 * Hydrate from the AsyncStorage cache (opt-in). No-op when the cell declares
	 * no cacheKey. Fail-soft: missing/corrupt cache is ignored.
	 */
	hydrate: () => Promise<void>;
	/**
	 * Fetch app_setting(key) and install it. Resolves true when the value
	 * CHANGED. Fail-soft + (opt-in) debounced + (opt-in) cache-persisting.
	 */
	refresh: () => Promise<boolean>;
	/**
	 * Staleness-aware read-or-refresh: kick a fail-soft refresh in the background
	 * (the debounce floor, when configured, is the staleness gate) and return the
	 * current value now. The fire-and-forget shape for a caller that only wants
	 * "freshen it, don't block me" — it drops the changed signal, so a caller that
	 * must react to a change keeps calling refresh() directly.
	 */
	ensureFresh: () => T;
	/** Test seam: back to the compiled fallback + a cleared debounce. */
	resetForTests: () => void;
}

// Shallow field compare over the union of keys — correct for the flat configs
// this primitive serves (every field always present, primitive values).
function shallowEqual<T>(a: T, b: T): boolean {
	const ao = a as Record<string, unknown>;
	const bo = b as Record<string, unknown>;
	const ak = Object.keys(ao);
	if (ak.length !== Object.keys(bo).length) return false;
	for (const k of ak) if (ao[k] !== bo[k]) return false;
	return true;
}

/**
 * Build a config cell from a spec. The returned functions close over the cell's
 * module-level state (current value + last-fetch timestamp) — bind them straight
 * to a module's public exports (`export const feedingSchedule = cell.read`).
 */
export function createConfigCell<T>(spec: ConfigCellSpec<T>): ConfigCell<T> {
	const { key, fallback, sanitize, cacheKey } = spec;
	const equals = spec.equals ?? shallowEqual;
	const minRefreshMs = spec.minRefreshMs ?? 0;

	let current: T = fallback as T;
	let lastFetchAt = 0;

	const read = (): T => current;

	const apply = (next: T): boolean => {
		if (equals(current, next)) return false;
		current = next;
		return true;
	};

	const hydrate = async (): Promise<void> => {
		if (!cacheKey) return;
		try {
			const AsyncStorage =
				require("@react-native-async-storage/async-storage").default;
			const raw = await AsyncStorage.getItem(cacheKey);
			if (!raw) return;
			const sane = sanitize(JSON.parse(raw));
			if (sane) apply(sane);
		} catch {
			// no-op — the compiled fallback (or a prior apply) stands.
		}
	};

	const refresh = async (): Promise<boolean> => {
		if (minRefreshMs > 0) {
			const now = Date.now();
			if (now - lastFetchAt < minRefreshMs) return false;
			lastFetchAt = now;
		}
		try {
			const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
			const raw = await rpc<Record<string, unknown>>(APP_SETTING_RPC, {
				p_key: key,
			});
			if (!raw) return false; // rpc missing / null row — keep what we have
			const sane = sanitize(raw);
			if (!sane) return false; // rejected by the sanitizer — keep what we have
			const changed = apply(sane);
			// Persist the accepted RAW row for the next cold start (opt-in, fail-soft).
			if (cacheKey) {
				try {
					const AsyncStorage =
						require("@react-native-async-storage/async-storage").default;
					await AsyncStorage.setItem(cacheKey, JSON.stringify(raw));
				} catch {
					// a missed cache write just means one extra fetch next launch.
				}
			}
			return changed;
		} catch {
			return false;
		}
	};

	const ensureFresh = (): T => {
		void refresh().catch(() => {});
		return current;
	};

	const resetForTests = (): void => {
		current = fallback as T;
		lastFetchAt = 0;
	};

	return { read, apply, sanitize, hydrate, refresh, ensureFresh, resetForTests };
}
