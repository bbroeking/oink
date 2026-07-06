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
	PATCH_COLS,
	PATCH_ROWS,
	ROOTING_WINDOW_SECS,
	STIR_RUB,
	STIR_SHOVE,
} from "@/constants/mudFights";

export type Find =
	| "truffle_l"
	| "truffle_d"
	| "shimmer"
	| "stone"
	| "junk_boot"
	| "junk_wrap";

// A claimable find (what submit_rooting accepts): everything except stones.
export type ClaimableFind = Exclude<Find, "stone">;

export interface PatchCell {
	kind: Find;
}

export interface PatchBoard {
	/** Mud depth per tile, 1–3, row-major (idx = row * PATCH_COLS + col). */
	layers: number[];
	/** Buried content per tile (null = plain mud). */
	cells: (PatchCell | null)[];
	/** The find ids present on this board — MUST equal rooting_finds(seed). */
	finds: ClaimableFind[];
	/** Tile indices of each truffle cluster (for completion detection). */
	truffleL: number[];
	truffleD: number[];
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

export function generateBoard(seed: number): PatchBoard {
	const rng = new Minstd(seed);
	const total = PATCH_ROWS * PATCH_COLS;

	// Draws 1–4: the find-set draws (server parity — see header).
	const orient = rng.nextInt(4);
	const vert = rng.nextInt(2);
	const shimmerPresent = rng.nextInt(2) === 1;
	const junkKind: ClaimableFind = rng.nextInt(2) === 0 ? "junk_boot" : "junk_wrap";

	// Draws 5+: layout only.
	const layers: number[] = new Array(total);
	for (let i = 0; i < total; i++) layers[i] = 1 + rng.nextInt(3);

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

	const finds: ClaimableFind[] = ["truffle_l", "truffle_d"];
	if (shimmerPresent) finds.push("shimmer");
	finds.push(junkKind);

	return { layers, cells, finds, truffleL, truffleD };
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

// ── Feeding-window math ──────────────────────────────────────────────────────

export function windowIndex(nowMs: number = Date.now()): number {
	return Math.floor(nowMs / 1000 / ROOTING_WINDOW_SECS);
}

export function windowEndsAtMs(win: number): number {
	return (win + 1) * ROOTING_WINDOW_SECS * 1000;
}

/** "2h 10m" until the Hunger's next gorge (end of the current feeding). */
export function feedingCountdown(nowMs: number = Date.now()): string {
	const left = Math.max(0, windowEndsAtMs(windowIndex(nowMs)) - nowMs);
	const h = Math.floor(left / 3600000);
	const m = Math.floor((left % 3600000) / 60000);
	return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

// Practice-mode seed (migration not applied yet): any deterministic int in
// [1, 2147483646] — FNV-1a over war+window. Does NOT need to match hashtext.
export function practiceSeed(warId: string, win: number): number {
	const s = `${warId}:${win}`;
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h * 16777619) >>> 0;
	}
	return (h % 2147483646) + 1;
}

// ── Stir accounting (pure, for tests + the component) ───────────────────────

export function stirCost(action: "rub" | "shove"): number {
	return action === "rub" ? STIR_RUB : STIR_SHOVE;
}
