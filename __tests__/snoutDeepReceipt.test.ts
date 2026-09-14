// receipt(state) — what the payoff sheets render (spec §5.7, §5.8, §1.7 and
// the GT reasons of §4), for a tie, a wake and an uncrewed dig.

import { PATCH_COLS, TILE_DEPTH } from "../constants/dig";
import { WakeStream } from "../utils/rooting";
import {
  digLayerLine,
  findRevealLine,
  gtReasons,
  initialState,
  oddsPhrase,
  receipt,
  reduce,
  whisperFor,
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
function find(id: string, kind: Find["kind"], tiles: number[], variant?: string): Find {
  return { id, kind, tiles, food: kind === "truffle_d" || kind === "truffle_l", ...(variant ? { variant } : {}) };
}
function board(seed: number): SnoutDeepBoard {
  return {
    seed,
    baseFinds: ["truffle_l", "truffle_d", "junk_boot"],
    layers: [
      layer([find("l0:truffle_d", "truffle_d", [t(0, 0), t(0, 1)]), find("l0:boom", "boom", [t(2, 2)]), find("l0:junk", "junk", [t(4, 0)], "horseshoe")]),
      layer([find("l1:truffle_l", "truffle_l", [t(1, 1), t(2, 1), t(2, 2)]), find("l1:scroll", "scroll", [t(4, 4)])]),
      layer([find("l2:relic", "relic", [t(0, 5)])]),
    ],
  };
}
function seedWhere(n: number, pred: (draw: number, k: number) => boolean): number {
  for (let seed = 1; seed < 1_000_000; seed++) {
    const s = new WakeStream(seed);
    let ok = true;
    for (let k = 0; k < n && ok; k++) ok = pred(s.next(), k);
    if (ok) return seed;
  }
  throw new Error("no seed");
}
const QUIET = seedWhere(20, (d) => d >= 40);
const act = (s: SnoutDeepState, verb: "sniff" | "rub" | "shove", tile: number) =>
  reduce(s, { type: "act", verb, tile });
const descend = (s: SnoutDeepState) => reduce(s, { type: "descend" });

/** Topsoil truffle + Boom + keepsake, descend; mud L + scroll, descend. */
function fullRunToRoot(s: SnoutDeepState): SnoutDeepState {
  s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
  s = act(s, "shove", t(2, 2));
  s = act(s, "shove", t(4, 0));
  s = descend(s);
  s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
  s = act(s, "shove", t(4, 4));
  return descend(s);
}

describe("receipt — tied", () => {
  test("at the root: three layers, the things, +3 GT (dig · dig_deep · dig_root), XP", () => {
    let s = fullRunToRoot(initialState(board(QUIET), { coop: false, uncrewed: false }));
    s = act(s, "shove", t(0, 5)); // the relic
    s = reduce(s, { type: "tie" });
    expect(gtReasons(s)).toEqual(["dig", "dig_deep", "dig_root"]);
    const r = receipt(s);
    expect(r.kind).toBe("tied");
    expect(r.title).toBe("Tied off at the root");
    expect(r.countLine).toBe("three layers · 9 actions · he slept through it");
    expect(r.gt).toEqual(["dig", "dig_deep", "dig_root"]);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:boom", "l0:junk", "l1:scroll", "l2:relic", "truffles", "xp"]);
    const truffles = r.rows.find((row) => row.id === "truffles")!;
    expect(truffles.title).toBe("3 Golden Truffles");
    expect(truffles.sub).toBe("topsoil · the mud · the root");
    expect(truffles.value).toBe("+3 GT");
    const xp = r.rows.find((row) => row.id === "xp")!;
    expect(xp.value).toBe("+60 XP"); // +20 the dig, +40 the scroll
    expect(r.xp).toBe(60);
    expect(r.rows.find((row) => row.id === "l0:junk")!.title).toBe("a bent horseshoe");
    expect(r.rows.find((row) => row.id === "l0:boom")!.value).toBe("+3 tickles");
    expect(r.primary).toBe("Back to Barn");
    expect(r.secondary).toBe("share the dig ›");
    expect(r.joinLine).toBeUndefined();
    for (const row of r.rows) expect(row.title).not.toMatch(/!/);
    expect(r.title).not.toMatch(/[!—]/);
  });

  test("in topsoil with the domino: one layer, +1 GT ('dig'); with nothing: no truffles row", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = reduce(s, { type: "tie" });
    const r = receipt(s);
    expect(r.title).toBe("Tied off in topsoil");
    expect(r.gt).toEqual(["dig"]);
    expect(r.rows.find((row) => row.id === "truffles")!.title).toBe("a Golden Truffle");
    const empty = receipt(reduce(initialState(board(QUIET), { coop: false, uncrewed: false }), { type: "tie" }));
    expect(empty.gt).toEqual([]);
    expect(empty.rows.map((row) => row.id)).toEqual(["xp"]);
    expect(empty.countLine).toBe("one layer · 0 actions · he slept through it");
  });

  test("the root pays 'dig_root' only when the mud truffle banked", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(descend(s)); // the mud left unfound
    s = reduce(s, { type: "tie" });
    expect(receipt(s).gt).toEqual(["dig"]);
    expect(receipt(s).title).toBe("Tied off at the root");
  });

  test("cap and close read as ties", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = reduce(s, { type: "close" });
    expect(receipt(s).kind).toBe("tied");
    expect(receipt(s).countLine).toContain("the patch closed on you");
  });
});

