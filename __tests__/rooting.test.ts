// Unit tests for the Truffle Patch pure helpers. The board-gen values MUST
// match supabase/migrations/20260704100000_truffle_patch.sql — the parity
// contract is: PRNG = Park–Miller minstd, and the FIRST FOUR DRAWS define the
// find set (L orientation, domino orientation, shimmer present, junk type);
// the server consumes only those four (rooting_finds()).

jest.mock("../utils/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("../utils/log", () => ({ log: { error: jest.fn() } }));

import {
	Minstd,
	generateBoard,
	simulateGreedyClear,
	claimableFinds,
	normalizePouch,
	windowIndex,
	windowEndsAtMs,
	feedingCountdown,
	practiceSeed,
	stirCost,
	nearestFindDistance,
	warmthWhisper,
	revealedSweetCell,
	nextStreak,
	tileIndexAt,
	clusterBox,
	partiallyRevealedFinds,
	gildedSilhouetteDepth,
	QUIET_STREAK_LEN,
	patchPhaseOpen,
	phaseClosesAtMs,
	nextOpenAtMs,
	phaseClosesCountdown,
	nextOpenCountdown,
} from "../utils/rooting";
import type { Find, PatchBoard } from "../utils/rooting";
import {
	PATCH_COLS,
	PATCH_OPEN_SECS,
	PATCH_ROWS,
	ROOTING_WINDOW_SECS,
	STIR_BUDGET,
	STIR_RUB,
	STIR_SHOVE,
} from "../constants/dig";

// Mirrors rooting_finds() in the migration: consume exactly four draws.
function serverFinds(seed: number): string[] {
	const rng = new Minstd(seed);
	rng.nextInt(4); // L orientation (layout-only)
	rng.nextInt(2); // domino orientation (layout-only)
	const shimmer = rng.nextInt(2) === 1;
	const junk = rng.nextInt(2) === 0 ? "junk_boot" : "junk_wrap";
	const finds = ["truffle_l", "truffle_d"];
	if (shimmer) finds.push("shimmer");
	finds.push(junk);
	return finds;
}

describe("Minstd PRNG", () => {
	test("Park–Miller sequence from seed 1", () => {
		const rng = new Minstd(1);
		// minstd_rand0 canonical first values from state 1.
		expect(rng.next()).toBe(16807);
		expect(rng.next()).toBe(282475249);
	});

	test("stays in [1, 2147483646] over many draws", () => {
		const rng = new Minstd(123456);
		for (let i = 0; i < 10000; i++) {
			const v = rng.next();
			expect(v).toBeGreaterThanOrEqual(1);
			expect(v).toBeLessThanOrEqual(2147483646);
		}
	});
});

describe("generateBoard", () => {
	test("deterministic: same seed → identical board", () => {
		const a = generateBoard(987654321);
		const b = generateBoard(987654321);
		expect(a).toEqual(b);
	});

	test("different seeds → different boards (overwhelmingly)", () => {
		const a = generateBoard(1111);
		const b = generateBoard(2222);
		expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
	});

	test("board shape: counts, bounds, no overlaps", () => {
		for (const seed of [1, 42, 999983, 2147483646, 1234567]) {
			const board = generateBoard(seed);
			expect(board.layers).toHaveLength(PATCH_ROWS * PATCH_COLS);
			for (const l of board.layers) {
				// Depth tuning (2026-07-11): min depth is now 2 ({0→2,1→3,2→3}) so
				// silhouettes never show pre-dig and boards aren't fully clearable.
				expect(l).toBeGreaterThanOrEqual(2);
				expect(l).toBeLessThanOrEqual(3);
			}
			// Clusters: 3-tile L + 2-tile domino, disjoint, in bounds.
			expect(board.truffleL).toHaveLength(3);
			expect(board.truffleD).toHaveLength(2);
			const all = board.cells
				.map((c, i) => (c ? i : -1))
				.filter((i) => i >= 0);
			// 3 (L) + 2 (domino) + 3 stones + 1 junk + 0-1 shimmer.
			expect(all.length === 9 || all.length === 10).toBe(true);
			expect(new Set(all).size).toBe(all.length); // occupancy = no overlap
			const stones = board.cells.filter((c) => c?.kind === "stone").length;
			expect(stones).toBe(3);
			const junk = board.cells.filter(
				(c) => c?.kind === "junk_boot" || c?.kind === "junk_wrap"
			).length;
			expect(junk).toBe(1);
		}
	});

	test("PARITY: client find set === server rooting_finds (first four draws)", () => {
		for (const seed of [1, 7, 42, 31337, 999983, 2147483646]) {
			const board = generateBoard(seed);
			expect([...board.finds].sort()).toEqual(serverFinds(seed).sort());
		}
	});

	test("domino cells are adjacent; L cells form an L", () => {
		const board = generateBoard(5555);
		const [a, b] = board.truffleD;
		const dr = Math.abs(Math.floor(a / PATCH_COLS) - Math.floor(b / PATCH_COLS));
		const dc = Math.abs((a % PATCH_COLS) - (b % PATCH_COLS));
		expect(dr + dc).toBe(1); // orthogonally adjacent
		expect(new Set(board.truffleL).size).toBe(3);
	});

	test("no unique by default: board.unique is null, no 'unique' find", () => {
		for (const seed of [1, 42, 999983, 1234567]) {
			const board = generateBoard(seed);
			expect(board.unique).toBeNull();
			expect(board.finds).not.toContain("unique");
		}
	});
});

// ── Uniques — the Season 1 relic pool placement (client-only) ────────────────
describe("generateBoard — unique relic placement", () => {
	test("a no-unique board is IDENTICAL to today's board (determinism)", () => {
		// Passing null/undefined must not consume any PRNG draw — the board is
		// byte-for-byte what it was before uniques existed.
		for (const seed of [1, 7, 42, 31337, 999983, 2147483646]) {
			expect(generateBoard(seed, null)).toEqual(generateBoard(seed));
			expect(generateBoard(seed, undefined)).toEqual(generateBoard(seed));
		}
	});

	test("same seed + same uniqueId → same idx (deterministic placement)", () => {
		for (const seed of [1, 42, 999983]) {
			const a = generateBoard(seed, "milk_tooth");
			const b = generateBoard(seed, "milk_tooth");
			expect(a.unique).toEqual(b.unique);
			expect(a.unique).not.toBeNull();
		}
	});

	test("the unique is a single cell, disjoint from every other find", () => {
		for (const seed of [1, 42, 999983, 1234567]) {
			const board = generateBoard(seed, "tiny_crown");
			const idx = board.unique!.idx;
			expect(board.cells[idx]?.kind).toBe("unique");
			// It occupies exactly ONE new cell — occupancy total is 10 or 11
			// (base 9-10 + the relic).
			const occupied = board.cells
				.map((c, i) => (c ? i : -1))
				.filter((i) => i >= 0);
			expect(new Set(occupied).size).toBe(occupied.length); // no overlap
			expect(occupied).toContain(idx);
		}
	});

	test("board.finds carries 'unique' ONLY when a relic is present", () => {
		const withUnique = generateBoard(42, "old_boot");
		expect(withUnique.finds).toContain("unique");
		expect(withUnique.unique).toEqual({ id: "old_boot", idx: expect.any(Number) });
		const without = generateBoard(42);
		expect(without.finds).not.toContain("unique");
	});

	test("PARITY still holds: a unique board's NON-unique finds match the server", () => {
		// The server's rooting_finds() never emits 'unique' (it's validated against
		// the row's unique_id, not the seed). So the seed-derived find set is
		// unchanged; only 'unique' is appended when a relic is carried.
		for (const seed of [1, 7, 42, 31337]) {
			const board = generateBoard(seed, "first_truffle");
			const nonUnique = board.finds.filter((f) => f !== "unique");
			expect([...nonUnique].sort()).toEqual(serverFinds(seed).sort());
		}
	});

	test("claimableFinds passes 'unique' when the board carries a relic", () => {
		const board = generateBoard(42, "jam_letter");
		const out = claimableFinds(board, ["truffle_l", "unique"] as Find[]);
		expect(out).toContain("unique");
		// A board WITHOUT the relic drops a forged 'unique'.
		const plain = generateBoard(42);
		expect(claimableFinds(plain, ["unique"] as Find[])).not.toContain("unique");
	});
});

// ── Depth tuning — boards must be ~60–70% clearable, NOT ~100% ───────────────
// A greedy digger (always rub the deepest tile) with the 20-stir budget must
// clear between 55% and 80% of total depth units across seeds. This pins the
// {0→2,1→3,2→3} mapping so a future change can't silently make boards fully
// clearable again.
describe("board clearability simulation (depth tuning)", () => {
	test("greedy digger clears 55–80% of the mud across seeds 1..20", () => {
		for (let seed = 1; seed <= 20; seed++) {
			const frac = simulateGreedyClear(seed, STIR_BUDGET);
			expect(frac).toBeGreaterThanOrEqual(0.55);
			expect(frac).toBeLessThanOrEqual(0.8);
		}
	});
});

describe("claimableFinds — the submit_rooting payload builder", () => {
	// A seed whose board carries a shimmer, so we can exercise the shimmer path.
	const shimmerSeed = [1, 7, 42, 31337, 999983, 2147483646, 5555, 12345].find(
		(s) => generateBoard(s).finds.includes("shimmer")
	)!;

	test("always returns a real array — even for a single find", () => {
		const board = generateBoard(shimmerSeed);
		const out = claimableFinds(board, new Set<Find>(["shimmer"]));
		expect(Array.isArray(out)).toBe(true);
		expect(out).toEqual(["shimmer"]); // a proper text[] element, not a scalar
	});

	test("drops stones — they are inert / unclaimable", () => {
		const board = generateBoard(42);
		const out = claimableFinds(board, new Set<Find>(["truffle_l", "stone"]));
		expect(out).not.toContain("stone");
		expect(out).toContain("truffle_l");
	});

	test("drops forged / not-on-this-board ids (never sends bad_finds)", () => {
		// A board WITHOUT a shimmer: collecting one anyway must not leak through.
		const noShimmer = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(
			(s) => !generateBoard(s).finds.includes("shimmer")
		)!;
		const board = generateBoard(noShimmer);
		const out = claimableFinds(board, new Set<Find>(["truffle_l", "shimmer"]));
		expect(out).not.toContain("shimmer");
		expect(out).toContain("truffle_l");
	});

	test("dedupes and preserves first-seen order", () => {
		const board = generateBoard(shimmerSeed);
		// Arrays (not Sets) can carry dupes — the builder must collapse them.
		const out = claimableFinds(board, [
			"truffle_l",
			"truffle_l",
			"shimmer",
			"truffle_l",
		] as Find[]);
		expect(out).toEqual(["truffle_l", "shimmer"]);
	});

	test("empty collection → empty array", () => {
		const board = generateBoard(42);
		expect(claimableFinds(board, new Set<Find>())).toEqual([]);
	});

	test("output is always a subset of the seed's server-valid finds", () => {
		for (const seed of [1, 7, 42, 31337, 999983, 2147483646]) {
			const board = generateBoard(seed);
			// Throw every possible find at it, including junk + stone.
			const all: Find[] = [
				"truffle_l",
				"truffle_d",
				"shimmer",
				"junk_boot",
				"junk_wrap",
				"stone",
			];
			const out = claimableFinds(board, all);
			expect(Array.isArray(out)).toBe(true);
			for (const f of out) {
				expect(board.finds).toContain(f); // every id is server-valid
				expect(f).not.toBe("stone");
			}
		}
	});
});

describe("normalizePouch — the last gate before p_finds (22P02 regression)", () => {
	// Device repro: a bare "shimmer" STRING reached PostgREST as a scalar and
	// Postgres threw 22P02 `malformed array literal: "shimmer"`. The submit
	// chokepoint (useRooting.submit) now normalizes any runtime shape and
	// re-intersects against the seeded board, so this class of payload can
	// never leave the client again.
	function seedWithShimmer(): number {
		for (let seed = 1; seed < 500; seed++) {
			if (generateBoard(seed).finds.includes("shimmer")) return seed;
		}
		throw new Error("no shimmer seed found");
	}

	it("wraps the exact device payload (bare string) into a valid array", () => {
		const seed = seedWithShimmer();
		const pouch = normalizePouch("shimmer" as never);
		expect(Array.isArray(pouch)).toBe(true);
		const safe = claimableFinds(generateBoard(seed), pouch);
		expect(safe).toEqual(["shimmer"]);
	});

	it("passes arrays through untouched and materializes Sets", () => {
		expect(normalizePouch(["truffle_l", "shimmer"] as never)).toEqual([
			"truffle_l",
			"shimmer",
		]);
		expect(normalizePouch(new Set(["truffle_l"]) as never)).toEqual([
			"truffle_l",
		]);
	});

	it("null/undefined become the empty array (never a scalar)", () => {
		expect(normalizePouch(null)).toEqual([]);
		expect(normalizePouch(undefined)).toEqual([]);
	});

	it("a forged single-string id still gets board-intersected away", () => {
		const seed = seedWithShimmer();
		const safe = claimableFinds(
			generateBoard(seed),
			normalizePouch("not_a_real_find" as never)
		);
		expect(safe).toEqual([]);
	});
});

describe("feeding windows", () => {
	test("windowIndex buckets by 8h epochs", () => {
		const w0 = windowIndex(0);
		expect(w0).toBe(0);
		expect(windowIndex(ROOTING_WINDOW_SECS * 1000 - 1)).toBe(0);
		expect(windowIndex(ROOTING_WINDOW_SECS * 1000)).toBe(1);
	});

	test("windowEndsAtMs is the next boundary", () => {
		const now = 1_750_000_000_000;
		const win = windowIndex(now);
		const end = windowEndsAtMs(win);
		expect(end).toBeGreaterThan(now);
		expect(end - now).toBeLessThanOrEqual(ROOTING_WINDOW_SECS * 1000);
	});

	test("feedingCountdown formats h/m", () => {
		const boundary = windowEndsAtMs(windowIndex(1_750_000_000_000));
		expect(feedingCountdown(boundary - 2 * 3600000 - 10 * 60000)).toBe("2h 10m");
		expect(feedingCountdown(boundary - 5 * 60000)).toBe("5m");
	});
});

describe("practiceSeed", () => {
	test("deterministic and in Park–Miller range", () => {
		const a = practiceSeed("war-abc", 100);
		expect(a).toBe(practiceSeed("war-abc", 100));
		expect(a).not.toBe(practiceSeed("war-abc", 101));
		expect(a).toBeGreaterThanOrEqual(1);
		expect(a).toBeLessThanOrEqual(2147483646);
	});
});

describe("stir accounting", () => {
	test("rub is quiet, shove is loud", () => {
		expect(stirCost("rub")).toBe(STIR_RUB);
		expect(stirCost("shove")).toBe(STIR_SHOVE);
		expect(STIR_SHOVE).toBeGreaterThan(STIR_RUB);
	});
});

// ── Skill layer: warm/cold proximity + quiet streak (pure, read-only) ────────

const N = PATCH_ROWS * PATCH_COLS;

// Build a synthetic board with `kinds` laid out row-major (null = plain mud).
// Only `cells` matters to the proximity/streak helpers; the rest satisfies the
// PatchBoard shape.
function boardWith(kinds: (Find | null)[]): PatchBoard {
	const cells = Array.from({ length: N }, (_, i) =>
		kinds[i] ? { kind: kinds[i]! } : null
	);
	return {
		layers: new Array(N).fill(1),
		cells,
		finds: [],
		truffleL: [],
		truffleD: [],
		unique: null,
	};
}
const idxOf = (r: number, c: number) => r * PATCH_COLS + c;

describe("nearestFindDistance — warm/cold proximity (Chebyshev)", () => {
	test("distance 0 when standing on the buried find", () => {
		const kinds: (Find | null)[] = new Array(N).fill(null);
		kinds[idxOf(0, 0)] = "shimmer";
		const board = boardWith(kinds);
		expect(nearestFindDistance(board, board.layers, idxOf(0, 0))).toBe(0);
	});

	test("king-move distance: diagonal counts as one step", () => {
		const kinds: (Find | null)[] = new Array(N).fill(null);
		kinds[idxOf(0, 0)] = "truffle_l";
		const board = boardWith(kinds);
		expect(nearestFindDistance(board, board.layers, idxOf(1, 1))).toBe(1); // diagonal
		expect(nearestFindDistance(board, board.layers, idxOf(2, 2))).toBe(2);
		expect(nearestFindDistance(board, board.layers, idxOf(2, 0))).toBe(2); // straight
	});

	test("takes the MINIMUM distance across all buried sweet finds", () => {
		const kinds: (Find | null)[] = new Array(N).fill(null);
		kinds[idxOf(0, 0)] = "truffle_l";
		kinds[idxOf(4, 5)] = "shimmer";
		const board = boardWith(kinds);
		// idx (4,4) is 1 from the shimmer, far from the truffle.
		expect(nearestFindDistance(board, board.layers, idxOf(4, 4))).toBe(1);
	});

	test("already-uncovered finds (depth<=0) are not hint targets", () => {
		const kinds: (Find | null)[] = new Array(N).fill(null);
		kinds[idxOf(0, 0)] = "shimmer";
		const board = boardWith(kinds);
		const layers = [...board.layers];
		layers[idxOf(0, 0)] = 0; // dug out already
		expect(nearestFindDistance(board, layers, idxOf(0, 0))).toBeNull();
	});

	test("junk and stone are not sweet — never a hint target", () => {
		const kinds: (Find | null)[] = new Array(N).fill(null);
		kinds[idxOf(0, 0)] = "junk_boot";
		kinds[idxOf(2, 2)] = "stone";
		const board = boardWith(kinds);
		expect(nearestFindDistance(board, board.layers, idxOf(0, 0))).toBeNull();
	});

	test("null when nothing sweet remains", () => {
		const board = boardWith(new Array(N).fill(null));
		expect(nearestFindDistance(board, board.layers, 0)).toBeNull();
	});
});

describe("warmthWhisper — the warmer/colder copy", () => {
	test("adjacent / on it (0–1) → right-under-your-snout", () => {
		expect(warmthWhisper(0)).toBe("something sweet, right under your snout…");
		expect(warmthWhisper(1)).toBe("something sweet, right under your snout…");
	});
	test("two away → warmer", () => {
		expect(warmthWhisper(2)).toBe("warmer…");
	});
	test("three or more → cold mud", () => {
		expect(warmthWhisper(3)).toBe("cold mud out here.");
		expect(warmthWhisper(9)).toBe("cold mud out here.");
	});
	test("null distance → no whisper", () => {
		expect(warmthWhisper(null)).toBeNull();
	});
});

describe("revealedSweetCell — the useful-reveal test that feeds the streak", () => {
	const kinds: (Find | null)[] = new Array(N).fill(null);
	kinds[idxOf(0, 0)] = "truffle_l";
	kinds[idxOf(1, 1)] = "stone";
	const board = boardWith(kinds);

	test("true when a sweet cell finishes uncovering this action", () => {
		const before = [...board.layers];
		const after = [...board.layers];
		after[idxOf(0, 0)] = 0; // just cleared the truffle cell
		expect(revealedSweetCell(board, before, after)).toBe(true);
	});
	test("false when the sweet cell was already clear (not NEW)", () => {
		const before = [...board.layers];
		before[idxOf(0, 0)] = 0;
		const after = [...before];
		expect(revealedSweetCell(board, before, after)).toBe(false);
	});
	test("false when only stone/junk/mud was uncovered", () => {
		const before = [...board.layers];
		const after = [...board.layers];
		after[idxOf(1, 1)] = 0; // stone cleared — not sweet
		expect(revealedSweetCell(board, before, after)).toBe(false);
	});
});

describe("nextStreak — the quiet-streak gift", () => {
	test("useful reveals accumulate", () => {
		expect(nextStreak(0, true)).toEqual({ streak: 1, freeNext: false });
		expect(nextStreak(1, true)).toEqual({ streak: 2, freeNext: false });
	});
	test(`${QUIET_STREAK_LEN} in a row pays out a free rub and resets`, () => {
		expect(nextStreak(QUIET_STREAK_LEN - 1, true)).toEqual({
			streak: 0,
			freeNext: true,
		});
	});
	test("a non-useful action breaks the streak", () => {
		expect(nextStreak(2, false)).toEqual({ streak: 0, freeNext: false });
		expect(nextStreak(0, false)).toEqual({ streak: 0, freeNext: false });
	});
	test("simulated run gifts a free rub on every third useful reveal", () => {
		let streak = 0;
		const grants: number[] = [];
		const seq = [true, true, true, true, true, true, true];
		seq.forEach((useful, i) => {
			const r = nextStreak(streak, useful);
			streak = r.streak;
			if (r.freeNext) grants.push(i);
		});
		// Gifts land on the 3rd and 6th useful reveals (0-indexed 2 and 5).
		expect(grants).toEqual([2, 5]);
	});
	test("a broken streak restarts the count from zero", () => {
		let streak = 0;
		streak = nextStreak(streak, true).streak; // 1
		streak = nextStreak(streak, true).streak; // 2
		streak = nextStreak(streak, false).streak; // broken → 0
		const r = nextStreak(streak, true);
		expect(r).toEqual({ streak: 1, freeNext: false });
	});
});

// ── Touch → tile mapping (shared by the component + this test) ───────────────
describe("tileIndexAt — border-box touch → tile index", () => {
	const TILE = 20;
	const INSET = 2; // BOARD_BORDER

	test("center of a few tiles maps to the right index", () => {
		// col 0, row 0 — center at inset + half a tile.
		expect(tileIndexAt(INSET + 10, INSET + 10, TILE, INSET)).toBe(0);
		// col 2, row 1 → idx 1 * PATCH_COLS + 2 = 8.
		expect(tileIndexAt(INSET + 2 * TILE + 10, INSET + 1 * TILE + 10, TILE, INSET)).toBe(
			1 * PATCH_COLS + 2
		);
		// col 5, row 4 → the last tile, idx 29.
		expect(
			tileIndexAt(INSET + 5 * TILE + 10, INSET + 4 * TILE + 10, TILE, INSET)
		).toBe(PATCH_ROWS * PATCH_COLS - 1);
	});

	test("a touch on the border inset clamps to the nearest tile (col/row 0)", () => {
		// x=1 with inset 2 is left of the content box → clamps to col 0.
		expect(tileIndexAt(1, 1, TILE, INSET)).toBe(0);
	});

	test("far bottom-right corner returns the last index (29)", () => {
		const w = INSET + PATCH_COLS * TILE;
		const h = INSET + PATCH_ROWS * TILE;
		expect(tileIndexAt(w, h, TILE, INSET)).toBe(29);
	});

	test("tileSize <= 0 → -1 (unlaid-out board)", () => {
		expect(tileIndexAt(50, 50, 0, INSET)).toBe(-1);
		expect(tileIndexAt(50, 50, -5, INSET)).toBe(-1);
	});

	test("out-of-range points clamp into the grid rather than reject", () => {
		// Way past the bottom-right → clamps to the last tile.
		expect(tileIndexAt(9999, 9999, TILE, INSET)).toBe(29);
		// Negative (above/left of the board) → clamps to the first tile.
		expect(tileIndexAt(-100, -100, TILE, INSET)).toBe(0);
	});
});

// ── Cluster geometry (one-big-sprite render math) ────────────────────────────
describe("clusterBox — centroid + span of a truffle cluster (tile units)", () => {
	test("empty cluster → null", () => {
		expect(clusterBox([])).toBeNull();
	});

	test("single tile (idx 0) → centered on that cell, 1×1", () => {
		expect(clusterBox([0])).toEqual({ cx: 0.5, cy: 0.5, cols: 1, rows: 1 });
	});

	test("horizontal domino [0,1] → centered between them, 2×1", () => {
		expect(clusterBox([0, 1])).toEqual({ cx: 1, cy: 0.5, cols: 2, rows: 1 });
	});

	test("vertical domino [0,6] (PATCH_COLS=6) → 1×2", () => {
		expect(clusterBox([0, PATCH_COLS])).toEqual({
			cx: 0.5,
			cy: 1,
			cols: 1,
			rows: 2,
		});
	});

	test("L-tromino [0,6,7] → centroid of cell centers, 2×2 span", () => {
		expect(clusterBox([0, PATCH_COLS, PATCH_COLS + 1])).toEqual({
			cx: (0 + 0 + 1) / 3 + 0.5,
			cy: (0 + 1 + 1) / 3 + 0.5,
			cols: 2,
			rows: 2,
		});
	});
});

// ── The One That Got Away — carry-over helpers (pure) ────────────────────────
describe("partiallyRevealedFinds — the miss that carries over", () => {
	// A real board with a known unique so all three carry kinds are present.
	const seed = 42;
	const board = generateBoard(seed, "milk_tooth");

	function fullDepth(): number[] {
		return [...board.layers];
	}

	test("a truffle cluster with ONE cell cleared but uncollected is a miss", () => {
		const layers = fullDepth();
		layers[board.truffleL[0]] = 0; // one cell of the L peeked, cluster not done
		const out = partiallyRevealedFinds(board, layers, []);
		expect(out).toContain("truffle_l");
	});

	test("a fully-collected find is NEVER a miss", () => {
		const layers = fullDepth();
		for (const i of board.truffleL) layers[i] = 0; // whole cluster cleared
		const out = partiallyRevealedFinds(board, layers, ["truffle_l"]);
		expect(out).not.toContain("truffle_l");
	});

	test("an untouched find (no cell cleared) is NEVER a miss", () => {
		const layers = fullDepth(); // nothing dug
		expect(partiallyRevealedFinds(board, layers, [])).toEqual([]);
	});

	test("the unique relic carries when its cell is cleared but uncollected", () => {
		const layers = fullDepth();
		layers[board.unique!.idx] = 0;
		const out = partiallyRevealedFinds(board, layers, []);
		expect(out).toContain("unique");
	});

	test("a collected unique does not carry", () => {
		const layers = fullDepth();
		layers[board.unique!.idx] = 0;
		const out = partiallyRevealedFinds(board, layers, ["unique"]);
		expect(out).not.toContain("unique");
	});

	test("only truffle_l / truffle_d / unique ever carry (never shimmer/junk/stone)", () => {
		// Clear EVERY non-truffle/non-unique cell; none may appear in the misses.
		const layers = fullDepth();
		for (let i = 0; i < board.cells.length; i++) {
			const cell = board.cells[i];
			if (!cell) continue;
			if (cell.kind !== "truffle_l" && cell.kind !== "truffle_d" && cell.kind !== "unique") {
				layers[i] = 0;
			}
		}
		const out = partiallyRevealedFinds(board, layers, []);
		for (const f of out) {
			expect(["truffle_l", "truffle_d", "unique"]).toContain(f);
		}
	});

	test("deduped + order-stable across both truffle clusters", () => {
		const layers = fullDepth();
		layers[board.truffleL[0]] = 0;
		layers[board.truffleD[0]] = 0;
		const out = partiallyRevealedFinds(board, layers, []);
		expect(out).toEqual(["truffle_l", "truffle_d"]);
	});

	test("a board with no unique never emits 'unique'", () => {
		const plain = generateBoard(seed);
		const layers = [...plain.layers];
		for (let i = 0; i < layers.length; i++) layers[i] = 0; // dig everything
		const out = partiallyRevealedFinds(plain, layers, []);
		expect(out).not.toContain("unique");
	});
});

describe("gildedSilhouetteDepth — presence grows one layer earlier per gild", () => {
	test("no gild (0/null/undefined) → the plain threshold (1)", () => {
		expect(gildedSilhouetteDepth(0)).toBe(1);
		expect(gildedSilhouetteDepth(null)).toBe(1);
		expect(gildedSilhouetteDepth(undefined)).toBe(1);
	});
	test("gild 1..3 → 1 + gild", () => {
		expect(gildedSilhouetteDepth(1)).toBe(2);
		expect(gildedSilhouetteDepth(2)).toBe(3);
		expect(gildedSilhouetteDepth(3)).toBe(4);
	});
	test("gild is clamped to 3 and floored", () => {
		expect(gildedSilhouetteDepth(4)).toBe(4); // clamp: 1 + min(3,4)
		expect(gildedSilhouetteDepth(2.9)).toBe(3); // floor
		expect(gildedSilhouetteDepth(-1)).toBe(1); // negative → plain
	});
});

// ── Patch phases (4h open / 4h guarded within each 8h window) ────────────────
describe("patch phases", () => {
	const WINDOW_MS = ROOTING_WINDOW_SECS * 1000;
	const OPEN_MS = PATCH_OPEN_SECS * 1000;
	// A clean window boundary: window index 200000 starts here.
	const start = 200000 * WINDOW_MS;

	test("open for the first 4h, guarded for the last 4h", () => {
		expect(patchPhaseOpen(start)).toBe(true);
		expect(patchPhaseOpen(start + OPEN_MS - 1)).toBe(true);
		expect(patchPhaseOpen(start + OPEN_MS)).toBe(false);
		expect(patchPhaseOpen(start + WINDOW_MS - 1)).toBe(false);
		// The next window opens again at its boundary.
		expect(patchPhaseOpen(start + WINDOW_MS)).toBe(true);
	});

	test("phase close and next-open timestamps are window-aligned", () => {
		const mid = start + 60_000; // 1 minute into the open phase
		expect(phaseClosesAtMs(mid)).toBe(start + OPEN_MS);
		expect(nextOpenAtMs(mid)).toBe(start + WINDOW_MS);
		const guarded = start + OPEN_MS + 60_000; // 1 minute into guarded
		expect(nextOpenAtMs(guarded)).toBe(start + WINDOW_MS);
	});

	test("countdowns format like the feeding countdown", () => {
		// 1h 30m before the phase closes.
		const t = start + OPEN_MS - (90 * 60_000);
		expect(phaseClosesCountdown(t)).toBe("1h 30m");
		// 3h 45m before the patch reopens, from inside the guarded phase.
		const g = start + WINDOW_MS - (225 * 60_000);
		expect(nextOpenCountdown(g)).toBe("3h 45m");
	});
});
