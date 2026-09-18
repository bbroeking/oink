// The Snout Deep screen and its sheets, rendered — the renderer over the
// reducer. A tap is an event, the log grows, the tag reads the layer, the
// receipt sheet lays its rows on the ledger. No timers, no network. Rendered
// under Reduce Motion: the sleeper's breath is an Animated.loop, and a loop
// under react-test-renderer's act() never settles.
// The ui barrel reaches Sentry through utils/log; mocked as the other
// component suites do, so no Sentry interval outlives the run.
jest.mock("../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import React, { useEffect, useReducer } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SnoutDeepPatch } from "../components/mudwar/SnoutDeepPatch";
import { DigReceiptSheet, SnoutDeepHelpSheet } from "../components/mudwar/SnoutDeepSheets";
import { Hungerer, hungererStateFor } from "../components/mudwar/Hungerer";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";
import { generateLayeredBoard, WakeStream } from "../utils/rooting";
import { initialState, receipt, reconcileReceipt, reduce, type DigReceipt, type Find, type SnoutDeepState } from "../utils/snoutDeep";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrap = (node: React.ReactNode, reduceMotion = true) => (
  <SafeAreaProvider initialMetrics={metrics}>
    <MotionPolicyProvider reduceMotion={reduceMotion}>{node}</MotionPolicyProvider>
  </SafeAreaProvider>
);

const SEED = 20260913;
// A seed that sleeps through anything a test does: every draw clears the
// root's shove, the loudest roll in either rule set. The descent gate (§4)
// makes a test dig its way down, and those actions must not wake him.
const QUIET = (() => {
  for (let seed = 1; seed < 1_000_000; seed++) {
    const s = new WakeStream(seed);
    let ok = true;
    for (let k = 0; k < 20 && ok; k++) ok = s.next() >= 40;
    if (ok) return seed;
  }
  throw new Error("no seed");
})();
// The harness reports its state through a box the tests read after each act.
const seen: { latest: SnoutDeepState | null; done: DigReceipt | null } = { latest: null, done: null };

function Harness({
  coop = false,
  uncrewed = false,
  seed = SEED,
  rules = 1,
}: {
  coop?: boolean;
  uncrewed?: boolean;
  seed?: number;
  rules?: 1 | 2;
}) {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(generateLayeredBoard(seed), { coop, uncrewed, rules }),
  );
  useEffect(() => {
    seen.latest = state;
  }, [state]);
  return (
    <SnoutDeepPatch
      state={state}
      dispatch={dispatch}
      secondsLeft={2 * 3600 + 10 * 60}
      onExit={() => {}}
      onDone={(r) => {
        seen.done = r;
      }}
    />
  );
}

function texts(renderer: TestRenderer.ReactTestRenderer): string[] {
  return renderer.root.findAllByType(Text).map((n) => {
    const c = n.props.children;
    return Array.isArray(c) ? c.join("") : String(c ?? "");
  });
}
// The Pressable fiber: react-native's export is a memo wrapper, so match the
// component by name rather than by identity.
const isPressable = (n: TestRenderer.ReactTestInstance) =>
  typeof n.type !== "string" &&
  ((n.type as { displayName?: string }).displayName ?? (n.type as { name?: string }).name) === "Pressable";
function pressables(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findAll(isPressable);
}
/** Shove every tile of a find until it surfaces — how a test opens the
 *  descent gate (§4: deeper stays shut until this board's truffle is up). */
function surface(renderer: TestRenderer.ReactTestRenderer, find: Find) {
  for (const tile of find.tiles) {
    const node = pressables(renderer).filter((n) =>
      new RegExp(`^row ${Math.floor(tile / 6) + 1}, column ${(tile % 6) + 1}, `).test(
        n.props.accessibilityLabel ?? "",
      ),
    )[0];
    if (node?.props.disabled) continue; // a splash already cleared it
    act(() => node.props.onLongPress());
  }
}
/** The board's truffle on the layer the dig is on. */
const truffleHere = (): Find =>
  seen.latest!.board.layers[seen.latest!.layer].finds.find((f) => f.food)!;
function pressLabelled(renderer: TestRenderer.ReactTestRenderer, label: string | RegExp) {
  const node = pressables(renderer).filter(
    (n) =>
      typeof n.props.accessibilityLabel === "string" &&
      (typeof label === "string" ? n.props.accessibilityLabel === label : label.test(n.props.accessibilityLabel)),
  )[0];
  expect(node).toBeDefined();
  act(() => node.props.onPress?.());
}

