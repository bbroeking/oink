// Truffle Patch — pure board generation + feeding-window math.
//
// CLIENT MIRROR of supabase/migrations/20260704100000_truffle_patch.sql.
// Parity contract (documented in the migration header): the PRNG is
// Park–Miller minstd — state = (state * 16807) % 2147483647; nextInt(n) =
// state % n after advancing; seed already normalized to [1, 2147483646] by
// open_rooting. THE FIRST FOUR DRAWS DEFINE THE FIND SET (1: L orientation,
// 2: domino orientation, 3: shimmer present, 4: junk type) — the server
// consumes only those four (rooting_finds()); every draw after that is
// layout-only and exists solely here. Do NOT reorder draws.
//
// All values here are safe in JS doubles: 16807 * 2147483646 ≈ 3.6e13 < 2^53.

import {
	DIG_BUCKET_OPEN_MINS,
	DIG_BUCKET_STARTS,
	DIG_DAY_ANCHOR_MIN,
	DIG_DAY_MIN,
	DIG_WINDOWS_PER_DAY,
	PATCH_COLS,
	PATCH_ROWS,
	STIR_RUB,
	STIR_SHOVE,
} from "@/constants/dig";
import { feedingSchedule, type FeedingSchedule } from "@/utils/feedingConfig";
import { formatHM } from "@/utils/duration";
import { getDevSeasonOverrides } from "@/utils/devSeasonOverrides";

export type Find =
	| "truffle_l"
	| "truffle_d"
	| "shimmer"
	| "stone"
	| "junk_boot"
	| "junk_wrap"
	| "unique";

// A claimable find (what submit_rooting accepts): everything except stones.
// A unique claims via the literal token "unique" — the server maps it to the
// row's unique_id (which relic this board carried).
export type ClaimableFind = Exclude<Find, "stone">;

export interface PatchCell {
	kind: Find;
}

export interface PatchBoard {
	/** Mud depth per tile, 2–3, row-major (idx = row * PATCH_COLS + col). */
	layers: number[];
	/** Buried content per tile (null = plain mud). */
	cells: (PatchCell | null)[];
	/** The find ids present on this board — MUST equal rooting_finds(seed) (+ "unique" when carried). */
	finds: ClaimableFind[];
	/** Tile indices of each truffle cluster (for completion detection). */
	truffleL: number[];
	truffleD: number[];
	/** The single unique relic this board carries (server-rolled), or null. */
	unique: { id: string; idx: number } | null;
}

// ── PRNG (Park–Miller minstd) ────────────────────────────────────────────────

export class Minstd {
	private state: number;
	constructor(seed: number) {
		// PARITY: the server (open_rooting) guarantees seeds in [1, 2147483646]
		// and rooting_finds() uses them DIRECTLY as the initial state — so must
		// we. Only out-of-range inputs (practice-mode misuse) get normalized.
		const t = Math.trunc(seed);
		this.state =
			t >= 1 && t <= 2147483646 ? t : (Math.abs(t) % 2147483646) + 1;
	}
	next(): number {
		this.state = (this.state * 16807) % 2147483647;
		return this.state;
	}
	nextInt(n: number): number {
		return this.next() % n;
	}
}

// ── Board generation ─────────────────────────────────────────────────────────

// The four L-tromino orientations, as [row, col] offsets. MUST match the
// migration's comment order (draw 1 picks the index).
const L_ORIENTS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
	[
		[0, 0],
		[1, 0],
		[1, 1],
	],
	[
		[0, 0],
		[0, 1],
		[1, 0],
	],
	[
		[0, 0],
		[0, 1],
		[1, 1],
	],
	[
		[0, 1],
		[1, 0],
		[1, 1],
	],
];

const MAX_PLACE_ATTEMPTS = 200;

function placeShape(
	rng: Minstd,
	occupied: boolean[],
	offsets: ReadonlyArray<readonly [number, number]>
): number[] {
	const fits = (r: number, c: number): number[] | null => {
		const cells: number[] = [];
		for (const [dr, dc] of offsets) {
			const rr = r + dr;
			const cc = c + dc;
			if (rr < 0 || rr >= PATCH_ROWS || cc < 0 || cc >= PATCH_COLS) return null;
			const idx = rr * PATCH_COLS + cc;
			if (occupied[idx]) return null;
			cells.push(idx);
		}
		return cells;
	};
	for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
		const r = rng.nextInt(PATCH_ROWS);
		const c = rng.nextInt(PATCH_COLS);
		const cells = fits(r, c);
		if (cells) {
			for (const idx of cells) occupied[idx] = true;
			return cells;
		}
	}
	// Deterministic fallback: first row-major origin where the shape fits.
	for (let r = 0; r < PATCH_ROWS; r++) {
		for (let c = 0; c < PATCH_COLS; c++) {
			const cells = fits(r, c);
			if (cells) {
				for (const idx of cells) occupied[idx] = true;
				return cells;
			}
		}
	}
	return []; // unreachable on a 30-tile board with ≤10 occupied cells
}

