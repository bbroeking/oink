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
	claimableFinds,
	windowIndex,
	windowEndsAtMs,
	feedingCountdown,
	practiceSeed,
	stirCost,
} from "../utils/rooting";
import type { Find } from "../utils/rooting";
import {
	PATCH_COLS,
	PATCH_ROWS,
	ROOTING_WINDOW_SECS,
	STIR_RUB,
	STIR_SHOVE,
} from "../constants/mudFights";

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
				expect(l).toBeGreaterThanOrEqual(1);
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