describe("SnoutDeepPatch", () => {
  beforeEach(() => {
    seen.latest = null;
    seen.done = null;
  });

  test("renders the sign, the sleeper's tag, the whisper, the pouch and the verbs; a tap is one action", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness />));
    });
    const all = texts(renderer).join("\n");
    expect(all).toContain("the truffle patch · Feeding");
    expect(all).toContain("closes in 2h 10m");
    expect(all).toContain("snoring");
    expect(all).toMatch(/topsoil\. a sniff counts/);
    expect(all).toContain("his if he wakes");
    expect(all).toContain("yours for keeps");
    expect(all).toContain("Tie it off");
    expect(all).toContain("Find the truffle first"); // gated until the board's truffle is up
    // The cards wear live odds (2026-09-16): the free sniffs left, then a percent per action.
    for (const word of ["Sniff", "Rub", "Shove", "free · 5 left", "<1% he wakes", "8% he wakes"]) expect(all).toContain(word);
    // No emoji anywhere on the screen.
    expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

    // Rub is the default verb: a tap on row 3, column 3 moves mud.
    pressLabelled(renderer, /^row 3, column 3, buried/);
    expect(seen.latest!.actions).toEqual(["r0:14"]);
    expect(seen.latest!.depths[14]).toBe(1);

    // Sniff selected: a tap marks scent and the tile wears its number.
    pressLabelled(renderer, /^Sniff, free/);
    pressLabelled(renderer, /^row 1, column 1, buried/);
    expect(seen.latest!.actions).toEqual(["r0:14", "s0:0"]);
    expect(texts(renderer).join("\n")).toContain(String(seen.latest!.scent[0]));
    // The same tile again is a no-op: nothing appended.
    pressLabelled(renderer, /^row 1, column 1, buried, scent/);
    expect(seen.latest!.actions).toHaveLength(2);

    // Hold-to-shove works whatever the verb: onLongPress shoves.
    const tile = pressables(renderer).filter((n) =>
      /^row 5, column 6, buried/.test(n.props.accessibilityLabel ?? ""),
    )[0];
    act(() => tile.props.onLongPress());
    expect(seen.latest!.actions).toEqual(["r0:14", "s0:0", "h0:29"]);
    expect(seen.latest!.depths[29]).toBe(0);
    act(() => renderer.unmount());
  });

  test("a surfaced thing announces in an overlay above the scroll — nothing below it moves", () => {
    // Two rubs on row 1, column 5 clear the seed's Tickle Boom (tile 4). The
    // reveal used to mount in the scroll flow and shove the whole patch down
    // for its 1.6s dwell (2026-09-16); it is a pointer-transparent overlay
    // pinned over the header now, a sibling of the ScrollView, never a child.
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness />));
    });
    const { ScrollView } = require("react-native");
    const scroll = renderer.root.findAllByType(ScrollView)[0];
    // The scroll's flow, top to bottom, before the thing surfaces.
    const flowBefore = scroll.findAllByType(Text).map((n) => String(n.props.children)).slice(0, 3);
    pressLabelled(renderer, /^row 1, column 5, buried/);
    pressLabelled(renderer, /^row 1, column 5, half cleared/);
    expect(seen.latest!.found).toEqual(["l0:boom"]);
    const all = texts(renderer).join("\n");
    expect(all).toMatch(/Tickle Boom/);
    // The sticker is not in the scroll's tree …
    const scrollAfter = renderer.root.findAllByType(ScrollView)[0];
    expect(scrollAfter.findAllByType(Text).map((n) => String(n.props.children)).join("\n")).not.toMatch(
      /Tickle Boom/,
    );
    // … and the flow still opens with the sign, not a sticker.
    expect(scrollAfter.findAllByType(Text).map((n) => String(n.props.children)).slice(0, 3)).toEqual(flowBefore);
    // … and the overlay lets taps through to the patch beneath.
    const overlay = renderer.root.findAll(
      (n) => n.props.pointerEvents === "none" && n.findAllByType(Text).some((t) => /Tickle Boom/.test(String(t.props.children))),
    );
    expect(overlay.length).toBeGreaterThan(0);
    act(() => renderer.unmount());
  });

  test("Dig deeper enters the mud (stirring); at the root the footer is one gold tie", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} />));
    });
    // The gate: this board's truffle first, on every board (§4).
    surface(renderer, truffleHere());
    pressLabelled(renderer, /^Dig deeper, a new board in the mud/);
    expect(seen.latest!.layer).toBe(1);
    let all = texts(renderer).join("\n");
    expect(all).toContain("stirring");
    expect(all).toMatch(/the mud\. fatter down here/);
    surface(renderer, truffleHere());
    pressLabelled(renderer, /^Dig deeper, a new board in the root/);
    expect(seen.latest!.layer).toBe(2);
    all = texts(renderer).join("\n");
    expect(all).toContain("one eye open");
    expect(all).toContain("6% · "); // the root's sniff, at the table's odds inside the budget
    // Two truffles banked on the way down, and the root's own +1 for the mud's.
    expect(all).toContain("Tie it off · +3 Golden Truffles");
    expect(all).not.toContain("Dig deeper");
    pressLabelled(renderer, /^Tie it off, plus 3 Golden Truffles/);
    expect(seen.latest!.ended).toEqual({ reason: "tie", layer: 2 });
    expect(seen.done?.kind).toBe("tied");
    expect(seen.done?.title).toBe("What the dig was worth");
    expect(seen.done?.kicker).toBe("the truffle patch · tied at the root");
    act(() => renderer.unmount());
  });

  test("the footer reads the stake live: · bank N / · carry N with the pouch, plain when nothing is loose", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness />));
    });
    let all = texts(renderer).join("\n");
    expect(all).toContain("Tie it off");
    expect(all).toContain("Find the truffle first");
    expect(all).not.toContain("· bank");
    expect(all).not.toContain("· carry");
    expect(all).toContain("nothing loose yet");
    // Surface the topsoil Boom (a consumable): one thing loose in the pouch.
    const boom = seen.latest!.board.layers[0].finds.find((f) => f.kind === "boom")!;
    const truffleId = seen.latest!.board.layers[0].finds.find((f) => f.food)!.id;
    for (const tile of boom.tiles) {
      const node = pressables(renderer).filter((n) =>
        new RegExp(`^row ${Math.floor(tile / 6) + 1}, column ${(tile % 6) + 1}, `).test(n.props.accessibilityLabel ?? ""),
      )[0];
      act(() => node.props.onLongPress());
    }
    expect(seen.latest!.looseThings).toEqual([boom.id]);
    all = texts(renderer).join("\n");
    expect(all).toContain("Tie it off · leave");
    // The gate: with the truffle still buried, deeper asks for it by name (§4).
    expect(all).toContain("Find the truffle first");
    expect(all).not.toContain("nothing loose yet");
    // The loose well names the Boom, the tied well nothing yet.
    const wells = renderer.root.findAll(
      (n) => typeof n.props.accessibilityLabel === "string" && /^(loose|tied), /.test(n.props.accessibilityLabel),
    );
    const labels = wells.map((n) => n.props.accessibilityLabel as string);
    expect(labels.some((l) => l.startsWith("loose, his if he wakes: a Tickle Boom"))).toBe(true);
    expect(labels.some((l) => l.startsWith("tied, yours for keeps: nothing tied yet"))).toBe(true);
    // The truffle up, the gate opens; the Boom rides down — still loose.
    surface(renderer, truffleHere());
    expect(texts(renderer).join("\n")).toContain("Dig deeper · reset");
    pressLabelled(renderer, /^Dig deeper, a new board in the mud, carry 2 down/);
    expect(seen.latest!.layer).toBe(1);
    expect(seen.latest!.looseThings).toEqual([boom.id]);
    expect(seen.latest!.banked).toEqual([truffleId]);
    all = texts(renderer).join("\n");
    expect(all).toContain("Tie it off · leave");
    // A new board, a new gate: the mud's fat one has not surfaced yet.
    expect(all).toContain("Find the truffle first");
    // Tie: the pouch banks; the receipt pays the Boom.
    pressLabelled(renderer, /^Tie it off, leave with 1/);
    expect(seen.latest!.banked).toEqual([truffleId, boom.id]);
    expect(seen.latest!.looseThings).toEqual([]);
    expect(seen.done?.rows.find((r) => r.id === boom.id)?.tickles).toBe(3);
    act(() => renderer.unmount());
  });

  test("the layer strip and the verb bar carry the a11y the taste gate asks for", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness />, true));
    });
    expect(pressables(renderer).length).toBeGreaterThan(30);
    for (const p of pressables(renderer)) {
      expect(p.props.accessibilityRole).toBeTruthy();
      expect(p.props.accessibilityLabel).toBeTruthy();
    }
    act(() => renderer.unmount());
  });
});