// Per-tile depth from a single nextInt(3) draw. Tuned 2026-07-11 so boards are
// NOT fully clearable: {0→2, 1→3, 2→3} (avg ≈2.67, total ≈80 units) puts perfect
// play ≈75% and realistic play ≈60–70% against the 20-stir budget. One draw per
// tile — the draw COUNT is unchanged, so every later placement draw is untouched
// and non-unique boards are byte-identical to before this tuning. Min depth is 2
// (so silhouettes never show pre-dig — mystery is intended).
const DEPTH_MAP = [2, 3, 3] as const;

export function generateBoard(
	seed: number,
	uniqueId?: string | null
): PatchBoard {
	const rng = new Minstd(seed);
	const total = PATCH_ROWS * PATCH_COLS;

	// Draws 1–4: the find-set draws (server parity — see header).
	const orient = rng.nextInt(4);
	const vert = rng.nextInt(2);
	const shimmerPresent = rng.nextInt(2) === 1;
	const junkKind: ClaimableFind = rng.nextInt(2) === 0 ? "junk_boot" : "junk_wrap";

	// Draws 5+: layout only. One nextInt(3) draw per tile → depth via DEPTH_MAP
	// (draw count preserved, so all later placement draws are unchanged).
	const layers: number[] = new Array(total);
	for (let i = 0; i < total; i++) layers[i] = DEPTH_MAP[rng.nextInt(3)];

	const occupied: boolean[] = new Array(total).fill(false);
	const cells: (PatchCell | null)[] = new Array(total).fill(null);

	const truffleL = placeShape(rng, occupied, L_ORIENTS[orient]);
	for (const idx of truffleL) cells[idx] = { kind: "truffle_l" };

	const dominoOffsets: ReadonlyArray<readonly [number, number]> = vert
		? [
				[0, 0],
				[1, 0],
		  ]
		: [
				[0, 0],
				[0, 1],
		  ];
	const truffleD = placeShape(rng, occupied, dominoOffsets);
	for (const idx of truffleD) cells[idx] = { kind: "truffle_d" };

	const single: ReadonlyArray<readonly [number, number]> = [[0, 0]];
	if (shimmerPresent) {
		const [idx] = placeShape(rng, occupied, single);
		cells[idx] = { kind: "shimmer" };
	}
	for (let s = 0; s < 3; s++) {
		const [idx] = placeShape(rng, occupied, single);
		cells[idx] = { kind: "stone" };
	}
	{
		const [idx] = placeShape(rng, occupied, single);
		cells[idx] = { kind: junkKind };
	}

	// The unique relic — placed LAST, AFTER every existing draw, and ONLY when the
	// server rolled one (uniqueId non-null). This consumes PRNG draws only in the
	// unique case, so a non-unique board (uniqueId null/undefined) is byte-for-byte
	// identical to before uniques existed — determinism for non-unique boards is
	// unchanged. Single-cell, same placeShape single pattern as junk/shimmer.
	let unique: { id: string; idx: number } | null = null;
	if (uniqueId) {
		const [idx] = placeShape(rng, occupied, single);
		cells[idx] = { kind: "unique" };
		unique = { id: uniqueId, idx };
	}

	const finds: ClaimableFind[] = ["truffle_l", "truffle_d"];
	if (shimmerPresent) finds.push("shimmer");
	finds.push(junkKind);
	if (unique) finds.push("unique");

	return { layers, cells, finds, truffleL, truffleD, unique };
}

