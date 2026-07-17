// The Field Guide — client unlock state + the reveal queue (spec 16).
//
// The Field Guide is the evergreen economy-discovery journal beside the seasonal
// Burrow Book. A page is a silhouette until the player first MEETS the thing;
// meeting it fires observeFieldGuide(id) from wherever that encounter is observed
// on the client (first patch find, first lucky number, first Exchange visit, …).
//
// FAIL-SOFT, like storybook_seen (utils/onboarding): unlock state mirrors in
// AsyncStorage so the whole feature works against today's prod schema (no table,
// no RPCs). observeFieldGuide marks the local mirror + fires the idempotent
// unlock RPC + enqueues ONE ceremony reveal, all fail-soft — an un-pushed server,
// offline, or a double-fire can never wedge or double-reveal.
//
// DEPENDENCY NOTE: AsyncStorage + the rpc chain are require()d lazily inside the
// async paths so importing this module stays pure — nothing native for a test to
// mock unless it exercises the fetch/cache paths themselves (mirrors feedingConfig).

// ── Page-id whitelist (must match the migration's whitelist EXACTLY) ──────────
// Order is the shelf order. Echo is DELIBERATELY absent (founder cut, spec 16).
export const FIELD_GUIDE_PAGE_IDS = [
	"truffle",
	"golden_truffle",
	"lucky_number",
	"trough",
	"mud_wrap",
	"snouts",
	"exchange",
	"feeding_windows",
] as const;

export type FieldGuidePageId = (typeof FIELD_GUIDE_PAGE_IDS)[number];

const PAGE_SET: ReadonlySet<string> = new Set(FIELD_GUIDE_PAGE_IDS);
const PAGE_INDEX: ReadonlyMap<string, number> = new Map(
	FIELD_GUIDE_PAGE_IDS.map((id, i) => [id, i])
);

/** Whitelist guard — a forged/typo'd id never reaches the mirror or the RPC. */
export function isFieldGuidePageId(id: unknown): id is FieldGuidePageId {
	return typeof id === "string" && PAGE_SET.has(id);
}

/**
 * Pure unlock-state derivation: union the local mirror with the server ids,
 * drop anything off the whitelist, and return them in SHELF order. `server`
 * is null when the read failed / migration unpushed — then the local mirror
 * alone stands (never wrongly re-locks a page the player already met).
 * Exported as the test seam.
 */
export function deriveUnlockedPages(
	local: readonly string[],
	server: readonly string[] | null
): FieldGuidePageId[] {
	const set = new Set<FieldGuidePageId>();
	for (const id of local) if (isFieldGuidePageId(id)) set.add(id);
	if (server) for (const id of server) if (isFieldGuidePageId(id)) set.add(id);
	return FIELD_GUIDE_PAGE_IDS.filter((id) => set.has(id));
}

// ── In-memory unlock mirror ───────────────────────────────────────────────────
const STORAGE_KEY = "field_guide_unlocks_v1";
let unlocked = new Set<FieldGuidePageId>();

/** The pages met so far this process (in shelf order). */
export function unlockedPages(): FieldGuidePageId[] {
	return FIELD_GUIDE_PAGE_IDS.filter((id) => unlocked.has(id));
}

export function isUnlocked(id: FieldGuidePageId): boolean {
	return unlocked.has(id);
}

function persistLocal(): void {
	try {
		const AsyncStorage =
			require("@react-native-async-storage/async-storage").default;
		AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unlockedPages())).catch(
			() => {}
		);
	} catch {
		// no-op — an unpersisted mirror just re-reveals once next cold start.
	}
}

/**
 * Hydrate the mirror from AsyncStorage (the last-known local set). Fail-soft:
 * missing/corrupt cache is ignored. Call before the first render of the shelf.
 */
export async function hydrateFieldGuideCache(): Promise<void> {
	try {
		const AsyncStorage =
			require("@react-native-async-storage/async-storage").default;
		const raw = await AsyncStorage.getItem(STORAGE_KEY);
		if (!raw) return;
		const arr = JSON.parse(raw);
		if (Array.isArray(arr)) {
			for (const id of arr) if (isFieldGuidePageId(id)) unlocked.add(id);
		}
	} catch {
		// no-op.
	}
}

/**
 * Fetch the server unlock set, reconcile it with the local mirror, persist the
 * union, and return the unlocked pages in shelf order. Fail-soft: a missing RPC
 * / offline / null row leaves the local mirror standing. Called on the shelf's
 * mount (like fetchMyUniques).
 */
export async function fetchFieldGuideUnlocks(): Promise<FieldGuidePageId[]> {
	let server: string[] | null = null;
	try {
		const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
		const rows = await rpc<string[]>("get_field_guide_pages");
		if (Array.isArray(rows)) server = rows;
	} catch {
		server = null;
	}
	const merged = deriveUnlockedPages(unlockedPages(), server);
	unlocked = new Set(merged);
	persistLocal();
	return merged;
}

// ── The reveal queue ──────────────────────────────────────────────────────────
// observeFieldGuide enqueues a NEW unlock here; the reveal component drains it
// one at a time through the popup queue. Module-level so any observation site can
// enqueue without threading context, and the single mounted reveal listens.
const pending: FieldGuidePageId[] = [];
const listeners = new Set<() => void>();

function notify(): void {
	for (const fn of listeners) {
		try {
			fn();
		} catch {
			// a bad listener never blocks the queue.
		}
	}
}

/** Subscribe the mounted reveal to queue changes. Returns an unsubscribe. */
export function subscribeFieldGuideReveals(fn: () => void): () => void {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/** The next page waiting to be revealed (FIFO), or null. */
export function peekPendingReveal(): FieldGuidePageId | null {
	return pending[0] ?? null;
}

/** Pop a revealed page off the queue (called after its ceremony dismisses). */
export function dequeueReveal(id: FieldGuidePageId): void {
	const i = pending.indexOf(id);
	if (i >= 0) {
		pending.splice(i, 1);
		notify();
	}
}

/**
 * The client-observed encounter entry point. Idempotent + fail-soft: a page
 * already met (this process) is a no-op, so hot-path callers can fire it on
 * EVERY encounter. A first encounter marks the local mirror, fires the
 * idempotent unlock RPC (swallowed on failure), and enqueues ONE reveal.
 */
export function observeFieldGuide(id: FieldGuidePageId): void {
	if (!isFieldGuidePageId(id)) return;
	if (unlocked.has(id)) return;
	unlocked.add(id);
	persistLocal();
	// Fire the server unlock — fail-soft, never awaited by the caller.
	try {
		const { rpc } = require("@/utils/rpc") as typeof import("@/utils/rpc");
		Promise.resolve(rpc("unlock_field_guide_page", { p_page: id })).catch(
			() => {}
		);
	} catch {
		// no rpc available (test env / offline) — the local mirror still stands.
	}
	if (!pending.includes(id)) {
		pending.push(id);
		notify();
	}
}

/** Test seam: reset the mirror + the reveal queue to a clean process. */
export function resetFieldGuideForTests(): void {
	unlocked = new Set();
	pending.length = 0;
	listeners.clear();
}
