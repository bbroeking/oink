// The Snout Deep reducer, exercised as plain data — one case per rule in
// docs/dig-redesign/a-snout-deep-spec.md §1, the way digSession.test.ts
// replays its incidents. Boards are hand-built so a test names its tiles;
// seeds are picked so the wake stream says what the test needs.

import { PATCH_COLS, SNOUT_DEEP_ACTION_CAP, TILE_DEPTH } from "../constants/dig";
import { generateLayeredBoard, WakeStream } from "../utils/rooting";
import {
  decodeAction,
  encodeAction,
  initialState,
  isNoOp,
  reduce,
  replay,
  revealed,
  scentAt,
  wakeThreshold,
  type Find,
  type LayerBoard,
  type SnoutDeepBoard,
  type SnoutDeepState,
} from "../utils/snoutDeep";

const TILES = 30;
const t = (r: number, c: number) => r * PATCH_COLS + c;

function layer(finds: Find[]): LayerBoard {
  return { depths: new Array(TILES).fill(TILE_DEPTH), finds };
}
function find(id: string, kind: Find["kind"], tiles: number[]): Find {
  return { id, kind, tiles, food: kind === "truffle_d" || kind === "truffle_l" };
}
// A fixed board: topsoil domino at (0,0)(0,1) + a Boom at (2,2) + a stone at
// (4,5); mud L at (1,1)(2,1)(2,2) + a tea at (4,4); root a relic at (0,5).
function board(seed: number): SnoutDeepBoard {
  return {
    seed,
    baseFinds: ["truffle_l", "truffle_d", "junk_boot"],
    layers: [
      layer([find("l0:truffle_d", "truffle_d", [t(0, 0), t(0, 1)]), find("l0:boom", "boom", [t(2, 2)]), find("l0:stone:0", "stone", [t(4, 5)])]),
      layer([find("l1:truffle_l", "truffle_l", [t(1, 1), t(2, 1), t(2, 2)]), find("l1:tea", "tea", [t(4, 4)])]),
      layer([find("l2:relic", "relic", [t(0, 5)])]),
    ],
  };
}
const opts = { coop: false, uncrewed: false };

/** The first seed ≥ 1 whose first `n` wake draws all satisfy `pred`. */
function seedWhere(n: number, pred: (draw: number, k: number) => boolean): number {
  for (let seed = 1; seed < 1_000_000; seed++) {
    const s = new WakeStream(seed);
    let ok = true;
    for (let k = 0; k < n && ok; k++) ok = pred(s.next(), k);
    if (ok) return seed;
  }
  throw new Error("no seed");
}
// Quiet for twenty actions on any verb below the root (mud shove rolls at 20).
const QUIET = seedWhere(20, (d) => d >= 20);
const start = (seed = QUIET) => initialState(board(seed), opts);
const act = (s: SnoutDeepState, verb: "sniff" | "rub" | "shove", tile: number) =>
  reduce(s, { type: "act", verb, tile });
const descend = (s: SnoutDeepState) => reduce(s, { type: "descend" });
const toLayer = (s: SnoutDeepState, l: 0 | 1 | 2) => {
  while (s.layer < l) s = descend(s);
  return s;
};