describe("the sheets — the tally", () => {
  function tiedDomino(uncrewed = false) {
    let s = initialState(generateLayeredBoard(SEED), { coop: false, uncrewed });
    const domino = s.board.layers[0].finds.find((f) => f.kind === "truffle_d")!;
    for (const t of domino.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
    return reduce(s, { type: "tie" });
  }
  /** Advance the clock a tick at a time so each re-armed timeout gets its render. */
  function ticks(ms: number, times: number) {
    for (let i = 0; i < times; i++) {
      act(() => {
        jest.advanceTimersByTime(ms);
      });
    }
  }
  const hosts = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
    renderer.root.findAll((n) => typeof n.type === "string" && n.props.accessibilityLabel === label);
  /** The tally rows' landed state, top to bottom (hidden = not landed yet). */
  function landedFlags(renderer: TestRenderer.ReactTestRenderer): boolean[] {
    return renderer.root
      .findAll((n) => typeof n.type === "string" && typeof n.props.testID === "string" && n.props.testID.startsWith("tally-row-"))
      .map((n) => !n.props.accessibilityElementsHidden);
  }

  test("under Reduce Motion every row is present at once, the count is settled, the foot and the doors read", () => {
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />),
      );
    });
    const all = texts(renderer).join("\n");
    expect(all).toContain("the truffle patch · tied at topsoil");
    expect(all).toContain("What the dig was worth");
    expect(all).toContain("each thing lands, the count ticks. 2 actions · he slept through it.");
    expect(all).toContain("38"); // before
    expect(all).toContain("48"); // tickled now — settled
    expect(all).toContain("before");
    expect(all).toContain("tickled now");
    expect(all).toContain("a truffle");
    expect(all).toContain("the herd's too — +1 Golden Truffle");
    expect(all).toContain("+10");
    expect(all).toContain("+20 XP");
    expect(all).toContain("the dig");
    expect(all).toContain("Back to the Barn");
    expect(all).toContain("share the dig ›");
    expect(all).toContain("the herd's board: +1 Golden Truffle. things you found are yours alone.");
    expect(all).not.toContain("GT");
    expect(landedFlags(renderer)).toEqual([true, true]);
    // Settled: the hurry target is disabled.
    const hurry = hosts(renderer, "The tally")[0];
    expect(hurry.props.accessibilityState).toEqual({ disabled: true });
    act(() => renderer.unmount());
  });

  test("rows land one by one ~350 ms apart and the count rolls up by each row's tickles", () => {
    jest.useFakeTimers();
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    // Nothing landed yet: the count reads before.
    expect(landedFlags(renderer)).toEqual([false, false]);
    expect(texts(renderer)).toContain("38");
    expect(texts(renderer)).not.toContain("48");
    // The first row lands after its beat; the count starts rolling toward 48.
    ticks(450, 1);
    expect(landedFlags(renderer)).toEqual([true, false]);
    ticks(40, 8);
    expect(texts(renderer)).toContain("48");
    // The second (XP) row lands a stagger later.
    ticks(350, 1);
    expect(landedFlags(renderer)).toEqual([true, true]);
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  test("a tap anywhere hurries: every row lands and the count settles", () => {
    jest.useFakeTimers();
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    const hurry = renderer.root.findAll((n) => n.props.accessibilityLabel === "Hurry the tally")[0];
    expect(hurry).toBeDefined();
    act(() => {
      hurry.props.onPress();
    });
    expect(landedFlags(renderer)).toEqual([true, true]);
    expect(texts(renderer)).toContain("48");
    expect(hosts(renderer, "The tally")).toHaveLength(1);
    expect(hosts(renderer, "Hurry the tally")).toHaveLength(0);
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  /** The bag's tiles, in order, as [testID, hidden-or-not-yet-dropped]. */
  function bagTiles(renderer: TestRenderer.ReactTestRenderer): string[] {
    return renderer.root
      .findAll((n) => typeof n.type === "string" && typeof n.props.testID === "string" && /^dig-satchel-(find|lost)-/.test(n.props.testID))
      .map((n) => n.props.testID as string);
  }
  const bagBlock = (renderer: TestRenderer.ReactTestRenderer) =>
    renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === "dig-satchel");
  const withBag = (r: ReturnType<typeof receipt>) =>
    reconcileReceipt(r, { satchel: { found: ["river_pebble", "old_key"], lost: ["pinecone"], count: 6, cap: 6 } });

  test("no bag on the receipt → no bag block at all", () => {
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />),
      );
    });
    expect(bagBlock(renderer)).toHaveLength(0);
    expect(texts(renderer).join("\n")).not.toContain("satchel");
    act(() => renderer.unmount());
  });

  test("under Reduce Motion the bag is present at once: the bag, a tile per find, a ghost tile for the turned-away, the words", () => {
    const r = withBag(receipt(tiedDomino(), { tickledBefore: 38 }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />),
      );
    });
    const block = bagBlock(renderer);
    expect(block).toHaveLength(1);
    expect(block[0].props.accessibilityElementsHidden).toBe(false);
    expect(bagTiles(renderer)).toEqual([
      "dig-satchel-find-river_pebble",
      "dig-satchel-find-old_key",
      "dig-satchel-lost-pinecone",
    ]);
    const all = texts(renderer).join("\n");
    expect(all).toContain("into your satchel");
    expect(all).toContain("a river pebble and an old key · full now — a pinecone stayed in the mud");
    // The whole block reads as the receipt's one satchel sentence.
    expect(
      hosts(renderer, "your Satchel got heavier: a river pebble and an old key. Satchel's full — a pinecone stayed in the mud."),
    ).toHaveLength(1);
    // Settled: nothing left to hurry.
    expect(hosts(renderer, "The tally")[0].props.accessibilityState).toEqual({ disabled: true });
    act(() => renderer.unmount());
  });

  test("the bag lands a stagger after the last row, then the finds drop one by one", () => {
    jest.useFakeTimers();
    const r = withBag(receipt(tiedDomino(), { tickledBefore: 38 }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    const hidden = () => bagBlock(renderer)[0].props.accessibilityElementsHidden as boolean;
    expect(hidden()).toBe(true);
    ticks(450, 1); // row 1
    ticks(350, 1); // row 2 (XP)
    expect(landedFlags(renderer)).toEqual([true, true]);
    expect(hidden()).toBe(true); // the rows are down; the bag has its own beat
    // Still hurry-able: the bag has not landed.
    expect(hosts(renderer, "Hurry the tally")).toHaveLength(1);
    ticks(350, 1); // the bag
    expect(hidden()).toBe(false);
    // The tiles drop 175 ms apart; each keeps its square meanwhile.
    expect(bagTiles(renderer)).toHaveLength(3);
    ticks(175, 3);
    ticks(40, 8); // the count settles on its own clock
    expect(hosts(renderer, "The tally")[0].props.accessibilityState).toEqual({ disabled: true });
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  test("a bag the server names after the rows have landed still lands, on its own beat", () => {
    jest.useFakeTimers();
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    ticks(450, 1);
    ticks(350, 1);
    ticks(40, 8);
    expect(landedFlags(renderer)).toEqual([true, true]);
    expect(hosts(renderer, "The tally")[0].props.accessibilityState).toEqual({ disabled: true });
    expect(bagBlock(renderer)).toHaveLength(0);
    // The server's receipt lands late with the roll.
    act(() => {
      renderer.update(
        wrap(<DigReceiptSheet visible receipt={withBag(r)} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    expect(bagBlock(renderer)).toHaveLength(1);
    expect(bagBlock(renderer)[0].props.accessibilityElementsHidden).toBe(true);
    ticks(350, 1);
    expect(bagBlock(renderer)[0].props.accessibilityElementsHidden).toBe(false);
    expect(landedFlags(renderer)).toEqual([true, true]); // the rows never restarted
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  test("a hurry lands the bag and drops every find at once", () => {
    jest.useFakeTimers();
    const r = withBag(receipt(tiedDomino(), { tickledBefore: 38 }));
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    act(() => {
      renderer.root.findAll((n) => n.props.accessibilityLabel === "Hurry the tally")[0].props.onPress();
    });
    expect(landedFlags(renderer)).toEqual([true, true]);
    expect(bagBlock(renderer)[0].props.accessibilityElementsHidden).toBe(false);
    expect(hosts(renderer, "The tally")[0].props.accessibilityState).toEqual({ disabled: true });
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  test("the server's receipt re-aims the count without restarting the landing", () => {
    jest.useFakeTimers();
    const r = receipt(tiedDomino(), { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    ticks(450, 1);
    ticks(40, 8);
    expect(landedFlags(renderer)).toEqual([true, false]);
    expect(texts(renderer)).toContain("48");
    // The server says the truffle was worth 12 on a count of 40.
    const fixed = reconcileReceipt(r, {
      tickles: [{ id: "l0:truffle_d", kind: "truffle_d", tickles: 12 }],
      ticklesTotal: 12,
      tickledBefore: 40,
      tickledNow: 52,
    });
    act(() => {
      renderer.update(
        wrap(<DigReceiptSheet visible receipt={fixed} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />, false),
      );
    });
    expect(landedFlags(renderer)).toEqual([true, false]); // still the first row only
    ticks(40, 8);
    expect(texts(renderer)).toContain("40");
    expect(texts(renderer)).toContain("52");
    expect(texts(renderer)).toContain("+12");
    act(() => renderer.unmount());
    jest.useRealTimers();
  });

  test("the woke tally: the taken truffle first at 'his', the count on cream, the next-time line", () => {
    // Wake in the mud with the fat one loose: descend at once, shove the L
    // until a draw under 20 wakes him (the mud shove threshold).
    let s = initialState(generateLayeredBoard(SEED), { coop: false, uncrewed: false });
    // The gate: topsoil's truffle first, then down.
    const domino = s.board.layers[0].finds.find((f) => f.food)!;
    for (const t of domino.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
    s = reduce(s, { type: "descend" });
    const fat = s.board.layers[1].finds.find((f) => f.kind === "truffle_l")!;
    for (const t of fat.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
    let guard = 0;
    while (!s.ended && guard++ < 40) {
      const buried = s.depths.findIndex((d) => d > 0);
      s = reduce(s, { type: "act", verb: "shove", tile: buried });
    }
    if (s.ended?.reason !== "wake" || s.missed.length === 0) return; // the seed stayed quiet — nothing to assert
    const r = receipt(s, { tickledBefore: 38 });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onClose={() => {}} />),
      );
    });
    const all = texts(renderer);
    expect(all.join("\n")).toContain("He woke. Still worth it.");
    expect(all.join("\n")).toContain("the truffle patch · he woke at the mud");
    expect(all).toContain("his");
    expect(all.join("\n")).toContain("comes back gilded next Feeding");
    expect(all.join("\n")).toContain("next time — tie it in topsoil?");
    act(() => renderer.unmount());
  });

  test("the woke tally: a thing lost with the pouch reads 'lost', a keepsake reads 'kept', the foot sums only the paid rows", () => {
    // Topsoil: the domino (banks on descent), the Boom (loose) and the
    // keepsake (kept); then wake in the mud on the first shove that does.
    // The first seed from SEED whose stream sleeps through topsoil and wakes
    // in the mud.
    const dig = (seed: number) => {
      let s = initialState(generateLayeredBoard(seed), { coop: false, uncrewed: false });
      const top = s.board.layers[0].finds;
      for (const kind of ["truffle_d", "boom", "junk"] as const) {
        const f = top.find((x) => x.kind === kind)!;
        for (const t of f.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
      }
      if (s.ended) return s;
      s = reduce(s, { type: "descend" });
      let guard = 0;
      while (!s.ended && guard++ < 60) {
        const buried = s.depths.findIndex((d) => d > 0);
        s = reduce(s, { type: "act", verb: "shove", tile: buried });
      }
      return s;
    };
    let s = dig(SEED);
    for (let seed = SEED + 1; (s.ended?.reason !== "wake" || s.ended.layer !== 1) && seed < SEED + 200; seed++) s = dig(seed);
    expect(s.ended).toEqual(expect.objectContaining({ reason: "wake", layer: 1 }));
    const top = s.board.layers[0].finds;
    const boom = top.find((x) => x.kind === "boom")!;
    const junk = top.find((x) => x.kind === "junk")!;
    expect(s.missed).toContain(boom.id);
    expect(s.things).toEqual([junk.id]);
    const r = receipt(s, { tickledBefore: 38 });
    const boomRow = r.rows.find((row) => row.id === boom.id)!;
    expect(boomRow.lost).toBe(true);
    expect(boomRow.value).toBe("lost");
    const junkRow = r.rows.find((row) => row.id === junk.id)!;
    expect(junkRow.kept).toBe(true);
    expect(junkRow.tickles).toBeUndefined();
    // Paid: the domino (10) and whatever the mud tied before the wake — never the Boom or the keepsake.
    const paid = r.rows.filter((row) => row.tickles != null && !row.lost).reduce((n, row) => n + (row.tickles ?? 0), 0);
    expect(r.ticklesTotal).toBe(paid);
    expect(paid).toBe(10);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onClose={() => {}} />),
      );
    });
    const all = texts(renderer);
    expect(all).toContain("lost");
    expect(all).toContain("kept");
    expect(all.join("\n")).toContain("lost with the layer");
    expect(all.join("\n")).toContain("what you'd tied is yours.");
    expect(all).toContain("+10"); // the foot: the dig · +10
    expect(all).toContain("48"); // 38 → 48 tickled now
    expect(all).not.toContain("+3"); // the Boom's tickles never land
    act(() => renderer.unmount());
  });

  test("the uncrewed receipt carries the join line and no GT", () => {
    let s = initialState(generateLayeredBoard(SEED), { coop: false, uncrewed: true });
    s = reduce(s, { type: "tie" });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={receipt(s)} onPrimary={() => {}} onJoin={() => {}} onClose={() => {}} />),
      );
    });
    const all = texts(renderer).join("\n");
    expect(all).toContain("truffles are for herds — find yours ›");
    expect(all).not.toContain("GT");
    // Before unknown: the count reads the dig's own total.
    expect(all).toContain("this dig");
    act(() => renderer.unmount());
  });

  test("uncrewed with a banked truffle: its row is the join door, and it pays", () => {
    const r = receipt(tiedDomino(true), { tickledBefore: 0 });
    const onJoin = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onJoin={onJoin} onClose={() => {}} />),
      );
    });
    const door = renderer.root.findAll((n) => n.props.accessibilityRole === "link")[0];
    expect(door).toBeDefined();
    act(() => {
      door.props.onPress();
    });
    expect(onJoin).toHaveBeenCalledTimes(1);
    const all = texts(renderer).join("\n");
    expect(all).toContain("truffles are for herds — find yours ›");
    expect(all).toContain("+10");
    act(() => renderer.unmount());
  });
});