// ── Finds submission (server contract) ───────────────────────────────────────
//
// The set of finds to hand submit_rooting(p_finds text[]). It is ALWAYS a proper
// array, and every id in it is one the server accepts for THIS seed's board —
// board.finds === rooting_finds(seed) by the parity contract above. We intersect
// what the player collected against that authoritative set, so a submit can never
// carry a forged/client-invented id (rejected server-side as bad_finds) nor a
// stone (inert, unclaimable). Order-stable, deduped. Every dig game routes its
// pouch through here so the payload is uniform and seed-true — the game consumes
// the real board, it does not mint its own keys.
// LAST-GATE pouch normalizer for the submit chokepoint (useRooting.submit).
// Device logs proved a bare "shimmer" STRING can reach PostgREST as p_finds
// (→ 22P02 "malformed array literal") despite every typed caller passing
// arrays — so the hook normalizes ANY runtime shape (string / null / Set /
// array) into a real array before the seed-true intersection. Pure + tested.
export function normalizePouch(
	finds: ClaimableFind[] | ClaimableFind | Iterable<ClaimableFind> | null | undefined
): ClaimableFind[] {
	if (finds == null) return [];
	if (Array.isArray(finds)) return finds;
	if (typeof finds === "string") return [finds];
	return Array.from(finds);
}

export function claimableFinds(
	board: PatchBoard,
	collected: Iterable<Find>
): ClaimableFind[] {
	const valid = new Set<ClaimableFind>(board.finds);
	const out: ClaimableFind[] = [];
	const seen = new Set<ClaimableFind>();
	for (const f of collected) {
		if (f === "stone") continue; // stones are never claimable
		const cf = f as ClaimableFind;
		if (valid.has(cf) && !seen.has(cf)) {
			seen.add(cf);
			out.push(cf);
		}
	}
	return out;
}

/**
 * Map a touch point (view-local, border box) to a tile index, or -1 when the
 * point misses the grid. `inset` is the board's border width — the grid's
 * content box starts there. Pure; shared by the component and its tests so
 * render math and hit-test math can never drift apart.
 */
export function tileIndexAt(
	x: number,
	y: number,
	tileSize: number,
	inset: number
): number {
	if (tileSize <= 0) return -1;
	// Clamp (rather than reject) so an edge touch on the border still lands on
	// the nearest tile — preserves the dig's forgiving hit behavior.
	const c = Math.min(
		PATCH_COLS - 1,
		Math.max(0, Math.floor((x - inset) / tileSize))
	);
	const r = Math.min(
		PATCH_ROWS - 1,
		Math.max(0, Math.floor((y - inset) / tileSize))
	);
	return r * PATCH_COLS + c;
}

// ── Cluster geometry (pure display math) ─────────────────────────────────────

export interface ClusterBox {
	/** Center of the cluster in TILE units (col, row), e.g. {cx: 2.5, cy: 1.0}. */
	cx: number;
	cy: number;
	/** Bounding box span in tiles (≥1 each). */
	cols: number;
	rows: number;
}

/**
 * Centroid + bounding span of a truffle cluster's tile indices, in tile units.
 * Pure display math — feeds the one-big-sprite render so a multi-tile truffle
 * reads as ONE find, not N icons. Returns null for an empty cluster.
 */
export function clusterBox(indices: number[]): ClusterBox | null {
	if (indices.length === 0) return null;
	let minC = Infinity;
	let maxC = -Infinity;
	let minR = Infinity;
	let maxR = -Infinity;
	let sumC = 0;
	let sumR = 0;
	for (const idx of indices) {
		const r = Math.floor(idx / PATCH_COLS);
		const c = idx % PATCH_COLS;
		if (c < minC) minC = c;
		if (c > maxC) maxC = c;
		if (r < minR) minR = r;
		if (r > maxR) maxR = r;
		sumC += c;
		sumR += r;
	}
	// Centroid of cell CENTERS (each cell center is col+0.5, row+0.5 in tile units).
	return {
		cx: sumC / indices.length + 0.5,
		cy: sumR / indices.length + 0.5,
		cols: maxC - minC + 1,
		rows: maxR - minR + 1,
	};
}

// ── Feeding-window math ──────────────────────────────────────────────────────
// Four non-uniform commuter windows on one SERVER-OWNED Eastern clock. The
// client mirror is display-only; privileged RPCs derive the same clock from
// America/New_York and accept no phone offset. US DST transition instants are
// mirrored here so countdowns agree without relying on the device timezone.

interface DigClock {
	digDay: number;
	bucket: number;
	minute: number;
	baseLocalMinute: number;
	open: boolean;
}

function firstSunday(year: number, month: number): number {
	const weekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
	return 1 + ((7 - weekday) % 7);
}

/** Eastern offset at a UTC instant: -300 standard, -240 daylight. */
function easternOffsetMinutes(utcMs: number): number {
	const year = new Date(utcMs).getUTCFullYear();
	const marchSecondSunday = firstSunday(year, 2) + 7;
	const novemberFirstSunday = firstSunday(year, 10);
	const starts = Date.UTC(year, 2, marchSecondSunday, 7); // 02:00 EST
	const ends = Date.UTC(year, 10, novemberFirstSunday, 6); // 02:00 EDT
	return utcMs >= starts && utcMs < ends ? -240 : -300;
}