describe("sniff", () => {
  test("marks scent, counts one action, one log entry and one draw", () => {
    const s = act(start(), "sniff", t(1, 1));
    expect(s.scent[t(1, 1)]).toBe(3); // the domino's two tiles and the Boom touch (1,1)
    expect(s.actions).toEqual(["s0:7"]);
    expect(s.wakeIndex).toBe(1);
    expect(s.depths).toEqual(start().depths); // no mud moves
    expect(s.ended).toBeNull();
  });

  test("never ends a dig in topsoil, whatever the stream says", () => {
    for (let seed = 1; seed <= 400; seed++) {
      let s = initialState(board(seed), opts);
      for (let tile = 0; tile < 12; tile++) s = act(s, "sniff", tile);
      expect(s.ended).toBeNull();
      expect(s.actions).toHaveLength(12);
    }
  });

  test("costs a little below topsoil: mud sniffs wake at 3/120, topsoil rubs at 1/120", () => {
    const rate = (layer: 0 | 1, verb: "sniff" | "rub") => {
      let trials = 0;
      let woke = 0;
      for (let i = 1; i <= 1000; i++) {
        const seed = (i * 104729 + 12345) % 2147483646;
        let s = toLayer(initialState(board(seed), opts), layer);
        for (let tile = 0; tile < 8 && !s.ended; tile++) {
          s = act(s, verb, tile);
          trials++;
          if (s.ended?.reason === "wake") woke++;
        }
      }
      return { trials, observed: woke / trials, expected: wakeThreshold(layer, verb, false) / 120 };
    };
    for (const [layer, verb] of [[1, "sniff"], [0, "rub"]] as const) {
      const r = rate(layer, verb);
      expect(r.trials).toBeGreaterThanOrEqual(1000);
      expect(r.expected).toBeGreaterThan(0);
      expect(Math.abs(r.observed - r.expected)).toBeLessThan(0.01);
    }
  });

  test("rolls at 7/120 at the root, 4/120 co-op (acceptance 2)", () => {
    // Seeds spread across the range: consecutive seeds' wake streams start
    // on consecutive multiples of 7919, which is not a fair sample of the die.
    for (const coop of [false, true]) {
      let trials = 0;
      let woke = 0;
      for (let i = 1; i <= 1000; i++) {
        const seed = (i * 104729 + 12345) % 2147483646;
        let s = toLayer(initialState(board(seed), { coop, uncrewed: false }), 2);
        for (let tile = 0; tile < 8 && !s.ended; tile++) {
          s = act(s, "sniff", tile);
          trials++;
          if (s.ended?.reason === "wake") woke++;
        }
      }
      const expected = wakeThreshold(2, "sniff", coop) / 120;
      expect(trials).toBeGreaterThanOrEqual(1000);
      expect(Math.abs(woke / trials - expected)).toBeLessThan(0.01);
    }
  });
});

describe("no-ops (acceptance 7)", () => {
  test("a cleared tile, a re-sniff, out of bounds: the SAME state object, no draw", () => {
    let s = act(start(), "shove", t(3, 3)); // (3,3) → 0
    expect(s.depths[t(3, 3)]).toBe(0);
    for (const verb of ["sniff", "rub", "shove"] as const) {
      expect(isNoOp(s, verb, t(3, 3))).toBe(true);
      expect(act(s, verb, t(3, 3))).toBe(s);
    }
    s = act(s, "sniff", t(0, 4));
    expect(isNoOp(s, "sniff", t(0, 4))).toBe(true);
    expect(act(s, "sniff", t(0, 4))).toBe(s);
    expect(act(s, "rub", -1)).toBe(s);
    expect(act(s, "rub", 30)).toBe(s);
    expect(act(s, "rub", 2.5)).toBe(s);
    expect(s.actions).toEqual(["h0:21", "s0:4"]);
    expect(s.wakeIndex).toBe(2);
  });

  test("an ended dig ignores every event", () => {
    const s = reduce(start(), { type: "tie" });
    expect(act(s, "rub", 0)).toBe(s);
    expect(descend(s)).toBe(s);
    expect(reduce(s, { type: "tie" })).toBe(s);
    expect(reduce(s, { type: "close" })).toBe(s);
  });

  test("descend at the root is not offered: same state", () => {
    const s = toLayer(start(), 2);
    expect(descend(s)).toBe(s);
  });
});

describe("rub and shove — the kernel, floored at 0", () => {
  test("rub −1 / −½, shove −2 / −1", () => {
    let s = act(start(), "rub", t(2, 3));
    expect(s.depths[t(2, 3)]).toBe(1);
    expect(s.depths[t(1, 3)]).toBe(1.5);
    expect(s.depths[t(3, 3)]).toBe(1.5);
    expect(s.depths[t(2, 2)]).toBe(1.5);
    expect(s.depths[t(2, 4)]).toBe(1.5);
    expect(s.depths[t(1, 2)]).toBe(2); // diagonals untouched
    s = act(s, "shove", t(2, 3));
    expect(s.depths[t(2, 3)]).toBe(0); // 1 − 2, floored
    expect(s.depths[t(1, 3)]).toBe(0.5);
    expect(s.actions).toEqual(["r0:15", "h0:15"]);
  });

  test("two adjacent shoves clear a 2-wide strip; two adjacent rubs leave ½ and a third finishes both", () => {
    // Spec §1.2's "two adjacent rubs clear a 2-wide strip" was carried from
    // spec C, whose dig was the shove. Under the unchanged rub kernel it is
    // 2 − 1 − ½ = ½ on each; the third rub (either tile) takes both to 0.
    let s = act(act(start(), "shove", t(3, 0)), "shove", t(3, 1));
    expect(s.depths[t(3, 0)]).toBe(0);
    expect(s.depths[t(3, 1)]).toBe(0);
    s = act(act(start(), "rub", t(3, 0)), "rub", t(3, 1));
    expect(s.depths[t(3, 0)]).toBe(0.5);
    expect(s.depths[t(3, 1)]).toBe(0.5);
    s = act(s, "rub", t(3, 0));
    expect(s.depths[t(3, 0)]).toBe(0);
    expect(s.depths[t(3, 1)]).toBe(0);
  });
});