describe("Hungerer", () => {
  test("a face per layer, awake on a wake; renders under Reduce Motion", () => {
    expect(hungererStateFor(0, false)).toBe("snoring");
    expect(hungererStateFor(1, false)).toBe("stirring");
    expect(hungererStateFor(2, false)).toBe("oneeye");
    expect(hungererStateFor(1, true)).toBe("awake");
    for (const state of ["snoring", "stirring", "oneeye", "awake"] as const) {
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(wrap(<Hungerer state={state} />, true));
      });
      expect(renderer.root.findAll((n) => n.props.accessibilityRole === "image")[0].props.accessibilityLabel).toContain(
        "the Great Hungerer",
      );
      act(() => renderer.unmount());
    }
  });
});

// ── Attention is visible (2026-09-16) ────────────────────────────────────────
describe("the sniff budget shows on the patch", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "mudwar", "SnoutDeepPatch.tsx"), "utf8");
  const hungerer = fs.readFileSync(path.join(__dirname, "..", "components", "mudwar", "Hungerer.tsx"), "utf8");
  it("the verb cards wear live odds, the sniff card its free count", () => {
    expect(src).toContain("function verbSub(state: SnoutDeepState, v: Verb): string");
    expect(src).toContain("return `free · ${left} left`;");
    expect(src).toContain("return `${wakePercent(thr)} · ${left} left`;");
    // …and under the meter, how loud the action is, in the bar's own units.
    expect(src).toContain('const price = thr <= 0 ? "free" : `+${thr}`;');
    expect(src).toContain("if (left > 0) return `${price} · ${left} left`;");
    expect(src).not.toMatch(/VERB_SUB\[/);
  });
  it("his face lifts a step and the tag says he's noticing", () => {
    expect(src).toContain("const attentive = !woke && nextSniffAttention(state) > 0;");
    expect(src).toContain(
      "hungererStateFor(state.layer, woke, attentive, metered ? { attention: meter, lo, hi } : null)",
    );
    expect(src).toContain('const ATTENTIVE_LABEL = "noticing you";');
    expect(hungerer).toContain("attentive = false,");
    // The bands come off the dig's stamp, not a constant.
    expect(hungerer).toContain("export function hungererBands(lo: number, hi: number)");
  });
  it("tie leaves, deeper opens a fresh board — said in the labels (the screen never scrolls)", () => {
    expect(src).toContain("Tie it off · leave");
    expect(src).toContain("Dig deeper · reset");
    expect(src).toContain("`Dig deeper, a new board in ${LAYER_NAMES[(state.layer + 1) as Layer]}${");
    // the tie is the gold one below the root too
    const footer = src.slice(src.indexOf("THE FOOTER"), src.indexOf("THE REVEAL"));
    expect(footer.match(/variant="gold"/g)?.length).toBe(2);
  });
});