function localMinuteToUtcMs(localEpochMinute: number): number {
	// Schedule boundaries are 06:00 or later, never inside the repeated/missing
	// 02:00 DST hour. One standard-time guess therefore resolves unambiguously.
	const standardGuess = (localEpochMinute + 300) * 60000;
	return (localEpochMinute - easternOffsetMinutes(standardGuess)) * 60000;
}

function commuterClock(nowMs: number): DigClock {
	const localEpochMinute =
		Math.floor(nowMs / 60000) + easternOffsetMinutes(nowMs);
	const adjusted = localEpochMinute - DIG_DAY_ANCHOR_MIN;
	const digDay = Math.floor(adjusted / DIG_DAY_MIN);
	const minute = adjusted - digDay * DIG_DAY_MIN;
	let bucket = 0;
	for (let i = DIG_BUCKET_STARTS.length - 1; i >= 0; i--) {
		if (minute >= DIG_BUCKET_STARTS[i]) {
			bucket = i;
			break;
		}
	}
	return {
		digDay,
		bucket,
		minute,
		baseLocalMinute: digDay * DIG_DAY_MIN + DIG_DAY_ANCHOR_MIN,
		open:
			minute < DIG_BUCKET_STARTS[bucket] + DIG_BUCKET_OPEN_MINS[bucket],
	};
}

function normalizedBucket(win: number): number {
	return ((win % DIG_WINDOWS_PER_DAY) + DIG_WINDOWS_PER_DAY) %
		DIG_WINDOWS_PER_DAY;
}

export function windowIndex(
	nowMs: number = Date.now(),
	sched?: FeedingSchedule
): number {
	const active = sched ?? feedingSchedule();
	if (active.mode === "commuter_eastern") {
		const c = commuterClock(nowMs);
		return c.digDay * DIG_WINDOWS_PER_DAY + c.bucket;
	}
	return Math.floor((nowMs / 1000 - active.offsetSecs) / active.windowSecs);
}

export function windowEndsAtMs(
	win: number,
	sched?: FeedingSchedule
): number {
	const active = sched ?? feedingSchedule();
	if (active.mode === "commuter_eastern") {
		const digDay = Math.floor(win / DIG_WINDOWS_PER_DAY);
		const bucket = normalizedBucket(win);
		const endMinute =
			bucket < DIG_WINDOWS_PER_DAY - 1
				? DIG_BUCKET_STARTS[bucket + 1]
				: DIG_DAY_MIN;
		return localMinuteToUtcMs(
			digDay * DIG_DAY_MIN + DIG_DAY_ANCHOR_MIN + endMinute
		);
	}
	return ((win + 1) * active.windowSecs + active.offsetSecs) * 1000;
}

/** "2h 10m" until the Hunger's next gorge (end of the current feeding). */
export function feedingCountdown(nowMs: number = Date.now()): string {
	const left = Math.max(0, windowEndsAtMs(windowIndex(nowMs)) - nowMs);
	return formatLeft(left);
}

// The patch/feeding countdowns never show "0m" (a sub-minute tail floors up
// to "1m"), hence minMinute:1 on the shared formatHM kernel.
const formatLeft = (leftMs: number): string => formatHM(leftMs, { minMinute: 1 });

// ── Patch phases ─────────────────────────────────────────────────────────────
// Within each feeding window the patch alternates: OPEN for the first
// openSecs (dig while he gorges), then GUARDED for the rest (cooldown).
// A session opened in-phase may still submit until the window ends. MUST
// match the server's patch_phase_open() (migrations 20260721000000 →
// 20260744100000 — the config-driven anchor).

/** True while the patch is diggable (the open head of the current window). */
export function patchPhaseOpen(
	nowMs: number = Date.now(),
	sched?: FeedingSchedule
): boolean {
	const active = sched ?? feedingSchedule();
	if (active.mode === "commuter_eastern") return commuterClock(nowMs).open;
	// epoch − offset is positive for any real date, so % never goes negative.
	return (nowMs / 1000 - active.offsetSecs) % active.windowSecs < active.openSecs;
}