describe("reveals", () => {
  test("a truffle whose tiles all reach 0 becomes loose (one per layer)", () => {
    let s = act(act(start(), "shove", t(0, 0)), "shove", t(0, 1));
    expect(s.loose).toBe("l0:truffle_d");
    expect(s.banked).toEqual([]);
    expect(revealed(s).map((f) => f.id)).toEqual(["l0:truffle_d"]);
    // A further action on the layer never re-looses or duplicates it.
    s = act(s, "rub", t(4, 0));
    expect(s.loose).toBe("l0:truffle_d");
  });

  test("a consumable thing joins the loose pouch; a collection thing is yours; stones reveal into nothing", () => {
    let s = act(start(), "shove", t(2, 2));
    expect(s.looseThings).toEqual(["l0:boom"]);
    expect(s.things).toEqual([]);
    expect(s.banked).toEqual([]);
    expect(s.loose).toBeNull();
    s = act(s, "shove", t(4, 5));
    expect(s.depths[t(4, 5)]).toBe(0);
    expect(s.looseThings).toEqual(["l0:boom"]);
    expect(revealed(s).map((f) => f.id)).toEqual(["l0:boom"]);
    s = toLayer(s, 2);
    s = act(s, "shove", t(0, 5));
    expect(s.things).toEqual(["l2:relic"]);
    expect(s.looseThings).toEqual(["l0:boom"]); // still loose — nothing banked it
    expect(s.found).toEqual(["l0:boom", "l2:relic"]);
  });

  test("two clusters on one shove: the truffle is loose, the thing is yours", () => {
    // A domino at (0,0)(0,1) with a Boom right under (0,1): one shove on
    // (0,1) takes the truffle's last tile and the Boom's last half at once.
    const b: SnoutDeepBoard = {
      ...board(QUIET),
      layers: [
        layer([find("l0:truffle_d", "truffle_d", [t(0, 0), t(0, 1)]), find("l0:boom", "boom", [t(1, 1)])]),
        layer([]),
        layer([]),
      ],
    };
    let s = initialState(b, opts);
    s = act(s, "shove", t(0, 0)); // (0,0) 0 · (0,1) 1 · (1,0) 1
    s = act(s, "rub", t(1, 1)); // Boom 1 · (0,1) ½
    expect(s.loose).toBeNull();
    expect(s.looseThings).toEqual([]);
    s = act(s, "shove", t(0, 1)); // (0,1) 0 → loose; Boom 1 − 1 = 0 → loose in the pouch
    expect(s.loose).toBe("l0:truffle_d");
    expect(s.looseThings).toEqual(["l0:boom"]);
  });
});