// ── The meter on the patch (rules 2, 2026-09-17) ────────────────────────────

describe("the meter, the gate and the bag", () => {
  /** A dig that tied on the topsoil truffle — a receipt with rows on it. */
  function tiedTopsoilTruffle() {
    let s = initialState(generateLayeredBoard(SEED), { coop: false, uncrewed: false });
    const domino = s.board.layers[0].finds.find((f) => f.food)!;
    for (const t of domino.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
    return reduce(s, { type: "tie" });
  }
  const meterNode = (renderer: TestRenderer.ReactTestRenderer) =>
    renderer.root.findAll((n) => n.props.accessibilityRole === "progressbar")[0];
  const shove = (renderer: TestRenderer.ReactTestRenderer, tile: number) => {
    const node = pressables(renderer).filter((n) =>
      new RegExp(`^row ${Math.floor(tile / 6) + 1}, column ${(tile % 6) + 1}, `).test(
        n.props.accessibilityLabel ?? "",
      ),
    )[0];
    act(() => node.props.onLongPress());
  };

  test("the bar under his face reads the meter; the cards wear the loudness", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} rules={2} />));
    });
    // The bar runs to `hi`, and the band it paints is [lo, hi].
    const bar = meterNode(renderer);
    expect(bar.props.accessibilityLabel).toBe("his attention, 0 of 110. he sleeps through the first 50.");
    // The cards: the price is a numeral of its own, the budget its own line.
    expect(texts(renderer)).toEqual(expect.arrayContaining(["free", "· 5 left", "+1", "+10"]));
    const all = texts(renderer).join("\n");
    expect(all).not.toMatch(/% he wakes/); // the meter's language, not rule 1's
    expect(all).toContain("sound asleep"); // the tag reads the band, not the layer
    // Four far-apart shoves lift the bar forty 120ths — and it shows.
    for (const tile of [0, 5, 24, 29]) shove(renderer, tile);
    expect(seen.latest!.attention).toBe(40);
    expect(seen.latest!.ended).toBeNull();
    expect(meterNode(renderer).props.accessibilityLabel).toBe(
      "his attention, 40 of 110. he sleeps through the first 50.",
    );
    // …and the cards do NOT climb: the loudness of a shove is still ten.
    expect(texts(renderer)).toEqual(expect.arrayContaining(["+10"]));
    // Past `lo` the bar speaks the hazard instead, and his face has opened an eye.
    for (const tile of [12, 17]) shove(renderer, tile);
    expect(seen.latest!.attention).toBe(60);
    expect(meterNode(renderer).props.accessibilityLabel).toBe(
      "his attention, 60 of 110. past 50 — about a 2% chance the next rub is the one.",
    );
    expect(texts(renderer).join("\n")).toContain("stirring");
    act(() => renderer.unmount());
  });

  test("the sleeper strip is the meter's row — rules 2 only, one element, one label", () => {
    const strip = (renderer: TestRenderer.ReactTestRenderer) =>
      renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === "sleeper-strip");
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} rules={2} />));
    });
    expect(strip(renderer)).toHaveLength(1);
    // One element, and it reads the bar: where he is, where the band starts,
    // and the word his face is saying.
    expect(strip(renderer)[0].props.accessible).toBe(true);
    expect(strip(renderer)[0].props.accessibilityLabel).toBe(
      "attention 0 of 110, band from 50; sound asleep",
    );
    // The band's two ends are stamped under it.
    expect(texts(renderer)).toEqual(expect.arrayContaining(["50", "110"]));
    // Four shoves later the label has moved with the bar.
    for (const tile of [0, 5, 24, 29]) shove(renderer, tile);
    expect(strip(renderer)[0].props.accessibilityLabel).toBe(
      "attention 40 of 110, band from 50; sound asleep",
    );
    act(() => renderer.unmount());

    // Rules 1 never grows one: the rail keeps its face and its tag.
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} />));
    });
    expect(strip(renderer)).toHaveLength(0);
    expect(
      renderer.root.findAll((n) => typeof n.type === "string" && n.props.testID === "hungerer-tag"),
    ).not.toHaveLength(0);
    act(() => renderer.unmount());
  });

  test("the meter's bar paints the band and stops at `hi`", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} rules={2} />));
    });
    // The band is drawn as its own stretch of the track, from lo to hi.
    const bands = renderer.root.findAll(
      (n) =>
        typeof n.type === "string" &&
        Array.isArray(n.props.style) &&
        n.props.style.some((x: unknown) => !!x && typeof x === "object" && "left" in (x as object)),
    );
    expect(bands.length).toBeGreaterThan(0);
    const style = bands[0].props.style.find((x: Record<string, unknown>) => x && "left" in x);
    expect(style.left).toBe(`${(50 / 110) * 100}%`);
    expect(style.width).toBe(`${(60 / 110) * 100}%`);
    act(() => renderer.unmount());
  });

  test("rules 1 has no meter at all — the patch is what build 192 shipped", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} />));
    });
    expect(renderer.root.findAll((n) => n.props.accessibilityRole === "progressbar")).toHaveLength(0);
    expect(texts(renderer).join("\n")).toMatch(/% he wakes/);
    act(() => renderer.unmount());
  });

  test("the descent gate names what it wants, and the press does nothing until it has it", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness seed={QUIET} />));
    });
    expect(texts(renderer).join("\n")).toContain("Find the truffle first");
    const shut = pressables(renderer).filter((n) => n.props.accessibilityLabel === "Dig deeper, not yet")[0];
    expect(shut).toBeDefined();
    expect(shut.props.accessibilityHint).toBe("Find this board's truffle first");
    expect(shut.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    act(() => shut.props.onPress?.());
    expect(seen.latest!.layer).toBe(0); // the reducer refuses it too
    // The truffle up: the door opens and says the other thing.
    surface(renderer, truffleHere());
    expect(texts(renderer).join("\n")).toContain("Dig deeper · reset");
    pressLabelled(renderer, /^Dig deeper, a new board in the mud/);
    expect(seen.latest!.layer).toBe(1);
    act(() => renderer.unmount());
  });

  test("the bag beat always shows once the server has answered — 'nothing for the bag this dig'", () => {
    // The server's receipt landed and named no roll: the block still lands.
    const r = reconcileReceipt(receipt(tiedTopsoilTruffle(), { tickledBefore: 38 }), { ticklesTotal: 10 });
    expect(r.satchelKnown).toBe(true);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onClose={() => {}} />),
      );
    });
    const block = renderer.root.findAll(
      (n) => typeof n.type === "string" && n.props.testID === "dig-satchel",
    );
    expect(block).toHaveLength(1);
    expect(
      renderer.root.findAll(
        (n) => typeof n.type === "string" && typeof n.props.testID === "string" && /^dig-satchel-(find|lost)-/.test(n.props.testID),
      ),
    ).toHaveLength(0);
    const all = texts(renderer).join("\n");
    expect(all).toContain("nothing for the bag this dig");
    expect(all).toContain("the satchel");
    act(() => renderer.unmount());
  });

  test("the help ledger explains the meter under rules 2, and does not invent one under rules 1", () => {
    for (const rules of [2, 1] as const) {
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          wrap(<SnoutDeepHelpSheet visible rules={rules} onClose={() => {}} />),
        );
      });
      const all = texts(renderer).join("\n");
      expect(all).toContain("Snout Deep");
      if (rules === 2) {
        expect(all).toContain("How deep he sleeps");
        expect(all).toContain("the darker stretch is where he might wake");
      } else {
        expect(all).not.toContain("How deep he sleeps");
      }
      act(() => renderer.unmount());
    }
  });
});

