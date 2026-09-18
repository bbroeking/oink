// The Snout Deep reducer, exercised as plain data — one case per rule in
// docs/dig-redesign/a-snout-deep-spec.md §1, the way digSession.test.ts
// replays its incidents. Boards are hand-built so a test names its tiles;
// seeds are picked so the wake stream says what the test needs.

import {
  PATCH_COLS,
  SNIFF_FREE_PER_BOARD,
  SNOUT_DEEP_ACTION_CAP,
  SNOUT_DEEP_RULES_MAX,
  TILE_DEPTH,
  WAKE_DIE,
  WAKE_METER,
  type WakeMeter,
} from "../constants/dig";
import { generateLayeredBoard, WakeStream } from "../utils/rooting";
import {
  decodeAction,
  encodeAction,
  initialState,
  isNoOp,
  reduce,
  replay,
  restore,
  wakeDrawAt,
  revealed,
  scentAt,
  wakeThreshold,
  type Find,
  type LayerBoard,
  type SnoutDeepBoard,
  type SnoutDeepState,
  sniffsLeft,
  nextSniffAttention,
  sniffCount,
  nextThreshold,
  attentionOf,
  canDescend,
  loudness,
  meterHazard,
  sanitizeWakeMeter,
  sleepDepthFrom,
  type Layer,
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
// The descent gate (2026-09-17 §4) shuts `Dig deeper` until this board's
// truffle is out of the ground. A test that wants the board below without
// spending draws on the truffle takes the replay's door, which descends
// regardless — a log that reached the mud found it on the phone that wrote it.
const sink = (s: SnoutDeepState, layer: Layer = Math.min(2, s.layer + 1) as Layer) =>
  restore(
    s.board,
    { coop: s.coop, uncrewed: s.uncrewed, rules: s.rules },
    { layer, actions: s.actions },
  );
const toLayer = (s: SnoutDeepState, l: 0 | 1 | 2) => sink(s, l);

describe("sniff", () => {
  test("marks scent, counts one action, one log entry and one draw", () => {
    const s = act(start(), "sniff", t(1, 1));
    expect(s.scent[t(1, 1)]).toBe(3); // the domino's two tiles and the Boom touch (1,1)
    expect(s.actions).toEqual(["s0:7"]);
    expect(s.wakeIndex).toBe(1);
    expect(s.depths).toEqual(start().depths); // no mud moves
    expect(s.ended).toBeNull();
  });

  test("inside the budget a topsoil sniff never ends a dig, whatever the stream says", () => {
    for (let seed = 1; seed <= 400; seed++) {
      let s = initialState(board(seed), opts);
      for (let tile = 0; tile < SNIFF_FREE_PER_BOARD; tile++) s = act(s, "sniff", tile);
      expect(s.ended).toBeNull();
      expect(s.actions).toHaveLength(SNIFF_FREE_PER_BOARD);
    }
  });

  test("past the budget a sniff draws his attention: +1 per extra sniff, capped at the shove (2026-09-16)", () => {
    // Thresholds the k-th sniff rolls at (k 1-based): five at 0, then 1, 2, 3 …
    expect([0, 1, 2, 3, 4, 5, 6, 7, 14, 15].map((prior) => wakeThreshold(0, "sniff", false, prior)))
      .toEqual([0, 0, 0, 0, 0, 1, 2, 3, 10, 10]);
    expect(wakeThreshold(1, "sniff", false, 5)).toBe(4); // mud 3 + 1
    expect(wakeThreshold(2, "sniff", true, 5)).toBe(5); // co-op root 4 + 1
    expect(wakeThreshold(0, "rub", false, 40)).toBe(1); // rubs never take attention
    expect(wakeThreshold(2, "shove", false, 40)).toBe(40);
    // The sixth topsoil sniff CAN wake him: a seed whose sixth draw is 0.
    const seed = seedWhere(6, (d, k) => k < 5 || d === 0);
    let s = initialState(board(seed), opts);
    for (let tile = 0; tile < 6; tile++) s = act(s, "sniff", tile);
    expect(s.ended).toEqual({ reason: "wake", layer: 0, wokeOn: "s0:5" });
    // …and only the sixth: the same six sniffs on a stream whose sixth draw is 1 survive.
    const seed2 = seedWhere(6, (d, k) => k < 5 || d === 1);
    let s2 = initialState(board(seed2), opts);
    for (let tile = 0; tile < 6; tile++) s2 = act(s2, "sniff", tile);
    expect(s2.ended).toBeNull();
  });

  test("the budget is per board: it refills on descent, and the mud's count starts at zero (2026-09-17)", () => {
    let s = start();
    for (let tile = 0; tile < SNIFF_FREE_PER_BOARD + 2; tile++) s = act(s, "sniff", tile);
    expect(sniffsLeft(s)).toBe(0);
    expect(nextSniffAttention(s)).toBe(3); // the 8th topsoil sniff would be +3
    expect(sniffCount(s.actions, 0)).toBe(SNIFF_FREE_PER_BOARD + 2);
    expect(sniffCount(s.actions, 1)).toBe(0);
    s = sink(s);
    expect(sniffsLeft(s)).toBe(SNIFF_FREE_PER_BOARD);
    expect(nextSniffAttention(s)).toBe(0);
    expect(nextThreshold(s, "sniff")).toBe(wakeThreshold(1, "sniff", false, 0)); // the mud's table odds, no debt carried down
    // Two mud sniffs: the mud counts its own, topsoil's stay topsoil's.
    s = act(s, "sniff", 0);
    s = act(s, "sniff", 1);
    expect(sniffCount(s.actions, 1)).toBe(2);
    expect(sniffCount(s.actions, 0)).toBe(SNIFF_FREE_PER_BOARD + 2);
    expect(sniffsLeft(s)).toBe(SNIFF_FREE_PER_BOARD - 2);
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
    // The gate means a PLAYER can no longer leave this board's truffle behind
    // — only a replay descends over it (a log from a build without the gate).
    let s = act(start(), "shove", t(0, 0)); // domino half-dug: (0,0) 0, (0,1) 1
    s = act(s, "rub", t(2, 2)); // Boom half-cleared — a thing, never missed
    s = sink(s);
    expect(s.missed).toEqual(["l0:truffle_d"]);
    expect(s.banked).toEqual([]);
    expect(s.layersTied).toEqual([]);
    const untouched = sink(start());
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
    s = sink(s); // the mud's fat one stayed buried — only a replay gets past that
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
    s = sink(s); // carried
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
    s = sink(s);
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

  // The k-th draw (0-based) of a run of sniffs below the root: 22 in topsoil,
  // the rest in the mud. Past the budget the sniffs roll (2026-09-16), so the
  // seed must miss every one of them.
  const sniffRunMisses = (d: number, k: number) =>
    d >= wakeThreshold(k < 22 ? 0 : 1, "sniff", false, k);

  test("the 45th action ends as cap (= tie), banking the loose truffle", () => {
    // 42 sniffs below the root must all miss; so must the three mud shoves.
    let s = initialState(board(seedWhere(45, (d, k) => (k < 42 ? sniffRunMisses(d, k) : d >= 20))), opts);
    // 44 sniffs across three layers (sniffs never move mud, so tiles stay
    // sniffable once per layer), then the truffle on the 45th.
    for (let i = 0; i < 30 && s.actions.length < 22; i++) s = act(s, "sniff", i);
    s = sink(s);
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
    // 44 sniffs below the root must all miss; the 45th is a mud rub (6) and the
    // seed's 45th draw is under it.
    const seed = seedWhere(45, (d, k) => (k < 44 ? sniffRunMisses(d, k) : d < 6));
    let s = initialState(board(seed), opts);
    for (let i = 0; i < 30 && s.actions.length < 22; i++) s = act(s, "sniff", i);
    s = sink(s);
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
    s = sink(s);
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

// ── The wake meter — rules 2 (2026-09-17) ──────────────────────────────────
// docs/design/2026-09-17-cumulative-attention.md: no roll at all. Every action
// adds its loudness — the wake table, unchanged — to the meter, and he wakes
// on the action that carries it to the sleep depth drawn when the board was
// entered. Below `lo` is certain sleep, `hi` is a certain wake.

describe("rules 2 — the wake meter", () => {
  const r2 = { coop: false, uncrewed: false, rules: 2 as const };
  const start2 = (seed = QUIET, wakeMeter?: WakeMeter) =>
    initialState(board(seed), { ...r2, ...(wakeMeter ? { wakeMeter } : {}) });
  const sink2 = (s: SnoutDeepState, layer: Layer = Math.min(2, s.layer + 1) as Layer) =>
    restore(s.board, { ...r2, wakeMeter: s.wakeMeter }, { layer, actions: s.actions });
  /** The draws the seed's wake stream hands out, in order. */
  const draws = (seed: number, n: number) => {
    const ws = new WakeStream(seed);
    return Array.from({ length: n }, () => ws.next());
  };

  test("this binary asks for the newest rules, and the compiled band is the contract's", () => {
    expect(SNOUT_DEEP_RULES_MAX).toBe(2);
    expect(WAKE_METER).toEqual({ lo: 50, hi: 110, scope: "board", digRootGt: 0 });
  });

  test("loudness IS the wake table — there is no second table", () => {
    for (const layer of [0, 1, 2] as Layer[]) {
      for (const verb of ["sniff", "rub", "shove"] as const) {
        for (const coop of [false, true]) {
          for (const prior of [0, SNIFF_FREE_PER_BOARD + 1]) {
            expect(loudness(layer, verb, coop, prior)).toBe(
              wakeThreshold(layer, verb, coop, prior),
            );
          }
        }
      }
    }
  });

  test("sleepDepthFrom stays inside the band over all 120 draws, and only ever climbs", () => {
    for (const [lo, hi] of [[50, 110], [40, 80], [1, 120], [60, 61]] as const) {
      let last = -1;
      for (let draw = 0; draw < WAKE_DIE; draw++) {
        const T = sleepDepthFrom(draw, lo, hi);
        expect(T).toBeGreaterThanOrEqual(lo);
        expect(T).toBeLessThanOrEqual(hi);
        expect(T).toBeGreaterThanOrEqual(last); // monotone in the draw
        last = T;
      }
      // Both ends of the band are reachable: draw 0 is the floor, 119 the top.
      expect(sleepDepthFrom(0, lo, hi)).toBe(lo);
      expect(sleepDepthFrom(WAKE_DIE - 1, lo, hi)).toBe(hi);
    }
  });

  test("his sleep depth comes off the stream on entry — draw 0 — so the first action reads draw 1", () => {
    const s = start2();
    const d = draws(QUIET, 2);
    expect(s.sleepDepth).toBe(sleepDepthFrom(d[0], WAKE_METER.lo, WAKE_METER.hi));
    expect(s.wakeIndex).toBe(1); // the entry draw is CONSUMED
    // The board's first action takes draw 1, not draw 0.
    const after = act(s, "rub", t(3, 3));
    expect(after.wakeIndex).toBe(2);
    expect(wakeDrawAt(QUIET, 1)).toBe(d[1]);
    // Rule 1 draws no entry: its first action is still draw 0.
    expect(start().wakeIndex).toBe(0);
    expect(start().sleepDepth).toBe(0);
  });

  test("attention adds the loudness and he wakes at T — no roll, whatever the stream says", () => {
    // Pin the sleep depth by choosing a seed whose entry draw lands it low.
    const seed = seedWhere(1, (d) => sleepDepthFrom(d, 50, 110) === 50);
    let s = start2(seed);
    expect(s.sleepDepth).toBe(50);
    expect(attentionOf(s)).toBe(0);
    // Topsoil shoves are 10 apiece: five of them reach 50 exactly, and the
    // fifth is the one — the compare happens AFTER the add.
    for (let i = 0; i < 4; i++) {
      expect(nextThreshold(s, "shove")).toBe(10); // the card's "+10"
      s = act(s, "shove", [t(0, 0), t(0, 2), t(0, 4), t(2, 4), t(4, 4)][i]);
      expect(s.ended).toBeNull();
    }
    expect(s.attention).toBe(40);
    s = act(s, "shove", t(4, 4));
    expect(s.attention).toBe(50);
    expect(s.ended).toEqual({ reason: "wake", layer: 0, wokeOn: "h0:28" });
  });

  test("a meter short of T never wakes him, however loud the stream is", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = start2(seed);
      // Topsoil's whole board is quieter than any band this ships with.
      let run = s;
      for (let tile = 0; tile < 5; tile++) run = act(run, "sniff", tile);
      expect(run.attention).toBe(0);
      expect(run.ended).toBeNull();
    }
  });

  test("the card's +N is the loudness, and the hazard reads loudness over what is left of the band", () => {
    const seed = seedWhere(1, (d) => sleepDepthFrom(d, 50, 110) >= 50);
    let s = start2(seed);
    expect(nextThreshold(s, "sniff")).toBe(0); // topsoil sniffs are silent
    expect(nextThreshold(s, "rub")).toBe(1);
    expect(nextThreshold(s, "shove")).toBe(10);
    expect(meterHazard(s, "rub")).toBeCloseTo(1 / 110);
    s = sink2(s, 2);
    // The root, on a fresh board: a rub is 15 of the 110 still on the bar.
    expect(nextThreshold(s, "rub")).toBe(15);
    expect(meterHazard(s, "rub")).toBeCloseTo(15 / 110);
    // Half-way up the band, the same rub is a quarter of what is left.
    const half: SnoutDeepState = { ...s, attention: 50 };
    expect(meterHazard(half, "rub")).toBeCloseTo(15 / 60);
    // At `hi` he is certainly up, so the hazard is 1 — and it never exceeds it.
    expect(meterHazard({ ...s, attention: 110 }, "rub")).toBe(1);
    // Rule 1 has no hazard to read.
    expect(meterHazard(start(), "rub")).toBe(0);
  });

  test("scope board: a descent empties the meter and redraws him from the next draw", () => {
    let s = start2();
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1)); // the domino, up
    expect(s.attention).toBe(20);
    const before = s.sleepDepth;
    const index = s.wakeIndex;
    s = descend(s);
    expect(s.layer).toBe(1);
    expect(s.attention).toBe(0); // he settles again as you go down
    expect(s.wakeIndex).toBe(index + 1); // the entry draw is spent
    expect(s.sleepDepth).toBe(
      sleepDepthFrom(wakeDrawAt(QUIET, index), WAKE_METER.lo, WAKE_METER.hi),
    );
    expect(s.sleepDepth).not.toBe(-1);
    expect(typeof before).toBe("number");
    // A restore derives all of it — the descent the log cannot show included.
    const restored = restore(s.board, r2, { layer: s.layer, actions: s.actions });
    expect(restored.attention).toBe(s.attention);
    expect(restored.sleepDepth).toBe(s.sleepDepth);
    expect(restored.wakeIndex).toBe(s.wakeIndex);
    // …and once the mud has an entry in the log, the log alone is enough.
    s = act(s, "rub", t(4, 0));
    const again = replay(s.board, r2, s.actions);
    expect(again.attention).toBe(s.attention);
    expect(again.sleepDepth).toBe(s.sleepDepth);
    expect(again.wakeIndex).toBe(s.wakeIndex);
  });

  test("scope dig: one sleep depth at open, and the meter carries all the way down", () => {
    const carry: WakeMeter = { ...WAKE_METER, scope: "dig" };
    let s = start2(QUIET, carry);
    const T = s.sleepDepth;
    const index = s.wakeIndex;
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    expect(s.attention).toBe(20);
    s = descend(s);
    expect(s.layer).toBe(1);
    expect(s.attention).toBe(20); // nothing quiets him
    expect(s.sleepDepth).toBe(T); // nor redraws him
    expect(s.wakeIndex).toBe(index + 2); // two actions, no entry draw
    expect(replay(s.board, { ...r2, wakeMeter: carry }, s.actions).attention).toBe(20);
  });

  test("rules 1 keeps build 192's game: no meter, no sleep depth, the layer's table", () => {
    let s = act(start(), "shove", t(0, 0));
    expect(s.attention).toBe(0);
    expect(s.sleepDepth).toBe(0);
    expect(attentionOf(s)).toBe(0);
    expect(nextThreshold(s, "rub")).toBe(wakeThreshold(0, "rub", false));
    s = descend(act(s, "shove", t(0, 1)));
    expect(s.attention).toBe(0);
    expect(s.wakeIndex).toBe(2); // no entry draws under rule 1
  });
});

describe("sanitizeWakeMeter — the tuning row, made safe", () => {
  test("the server row's keys map across, and each field falls back on its own", () => {
    expect(sanitizeWakeMeter({ lo: 40, hi: 80, scope: "dig", dig_root_gt: 1 })).toEqual({
      lo: 40,
      hi: 80,
      scope: "dig",
      digRootGt: 1,
    });
    expect(sanitizeWakeMeter({ lo: 40 })).toEqual({ ...WAKE_METER, lo: 40 });
    expect(sanitizeWakeMeter({})).toEqual(WAKE_METER);
    expect(sanitizeWakeMeter(null)).toEqual(WAKE_METER);
    expect(sanitizeWakeMeter("nonsense")).toEqual(WAKE_METER);
  });

  test("a band that is not a band falls back whole, and the die is the ceiling", () => {
    expect(sanitizeWakeMeter({ lo: 90, hi: 30 })).toEqual(WAKE_METER); // inverted
    expect(sanitizeWakeMeter({ lo: 60, hi: 60 })).toEqual(WAKE_METER); // no band
    expect(sanitizeWakeMeter({ lo: -5, hi: 400 })).toEqual({ ...WAKE_METER, lo: 1, hi: WAKE_DIE });
    expect(sanitizeWakeMeter({ scope: "sideways" }).scope).toBe("board");
    expect(sanitizeWakeMeter({ dig_root_gt: 7 }).digRootGt).toBe(0);
    expect(sanitizeWakeMeter({ lo: 50.9, hi: 110.9 })).toEqual(WAKE_METER); // truncated
  });
});

describe("the descent gate (§4)", () => {
  test("Dig deeper is shut until this board's truffle is up, and the reducer refuses it", () => {
    let s = start();
    expect(canDescend(s)).toBe(false);
    expect(descend(s)).toBe(s); // a no-op, the same object
    s = act(s, "shove", t(0, 0)); // half the domino is not the domino
    expect(canDescend(s)).toBe(false);
    expect(descend(s)).toBe(s);
    s = act(s, "shove", t(0, 1)); // …now it is up
    expect(canDescend(s)).toBe(true);
    s = descend(s);
    expect(s.layer).toBe(1);
    expect(s.banked).toEqual(["l0:truffle_d"]);
    // The root is never descended from, truffle or no truffle.
    expect(canDescend(toLayer(start(), 2))).toBe(false);
    // Neither is an ended dig.
    expect(canDescend(reduce(s, { type: "tie" }))).toBe(false);
  });

  test("a replay still descends: a log that reached the mud found the truffle on the phone that wrote it", () => {
    // A log with a mud entry and no topsoil truffle in it — what a build
    // without the gate could write, and what the server may hand back.
    const log = ["r0:24", "h1:7"];
    const s = replay(board(QUIET), opts, log);
    expect(s.layer).toBe(1);
    expect(s.actions).toEqual(log);
    expect(s.missed).toEqual([]); // the topsoil truffle was never touched
    // …and `restore` takes a snapshot one board deeper than its own log.
    const deeper = restore(board(QUIET), opts, { layer: 2, actions: log });
    expect(deeper.layer).toBe(2);
  });
});