describe("descend — bank on descent", () => {
  test("banks loose, records the layer, clears scent, enters the next layer fresh", () => {
    let s = act(act(start(), "shove", t(0, 0)), "shove", t(0, 1));
    s = act(s, "sniff", t(4, 4));
    s = descend(s);
    expect(s.layer).toBe(1);
    expect(s.loose).toBeNull();
    expect(s.banked).toEqual(["l0:truffle_d"]);
    expect(s.layersTied).toEqual([0]);
    expect(s.scent.every((x) => x === null)).toBe(true);
    expect(s.depths.every((d) => d === TILE_DEPTH)).toBe(true);
    expect(s.actions).toHaveLength(3); // descend is not an action
    expect(s.wakeIndex).toBe(3);
  });

  test("a touched-but-uncollected truffle is missed; an untouched one is abandoned; things never miss", () => {
    let s = act(start(), "shove", t(0, 0)); // domino half-dug: (0,0) 0, (0,1) 1
    s = act(s, "rub", t(2, 2)); // Boom half-cleared — a thing, never missed
    s = descend(s);
    expect(s.missed).toEqual(["l0:truffle_d"]);
    expect(s.banked).toEqual([]);
    expect(s.layersTied).toEqual([]);
    const untouched = descend(start());
    expect(untouched.missed).toEqual([]);
  });

  test("the loose pouch rides down untouched: descending banks the truffle, never a thing", () => {
    let s = act(act(start(), "shove", t(0, 0)), "shove", t(0, 1)); // the domino, loose
    s = act(s, "shove", t(2, 2)); // the Boom, loose in the pouch
    s = descend(s);
    expect(s.layer).toBe(1);
    expect(s.banked).toEqual(["l0:truffle_d"]);
    expect(s.looseThings).toEqual(["l0:boom"]);
    expect(s.missed).toEqual([]);
    s = act(s, "shove", t(4, 4)); // the tea joins the pouch behind the Boom
    expect(s.looseThings).toEqual(["l0:boom", "l1:tea"]);
    s = descend(s);
    expect(s.layer).toBe(2);
    expect(s.looseThings).toEqual(["l0:boom", "l1:tea"]); // two layers' worth, still at stake
    expect(s.banked).toEqual(["l0:truffle_d"]);
  });
});

describe("tie · cap · close", () => {
  test("tie banks and ends", () => {
    let s = act(act(start(), "shove", t(0, 0)), "shove", t(0, 1));
    s = reduce(s, { type: "tie" });
    expect(s.ended).toEqual({ reason: "tie", layer: 0 });
    expect(s.banked).toEqual(["l0:truffle_d"]);
    expect(s.layersTied).toEqual([0]);
    expect(s.loose).toBeNull();
  });

  test("tie sweeps the whole pouch into banked — the truffle first, then the things in surfacing order", () => {
    let s = act(start(), "shove", t(2, 2)); // the Boom (topsoil)
    s = descend(s); // carried
    s = act(s, "shove", t(4, 4)); // the tea (mud)
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2)); // the fat one, loose
    expect(s.looseThings).toEqual(["l0:boom", "l1:tea"]);
    s = reduce(s, { type: "tie" });
    expect(s.ended).toEqual({ reason: "tie", layer: 1 });
    expect(s.banked).toEqual(["l1:truffle_l", "l0:boom", "l1:tea"]);
    expect(s.looseThings).toEqual([]);
    expect(s.things).toEqual([]);
    expect(s.missed).toEqual([]);
    expect(s.layersTied).toEqual([1]);
  });

  test("close banks the pouch like a tie", () => {
    let s = act(start(), "shove", t(2, 2));
    s = descend(s);
    s = reduce(s, { type: "close" });
    expect(s.ended).toEqual({ reason: "close", layer: 1 });
    expect(s.banked).toEqual(["l0:boom"]);
    expect(s.looseThings).toEqual([]);
  });

  test("close ends as a tie", () => {
    let s = toLayer(start(), 1);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
    expect(s.loose).toBe("l1:truffle_l");
    s = reduce(s, { type: "close" });
    expect(s.ended).toEqual({ reason: "close", layer: 1 });
    expect(s.banked).toEqual(["l1:truffle_l"]);
    expect(s.layersTied).toEqual([1]);
  });

  test("the 45th action ends as cap (= tie), banking the loose truffle", () => {
    // 42 sniffs below the root never roll; the three mud shoves must miss.
    let s = initialState(board(seedWhere(45, (d, k) => k < 42 || d >= 20)), opts);
    // 44 sniffs across three layers (sniffs never move mud, so tiles stay
    // sniffable once per layer), then the truffle on the 45th.
    for (let i = 0; i < 30 && s.actions.length < 22; i++) s = act(s, "sniff", i);
    s = descend(s);
    for (let i = 0; i < 30 && s.actions.length < 42; i++) s = act(s, "sniff", i);
    s = act(act(s, "shove", t(1, 1)), "shove", t(2, 1)); // 44
    expect(s.actions).toHaveLength(44);
    expect(s.ended).toBeNull();
    s = act(s, "shove", t(2, 2)); // 45 — L complete on the cap action
    expect(s.actions).toHaveLength(SNOUT_DEEP_ACTION_CAP);
    expect(s.ended).toEqual({ reason: "cap", layer: 1 });
    expect(s.banked).toEqual(["l1:truffle_l"]);
    expect(s.loose).toBeNull();
  });

  test("a wake on the 45th action wins over the cap", () => {
    // 44 sniffs below the root never roll; the 45th is a mud rub (6) and the
    // seed's 45th draw is under it.
    const seed = seedWhere(45, (d, k) => k < 44 || d < 6);
    let s = initialState(board(seed), opts);
    for (let i = 0; i < 30 && s.actions.length < 22; i++) s = act(s, "sniff", i);
    s = descend(s);
    for (let i = 0; i < 30 && s.actions.length < 44; i++) s = act(s, "sniff", i);
    s = act(s, "rub", t(4, 0)); // 45: a mud rub rolls at 6; the draw is 0
    expect(s.actions).toHaveLength(45);
    expect(s.ended).toEqual({ reason: "wake", layer: 1, wokeOn: "r1:24" });
  });
});