/** Ms timestamp when the CURRENT open phase closes (only valid while open). */
export function phaseClosesAtMs(
	nowMs: number = Date.now(),
	sched?: FeedingSchedule
): number {
	const active = sched ?? feedingSchedule();
	if (active.mode === "commuter_eastern") {
		const c = commuterClock(nowMs);
		return localMinuteToUtcMs(
			c.baseLocalMinute +
				DIG_BUCKET_STARTS[c.bucket] +
				DIG_BUCKET_OPEN_MINS[c.bucket]
		);
	}
	return (
		(windowIndex(nowMs, active) * active.windowSecs +
			active.offsetSecs +
			active.openSecs) *
		1000
	);
}

/** Ms timestamp of the NEXT open phase (= the next window's start). */
export function nextOpenAtMs(
	nowMs: number = Date.now(),
	sched?: FeedingSchedule
): number {
	const active = sched ?? feedingSchedule();
	return windowEndsAtMs(windowIndex(nowMs, active), active);
}

/** Current commuter bucket geometry for the Feeding strip. */
export function patchWindowShape(nowMs: number = Date.now()): {
	open: boolean;
	openFrac: number;
	marker: number;
} {
	const active = feedingSchedule();
	if (active.mode !== "commuter_eastern") {
		const intoWindow =
			(nowMs / 1000 - active.offsetSecs) % active.windowSecs;
		return {
			open: intoWindow < active.openSecs,
			openFrac: active.openSecs / active.windowSecs,
			marker: Math.max(0, Math.min(1, intoWindow / active.windowSecs)),
		};
	}
	const c = commuterClock(nowMs);
	const start = DIG_BUCKET_STARTS[c.bucket];
	const end =
		c.bucket < DIG_WINDOWS_PER_DAY - 1
			? DIG_BUCKET_STARTS[c.bucket + 1]
			: DIG_DAY_MIN;
	const length = end - start;
	return {
		open: c.open,
		openFrac: DIG_BUCKET_OPEN_MINS[c.bucket] / length,
		marker: Math.max(0, Math.min(1, (c.minute - start) / length)),
	};
}

/** "1h 12m" until the current open phase closes. */
export function phaseClosesCountdown(nowMs: number = Date.now()): string {
	return formatLeft(Math.max(0, phaseClosesAtMs(nowMs) - nowMs));
}

/** "3h 45m" until the patch next opens. */
export function nextOpenCountdown(nowMs: number = Date.now()): string {
	return formatLeft(Math.max(0, nextOpenAtMs(nowMs) - nowMs));
}

/**
 * The one phase view every Feeding-clock consumer reads — the phase PAIRED with
 * its own honest countdown, so a wrong pairing is unrepresentable. `countdown`
 * is the phase's own number: OPEN → time until it CLOSES; GUARDED → time until
 * it next OPENS. The CTA renders this number directly; the banner reads the same
 * view (its guarded "opens in" line IS this guarded countdown), so the two
 * surfaces can never disagree on the phase or the number. Pure; nowMs pins it.
 */
export interface FeedingPhaseView {
	open: boolean;
	countdown: string;
}

export function feedingPhaseView(nowMs: number = Date.now()): FeedingPhaseView {
	const forced = getDevSeasonOverrides().phase;
	if (forced) {
		return { open: forced === "open", countdown: "dev · forced" };
	}
	const open = patchPhaseOpen(nowMs);
	return {
		open,
		countdown: open ? phaseClosesCountdown(nowMs) : nextOpenCountdown(nowMs),
	};
}

/** The patch's primary action label, shared by every season entry point. */
export function patchCtaLabel(phaseOpen: boolean, countdown: string): string {
	return phaseOpen ? "Dig now" : `Opening in ${countdown}`;
}

// ── Feeding-CTA state derivation (pure — pins the stale-dug fix) ─────────────
//
// THE ROLLOVER BUG (founder report): "dug this feeding — opens in 2h" was still
// "dug" hours later. Two causes, both fixed at this seam:
//   1. the dug flag was a plain boolean captured when the dig landed — nothing
//      expired it when the 8h window rolled over. The fix: store the WINDOW the
//      dig happened in and re-compare against the live clock every render, so
//      the flag expires by construction the instant the window rolls.
//   2. the banner paired its "opens in" copy with the CTA's one shared countdown
//      string — which is a CLOSES-in while the phase is open. bannerDigStatus
//      derives both the words AND the number from the phase, so the wrong
//      pairing is unrepresentable.

/** True while a dig recorded in `dugWindow` still belongs to the current feeding. */
export function dugInCurrentWindow(
	dugWindow: number | null,
	nowMs: number = Date.now()
): boolean {
	return dugWindow !== null && dugWindow === windowIndex(nowMs);
}

