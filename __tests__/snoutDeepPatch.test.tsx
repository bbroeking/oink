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
import { DigReceiptSheet } from "../components/mudwar/SnoutDeepSheets";
import { Hungerer, hungererStateFor } from "../components/mudwar/Hungerer";
import { MotionPolicyProvider } from "../hooks/useMotionPolicy";
import { generateLayeredBoard } from "../utils/rooting";
import { initialState, receipt, reduce, type DigReceipt, type SnoutDeepState } from "../utils/snoutDeep";

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
// The harness reports its state through a box the tests read after each act.
const seen: { latest: SnoutDeepState | null; done: DigReceipt | null } = { latest: null, done: null };

function Harness({ coop = false, uncrewed = false }: { coop?: boolean; uncrewed?: boolean }) {
  const [state, dispatch] = useReducer(reduce, undefined, () =>
    initialState(generateLayeredBoard(SEED), { coop, uncrewed }),
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
    expect(all).toContain("Dig deeper");
    for (const word of ["Sniff", "Rub", "Shove", "free", "quiet", "loud"]) expect(all).toContain(word);
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

  test("Dig deeper enters the mud (stirring); at the root the footer is one gold tie", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(wrap(<Harness />));
    });
    pressLabelled(renderer, /^Dig deeper, into the mud/);
    expect(seen.latest!.layer).toBe(1);
    let all = texts(renderer).join("\n");
    expect(all).toContain("stirring");
    expect(all).toMatch(/the mud\. fatter down here/);
    pressLabelled(renderer, /^Dig deeper, into the root/);
    expect(seen.latest!.layer).toBe(2);
    all = texts(renderer).join("\n");
    expect(all).toContain("one eye open");
    expect(all).toContain("quietest");
    expect(all).toContain("Tie it off · +0 Golden Truffles");
    expect(all).not.toContain("Dig deeper");
    pressLabelled(renderer, /^Tie it off, plus 0 Golden Truffles/);
    expect(seen.latest!.ended).toEqual({ reason: "tie", layer: 2 });
    expect(seen.done?.kind).toBe("tied");
    expect(seen.done?.title).toBe("Tied off at the root");
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

describe("the sheets", () => {
  test("the receipt sheet lays the rows on the ledger with the primary and the secondary", () => {
    let s = initialState(generateLayeredBoard(SEED), { coop: false, uncrewed: false });
    const domino = s.board.layers[0].finds.find((f) => f.kind === "truffle_d")!;
    for (const t of domino.tiles) s = reduce(s, { type: "act", verb: "shove", tile: t });
    s = reduce(s, { type: "tie" });
    const r = receipt(s);
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        wrap(<DigReceiptSheet visible receipt={r} onPrimary={() => {}} onSecondary={() => {}} onClose={() => {}} />),
      );
    });
    const all = texts(renderer).join("\n");
    expect(all).toContain("Tied off in topsoil");
    expect(all).toContain("a Golden Truffle");
    expect(all).toContain("+1 GT");
    expect(all).toContain("+20 XP");
    expect(all).toContain("Back to Barn");
    expect(all).toContain("share the dig ›");
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