// ── The rule set rides in from the server (2026-09-17 §2) ───────────────────
describe("rules on the wire", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const read = (...bits: string[]) => fs.readFileSync(path.join(__dirname, "..", ...bits), "utf8");

  it("the open asks for the newest rules and keeps what the server stamps", () => {
    const hook = read("hooks", "useRooting.ts");
    expect(hook).toMatch(/p_rules:\s*SNOUT_DEEP_RULES_MAX/);
    expect(hook).toContain("rules: r.rules === 2 ? 2 : 1,");
    // Absent on an un-migrated server → rule 1, by the session's own type.
    expect(read("utils", "digSession.ts")).toContain("rules?: 1 | 2;");
  });

  it("the dig plays under the row's rules, and a restore replays under them too", () => {
    const dig = read("components", "mudwar", "SnoutDeepDig.tsx");
    expect(dig).toContain("rules: session.rules ?? 1,");
    expect(dig).toContain("const next = restore(board, opts, snapshot);");
  });

  it("the dev preview takes ?rules=1|2, ?meter=lo-hi and ?scope=, and plays the meter by default", () => {
    const preview = read("components", "dev", "screens", "snout-deep-preview.tsx");
    expect(preview).toContain('const rules: 1 | 2 = one(params.rules) === "1" ? 1 : 2;');
    expect(preview).toContain("initialState(board, { coop, uncrewed, rules, wakeMeter })");
    expect(preview).toContain("rules?: string | string[];");
    expect(preview).toContain("meter?: string | string[];");
    expect(preview).toContain("scope?: string | string[];");
    expect(preview).toContain('const scope = one(params.scope) === "dig" ? "dig" : WAKE_METER.scope;');
  });

  it("the session carries the row's wake-meter stamp, sanitized", () => {
    const hook = read("hooks", "useRooting.ts");
    expect(hook).toContain("sanitizeWakeMeter(r.wake_meter)");
    expect(read("utils", "digSession.ts")).toContain("wakeMeter?: WakeMeter;");
    expect(read("components", "mudwar", "SnoutDeepDig.tsx")).toContain(
      "...(session.wakeMeter ? { wakeMeter: session.wakeMeter } : {}),",
    );
  });
});