/**
 * The banner footer's status line for a phase × dug pair — or null when the
 * state is the live "dig this feeding ›" button (open + not dug). A thin
 * projection of feedingPhaseView + the dug flag: the guarded "opens in" number
 * is the SHARED phase view's guarded countdown (the only honest "opens in"), so
 * it can never disagree with the CTA; open + dug carries no number at all —
 * a closes-in time can never ride under "opens in" copy.
 */
export function bannerDigStatus(
	phaseOpen: boolean,
	dug: boolean,
	nowMs: number = Date.now()
): string | null {
	if (phaseOpen && !dug) return null; // the button state — no status line
	if (phaseOpen) return "dug this feeding — back next feeding ★";
	// Guarded: read the opens-in number off the shared view (identical to the
	// CTA's countdown while guarded), so both surfaces show the same number.
	const opensIn = feedingPhaseView(nowMs).countdown;
	return dug
		? `dug this feeding — opens in ${opensIn}`
		: patchCtaLabel(false, opensIn);
}

// Deterministic client seed kernel — FNV-1a folded into the Park–Miller range
// [1, 2147483646]. This is the CLIENT'S own derivation and does NOT need to
// match Postgres hashtext (the server hands the authoritative seed back through
// open_rooting; a locally-predicted board always loses to the server board —
// see hooks/useRooting, which stores r.seed, never a local guess).
function fnv1aSeed(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h * 16777619) >>> 0;
	}
	return (h % 2147483646) + 1;
}

// Practice-mode seed (no server row): any deterministic int in [1, 2147483646] —
// FNV-1a over war+window. Does NOT need to match hashtext. Practice stays fully
// per-warId (it is NEVER crew-shared) — the seeded-crew unlock is a real-dig
// property, so practice boards are unchanged by wedge 5a.
export function practiceSeed(warId: string, win: number): number {
	return fnv1aSeed(`${warId}:${win}`);
}

// SEEDED CREW BOARDS (wedge 5a) — the client mirror of the server derivation
// f(window, crew_id | user_id) (migration 20260748000000). Same shape as the
// server: identical for every pig in the SAME (window, group), different across
// groups, so a client that wants to PREDICT the herd's shared patch (a preview
// before open_rooting returns, or an un-pushed server) gets a board comparable
// in-herd. `groupId` is the crew id for a Sounder pig, or the user id for a
// solo/crewless pig — exactly the server's COALESCE(my_crew, caller_id). Byte
// parity with hashtext is NOT required (same posture as practiceSeed): whenever
// the server answers, open_rooting's seed wins. The string mirrors the server's
// `win::text || ':' || group::text` ordering.
export function crewBoardSeed(win: number, groupId: string): number {
	return fnv1aSeed(`${win}:${groupId}`);
}

// ── Dig physics — the splash kernel + cluster queries ───────────────────────
//
// ONE splash kernel owns the dig math so the live component and the depth-tuning
// simulation can never drift apart. A dig takes depth off the target tile and
// HALF as much off each orthogonal neighbour (edge tiles simply have fewer
// neighbours). The two dig kinds differ only in force:
//   rub   — quiet: −1 target, −0.5 orthogonal neighbours;
//   shove — loud:  −2 target, −1   orthogonal neighbours.
// Depth is clamped at 0 (you can't un-bury mud). Mutates `layers` IN PLACE —
// callers pass a fresh copy when they need the before-state (the component
// diffs before/after to pop newly-cleared tiles). This is the SAME physics
// simulateGreedyClear probes for clearability, so the tuning test pins the real
// kernel, not a copy of it.
const SPLASH: Record<"rub" | "shove", { target: number; neighbor: number }> = {
	rub: { target: 1, neighbor: 0.5 },
	shove: { target: 2, neighbor: 1 },
};

export function applySplash(
	layers: number[],
	idx: number,
	kind: "rub" | "shove"
): void {
	if (idx < 0 || idx >= layers.length) return;
	const { target, neighbor } = SPLASH[kind];
	const dig = (i: number, amt: number) => {
		if (i >= 0 && i < layers.length) layers[i] = Math.max(0, layers[i] - amt);
	};
	const r = Math.floor(idx / PATCH_COLS);
	const c = idx % PATCH_COLS;
	dig(idx, target);
	if (r > 0) dig(idx - PATCH_COLS, neighbor);
	if (r < PATCH_ROWS - 1) dig(idx + PATCH_COLS, neighbor);
	if (c > 0) dig(idx - 1, neighbor);
	if (c < PATCH_COLS - 1) dig(idx + 1, neighbor);
}

