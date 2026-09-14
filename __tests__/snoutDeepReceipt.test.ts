// receipt(state) — the tally the payoff sheets render (spec §5.7, §5.8, §1.7,
// §2's tickle table and the GT reasons of §4), for a tie, a wake and an
// uncrewed dig; reconcileReceipt — the server's numbers re-aiming it.

import { DIG_FIND_TICKLES, PATCH_COLS, TILE_DEPTH } from "../constants/dig";
import { WakeStream } from "../utils/rooting";
import {
  BOOM_BASE_TICKLES,
  digLayerLine,
  findRevealLine,
  gtReasons,
  initialState,
  JOIN_LINE,
  oddsPhrase,
  receipt,
  reconcileReceipt,
  reduce,
  resolveDigFindTickles,
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

describe("receipt — tied (the tally, §5.7)", () => {
  test("at the root: one row per find in the order it surfaced, each worth its tickles; +3 GT on the truffle rows; XP last", () => {
    let s = fullRunToRoot(initialState(board(QUIET), { coop: false, uncrewed: false }));
    s = act(s, "shove", t(0, 5)); // the relic
    s = reduce(s, { type: "tie" });
    expect(gtReasons(s)).toEqual(["dig", "dig_deep", "dig_root"]);
    const r = receipt(s, { tickledBefore: 38 });
    expect(r.kind).toBe("tied");
    expect(r.kicker).toBe("the truffle patch · tied at the root");
    expect(r.title).toBe("What the dig was worth");
    expect(r.countLine).toBe("each thing lands, the count ticks. 9 actions · he slept through it.");
    expect(r.gt).toEqual(["dig", "dig_deep", "dig_root"]);
    // Surfacing order (state.found): the domino, the Boom, the keepsake, the fat one, the scroll, the relic.
    expect(r.rows.map((row) => row.id)).toEqual([
      "l0:truffle_d", "l0:boom", "l0:junk", "l1:truffle_l", "l1:scroll", "l2:relic", "xp",
    ]);
    expect(r.rows.map((row) => row.tickles)).toEqual([10, 3, 3, 15, 10, 15, undefined]);
    expect(r.rows.map((row) => row.value)).toEqual(["+10", "+3", "+3", "+15", "+10", "+15", "+60 XP"]);
    const domino = r.rows[0];
    expect(domino.title).toBe("a truffle");
    expect(domino.sub).toBe("the herd's too — +1 Golden Truffle");
    expect(domino.tone).toBe("sun");
    const fat = r.rows.find((row) => row.id === "l1:truffle_l")!;
    expect(fat.title).toBe("the fat one");
    expect(fat.sub).toBe("the herd's too — +1 Golden Truffle, +1 for the root");
    expect(r.rows.find((row) => row.id === "l0:boom")!.sub).toBe("the catch-up");
    expect(r.rows.find((row) => row.id === "l0:junk")!.title).toBe("a bent horseshoe");
    expect(r.rows.find((row) => row.id === "l0:junk")!.variant).toBe("horseshoe");
    expect(r.rows.find((row) => row.id === "l0:junk")!.sub).toBe("on the shelf as well");
    expect(r.rows.find((row) => row.id === "l1:scroll")!.sub).toBe("+40 Pass XP as well");
    const xp = r.rows[r.rows.length - 1];
    expect(xp.id).toBe("xp");
    expect(xp.value).toBe("+60 XP"); // +20 the dig, +40 the scroll
    expect(xp.tickles).toBeUndefined();
    expect(r.xp).toBe(60);
    // The tally: 10 + 3 + 3 + 15 + 10 + 15.
    expect(r.ticklesTotal).toBe(56);
    expect(r.tickledBefore).toBe(38);
    expect(r.tickledNow).toBe(94);
    expect(r.primary).toBe("Back to the Barn");
    expect(r.secondary).toBe("share the dig ›");
    expect(r.joinLine).toBeUndefined();
    for (const row of r.rows) expect(row.title).not.toMatch(/!/);
    expect(r.title).not.toMatch(/[!—]/);
  });

  test("the server's table wins over the compiled one; the Boom's row names the gap", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = act(s, "shove", t(2, 2)); // the Boom
    s = reduce(s, { type: "tie" });
    const table = resolveDigFindTickles({ truffle_d: { tickles: 12 }, boom: { tickles: 19 } });
    const r = receipt(s, { tickles: table, tickledBefore: 0 });
    expect(r.rows.map((row) => row.tickles)).toEqual([12, 19, undefined]);
    expect(r.rows[1].sub).toBe("the catch-up: 3 + 16 for the gap");
    expect(r.ticklesTotal).toBe(31);
    expect(r.tickledNow).toBe(31);
  });

  test("before unknown: the counts are null and the total still tallies", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = reduce(s, { type: "tie" });
    const r = receipt(s);
    expect(r.ticklesTotal).toBe(10);
    expect(r.tickledBefore).toBeNull();
    expect(r.tickledNow).toBeNull();
  });

  test("in topsoil with the domino: its row and +1 GT ('dig'); with nothing: XP alone, +0", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = reduce(s, { type: "tie" });
    const r = receipt(s, { tickledBefore: 5 });
    expect(r.kicker).toBe("the truffle patch · tied at topsoil");
    expect(r.gt).toEqual(["dig"]);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:truffle_d", "xp"]);
    expect(r.rows[0].sub).toBe("the herd's too — +1 Golden Truffle");
    expect(r.tickledNow).toBe(15);
    const empty = receipt(reduce(initialState(board(QUIET), { coop: false, uncrewed: false }), { type: "tie" }), { tickledBefore: 5 });
    expect(empty.gt).toEqual([]);
    expect(empty.rows.map((row) => row.id)).toEqual(["xp"]);
    expect(empty.ticklesTotal).toBe(0);
    expect(empty.tickledNow).toBe(5);
    expect(empty.countLine).toBe("each thing lands, the count ticks. 0 actions · he slept through it.");
  });

  test("a truffle left in the ground is not a row; the root pays 'dig_root' only when the mud truffle banked", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(descend(s)); // the mud left unfound
    s = reduce(s, { type: "tie" });
    const r = receipt(s);
    expect(r.gt).toEqual(["dig"]);
    expect(r.kicker).toBe("the truffle patch · tied at the root");
    expect(r.rows.map((row) => row.id)).toEqual(["l0:truffle_d", "xp"]);
    expect(r.rows[0].sub).toBe("the herd's too — +1 Golden Truffle");
  });

  test("cap and close read as ties", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = reduce(s, { type: "close" });
    expect(receipt(s).kind).toBe("tied");
    expect(receipt(s).countLine).toContain("the patch closed on you");
  });
});

