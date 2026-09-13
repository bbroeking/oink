// The Snout Deep board — three layers from one seed (spec §1.1, §2). The
// first four draws are the parity draws generateBoard makes, so
// rooting_finds(seed) still names the base set; everything after is layout.

import {
  DIG_FINDS,
  DIG_JUNK_VARIANTS,
  DIG_LAYER_STONES,
  PATCH_COLS,
  PATCH_LAYERS,
  PATCH_ROWS,
  TILE_DEPTH,
  type DigFindKind,
} from "../constants/dig";
import {
  generateBoard,
  generateLayeredBoard,
  layerFindTable,
  Minstd,
  WakeStream,
  wakeSeed,
  wakeThreshold,
} from "../utils/rooting";

// Mirrors rooting_finds() in the migration: consume exactly four draws.
function serverFinds(seed: number): string[] {
  const rng = new Minstd(seed);
  rng.nextInt(4);
  rng.nextInt(2);
  const shimmer = rng.nextInt(2) === 1;
  const junk = rng.nextInt(2) === 0 ? "junk_boot" : "junk_wrap";
  const finds = ["truffle_l", "truffle_d"];
  if (shimmer) finds.push("shimmer");
  finds.push(junk);
  return finds;
}

const SEEDS = [1, 7, 42, 31337, 999983, 20260913, 2147483646];
const TILES = PATCH_ROWS * PATCH_COLS;