describe("wake", () => {
  const WAKE_FIRST = seedWhere(1, (d) => d < 6); // the first draw wakes a mud rub
  const WAKE_THIRD = seedWhere(3, (d, k) => (k === 2 ? d < 6 : d >= 40));

  test("ends the dig naming the action; loose goes to missed, not banked", () => {
    let s = initialState(board(WAKE_THIRD), opts);
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1)); // topsoil truffle loose (draws 1, 2 — shove at 10, both ≥ 40)
    s = descend(s); // banked
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
    // Hmm — the third draw fires on the FIRST mud action already (draw 3 < 6
    // ≤ 20). So the dig ended on "h1:7" with nothing loose in the mud.
    expect(s.ended).toEqual({ reason: "wake", layer: 1, wokeOn: "h1:7" });
    expect(s.banked).toEqual(["l0:truffle_d"]); // acceptance 3
    expect(s.actions).toEqual(["h0:0", "h0:1", "h1:7"]);
  });

  test("the loose truffle is his: moved to missed, things intact (acceptance 4)", () => {
    // Uncover the mud L first on a quiet stream, then replay the same log on
    // a stream that wakes on the next rub.
    const seed = seedWhere(5, (d, k) => (k === 4 ? d < 6 : d >= 40));
    let s = initialState(board(seed), opts);
    s = act(s, "shove", t(2, 2)); // the Boom, yours
    s = descend(s);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
    expect(s.loose).toBe("l1:truffle_l");
    s = act(s, "rub", t(4, 0)); // the fifth draw wakes him
    expect(s.ended?.reason).toBe("wake");
    expect(s.ended?.wokeOn).toBe("r1:24");
    expect(s.loose).toBeNull();
    // The truffle, then the pouch he took with it — the Boom carried down from topsoil.
    expect(s.missed).toEqual(["l1:truffle_l", "l0:boom"]);
    expect(s.looseThings).toEqual([]);
    expect(s.banked).toEqual([]);
    expect(s.things).toEqual([]);
    expect(s.layersTied).toEqual([]);
  });

  test("a wake loses every layer's loose things together; the tied stay tied", () => {
    // Quiet through six actions, then the seventh (a mud shove, 20) wakes him.
    const seed = seedWhere(7, (d, k) => (k === 6 ? d < 20 : d >= 40));
    let s = initialState(board(seed), opts);
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1)); // the domino, loose (2)
    s = act(s, "shove", t(2, 2)); // the Boom (3)
    s = descend(s); // the domino banks; the Boom rides down
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2)); // the fat one (6)
    s = act(s, "shove", t(4, 4)); // the tea (7) — the waking draw
    expect(s.ended?.reason).toBe("wake");
    expect(s.ended?.layer).toBe(1);
    // He took the loose fat one, the Boom from topsoil and the tea revealed on
    // the waking action — the whole pouch; the domino banked on descent stays.
    expect(s.missed).toEqual(["l1:truffle_l", "l0:boom", "l1:tea"]);
    expect(s.banked).toEqual(["l0:truffle_d"]);
    expect(s.looseThings).toEqual([]);
    expect(s.layersTied).toEqual([0]);
  });

  test("a consumable revealed on the waking action is lost with the pouch; a collection thing is still yours", () => {
    let s = toLayer(initialState(board(WAKE_FIRST), opts), 1);
    s = act(s, "shove", t(4, 4)); // the tea clears AND the draw wakes him
    expect(s.ended?.reason).toBe("wake");
    expect(s.things).toEqual([]);
    expect(s.looseThings).toEqual([]);
    expect(s.missed).toEqual(["l1:tea"]);
    expect(s.found).toEqual(["l1:tea"]);
    let r = toLayer(initialState(board(WAKE_FIRST), opts), 2);
    r = act(r, "shove", t(0, 5)); // the relic clears AND the draw wakes him (root shove, 40)
    expect(r.ended?.reason).toBe("wake");
    expect(r.things).toEqual(["l2:relic"]);
    expect(r.missed).toEqual([]);
  });
});