describe("receipt — woke", () => {
  test("names the action and its odds; the loose truffle is his; things and earlier GT stay", () => {
    // Quiet through the full run (8 shoves ≥ 40), then reach the root with
    // everything and wake on a root rub (the 9th draw < 15).
    const seed = seedWhere(9, (d, k) => (k === 8 ? d < 15 : d >= 40));
    let s = fullRunToRoot(initialState(board(seed), { coop: false, uncrewed: false }));
    s = act(s, "rub", t(4, 4));
    expect(s.ended).toEqual({ reason: "wake", layer: 2, wokeOn: "r2:28" });
    const r = receipt(s);
    expect(r.kind).toBe("woke");
    expect(r.title).toBe("He woke.");
    expect(r.kicker).toBe("woke in the root");
    expect(r.wokeLine).toBe("pushed the root on a rub. one in eight — this was the one.");
    expect(r.nextTimeLine).toBe("next time — tie it at the mud?");
    // No truffle was loose at the root (it has none), so no "his" row; the
    // two banked truffles still pay, but the root's own bonus does not.
    expect(r.gt).toEqual(["dig", "dig_deep"]);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:boom", "l0:junk", "l1:scroll", "truffles", "xp"]);
    expect(r.primary).toBe("Back to Barn");
  });

  test("a wake with the mud truffle loose: the fat one · his — gilded next Feeding", () => {
    const seed = seedWhere(8, (d, k) => (k === 7 ? d < 6 : d >= 40));
    let s = initialState(board(seed), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(s);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2)); // 5 draws
    s = act(s, "shove", t(4, 4)); // 6 — the scroll
    s = act(s, "sniff", t(4, 0)); // 7 — free
    s = act(s, "rub", t(4, 0)); // 8 — wakes him
    expect(s.ended?.reason).toBe("wake");
    const r = receipt(s);
    expect(r.kicker).toBe("woke in the mud");
    expect(r.wokeLine).toBe("worked the mud on a rub. one in twenty — this was the one.");
    expect(r.nextTimeLine).toBe("next time — tie it in topsoil?");
    const his = r.rows[0];
    expect(his.id).toBe("l1:truffle_l");
    expect(his.title).toBe("the fat one");
    expect(his.sub).toBe("his — gilded next Feeding");
    expect(his.value).toBe("his");
    expect(r.gt).toEqual(["dig"]); // topsoil banked on descent (acceptance 3)
    expect(r.rows.map((row) => row.id)).toEqual(["l1:truffle_l", "l1:scroll", "truffles", "xp"]);
  });

  test("co-op odds read in the woke line", () => {
    const seed = seedWhere(9, (d, k) => (k === 8 ? d < 4 : d >= 40));
    let s = fullRunToRoot(initialState(board(seed), { coop: true, uncrewed: false }));
    s = act(s, "sniff", t(4, 4));
    expect(s.ended?.reason).toBe("wake");
    expect(receipt(s).wokeLine).toBe("pushed the root on a sniff. one in thirty — this was the one.");
  });
});