describe("receipt — woke (the same tally, §5.8)", () => {
  test("names the action and its odds; the banked truffles pay, the pouch carried down is lost, the keepsake is kept unpaid", () => {
    // Quiet through the full run (8 shoves ≥ 40), then reach the root with
    // everything and wake on a root rub (the 9th draw < 15).
    const seed = seedWhere(9, (d, k) => (k === 8 ? d < 15 : d >= 40));
    let s = fullRunToRoot(initialState(board(seed), { coop: false, uncrewed: false }));
    expect(s.looseThings).toEqual(["l0:boom", "l1:scroll"]); // two layers' worth, still at stake
    s = act(s, "rub", t(4, 4));
    expect(s.ended).toEqual({ reason: "wake", layer: 2, wokeOn: "r2:28" });
    const r = receipt(s, { tickledBefore: 38 });
    expect(r.kind).toBe("woke");
    expect(r.title).toBe("He woke. Still worth it.");
    expect(r.kicker).toBe("the truffle patch · he woke at the root");
    expect(r.wokeLine).toBe("pushed the root on a rub. one in eight — this was the one.");
    expect(r.nextTimeLine).toBe("next time — tie it at the mud?");
    // No truffle was loose at the root (it has none), so no "his" row; the
    // two banked truffles still pay, but the root's own bonus does not — and
    // the Boom and the scroll, never tied, went with the pouch.
    expect(r.countLine).toBe("what you'd tied is yours. the loose pouch was his.");
    expect(r.gt).toEqual(["dig", "dig_deep"]);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:truffle_d", "l0:boom", "l0:junk", "l1:truffle_l", "l1:scroll", "xp"]);
    expect(r.rows.find((row) => row.id === "l1:truffle_l")!.sub).toBe("the herd's too — +1 Golden Truffle");
    const boom = r.rows.find((row) => row.id === "l0:boom")!;
    expect(boom.lost).toBe(true);
    expect(boom.value).toBe("lost");
    expect(boom.tickles).toBe(0);
    expect(boom.sub).toBe("lost with the layer");
    expect(boom.tone).toBe("roseDeep");
    const scroll = r.rows.find((row) => row.id === "l1:scroll")!;
    expect(scroll.lost).toBe(true);
    expect(scroll.value).toBe("lost");
    // The keepsake is a Barn piece: kept, no number.
    const junk = r.rows.find((row) => row.id === "l0:junk")!;
    expect(junk.kept).toBe(true);
    expect(junk.value).toBe("kept");
    expect(junk.tickles).toBeUndefined();
    expect(junk.lost).toBeUndefined();
    expect(junk.sub).toBe("kept — its tickles went with the pouch");
    // The lost scroll pays no XP either: the dig's +20 alone.
    expect(r.xp).toBe(20);
    // The foot sums only the paid rows: 10 + 15.
    expect(r.ticklesTotal).toBe(25);
    expect(r.tickledNow).toBe(63);
    expect(r.primary).toBe("Back to the Barn");
    expect(r.secondary).toBeUndefined();
  });

  test("a wake with the mud truffle loose: the fat one · his — first, on roseDeep, no number; the rest pay", () => {
    const seed = seedWhere(8, (d, k) => (k === 7 ? d < 6 : d >= 40));
    let s = initialState(board(seed), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(s);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2)); // 5 draws
    s = act(s, "shove", t(4, 4)); // 6 — the scroll
    s = act(s, "sniff", t(4, 0)); // 7 — free
    s = act(s, "rub", t(4, 0)); // 8 — wakes him
    expect(s.ended?.reason).toBe("wake");
    const r = receipt(s, { tickledBefore: 38 });
    expect(r.kicker).toBe("the truffle patch · he woke at the mud");
    expect(r.countLine).toBe("what you'd tied is yours. the loose truffle and the pouch were his.");
    expect(r.wokeLine).toBe("worked the mud on a rub. one in twenty — this was the one.");
    expect(r.nextTimeLine).toBe("next time — tie it in topsoil?");
    const his = r.rows[0];
    expect(his.id).toBe("l1:truffle_l");
    expect(his.title).toBe("the fat one");
    expect(his.sub).toBe("his — comes back gilded next Feeding");
    expect(his.value).toBe("his");
    expect(his.tickles).toBeUndefined();
    expect(his.lost).toBe(true);
    expect(his.tone).toBe("roseDeep");
    expect(r.gt).toEqual(["dig"]); // topsoil banked on descent (acceptance 3)
    expect(r.rows.map((row) => row.id)).toEqual(["l1:truffle_l", "l0:truffle_d", "l1:scroll", "xp"]);
    // Smaller, never zero: the domino 10; the fat one pays 0 and the scroll,
    // loose in the pouch, is lost with it.
    expect(r.rows[2].lost).toBe(true);
    expect(r.rows[2].value).toBe("lost");
    expect(r.ticklesTotal).toBe(10);
    expect(r.tickledNow).toBe(48);
  });

  test("a wake with only the truffle loose keeps the old line", () => {
    const seed = seedWhere(6, (d, k) => (k === 5 ? d < 6 : d >= 40));
    let s = initialState(board(seed), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(s);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2)); // 5
    s = act(s, "rub", t(4, 0)); // 6 — wakes him
    expect(s.ended?.reason).toBe("wake");
    const r = receipt(s);
    expect(r.countLine).toBe("what you'd tied is yours. the loose truffle was his.");
    expect(r.rows.map((row) => row.id)).toEqual(["l1:truffle_l", "l0:truffle_d", "xp"]);
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
  test("the truffle rows are the join door and still pay; no GT; every thing pays", () => {
    let s = fullRunToRoot(initialState(board(QUIET), { coop: false, uncrewed: true }));
    s = reduce(s, { type: "tie" });
    expect(gtReasons(s)).toEqual([]);
    const r = receipt(s, { tickledBefore: 0 });
    expect(r.gt).toEqual([]);
    expect(r.rows.map((row) => row.id)).toEqual(["l0:truffle_d", "l0:boom", "l0:junk", "l1:truffle_l", "l1:scroll", "xp"]);
    for (const id of ["l0:truffle_d", "l1:truffle_l"]) {
      const row = r.rows.find((x) => x.id === id)!;
      expect(row.sub).toBe(JOIN_LINE);
      expect(row.join).toBe(true);
      expect(row.tickles).toBeGreaterThan(0);
    }
    expect(r.rows.find((x) => x.id === "l0:boom")!.join).toBeUndefined();
    expect(r.ticklesTotal).toBe(41);
    // The rows carry the door, so the foot does not repeat it.
    expect(r.joinLine).toBeUndefined();
    expect(r.secondary).toBeUndefined();
    // Banked, just not minted — the truffles on descent, the pouch on the tie.
    expect(s.banked).toEqual(["l0:truffle_d", "l1:truffle_l", "l0:boom", "l1:scroll"]);
  });

  test("with no truffle row the foot carries the join line", () => {
    const r = receipt(reduce(initialState(board(QUIET), { coop: false, uncrewed: true }), { type: "tie" }));
    expect(r.rows.map((row) => row.id)).toEqual(["xp"]);
    expect(r.joinLine).toBe(JOIN_LINE);
  });
});