describe("scent (acceptance 5)", () => {
  test("counts every find tile in the 3 × 3, never a stone; 0 means empty", () => {
    const b = board(QUIET);
    expect(scentAt(b.layers[0], t(0, 0))).toBe(2);
    expect(scentAt(b.layers[0], t(1, 2))).toBe(2); // (0,1) and the Boom (2,2)
    expect(scentAt(b.layers[0], t(2, 2))).toBe(1);
    expect(scentAt(b.layers[0], t(4, 5))).toBe(0); // the stone's own tile
    expect(scentAt(b.layers[0], t(3, 4))).toBe(0);
    expect(scentAt(b.layers[1], t(2, 1))).toBe(3); // the whole L
    expect(scentAt(b.layers[1], t(3, 3))).toBe(2); // (2,2) and the tea (4,4)
    expect(scentAt(b.layers[2], t(1, 4))).toBe(1);
    // Buried, half-cleared and cleared all count: the mark is the layer's.
    let s = act(act(start(), "shove", t(0, 0)), "shove", t(0, 1));
    s = act(s, "sniff", t(1, 0));
    expect(s.scent[t(1, 0)]).toBe(2);
  });

  test("a 0 tile has no find in its 3 × 3, across generated boards", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const b = generateLayeredBoard(seed);
      for (const l of b.layers) {
        for (let tile = 0; tile < TILES; tile++) {
          const r = Math.floor(tile / PATCH_COLS);
          const c = tile % PATCH_COLS;
          let n = 0;
          for (const f of l.finds) {
            if (f.kind === "stone") continue;
            for (const ft of f.tiles) {
              if (Math.abs(Math.floor(ft / PATCH_COLS) - r) <= 1 && Math.abs((ft % PATCH_COLS) - c) <= 1) n++;
            }
          }
          expect(scentAt(l, tile)).toBe(n);
        }
      }
    }
  });
});

describe("the log and determinism (acceptance 10)", () => {
  test("entries encode verb, layer (0-based) and tile; decode round-trips", () => {
    expect(encodeAction("sniff", 2, 14)).toBe("s2:14");
    expect(encodeAction("rub", 0, 3)).toBe("r0:3");
    expect(encodeAction("shove", 1, 29)).toBe("h1:29");
    expect(decodeAction("h1:29")).toEqual({ verb: "shove", layer: 1, tile: 29 });
    expect(decodeAction("x1:2")).toBeNull();
  });

  test("replaying state.actions from initialState reproduces the state", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = generateLayeredBoard(seed);
      let s = initialState(b, { coop: seed % 2 === 0, uncrewed: false });
      // A scripted dig: sniff a few, rub across, descend, repeat.
      const script: (() => void)[] = [
        () => (s = act(s, "sniff", 7)),
        () => (s = act(s, "rub", 0)),
        () => (s = act(s, "rub", 1)),
        () => (s = act(s, "shove", 8)),
        () => (s = act(s, "rub", 13)),
        () => (s = descend(s)),
        () => (s = act(s, "sniff", 10)),
        () => (s = act(s, "shove", 15)),
        () => (s = act(s, "rub", 16)),
        () => (s = descend(s)),
        () => (s = act(s, "sniff", 22)),
        () => (s = act(s, "rub", 22)),
        () => (s = act(s, "shove", 5)),
      ];
      for (const step of script) {
        if (s.ended) break;
        step();
      }
      const again = replay(b, { coop: s.coop, uncrewed: false }, s.actions);
      expect(again).toEqual(s);
    }
  });
});
