import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { HabitatItemPreviewModal } from "../components/habitat/HabitatItemPreviewModal";
import { AdaptiveModalScaffold } from "../components/ui/AdaptiveModalScaffold";
import type { HabitatCatalogItem } from "../utils/habitat";

jest.mock("../components/ui/PopupQueue", () => ({
  useUnmanagedModalHold: jest.fn(),
}));

const item: HabitatCatalogItem = {
  id: "reading_chair",
  assetKey: "reading_chair",
  name: "Reading Chair",
  description: "A soft chair for a quiet corner.",
  category: "floor_decor",
  rarity: "uncommon",
  snoutCost: 100,
  isForSale: true,
  active: true,
  displayOrder: 1,
};

function render(overrides: Partial<React.ComponentProps<typeof HabitatItemPreviewModal>> = {}) {
  return TestRenderer.create(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}
    >
      <HabitatItemPreviewModal
        item={item}
        owned={false}
        balance={150}
        busy={false}
        onClose={jest.fn()}
        onBuy={jest.fn()}
        {...overrides}
      />
    </SafeAreaProvider>,
  );
}

const text = (renderer: TestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .join(" ")
    .replace(/\s+/g, " ");

describe("HabitatItemPreviewModal", () => {
  test("explains the free prestige alternative before allowing an early purchase", () => {
    const onBuy = jest.fn();
    const renderer = render({ item: { ...item, prestigeRank: 4 }, onBuy });
    expect(text(renderer)).toContain("Free at Wallow Rank 4, or buy it now.");
    expect(onBuy).not.toHaveBeenCalled();
    act(() => renderer.root.findByProps({ testID: "habitat-buy-button" }).props.onPress());
    expect(onBuy).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });
  test("buys only from an explicit enabled press", () => {
    const onBuy = jest.fn();
    const renderer = render({ onBuy });
    expect(onBuy).not.toHaveBeenCalled();
    const buy = renderer.root.findByProps({ testID: "habitat-buy-button" });
    act(() => buy.props.onPress());
    expect(onBuy).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  test.each([
    ["owned", { owned: true }, "Owned"],
    ["insufficient", { balance: 25 }, "Not enough · need 75"],
    ["unavailable", { canPurchase: false }, "Unavailable right now"],
    ["inactive", { item: { ...item, active: false } }, "Unavailable right now"],
    ["earned", { item: { ...item, snoutCost: 0, isForSale: false } }, "Earned, not sold"],
  ])("locks the %s state", (_name, overrides, copy) => {
    const onBuy = jest.fn();
    const renderer = render({ ...overrides, onBuy });
    expect(text(renderer)).toContain(copy);
    expect(renderer.root.findAllByProps({ testID: "habitat-buy-button" })).toHaveLength(0);
    expect(onBuy).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  test("keeps close and room preview actions isolated from purchase", () => {
    const onBuy = jest.fn();
    const onClose = jest.fn();
    const onToggleRoomPreview = jest.fn();
    const renderer = render({
      onBuy,
      onClose,
      onToggleRoomPreview,
      roomPreview: <Text>Barn scene</Text>,
    });
    act(() => renderer.root.findByProps({ testID: "habitat-room-preview-toggle" }).props.onPress());
    expect(onToggleRoomPreview).toHaveBeenCalledTimes(1);
    expect(onBuy).not.toHaveBeenCalled();
    expect(text(renderer)).toContain("Buy it once, then place it in your Barn.");
    const close = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === "Close Reading Chair preview",
    )[0];
    act(() => close.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBuy).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  test("fills the bounded art panel with the room preview", () => {
    const renderer = render({
      roomPreview: <Text>Barn scene</Text>,
      showRoomPreview: true,
      onToggleRoomPreview: jest.fn(),
    });
    const preview = renderer.root.findByProps({ testID: "habitat-room-preview" });
    expect(preview.props.style).toMatchObject({ width: "100%", height: "100%" });
    expect(text(renderer)).toContain("Barn scene");
    act(() => renderer.unmount());
  });

  test("keeps the scaffold mounted while hidden", () => {
    const renderer = render({ item: null });
    const scaffold = renderer.root.findByType(AdaptiveModalScaffold);
    expect(scaffold.props.visible).toBe(false);
    expect(text(renderer)).not.toContain("Reading Chair");
    act(() => renderer.unmount());
  });

  test("offers explicit place and wishlist actions for an owned furnishing", () => {
    const onPlace = jest.fn();
    const onToggleWishlist = jest.fn();
    const renderer = render({
      owned: true,
      onPlace,
      onToggleWishlist,
      acquisitionPaths: ["Barn Collection · 100 Snouts", "Free gift at Wallow Rank 4"],
    });
    expect(text(renderer)).toContain("How to get it");
    expect(text(renderer)).toContain("Barn Collection · 100 Snouts");
    act(() => renderer.root.findByProps({ testID: "habitat-place-button" }).props.onPress());
    act(() => renderer.root.findByProps({ testID: "habitat-wishlist-button" }).props.onPress());
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onToggleWishlist).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });
});