describe("generateLayeredBoard", () => {
  test("PARITY: baseFinds === rooting_finds(seed) === generateBoard(seed).finds", () => {
    for (const seed of SEEDS) {
      const board = generateLayeredBoard(seed);
      expect([...board.baseFinds].sort()).toEqual(serverFinds(seed).sort());
      expect([...board.baseFinds].sort()).toEqual([...generateBoard(seed).finds].sort());
    }
  });

  test("three layers, every tile TILE_DEPTH deep, deterministic per seed", () => {
    for (const seed of SEEDS) {
      const a = generateLayeredBoard(seed);
      const b = generateLayeredBoard(seed);
      expect(a).toEqual(b);
      expect(a.seed).toBe(seed);
      expect(a.layers).toHaveLength(PATCH_LAYERS);
      for (const layer of a.layers) {
        expect(layer.depths).toHaveLength(TILES);
        expect(layer.depths.every((d) => d === TILE_DEPTH)).toBe(true);
      }
    }
    expect(JSON.stringify(generateLayeredBoard(1111))).not.toEqual(
      JSON.stringify(generateLayeredBoard(2222)),
    );
  });

  test("per-layer placement matches the find table; no overlaps; ≤ 8 finds", () => {
    for (const seed of SEEDS) {
      const board = generateLayeredBoard(seed);
      board.layers.forEach((layer, li) => {
        const kinds = new Set(layer.finds.map((f) => f.kind));
        const allowed = new Set<DigFindKind>(layerFindTable(li as 0 | 1 | 2));
        for (const k of kinds) expect(allowed.has(k)).toBe(true);
        expect(layer.finds.length).toBeLessThanOrEqual(8);
        const stones = layer.finds.filter((f) => f.kind === "stone");
        expect(stones).toHaveLength(DIG_LAYER_STONES[li as 0 | 1 | 2]);
        const tiles = layer.finds.flatMap((f) => f.tiles);
        expect(new Set(tiles).size).toBe(tiles.length);
        for (const t of tiles) {
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThan(TILES);
        }
        // Ids are unique across the board and name their layer.
        for (const f of layer.finds) expect(f.id.startsWith(`l${li}:`)).toBe(true);
      });
      const ids = board.layers.flatMap((l) => l.finds.map((f) => f.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("topsoil: the domino, a Boom, one keepsake; the mud: the L; the root: no truffle", () => {
    for (const seed of SEEDS) {
      const [top, mud, root] = generateLayeredBoard(seed).layers;
      const domino = top.finds.find((f) => f.kind === "truffle_d")!;
      expect(domino.tiles).toHaveLength(2);
      expect(domino.food).toBe(true);
      const [a, b] = domino.tiles;
      const dr = Math.abs(Math.floor(a / PATCH_COLS) - Math.floor(b / PATCH_COLS));
      const dc = Math.abs((a % PATCH_COLS) - (b % PATCH_COLS));
      expect(dr + dc).toBe(1);
      expect(top.finds.filter((f) => f.kind === "boom")).toHaveLength(1);
      const junk = top.finds.filter((f) => f.kind === "junk");
      expect(junk).toHaveLength(1);
      expect(DIG_JUNK_VARIANTS).toContain(junk[0].variant);
      expect(junk[0].food).toBe(false);

      const L = mud.finds.find((f) => f.kind === "truffle_l")!;
      expect(L.tiles).toHaveLength(3);
      expect(L.food).toBe(true);
      expect(mud.finds.some((f) => f.kind === "truffle_d")).toBe(false);

      expect(root.finds.some((f) => f.food)).toBe(false);
      for (const f of root.finds) expect(f.food).toBe(false);
    }
  });

  test("the shimmer rides the parity draw: present iff rooting_finds names it", () => {
    for (const seed of SEEDS) {
      const board = generateLayeredBoard(seed);
      const named = board.baseFinds.includes("shimmer");
      expect(board.layers[1].finds.some((f) => f.kind === "shimmer")).toBe(named);
    }
  });

  test("the optional finds land at their §2 odds over many seeds", () => {
    const N = 3000;
    const counts: Partial<Record<DigFindKind, number>> = {};
    for (let seed = 1; seed <= N; seed++) {
      for (const layer of generateLayeredBoard(seed).layers) {
        for (const f of layer.finds) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
      }
    }
    for (const [kind, odds] of Object.entries(DIG_FINDS) as [DigFindKind, readonly [number, number]][]) {
      if (kind === "shimmer") continue; // the parity draw, tested above
      const rate = (counts[kind] ?? 0) / N;
      expect(Math.abs(rate - odds[0] / odds[1])).toBeLessThan(0.03);
    }
  });

  test("a server-rolled unique forces the root relic and names it; nothing else moves", () => {
    for (const seed of SEEDS) {
      const plain = generateLayeredBoard(seed);
      const rolled = generateLayeredBoard(seed, "relic_lantern");
      const relic = rolled.layers[2].finds.find((f) => f.kind === "relic")!;
      expect(relic).toBeDefined();
      expect(relic.variant).toBe("relic_lantern");
      // Layers 0 and 1 draw before the root, so they are byte-identical.
      expect(rolled.layers[0]).toEqual(plain.layers[0]);
      expect(rolled.layers[1]).toEqual(plain.layers[1]);
      expect(rolled.baseFinds).toEqual(plain.baseFinds);
    }
  });
});

describe("the wake stream", () => {
  test("is Minstd over (seed × 7919) mod 2147483647, drawing nextInt(120)", () => {
    for (const seed of SEEDS) {
      const expected = new Minstd((seed * 7919) % 2147483647);
      const stream = new WakeStream(seed);
      for (let i = 0; i < 50; i++) expect(stream.next()).toBe(expected.nextInt(120));
      expect(wakeSeed(seed)).toBe((seed * 7919) % 2147483647);
    }
  });

  test("skip(n) lands on the (n+1)-th draw — a replay from a saved wakeIndex", () => {
    const all = new WakeStream(20260913);
    const draws = Array.from({ length: 45 }, () => all.next());
    for (const k of [0, 1, 7, 44]) expect(new WakeStream(20260913).skip(k).next()).toBe(draws[k]);
  });
});

describe("wakeThreshold — the §1.4 table", () => {
  test("solo", () => {
    expect(wakeThreshold(0, "sniff", false)).toBe(0);
    expect(wakeThreshold(0, "rub", false)).toBe(0);
    expect(wakeThreshold(0, "shove", false)).toBe(10);
    expect(wakeThreshold(1, "sniff", false)).toBe(0);
    expect(wakeThreshold(1, "rub", false)).toBe(6);
    expect(wakeThreshold(1, "shove", false)).toBe(20);
    expect(wakeThreshold(2, "sniff", false)).toBe(7);
    expect(wakeThreshold(2, "rub", false)).toBe(15);
    expect(wakeThreshold(2, "shove", false)).toBe(40);
  });
  test("co-op halves the root's sniff and rub only (7 → 4, 15 → 8)", () => {
    expect(wakeThreshold(2, "sniff", true)).toBe(4);
    expect(wakeThreshold(2, "rub", true)).toBe(8);
    expect(wakeThreshold(2, "shove", true)).toBe(40);
    for (const layer of [0, 1] as const) {
      for (const verb of ["sniff", "rub", "shove"] as const) {
        expect(wakeThreshold(layer, verb, true)).toBe(wakeThreshold(layer, verb, false));
      }
    }
  });
});
