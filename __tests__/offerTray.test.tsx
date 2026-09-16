// The offer tray — the low card over the strip that owns the whole swap
// decision: the find you are giving, what the host's pig can spare, or
// "…or just give it".
//
// The tray renders EXACTLY what friend_wishes returned (the server's
// `_wish_options`), never a rule of its own — so an empty list is the honest
// "gift only" state, not a failure, and a tile's tap hands its find straight
// back to the caller.
//
// Its shape is the approved canvas (docs/design/claude-design/swap-2026-09-16):
// a header naming the find you are giving beside the host's line, a row of
// equal named tiles, and the gift — a link with options, the gold button
// without. No counts, no scrim: the pigs and the wish bubble stay visible.
jest.mock("../utils/log", () => ({ log: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));

import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { OfferTray } from "@/components/visit/OfferTray";

describe("OfferTray", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const onTake = jest.fn();
  const onClose = jest.fn();

  afterEach(() => {
    act(() => tree?.unmount());
    jest.clearAllMocks();
  });

  const render = (options: React.ComponentProps<typeof OfferTray>["options"], busy = false) => {
    act(() => {
      tree = TestRenderer.create(
        <OfferTray
          hostName="Maple"
          give="blue_feather"
          options={options}
          busy={busy}
          onTake={onTake}
          onClose={onClose}
        />,
      );
    });
  };

  // A testID lands on the primitive's composite, its inner Pressable and its
  // host views. Keep the OUTERMOST composite per distinct control (depth-first
  // order), which is the one that owns onPress and the a11y props.
  const composites = (id: string) => {
    const seen = new Set<string>();
    return tree.root
      .findAll(
        (n) =>
          n.props.testID === id &&
          typeof n.type !== "string" &&
          typeof n.props.onPress === "function",
      )
      .filter((n) => {
        const key = String(n.props.accessibilityLabel);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };
  // The tray card itself has no press; count its host views instead.
  const hosts = (id: string) =>
    tree.root.findAll((n) => n.props.testID === id && typeof n.type === "string");
  const text = () =>
    tree.root
      .findAll((n) => typeof n.props.children === "string")
      .map((n) => n.props.children as string);

  it("asks for the host's spare in the host's name, and draws one tile per option", () => {
    render(["old_key", "marble", "pinecone"]);
    expect(hosts("visit-offer-tray").length).toBeGreaterThan(0);
    expect(composites("visit-offer-option")).toHaveLength(3);
    // The header is two lines: the host's kicker over the trade it is offering.
    expect(text()).toContain("Maple's pig can spare");
    expect(text()).toContain("one of these for your blue feather");
  });

  it("names every option under its art, and never counts the host's bag", () => {
    render(["old_key", "marble", "pinecone"]);
    const said = text().join(" ");
    expect(said).toContain("old key");
    expect(said).toContain("glass marble");
    expect(said).toContain("pinecone");
    // A count would put the host's bag on show; §12 says the options are bare
    // find ids and nothing else.
    expect(said).not.toMatch(/\bx\s?\d|\u00d7\s?\d|\b\d+\s*(?:left|held)\b/);
  });

  it("the gift is the quiet link while there is something to take", () => {
    render(["old_key"]);
    const gift = composites("visit-offer-gift")[0];
    expect(gift.props.accessibilityLabel).toBe("Just give it");
    expect(text().join(" ")).toContain("…or just give it");
  });

  it("the card carries a way out that is not a tap on the pigs", () => {
    render(["old_key"]);
    const close = tree.root.findAll(
      (n) =>
        typeof n.type !== "string" &&
        n.props.accessibilityLabel === "Back to the visit" &&
        typeof n.props.onPress === "function",
    );
    expect(close.length).toBeGreaterThan(0);
    act(() => close[0].props.onPress());
    expect(onClose).toHaveBeenCalled();
  });

  it("labels every tile with what taking it does", () => {
    render(["old_key", "marble"]);
    const labels = composites("visit-offer-option").map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(["Take the old key", "Take the glass marble"]);
  });

  it("a tile's tap hands its find back; the link hands back null", async () => {
    render(["old_key", "marble"]);
    await act(async () => {
      await composites("visit-offer-option")[1].props.onPress();
    });
    expect(onTake).toHaveBeenCalledWith("marble");

    onTake.mockClear();
    await act(async () => {
      await composites("visit-offer-gift")[0].props.onPress();
    });
    expect(onTake).toHaveBeenCalledWith(null);
  });

  it("an empty offer is 'gift only' — never a broken tray", () => {
    render([]);
    expect(composites("visit-offer-option")).toHaveLength(0);
    // The gift is still the way out of the decision — and now the decision
    // itself, so it wears the gold rather than the link.
    const gift = composites("visit-offer-gift");
    expect(gift.length).toBeGreaterThan(0);
    expect(gift[0].props.variant).toBe("gold");
    const said = text().join(" ");
    expect(said).toContain("Maple's pig");
    expect(said).toContain("has nothing to spare yet");
    expect(said).toContain("a gift still tickles you both");
    expect(said).toContain("Just give it");
  });

  it("busy disables the tiles and the link while a call is in flight", () => {
    render(["old_key"], true);
    for (const n of composites("visit-offer-option")) expect(n.props.disabled).toBe(true);
    for (const n of composites("visit-offer-gift")) expect(n.props.disabled).toBe(true);
  });

  it("carries no emoji — the finds are painted art", () => {
    render(["old_key"]);
    expect(text().join(" ")).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