describe("receipt — uncrewed (acceptance 9)", () => {
  test("no GT rows, the join line, and every thing still pays", () => {
    let s = fullRunToRoot(initialState(board(QUIET), { coop: false, uncrewed: true }));
    s = reduce(s, { type: "tie" });
    expect(gtReasons(s)).toEqual([]);
    const r = receipt(s);
    expect(r.gt).toEqual([]);
    expect(r.rows.some((row) => row.id === "truffles")).toBe(false);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:boom", "l0:junk", "l1:scroll", "xp"]);
    expect(r.joinLine).toBe("truffles are for herds — find yours ›");
    expect(r.secondary).toBeUndefined();
    expect(s.banked).toEqual(["l0:truffle_d", "l1:truffle_l"]); // banked, just not minted
  });
});

describe("copy", () => {
  test("reveal lines (§5.3)", () => {
    expect(findRevealLine(find("x", "boom", [0]), 19)).toBe("a Tickle Boom · +19 tickles, yours");
    expect(findRevealLine(find("x", "boom", [0]))).toBe("a Tickle Boom · +3 tickles, yours");
    expect(findRevealLine(find("x", "acorn", [0]))).toBe("a Clockwork Acorn · a day of the Auto-Tickler");
    expect(findRevealLine(find("x", "furnishing", [0]))).toBe("an Unearthed furnishing · new for the Barn");
    expect(findRevealLine(find("x", "junk", [0], "boot"))).toBe("his old boot · new for the Barn");
  });

  test("odds phrases", () => {
    expect(oddsPhrase(20)).toBe("one in six");
    expect(oddsPhrase(6)).toBe("one in twenty");
    expect(oddsPhrase(7)).toBe("one in seventeen");
    expect(oddsPhrase(15)).toBe("one in eight");
    expect(oddsPhrase(0)).toBe("never");
    expect(oddsPhrase(11)).toBe("one in 11");
  });

  test("whispers say that something is near, never what (§5.4)", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    expect(whisperFor(s)).toMatch(/^topsoil\. a sniff counts/);
    s = act(s, "sniff", t(1, 1)); // 3
    s = act(s, "sniff", t(3, 3)); // 1 (the Boom)
    expect(whisperFor(s)).toBe("a 3 beside a 1 — the truffle runs one way. follow the bigger number.");
    s = descend(s);
    expect(whisperFor(s)).toMatch(/^the mud\. fatter down here/);
    s = descend(s);
    expect(whisperFor(s)).toBe(
      "the root. a 1 on its own is usually a thing, not a truffle. one rub in eight wakes him now. one sniff in seventeen.",
    );
    for (const line of [whisperFor(s)]) {
      for (const name of ["Boom", "acorn", "relic", "scroll", "tea"]) expect(line).not.toContain(name);
    }
  });
});

// The Feeding card's per-member line (spec §3 / §5.10) — read off the row's
// layer_tied / woke; a classic dig (no layer) renders the existing line.
describe("digLayerLine", () => {
  test("names the layer tied or woken at", () => {
    expect(digLayerLine(0, false)).toBe("tied at topsoil");
    expect(digLayerLine(1, false)).toBe("tied at the mud");
    expect(digLayerLine(2, false)).toBe("tied at the root");
    expect(digLayerLine(2, true)).toBe("woke at the root");
    expect(digLayerLine(1, true)).toBe("woke at the mud");
  });

  test("is null for a classic row or a bad layer", () => {
    expect(digLayerLine(null, false)).toBeNull();
    expect(digLayerLine(undefined, undefined)).toBeNull();
    expect(digLayerLine(3, false)).toBeNull();
  });
});