describe("reconcileReceipt — the server's numbers re-aim the tally", () => {
  test("rows are corrected by id, then by kind; the totals and the counts follow", () => {
    let s = fullRunToRoot(initialState(board(QUIET), { coop: false, uncrewed: false }));
    s = reduce(s, { type: "tie" });
    const r = receipt(s); // before unknown
    const fixed = reconcileReceipt(r, {
      tickles: [
        { id: "l0:truffle_d", kind: "truffle_d", tickles: 10 },
        { id: "truffle_l", kind: "truffle_l", tickles: 15 }, // the server names the mud's by kind
        { id: "l0:boom", kind: "boom", tickles: 19 }, // the catch-up
        { id: "l0:junk", kind: "junk", tickles: 3 },
        { id: "l1:scroll", kind: "scroll", tickles: 10 },
      ],
      ticklesTotal: 57,
      tickledBefore: 38,
      tickledNow: 95,
    });
    expect(fixed.rows.map((row) => row.id)).toEqual(r.rows.map((row) => row.id)); // order kept
    expect(fixed.rows.find((row) => row.id === "l0:boom")!.tickles).toBe(19);
    expect(fixed.rows.find((row) => row.id === "l0:boom")!.value).toBe("+19");
    expect(fixed.rows.find((row) => row.id === "l1:truffle_l")!.tickles).toBe(15);
    expect(fixed.ticklesTotal).toBe(57);
    expect(fixed.tickledBefore).toBe(38);
    expect(fixed.tickledNow).toBe(95);
    // Untouched rows are the same objects.
    expect(fixed.rows.find((row) => row.id === "xp")).toBe(r.rows.find((row) => row.id === "xp"));
  });

  test("an older server (no tally) leaves the receipt as built", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = reduce(s, { type: "tie" });
    const r = receipt(s, { tickledBefore: 4 });
    const same = reconcileReceipt(r, {});
    expect(same.ticklesTotal).toBe(10);
    expect(same.tickledBefore).toBe(4);
    expect(same.tickledNow).toBe(14);
  });

  test("a lost row is never re-aimed", () => {
    const seed = seedWhere(8, (d, k) => (k === 7 ? d < 6 : d >= 40));
    let s = initialState(board(seed), { coop: false, uncrewed: false });
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    s = descend(s);
    s = act(act(act(s, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
    s = act(s, "shove", t(4, 4));
    s = act(s, "sniff", t(4, 0));
    s = act(s, "rub", t(4, 0));
    const r = reconcileReceipt(receipt(s, { tickledBefore: 0 }), {
      tickles: [{ id: "l1:truffle_l", kind: "truffle_l", tickles: 0, lost: true }],
      ticklesTotal: 20,
      tickledBefore: 0,
      tickledNow: 20,
    });
    expect(r.rows[0].lost).toBe(true);
    expect(r.rows[0].tickles).toBeUndefined();
    expect(r.rows[0].value).toBe("his");
    // The lost scroll stays lost even when the server names a scroll by kind.
    const again = reconcileReceipt(receipt(s, { tickledBefore: 0 }), {
      tickles: [
        { id: "l1:truffle_l", kind: "truffle_l", tickles: 0, lost: true },
        { id: "l1:scroll", kind: "scroll", tickles: 0, lost: true },
        { id: "l0:truffle_d", kind: "truffle_d", tickles: 10 },
      ],
      ticklesTotal: 10,
    });
    const scroll = again.rows.find((row) => row.id === "l1:scroll")!;
    expect(scroll.lost).toBe(true);
    expect(scroll.tickles).toBe(0);
    expect(scroll.value).toBe("lost");
    expect(again.ticklesTotal).toBe(10);
  });

  test("a kept row is never re-aimed either, and a server `kept` row names no tickles", () => {
    const seed = seedWhere(9, (d, k) => (k === 8 ? d < 15 : d >= 40));
    let s = fullRunToRoot(initialState(board(seed), { coop: false, uncrewed: false }));
    s = act(s, "rub", t(4, 4));
    const r = reconcileReceipt(receipt(s, { tickledBefore: 0 }), {
      tickles: [
        { id: "l0:truffle_d", kind: "truffle_d", tickles: 10 },
        { id: "l1:truffle_l", kind: "truffle_l", tickles: 15 },
        { id: "l0:boom", kind: "boom", tickles: 0, lost: true },
        { id: "l1:scroll", kind: "scroll", tickles: 0, lost: true },
        { id: "l0:junk", kind: "junk", tickles: 0, kept: true },
      ],
      ticklesTotal: 25,
      tickledBefore: 0,
      tickledNow: 25,
    });
    const junk = r.rows.find((row) => row.id === "l0:junk")!;
    expect(junk.kept).toBe(true);
    expect(junk.tickles).toBeUndefined();
    expect(junk.value).toBe("kept");
    expect(r.ticklesTotal).toBe(25);
  });
});

describe("resolveDigFindTickles — the server's table over the compiled one", () => {
  test("the compiled table matches the migration's values (spec §2)", () => {
    expect(DIG_FIND_TICKLES).toEqual({
      truffle_d: 10, boom: 3, pouch: 5, apple: 4, junk: 3, truffle_l: 15, shimmer: 8, acorn: 12,
      tea: 8, scroll: 10, relic: 15, furnishing: 20, bow: 25, charm: 12, stone: 0,
    });
    expect(BOOM_BASE_TICKLES).toBe(3);
  });

  test("names only what the server names; an older {kind: [n, d]} shape names nothing", () => {
    expect(resolveDigFindTickles(null)).toEqual(DIG_FIND_TICKLES);
    expect(resolveDigFindTickles({ pouch: [1, 2], relic: [2, 5] })).toEqual(DIG_FIND_TICKLES);
    const t = resolveDigFindTickles({ pouch: { odds: [1, 2], tickles: 7 }, boom: { tickles: 19 }, junk: { tickles: -4 }, tea: { tickles: "9" } });
    expect(t.pouch).toBe(7);
    expect(t.boom).toBe(19);
    expect(t.junk).toBe(DIG_FIND_TICKLES.junk);
    expect(t.tea).toBe(DIG_FIND_TICKLES.tea);
    expect(t.relic).toBe(15);
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

  test("the pouch whisper says the stake when things are loose and no truffle is", () => {
    let s = initialState(board(QUIET), { coop: false, uncrewed: false });
    s = act(s, "shove", t(2, 2)); // the Boom, loose
    s = act(s, "sniff", t(4, 4));
    expect(whisperFor(s)).toBe("one thing loose in the pouch. tie it off to keep it, or carry it down.");
    // The loose truffle speaks first.
    s = act(act(s, "shove", t(0, 0)), "shove", t(0, 1));
    expect(whisperFor(s)).toBe("the truffle is loose. tie it off, or dig deeper and bank it on the way down.");
    s = descend(s); // the truffle banks; the Boom rides down
    s = act(s, "sniff", t(0, 0));
    s = act(s, "shove", t(4, 4)); // the scroll joins it
    expect(whisperFor(s)).toBe("two things loose in the pouch. tie it off to keep them, or carry them down.");
    s = descend(s);
    s = act(s, "sniff", t(3, 3));
    expect(whisperFor(s)).toBe("two things loose in the pouch. tie it off to keep them — nothing carries deeper than the root.");
    for (const name of ["Boom", "scroll"]) expect(whisperFor(s)).not.toContain(name);
  });

  test("the woke whisper names the pouch when it went with him", () => {
    const seed = seedWhere(9, (d, k) => (k === 8 ? d < 15 : d >= 40));
    let s = fullRunToRoot(initialState(board(seed), { coop: false, uncrewed: false }));
    s = act(s, "rub", t(4, 4));
    expect(whisperFor(s)).toBe("he woke. the loose pouch is his. what you'd tied is yours.");
    const seed2 = seedWhere(8, (d, k) => (k === 7 ? d < 6 : d >= 40));
    let w = initialState(board(seed2), { coop: false, uncrewed: false });
    w = act(act(w, "shove", t(0, 0)), "shove", t(0, 1));
    w = descend(w);
    w = act(act(act(w, "shove", t(1, 1)), "shove", t(2, 1)), "shove", t(2, 2));
    w = act(w, "shove", t(4, 4));
    w = act(w, "sniff", t(4, 0));
    w = act(w, "rub", t(4, 0));
    expect(whisperFor(w)).toBe("he woke. the loose truffle and the pouch are his — the truffle comes back gilded, next Feeding.");
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