// ── Cluster state queries (READ-ONLY over the parity-locked board + depths) ──
//
// A "find" is one or more tiles: a truffle is a 2–3-tile CLUSTER (board.truffleL
// / board.truffleD), the shimmer/unique/junk are single cells. These name the
// two cluster states every reader kept re-deriving from the raw index arrays, so
// the component, the miss-carry query and the tests all ask the same question.

/** True when every cell of a (non-empty) cluster is cleared — the completion
 *  test that fires a truffle collect. An empty cluster is never "revealed". */
export function clusterRevealed(cluster: number[], layers: number[]): boolean {
	return cluster.length > 0 && cluster.every((i) => layers[i] <= 0);
}

/** True when AT LEAST ONE cell of a cluster is cleared — the partial-reveal test
 *  that marks a find as "the one that got away" when it never fully lands. */
export function clusterTouched(cluster: number[], layers: number[]): boolean {
	return cluster.some((i) => layers[i] <= 0);
}

/** The collapse representative of a cluster: its lowest tile index (row-major),
 *  or -1 when empty. A multi-tile truffle collapses to this single anchor for the
 *  spoiler-light share grid, so a cluster reads as ONE find. Companion to
 *  clusterBox (which gives the render centroid). */
export function clusterAnchor(cluster: number[]): number {
	return cluster.length === 0 ? -1 : Math.min(...cluster);
}

// ── Stir accounting (pure, for tests + the component) ───────────────────────

export function stirCost(action: "rub" | "shove"): number {
	return action === "rub" ? STIR_RUB : STIR_SHOVE;
}

// ── Warm/cold proximity + quiet streak (skill layer — pure + tested) ─────────
//
// Both are READ-ONLY over the board + the live layer depths. They never touch
// board contents or the server-parity derivation above (that math is sacred).
// They add a cozy skill texture on top: a warmer/colder whisper toward the
// nearest still-buried sweet find, and a "quiet streak" that gifts a free
// (0-stir) rub for a run of useful reveals.

// The rewarding finds a warm/cold whisper points toward + a streak counts: the
// two truffle clusters and the shimmer. Junk / stones are not "sweet".
const SWEET_KINDS: ReadonlySet<Find> = new Set<Find>([
	"truffle_l",
	"truffle_d",
	"shimmer",
	"unique",
]);

/**
 * Chebyshev (king-move) distance from `tileIdx` to the nearest STILL-BURIED
 * sweet find (a truffle/shimmer cell whose depth is still > 0). Returns null
 * when nothing sweet is left buried. Pure: reads board.cells + the live
 * `layers` depths only — it can never mutate the parity-locked board.
 */
export function nearestFindDistance(
	board: PatchBoard,
	layers: number[],
	tileIdx: number
): number | null {
	const fromR = Math.floor(tileIdx / PATCH_COLS);
	const fromC = tileIdx % PATCH_COLS;
	let best: number | null = null;
	for (let i = 0; i < board.cells.length; i++) {
		const cell = board.cells[i];
		if (!cell || !SWEET_KINDS.has(cell.kind)) continue;
		if (layers[i] <= 0) continue; // already uncovered — not a hint target
		const r = Math.floor(i / PATCH_COLS);
		const c = i % PATCH_COLS;
		const d = Math.max(Math.abs(r - fromR), Math.abs(c - fromC));
		if (best === null || d < best) best = d;
	}
	return best;
}

/** The warmer/colder whisper for a proximity distance (null = nothing left). */
export function warmthWhisper(dist: number | null): string | null {
	if (dist === null) return null;
	if (dist <= 1) return "something sweet, right under your snout…";
	if (dist === 2) return "warmer…";
	return "cold mud out here.";
}

/**
 * Did this action just FINISH uncovering at least one cell of a sweet find?
 * (before[i] was buried, after[i] is clear, and cell i is a truffle/shimmer.)
 * This is the "useful reveal" test that feeds the quiet streak. Pure.
 */
export function revealedSweetCell(
	board: PatchBoard,
	before: number[],
	after: number[]
): boolean {
	for (let i = 0; i < board.cells.length; i++) {
		const cell = board.cells[i];
		if (!cell || !SWEET_KINDS.has(cell.kind)) continue;
		if (before[i] > 0 && after[i] <= 0) return true;
	}
	return false;
}

// A run of this many consecutive useful reveals gifts the next action for free.
export const QUIET_STREAK_LEN = 3;

/**
 * Advance the quiet-streak counter for one action.
 * @param prev   the streak count BEFORE this action
 * @param useful did this action finish revealing a sweet cell?
 * @returns the new streak count + whether the NEXT action should be free
 *          (0 stir). Hitting {@link QUIET_STREAK_LEN} pays out and resets to 0;
 *          any non-useful action breaks the streak.
 */
export function nextStreak(
	prev: number,
	useful: boolean
): { streak: number; freeNext: boolean } {
	if (!useful) return { streak: 0, freeNext: false };
	const streak = prev + 1;
	if (streak >= QUIET_STREAK_LEN) return { streak: 0, freeNext: true };
	return { streak, freeNext: false };
}

// ── The One That Got Away — carry-over helpers (pure, tested) ────────────────
//
// A find you left HALF-DUG (any cell of it cleared, but the whole find never
// collected) is "the one that got away" — it comes back next feeding GILDED.
// Only truffle_l / truffle_d / unique carry (shimmer is a parity-locked draw
// that can't be forced onto a board; junk/stone never carry). These helpers are
// READ-ONLY over the parity-locked board + the live layer depths.

/**
 * The carry-eligible finds that were PARTIALLY revealed but NOT collected this
 * dig: a truffle cluster / unique cell that had at least one cell cleared
 * (layers[i] <= 0) yet the find never landed in `collected`. Returned as the
 * literal submit tokens ("truffle_l" | "truffle_d" | "unique"), deduped and
 * order-stable — these are handed to submit_rooting as p_missed so the server
 * can gild the one that got away. Pure: reads board.cells + the live `layers`
 * depths only. A fully-collected find is never a miss; an untouched find (no
 * cell cleared) is never a miss either.
 */
export function partiallyRevealedFinds(
	board: PatchBoard,
	layers: number[],
	collected: Iterable<Find>
): ClaimableFind[] {
	const got = new Set<Find>(collected);
	const out: ClaimableFind[] = [];
	const seen = new Set<ClaimableFind>();
	// Every carry-eligible find as (kind, its tiles): the two truffle clusters and
	// the unique treated as a single-cell "cluster". Partial = any cell cleared
	// (clusterTouched), the find never collected. Order-stable, deduped.
	const carriers: [ClaimableFind, number[]][] = [
		["truffle_l", board.truffleL],
		["truffle_d", board.truffleD],
		["unique", board.unique ? [board.unique.idx] : []],
	];
	for (const [kind, cells] of carriers) {
		if (cells.length === 0 || got.has(kind) || seen.has(kind)) continue;
		if (clusterTouched(cells, layers)) {
			seen.add(kind);
			out.push(kind);
		}
	}
	return out;
}

/**
 * The silhouette depth threshold for a gilded find: a gilded find's silhouette
 * shows ONE mud layer earlier per gild stack. A plain find silhouettes at
 * depth <= 1; a find gilded to `gild` (1..3) silhouettes at depth <= 1 + gild.
 * `gild` 0 (or null/undefined — feature-dark) → the plain threshold. Pure.
 */
export function gildedSilhouetteDepth(gild: number | null | undefined): number {
	const g = gild == null || gild < 0 ? 0 : Math.min(3, Math.floor(gild));
	return 1 + g;
}

// ── Board clearability simulation (pure — pins the depth tuning) ─────────────
//
// A greedy digger that always RUBS the highest-remaining-depth tile until the
// stir budget is spent, then reports the fraction of total mud depth cleared.
// It rubs through the SHARED applySplash kernel — the exact physics the live
// component digs with — so this "is a board ~60–70% clearable, not ~100%" probe
// pins the real dig math, and a future depth change can't silently make boards
// fully clearable again.
export function simulateGreedyClear(
	seed: number,
	stirBudget: number,
	rubCost: number = STIR_RUB
): number {
	const layers = generateBoard(seed).layers.map((d) => d); // fresh copy
	const total = layers.reduce((a, d) => a + d, 0);
	let spent = 0;
	while (spent + rubCost <= stirBudget) {
		// Pick the deepest still-buried tile (ties broken by lowest index).
		let best = -1;
		let bestDepth = 0;
		for (let i = 0; i < layers.length; i++) {
			if (layers[i] > bestDepth) {
				bestDepth = layers[i];
				best = i;
			}
		}
		if (best < 0) break; // board fully cleared before budget ran out
		applySplash(layers, best, "rub");
		spent += rubCost;
	}
	const remaining = layers.reduce((a, d) => a + d, 0);
	return (total - remaining) / total;
}
